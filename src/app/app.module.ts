import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ClienttableComponent } from './components/clienttable/clienttable.component';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';

import { HttpClientModule } from '@angular/common/http';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ClientFormComponent } from './components/client-form/client-form.component';
import { SidebarComponent } from './components/shared/sidebar/sidebar.component';
import { NavbarComponent } from './components/shared/navbar/navbar.component';
// DataTables
import { DataTablesModule } from 'angular-datatables';

// Material Angular
import {MatButtonModule} from '@angular/material/button';
import {MatInputModule} from '@angular/material/input';
import {MatRippleModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatSelectModule} from '@angular/material/select';
import {MatRadioModule} from '@angular/material/radio';
import {MatDialogModule} from '@angular/material/dialog';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTableModule} from '@angular/material/table';
import {MatPaginatorModule} from '@angular/material/paginator';

// Firebase
import { AngularFireModule } from '@angular/fire';
import { environment } from '../environments/environment';
import { ClientPanelComponent } from './components/client-panel/client-panel.component';
import { ClientTicketsComponent } from './components/client-tickets/client-tickets.component';
import { ImportFormComponent } from './components/client-form/import-form.component';
import { TicketFormComponent } from './components/client-tickets/ticket-form.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { HistoryComponent } from './components/client-form/history/history.component';



@NgModule({
  declarations: [
    AppComponent,
    ClienttableComponent,
    ClientFormComponent,
    SidebarComponent,
    NavbarComponent,
    ClientPanelComponent,
    ClientTicketsComponent,
    ImportFormComponent,
    TicketFormComponent,
    DashboardComponent,
    HistoryComponent
  ],
  imports: [
    DataTablesModule,
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    NgbModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatRippleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatRadioModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    DragDropModule,
    MatTableModule,
    MatPaginatorModule,
    AngularFireModule.initializeApp(environment.firebase),
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })
  ],
  entryComponents: [
    ImportFormComponent,
    TicketFormComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
