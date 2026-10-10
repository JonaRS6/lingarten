// Reads the CSV statement a bank exports. Every bank lays it out differently,
// so the administrator picks which columns hold the date, the deposit and the
// description; these helpers turn the picked cells into deposits.

export interface StatementColumns {
  date: number;
  amount: number;
  // Concatenated: some banks split the concept and the reference.
  description: number[];
}

export interface StatementDeposit {
  date: number;
  amount: number;
  description: string;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Splits CSV text into rows of cells. Handles quoted cells, doubled quotes and
// the separators banks use (comma, semicolon or tab, whichever is most common
// in the first lines).
export function parseCsv( text: string ): string[][] {
  const content = text.replace(/^﻿/, '');
  const sample = content.split(/\r?\n/, 10).join('\n');
  const separator = [',', ';', '\t']
    .map(candidate => ({ candidate, count: sample.split(candidate).length }))
    .sort((a, b) => b.count - a.count)[0].candidate;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') {
        i++;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter(cells => cells.some(value => value.length > 0));
}

// The header is taken to be the first row as wide as the widest one: banks
// often put the account name and period above it.
export function guessHeaderRow( rows: string[][] ): number {
  const width = Math.max(0, ...rows.map(cells => cells.length));
  return Math.max(0, rows.findIndex(cells => cells.length === width));
}

// "$1,250.00", "1250", "1.250,50" or "-300.00". Returns null for empty or
// unreadable cells.
export function parseAmount( value: string ): number | null {
  let text = (value || '').replace(/[$\s]/g, '').replace(/MXN/i, '');
  if (text.length === 0) {
    return null;
  }
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot && /,\d{1,2}$/.test(text)) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

// "09/10/2026", "09-10-26", "2026-10-09" or "09/OCT/2026", read day first as
// Mexican banks write them. Returns local noon, so no time zone moves the day.
export function parseDate( value: string ): number | null {
  const text = (value || '').trim().toLowerCase();
  let year: number;
  let month: number;
  let day: number;

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = text.match(/^(\d{1,2})[-/. ]([a-z]{3}|\d{1,2})[a-z]*[-/. ](\d{2,4})/);
    if (!match) {
      return null;
    }
    day = Number(match[1]);
    month = /\d/.test(match[2]) ? Number(match[2]) : MONTHS.indexOf(match[2]) + 1;
    year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  }

  const date = new Date(year, month - 1, day, 12);
  if (month < 1 || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

// Deposits below the header. Charges (empty or negative amounts) and rows
// without a readable date are left out and counted as skipped.
export function readDeposits( rows: string[][], headerRow: number, columns: StatementColumns ):
  { deposits: StatementDeposit[]; skipped: number } {
  const deposits: StatementDeposit[] = [];
  let skipped = 0;

  for (const cells of rows.slice(headerRow + 1)) {
    const amount = parseAmount(cells[columns.amount]);
    const date = parseDate(cells[columns.date]);
    if (amount === null || amount <= 0 || date === null) {
      skipped++;
      continue;
    }
    const description = columns.description
      .map(index => cells[index] || '')
      .filter(part => part.length > 0)
      .join(' ');
    deposits.push({ date, amount, description });
  }

  return { deposits, skipped };
}
