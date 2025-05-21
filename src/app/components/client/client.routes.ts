import { Routes } from '@angular/router';

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
  {
    path: 'discounts',
    loadComponent: () => import('./client-discounts/client-discounts.component')
      .then(m => m.ClientDiscountsComponent)
  },
  { 
    path: 'payment',
    loadComponent: () => import('./payment-method/payment-method.component')
      .then(m => m.PaymentMethodComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];