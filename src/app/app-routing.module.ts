import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ClienttableComponent } from './components/clienttable/clienttable.component';
import { ClientPanelComponent } from './components/client-panel/client-panel.component';
import { BalanceComponent } from './components/balance/balance.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './core/auth/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'table', component: ClienttableComponent, canActivate: [AuthGuard] },
  { path: 'panel', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'balance', component: BalanceComponent, canActivate: [AuthGuard] },
  { path: 'client/:id', component: ClientPanelComponent, canActivate: [AuthGuard] },
  { path: '**', pathMatch: 'full', redirectTo: 'table' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
