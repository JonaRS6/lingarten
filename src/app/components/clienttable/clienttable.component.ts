import { Component, OnDestroy } from '@angular/core';
import { ClientdataService } from '../../services/clientdata.service';
import { ClienteModel, ClienteTable } from '../../models/cliente.model';
import { TicketPrintMode } from '../ticket-print/ticket-print-dialog.component';
import { TicketPrintService } from '../../services/ticket-print.service';
import { TicketPrintFlowService } from '../../services/ticket-print-flow.service';
import { Subject } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-clienttable',
  templateUrl: './clienttable.component.html',
  styleUrls: ['./clienttable.component.css']
})
export class ClienttableComponent implements OnDestroy {

  clientTable: ClienteTable[] = [];
  // Rows shown for the current day, canceled and search filters.
  visibleClients: ClienteTable[] = [];

  loading = true;
  private destroy$ = new Subject<void>();

  constructor( public clienteService: ClientdataService,
               private printer: TicketPrintService, private printFlow: TicketPrintFlowService ) {
    this.clienteService.clients.pipe(takeUntil(this.destroy$)).subscribe( resp => {
      this.clientTable = resp;
      this.filterClients();
      if (this.loading) {
        setTimeout(() => {
          window.scroll(0, clienteService.lastTableScroll);
        }, 0);
      }
      this.loading = false;
    });
    this.clienteService.searchString.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterClients());
  }

  ngOnDestroy(): void {
    this.clienteService.lastTableScroll = window.scrollY;
    this.destroy$.next();
    this.destroy$.complete();
  }

  filterClients(): void {
    const search = (this.clienteService.searchString.value || '').toLowerCase();
    const day = this.clienteService.dayOption;
    const canceled = this.clienteService.mostrarCancelados;
    this.visibleClients = this.clientTable.filter(({ client }) =>
      (canceled ? client.active === false : client.active === true && (day === '7' || client.service.day === day))
      && client.name.concat(client.lastname).toLowerCase().includes(search)
    );
  }

  trackByClient( index: number, row: ClienteTable ): string {
    return row.client.id;
  }

  // Reorders the visible rows, then puts them back into the slots they held in
  // the full list so hidden clients keep their place.
  drop( event: CdkDragDrop<ClienteTable[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const slots = this.visibleClients.map(row => this.clientTable.indexOf(row));
    moveItemInArray(this.visibleClients, event.previousIndex, event.currentIndex);
    const reordered = [...this.clientTable];
    slots.forEach((slot, index) => reordered[slot] = this.visibleClients[index]);
    this.clientTable = reordered;
    this.clienteService.updateClientPositions(reordered.map(row => row.client)).catch(error => {
      console.error('No se pudo guardar el orden.', error);
      Swal.fire({ title: 'Error', text: 'No se pudo guardar el orden de los clientes', icon: 'error' });
    });
  }
  getClientsByDay( day: string ): void {
    this.clienteService.mostrarCancelados = false;
    this.clienteService.dayOption = day;
    this.filterClients();
  }
  showCanceled(): void {
    this.clienteService.mostrarCancelados = true;
    this.clienteService.dayOption = '7';
    this.filterClients();
  }
  printTickets(): void {
    let clientes;
    if (this.clienteService.dayOption === '1' || this.clienteService.dayOption === '2' || this.clienteService.dayOption === '3' ||
        this.clienteService.dayOption === '4' || this.clienteService.dayOption === '5' || this.clienteService.dayOption === '6') {
        clientes = this.clientTable.filter(item => item.client.service.day === this.clienteService.dayOption);
    } else {
      clientes = this.clientTable;
    }
    clientes = clientes.filter(item => item.client.active === true);
    clientes = clientes.filter(item => item.client.printq === true);
    clientes = clientes.reverse();
    this.printer.printAll(
      clientes.map(item => ({ client: item.client, note: this.printer.serviceNote(item.client) })),
      `${this.clienteService.dayOption}${new Date().getDate()}`
    );
  }
  printTicket( client: ClienteModel, mode: TicketPrintMode ): void {
    this.printFlow.open(client, mode);
  }
  quickPay(client: ClienteTable): void {
    client.isPayLoading = true;
    this.clienteService.quickPay(client.client.id).catch((error) => {
      console.error('No se pudo registrar el pago.', error);
      Swal.fire({ title: 'Error', text: 'No se pudo registrar el pago', icon: 'error' });
    }).finally(() => {
      client.isPayLoading = false;
    });
  }

}
