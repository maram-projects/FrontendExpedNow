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
import { PaymentStatus } from '../../../models/Payment.model';
import { BonusStatus } from '../../../models/bonus.model';
import { DiscountType } from '../../../models/discount.model';
import { ChatbotComponent } from '../../../shared/chatbot/chatbot.component';

@Component({
  selector: 'app-admin-dashboard-component',
  standalone: true,
  imports: [
    CommonModule, 
    NgxChartsModule, 
    RouterModule, 
    FormsModule,
    ChatbotComponent 
  ],
  templateUrl: './admin-dashboard-component.component.html',
  styleUrls: ['./admin-dashboard-component.component.css','../../../shared/chatbot/chatbot.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminDashboardComponentComponent implements OnInit {
  paymentStatusData: any[] = [];
  discountTypeData: any[] = [];
  bonusStatusData: any[] = [];
  revenueData: any[] = [];
  stats: DashboardStats | null = null;
  loading = true;
  error = '';
  successMessage = '';
  deliveryPersons: User[] = [];
  selectedDeliveryPerson: User | null = null;
  isLoading = false;
  checkDateTime: Date = new Date();

  // Chat state
  showChat = false;

  // Day of Week enum for template access
  DayOfWeek = DayOfWeek;
  
  // Chart data
  view: [number, number] = [700, 400];
  colorScheme = { 
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA', '#E44D25', '#7aa3e5', '#a8385d', '#aae3f5'] 
  };
  userRoleData: any[] = [];
  
  // Enums for template
  PaymentStatus = PaymentStatus;
  BonusStatus = BonusStatus;
  DiscountType = DiscountType;
  
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

  // Chat toggle method
  toggleChat(): void {
    this.showChat = !this.showChat;
  }

  loadDashboardStats(): void {
    this.loading = true;
    this.error = '';
    
    this.adminService.getDashboardStats().subscribe({
      next: (data: DashboardStats) => {
        console.log('Dashboard stats received:', data);
        this.stats = data;
        this.processChartData(data);
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

  private processChartData(data: DashboardStats): void {
    // Process user roles data
    if (data?.usersByRole) {
      this.userRoleData = Object.entries(data.usersByRole).map(([name, value]) => ({
        name: this.formatRoleName(name),
        value
      }));
      console.log('User role data:', this.userRoleData);
    }
    
    // Process payment status data
    if (data?.paymentStatusBreakdown) {
      this.paymentStatusData = Object.entries(data.paymentStatusBreakdown)
        .map(([name, value]) => ({ 
          name: this.formatStatusName(name), 
          value 
        }));
      console.log('Payment status data:', this.paymentStatusData);
    }
    
    // Process discount type data
    if (data?.discountTypeBreakdown) {
      this.discountTypeData = Object.entries(data.discountTypeBreakdown)
        .map(([name, value]) => ({ 
          name: this.formatDiscountType(name), 
          value 
        }));
      console.log('Discount type data:', this.discountTypeData);
    }
    
    // Process bonus status data
    if (data?.bonusStatusBreakdown) {
      this.bonusStatusData = Object.entries(data.bonusStatusBreakdown)
        .map(([name, value]) => ({ 
          name: this.formatStatusName(name), 
          value 
        }));
      console.log('Bonus status data:', this.bonusStatusData);
    }
    
    // Create revenue data
    this.revenueData = [
      { name: 'Total Revenue', value: data.totalRevenue || 0 },
      { name: 'Bonuses Paid', value: data.bonusAmountPaid || 0 }
    ];
    console.log('Revenue data:', this.revenueData);
  }

  private formatRoleName(role: string): string {
    return role.replace('ROLE_', '').replace('_', ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatStatusName(status: string): string {
    return status.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatDiscountType(type: string): string {
    return type.replace('_', ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
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

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return 'TND 0.00';
    return new Intl.NumberFormat('en-TN', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
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

  // Helper method to format role names for display
  formatRoleForDisplay(roles: string[] | undefined): string {
    if (!roles || roles.length === 0) return 'No roles';
    
    return roles.map(role => {
      if (role.includes('ADMIN')) return 'Admin';
      if (role.includes('DELIVERY')) return 'Delivery';
      if (role.includes('CLIENT')) return 'Client';
      return role.replace('ROLE_', '');
    }).join(', ');
  }

  // Helper method to get badge class for roles
  getRoleBadgeClass(roles: string[] | undefined): string {
    if (!roles || roles.length === 0) return 'bg-secondary';
    
    if (roles.some(role => role.includes('ADMIN'))) return 'bg-danger';
    if (roles.some(role => role.includes('DELIVERY'))) return 'bg-info';
    if (roles.some(role => role.includes('CLIENT'))) return 'bg-primary';
    
    return 'bg-secondary';
  }
}