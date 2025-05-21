import { Routes } from '@angular/router';
import { DeliveryDashboardComponent } from './delivery-dashboard.component';
import { MissionDashboardComponent } from '../mission/mission-dashboard/mission-dashboard.component';
import { MissionDetailsComponent } from '../mission/mission-details/mission-details.component';

export const DELIVERY_ROUTES: Routes = [
  { 
    path: 'dashboard',
    component: DeliveryDashboardComponent
  },
  { 
    path: 'missions',
    children: [
      { path: '', component: MissionDashboardComponent },
      { path: ':id', component: MissionDetailsComponent }
    ]
  },
  {
    path: 'bonuses',
    loadComponent: () => import('../delivery-bonus/delivery-bonus.component')
      .then(m => m.DeliveryBonusComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];