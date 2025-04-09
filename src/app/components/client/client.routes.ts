
import { Routes } from '@angular/router';
import { DeliveryRequestComponent } from './delivery-request/delivery-request.component';

export const CLIENT_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./client-dashboard/client-dashboard.component')
      .then(m => m.ClientDashboardComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'delivery-request', component: DeliveryRequestComponent }, 
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];