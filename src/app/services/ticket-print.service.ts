import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { ClienteModel } from '../models/cliente.model';

// What goes on the pre-printed A6 form. `concept` is only printed for special
// notes; service notes rely on the concept already printed on the form.
export interface PrintableNote {
  date: Date;
  cost: number;
  concept?: string;
}

export interface PrintJob {
  client: ClienteModel;
  note: PrintableNote;
}

const CONCEPT_X = 12;
const CONCEPT_MAX_WIDTH = 68;

@Injectable({
  providedIn: 'root'
})
export class TicketPrintService {

  // Note for the client's upcoming service day (the table's default print).
  serviceNote( client: ClienteModel ): PrintableNote {
    return { date: this.getPrintDate(client), cost: client.service.cost };
  }

  print( client: ClienteModel, note: PrintableNote ): void {
    const date = note.date;
    this.printAll(
      [{ client, note }],
      `${client.name}${client.lastname}${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
    );
  }

  printAll( jobs: PrintJob[], title: string ): void {
    if (jobs.length === 0) {
      return;
    }
    const doc = new jsPDF('p', 'mm', 'a6');
    doc.setFontSize(10);
    doc.setProperties({ title });
    jobs.forEach((job, index) => {
      if (index > 0) {
        doc.addPage();
      }
      this.render(doc, job);
    });
    doc.autoPrint({variant: 'javascript'});
    doc.output('pdfobjectnewwindow');
  }

  private render( doc: jsPDF, { client, note }: PrintJob ): void {
    // Fecha
    doc.text(note.date.toLocaleDateString('es-ES', {year: 'numeric', month: 'long', day: 'numeric'}), 50, 50);
    // Nombre
    doc.text(`${client.name} ${client.lastname}`, 26, 57);
    // Direccion
    doc.text(`${client.address.street} #${client.address.no}, ${client.address.colony}`, 28, 64);
    // Concepto
    if (note.concept) {
      doc.text(doc.splitTextToSize(note.concept, CONCEPT_MAX_WIDTH), CONCEPT_X, 80);
    }
    doc.text(`${note.cost}.00`, 84, 80);
    // Total
    doc.text(`${note.cost}.00`, 84, 127);
  }

  private getPrintDay( d: number, m: number, y: number ): Date {
    let printDate: Date;
    let curDay = 0;
    let i = 1;
    while ( curDay < 1 && i < 8) {
      printDate = new Date( y, m, i++ );
      if (printDate.getDay() === d ) {
        curDay++;
      }
    }
    return printDate;
  }

  // First service weekday of this month, or of next month from the 15th on.
  private getPrintDate( client: ClienteModel ): Date {
    const printWeekDay = ['1', '2', '3', '4', '5', '6'].includes(client.service.day) ? Number(client.service.day) : 0;
    const today = new Date();
    let printMonth = today.getMonth();
    let printYear = today.getFullYear();
    if (today.getDate() >= 15) {
      printMonth++;
      if (printMonth > 11) {
        printMonth = 0;
        printYear++;
      }
    }
    return this.getPrintDay( printWeekDay, printMonth, printYear );
  }
}
