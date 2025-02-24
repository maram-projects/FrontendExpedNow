// src/app/components/client/client-dashboard/client-dashboard.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
}

@Component({
  selector: 'app-client-dashboard',
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ClientDashboardComponent implements OnInit {
  userType: string = '';
  stats: DashboardStats = {
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0
  };

  constructor(private authService: AuthService) {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.userType = currentUser.userType;
    }
  }

  ngOnInit() {
    // Here you would typically load dashboard data
    this.loadDashboardStats();
  }

  private loadDashboardStats() {
    // Simulate loading stats - replace with actual API call
    this.stats = {
      totalOrders: 25,
      pendingOrders: 5,
      completedOrders: 20
    };
  }
}