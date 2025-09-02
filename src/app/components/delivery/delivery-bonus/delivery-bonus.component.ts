import { Component, OnInit } from '@angular/core';
import { BonusService } from '../../../services/bonus.service';
import { AuthService } from '../../../services/auth.service';
import { Bonus, BonusStatus } from '../../../models/bonus.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-delivery-bonus',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './delivery-bonus.component.html',
  styleUrls: ['./delivery-bonus.component.css']
})
export class DeliveryBonusComponent implements OnInit {
  bonuses: Bonus[] = [];
  stats: any = {};
  deliveryPersonId: string = '';

  constructor(
    private bonusService: BonusService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.deliveryPersonId = user.userId;
      this.loadBonuses();
      this.loadStats();
    }
  }

  loadBonuses(): void {
    this.bonusService.getDeliveryPersonBonuses(this.deliveryPersonId).subscribe({
      next: (bonuses) => this.bonuses = bonuses,
      error: (err) => console.error('Error loading bonuses:', err)
    });
  }

  loadStats(): void {
    this.bonusService.getDeliveryStats(this.deliveryPersonId).subscribe({
      next: (stats) => this.stats = stats,
      error: (err) => console.error('Error loading stats:', err)
    });
  }

  getStatusClass(status: BonusStatus): string {
    switch (status) {
      case BonusStatus.CREATED: return 'badge bg-warning';    // Changed from PENDING
      case BonusStatus.PAID: return 'badge bg-success';       // Changed from APPROVED
      case BonusStatus.REJECTED: return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }
}