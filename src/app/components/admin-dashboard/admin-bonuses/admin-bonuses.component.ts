import { Component, OnInit, OnDestroy } from '@angular/core';
import { BonusService } from '../../../services/bonus.service';
import { Bonus, BonusStatus, BonusFilter, BonusSummary } from '../../../models/bonus.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { Modal } from 'bootstrap';

interface BonusStats {
  totalBonuses: number;
  totalAmount: number;
  statusBreakdown: { [key in BonusStatus]: number };
  monthlyBreakdown: { [key: string]: number };
  deliveryPersonBreakdown: { [key: string]: number };
}

interface CreateBonusRequest {
  deliveryPersonId: string;
  amount: number;
  startDate?: string; // Made optional
  endDate?: string;   // Made optional
  type?: string;      // Made optional
  description?: string;
  criteria?: string;
  reason: string; // Keep as required
}

@Component({
  selector: 'app-admin-bonuses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-bonuses.component.html',
  styleUrls: ['./admin-bonuses.component.css']
})
export class AdminBonusesComponent implements OnInit, OnDestroy {
  deliveryPersons: any[] = [];

  // Data properties
  bonuses: Bonus[] = [];
  filteredBonuses: Bonus[] = [];
  bonusStats: BonusStats | null = null;
  bonusSummary: BonusSummary | null = null;

  // Filter and search properties
  selectedStatus: BonusStatus | 'ALL' = 'ALL';
  searchTerm: string = '';
  selectedDeliveryPerson: string = '';
  dateFilter: {
    startDate: string;
    endDate: string;
  } = {
    startDate: '',
    endDate: ''
  };

  // Pagination properties
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 0;
  totalElements: number = 0;
  hasNext: boolean = false;
  hasPrevious: boolean = false;

  // Sorting properties
  sortBy: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';

  // UI state properties
  loading: boolean = false;
  error: string = '';
  selectedBonuses: Set<string> = new Set();
  showBulkActions: boolean = false;
  creatingBonus: boolean = false;

  // Create bonus form
  newBonus: CreateBonusRequest = {
    deliveryPersonId: '',
    amount: 0,
    startDate: '',
    endDate: '',
    type: 'PERFORMANCE',
    description: '',
    criteria: '',
    reason: ''
  };

  // Enum reference for template
  BonusStatus = BonusStatus;
  
  // Math reference for template
  Math = Math;

