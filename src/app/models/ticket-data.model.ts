export class TicketData {
    id: string;
    ticket: Ticket;
    clientId: string;
    constructor() {}
}
export interface Ticket {
    paid: boolean;
    generated: number;
    type: string;
    cost: number;
    paidDate?: number;
    origin?: 'manual' | 'system';
}
// Shape returned by ClientdataService.getClientTickets.
export interface StoredTicket {
    id: string;
    data: Ticket;
    isPayLoading?: boolean;
}

// Notes created before `origin` existed are classified by their concept.
const SYSTEM_TICKET_TYPES = [
    'Servicio de recolección semanal',
    'Primer nota de cobro por el servicio de recolección semanal'
];

export function isSpecialTicket(ticket: Ticket): boolean {
    if (ticket.origin) {
        return ticket.origin === 'manual';
    }
    return !SYSTEM_TICKET_TYPES.includes(ticket.type);
}
