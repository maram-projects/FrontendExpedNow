import { Routes } from '@angular/router';
import { DeliveryDashboardComponent } from './delivery-dashboard/delivery-dashboard.component';
import { MissionDashboardComponent } from './mission/mission-dashboard/mission-dashboard.component';
import { MissionDetailsComponent } from './mission/mission-details/mission-details.component';
import { ScheduleComponent } from '../admin-dashboard/schedule/schedule.component';
import { DeliveryChatComponent } from './chat/delivery-chat-component/delivery-chat-component.component';

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
    path: 'schedule',
    component: ScheduleComponent,
    data: { mode: 'delivery' }
  },
  {
    path: 'deliveries/:id/chat',
    loadComponent: () => import('./chat/delivery-chat-component/delivery-chat-component.component').then(m => m.DeliveryChatComponent)
  },
  // Add this new general chat route
  {
    path: 'chat',
    loadComponent: () => import('./chat/delivery-chat-component/delivery-chat-component.component').then(m => m.DeliveryChatComponent)
  },
  {
    path: 'bonuses',
    loadComponent: () => import('./delivery-bonus/delivery-bonus.component')
      .then(m => m.DeliveryBonusComponent)
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];