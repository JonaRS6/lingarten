import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClienteModel } from '../../models/cliente.model';
import { ClientdataService } from '../../services/clientdata.service';
import { NgForm } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import {MatDialog} from '@angular/material/dialog';
import { ImportFormComponent } from './import-form.component';
import { Ticket } from '../../models/ticket-data.model';
import { Location } from '@angular/common';

@Component({
  selector: 'app-client-form',
  templateUrl: './client-form.component.html',
  styles: [
  ]
})
export class ClientFormComponent implements OnInit {

  clientForm: FormGroup;
  // importeInicial = new FormControl('');

  cliente: ClienteModel = new ClienteModel();
  printq : boolean;
  constructor( private fb: FormBuilder, private service: ClientdataService,
               private router: ActivatedRoute, public dialog: MatDialog, private location: Location  ) {
    this.crearFormulario();
    // this.importeInicial.setValidators(Validators.required);
    const id = this.router.snapshot.paramMap.get('id');
    if ( id !== 'nuevo' ) {
      this.service.getClient( id, this.cliente ).subscribe( (client) => {
        console.log({cliente: client});
        this.cliente = Object.assign(this.cliente, client);
        this.printq = client.printq;
        console.log(this.printq);
        this.writeForm(client);
        console.log(this.clientForm.getRawValue());
      });
      this.cliente.id = id;
    }
    console.log(this.cliente);
   }

