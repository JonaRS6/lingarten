import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ClienteModel } from '../../models/cliente.model';
import { ClientdataService } from '../../services/clientdata.service';
import { NgForm } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import {MatDialog} from '@angular/material/dialog';
import { ImportFormComponent } from './import-form.component';
import { Ticket } from '../../models/ticket-data.model';
import { Location } from '@angular/common';
import { take } from 'rxjs/operators';

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
  saving = false;
  constructor( private fb: FormBuilder, private service: ClientdataService,
               private router: ActivatedRoute, private navigation: Router,
               public dialog: MatDialog, private location: Location  ) {
    this.crearFormulario();
    // this.importeInicial.setValidators(Validators.required);
    const id = this.router.snapshot.paramMap.get('id');
    if ( id !== 'nuevo' ) {
      // Read once: a live copy would overwrite the form while it is being edited.
      this.service.getClient( id ).pipe(take(1)).subscribe( (client) => {
        this.cliente = Object.assign(this.cliente, client);
        this.printq = client.printq;
        this.writeForm(client);
      });
      this.cliente.id = id;
    }
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

    if (this.cliente.id) {
      if (Number(this.cliente.service.cost) !== Number(this.clientForm.get('service.cost').value)) {
        increase = {
          date: new Date().getTime(),
          last: this.cliente.service.cost,
          new: this.clientForm.get('service.cost').value
        };
        historyChange = true;
      }
    }
    this.cliente = Object.assign(this.cliente, this.clientForm.getRawValue());
    this.readForm();
    
    
    if (this.cliente.id ) {
      this.saving = true;
      this.loadingAlert();
      this.service.updateClient( this.cliente )
        .then(async resultado => {
          // The price history only records changes that were actually saved.
          if (resultado && historyChange) {
            await this.service.createIncrease(this.cliente.id, increase);
          }
          Swal.close();
          this.saving = false;
          if (resultado) {
            this.successUpdate('actualizó');
          } else {
            this.errorUpdate();
          }
        }).catch(() => {
          Swal.close();
          this.saving = false;
          this.errorUpdate();
        });
    } else {
      const dialogRef = this.dialog.open(ImportFormComponent, {
        width: '250px',
        data: {importe: 0}
      });
      dialogRef.afterClosed().subscribe(result => {
        if (result !== undefined && result !== null && Number.isFinite(Number(result))) {
          const ticket: Ticket = {
            paid: false,
            type: 'Primer nota de cobro por el servicio de recolección semanal',
            cost: Number(result),
            generated: 0
          };
          this.saving = true;
          this.loadingAlert();
          this.service.createClient( this.cliente, ticket )
            .then(resultado => {
              Swal.close();
              this.saving = false;
              if (resultado) {
                this.successUpdate('guardó');
              } else {
                this.errorUpdate();
              }
            }).catch(() => {
              Swal.close();
              this.saving = false;
              this.errorUpdate();
            });
        }
      });
    }

  }
  cancelarCliente(): void {
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
        this.service.cancelClient(this.cliente)
          .then(() => Swal.fire('Cliente cancelado', '', 'success'))
          .catch(() => this.errorUpdate());
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
        this.service.activeClient(this.cliente)
          .then(() => Swal.fire('Cliente activado', '', 'success'))
          .catch(() => this.errorUpdate());
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
    }).then(() => {
      if (action === 'guardó' && this.cliente.id) {
        this.navigation.navigate(['/client', this.cliente.id]);
      }
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
      allowOutsideClick: false,
      showConfirmButton: false
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
