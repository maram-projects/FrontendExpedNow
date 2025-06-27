import { Component, OnInit } from '@angular/core';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AvailabilityService } from '../../../services/availability.service';
import { BonusService } from '../../../services/bonus.service';
import { AvailabilitySchedule, DayOfWeek, DaySchedule } from '../../../models/availability.model';
import { Bonus, BonusStatus, BonusSummary } from '../../../models/bonus.model';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { User } from '../../../models/user.model';
import { ScheduleComponent } from '../../admin-dashboard/schedule/schedule.component';

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
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatMenuModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressBarModule,
    ScheduleComponent,
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

  // Metrics
  completedDeliveriesCount: number = 0;
  availabilityStatus: string = 'Available';
  
  // Schedule
  currentSchedule: AvailabilitySchedule | null = null;
  isScheduleLoading = false;
  scheduleError = '';
  
  // Delivery person selection
  selectedDeliveryPerson: User | null = null;
  
  // Section management - إضافة bonus للأقسام
  currentSection: 'pending' | 'history' | 'bonuses' | 'overview' = 'overview';
  
  // View mode for pending deliveries
  viewMode: 'cards' | 'table' = 'cards';
  
  // Availability panel
  showAvailabilityPanel = false;

  // History section
  deliveryHistory: DeliveryRequest[] = [];
  isHistoryLoading = false;
  historyFilter: string = 'all';
  filteredHistory: DeliveryRequest[] = [];
  
  selectedTabIndex = 0;

  // Bonus-related properties
  myBonuses: Bonus[] = [];
  bonusSummary: BonusSummary | null = null;
  isBonusLoading = false;
  bonusError = '';
  bonusFilter: BonusStatus | 'ALL' = 'ALL';
  filteredBonuses: Bonus[] = [];
  
  // Bonus stats
  totalBonusAmount = 0;
  pendingBonusAmount = 0;
  paidBonusAmount = 0;
  monthlyBonusTarget = 5000; // يمكن جعله قابل للتخصيص
  
  // Enum references
  BonusStatus = BonusStatus;

  constructor(
    public deliveryService: DeliveryService,
    private router: Router,
    public authService: AuthService,
    private availabilityService: AvailabilityService,
    private bonusService: BonusService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
    
    // Auto-show schedule panel for delivery personnel
    if (!this.authService.isAdmin()) {
      this.showAvailabilityPanel = true;
    }
  }

 loadInitialData(): void {
  this.loadAssignedDeliveries();
  this.loadSchedule();
  this.loadHistory();
  this.loadMetrics();
  
  // Load bonuses first, then summary
  this.loadMyBonuses().then(() => {
    this.loadBonusSummary();
  });
}


  // =============================================================================
  // BONUS METHODS
  // =============================================================================

