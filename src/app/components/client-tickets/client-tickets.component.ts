import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { ClientdataService } from '../../services/clientdata.service';
import { TicketData, Ticket, StoredTicket } from '../../models/ticket-data.model';
import { ClienteModel } from '../../models/cliente.model';
import { TicketPrintFlowService } from '../../services/ticket-print-flow.service';
import { fromDateInput, toDateInput } from '../../core/date-input';

import Swal from 'sweetalert2';

import {MatDialog} from '@angular/material/dialog';
import { TicketFormComponent } from './ticket-form.component';

@Component({
  selector: 'app-client-tickets',
  templateUrl: './client-tickets.component.html',
  styleUrls: ['./client-tickets.component.css']
})
export class ClientTicketsComponent implements OnDestroy {
tickets = [];
clientId: string;
client: ClienteModel;
private destroy$ = new Subject<void>();
  constructor( private service: ClientdataService, private router: ActivatedRoute, public dialog: MatDialog,
               private printFlow: TicketPrintFlowService ) {
    this.clientId = this.router.snapshot.paramMap.get('id');
    if ( this.clientId !== 'nuevo' ) {
      this.service.getClient( this.clientId ).pipe(takeUntil(this.destroy$)).subscribe(client => {
        this.client = { ...client, id: this.clientId };
      });
      this.service.getClientTickets( this.clientId ).pipe(takeUntil(this.destroy$)).subscribe(data => {
        this.tickets = data;
      });
    }
   }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  createTicket(): void {
    const dialogRef = this.dialog.open(TicketFormComponent, {
      width: '250px',
      data: {import: null, concepto: '', fecha: toDateInput(new Date())}
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const ticket: Ticket = {
          paid: false,
          type: result.concepto,
          cost: result.import,
          generated: result.fecha ? fromDateInput(result.fecha).getTime() : 0
        };
        const ticketData = new TicketData();
        ticketData.clientId = this.clientId;
        ticketData.ticket = ticket;
        this.service.createTicket( ticketData )
          .subscribe(
            () => this.successUpdate(),
            error => {
              console.error('No se pudo crear la nota.', error);
              this.errorUpdate();
            }
          );
      }
    });
  }

  async updateTicket( ticket: StoredTicket, action: 'pay' | 'restore' | 'delete' ): Promise<void> {
    const needsConfirmation = action === 'restore' || action === 'delete';
    if (needsConfirmation) {
      const result = await this.confirmAlert(action === 'restore' ? 'modificar' : 'eliminar');
      if (!result.isConfirmed) {
        return;
      }
    }
    ticket.isPayLoading = true;
    try {
      await this.service.updateTicket(this.clientId, ticket.id, action);
      if (needsConfirmation) {
        Swal.fire('Hecho!', '', 'success');
      }
    } catch (error) {
      console.error('No se pudo actualizar la nota.', error);
      Swal.fire({ title: 'Error', text: 'No se pudo actualizar la nota', icon: 'error' });
    } finally {
      ticket.isPayLoading = false;
    }
  }

  printTicket( ticket: StoredTicket ): void {
    this.printFlow.open(this.client, 'single', ticket);
  }

  editDate( ticket: StoredTicket ): void {
    this.printFlow.editDate(this.clientId, ticket);
  }

  confirmAlert( accion: string): Promise<any> {
    return Swal.fire({
      title: '¿Estás seguro?',
      text: `Esta acción no se puede revertir`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: `Sí, ${accion} nota`,
      cancelButtonText: 'Cancelar'
    });
  }
  successUpdate(): void {
    Swal.fire({
      title: `Nota creada`,
      text: `Se registró correctamente`,
      icon: 'success'
    });
  }
  errorUpdate(): void {
    Swal.fire({
      title: 'Error',
      text: 'No se pudo registrar la nota',
      icon: 'error'
    });
  }
  loadingAlert(): void {
    Swal.fire({
      title: 'Espere',
      text: 'Guardando información',
      icon: 'info',
      allowOutsideClick: true
    });
    Swal.showLoading();
  }

}
