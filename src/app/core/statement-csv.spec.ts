import { guessHeaderRow, parseAmount, parseCsv, parseDate, readDeposits } from './statement-csv';

describe('statement-csv', () => {
  const statement = '﻿Estado de cuenta\r\n'
    + 'Fecha;Concepto;Referencia;Cargo;Abono\r\n'
    + '09/10/2026;"SPEI RECIBIDO; BANORTE";1000009;;"$1,250.00"\r\n'
    + '10/OCT/2026;COMISION;;15.00;\r\n'
    + '31/02/2026;X;;;100\r\n';

  it('reads deposits below the header and skips charges and bad dates', () => {
    const rows = parseCsv(statement);
    const headerRow = guessHeaderRow(rows);
    expect(headerRow).toBe(1);

    const { deposits, skipped } = readDeposits(rows, headerRow, { date: 0, amount: 4, description: [1, 2] });
    expect(skipped).toBe(2);
    expect(deposits.length).toBe(1);
    expect(deposits[0].amount).toBe(1250);
    expect(deposits[0].description).toBe('SPEI RECIBIDO; BANORTE 1000009');
    expect(new Date(deposits[0].date).getDate()).toBe(9);
  });

  it('reads the amount formats banks use', () => {
    expect(parseAmount('$1,250.00')).toBe(1250);
    expect(parseAmount('1.250,50')).toBe(1250.5);
    expect(parseAmount('1,250')).toBe(1250);
    expect(parseAmount('-300.00')).toBe(-300);
    expect(parseAmount('')).toBeNull();
  });

  it('reads dates day first', () => {
    expect(new Date(parseDate('2026-10-09')).getDate()).toBe(9);
    expect(new Date(parseDate('09-sept-26')).getMonth()).toBe(8);
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('Saldo')).toBeNull();
  });
});
