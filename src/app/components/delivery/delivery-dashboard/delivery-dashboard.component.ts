import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-delivery-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mt-4">
      <h2>Delivery Dashboard</h2>
      <!-- Add your dashboard content here -->
    </div>
  `
})
export class DeliveryDashboardComponent {}