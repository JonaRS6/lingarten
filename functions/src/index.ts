import {initializeApp} from 'firebase-admin/app';
import {AggregateField, FieldValue, getFirestore} from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import {createHash} from 'node:crypto';
import {
  FIRST_REFERENCE_SEQUENCE,
  LAST_REFERENCE_SEQUENCE,
  allocate,
  referenceFromSequence,
  referencesIn,
  roundCents,
  UnpaidTicket
} from './payments';

initializeApp();

const db = getFirestore();
const ADMIN_EMAILS = new Set([
  'jersneme6@gmail.com',
  'lingartendmor@gmail.com'
]);
const MAX_TICKET_TYPE_LENGTH = 256;
const FIRESTORE_BATCH_LIMIT = 500;
const TIME_ZONE = 'America/Mexico_City';
// Mexico City has no daylight saving time since 2022.
const TIME_ZONE_OFFSET_MS = 6 * 60 * 60 * 1000;
const NOT_FOUND_CODE = 5;
const MAX_STATEMENT_ROWS = 500;
const MAX_DESCRIPTION_LENGTH = 500;
const REFERENCE_COUNTER = db.collection('counters').doc('paymentRef');
// Clients per transaction when assigning missing references: two writes each.
const REFERENCE_CHUNK = 200;

// 'manual' notes are the special ones created from the dashboard; 'system'
// notes come from client registration and the monthly job.
type TicketOrigin = 'manual' | 'system';

interface Ticket {
  paid: boolean;
  generated: number;
  type: string;
  cost: number;
  origin: TicketOrigin;
}

interface TicketRequest {
  clientId: string;
  ticket: Pick<Ticket, 'type' | 'cost'> & {generated?: unknown};
}

interface ClientRequest {
  client: unknown;
  ticket: unknown;
}

type TicketAction = 'pay' | 'restore' | 'delete';

function requireAdministrator(context: functions.https.CallableContext): void {
  const token = context.auth?.token;

  if (!token) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Debes iniciar sesión para usar esta función.'
    );
  }

  if (typeof token.email !== 'string' || !ADMIN_EMAILS.has(token.email.toLowerCase()) || token.email_verified !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Esta cuenta no tiene permisos para usar esta función.'
    );
  }
}