  // Search subject for debouncing
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private bonusService: BonusService) {
    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1; // Reset to first page when searching
      this.loadBonuses();
    });
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.loadDeliveryPersons();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =============================================================================
  // TRACK BY FUNCTION FOR NGFOR
  // =============================================================================

  trackByBonusId(index: number, bonus: Bonus): string {
    return bonus.id;
  }

  // =============================================================================
  // INITIALIZATION METHODS
  // =============================================================================

  loadInitialData(): void {
    this.loadBonuses();
    this.loadBonusStats();
    this.loadBonusSummary();
  }

  // =============================================================================
  // DATA LOADING METHODS
  // =============================================================================

  loadBonuses(): void {
    this.loading = true;
    this.error = '';

    const queryParams = this.buildQueryParams();

    this.bonusService.getAllBonuses(queryParams).subscribe({
      next: (response) => {
        this.bonuses = response.data || [];
        this.applyClientSideFilters();
        
        // Update pagination info
        if (response.pagination) {
          this.currentPage = response.pagination.currentPage;
          this.totalPages = response.pagination.totalPages;
          this.totalElements = response.pagination.totalElements;
          this.hasNext = response.pagination.hasNext;
          this.hasPrevious = response.pagination.hasPrevious;
        } else {
          this.totalElements = this.filteredBonuses.length;
          this.totalPages = Math.ceil(this.totalElements / this.pageSize);
        }
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading bonuses:', err);
        this.error = err.message || 'Failed to load bonuses';
        this.loading = false;
      }
    });
  }

  loadBonusStats(): void {
    this.bonusService.getBonusStats().subscribe({
      next: (stats) => {
        this.bonusStats = stats;
      },
      error: (err) => {
        console.error('Error loading bonus stats:', err);
      }
    });
  }

  loadBonusSummary(): void {
    this.bonusService.getBonusSummary().subscribe({
      next: (summary) => {
        this.bonusSummary = summary;
      },
      error: (err) => {
        console.error('Error loading bonus summary:', err);
      }
    });
  }

  // =============================================================================
  // QUERY BUILDING AND FILTERING
  // =============================================================================

  buildQueryParams() {
    const params: any = {
      page: this.currentPage,
      size: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection
    };

    if (this.selectedStatus !== 'ALL') {
      params.status = this.selectedStatus;
    }

    if (this.selectedDeliveryPerson) {
      params.deliveryPersonId = this.selectedDeliveryPerson;
    }

    if (this.dateFilter.startDate) {
      params.startDate = this.dateFilter.startDate;
    }

    if (this.dateFilter.endDate) {
      params.endDate = this.dateFilter.endDate;
    }

    if (this.searchTerm) {
      params.search = this.searchTerm;
    }

    return params;
  }

  applyClientSideFilters(): void {
    let filtered = [...this.bonuses];

    // Apply search filter
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(bonus => 
        bonus.id.toLowerCase().includes(searchLower) ||
        bonus.deliveryPersonId.toLowerCase().includes(searchLower) ||
        bonus.description?.toLowerCase().includes(searchLower) ||
        bonus.criteria?.toLowerCase().includes(searchLower)
      );
    }

    this.filteredBonuses = filtered;
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.loadBonuses();
  }

  onDateFilterChange(): void {
    this.currentPage = 1;
    this.loadBonuses();
  }

  clearFilters(): void {
    this.selectedStatus = 'ALL';
    this.searchTerm = '';
    this.selectedDeliveryPerson = '';
    this.dateFilter = { startDate: '', endDate: '' };
    this.currentPage = 1;
    this.selectedBonuses.clear();
    this.showBulkActions = false;
    this.loadBonuses();
  }

  // =============================================================================
  // SORTING METHODS
  // =============================================================================

  sortBonuses(field: string): void {
    if (this.sortBy === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortDirection = 'desc';
    }
    this.currentPage = 1;
    this.loadBonuses();
  }

  getSortIcon(field: string): string {
    if (this.sortBy !== field) return 'fas fa-sort';
    return this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  // =============================================================================
  // PAGINATION METHODS
  // =============================================================================

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadBonuses();
    }
  }

  nextPage(): void {
    if (this.hasNext) {
      this.goToPage(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.hasPrevious) {
      this.goToPage(this.currentPage - 1);
    }
  }

  shouldShowPage(pageNumber: number): boolean {
    const current = this.currentPage;
    const total = this.totalPages;
    
    // Always show first and last page
    if (pageNumber === 1 || pageNumber === total) {
      return true;
    }
    
    // Show current page and 2 pages around it
    if (pageNumber >= current - 2 && pageNumber <= current + 2) {
      return true;
    }
    
    return false;
  }

  // =============================================================================
  // BONUS CREATION
  // =============================================================================

  createBonus(): void {
    if (this.creatingBonus) return;
    this.creatingBonus = true;
    this.error = '';

    // Validate required fields
    if (!this.newBonus.deliveryPersonId || !this.newBonus.amount || 
        !this.newBonus.reason) {
        this.error = 'Please fill all required fields';
        this.creatingBonus = false;
        return;
    }

    // Prepare payload with correct types
    const payload: CreateBonusRequest = {
      deliveryPersonId: this.newBonus.deliveryPersonId,
      amount: this.newBonus.amount,
      reason: this.newBonus.reason,
      startDate: this.newBonus.startDate ? new Date(this.newBonus.startDate).toISOString() : undefined,
      endDate: this.newBonus.endDate ? new Date(this.newBonus.endDate).toISOString() : undefined,
      type: this.newBonus.type,
      description: this.newBonus.description,
      criteria: this.newBonus.criteria
    };

    this.bonusService.createBonus(payload).subscribe({
      next: (createdBonus) => {
        this.creatingBonus = false;
        this.resetCreateBonusForm();
        this.loadBonuses();
        
        // Close modal safely
        const modalElement = document.getElementById('createBonusModal');
        if (modalElement) {
          const modal = Modal.getInstance(modalElement);
          modal?.hide();
        }
      },
      error: (err) => {
        console.error('Error creating bonus:', err);
        this.error = err.message || 'Failed to create bonus';
        this.creatingBonus = false;
      }
    });
  }

  resetCreateBonusForm(): void {
    this.newBonus = {
      deliveryPersonId: '',
      amount: 0,
      startDate: '',
      endDate: '',
      type: 'PERFORMANCE',
      description: '',
      criteria: '',
      reason: ''
    };
  }

  // =============================================================================
  // BONUS STATUS OPERATIONS - UPDATED FOR NEW ENUM
  // =============================================================================

  rejectBonus(bonusId: string): void {
    const reason = prompt('Please enter the rejection reason:');
    if (reason && reason.trim()) {
      this.bonusService.rejectBonus(bonusId, reason.trim()).subscribe({
        next: (updatedBonus) => {
          this.updateBonusInList(updatedBonus);
          this.loadBonusStats(); // Refresh stats
        },
        error: (err) => {
          console.error('Error rejecting bonus:', err);
          this.error = err.message || 'Failed to reject bonus';
        }
      });
    }
  }

  payBonus(bonusId: string): void {
    const confirmPay = confirm('Are you sure you want to mark this bonus as paid?');
    if (confirmPay) {
      this.bonusService.payBonus(bonusId).subscribe({
        next: (updatedBonus) => {
          this.updateBonusInList(updatedBonus);
          this.loadBonusStats(); // Refresh stats
        },
        error: (err) => {
          console.error('Error paying bonus:', err);
          this.error = err.message || 'Failed to pay bonus';
        }
      });
    }
  }

  cancelBonus(bonusId: string): void {
    const confirmCancel = confirm('Are you sure you want to cancel this bonus?');
    if (confirmCancel) {
      this.bonusService.cancelBonus(bonusId).subscribe({
        next: (updatedBonus) => {
          this.updateBonusInList(updatedBonus);
          this.loadBonusStats(); // Refresh stats
        },
        error: (err) => {
          console.error('Error cancelling bonus:', err);
          this.error = err.message || 'Failed to cancel bonus';
        }
      });
    }
  }

  // =============================================================================
  // BULK OPERATIONS - UPDATED FOR NEW ENUM
  // =============================================================================

  toggleBonusSelection(bonusId: string): void {
    if (this.selectedBonuses.has(bonusId)) {
      this.selectedBonuses.delete(bonusId);
    } else {
      this.selectedBonuses.add(bonusId);
    }
    this.showBulkActions = this.selectedBonuses.size > 0;
  }

  toggleAllBonuses(): void {
    if (this.selectedBonuses.size === this.filteredBonuses.length) {
      this.selectedBonuses.clear();
    } else {
      this.selectedBonuses.clear();
      this.filteredBonuses.forEach(bonus => this.selectedBonuses.add(bonus.id));
    }
    this.showBulkActions = this.selectedBonuses.size > 0;
  }

  // REMOVED: bulkApprove() method since APPROVED status doesn't exist

  bulkPay(): void {
    const bonusIds = Array.from(this.selectedBonuses);
    if (bonusIds.length === 0) return;

    const confirmPay = confirm(`Are you sure you want to pay ${bonusIds.length} bonuses?`);
    if (confirmPay) {
      this.bonusService.bulkPayBonuses(bonusIds).subscribe({
        next: (response) => {
          console.log(`Bulk pay completed: ${response.processedCount} bonuses processed`);
          this.selectedBonuses.clear();
          this.showBulkActions = false;
          this.loadBonuses();
          this.loadBonusStats();
        },
        error: (err) => {
          console.error('Error in bulk pay:', err);
          this.error = err.message || 'Failed to bulk pay bonuses';
        }
      });
    }
  }

  bulkReject(): void {
    const bonusIds = Array.from(this.selectedBonuses);
    if (bonusIds.length === 0) return;

    const reason = prompt('Please enter the rejection reason for all selected bonuses:');
    if (reason && reason.trim()) {
      this.bonusService.bulkRejectBonuses(bonusIds, reason.trim()).subscribe({
        next: (response) => {
          console.log(`Bulk reject completed: ${response.processedCount} bonuses processed`);
          this.selectedBonuses.clear();
          this.showBulkActions = false;
          this.loadBonuses(); // Reload to get updated data
          this.loadBonusStats();
        },
        error: (err) => {
          console.error('Error in bulk reject:', err);
          this.error = err.message || 'Failed to bulk reject bonuses';
        }
      });
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  updateBonusInList(updatedBonus: Bonus): void {
    const index = this.bonuses.findIndex(b => b.id === updatedBonus.id);
    if (index !== -1) {
      this.bonuses[index] = updatedBonus;
      this.applyClientSideFilters();
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case BonusStatus.CREATED: return 'badge bg-info text-white';
      case BonusStatus.PAID: return 'badge bg-success text-white';
      case BonusStatus.REJECTED: return 'badge bg-danger text-white';
      default: return 'badge bg-secondary text-white';
    }
  }

  getCreatedBonusesCount(): number {
    return this.bonuses.filter(b => b.status === BonusStatus.CREATED).length;
  }

  getStatusText(status: string): string {
    switch (status) {
      case BonusStatus.CREATED: return 'Ready to Pay';
      case BonusStatus.PAID: return 'Paid';
      case BonusStatus.REJECTED: return 'Rejected';
      default: return 'Unknown';
    }
  }

  getEnumValues(enumObj: any): string[] {
    return Object.keys(enumObj).filter(key => isNaN(Number(key)));
  }

  // Helper method to safely get status breakdown value
  getStatusBreakdownValue(status: BonusStatus | string): number {
    if (!this.bonusStats?.statusBreakdown) return 0;
    
    // Handle string input by converting to enum
    if (typeof status === 'string') {
      // If it's a string key like 'CREATED', convert to enum value
      const enumValue = BonusStatus[status as keyof typeof BonusStatus];
      return this.bonusStats.statusBreakdown[enumValue] || 0;
    }
    
    // Handle direct enum input
    return this.bonusStats.statusBreakdown[status] || 0;
  }

  // Helper method to safely get monthly breakdown entries
  getMonthlyBreakdownEntries(): [string, number][] {
    if (!this.bonusStats?.monthlyBreakdown) return [];
    return Object.entries(this.bonusStats.monthlyBreakdown);
  }

  // =============================================================================
  // COMPUTED PROPERTIES - UPDATED FOR NEW ENUM
  // =============================================================================

  getTotalBonusesAmount(): number {
    return this.bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
  }

  // REMOVED: getPendingBonusesCount() - replaced with getCreatedBonusesCount()
  // REMOVED: getApprovedBonusesCount() - no longer needed

  getPaidBonusesCount(): number {
    return this.bonuses.filter(b => b.status === BonusStatus.PAID).length;
  }

  getRejectedBonusesCount(): number {
    return this.bonuses.filter(b => b.status === BonusStatus.REJECTED).length;
  }

  getFilteredTotalAmount(): number {
    return this.filteredBonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
  }

  isAllSelected(): boolean {
    return this.filteredBonuses.length > 0 && this.selectedBonuses.size === this.filteredBonuses.length;
  }

  isBonusSelected(bonusId: string): boolean {
    return this.selectedBonuses.has(bonusId);
  }

  // REMOVED: canApprove() method since APPROVED status doesn't exist

  canPay(bonus: Bonus): boolean {
    return bonus.status === BonusStatus.CREATED;
  }

  canReject(bonus: Bonus): boolean {
    return bonus.status === BonusStatus.CREATED;
  }

  canCancel(bonus: Bonus): boolean {
    return bonus.status !== BonusStatus.PAID && bonus.status !== BonusStatus.REJECTED;
  }

  // =============================================================================
  // EXPORT AND REFRESH METHODS
  // =============================================================================

  refreshData(): void {
    this.loadInitialData();
  }

  exportBonuses(): void {
    // Implementation for exporting bonuses data
    const csvContent = this.convertToCSV(this.filteredBonuses);
    this.downloadCSV(csvContent, 'bonuses-export.csv');
  }

  private convertToCSV(bonuses: Bonus[]): string {
    const headers = ['ID', 'Delivery Person ID', 'Amount', 'Status', 'Type', 'Description', 'Start Date', 'End Date', 'Created At'];
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    bonuses.forEach(bonus => {
      const row = [
        `"${bonus.id}"`,
        `"${bonus.deliveryPersonId}"`,
        bonus.amount,
        `"${bonus.status}"`,
        `"${bonus.type || ''}"`,
        `"${(bonus.description || '').replace(/"/g, '""')}"`,
        bonus.startDate ? new Date(bonus.startDate).toISOString().split('T')[0] : '',
        bonus.endDate ? new Date(bonus.endDate).toISOString().split('T')[0] : '',
        bonus.createdAt ? new Date(bonus.createdAt).toISOString() : ''
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  private downloadCSV(csvContent: string, fileName: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  loadDeliveryPersons(): void {
    console.log('Component: Starting to load delivery persons...');
    
    this.bonusService.getDeliveryPersons().subscribe({
      next: (persons) => {
        console.log('Component: Delivery persons received:', persons);
        this.deliveryPersons = persons;
      },
      error: (err) => {
        console.error('Component: Error loading delivery persons:', err);
        // Show a user-friendly error message
        this.error = 'Failed to load delivery persons. Please try again later.';
      }
    });
  }

  testLoadDeliveryPersons(): void {
    console.log('=== MANUAL TEST START ===');
    console.log('Current delivery persons:', this.deliveryPersons);
    this.loadDeliveryPersons();
    console.log('=== MANUAL TEST END ===');
  }

  getDeliveryPersonName(deliveryPersonId: string): string {
    if (!deliveryPersonId) return 'Unknown';
    
    const person = this.deliveryPersons.find(p => p.id === deliveryPersonId);
    
    if (person) {
      return person.fullName || person.firstName || person.email || person.id;
    }
    
    // Return shortened ID if person not found
    return deliveryPersonId.length > 8 ? 
      deliveryPersonId.substring(0, 8) + '...' : deliveryPersonId;
  }
}