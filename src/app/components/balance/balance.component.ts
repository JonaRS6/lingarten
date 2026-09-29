import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountingModel } from 'src/app/models/accounting.model';
import { AccountingService } from '../../services/accounting.service';
import Swal from 'sweetalert2';



@Component({
  selector: 'app-balance',
  templateUrl: './balance.component.html',
  styles: [
  ]
})
export class BalanceComponent implements OnDestroy {

  entradaForm: FormGroup;
  salidaForm: FormGroup;

  entradas: AccountingModel[]; 
  salidas: AccountingModel[]; 

  totalEntradas: number;
  totalSalidas: number;


  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, public accountingService: AccountingService) {
    this.crearFormularios();
    const currentDate = new Date();
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth()).getTime();
    this.accountingService.obtenerEntradas(monthStart).pipe(takeUntil(this.destroy$)).subscribe(resp => {
      this.entradas = resp;
      this.totalEntradas = resp.reduce((total, entrada) => total + entrada.cantidad, 0);
    });
    this.accountingService.obtenerSalidas(monthStart).pipe(takeUntil(this.destroy$)).subscribe(resp => {
      this.salidas = resp;
      this.totalSalidas = resp.reduce((total, salida) => total + salida.cantidad, 0);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  guardar(form: string): any {
    if (form === 'entrada') {
      if (this.entradaForm.invalid) {
        Object.values( this.entradaForm.controls ).forEach ( control => {
          if ( control instanceof FormGroup ) {
            Object.values( control.controls ).forEach ( contr => contr.markAsTouched() );
          } else {
            control.markAsTouched();
          }
        });
        return;
      }
      let entrada = {
        ...this.entradaForm.getRawValue(),
        date: new Date().getTime()
      }
      this.accountingService.guardarEntrada(entrada).catch(() => this.errorGuardar());
    } else {
      if (this.salidaForm.invalid) {
        Object.values( this.salidaForm.controls ).forEach ( control => {
          if ( control instanceof FormGroup ) {
            Object.values( control.controls ).forEach ( contr => contr.markAsTouched() );
          } else {
            control.markAsTouched();
          }
        });
        return;
      }
      let salida = {
        ...this.salidaForm.getRawValue(),
        date: new Date().getTime()
      }
      this.accountingService.guardarSalida(salida).catch(() => this.errorGuardar());
    }
  }

  borrar( form: string, id: string ): void {
    if (form === 'entrada') {
      Swal.fire({
        title: 'Borrar registro',
        text: `Se perderá la información de la entrada y no se reflejará en los registros del mes`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4a148c',
        confirmButtonText: `Ok`,
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.accountingService.borrarEntrada( id )
            .then(() => Swal.fire('Registro borrado', '', 'success'))
            .catch(() => Swal.fire('Error', 'No se pudo borrar el registro', 'error'));
        } else {
          return;
        }
      });
    } else {
      Swal.fire({
        title: 'Borrar registro',
        text: `Se perderá la información de la salida y no se reflejará en los registros del mes`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4a148c',
        confirmButtonText: `Ok`,
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.accountingService.borrarSalida( id )
            .then(() => Swal.fire('Registro borrado', '', 'success'))
            .catch(() => Swal.fire('Error', 'No se pudo borrar el registro', 'error'));
        } else {
          return;
        }
      });
    }
  }

  errorGuardar(): void {
    Swal.fire('Error', 'No se pudo guardar el registro', 'error');
  }

  crearFormularios(): any {
    this.entradaForm = this.fb.group({
      fecha : ['', [Validators.required]],
      concepto : ['', [Validators.required, Validators.minLength(2)]],
      cantidad: ['', [Validators.required]]
    })
    this.salidaForm = this.fb.group({
      fecha : ['', [Validators.required]],
      concepto : ['', [Validators.required, Validators.minLength(2)]],
      cantidad: ['', [Validators.required]]
    })
  }

  isValid( form: string , formCtrl: string ): boolean {
    if (form === 'entrada') {
      return this.entradaForm.get( formCtrl ).invalid && this.entradaForm.get( formCtrl ).touched;
    } else {
      return this.salidaForm.get( formCtrl ).invalid && this.salidaForm.get( formCtrl ).touched;
      
    }
  }
}
