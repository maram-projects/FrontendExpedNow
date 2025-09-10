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
import { PaymentService } from '../../../services/payment.service';
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
import { Payment} from '../../../models/Payment.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaymentStatus } from '../../../models/Payment.model';
import { ShortenPipe } from '../../../pipes/shorten.pipe';
import { DetailedRatingResponse } from '../../../services/delivery-service.service';
import { MatDialog } from '@angular/material/dialog';

import { 
  PaymentListResponse 
} from '../../../services/payment.service';
import { RatingDetailsModalComponent } from '../../client/rating-details-modal/rating-details-modal.component';
import { HttpErrorResponse } from '@angular/common/http';

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
      ShortenPipe,
  ],
  templateUrl: './delivery-dashboard.component.html',
  styleUrls: ['./delivery-dashboard.component.css']
})
export class DeliveryDashboardComponent implements OnInit {
totalReleasedPaymentsAmount: number = 0;
isCurrentSection(section: 'pending' | 'history' | 'bonuses' | 'overview' | 'payments' | 'ratings'): boolean {    return this.currentSection === section as any;
  }

  isPaymentLoading: boolean = false;
paymentFilter: string = 'ALL';
paymentSortBy: string = 'date-desc';
filteredPayments: Payment[] = [];
    receivedPayments: Payment[] = [];

