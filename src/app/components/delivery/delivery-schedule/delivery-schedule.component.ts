import { Component } from '@angular/core';
import { ScheduleComponent } from '../../admin-dashboard/schedule/schedule.component';

@Component({
  selector: 'app-delivery-schedule',
  standalone: true,
  imports: [ScheduleComponent],
  template: `
    <div class="delivery-schedule-container">
      <h2>My Availability Schedule</h2>
      <p>Manage your working days and hours</p>
      
      <app-schedule [mode]="'delivery'"></app-schedule>
    </div>
  `,
  styleUrls: ['./delivery-schedule.component.css']
})
export class DeliveryScheduleComponent {
  // يمكنك إضافة أي خصائص أو دوال إضافية هنا
}