import { Component, Input, OnInit } from '@angular/core';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AvailabilityService } from '../../../services/availability.service';
import { AvailabilitySchedule, DayOfWeek, DaySchedule } from '../../../models/availability.model';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { ScheduleComponent } from '../../admin-dashboard/schedule/schedule.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-delivery-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatIconModule,
    MatTabsModule,
    DatePipe,
    ScheduleComponent,
    MatProgressSpinnerModule,
    NgIf
  ],
  templateUrl: './delivery-dashboard.component.html',
  styleUrls: ['./delivery-dashboard.component.css']
})
export class DeliveryDashboardComponent implements OnInit {
  assignedDeliveries: DeliveryRequest[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
  processingItems: Set<string> = new Set<string>();
  
  // Add the missing property for delivery person selection with proper type
  selectedDeliveryPerson: {
    userId: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null = null;
  
  // Section management
  currentSection: 'pending' | 'history' = 'pending';
  
  // View mode for pending deliveries
  viewMode: 'cards' | 'table' = 'cards';
  
  // Availability panel
  showAvailabilityPanel = false;
  currentSchedule: AvailabilitySchedule | null = null;
  isScheduleLoading = false;
  scheduleError = '';
  
  // History section
  isHistoryLoading = false;
  historyFilter: string = 'all';
  filteredHistory: any[] = [];
  
  selectedTabIndex = 0;

  constructor(
    public deliveryService: DeliveryService,
    private router: Router,
    public authService: AuthService,
    private availabilityService: AvailabilityService
  ) {}

  ngOnInit(): void {
    this.loadAssignedDeliveries();
    this.loadSchedule();
    this.loadHistory();
    // Auto-show schedule panel for delivery personnel
    if (!this.authService.isAdmin()) {
      this.showAvailabilityPanel = true;
    }
  }

  // Clear messages
  clearErrorMessage(): void {
    this.errorMessage = '';
  }

  clearSuccessMessage(): void {
    this.successMessage = '';
  }

  // Section switching
  switchSection(section: 'pending' | 'history'): void {
    this.currentSection = section;
    if (section === 'history' && this.filteredHistory.length === 0) {
      this.loadHistory();
    }
  }

  // History management
  loadHistory(): void {
    this.isHistoryLoading = true;
    // Implement your history loading logic here
    // For example:
    // this.deliveryService.getDeliveryHistory().subscribe(history => {
    //   this.filteredHistory = history;
    //   this.isHistoryLoading = false;
    // });
    this.isHistoryLoading = false; // Remove this when implementing actual loading
  }

  refreshHistory(): void {
    this.loadHistory();
  }

  applyHistoryFilter(): void {
    // Implement filtering logic based on this.historyFilter
    // For example:
    // if (this.historyFilter === 'all') {
    //   this.filteredHistory = [...allHistory];
    // } else {
    //   this.filteredHistory = allHistory.filter(d => d.status === this.historyFilter);
    // }
  }

  // ID shortening utility
  shortenId(id: string): string {
    return id ? id.substring(0, 8) : '';
  }

  toggleAvailabilityPanel(): void {
    this.showAvailabilityPanel = !this.showAvailabilityPanel;
    if (this.showAvailabilityPanel && !this.currentSchedule) {
      this.loadSchedule();
    }
  }

  loadAssignedDeliveries(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.deliveryService.getAssignedPendingDeliveries().subscribe({
      next: (deliveries) => {
        this.assignedDeliveries = deliveries;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load assigned deliveries';
        this.isLoading = false;
        console.error('Error loading deliveries:', err);
      }
    });
  }

  loadSchedule(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.userId) {
      this.scheduleError = 'User not authenticated';
      return;
    }
  
    // Always use the same ID format as when creating the schedule
    const targetUserId = this.authService.isAdmin() && this.selectedDeliveryPerson 
      ? this.selectedDeliveryPerson.userId
      : currentUser.userId;
  
    this.isScheduleLoading = true;
    this.scheduleError = '';
    
    this.availabilityService.getSchedule(targetUserId).subscribe({
      next: (response) => {
        if (response.success) {
          // Handle both response structures
          this.currentSchedule = response.schedule || response.data || null;
          
          // If no schedule exists, initialize an empty one
          if (!this.currentSchedule) {
            this.currentSchedule = this.initializeEmptySchedule(targetUserId);
          }
        } else if (response.isNewSchedule) {
          // Handle case where no schedule exists but API indicates it's new
          this.currentSchedule = this.initializeEmptySchedule(targetUserId);
        }
        this.isScheduleLoading = false;
      },
      error: (err) => {
        if (err.status === 404) {
          // No schedule exists - create an empty one
          this.currentSchedule = this.initializeEmptySchedule(targetUserId);
        } else {
          this.scheduleError = 'Failed to load availability schedule: ' + 
            (err.error?.message || err.message || 'Unknown error');
          console.error('Error loading schedule:', err);
        }
        this.isScheduleLoading = false;
      }
    });
  }
  
  // Add the missing method referenced in the template
  initializeNewSchedule(): void {
    const userId = this.authService.getCurrentUser()?.userId;
    if (!userId) {
      this.scheduleError = 'User not authenticated';
      return;
    }
    
    const targetUserId = this.authService.isAdmin() && this.selectedDeliveryPerson 
      ? this.selectedDeliveryPerson.userId
      : userId;
    
    this.currentSchedule = this.initializeEmptySchedule(targetUserId);
  }
  
  // Renamed from initializeEmptyWeeklySchedule to better reflect its functionality
  private initializeEmptySchedule(userId: string): AvailabilitySchedule {
    return {
      userId: userId,
      weeklySchedule: this.initializeEmptyWeeklySchedule(),
      monthlySchedule: {}
    };
  }
  
  private initializeEmptyWeeklySchedule(): Record<DayOfWeek, DaySchedule> {
    return {
      [DayOfWeek.MONDAY]: { working: false, startTime: null, endTime: null },
      [DayOfWeek.TUESDAY]: { working: false, startTime: null, endTime: null },
      [DayOfWeek.WEDNESDAY]: { working: false, startTime: null, endTime: null },
      [DayOfWeek.THURSDAY]: { working: false, startTime: null, endTime: null },
      [DayOfWeek.FRIDAY]: { working: false, startTime: null, endTime: null },
      [DayOfWeek.SATURDAY]: { working: false, startTime: null, endTime: null },
      [DayOfWeek.SUNDAY]: { working: false, startTime: null, endTime: null }
    };
  }

  onScheduleUpdated(updatedSchedule: AvailabilitySchedule): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.userId) {
      this.scheduleError = 'User not authenticated';
      return;
    }

