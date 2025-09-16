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

  // Validate form before proceeding
  const validationError = this.validateBonusForm();
  if (validationError) {
    this.error = validationError;
    return;
  }

  this.creatingBonus = true;
  this.error = '';

  // Prepare payload
  const payload: CreateBonusRequest = {
    deliveryPersonId: this.newBonus.deliveryPersonId,
    amount: Number(this.newBonus.amount),
    reason: this.newBonus.reason.trim(),
    startDate: this.newBonus.startDate || undefined,
    endDate: this.newBonus.endDate || undefined,
    type: this.newBonus.type,
    description: this.newBonus.description?.trim() || undefined,
    criteria: this.newBonus.criteria?.trim() || undefined
  };

  this.bonusService.createBonus(payload).subscribe({
    next: (createdBonus: Bonus) => {
      this.creatingBonus = false;
      this.resetCreateBonusForm();
      this.loadBonuses();
      this.loadBonusStats(); // Refresh stats
      
      // Close modal safely
      this.closeCreateBonusModal();
      
      console.log('Bonus created successfully:', createdBonus);
    },
    error: (error: Error) => {
      this.creatingBonus = false;
      this.handleComponentError(error, 'Creating bonus');
    }
  });
}
private closeCreateBonusModal(): void {
  const modalElement = document.getElementById('createBonusModal');
  if (modalElement) {
    const modal = Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
    } else {
      // Fallback: manually trigger modal close
      const closeButton = modalElement.querySelector('[data-bs-dismiss="modal"]') as HTMLButtonElement;
      closeButton?.click();
    }
  }
}



// Form validation helper
private validateBonusForm(): string | null {
  if (!this.newBonus.deliveryPersonId) {
    return 'Please select a delivery person';
  }
  
  if (!this.newBonus.amount || this.newBonus.amount <= 0) {
    return 'Please enter a valid amount greater than 0';
  }
  
  if (!this.newBonus.reason || !this.newBonus.reason.trim()) {
    return 'Please enter a reason for this bonus';
  }
  
  // Validate date range if both dates are provided
  if (this.newBonus.startDate && this.newBonus.endDate) {
    const startDate = new Date(this.newBonus.startDate);
    const endDate = new Date(this.newBonus.endDate);
    
    if (startDate >= endDate) {
      return 'End date must be after start date';
    }
  }
  
  return null;
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
  if (!reason || !reason.trim()) {
    this.error = 'Rejection reason is required';
    return;
  }

  this.bonusService.rejectBonus(bonusId, reason.trim()).subscribe({
    next: (updatedBonus: Bonus) => {
      this.updateBonusInList(updatedBonus);
      this.loadBonusStats();
      this.error = ''; // Clear any previous errors
      console.log('Bonus rejected successfully');
    },
    error: (error: Error) => {
      this.handleComponentError(error, 'Rejecting bonus');
    }
  });
}

 payBonus(bonusId: string): void {
  const confirmPay = confirm('Are you sure you want to mark this bonus as paid?');
  if (!confirmPay) return;

  this.bonusService.payBonus(bonusId).subscribe({
    next: (updatedBonus: Bonus) => {
      this.updateBonusInList(updatedBonus);
      this.loadBonusStats();
      this.error = ''; // Clear any previous errors
      console.log('Bonus paid successfully');
    },
    error: (error: Error) => {
      this.handleComponentError(error, 'Paying bonus');
    }
  });
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
  if (bonusIds.length === 0) {
    this.error = 'No bonuses selected for bulk payment';
    return;
  }

  const confirmPay = confirm(`Are you sure you want to pay ${bonusIds.length} bonuses?`);
  if (!confirmPay) return;

  this.loading = true;
  this.error = '';

  this.bonusService.bulkPayBonuses(bonusIds).subscribe({
    next: (response: any) => {
      console.log(`Bulk pay completed: ${response.processedCount} bonuses processed`);
      this.selectedBonuses.clear();
      this.showBulkActions = false;
      this.loadBonuses();
      this.loadBonusStats();
      this.loading = false;
      
      // Show success message
      this.showSuccessMessage(`Successfully paid ${response.processedCount} bonuses`);
    },
    error: (error: Error) => {
      this.loading = false;
      this.handleComponentError(error, 'Bulk paying bonuses');
    }
  });
}

private showSuccessMessage(message: string): void {
  // You could implement a toast notification system here
  console.log('Success:', message);
  
  // Temporary success indication (you might want to implement proper toast notifications)
  const originalError = this.error;
  this.error = `✓ ${message}`;
  
  setTimeout(() => {
    if (this.error === `✓ ${message}`) {
      this.error = originalError;
    }
  }, 3000);
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
  this.loading = true;
  this.error = '';
  
  // Load all data in parallel
  Promise.all([
    this.loadBonuses(),
    this.loadBonusStats(),
    this.loadBonusSummary(),
    this.loadDeliveryPersons()
  ]).then(() => {
    this.loading = false;
    console.log('All data refreshed successfully');
  }).catch((error) => {
    this.loading = false;
    this.handleComponentError(error, 'Refreshing data');
  });
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
    next: (persons: any[]) => {
      console.log('Component: Delivery persons received:', persons);
      
      // Ensure we have a valid array
      if (Array.isArray(persons)) {
        this.deliveryPersons = persons.map(person => ({
          ...person,
          displayName: this.formatPersonDisplayName(person)
        }));
        console.log('Component: Processed delivery persons:', this.deliveryPersons);
      } else {
        console.warn('Component: Invalid delivery persons data received');
        this.deliveryPersons = [];
      }
    },
    error: (error: Error) => {
      console.error('Component: Error loading delivery persons:', error);
      this.error = 'Failed to load delivery persons. Please try again later.';
      this.deliveryPersons = []; // Ensure empty array on error
    }
  });
}

// Helper method to format person display name consistently
private formatPersonDisplayName(person: any): string {
  if (!person) return 'Unknown';
  
  // Priority order: fullName > firstName + lastName > email > id
  if (person.fullName) return person.fullName;
  if (person.firstName && person.lastName) return `${person.firstName} ${person.lastName}`;
  if (person.firstName) return person.firstName;
  if (person.email) return person.email;
  if (person.id) return person.id.length > 8 ? person.id.substring(0, 8) + '...' : person.id;
  
  return 'Unknown';
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
    return person.displayName || this.formatPersonDisplayName(person);
  }
  
  // Return shortened ID if person not found
  return deliveryPersonId.length > 8 ? 
    deliveryPersonId.substring(0, 8) + '...' : deliveryPersonId;
}

private handleComponentError(error: any, operation: string): void {
  console.error(`Error during ${operation}:`, error);
  
  // Extract meaningful error message
  let errorMessage = 'An unexpected error occurred';
  
  if (error?.message) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  this.error = `${operation}: ${errorMessage}`;
  
  // Auto-hide error after 5 seconds
  setTimeout(() => {
    if (this.error === `${operation}: ${errorMessage}`) {
      this.error = '';
    }
  }, 5000);
}

}