function requireDocumentId(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1500 || value.includes('/')) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} no es válido.`);
  }

  return value;
}

function requireTicket(value: unknown): Pick<Ticket, 'type' | 'cost'> {
  if (!value || typeof value !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'La nota no es válida.');
  }

  const ticket = value as Record<string, unknown>;
  const type = typeof ticket.type === 'string' ? ticket.type.trim() : '';
  const cost = ticket.cost;

  if (type.length === 0 || type.length > MAX_TICKET_TYPE_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', 'El concepto de la nota no es válido.');
  }

  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
    throw new functions.https.HttpsError('invalid-argument', 'El importe de la nota no es válido.');
  }

  return {type, cost};
}

// Accepts dates between 2000 and 2100 in epoch milliseconds.
function requireTicketDate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || value < Date.UTC(2000, 0, 1) || value > Date.UTC(2100, 0, 1)) {
    throw new functions.https.HttpsError('invalid-argument', 'La fecha de la nota no es válida.');
  }

  return Math.trunc(value);
}

function requireClient(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', 'Los datos del cliente no son válidos.');
  }

  const client = {...value as Record<string, unknown>};
  delete client.id;

  if (typeof client.name !== 'string' || client.name.trim().length < 2
    || typeof client.lastname !== 'string' || client.lastname.trim().length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'El nombre del cliente no es válido.');
  }

  return client;
}

function requireAction(value: unknown): TicketAction {
  if (value === 'pay' || value === 'restore' || value === 'delete') {
    return value;
  }

  throw new functions.https.HttpsError('invalid-argument', 'La acción solicitada no es válida.');
}

export const createTicket = functions.https.onCall(async (data: TicketRequest, context) => {
  requireAdministrator(context);

  const clientId = requireDocumentId(data?.clientId, 'clientId');
  const ticket = requireTicket(data?.ticket);
  const clientRef = db.collection('clients').doc(clientId);

  if (!(await clientRef.get()).exists) {
    throw new functions.https.HttpsError('not-found', 'El cliente no existe.');
  }

  const requestedDate = data?.ticket?.generated;
  const ticketRef = await clientRef.collection('tickets').add({
    ...ticket,
    generated: requestedDate ? requireTicketDate(requestedDate) : Date.now(),
    paid: false,
    origin: 'manual'
  });

  return {ticketId: ticketRef.id};
});

export const createClient = functions.https.onCall(async (data: ClientRequest, context) => {
  requireAdministrator(context);

  const client = requireClient(data?.client);
  const ticket = requireTicket(data?.ticket);
  const clientRef = db.collection('clients').doc();
  const ticketRef = clientRef.collection('tickets').doc();

  const paymentRef = await db.runTransaction(async (tx) => {
    const [reference] = await reserveReferences(tx, 1);
    tx.create(clientRef, {
      ...client,
      paymentRef: reference,
      credit: 0,
      registerDate: FieldValue.serverTimestamp()
    });
    tx.create(db.collection('paymentRefs').doc(reference), {clientId: clientRef.id});
    tx.create(ticketRef, {
      ...ticket,
      generated: Date.now(),
      paid: false,
      origin: 'system'
    });
    return reference;
  });

  return {clientId: clientRef.id, ticketId: ticketRef.id, paymentRef};
});

// Gives a reference to every client registered before references existed.
// Safe to run again: clients that already have one are left alone.
export const assignMissingReferences = functions.https.onCall(async (_data, context) => {
  requireAdministrator(context);

  const clients = await db.collection('clients').get();
  const missing = clients.docs.filter((client) => typeof client.get('paymentRef') !== 'string');

  let assigned = 0;
  for (let start = 0; start < missing.length; start += REFERENCE_CHUNK) {
    const chunk = missing.slice(start, start + REFERENCE_CHUNK).map((client) => client.ref);
    assigned += await db.runTransaction(async (tx) => {
      const current = await tx.getAll(...chunk);
      const pending = current.filter((client) => client.exists && typeof client.get('paymentRef') !== 'string');
      const references = await reserveReferences(tx, pending.length);
      pending.forEach((client, index) => {
        tx.update(client.ref, {paymentRef: references[index]});
        tx.create(db.collection('paymentRefs').doc(references[index]), {clientId: client.id});
      });
      return pending.length;
    });
  }

  return {assigned};
});

export const getStats = functions.https.onCall(async (_data, context) => {
  requireAdministrator(context);
  return stats();
});

export const updateTicket = functions.https.onCall(async (data: {
  clientId?: unknown;
  ticketId?: unknown;
  action?: unknown;
}, context) => {
  requireAdministrator(context);

  const clientId = requireDocumentId(data?.clientId, 'clientId');
  const ticketId = requireDocumentId(data?.ticketId, 'ticketId');
  const action = requireAction(data?.action);
  const ticketRef = db.collection('clients').doc(clientId).collection('tickets').doc(ticketId);

  if (action === 'pay') {
    await updateExistingTicket(ticketRef, {paid: true, paidDate: Date.now()});
  } else {
    await undoTicket(ticketRef, action);
  }

  return {updated: true};
});

export const setTicketDate = functions.https.onCall(async (data: {
  clientId?: unknown;
  ticketId?: unknown;
  generated?: unknown;
}, context) => {
  requireAdministrator(context);

  const clientId = requireDocumentId(data?.clientId, 'clientId');
  const ticketId = requireDocumentId(data?.ticketId, 'ticketId');
  const generated = requireTicketDate(data?.generated);
  const ticketRef = db.collection('clients').doc(clientId).collection('tickets').doc(ticketId);

  await updateExistingTicket(ticketRef, {generated});
  return {updated: true};
});

export const quickPay = functions.https.onCall(async (data: {clientId?: unknown}, context) => {
  requireAdministrator(context);

  const clientId = requireDocumentId(data?.clientId, 'clientId');
  const unpaidTickets = await db.collection('clients').doc(clientId).collection('tickets')
    .where('paid', '==', false)
    .get();

  const paidDate = Date.now();
  const tickets = unpaidTickets.docs;
  for (let start = 0; start < tickets.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const ticket of tickets.slice(start, start + FIRESTORE_BATCH_LIMIT)) {
      batch.update(ticket.ref, {paid: true, paidDate});
    }
    await batch.commit();
  }

  return {updated: tickets.length};
});

export const checkStatus = functions.firestore.document('clients/{clientId}/tickets/{ticketId}')
  .onWrite(async (change, context) => {
    // Date or concept edits do not change how many notes are unpaid.
    if (change.before.exists && change.after.exists && change.before.get('paid') === change.after.get('paid')) {
      return;
    }

    const clientRef = db.collection('clients').doc(context.params.clientId);
    const [client, unpaid] = await Promise.all([
      clientRef.get(),
      clientRef.collection('tickets').where('paid', '==', false).count().get()
    ]);
    const unpaidCount = unpaid.data().count;
    const status = unpaidCount === 0 ? 'pagado' : unpaidCount > 1 ? 'atrasado' : 'pendiente';

    // Skipping unchanged writes spares every open client table a re-read.
    if (!client.exists || client.get('status') === status) {
      return;
    }

    await clientRef.update({status});
    functions.logger.info('Estado de cliente actualizado.', {
      clientId: context.params.clientId,
      status
    });
  });

export const createTickets = functions.pubsub.schedule('15 0 1 * *').timeZone(TIME_ZONE).onRun(async () => {
  const {month} = zonedYearMonth(Date.now());
  const serviceTypes = ['mensual', (month + 1) % 2 === 1 ? 'inpar' : 'par', monthName(month + 1)];
  const results = await Promise.all(serviceTypes.map(createTicketsForServiceType));
  const created = results.reduce((sum, current) => sum + current, 0);

  functions.logger.info('Notas programadas creadas.', {created, serviceTypes});
  return {created};
});

// Runs at the start of each month, before createTickets adds the new notes,
// and records the month that just ended.
export const gennMonthRecord = functions.pubsub.schedule('0 0 1 * *').timeZone(TIME_ZONE).onRun(async () => {
  const currentMonthStart = monthStart(Date.now());
  const previousMonthStart = monthStart(currentMonthStart - 1);
  const {year, month} = zonedYearMonth(previousMonthStart);
  const [earns, debt] = await Promise.all([
    earnsBetween(previousMonthStart, currentMonthStart),
    currentDebt()
  ]);

  await db.collection('records').add({
    year,
    month,
    incomes: earns,
    debt,
    date: Date.now()
  });
});

async function createTicketsForServiceType(type: string): Promise<number> {
  const clients = await db.collection('clients')
    .where('active', '==', true)
    .where('service.type', '==', type)
    .get();

  const eligibleClients = clients.docs.filter((client) => {
    const cost = client.get('service.cost');
    return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
  });

  // Up to two writes per client: the note and the credit it uses.
  const chunkSize = FIRESTORE_BATCH_LIMIT / 2;
  for (let start = 0; start < eligibleClients.length; start += chunkSize) {
    const batch = db.batch();
    for (const client of eligibleClients.slice(start, start + chunkSize)) {
      const cost: number = client.get('service.cost');
      const generated = Date.now();
      const paidWithCredit = cost > 0 && creditOf(client) >= cost;
      batch.create(client.ref.collection('tickets').doc(), {
        cost,
        generated,
        paid: paidWithCredit,
        ...(paidWithCredit ? {paidDate: generated, paidWithCredit: true} : {}),
        type: 'Servicio de recolección semanal',
        origin: 'system'
      });
      if (paidWithCredit) {
        batch.update(client.ref, {credit: FieldValue.increment(-cost)});
      }
    }
    await batch.commit();
  }

  return eligibleClients.length;
}

// Turns a missing note into a clean not-found error instead of reading it first.
async function updateExistingTicket(
  ticketRef: FirebaseFirestore.DocumentReference,
  data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
): Promise<void> {
  try {
    await ticketRef.update(data);
  } catch (error) {
    if ((error as {code?: unknown}).code === NOT_FOUND_CODE) {
      throw new functions.https.HttpsError('not-found', 'La nota no existe.');
    }
    throw error;
  }
}

interface StatementRow {
  date: number;
  amount: number;
  description: string;
}

interface AppliedPayment {
  clientId: string;
  appliedTickets: {ticketId: string; cost: number}[];
  // The client's credit once the deposit was applied.
  creditAfter: number;
}

type PaymentStatus = 'applied' | 'unmatched' | 'duplicate';

// Imports the deposits of a bank statement. Each one is matched to a client
// by the reference written in its description and settles that client's
// notes. Importing the same statement twice does not count a deposit twice.
export const importPayments = functions.https.onCall(async (data: {rows?: unknown}, context) => {
  requireAdministrator(context);

  const rows = requireStatementRows(data?.rows);
  const importedBy = context.auth?.token.email ?? null;
  const occurrences = new Map<string, number>();
  const summary = {applied: 0, unmatched: 0, duplicate: 0};

  // One at a time: two deposits from the same client must not race.
  for (const row of rows) {
    const key = `${row.date}|${row.amount}|${row.description}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    const paymentId = createHash('sha256').update(`${key}|${occurrence}`).digest('hex').slice(0, 40);

    const status = await importPayment(paymentId, row, importedBy);
    summary[status]++;
  }

  return summary;
});

