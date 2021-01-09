import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ClienteModel, ClienteTable } from '../models/cliente.model';
import { map, delay } from 'rxjs/operators';
import { Observable, pipe } from 'rxjs';
// Firebase
import { AngularFirestoreCollection, AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { TicketData, Ticket } from '../models/ticket-data.model';
import { FormControl } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class ClientdataService {
  private URL = 'https://lingarten-efc0b.firebaseio.com';
  clientsList: AngularFirestoreCollection<ClienteModel>;
  clients: Observable<ClienteTable[]>;
  // Table User Query
  dayOption =  '7';
  searchString = new FormControl('');
  mostrarCancelados = false;
  listOptions = [
    {value: '1', day: 'lunes'},
    {value: '2', day: 'martes'},
    {value: '3', day: 'miércoles'},
    {value: '4', day: 'jueves'},
    {value: '5', day: 'viernes'},
    {value: '6', day: 'sábado'},
    {value: '7', day: 'todos'}
  ];
  // Scroll de la tabla
  lastTableScroll = 0;
  columnsToDisplay = ['nombre', 'telefono', 'direccion', 'estado', 'acciones'];
  clientTable: ClienteTable[] = [];

  constructor( private http: HttpClient, private firestore: AngularFirestore, private functions: AngularFireFunctions ) {
    this.getClients();
  }

  createClient( cliente: ClienteModel, ticket: Ticket ): Promise<boolean> {
    let f: boolean;
    const clienteTemp = {
      ...cliente
    };
    return this.clientsList.add(clienteTemp).then( (resp) => {
      const ticketData = new TicketData();
      ticketData.clientId = resp.id;
      ticketData.ticket = ticket;
      console.log(ticket);
      const createTicket = this.functions.httpsCallable('createTicket');
      createTicket(ticketData).subscribe(data => {
        console.log(data);
      });
      console.log(resp);
      cliente.id = resp.id;
      f = true;
      console.log(f);
      return f;
    }).catch( err => {
      f = false;
      console.log('hola puto');
      return f;
    });
   /*  return this.http.post(`${this.URL}/clients.json`, cliente).pipe(
      map( (resp: any) => {
        cliente.id = resp.name;
        return cliente;
      })
    ); */
  }

  updateClient( cliente: ClienteModel ): Promise<boolean> {
    let f: boolean;
    const clienteTemp = {
      ...cliente
    };
    delete clienteTemp.id;
    return this.clientsList.doc(cliente.id).update(clienteTemp).then( () => {
      f = true;
      return f;
    }).catch(() => {
      f = false;
      return f;
    });
    // return this.http.put(`${this.URL}/clients/${cliente.id}.json`, clienteTemp);
  }
  cancelClient( cliente: ClienteModel ): Promise<void> {
    console.log('cancelando en servicio');
    return this.clientsList.doc(cliente.id).update({active: false, cancelDate: new Date().getTime()});
  }
  activeClient( cliente: ClienteModel ): Promise<void> {
    return this.clientsList.doc(cliente.id).update({active: true});
  }
  updateClientPosition( cliente: ClienteModel): Promise<void> {
    return this.firestore.collection('clients').doc(cliente.id).update({position: cliente.position});
  }
  getClients(): void {
    this.clientsList = this.firestore.collection<ClienteModel>('clients', ref => ref.orderBy('service.day').orderBy('position'));
    this.clients = this.clientsList.snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as ClienteModel;
        const id = a.payload.doc.id;
        return { client: { id, ...data}, isPayLoading: false};
      }))
    );
    /* return this.http.get(`${this.URL}/clients.json`).pipe(
      map( this.doArray )
    ); */
  }

  getClient( id: string, cliente: ClienteModel ): Observable<any> {
    return this.clientsList.doc(id).snapshotChanges().pipe(
      map(a => {
        const data = a.payload.data() as ClienteModel;
        return {...data};
      })
    );
    /* return this.http.get(`${this.URL}/clients/${id}.json`).pipe(
      map( (resp: ClienteModel) => {
        cliente = resp;
        return cliente;
      })
    ); */
  }

  createIncrease( id: string, increase: any ): Promise<any> {
    return this.firestore.collection('clients').doc(id).collection('increases').add(increase);
  }
  
  getIncreases( clientid: string): Observable<any> {
    return this.firestore.collection('clients').doc(clientid).collection('increases', ref => ref.orderBy('date', 'asc'))
    .snapshotChanges().pipe(
      map(actions => actions.map(snap => {
        const data = snap.payload.doc.data();
        const id = snap.payload.doc.id;
        return { id, data};
      }))
    );
  }

  deleteIncrease(clientid: string, id: string): Promise<any> {
    return this.firestore.collection('clients').doc(clientid).collection('increases').doc(id).delete();
  }

  getClientTickets(clientId: string): Observable<any> {
    return this.firestore.collection('clients').doc(clientId).collection('tickets', ref => ref.orderBy('generated', 'desc'))
      .snapshotChanges().pipe(
      map(actions => actions.map(snap => {
        const data = snap.payload.doc.data();
        const id = snap.payload.doc.id;
        return { id, data, isPayLoading: false};
      }))
    );
  }

  createTicket( ticketData: TicketData ): Observable<any> {
    const createTicket = this.functions.httpsCallable('createTicket');
    return createTicket(ticketData);
  }

  updateTicket( clientId: string, ticketId: string, action: string ): Promise<any> {
    const payTicket = this.functions.httpsCallable('updateTicket');
    return payTicket({ clientId, ticketId, action}).toPromise();
  }

  quickPay( clientId: string ): Promise<any> {
    const quickPay = this.functions.httpsCallable('quickPay');
    return quickPay({clientId}).toPromise();
  }
  getStats(): Promise<any> {
    const stats = this.functions.httpsCallable('getStats');
    return stats({msg: 'Hola'}).toPromise();
  }
  getStatsPayed(): Observable<any> {
    const currentDate = new Date();
    return this.firestore.collectionGroup('tickets', ref => ref.where('paid', '==', true)
    .where('paidDate', '>=', (new Date(currentDate.getFullYear(), currentDate.getMonth()).getTime()))).get();
  }
  getStatsDebt(): Observable<any> {
    return this.firestore.collectionGroup('tickets', ref => ref.where('paid', '==', false)).get();
  }
}
