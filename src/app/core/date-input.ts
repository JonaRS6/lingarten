// Helpers between <input type="date"> values (YYYY-MM-DD, local time) and the
// epoch milliseconds stored in tickets.

export function toDateInput( value: number | Date ): string {
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Applies the picked calendar day while keeping the time of day of `timeFrom`,
// so notes created on the same day keep their relative order.
export function fromDateInput( value: string, timeFrom: number | Date = new Date() ): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(timeFrom);
  date.setFullYear(year, month - 1, day);
  return date;
}
