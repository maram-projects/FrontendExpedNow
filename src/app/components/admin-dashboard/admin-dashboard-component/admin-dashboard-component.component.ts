// admin-dashboard-component.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardStats } from '../../../models/dashboard.model';
import { AdminService } from '../../../services/admin-service.service';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard-component',
  standalone: true,
  imports: [CommonModule, NgxChartsModule, RouterModule],
  templateUrl: './admin-dashboard-component.component.html',
  styleUrls: ['./admin-dashboard-component.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminDashboardComponentComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error = '';
  
  // Chart data
  view: [number, number] = [700, 400];
  colorScheme = { domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'] };
  userRoleData: any[] = [];
  router: any;
  
  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      console.error('ممنوع الدخول!');
      this.router.navigate(['/login']); // رجّع المستخدم للصفحة الرئيسية
      return;
    }
  
    this.loadDashboardStats();
  }
  
  
  loadDashboardStats() {
    this.loading = true;
    this.error = '';
    
    this.adminService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats = data;
        
        // Format data for charts if needed
        if (data && data.usersByRole) {
          this.userRoleData = Object.entries(data.usersByRole).map(([name, value]) => {
            return { name, value };
          });
        }
        
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading dashboard stats:', err);
        
        if (err.status === 401 || err.status === 403) {
          this.error = 'Authentication error. Please log in again.';
        } else if (err.status === 0) {
          this.error = 'Network error. Please check if the server is running.';
        } else if (err.status === 200 && err.error instanceof SyntaxError) {
          this.error = 'Session expired. Please log in again.';
        } else {
          this.error = `Error loading dashboard: ${err.message || 'Unknown error'}`;
        }
        
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
} 