// Settles an unmatched deposit with the client the administrator chose.
export const assignPayment = functions.https.onCall(async (data: {
  paymentId?: unknown;
  clientId?: unknown;
}, context) => {
  requireAdministrator(context);

  const paymentId = requireDocumentId(data?.paymentId, 'paymentId');
  const clientId = requireDocumentId(data?.clientId, 'clientId');
  const paymentRef = db.collection('payments').doc(paymentId);

  return db.runTransaction(async (tx) => {
    const payment = await tx.get(paymentRef);
    requireUnmatched(payment);

    const applied = await applyPayment(tx, paymentRef.id, payment.get('amount'), clientId);
    if (!applied) {
      throw new functions.https.HttpsError('not-found', 'El cliente no existe.');
    }

    tx.update(paymentRef, {status: 'applied', ...applied, assignedBy: context.auth?.token.email ?? null});
    return applied;
  });
});

// Marks an unmatched deposit as not coming from a client.
export const ignorePayment = functions.https.onCall(async (data: {paymentId?: unknown}, context) => {
  requireAdministrator(context);

  const paymentRef = db.collection('payments').doc(requireDocumentId(data?.paymentId, 'paymentId'));
  await db.runTransaction(async (tx) => {
    requireUnmatched(await tx.get(paymentRef));
    tx.update(paymentRef, {status: 'ignored', assignedBy: context.auth?.token.email ?? null});
  });

  return {updated: true};
});

