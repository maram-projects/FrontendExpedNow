import { Routes } from '@angular/router';

export const DELIVERY_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./delivery-dashboard.component')
      .then(m => m.DeliveryDashboardComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];