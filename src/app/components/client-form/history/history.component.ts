import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { ClientdataService } from '../../../services/clientdata.service';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnDestroy {

  clientId: string;
  increases = [];
  private destroy$ = new Subject<void>();

  constructor(private service: ClientdataService, private router: ActivatedRoute) { 
    this.clientId = this.router.snapshot.paramMap.get('id');
    if ( this.clientId !== 'nuevo' ) {
      this.service.getIncreases( this.clientId ).pipe(takeUntil(this.destroy$)).subscribe(data => {
        this.increases = data;
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  deleteIncrease(id: string): void {
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
        this.service.deleteIncrease(this.clientId, id)
          .then(() => Swal.fire('Registro borrado', '', 'success'))
          .catch(() => Swal.fire('Error', 'No se pudo borrar el registro', 'error'));
      } else {
        return;
      }
    });
    
  }
}
