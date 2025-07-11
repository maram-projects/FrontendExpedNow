import { Component, OnInit, OnDestroy } from '@angular/core';
import { DiscountService } from '../../../services/discount.service';
import { Discount, DiscountType, CreateDiscountRequest } from '../../../models/discount.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShortenPipe } from '../../../pipes/shorten.pipe';
import { Subscription } from 'rxjs';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-admin-discount',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShortenPipe],
  templateUrl: './admin-discount.component.html',
  styleUrls: ['./admin-discount.component.css']
})
export class AdminDiscountComponent implements OnInit, OnDestroy {
  clients: User[] = [];
  loadingClients = false;
  selectedClientId: string | undefined;

  discounts: Discount[] = [];
  loading = false;
  errorMessage: string = '';
  successMessage: string = '';
  showCreateForm = false;
  
  private subscriptions: Subscription[] = [];

  newDiscount: CreateDiscountRequest = {
    type: DiscountType.PROMOTIONAL,
    percentage: 10,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    description: ''
  };

  // Enum reference for template - remove FIXED_AMOUNT
  protected discountTypeEnum = Object.keys(DiscountType)
    .filter(key => key !== 'FIXED_AMOUNT')
    .reduce((obj, key) => {
      obj[key] = DiscountType[key as keyof typeof DiscountType];
      return obj;
    }, {} as Record<string, DiscountType>);

  constructor(
    private discountService: DiscountService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadDiscounts();
    this.subscribeToDiscounts();
    this.loadClients();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private subscribeToDiscounts(): void {
    const subscription = this.discountService.discounts$.subscribe({
      next: (discounts) => {
        this.discounts = discounts;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error in discounts subscription:', err);
        this.errorMessage = 'Failed to load discounts';
        this.loading = false;
      }
    });
    this.subscriptions.push(subscription);
  }

  loadClients(): void {
    this.loadingClients = true;
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        // Filter to get only clients
        this.clients = users.filter(user => 
          user.roles?.includes('ROLE_CLIENT') || 
          user.roles?.includes('ROLE_INDIVIDUAL') || 
          user.roles?.includes('ROLE_ENTERPRISE')
        );
        this.loadingClients = false;
      },
      error: (err) => {
        console.error('Error loading clients:', err);
        this.errorMessage = 'Failed to load clients';
        this.loadingClients = false;
      }
    });
  }

  getEnumValues(enumObj: any): string[] {
    return Object.values(enumObj) as string[];
  }

  loadDiscounts(): void {
    this.loading = true;
    this.clearMessages();
    
    const subscription = this.discountService.getAllDiscounts().subscribe({
      next: (discounts) => {
        this.discounts = discounts;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading discounts:', err);
        this.errorMessage = 'Failed to load discounts';
        this.loading = false;
      }
    });
    this.subscriptions.push(subscription);
  }

  createDiscount(): void {
    this.clearMessages();
    
    // Validation
    if (!this.validateDiscountForm()) {
      return;
    }

    // Set client ID from selection
    this.newDiscount.clientId = this.selectedClientId === 'general' ? 
      undefined : this.selectedClientId;

    this.loading = true;

    // Prepare the request
    const discountRequest: CreateDiscountRequest = {
      ...this.newDiscount,
      // Remove fixedAmount field since we only use percentage
      fixedAmount: undefined,
      // Ensure validUntil is a Date object
      validUntil: typeof this.newDiscount.validUntil === 'string' 
        ? new Date(this.newDiscount.validUntil) 
        : this.newDiscount.validUntil,
      // Set validFrom to now if not specified
      validFrom: this.newDiscount.validFrom || new Date()
    };

    const subscription = this.discountService.createDiscount(discountRequest).subscribe({
      next: (createdDiscount) => {
        console.log('Discount created successfully:', createdDiscount);
        this.successMessage = 'Discount created successfully!';
        this.showCreateForm = false;
        this.resetForm();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error creating discount:', err);
        this.errorMessage = err.message || 'Failed to create discount';
        this.loading = false;
      }
    });
    this.subscriptions.push(subscription);
  }

  deleteDiscount(discountId: string | undefined): void {
    if (!discountId) {
      this.errorMessage = 'Invalid discount ID';
      return;
    }

    if (confirm('Are you sure you want to delete this discount?')) {
      this.loading = true;
      this.clearMessages();

      const subscription = this.discountService.deleteDiscount(discountId).subscribe({
        next: () => {
          console.log('Discount deleted successfully');
          this.successMessage = 'Discount deleted successfully!';
          this.loading = false;
        },
        error: (err) => {
          console.error('Error deleting discount:', err);
          this.errorMessage = err.message || 'Failed to delete discount';
          this.loading = false;
        }
      });
      this.subscriptions.push(subscription);
    }
  }

getTypeClass(type: DiscountType | undefined): string {
  if (!type) return 'badge bg-dark';
  
  // Map types to specific badge classes
  switch (type) {
    case DiscountType.LOYALTY: 
      return 'badge-loyalty';
    case DiscountType.PROMOTIONAL: 
      return 'badge-promotional';
    case DiscountType.PERCENTAGE: 
      return 'badge-percentage';
    default: 
      return 'badge bg-dark';
  }
}
  getDiscountValue(discount: Discount): string {
    // Always show percentage since we only have percentage discounts
    return `${discount.percentage}%`;
  }

  isDiscountExpired(discount: Discount): boolean {
    if (!discount.validUntil) return false;
    return new Date() > new Date(discount.validUntil);
  }

  isDiscountValid(discount: Discount): boolean {
    return this.discountService.isDiscountValid(discount);
  }

  private validateDiscountForm(): boolean {
    // Reset error message
    this.errorMessage = '';

    // Check required fields
    if (!this.newDiscount.type) {
      this.errorMessage = 'Discount type is required';
      return false;
    }

    if (!this.newDiscount.description?.trim()) {
      this.errorMessage = 'Description is required';
      return false;
    }

    // Validate percentage
    if (!this.newDiscount.percentage || this.newDiscount.percentage <= 0 || this.newDiscount.percentage > 100) {
      this.errorMessage = 'Percentage must be between 1 and 100';
      return false;
    }

    // Validate dates
    if (!this.newDiscount.validUntil) {
      this.errorMessage = 'Valid until date is required';
      return false;
    }

    const validUntil = new Date(this.newDiscount.validUntil);
    if (validUntil <= new Date()) {
      this.errorMessage = 'Valid until date must be in the future';
      return false;
    }

    return true;
  }
onDateChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target && target.value) {
    this.newDiscount.validUntil = new Date(target.value);
  }
}

  public resetForm(): void {
    this.newDiscount = {
      type: DiscountType.PROMOTIONAL,
      percentage: 10,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      description: ''
    };
    this.selectedClientId = undefined;
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // Handle date input conversion
 parseDate(event: Event): Date {
  const target = event.target as HTMLInputElement;
  return new Date(target.value);
}

  // Utility method to format date for datetime-local input
  formatDateForInput(date: Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  }

  // Statistics methods
  getActiveDiscountsCount(): number {
    return this.discounts.filter(d => this.isDiscountValid(d)).length;
  }

  getUsedDiscountsCount(): number {
    return this.discounts.filter(d => d.used).length;
  }

  getExpiredDiscountsCount(): number {
    return this.discounts.filter(d => this.isDiscountExpired(d) && !d.used).length;
  }

  // TrackBy function for better performance
  trackByDiscountId(index: number, discount: Discount): string {
    return discount.id || index.toString();
  }

  getClientName(clientId: string): string {
  const client = this.clients.find(c => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : '';
}
}