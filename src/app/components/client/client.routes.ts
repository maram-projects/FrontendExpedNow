import { Routes } from '@angular/router';
import { PaymentConfirmationComponent } from './payment-confirmation/payment-confirmation.component';

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
    loadComponent: () => import('./payment-dialog/payment-dialog.component')
      .then(m => m.PaymentDialogComponent)
  },
  {
    path: 'payment/confirmation',
    loadComponent: () => import('./payment-confirmation/payment-confirmation.component')
      .then(m => m.PaymentConfirmationComponent)
  },
  { 
    path: '', 
    redirectTo: 'dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: '**', 
    redirectTo: 'dashboard' 
  }
];