  assignedDeliveries: DeliveryRequest[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
  processingItems: Set<string> = new Set<string>();

  bonusSortBy: string = 'date-desc';
dateFilter: string = 'all';

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
currentSection: 'pending' | 'history' | 'bonuses' | 'overview' | 'payments' | 'ratings' = 'overview';  // View mode for pending deliveries
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



  // Add ratings-related properties
  myRatings: DetailedRatingResponse[] = [];
  filteredRatings: DetailedRatingResponse[] = [];
  isRatingsLoading = false;
  ratingsError = '';
  ratingsFilter: 'all' | '5' | '4' | '3' | '2' | '1' = 'all';
  ratingsSortBy: 'date-desc' | 'date-asc' | 'rating-desc' | 'rating-asc' = 'date-desc';

  // Rating statistics
  ratingsStats = {
    totalRatings: 0,
    averageRating: 0,
    fiveStarCount: 0,
    fourStarCount: 0,
    threeStarCount: 0,
    twoStarCount: 0,
    oneStarCount: 0,
    ratingsThisMonth: 0,
    averageThisMonth: 0
  };


  constructor(
    public deliveryService: DeliveryService,
    private router: Router,
    public authService: AuthService,
    private availabilityService: AvailabilityService,
    private bonusService: BonusService,
    private dialog: MatDialog,
      private paymentService: PaymentService ,// Add this line,
        private snackBar: MatSnackBar // Add this


  ) {}

ngOnInit(): void {
  this.loadInitialData();
  this.loadReceivedPayments(); // Add this
  
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
    this.loadReceivedPayments();
    
    // Load bonuses first, then summary
    this.loadMyBonuses().then(() => {
      this.loadBonusSummary();
    });

    // Load ratings
    this.loadMyRatings();
  }

   calculateRatingsStats(): void {
    const ratings = this.myRatings;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Basic stats
    this.ratingsStats.totalRatings = ratings.length;
    
    if (ratings.length === 0) {
      this.ratingsStats.averageRating = 0;
      return;
    }

    // Calculate average rating
    const totalRating = ratings.reduce((sum, r) => sum + (r.overallRating || 0), 0);
    this.ratingsStats.averageRating = Math.round((totalRating / ratings.length) * 10) / 10;

    // Count by star rating
    this.ratingsStats.fiveStarCount = ratings.filter(r => Math.round(r.overallRating) === 5).length;
    this.ratingsStats.fourStarCount = ratings.filter(r => Math.round(r.overallRating) === 4).length;
    this.ratingsStats.threeStarCount = ratings.filter(r => Math.round(r.overallRating) === 3).length;
    this.ratingsStats.twoStarCount = ratings.filter(r => Math.round(r.overallRating) === 2).length;
    this.ratingsStats.oneStarCount = ratings.filter(r => Math.round(r.overallRating) === 1).length;

    // This month stats
    const thisMonthRatings = ratings.filter(r => {
      if (!r.ratedAt) return false;
      const ratingDate = new Date(r.ratedAt);
      return ratingDate.getMonth() === currentMonth && 
             ratingDate.getFullYear() === currentYear;
    });

    this.ratingsStats.ratingsThisMonth = thisMonthRatings.length;
    
    if (thisMonthRatings.length > 0) {
      const monthlyTotal = thisMonthRatings.reduce((sum, r) => sum + (r.overallRating || 0), 0);
      this.ratingsStats.averageThisMonth = Math.round((monthlyTotal / thisMonthRatings.length) * 10) / 10;
    } else {
      this.ratingsStats.averageThisMonth = 0;
    }
  }
  applyRatingsFilter(): void {
    if (this.ratingsFilter === 'all') {
      this.filteredRatings = [...this.myRatings];
    } else {
      const targetRating = parseInt(this.ratingsFilter);
      this.filteredRatings = this.myRatings.filter(r => 
        Math.round(r.overallRating) === targetRating
      );
    }
    this.sortRatings();
  }

  sortRatings(): void {
    const [field, direction] = this.ratingsSortBy.split('-');
    
    this.filteredRatings.sort((a, b) => {
      let valueA: any, valueB: any;
      
      if (field === 'date') {
        valueA = a.ratedAt ? new Date(a.ratedAt).getTime() : 0;
        valueB = b.ratedAt ? new Date(b.ratedAt).getTime() : 0;
      } else if (field === 'rating') {
        valueA = a.overallRating || 0;
        valueB = b.overallRating || 0;
      } else {
        return 0;
      }
      
      return direction === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }

  onRatingsFilterChange(): void {
    this.applyRatingsFilter();
  }

  onRatingsSortChange(): void {
    this.sortRatings();
  }

  viewRatingDetails(rating: DetailedRatingResponse): void {
    const dialogRef = this.dialog.open(RatingDetailsModalComponent, {
      width: '650px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: false,
      data: { 
        ratingData: rating 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Rating details modal closed:', result);
      }
    });
  }

  refreshRatings(): void {
    this.loadMyRatings();
  }

  getRatingStarArray(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }

  getRatingPercentage(starCount: number): number {
    if (this.ratingsStats.totalRatings === 0) return 0;
    
    let count = 0;
    switch (starCount) {
      case 5: count = this.ratingsStats.fiveStarCount; break;
      case 4: count = this.ratingsStats.fourStarCount; break;
      case 3: count = this.ratingsStats.threeStarCount; break;
      case 2: count = this.ratingsStats.twoStarCount; break;
      case 1: count = this.ratingsStats.oneStarCount; break;
    }
    
    return Math.round((count / this.ratingsStats.totalRatings) * 100);
  }

  getPositiveRatingsPercentage(): number {
    if (this.ratingsStats.totalRatings === 0) return 0;
    const positiveRatings = this.ratingsStats.fiveStarCount + this.ratingsStats.fourStarCount;
    return Math.round((positiveRatings / this.ratingsStats.totalRatings) * 100);
  }

  formatRatingDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Date invalide';
    }
  }

  getRatingCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'punctuality': 'Ponctualité',
      'professionalism': 'Professionnalisme',
      'package_condition': 'État du Colis',
      'communication': 'Communication'
    };
    return labels[category] || category;
  }

  trackByRatingId(index: number, rating: DetailedRatingResponse): string {
    return rating.id;
  }

  exportRatings(): void {
    // Implement export logic for ratings
    console.log('Exporting ratings data...');
    // You can add CSV export or PDF generation here
  }


  loadMyRatings(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.userId) return;

    this.isRatingsLoading = true;
    this.ratingsError = '';

    this.deliveryService.getDeliveryPersonRatings(currentUser.userId).subscribe({
      next: (ratings: DetailedRatingResponse[]) => {
        console.log('Loaded delivery person ratings:', ratings);
        this.myRatings = ratings;
        this.calculateRatingsStats();
        this.applyRatingsFilter();
        this.isRatingsLoading = false;
      },
    error: (err: HttpErrorResponse) => {
  console.error('Error loading ratings:', err);
  this.ratingsError = 'Failed to load ratings';
  this.isRatingsLoading = false;
  this.myRatings = [];
  this.filteredRatings = [];
}
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
        createdCount: summary.createdBonuses || 0,  // Changed from pendingBonuses
        paidCount: summary.paidBonuses || 0,        // Changed from approvedBonuses
        rejectedCount: summary.rejectedBonuses || 0,
        // Update amount properties if available
        createdAmount: summary.createdAmount || 0,  // Changed from pendingAmount
        paidAmount: summary.paidAmount || 0         // Changed from approvedAmount
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
  this.totalBonusAmount = this.myBonuses.reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
  
  // Update to use CREATED status instead of PENDING/APPROVED
  this.pendingBonusAmount = this.myBonuses
    .filter(b => b.status === BonusStatus.CREATED)  // Changed from PENDING/APPROVED
    .reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
    
  this.paidBonusAmount = this.myBonuses
    .filter(b => b.status === BonusStatus.PAID)
    .reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
}


getBonusStatusClass(status: BonusStatus): string {
  switch (status) {
    case BonusStatus.CREATED: return 'status-created';    // Changed from status-pending
    case BonusStatus.PAID: return 'status-paid';          // Changed from status-approved
    case BonusStatus.REJECTED: return 'status-rejected';
    default: return 'status-unknown';
  }
}

getBonusStatusIcon(status: BonusStatus): string {
  switch (status) {
    case BonusStatus.CREATED: return 'hourglass_empty';   // Changed from PENDING
    case BonusStatus.PAID: return 'payments';             // Changed from APPROVED
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
  if (this.monthlyBonusTarget <= 0) return 0;
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
switchSection(section: 'pending' | 'history' | 'bonuses' | 'overview' | 'payments' | 'ratings'): void {    this.currentSection = section as any;
    
    if (section === 'history' && this.filteredHistory.length === 0) {
      this.loadHistory();
    } else if (section === 'bonuses' && this.myBonuses.length === 0) {
      this.loadMyBonuses();
    } else if (section === 'payments' && this.receivedPayments.length === 0) {
      this.loadReceivedPayments();
    } else if (section === 'ratings' && this.myRatings.length === 0) {
      this.loadMyRatings();
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

 viewDeliveryDetails(deliveryId: string): void {
  this.router.navigate(['/delivery/details', deliveryId]);
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
  // Handle all possible cases safely
  const time = delivery.estimatedDeliveryTime || delivery.scheduledDeliveryTime;
  
  if (!time) return null;
  
  if (time instanceof Date) {
    return time;
  } else if (typeof time === 'string') {
    return new Date(time);
  } else if (Array.isArray(time)) {
    // Handle array format [year, month, day, ...]
    return new Date(
      time[0], 
      time[1] - 1, 
      time[2], 
      time[3] || 0, 
      time[4] || 0, 
      time[5] || 0
    );
  }
  
  return null;
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



getPendingBonusCount(): number {
  // Use CREATED status instead of PENDING/APPROVED
  return this.myBonuses.filter(b => b.status === BonusStatus.CREATED).length;
}

getPaidBonusCount(): number {
  return this.myBonuses.filter(b => b.status === BonusStatus.PAID).length;
}


sortBonuses(): void {
  if (!this.bonusSortBy) return;
  
  const [field, direction] = this.bonusSortBy.split('-');
  
  this.filteredBonuses.sort((a, b) => {
    // Handle different field types safely
    let valueA: any, valueB: any;
    
    if (field === 'date') {
      valueA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      valueB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    } else if (field === 'amount') {
      valueA = a.amount || 0;
      valueB = b.amount || 0;
    } else if (field === 'status') {
      // String comparison for status
      valueA = a.status || '';
      valueB = b.status || '';
      return direction === 'desc' 
        ? valueB.localeCompare(valueA) 
        : valueA.localeCompare(valueB);
    } else {
      return 0;
    }
    
    // Numeric comparison for date and amount
    if (direction === 'desc') {
      return valueB - valueA;
    } else {
      return valueA - valueB;
    }
  });
}




getUrgentAssignments(): number {
  return this.assignedDeliveries.filter(d => this.isUrgentDelivery(d)).length;
}
 

getTodayAssignments(): number {
  const today = new Date().toDateString();
  return this.assignedDeliveries.filter(d => {
    if (!d.scheduledDate) return false;
    return new Date(d.scheduledDate).toDateString() === today;
  }).length;
}
isUrgentDelivery(delivery: DeliveryRequest): boolean {
  return delivery.priority === 'HIGH' || delivery.priority === 'URGENT';
}
 


isTodayDelivery(delivery: DeliveryRequest): boolean {
  if (!delivery.scheduledDate) return false;
  return new Date(delivery.scheduledDate).toDateString() === new Date().toDateString();
}


getRecentDeliveries(): DeliveryRequest[] {
  // Sort by actionTime descending
  return [...this.deliveryHistory]
    .sort((a, b) => {
      const aTime = a.actionTime ? new Date(a.actionTime).getTime() : 0;
      const bTime = b.actionTime ? new Date(b.actionTime).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);
}
getDirections(delivery: DeliveryRequest): void {
  // Implement directions logic here
  console.log('Getting directions for delivery:', delivery);
}
 

getCompletedDeliveriesCount(): number {
  return this.deliveryHistory.filter(d => d.status === 'COMPLETED').length;
} 

getAcceptedDeliveriesCount(): number {
  return this.deliveryHistory.filter(d => d.status === 'ACCEPTED').length;
}

getRejectedDeliveriesCount(): number {
  return this.deliveryHistory.filter(d => d.status === 'REJECTED').length;
}



getSuccessRate(): number {
  const completed = this.getCompletedDeliveriesCount();
  const total = this.deliveryHistory.length;
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}



applyDateFilter(): void {
  const now = new Date();
  let startDate: Date;
  
  switch (this.dateFilter) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      this.applyHistoryFilter();
      return;
  }
  
  this.filteredHistory = this.deliveryHistory.filter(d => {
    if (!d.actionTime) return false;
    return new Date(d.actionTime) >= startDate;
  });
}

clearHistoryFilters(): void {
  this.historyFilter = 'all';
  this.dateFilter = 'all';
  this.applyHistoryFilter();
}

exportHistory(): void {
  // Implement export logic here
  console.log('Exporting history');
}

viewOnMap(delivery: DeliveryRequest): void {
  // Implement map view logic here
  console.log('Viewing delivery on map:', delivery);
}


// Schedule related methods
refreshSchedule(): void {
  this.loadSchedule();
}


trackByDay(index: number, day: string): string {
  return day;
}

isTomorrow(day: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return day === dayNames[tomorrow.getDay()];
}

 getDayDate(day: string): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const dayIndex = days.indexOf(day);
    
    if (dayIndex === -1) return '';
    
    // Calculate date safely
    const targetDate = new Date(today);
    const diff = (dayIndex - today.getDay() + 7) % 7;
    targetDate.setDate(today.getDate() + diff);
    
    return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }



getWorkingDaysCount(): number {
  if (!this.currentSchedule) return 0;
  
  return Object.values(this.currentSchedule.weeklySchedule)
    .filter(day => day.working)
    .length;
}

getTotalWorkingHours(): number {
  if (!this.currentSchedule) return 0;
  
  return Object.values(this.currentSchedule.weeklySchedule)
    .filter(day => day.working)
    .reduce((total, day) => {
      const start = this.timeStringToMinutes(day.startTime || '');
      const end = this.timeStringToMinutes(day.endTime || '');
      return total + (end - start) / 60;
    }, 0);
}

getNextWorkingTime(): string {
  if (!this.currentSchedule) return 'Not scheduled';
  
  const now = new Date();
  const todayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][now.getDay()] as DayOfWeek;
  const todaySchedule = this.currentSchedule.weeklySchedule[todayName];
  
  // If today is a working day and current time is before end time
  if (todaySchedule?.working) {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const endTime = this.timeStringToMinutes(todaySchedule.endTime || '');
    
    if (currentTime < endTime) {
      return 'Today until ' + todaySchedule.endTime;
    }
  }
  
  // Find next working day
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  let nextDayIndex = (now.getDay() + 1) % 7;
  let daysChecked = 0;
  
  while (daysChecked < 7) {
    const dayName = days[nextDayIndex] as DayOfWeek;
    const daySchedule = this.currentSchedule.weeklySchedule[dayName];
    
    if (daySchedule?.working) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${dayNames[nextDayIndex]} at ${daySchedule.startTime}`;
    }
    
    nextDayIndex = (nextDayIndex + 1) % 7;
    daysChecked++;
  }
  
  return 'No upcoming shifts';
}
onScheduleValidation(event: any): void {
  // Handle schedule validation if needed
  console.log('Schedule validation event:', event);
}

loadDefaultSchedule(): void {
  const currentUser = this.authService.getCurrentUser();
  if (!currentUser?.userId) return;
  
  this.currentSchedule = {
    userId: currentUser.userId,
    weeklySchedule: {
      [DayOfWeek.MONDAY]: { working: true, startTime: '08:00', endTime: '17:00' },
      [DayOfWeek.TUESDAY]: { working: true, startTime: '08:00', endTime: '17:00' },
      [DayOfWeek.WEDNESDAY]: { working: true, startTime: '08:00', endTime: '17:00' },
      [DayOfWeek.THURSDAY]: { working: true, startTime: '08:00', endTime: '17:00' },
      [DayOfWeek.FRIDAY]: { working: true, startTime: '08:00', endTime: '17:00' },
      [DayOfWeek.SATURDAY]: { working: false, startTime: null, endTime: null },
      [DayOfWeek.SUNDAY]: { working: false, startTime: null, endTime: null }
    },
    monthlySchedule: {}
  };
  
  this.updateAvailabilityStatus();
}


// Add this method to your DeliveryDashboardComponent
calculateDuration(start: any, end: any): string {
  // Helper function to parse date from various formats
  const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    // If it's already a Date object
    if (dateValue instanceof Date) return dateValue;
    
    // If it's a string in array format (backend format)
    if (typeof dateValue === 'string' && dateValue.includes(',')) {
      const parts = dateValue.split(',').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], parts[6]);
    }
    
    // If it's an array (backend format)
    if (Array.isArray(dateValue)) {
      return new Date(
        dateValue[0],         // year
        dateValue[1] - 1,     // month (0-indexed)
        dateValue[2],         // day
        dateValue[3] || 0,    // hours
        dateValue[4] || 0,    // minutes
        dateValue[5] || 0,    // seconds
        dateValue[6] || 0     // milliseconds
      );
    }
    
    // Try to parse as ISO string
    try {
      const parsedDate = new Date(dateValue);
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    } catch (e) {
      return null;
    }
  };

  // Parse both dates
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  // Validate dates
  if (!startDate || !endDate) return 'N/A';
  if (startDate > endDate) return 'Invalid duration';

  // Calculate duration in milliseconds
  const durationMs = endDate.getTime() - startDate.getTime();
  
  // Calculate time components
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // Format the duration
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
  }
  
  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

openChat(deliveryId: string): void {
  this.router.navigate(['/delivery/deliveries', deliveryId, 'chat']);
}

onPaymentFilterChange(): void {
  if (this.paymentFilter === 'ALL') {
    this.filteredPayments = [...this.receivedPayments];
  } else {
    // Implement your custom filtering logic here
    this.filteredPayments = this.receivedPayments.filter(payment => 
      payment.status === this.paymentFilter
    );
  }
  this.sortPayments();
}
sortPayments(): void {
  if (!this.paymentSortBy) return;
  
  const [field, direction] = this.paymentSortBy.split('-');
  
  this.filteredPayments.sort((a, b) => {
    let valueA: any, valueB: any;
    
    if (field === 'date') {
      valueA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      valueB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    } else if (field === 'amount') {
      valueA = a.deliveryPersonShare || 0;
      valueB = b.deliveryPersonShare || 0;
    } else {
      return 0;
    }
    
    return direction === 'desc' ? valueB - valueA : valueA - valueB;
  });
}

getTotalEarnings(): number {
  return this.receivedPayments.reduce((sum, payment) => sum + (payment.deliveryPersonShare || 0), 0);
}

getMonthlyEarnings(): number {
  const now = new Date();
  return this.receivedPayments
    .filter(p => p.updatedAt && new Date(p.updatedAt).getMonth() === now.getMonth())
    .reduce((sum, p) => sum + (p.deliveryPersonShare || 0), 0);
}

getPaymentsCountThisMonth(): number {
  const now = new Date();
  return this.receivedPayments.filter(p => 
    p.updatedAt && new Date(p.updatedAt).getMonth() === now.getMonth()
  ).length;
}


getAveragePayment(): number {
  return this.receivedPayments.length 
    ? this.getTotalEarnings() / this.receivedPayments.length 
    : 0;
}

getLastPaymentAmount(): number {
  return this.receivedPayments.length 
    ? this.receivedPayments[0].deliveryPersonShare || 0 
    : 0;
}

getLastPaymentDate(): Date | null {
  if (!this.receivedPayments.length || !this.receivedPayments[0].updatedAt) {
    return null;
  }
  return new Date(this.receivedPayments[0].updatedAt);
}

// TrackBy function
trackByPaymentId(index: number, payment: Payment): string {
  return payment.id;
}
private parsePaymentDates(payment: Payment): Payment {
  return {
    ...payment,
    paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : undefined,
    deliveryDate: payment.deliveryDate ? new Date(payment.deliveryDate) : undefined,
    createdAt: payment.createdAt ? new Date(payment.createdAt) : undefined,
    updatedAt: payment.updatedAt ? new Date(payment.updatedAt) : undefined
  };
}

// Navigation
viewPaymentDetails(paymentId: string): void {
  this.router.navigate(['/delivery/payments', paymentId]);
}

downloadPaymentReceipt(paymentId: string): void {
  // Implement receipt download logic
  console.log('Downloading receipt for:', paymentId);
}

// Refresh payments
refreshPayments(): void {
  this.loadReceivedPayments();
  this.snackBar.open('Payments refreshed', 'Close', { duration: 2000 });
}
getTotalPaymentsThisMonth(): number {
  const now = new Date();
  return this.receivedPayments
    .filter(p => p.updatedAt && new Date(p.updatedAt).getMonth() === now.getMonth())
    .reduce((sum, p) => sum + (p.deliveryPersonShare || 0), 0);
}

// Dans delivery-dashboard.component.ts

// Ajoutez cette méthode pour formater le montant
formatCurrency(amount: number | undefined | null, currency: string = 'TND'): string {
  if (amount === undefined || amount === null) return `${currency} 0.00`;
  
  return new Intl.NumberFormat('en-TN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}
loadReceivedPayments(): void {
  this.isPaymentLoading = true;
  const currentUser = this.authService.getCurrentUser();
  
  if (!currentUser?.userId) {
    this.isPaymentLoading = false;
    return;
  }

  this.paymentService.getPaymentsByDeliveryPerson(currentUser.userId).subscribe({
    next: (response: PaymentListResponse) => {
      if (response.success && response.data) {
        // Add debugging to see what's happening
        console.log('Raw payments data:', response.data);
        console.log('Current user ID:', currentUser.userId);
        
        // Process the payments data to ensure proper formatting
        this.receivedPayments = response.data.map(payment =>
          this.paymentService.processPaymentData(payment)
        );
        
        console.log('Processed payments:', this.receivedPayments);
        
        // Instead of filtering by share amount, filter by status and delivery person assignment
        this.receivedPayments = this.receivedPayments.filter(payment =>
          payment.status === 'COMPLETED' && payment.deliveryPersonId === currentUser.userId
        );
        
        console.log('Filtered payments:', this.receivedPayments);
        
        this.filteredPayments = [...this.receivedPayments];
        this.calculateTotalReleasedPayments();
        
        // Sort by date descending by default
        this.paymentSortBy = 'date-desc';
        this.sortPayments();
      } else {
        console.error('Failed to load payments:', response.message);
      }
      this.isPaymentLoading = false;
    },
    error: (err: Error) => {
      console.error('Error loading payments', err);
      this.isPaymentLoading = false;
    }
  });
}

calculateTotalReleasedPayments(): void {
  this.totalReleasedPaymentsAmount = this.receivedPayments
    .filter(p => p.deliveryPersonPaid) // Use the correct property name
    .reduce((sum, payment) => sum + (payment.deliveryPersonShare || 0), 0);
}

isPaymentReleased(payment: Payment): boolean {
  return payment.deliveryPersonPaid === true;
}



// Add these methods to your DeliveryDashboardComponent class

getPaymentStatusValues(): string[] {
  return ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']; // Adjust based on your actual payment status values
}




getPaymentStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    'PENDING': 'hourglass_empty',
    'PROCESSING': 'autorenew',
    'COMPLETED': 'check_circle',
    'FAILED': 'error',
    'REFUNDED': 'assignment_return'
  };
  return icons[status] || 'help';
}

getStatusClass(status: string): string {
  const statusMap: Record<string, string> = {
    'COMPLETED': 'status-completed',
    'PENDING': 'status-pending',
    'PROCESSING': 'status-processing',
    'FAILED': 'status-failed',
    'REFUNDED': 'status-refunded',
    'PARTIALLY_REFUNDED': 'status-partially-refunded',
    'CANCELLED': 'status-cancelled'
  };
  
  return statusMap[status] || 'status-unknown';
}


get totalDisplayedAmount(): number {
  return this.filteredPayments.reduce((sum, p) => sum + (p.deliveryPersonShare || 0), 0);
}
}