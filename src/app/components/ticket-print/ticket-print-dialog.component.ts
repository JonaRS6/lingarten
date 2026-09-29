import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { toDateInput } from '../../core/date-input';
import { ClienteModel } from '../../models/cliente.model';
import { isSpecialTicket, StoredTicket } from '../../models/ticket-data.model';
import { ClientdataService } from '../../services/clientdata.service';

// current: upcoming service note. previous: any stored note.
// special: a manual note, or a new one. single: one given note (note cards).
export type TicketPrintMode = 'current' | 'previous' | 'special' | 'single';

export interface TicketPrintDialogData {
  client: ClienteModel;
  mode: TicketPrintMode;
  ticket?: StoredTicket;
  serviceDate?: Date;
}

export interface TicketPrintDialogResult {
  printDate: string;
  ticket?: StoredTicket;
  newTicket?: { type: string; cost: number };
}

const NEW_TICKET = 'new';

@Component({
  selector: 'app-ticket-print-dialog',
  templateUrl: './ticket-print-dialog.component.html'
})
export class TicketPrintDialogComponent implements OnInit {
  readonly newTicket = NEW_TICKET;
  readonly titles: Record<TicketPrintMode, string> = {
    current: 'Nota del servicio actual',
    previous: 'Imprimir nota anterior',
    special: 'Imprimir nota especial',
    single: 'Imprimir nota'
  };

  tickets: StoredTicket[] = [];
  loading = false;
  selected: StoredTicket | typeof NEW_TICKET | null = null;
  printDate = '';
  concept = '';
  cost: number = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: TicketPrintDialogData,
    private dialogRef: MatDialogRef<TicketPrintDialogComponent, TicketPrintDialogResult>,
    private service: ClientdataService
  ) {}

  ngOnInit(): void {
    if (this.data.mode === 'current') {
      this.printDate = toDateInput(this.data.serviceDate);
    } else if (this.data.mode === 'single') {
      this.select(this.data.ticket);
    } else {
      this.loading = true;
      this.service.getClientTickets(this.data.client.id).pipe(take(1)).subscribe((tickets: StoredTicket[]) => {
        this.tickets = this.data.mode === 'special'
          ? tickets.filter(ticket => isSpecialTicket(ticket.data))
          : tickets;
        this.loading = false;
        if (this.tickets.length > 0) {
          this.select(this.tickets[0]);
        } else if (this.data.mode === 'special') {
          this.select(NEW_TICKET);
        }
      });
    }
  }

  select( option: StoredTicket | typeof NEW_TICKET ): void {
    this.selected = option;
    this.printDate = toDateInput(option === NEW_TICKET ? new Date() : option.data.generated);
  }

  get isNew(): boolean {
    return this.selected === NEW_TICKET;
  }

  get canPrint(): boolean {
    if (!this.printDate) {
      return false;
    }
    if (this.data.mode === 'current') {
      return true;
    }
    if (this.isNew) {
      return this.concept.trim().length > 0 && this.cost !== null && this.cost >= 0;
    }
    return this.selected !== null;
  }

  confirm(): void {
    const result: TicketPrintDialogResult = this.isNew
      ? { printDate: this.printDate, newTicket: { type: this.concept.trim(), cost: Number(this.cost) } }
      : { printDate: this.printDate, ticket: this.selected as StoredTicket || undefined };
    this.dialogRef.close(result);
  }
}