  ngOnInit(): void {
  }
  goBack(): void {
    this.location.back();
  }
  guardar( form: NgForm ): void {
    if (this.clientForm.get('service.period').value === 'mensual') {
      this.clientForm.get('service.type').setValue('mensual');
    }
    if (this.clientForm.invalid) {
      console.log('invalid');
      Object.values( this.clientForm.controls ).forEach ( control => {
        if ( control instanceof FormGroup ) {
          Object.values( control.controls ).forEach ( contr => contr.markAsTouched() );
        } else {
          control.markAsTouched();
        }
      });
      return;
    }
    let historyChange = false;
    let increase;
    if (this.cliente.service.cost !== this.clientForm.get('service.cost').value) {
      increase = {
        date: new Date().getTime(),
        last: this.cliente.service.cost,
        new: this.clientForm.get('service.cost').value
      }
      historyChange = true;
    }
    this.cliente = Object.assign(this.cliente, this.clientForm.getRawValue());
    this.readForm();

    if (this.cliente.id ) {
      this.loadingAlert();
      this.service.updateClient( this.cliente )
        .then(resultado => {
          if (resultado) {
            this.successUpdate('actualizó');
          } else {
            this.errorUpdate();
          }
        });
      if (historyChange) {
        this.service.createIncrease(this.cliente.id, increase);
        console.log('actualizar historial');
      }
    } else {
      const dialogRef = this.dialog.open(ImportFormComponent, {
        width: '250px',
        data: {import: 0}
      });
      dialogRef.afterClosed().subscribe(result => {
        this.loadingAlert();
        if (result) {
          const ticket: Ticket = {
            paid: false,
            type: 'Primer nota de cobro por el servicio de recolección semanal',
            cost: result,
            generated: 0
          };
          this.service.createClient( this.cliente, ticket )
            .then(resultado => {
              if (resultado) {
                this.successUpdate('guardó');
              } else {
                this.errorUpdate();
              }
            });
        } else {
          this.errorUpdate();
        }
        console.log('The dialog was closed');
        console.log('result = ', result);
      });
    }

  }
  cancelarCliente(): void {
    console.log('Cancelando en componente');
    Swal.fire({
      title: 'Cancelar cliente',
      text: `Ya no se generarán notas automáticas`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: `Ok`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.cancelClient(this.cliente);
        Swal.fire(
          'Cliente cancelado',
          'success'
        );
      } else {
        return;
      }
    });
  }
  activarCliente(): void {
    Swal.fire({
      title: 'Activar cliente',
      text: `Se generarán notas automáticas a partir del próximo mes`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: `Ok`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.activeClient(this.cliente);
        Swal.fire(
          'Cliente activado',
          'success'
        );
      } else {
        return;
      }
    });
  }

  confirmAlert( accion: string): Promise<any> {
    return 
  }


  // Formulario

  crearFormulario(): void{
    this.clientForm = this.fb.group({
      name  : ['', [Validators.required, Validators.minLength(2)]],
      lastname: ['', [Validators.required, Validators.minLength(2)]],
      email   : ['', [Validators.pattern('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$')]],
      tel1 : ['', [Validators.required, Validators.minLength(6)] ],
      tel2: ['', [Validators.minLength(6)]],
      service: this.fb.group({
        day: ['', [Validators.required]],
        cost: ['', Validators.required],
        type: ['', Validators.required],
        period: ['', Validators.required]

      }),
      address: this.fb.group({
        street: ['', Validators.required ],
        colony: ['', Validators.required ],
        no: ['', Validators.required]
      }),
      printq: ['' ]
    });
  }
  isValid( formCtrl: string ): boolean {
    return this.clientForm.get( formCtrl ).invalid && this.clientForm.get( formCtrl ).touched;
  }

  // Alertas
  successUpdate( action: string ): void {
    Swal.fire({
      title: `${this.cliente.name} ${this.cliente.lastname}`,
      text: `Se ${action} correctamente`,
      icon: 'success'
    });
  }
  errorUpdate(): void {
    Swal.fire({
      title: this.cliente.name,
      text: 'No se pudo guardar',
      icon: 'error'
    });
  }
  loadingAlert(): void {
    Swal.fire({
      title: 'Espere',
      text: 'Guardando información',
      icon: 'info',
      allowOutsideClick: true
    });
    Swal.showLoading();
  }

  // Lectura y escritura de formulario

  changePeriod(): void {
    this.clientForm.get('service.type').setValue('');
  }
  writeForm( client: any): void {
    switch (client.service.type) {
      case 'enero':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'febrero':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'marzo':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'abril':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'mayo':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'junio':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'julio':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'agosto':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'septiembre':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'octubre':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'noviembre':
        this.clientForm.get('service.period').setValue('anual');
        break;
      case 'diciembre':
        this.clientForm.get('service.period').setValue('anual');
        break;
      default:
        break;
    }
    switch (client.service.type ) {
      case 'par':
        this.clientForm.get('service.period').setValue('bimestral');
        break;
      case 'inpar':
        this.clientForm.get('service.period').setValue('bimestral');
        break;
    }
    if (client.service.type === 'mensual') {
      this.clientForm.get('service.period').setValue('mensual');
    }
    this.clientForm.patchValue(client);
  }

  readForm(): void {
    if (this.clientForm.get('service.period').value === 'mensual') {
      this.cliente.service.type = 'mensual';
    }
    /* if (this.cliente.service.type === 'bimestral') {
      const isPairMonth = (new Date().getMonth() + 1 ) % 2;
      if (isPairMonth) {
        this.cliente.service.type = 'inpar';
      } else {
        this.cliente.service.type = 'par';
      }
    }
    if (this.cliente.service.type === 'anual') {
      const month = new Date().getMonth() + 1;
      let value = '';
      switch (month) {
        case 1:
          value = 'enero';
          break;
        case 2:
          value = 'febrero';
          break;
        case 3:
          value = 'marzo';
          break;
        case 4:
          value = 'abril';
          break;
        case 5:
          value = 'mayo';
          break;
        case 6:
          value = 'junio';
          break;
        case 7:
          value = 'julio';
          break;
        case 8:
          value = 'agosto';
          break;
        case 9:
          value = 'septiembre';
          break;
        case 10:
          value = 'octubre';
          break;
        case 11:
          value = 'noviembre';
          break;
        case 12:
          value = 'diciembre';
          break;
        default:
          break;
      } */
  }
}
/*
('enero' | 'febrero' || 'marzo' || 'abril' || 'mayo' || 'junio' || 'julio' || 'agosto' || 'septiembre' || 'octubre'
|| 'noviembre' || 'diciembre') */
