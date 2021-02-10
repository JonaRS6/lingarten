import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountingModel } from '../models/accounting.model'

@Injectable({
  providedIn: 'root'
})
export class AccountingService {

  entradas: Observable<AccountingModel[]>;
  salidas: Observable<AccountingModel[]>;

  constructor(private firestore: AngularFirestore) { 
    this.obtenerEntradas();
    this.obtenerSalidas();
  }

  guardarEntrada( data:any ): void {
    this.firestore.collection('accounting').doc('incomes').collection('incomes').add(data).then()
  }
  guardarSalida( data:any ): void {
    this.firestore.collection('accounting').doc('outgoings').collection('outgoings').add(data).then()
  }

  obtenerEntradas(): void {
    this.entradas = this.firestore.collection('accounting').doc('incomes').collection('incomes', ref => ref.orderBy('fecha')).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as AccountingModel;
        const id = a.payload.doc.id;
        return { id: id, ...data};
      }))
    );
  }
  obtenerSalidas(): void {
    this.salidas = this.firestore.collection('accounting').doc('outgoings').collection('outgoings', ref => ref.orderBy('fecha')).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as AccountingModel;
        const id = a.payload.doc.id;
        return { id: id, ...data};
      }))
    );
  }

  borrarEntrada( id: string): void {
    this.firestore.collection('accounting').doc('incomes').collection('incomes').doc(id).delete().then();
  }
  borrarSalida( id: string): void {
    this.firestore.collection('accounting').doc('outgoings').collection('outgoings').doc(id).delete().then();
  }
}
