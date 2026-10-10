import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Payment } from '../models/payment.model';
import { StatementDeposit } from '../core/statement-csv';

// The import function accepts this many deposits per call.
const IMPORT_CHUNK = 500;
const RECENT_PAYMENTS = 30;

export interface ImportSummary {
  applied: number;
  unmatched: number;
  duplicate: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentsService {

  constructor( private firestore: AngularFirestore, private functions: AngularFireFunctions ) { }

  // Sorted here: ordering on another field would need a composite index.
  getUnmatched(): Observable<Payment[]> {
    return this.list(ref => ref.where('status', '==', 'unmatched')).pipe(
      map(payments => payments.sort((a, b) => a.receivedAt - b.receivedAt))
    );
  }

  getRecent(): Observable<Payment[]> {
    return this.list(ref => ref.orderBy('importedAt', 'desc').limit(RECENT_PAYMENTS));
  }

  async importDeposits( deposits: StatementDeposit[] ): Promise<ImportSummary> {
    const importPayments = this.functions.httpsCallable('importPayments');
    const total: ImportSummary = { applied: 0, unmatched: 0, duplicate: 0 };
    for (let start = 0; start < deposits.length; start += IMPORT_CHUNK) {
      const summary: ImportSummary = await importPayments({ rows: deposits.slice(start, start + IMPORT_CHUNK) }).toPromise();
      total.applied += summary.applied;
      total.unmatched += summary.unmatched;
      total.duplicate += summary.duplicate;
    }
    return total;
  }

  assign( paymentId: string, clientId: string ): Promise<unknown> {
    return this.functions.httpsCallable('assignPayment')({ paymentId, clientId }).toPromise();
  }

  ignore( paymentId: string ): Promise<unknown> {
    return this.functions.httpsCallable('ignorePayment')({ paymentId }).toPromise();
  }

  assignMissingReferences(): Promise<{ assigned: number }> {
    return this.functions.httpsCallable('assignMissingReferences')({}).toPromise();
  }

  private list( query: (ref: any) => any ): Observable<Payment[]> {
    return this.firestore.collection<Payment>('payments', query).snapshotChanges().pipe(
      map(actions => actions.map(a => ({ ...a.payload.doc.data(), id: a.payload.doc.id })))
    );
  }
}
