import {initializeApp} from 'firebase-admin/app';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';

initializeApp();

const db = getFirestore();
const ADMIN_EMAILS = new Set([
  'jersneme6@gmail.com',
  'lingartendmor@gmail.com'
]);
const MAX_TICKET_TYPE_LENGTH = 256;
const FIRESTORE_BATCH_LIMIT = 500;

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
  const batch = db.batch();

  batch.create(clientRef, {
    ...client,
    registerDate: FieldValue.serverTimestamp()
  });
  batch.create(ticketRef, {
    ...ticket,
    generated: Date.now(),
    paid: false,
    origin: 'system'
  });
  await batch.commit();

  return {clientId: clientRef.id, ticketId: ticketRef.id};
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

  if (action === 'delete') {
    await ticketRef.delete();
  } else if (action === 'pay') {
    await ticketRef.update({paid: true, paidDate: Date.now()});
  } else {
    await ticketRef.update({paid: false, paidDate: FieldValue.delete()});
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

  if (!(await ticketRef.get()).exists) {
    throw new functions.https.HttpsError('not-found', 'La nota no existe.');
  }

  await ticketRef.update({generated});
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
  .onWrite(async (_change, context) => {
    const clientRef = db.collection('clients').doc(context.params.clientId);
    const unpaidTickets = await clientRef.collection('tickets').where('paid', '==', false).get();
    const status = unpaidTickets.empty ? 'pagado' : unpaidTickets.size > 1 ? 'atrasado' : 'pendiente';

    await clientRef.update({status});
    functions.logger.info('Estado de cliente actualizado.', {
      clientId: context.params.clientId,
      status
    });
  });

export const createTickets = functions.pubsub.schedule('0 0 1 * *').onRun(async () => {
  const month = new Date().getMonth() + 1;
  const serviceTypes = ['mensual', month % 2 === 1 ? 'inpar' : 'par', monthName(month)];
  const results = await Promise.all(serviceTypes.map(createTicketsForServiceType));
  const created = results.reduce((sum, current) => sum + current, 0);

  functions.logger.info('Notas programadas creadas.', {created, serviceTypes});
  return {created};
});

export const gennMonthRecord = functions.pubsub.schedule('50 23 30 * *').onRun(async () => {
  const currentDate = new Date();
  const {earns, debt} = await stats();

  await db.collection('records').add({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
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

  for (let start = 0; start < eligibleClients.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const client of eligibleClients.slice(start, start + FIRESTORE_BATCH_LIMIT)) {
      batch.create(client.ref.collection('tickets').doc(), {
        cost: client.get('service.cost'),
        generated: Date.now(),
        paid: false,
        type: 'Servicio de recolección semanal',
        origin: 'system'
      });
    }
    await batch.commit();
  }

  return eligibleClients.length;
}

function monthName(month: number): string {
  return [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ][month - 1];
}

async function stats(): Promise<{debt: number; earns: number}> {
  const currentDate = new Date();
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth()).getTime();
  const [paidTickets, debtTickets] = await Promise.all([
    db.collectionGroup('tickets').where('paid', '==', true).where('paidDate', '>=', monthStart).get(),
    db.collectionGroup('tickets').where('paid', '==', false).get()
  ]);

  const earns = paidTickets.docs.reduce((sum, ticket) => sum + numericCost(ticket.get('cost')), 0);
  const debt = debtTickets.docs.reduce((sum, ticket) => sum + numericCost(ticket.get('cost')), 0);

  return {debt, earns};
}

function numericCost(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
