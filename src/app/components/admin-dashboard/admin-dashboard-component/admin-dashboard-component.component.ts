import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DashboardStats } from '../../../models/dashboard.model';
import { AdminService } from '../../../services/admin-service.service';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { FormsModule } from '@angular/forms';
import { DayOfWeek } from '../../../models/day-of-week.enum';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-admin-dashboard-component',
  standalone: true,
  imports: [CommonModule, NgxChartsModule, RouterModule, FormsModule],
  templateUrl: './admin-dashboard-component.component.html',
  styleUrls: ['./admin-dashboard-component.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminDashboardComponentComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error = '';
  successMessage = '';
  deliveryPersons: User[] = [];
  selectedDeliveryPerson: User | null = null;
  isLoading = false;
  checkDateTime: Date = new Date();

  scheduleDebugInfo: string = '';
  selectedDeliveryPersonId: string | null = null;

  
  // Day of Week enum for template access
  DayOfWeek = DayOfWeek;
  
  // Chart data
  view: [number, number] = [700, 400];
  colorScheme = { domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'] };
  userRoleData: any[] = [];
  
  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      console.error('Access denied!');
      this.router.navigate(['/login']);
      return;
    }
  
    this.loadDashboardStats();
    this.loadDeliveryPersons();
  }

  loadDashboardStats(): void {
    this.loading = true;
    this.error = '';
    
    this.adminService.getDashboardStats().subscribe({
      next: (data: DashboardStats) => {
        this.stats = data;
        
        if (data?.usersByRole) {
          this.userRoleData = Object.entries(data.usersByRole).map(([name, value]) => ({
            name,
            value
          }));
        }
        
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error loading dashboard stats:', err);
        
        if (err.status === 401 || err.status === 403) {
          this.error = 'Authentication error. Please log in again.';
        } else if (err.status === 0) {
          this.error = 'Network error. Please check your connection.';
        } else {
          this.error = `Error loading dashboard: ${err.message || 'Unknown error'}`;
        }
        
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
  
  loadDeliveryPersons(): void {
    this.isLoading = true;
    this.userService.getDeliveryPersonnel().subscribe({
      next: (persons: User[]) => {
        this.deliveryPersons = persons;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load delivery persons:', err);
        this.error = 'Failed to load delivery persons';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  

  

  

  formatDate(date: Date): string {
    if (!date) return '';
    try {
      return date.toISOString().slice(0, 16);
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  onDateTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && input.value) {
      this.checkDateTime = new Date(input.value);
    }
  }
  
  getDayName(day: DayOfWeek): string {
    const dayNames: Record<DayOfWeek, string> = {
      [DayOfWeek.MONDAY]: 'Monday',
      [DayOfWeek.TUESDAY]: 'Tuesday',
      [DayOfWeek.WEDNESDAY]: 'Wednesday',
      [DayOfWeek.THURSDAY]: 'Thursday',
      [DayOfWeek.FRIDAY]: 'Friday',
      [DayOfWeek.SATURDAY]: 'Saturday',
      [DayOfWeek.SUNDAY]: 'Sunday'
    };
    return dayNames[day] || day.toString();
  }
}