import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClientdataService } from '../../../services/clientdata.service';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {

  clientId: string;
  increases = [];

  constructor(private service: ClientdataService, private router: ActivatedRoute) { 
    this.clientId = this.router.snapshot.paramMap.get('id');
    if ( this.clientId !== 'nuevo' ) {
      this.service.getIncreases( this.clientId ).subscribe(data => {
        this.increases = data;
        console.log({increases: this.increases});
        /* this.tickets.forEach(ticket => {
          const date = new Date(ticket.data.generated);
          ticket.data.generated = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        }); */
      });
    }
  }

  ngOnInit(): void {
  }

  deleteIncrease(id: string): void {
    console.log('pulsado');
    Swal.fire({
      title: 'Borrar registro',
      text: `Se perderá la información de cambio de precio`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: `Ok`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.deleteIncrease(this.clientId, id).then();
        Swal.fire(
          'Registro borrado',
          'success'
        );
      } else {
        return;
      }
    });
    
  }
}
