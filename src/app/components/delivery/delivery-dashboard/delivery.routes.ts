import { Routes } from '@angular/router';
import { DeliveryDashboardComponent } from './delivery-dashboard.component';
import { MissionDashboardComponent } from '../mission/mission-dashboard/mission-dashboard.component';
import { MissionDetailsComponent } from '../mission/mission-details/mission-details.component';

export const DELIVERY_ROUTES: Routes = [
  { 
    path: '', 
    redirectTo: 'dashboard', 
    pathMatch: 'full' 
  },
  {
    path: 'dashboard',
    component: DeliveryDashboardComponent
  },
  {
    path: 'missions',
    component: MissionDashboardComponent
  },
  {
    path: 'missions/:id',
    component: MissionDetailsComponent
  }
];