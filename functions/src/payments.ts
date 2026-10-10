// Pure helpers for bank payment references and allocation. They hold no
// Firestore access so they can be tested on their own.

// References are 6 sequence digits plus a Luhn check digit. The sequence
// starts at 100000 so no reference begins with zero: some banks drop leading
// zeros from the numeric reference of a transfer.
export const FIRST_REFERENCE_SEQUENCE = 100000;
export const LAST_REFERENCE_SEQUENCE = 999999;

export function luhnCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

export function referenceFromSequence(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < FIRST_REFERENCE_SEQUENCE || sequence > LAST_REFERENCE_SEQUENCE) {
    throw new RangeError(`Secuencia de referencia fuera de rango: ${sequence}`);
  }
  const base = String(sequence);
  return base + luhnCheckDigit(base);
}

export function isValidReference(value: string): boolean {
  return /^[1-9]\d{6}$/.test(value) && luhnCheckDigit(value.slice(0, 6)) === Number(value[6]);
}

// Every well-formed reference written in a bank description. Longer digit
// runs (accounts, CLABEs, tracking keys) are skipped as a whole.
export function referencesIn(description: string): string[] {
  const found = description.match(/(?<!\d)\d{7}(?!\d)/g) ?? [];
  return [...new Set(found.filter(isValidReference))];
}

export interface UnpaidTicket {
  id: string;
  cost: number;
  generated: number;
}

export interface Allocation {
  paidTickets: UnpaidTicket[];
  credit: number;
}

// Pays whole notes, oldest first, while the money lasts. A note that costs
// more than what is left stays unpaid, and later (cheaper) notes are not
// paid ahead of it. Whatever is left becomes credit.
export function allocate(available: number, tickets: UnpaidTicket[]): Allocation {
  const ordered = [...tickets].sort((a, b) => a.generated - b.generated);
  const paidTickets: UnpaidTicket[] = [];
  let left = roundCents(available);

  for (const ticket of ordered) {
    if (ticket.cost > left) {
      break;
    }
    paidTickets.push(ticket);
    left = roundCents(left - ticket.cost);
  }

  return {paidTickets, credit: left};
}

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
