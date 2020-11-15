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
}