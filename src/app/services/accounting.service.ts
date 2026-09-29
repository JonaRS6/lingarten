import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountingModel } from '../models/accounting.model'

@Injectable({
  providedIn: 'root'
})
export class AccountingService {

  constructor(private firestore: AngularFirestore) { }

  guardarEntrada( data: any ): Promise<unknown> {
    return this.firestore.collection('accounting').doc('incomes').collection('incomes').add(data);
  }
  guardarSalida( data: any ): Promise<unknown> {
    return this.firestore.collection('accounting').doc('outgoings').collection('outgoings').add(data);
  }

  // Only records created since `since` (epoch ms): the full history is never needed.
  obtenerEntradas( since: number ): Observable<AccountingModel[]> {
    return this.obtener('incomes', since);
  }
  obtenerSalidas( since: number ): Observable<AccountingModel[]> {
    return this.obtener('outgoings', since);
  }

  borrarEntrada( id: string): Promise<void> {
    return this.firestore.collection('accounting').doc('incomes').collection('incomes').doc(id).delete();
  }
  borrarSalida( id: string): Promise<void> {
    return this.firestore.collection('accounting').doc('outgoings').collection('outgoings').doc(id).delete();
  }

  private obtener( kind: 'incomes' | 'outgoings', since: number ): Observable<AccountingModel[]> {
    return this.firestore.collection('accounting').doc(kind)
      .collection<AccountingModel>(kind, ref => ref.where('date', '>=', since)).snapshotChanges().pipe(
        map(actions => actions
          .map(a => ({ ...a.payload.doc.data(), id: a.payload.doc.id }))
          .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))))
      );
  }
}
