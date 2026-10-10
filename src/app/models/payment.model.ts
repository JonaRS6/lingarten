// A bank deposit, as stored by the payment functions.
export interface Payment {
  id: string;
  source: 'csv';
  amount: number;
  receivedAt: number;
  description: string;
  references: string[];
  status: 'applied' | 'unmatched' | 'ignored';
  clientId?: string;
  appliedTickets?: { ticketId: string; cost: number }[];
  creditAfter?: number;
  importedAt: number;
}
