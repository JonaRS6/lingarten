import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ClientdataService } from '../../services/clientdata.service';
import { ClienteModel, ClienteTable } from '../../models/cliente.model';
import { TicketPrintMode } from '../ticket-print/ticket-print-dialog.component';
import { TicketPrintService } from '../../services/ticket-print.service';
import { TicketPrintFlowService } from '../../services/ticket-print-flow.service';
import { FormControl } from '@angular/forms';
import {merge, Observable, of as observableOf} from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
// Material Table
import {MatPaginator} from '@angular/material/paginator';
import {MatTableDataSource} from '@angular/material/table';
import { startWith } from 'rxjs/operators';


@Component({
  selector: 'app-clienttable',
  templateUrl: './clienttable.component.html',
  styleUrls: ['./clienttable.component.css']
})
export class ClienttableComponent implements OnInit, OnDestroy {
  
  clientTable: ClienteTable[] = [];


  // variable para controlar la cantidad de clientes en la tabla
  clientCount = 0;

  loading = true;

  constructor( public clienteService: ClientdataService, private chRef: ChangeDetectorRef,
               private printer: TicketPrintService, private printFlow: TicketPrintFlowService ) {
    this.clienteService.clients.subscribe( resp => {
      console.log(resp);
      this.clientTable = resp;
      if (this.clientTable.length !== this.clientCount) {
        this.updateClientsPosition();
        this.clientCount = this.clientTable.length;
      }
      if (this.loading) {
        setTimeout(() => {
          window.scroll(0, clienteService.lastTableScroll);
        }, 0);
      }
      this.loading = false;
    });
  }

  ngOnInit(): void {
  }
  ngOnDestroy(): void {
    this.clienteService.lastTableScroll = window.scrollY;
    console.log(this.clienteService.lastTableScroll);
  }
  updateClientsPosition(): void {
    console.log('Actualizando clientes');
    // tslint:disable-next-line: prefer-for-of
    for (let index = 0; index < this.clientTable.length; index++) {
      this.clientTable[index].client.position = index + 1;
      this.clienteService.updateClientPosition(this.clientTable[index].client);
    }
  }
  drop( event: CdkDragDrop<string[]>): void {
    moveItemInArray(this.clientTable, event.previousIndex, event.currentIndex);
    this.updateClientsPosition();
  }
  getClientsByDay( day: string ): void {
    console.log(day);
    this.clienteService.mostrarCancelados = false;
    this.clienteService.dayOption = day;
  }
  showCanceled(): void {
    this.clienteService.mostrarCancelados = true;
    this.clienteService.dayOption = '7';
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
    this.clienteService.quickPay(client.client.id).then(res => {
      console.log(res);
    }).catch((err) => {
      console.log(err);
    });
  }

}