async function importPayment(paymentId: string, row: StatementRow, importedBy: string | null): Promise<PaymentStatus> {
  const paymentRef = db.collection('payments').doc(paymentId);

  return db.runTransaction(async (tx) => {
    if ((await tx.get(paymentRef)).exists) {
      return 'duplicate';
    }

    const references = referencesIn(row.description);
    const owners = references.length > 0
      ? await tx.getAll(...references.map((reference) => db.collection('paymentRefs').doc(reference)))
      : [];
    const clientIds = [...new Set(owners.filter((owner) => owner.exists).map((owner) => owner.get('clientId') as string))];
    // Two different clients in one description is not guessed at.
    const applied = clientIds.length === 1 ? await applyPayment(tx, paymentId, row.amount, clientIds[0]) : null;

    tx.create(paymentRef, {
      source: 'csv',
      amount: row.amount,
      receivedAt: row.date,
      description: row.description,
      references,
      status: applied ? 'applied' : 'unmatched',
      ...(applied ?? {}),
      importedAt: Date.now(),
      importedBy
    });
    return applied ? 'applied' : 'unmatched';
  });
}

// Adds the deposit to the client's credit and settles whole notes, oldest
// first. Every read happens before the first write, as transactions require.
async function applyPayment(
  tx: FirebaseFirestore.Transaction,
  paymentId: string,
  amount: number,
  clientId: string
): Promise<AppliedPayment | null> {
  const clientRef = db.collection('clients').doc(clientId);
  const [client, unpaid] = await Promise.all([
    tx.get(clientRef),
    tx.get(clientRef.collection('tickets').where('paid', '==', false))
  ]);
  if (!client.exists) {
    return null;
  }

  const tickets: UnpaidTicket[] = unpaid.docs
    .map((ticket) => ({id: ticket.id, cost: ticket.get('cost'), generated: Number(ticket.get('generated')) || 0}))
    .filter((ticket) => typeof ticket.cost === 'number' && Number.isFinite(ticket.cost) && ticket.cost >= 0);
  const {paidTickets, credit} = allocate(amount + creditOf(client), tickets);

  const paidDate = Date.now();
  for (const ticket of paidTickets) {
    tx.update(clientRef.collection('tickets').doc(ticket.id), {paid: true, paidDate, paymentId});
  }
  tx.update(clientRef, {credit});

  return {
    clientId,
    appliedTickets: paidTickets.map((ticket) => ({ticketId: ticket.id, cost: ticket.cost})),
    creditAfter: credit
  };
}

