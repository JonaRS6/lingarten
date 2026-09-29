import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ClienttableComponent } from './components/clienttable/clienttable.component';
import { ClientPanelComponent } from './components/client-panel/client-panel.component';
import { BalanceComponent } from './components/balance/balance.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { ShellComponent } from './components/shared/shell/shell.component';
import { AuthGuard, GuestGuard } from './core/auth/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [GuestGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      { path: 'table', component: ClienttableComponent },
      { path: 'panel', component: DashboardComponent },
      { path: 'balance', component: BalanceComponent },
      { path: 'client/:id', component: ClientPanelComponent },
      { path: '', pathMatch: 'full', redirectTo: 'table' }
    ]
  },
  { path: '**', redirectTo: 'table' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
