// admin-discount.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { DiscountService } from '../../../services/discount.service';
import { Discount, DiscountType, CreateDiscountRequest } from '../../../models/discount.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShortenPipe } from '../../../pipes/shorten.pipe';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-discount',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShortenPipe],
  templateUrl: './admin-discount.component.html',
  styleUrls: ['./admin-discount.component.css']
})
export class AdminDiscountComponent implements OnInit, OnDestroy {
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

  // Enum reference for template
  protected discountTypeEnum = DiscountType;

  constructor(private discountService: DiscountService) {}

  ngOnInit(): void {
    this.loadDiscounts();
    this.subscribeToDiscounts();
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

    this.loading = true;

    // Prepare the request
    const discountRequest: CreateDiscountRequest = {
      ...this.newDiscount,
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
        // The discounts list will be updated automatically via the subscription
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
          // The discounts list will be updated automatically via the subscription
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
    switch (type) {
      case DiscountType.LOYALTY: 
        return 'badge bg-primary';
      case DiscountType.PROMOTIONAL: 
        return 'badge bg-success';
      case DiscountType.PERCENTAGE: 
        return 'badge bg-info';
      case DiscountType.FIXED_AMOUNT: 
        return 'badge bg-warning';
      default: 
        return 'badge bg-dark';
    }
  }

  getDiscountValue(discount: Discount): string {
    return this.discountService.formatDiscountValue(discount);
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

    // Validate percentage or fixed amount based on type
    if (this.newDiscount.type === DiscountType.PERCENTAGE || 
        this.newDiscount.type === DiscountType.LOYALTY || 
        this.newDiscount.type === DiscountType.PROMOTIONAL) {
      if (!this.newDiscount.percentage || this.newDiscount.percentage <= 0 || this.newDiscount.percentage > 100) {
        this.errorMessage = 'Percentage must be between 1 and 100';
        return false;
      }
    }

    if (this.newDiscount.type === DiscountType.FIXED_AMOUNT) {
      if (!this.newDiscount.fixedAmount || this.newDiscount.fixedAmount <= 0) {
        this.errorMessage = 'Fixed amount must be greater than 0';
        return false;
      }
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

  private resetForm(): void {
    this.newDiscount = {
      type: DiscountType.PROMOTIONAL,
      percentage: 10,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      description: ''
    };
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // Handle date input conversion
  parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  // Utility method to format date for datetime-local input
  formatDateForInput(date: Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  }

  // Handle discount type change to show/hide relevant fields
  onDiscountTypeChange(): void {
    // Reset values when type changes
    if (this.newDiscount.type === DiscountType.FIXED_AMOUNT) {
      this.newDiscount.percentage = undefined;
      this.newDiscount.fixedAmount = 0;
    } else {
      this.newDiscount.fixedAmount = undefined;
      this.newDiscount.percentage = 10;
    }
  }

  // Check if percentage field should be shown
  shouldShowPercentage(): boolean {
    return this.newDiscount.type === DiscountType.PERCENTAGE ||
           this.newDiscount.type === DiscountType.LOYALTY ||
           this.newDiscount.type === DiscountType.PROMOTIONAL;
  }

  // Check if fixed amount field should be shown
  shouldShowFixedAmount(): boolean {
    return this.newDiscount.type === DiscountType.FIXED_AMOUNT;
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
}