
import { Routes } from '@angular/router';
import { DeliveryRequestComponent } from './delivery-request/delivery-request.component';

export const CLIENT_ROUTES: Routes = [
  { 
    path: 'dashboard',
    loadComponent: () => import('./client-dashboard/client-dashboard.component')
      .then(m => m.ClientDashboardComponent)
  },
  { 
    path: 'delivery-request', 
    loadComponent: () => import('./delivery-request/delivery-request.component')
      .then(m => m.DeliveryRequestComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];