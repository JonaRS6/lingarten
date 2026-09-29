import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import {
  TicketPrintDialogComponent,
  TicketPrintDialogData,
  TicketPrintDialogResult,
  TicketPrintMode
} from '../components/ticket-print/ticket-print-dialog.component';
import { fromDateInput, toDateInput } from '../core/date-input';
import { ClienteModel } from '../models/cliente.model';
import { isSpecialTicket, StoredTicket, TicketData } from '../models/ticket-data.model';
import { ClientdataService } from './clientdata.service';
import { TicketPrintService } from './ticket-print.service';

@Injectable({
  providedIn: 'root'
})
export class TicketPrintFlowService {

  constructor(
    private dialog: MatDialog,
    private clients: ClientdataService,
    private printer: TicketPrintService
  ) {}

  open( client: ClienteModel, mode: TicketPrintMode, ticket?: StoredTicket ): void {
    const data: TicketPrintDialogData = { client, mode, ticket };
    if (mode === 'current') {
      data.serviceDate = this.printer.serviceNote(client).date;
    }
    this.dialog.open<TicketPrintDialogComponent, TicketPrintDialogData, TicketPrintDialogResult>(
      TicketPrintDialogComponent, { width: '420px', data }
    ).afterClosed().subscribe(result => {
      if (result) {
        this.handle(client, mode, result);
      }
    });
  }

  // Corrects the stored date of a note (note cards' calendar button).
  async editDate( clientId: string, ticket: StoredTicket ): Promise<void> {
    const { value } = await Swal.fire({
      title: 'Cambiar fecha de la nota',
      html: `<input type="date" id="ticket-date" class="swal2-input" value="${toDateInput(ticket.data.generated)}">`,
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => (document.getElementById('ticket-date') as HTMLInputElement).value
        || Swal.showValidationMessage('Elige una fecha')
    });
    if (value) {
      await this.saveDate(clientId, ticket, fromDateInput(value, ticket.data.generated));
    }
  }

  private async handle( client: ClienteModel, mode: TicketPrintMode, result: TicketPrintDialogResult ): Promise<void> {
    if (mode === 'current') {
      const note = this.printer.serviceNote(client);
      this.printer.print(client, { ...note, date: fromDateInput(result.printDate, note.date) });
    } else if (result.newTicket) {
      await this.createAndPrint(client, result.newTicket, result.printDate);
    } else if (result.ticket) {
      await this.printStored(client, result.ticket, result.printDate);
    }
  }

  private async createAndPrint( client: ClienteModel, newTicket: { type: string; cost: number }, dateInput: string ): Promise<void> {
    const date = fromDateInput(dateInput);
    const confirmation = await Swal.fire({
      title: '¿Crear e imprimir la nota?',
      html: `Se registrará una nota pendiente de <b>$${newTicket.cost}.00</b> para
        ${this.escape(client.name)} ${this.escape(client.lastname)}:<br><i>${this.escape(newTicket.type)}</i>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: 'Sí, crear e imprimir',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed) {
      return;
    }

    const ticketData = new TicketData();
    ticketData.clientId = client.id;
    ticketData.ticket = { ...newTicket, paid: false, generated: date.getTime() };
    try {
      await this.clients.createTicket(ticketData).toPromise();
    } catch (error) {
      console.error('No se pudo crear la nota.', error);
      Swal.fire({ title: 'Error', text: 'No se pudo registrar la nota', icon: 'error' });
      return;
    }
    this.printer.print(client, { date, cost: newTicket.cost, concept: newTicket.type });
  }

  private async printStored( client: ClienteModel, ticket: StoredTicket, dateInput: string ): Promise<void> {
    const date = fromDateInput(dateInput, ticket.data.generated);
    // Print first: the popup must open while the click still counts as a user
    // gesture, before any awaited confirmation.
    this.printer.print(client, {
      date,
      cost: ticket.data.cost,
      concept: isSpecialTicket(ticket.data) ? ticket.data.type : undefined
    });

    if (dateInput === toDateInput(ticket.data.generated)) {
      return;
    }
    const confirmation = await Swal.fire({
      title: '¿Guardar también la fecha en la nota?',
      text: 'La nota quedará registrada con la fecha que imprimiste.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'No, solo imprimir'
    });
    if (confirmation.isConfirmed) {
      await this.saveDate(client.id, ticket, date);
    }
  }

  private async saveDate( clientId: string, ticket: StoredTicket, date: Date ): Promise<void> {
    try {
      await this.clients.setTicketDate(clientId, ticket.id, date.getTime());
    } catch (error) {
      console.error('No se pudo cambiar la fecha de la nota.', error);
      Swal.fire({ title: 'Error', text: 'No se pudo cambiar la fecha de la nota', icon: 'error' });
    }
  }

  private escape( text: string ): string {
    const element = document.createElement('span');
    element.textContent = text;
    return element.innerHTML;
  }
}