loadMyBonuses(): Promise<void> {
  const currentUser = this.authService.getCurrentUser();
  if (!currentUser?.userId) return Promise.resolve();

  this.isBonusLoading = true;
  this.bonusError = '';
  
  return new Promise((resolve, reject) => {
    this.bonusService.getDeliveryPersonBonuses(currentUser.userId).subscribe({
      next: (bonuses: Bonus[]) => {
        this.myBonuses = bonuses;
        this.applyBonusFilter();
        this.calculateBonusStats();
        this.isBonusLoading = false;
        resolve();
      },
      error: (err) => {
        console.error('Error loading bonuses:', err);
        this.bonusError = 'Failed to load bonuses';
        this.isBonusLoading = false;
        reject(err);
      }
    });
  });
}
loadBonusSummary(): void {
  const currentUser = this.authService.getCurrentUser();
  if (!currentUser?.userId) return;
  
  this.bonusService.getDeliveryPersonBonusSummary(currentUser.userId).subscribe({
    next: (summary) => {
      this.bonusSummary = {
        totalBonuses: summary.totalBonuses || 0,
        totalAmount: summary.totalEarnings || 0,
        pendingCount: summary.pendingBonuses || 0,
        approvedCount: summary.approvedBonuses || 0,
        paidCount: summary.paidBonuses || 0,
        rejectedCount: summary.rejectedBonuses || 0,
        // Add the missing amount properties
        pendingAmount: summary.pendingAmount || 0,
        approvedAmount: summary.approvedAmount || 0,
        paidAmount: summary.paidAmount || 0
      };
    },
    error: (err) => {
      console.error('Error loading bonus summary:', err);
    }
  });
}

  applyBonusFilter(): void {
    if (this.bonusFilter === 'ALL') {
      this.filteredBonuses = [...this.myBonuses];
    } else {
      this.filteredBonuses = this.myBonuses.filter(bonus => bonus.status === this.bonusFilter);
    }
  }

  onBonusFilterChange(): void {
    this.applyBonusFilter();
  }

  calculateBonusStats(): void {
    this.totalBonusAmount = this.myBonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
    this.pendingBonusAmount = this.myBonuses
      .filter(b => b.status === BonusStatus.PENDING || b.status === BonusStatus.APPROVED)
      .reduce((sum, bonus) => sum + bonus.amount, 0);
    this.paidBonusAmount = this.myBonuses
      .filter(b => b.status === BonusStatus.PAID)
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  }

  getBonusStatusClass(status: BonusStatus): string {
    switch (status) {
      case BonusStatus.PENDING: return 'status-pending';
      case BonusStatus.APPROVED: return 'status-approved';
      case BonusStatus.PAID: return 'status-paid';
      case BonusStatus.REJECTED: return 'status-rejected';
      default: return 'status-unknown';
    }
  }

  getBonusStatusIcon(status: BonusStatus): string {
    switch (status) {
      case BonusStatus.PENDING: return 'hourglass_empty';
      case BonusStatus.APPROVED: return 'check_circle';
      case BonusStatus.PAID: return 'payments';
      case BonusStatus.REJECTED: return 'cancel';
      default: return 'help';
    }
  }

  getBonusTypeIcon(type: string): string {
    switch (type) {
      case 'PERFORMANCE': return 'trending_up';
      case 'COMPLETION': return 'done_all';
      case 'QUALITY': return 'star';
      case 'PUNCTUALITY': return 'schedule';
      case 'CUSTOMER_SATISFACTION': return 'sentiment_satisfied';
      default: return 'card_giftcard';
    }
  }

  getProgressPercentage(): number {
    if (this.monthlyBonusTarget === 0) return 0;
    return Math.min((this.paidBonusAmount / this.monthlyBonusTarget) * 100, 100);
  }

  refreshBonuses(): void {
    this.loadMyBonuses();
    this.loadBonusSummary();
  }

  // =============================================================================
  // EXISTING METHODS (unchanged)
  // =============================================================================

  navigateToAvailability(): void {
    this.router.navigate(['/delivery/availability']);
  }

  loadMetrics(): void {
    // Load completed deliveries count for today
    this.deliveryService.getTodayCompletedDeliveries().subscribe({
      next: (count: number) => {
        this.completedDeliveriesCount = count;
      },
      error: (err: any) => {
        console.error('Error loading completed deliveries count:', err);
        this.completedDeliveriesCount = 0;
      }
    });

    // Update availability status based on schedule
    this.updateAvailabilityStatus();
  }

  updateAvailabilityStatus(): void {
    if (!this.currentSchedule) {
      this.availabilityStatus = 'Not Set';
      return;
    }

    const today = new Date();
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayName = dayNames[today.getDay()] as DayOfWeek;
    
    const todaySchedule = this.currentSchedule.weeklySchedule[todayName];
    
    if (todaySchedule && todaySchedule.working) {
      const currentTime = today.getHours() * 60 + today.getMinutes();
      const startTime = this.timeStringToMinutes(todaySchedule.startTime || '');
      const endTime = this.timeStringToMinutes(todaySchedule.endTime || '');
      
      if (currentTime >= startTime && currentTime <= endTime) {
        this.availabilityStatus = 'Available';
      } else {
        this.availabilityStatus = 'Off Hours';
      }
    } else {
      this.availabilityStatus = 'Unavailable';
    }
  }

  private timeStringToMinutes(timeString: string): number {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  clearErrorMessage(): void {
    this.errorMessage = '';
    this.bonusError = '';
  }

  clearSuccessMessage(): void {
    this.successMessage = '';
  }

  switchSection(section: 'pending' | 'history' | 'bonuses' | 'overview'): void {
    this.currentSection = section;
    
    if (section === 'history' && this.filteredHistory.length === 0) {
      this.loadHistory();
    } else if (section === 'bonuses' && this.myBonuses.length === 0) {
      this.loadMyBonuses();
    }
  }

  loadHistory(): void {
    this.isHistoryLoading = true;
    this.deliveryService.getDeliveryHistory().subscribe({
      next: (history) => {
        this.deliveryHistory = history;
        this.applyHistoryFilter();
        this.isHistoryLoading = false;
      },
      error: (err) => {
        console.error('Error loading delivery history:', err);
        this.deliveryHistory = [];
        this.filteredHistory = [];
        this.isHistoryLoading = false;
      }
    });
  }

  refreshHistory(): void {
    this.loadHistory();
  }

  applyHistoryFilter(): void {
    if (this.historyFilter === 'all') {
      this.filteredHistory = [...this.deliveryHistory];
    } else {
      this.filteredHistory = this.deliveryHistory.filter(d => d.status === this.historyFilter);
    }
  }

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
    const userId = this.selectedDeliveryPerson?.id || currentUser?.userId;
    
    if (!userId) return;

    this.isScheduleLoading = true;
    this.scheduleError = '';
    
    this.availabilityService.getSchedule(userId).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.currentSchedule = response.schedule || response.data;
          this.updateAvailabilityStatus();
        } else {
          this.scheduleError = response.message || 'Failed to load schedule';
        }
        this.isScheduleLoading = false;
      },
      error: (err) => {
        this.scheduleError = 'Error retrieving schedule';
        this.isScheduleLoading = false;
        console.error('Error loading schedule:', err);
      }
    });
  }

  initializeNewSchedule(): void {
    const userId = this.selectedDeliveryPerson?.id || this.authService.getCurrentUser()?.userId;
    if (!userId) {
      this.scheduleError = 'User not authenticated';
      return;
    }
    
    this.currentSchedule = this.initializeEmptySchedule(userId);
  }

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
    
    // Ensure we have a valid user ID
    const targetUserId = (this.authService.isAdmin() && this.selectedDeliveryPerson) 
      ? this.selectedDeliveryPerson.id
      : currentUser.userId;

    if (!targetUserId) {
      this.scheduleError = 'No valid user ID found';
      this.isScheduleLoading = false;
      return;
    }
    
    updatedSchedule.userId = targetUserId;

    this.availabilityService.saveSchedule(updatedSchedule).subscribe({
      next: (response) => {
        if (response.success) {
          this.currentSchedule = updatedSchedule;
          this.updateAvailabilityStatus();
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
    this.loadMetrics();
    setTimeout(() => this.router.navigate(['/delivery/missions']), 1500);
  }

  private handleDeliveryRejected(deliveryId: string): void {
    this.successMessage = 'Delivery rejected successfully';
    this.assignedDeliveries = this.assignedDeliveries.filter(d => d.id !== deliveryId);
    this.loadHistory();
  }

  private handleDeliveryError(err: any, action: string): void {
    this.errorMessage = `Failed to ${action} delivery. ${err.error?.message || ''}`;
    console.error(`Error ${action}ing delivery:`, err);
  }

  isProcessing(deliveryId: string): boolean {
    return this.processingItems.has(deliveryId);
  }

  selectDeliveryPerson(person: User | null): void {
    this.selectedDeliveryPerson = person;
    if (person) {
      this.loadSchedule();
    } else {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.userId) {
        this.loadSchedule();
      }
    }
  }

  refreshAssignments(): void {
    this.loadAssignedDeliveries();
    this.loadMetrics();
    this.successMessage = 'Assignments refreshed successfully';
    setTimeout(() => this.successMessage = '', 2000);
  }

  trackByDeliveryId(index: number, delivery: DeliveryRequest): string {
    return delivery.id;
  }

  trackByBonusId(index: number, bonus: Bonus): string {
    return bonus.id;
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'PENDING': 'hourglass_empty',
      'ACCEPTED': 'check_circle',
      'REJECTED': 'cancel',
      'COMPLETED': 'done_all',
      'IN_PROGRESS': 'local_shipping',
      'ASSIGNED': 'assignment_ind',
      'APPROVED': 'thumb_up',
      'IN_TRANSIT': 'local_shipping',
      'DELIVERED': 'done_all',
      'CANCELLED': 'cancel',
      'EXPIRED': 'timer_off',
      'RATED': 'star'
    };
    return icons[status] || 'help';
  }

  viewDeliveryDetails(delivery: DeliveryRequest): void {
    this.router.navigate(['/delivery/details', delivery.id]);
  }

  getSelectedDeliveryPerson(): User | null {
    return this.selectedDeliveryPerson;
  }

  getRecipientName(delivery: DeliveryRequest): string {
    if (delivery.recipient) {
      return `${delivery.recipient.firstName || ''} ${delivery.recipient.lastName || ''}`.trim();
    }
    return delivery.recipientName || 'Unknown Recipient';
  }

  getDeliveryAddress(delivery: DeliveryRequest): string {
    if (typeof delivery.deliveryAddress === 'object') {
      const addr = delivery.deliveryAddress as any;
      return `${addr.street || ''} ${addr.city || ''} ${addr.state || ''} ${addr.zipCode || ''}`.trim();
    }
    return delivery.deliveryAddress || delivery.address || 'Address not available';
  }

  getRecipientPhone(delivery: DeliveryRequest): string {
    if (delivery.recipient?.phone) {
      return delivery.recipient.phone;
    }
    return delivery.recipientPhone || 'Phone not available';
  }

  getDeliveryPriority(delivery: DeliveryRequest): string {
    return delivery.priority || 'NORMAL';
  }

  getEstimatedDeliveryTime(delivery: DeliveryRequest): Date | null {
    return delivery.estimatedDeliveryTime || delivery.scheduledDeliveryTime || null;
  }

  getDaysOfWeek(): string[] {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  }

  isWorkingDay(day: string): boolean {
    if (!this.currentSchedule) return false;
    const dayKey = day.toUpperCase() as DayOfWeek;
    return this.currentSchedule.weeklySchedule[dayKey]?.working || false;
  }

  getDayStartTime(day: string): string {
    if (!this.currentSchedule) return 'N/A';
    const dayKey = day.toUpperCase() as DayOfWeek;
    return this.currentSchedule.weeklySchedule[dayKey]?.startTime || 'N/A';
  }

  getDayEndTime(day: string): string {
    if (!this.currentSchedule) return 'N/A';
    const dayKey = day.toUpperCase() as DayOfWeek;
    return this.currentSchedule.weeklySchedule[dayKey]?.endTime || 'N/A';
  }

  isToday(day: string): boolean {
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today.getDay()];
    return day === todayName;
  }
}