    this.isScheduleLoading = true;
    this.scheduleError = '';
    
    // Determine the user ID for the schedule
    const targetUserId = this.authService.isAdmin() && this.selectedDeliveryPerson 
      ? this.selectedDeliveryPerson.userId
      : currentUser.userId;
    
    updatedSchedule.userId = targetUserId;

    this.availabilityService.saveSchedule(updatedSchedule).subscribe({
      next: (response) => {
        if (response.success) {
          this.currentSchedule = updatedSchedule;
          this.successMessage = 'Schedule updated successfully';
          setTimeout(() => this.successMessage = '', 3000);
        }
        this.isScheduleLoading = false;
      },
      error: (err) => {
        this.scheduleError = 'Failed to update schedule';
        this.isScheduleLoading = false;
        console.error('Error updating schedule:', err);
      }
    });
  }

  acceptDelivery(deliveryId: string): void {
    if (this.isProcessing(deliveryId)) return;
    
    this.processingItems.add(deliveryId);
    
    this.deliveryService.acceptDelivery(deliveryId).subscribe({
      next: (response) => {
        this.handleDeliveryAccepted(deliveryId, response);
        this.processingItems.delete(deliveryId);
      },
      error: (err) => {
        this.handleDeliveryError(err, 'accept');
        this.processingItems.delete(deliveryId);
      }
    });
  }

  rejectDelivery(deliveryId: string): void {
    if (this.isProcessing(deliveryId)) return;
    
    this.processingItems.add(deliveryId);
    
    this.deliveryService.rejectDelivery(deliveryId).subscribe({
      next: () => {
        this.handleDeliveryRejected(deliveryId);
        this.processingItems.delete(deliveryId);
      },
      error: (err) => {
        this.handleDeliveryError(err, 'reject');
        this.processingItems.delete(deliveryId);
      }
    });
  }

  private handleDeliveryAccepted(deliveryId: string, response: any): void {
    this.successMessage = 'Delivery accepted successfully';
    this.assignedDeliveries = this.assignedDeliveries.filter(d => d.id !== deliveryId);
    setTimeout(() => this.router.navigate(['/delivery/missions']), 1500);
  }

  private handleDeliveryRejected(deliveryId: string): void {
    this.successMessage = 'Delivery rejected successfully';
    this.assignedDeliveries = this.assignedDeliveries.filter(d => d.id !== deliveryId);
  }

  private handleDeliveryError(err: any, action: string): void {
    this.errorMessage = `Failed to ${action} delivery. ${err.error?.message || ''}`;
    console.error(`Error ${action}ing delivery:`, err);
  }

  isProcessing(deliveryId: string): boolean {
    return this.processingItems.has(deliveryId);
  }

  // Method to handle delivery person selection (for admin use)
  selectDeliveryPerson(person: { userId: string; firstName: string; lastName: string; email?: string; } | null): void {
    this.selectedDeliveryPerson = person;
    
    // If a person is selected, load their schedule
    if (person) {
      this.loadSchedule();
    } else {
      // If person selection is cleared, load current user's schedule
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.userId) {
        this.loadSchedule();
      }
    }
  }

  refreshAssignments(): void {
    this.isLoading = true;
    this.successMessage = 'Refreshing assignments...';
    this.loadAssignedDeliveries();
  }
}