// Reopening or deleting a note a deposit paid gives that money back to the
// client as credit, so it is not lost from their balance.
async function undoTicket(ticketRef: FirebaseFirestore.DocumentReference, action: 'restore' | 'delete'): Promise<void> {
  const clientRef = ticketRef.parent.parent as FirebaseFirestore.DocumentReference;

  await db.runTransaction(async (tx) => {
    const ticket = await tx.get(ticketRef);
    if (!ticket.exists) {
      if (action === 'restore') {
        throw new functions.https.HttpsError('not-found', 'La nota no existe.');
      }
      return;
    }

    const cost = ticket.get('cost');
    const refund = ticket.get('paid') === true
      && (typeof ticket.get('paymentId') === 'string' || ticket.get('paidWithCredit') === true)
      && typeof cost === 'number' && Number.isFinite(cost) ? cost : 0;

    if (action === 'delete') {
      tx.delete(ticketRef);
    } else {
      tx.update(ticketRef, {
        paid: false,
        paidDate: FieldValue.delete(),
        paymentId: FieldValue.delete(),
        paidWithCredit: FieldValue.delete()
      });
    }
    if (refund > 0) {
      tx.update(clientRef, {credit: FieldValue.increment(refund)});
    }
  });
}

// Takes `count` consecutive references from the shared counter.
async function reserveReferences(tx: FirebaseFirestore.Transaction, count: number): Promise<string[]> {
  if (count === 0) {
    return [];
  }
  const counter = await tx.get(REFERENCE_COUNTER);
  const first = counter.exists ? counter.get('next') as number : FIRST_REFERENCE_SEQUENCE;
  if (first + count - 1 > LAST_REFERENCE_SEQUENCE) {
    throw new functions.https.HttpsError('resource-exhausted', 'Se agotaron las referencias de pago.');
  }

  tx.set(REFERENCE_COUNTER, {next: first + count});
  return Array.from({length: count}, (_, index) => referenceFromSequence(first + index));
}

function creditOf(client: FirebaseFirestore.DocumentSnapshot): number {
  const credit = client.get('credit');
  return typeof credit === 'number' && Number.isFinite(credit) && credit > 0 ? credit : 0;
}

function requireUnmatched(payment: FirebaseFirestore.DocumentSnapshot): void {
  if (!payment.exists) {
    throw new functions.https.HttpsError('not-found', 'El pago no existe.');
  }
  if (payment.get('status') !== 'unmatched') {
    throw new functions.https.HttpsError('failed-precondition', 'El pago ya fue conciliado.');
  }
}

function requireStatementRows(value: unknown): StatementRow[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STATEMENT_ROWS) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `El estado de cuenta debe tener entre 1 y ${MAX_STATEMENT_ROWS} depósitos.`
    );
  }

  return value.map((row, index) => {
    const candidate = (row ?? {}) as Record<string, unknown>;
    const amount = candidate.amount;
    const description = typeof candidate.description === 'string' ? candidate.description.trim() : '';
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new functions.https.HttpsError('invalid-argument', `El importe del renglón ${index + 1} no es válido.`);
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new functions.https.HttpsError('invalid-argument', `La descripción del renglón ${index + 1} es muy larga.`);
    }
    return {date: requireTicketDate(candidate.date), amount: roundCents(amount), description};
  });
}

function monthName(month: number): string {
  return [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ][month - 1];
}

// Year and zero-based month of an instant, as seen in Mexico City.
function zonedYearMonth(time: number): {year: number; month: number} {
  const zoned = new Date(time - TIME_ZONE_OFFSET_MS);
  return {year: zoned.getUTCFullYear(), month: zoned.getUTCMonth()};
}

// Epoch milliseconds of midnight on the 1st of the month containing `time`,
// in Mexico City.
function monthStart(time: number): number {
  const {year, month} = zonedYearMonth(time);
  return Date.UTC(year, month, 1) + TIME_ZONE_OFFSET_MS;
}

async function stats(): Promise<{debt: number; earns: number}> {
  const [earns, debt] = await Promise.all([
    earnsBetween(monthStart(Date.now()), Infinity),
    currentDebt()
  ]);

  return {debt, earns};
}

async function earnsBetween(start: number, end: number): Promise<number> {
  let query = db.collectionGroup('tickets').where('paid', '==', true).where('paidDate', '>=', start);
  if (Number.isFinite(end)) {
    query = query.where('paidDate', '<', end);
  }
  return sumCost(query);
}

async function currentDebt(): Promise<number> {
  return sumCost(db.collectionGroup('tickets').where('paid', '==', false));
}

// Summed server side: billed as one read per 1000 notes instead of one per note.
// Non-numeric costs are ignored, as before.
async function sumCost(query: FirebaseFirestore.Query): Promise<number> {
  const snapshot = await query.aggregate({total: AggregateField.sum('cost')}).get();
  return snapshot.data().total ?? 0;
}
