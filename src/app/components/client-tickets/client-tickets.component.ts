import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClientdataService } from '../../services/clientdata.service';
import { TicketData, Ticket } from '../../models/ticket-data.model';

import Swal from 'sweetalert2';

import {MatDialog} from '@angular/material/dialog';
import { TicketFormComponent } from './ticket-form.component';

@Component({
  selector: 'app-client-tickets',
  templateUrl: './client-tickets.component.html',
  styleUrls: ['./client-tickets.component.css']
})
export class ClientTicketsComponent implements OnInit {
tickets = [];
clientId: string;
  constructor( private service: ClientdataService, private router: ActivatedRoute, public dialog: MatDialog ) {
    this.clientId = this.router.snapshot.paramMap.get('id');
    if ( this.clientId !== 'nuevo' ) {
      this.service.getClientTickets( this.clientId ).subscribe(data => {
        this.tickets = data;
        console.log({tickets: this.tickets});
        /* this.tickets.forEach(ticket => {
          const date = new Date(ticket.data.generated);
          ticket.data.generated = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        }); */
      });
    }
   }

  ngOnInit(): void {
    this.tickets.forEach(ticket => {
      ticket.data.generated = new Date(ticket.data.generated).toTimeString();
    });
  }

  createTicket(): void {
    const dialogRef = this.dialog.open(TicketFormComponent, {
      width: '250px',
      data: {import: null, concepto: ''}
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const ticket: Ticket = {
          paid: false,
          type: result.concepto,
          cost: result.import,
          generated: 0
        };
        const ticketData = new TicketData();
        ticketData.clientId = this.clientId;
        ticketData.ticket = ticket;
        this.service.createTicket( ticketData )
          .subscribe(resultado => {
            if (resultado) {
              this.successUpdate();
            } else {
              this.errorUpdate();
            }
          });
      } else {
        this.errorUpdate();
      }
      console.log('The dialog was closed');
      console.log('result = ', result);
    });
  }

  updateTicket( ticket: any, action ): void {
    if (action === 'restore' || action === 'delete') {
      let accion = '';
      if (action === 'restore') {
        accion = 'modificar';
      } else {
        accion = 'eliminar';
      }
      this.confirmAlert(accion).then((result) => {
        if (result.isConfirmed) {
          ticket.isPayLoading = true;
          this.service.updateTicket(this.clientId, ticket.id, action).then(data => {
            console.log(data);
          });
          Swal.fire(
            'Hecho!',
            'success'
          );
        } else {
          return;
        }
      });
    } else {
      ticket.isPayLoading = true;
      this.service.updateTicket(this.clientId, ticket.id, action).then(data => {
        console.log(data);
      });
    }
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
