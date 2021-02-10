import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
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
export class BalanceComponent implements OnInit {

  entradaForm: FormGroup;
  salidaForm: FormGroup;

  entradas: AccountingModel[]; 
  salidas: AccountingModel[]; 

  totalEntradas: number;
  totalSalidas: number;


  constructor(private fb: FormBuilder, public accountingService: AccountingService) { 
    this.crearFormularios();
    const currentDate = new Date();
    this.accountingService.entradas.subscribe( resp => {
      this.entradas = resp.filter(entrada => entrada.date >= new Date(currentDate.getFullYear(), currentDate.getMonth()).getTime());
      this.totalEntradas = 0;
      this.entradas.forEach(entrada => {
        this.totalEntradas += entrada.cantidad
      });
    }
      );
    this.accountingService.salidas.subscribe( resp => {
      this.salidas = resp.filter(salida => salida.date >= new Date(currentDate.getFullYear(), currentDate.getMonth()).getTime());
      this.totalSalidas = 0;
      this.salidas.forEach(salida => {
        this.totalSalidas += salida.cantidad
      });
    }
      );
    
  }

  ngOnInit(): void {
  }

  guardar(form: string): any {
    if (form === 'entrada') {
      if (this.entradaForm.invalid) {
        console.log('invalid');
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
      console.log(entrada);
      this.accountingService.guardarEntrada(entrada);
      console.log('guardando formulario de entrada');
    } else {
      if (this.salidaForm.invalid) {
        console.log('invalid');
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
      this.accountingService.guardarSalida(salida);
      console.log('guardando formulario de salida');
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
          this.accountingService.borrarEntrada( id );
          Swal.fire(
            'Registro borrado',
            'success'
          );
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
          this.accountingService.borrarSalida( id );
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
