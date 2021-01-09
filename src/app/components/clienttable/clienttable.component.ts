import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ClientdataService } from '../../services/clientdata.service';
import { ClienteModel, ClienteTable } from '../../models/cliente.model';
import { jsPDF } from 'jspdf';
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

  constructor( public clienteService: ClientdataService, private chRef: ChangeDetectorRef ) {
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
    const doc = new jsPDF('p', 'mm', 'a6');
    doc.setFontSize(10);
    let i = 1;
    doc.setProperties({
      title: `${this.clienteService.dayOption}${new Date().getDate()}`
    });
    for (const client of clientes) {
      this.docGen(doc, client.client).addPage();
      i++;
    }
    doc.deletePage(i);
    doc.output('pdfobjectnewwindow');
  }
  printTicket( client: ClienteModel ): void {
    const printDate = this.getPrintDate( client );
    const doc = new jsPDF('p', 'mm', 'a6');
    doc.setFontSize(10);
    doc.setProperties({
      title: `${client.name}${client.lastname}${printDate.getDate()}/${printDate.getMonth() + 1}/${printDate.getFullYear()}`
    });
    this.docGen(doc, client).output('pdfobjectnewwindow');
  }
  docGen(doc: jsPDF, client: ClienteModel): jsPDF {
    // Fecha
    const fecha = this.getPrintDate(client).toLocaleDateString('es-ES', {year: 'numeric', month: 'long', day: 'numeric'});
    doc.text(fecha, 50, 50);
    doc.autoPrint({variant: 'javascript'});
    // Nombre
    doc.text(`${client.name} ${client.lastname}`, 26, 57);
    // Direccion
    doc.text(`${client.address.street} #${client.address.no}, ${client.address.colony}`, 28, 64);
    // Concepto
    doc.text(`${client.service.cost}.00`, 84, 80);
    // Total
    doc.text(`${client.service.cost}.00`, 84, 127);
    return doc;
  }
  quickPay(client: ClienteTable): void {
    client.isPayLoading = true;
    this.clienteService.quickPay(client.client.id).then(res => {
      console.log(res);
    }).catch((err) => {
      console.log(err);
    });
  }
  getPrintDay( d: number, m: number, y: number ): Date {
    let printDate: Date;
    let curDay = 0;
    let i = 1;
    while ( curDay < 1 && i < 8) {
      printDate = new Date( y, m, i++ );
      if (printDate.getDay() === d ) {
        curDay++;
      }
    }
    console.log(printDate);
    return printDate;
  }
  getPrintDate(client: ClienteModel ): Date {
    let printWeekDay = 0;
    let printMonth;
    let printYear;
    switch (client.service.day) {
      case '1':
        printWeekDay = 1;
        break;
      case '2':
        printWeekDay = 2;
        break;
      case '3':
        printWeekDay = 3;
        break;
      case '4':
        printWeekDay = 4;
        break;
      case '5':
        printWeekDay = 5;
        break;
      case '6':
        printWeekDay = 6;
        break;
      default:
        break;
    }
    const currentDay = new Date().getDate();
    if ( currentDay >= 15 ) {
      printMonth = new Date().getMonth() + 1;
      if (printMonth > 11) {
        printMonth = 0;
        printYear = new Date().getFullYear() + 1;
      } else {
        printYear = new Date().getFullYear();
      }

    } else {
      printMonth = new Date().getMonth();
      printYear = new Date().getFullYear();
    }
    console.log( printYear, printMonth, 1);
    return this.getPrintDay( printWeekDay, printMonth, printYear );
  }

}
