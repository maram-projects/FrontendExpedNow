import { Component, OnInit, OnDestroy } from '@angular/core';
import { DiscountService } from '../../../services/discount.service';
import { Discount } from '../../../models/discount.model';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-client-discounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-discounts.component.html',
  styleUrls: ['./client-discounts.component.css']
})
export class ClientDiscountsComponent implements OnInit, OnDestroy {
  discounts: Discount[] = [];
  validDiscounts: Discount[] = [];
  newDiscountCode: string = '';
  loading: boolean = false;
  error: string = '';
  
  private subscription = new Subscription();

  constructor(
    private discountService: DiscountService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadClientDiscounts();
    
    // Subscribe to client discounts observable for real-time updates
    this.subscription.add(
      this.discountService.clientDiscounts$.subscribe({
        next: (discounts) => {
          this.discounts = discounts;
          this.filterValidDiscounts();
        },
        error: (err) => {
          console.error('Error in discounts subscription:', err);
          this.error = 'Failed to load discounts';
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadClientDiscounts(): void {
    const clientId = this.authService.getCurrentUser()?.userId;
    if (clientId) {
      this.loading = true;
      this.error = '';
      
      this.discountService.getClientDiscounts(clientId).subscribe({
        next: (discounts) => {
          this.discounts = discounts;
          this.filterValidDiscounts();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading discounts:', err);
          this.error = 'Failed to load discounts: ' + err.message;
          this.loading = false;
        }
      });
    }
  }

  applyDiscount(): void {
    const clientId = this.authService.getCurrentUser()?.userId;
    if (!clientId || !this.newDiscountCode.trim()) {
      return;
    }

    this.loading = true;
    this.error = '';
    
    this.discountService.validateDiscount(this.newDiscountCode.trim(), clientId).subscribe({
      next: (discount) => {
        // Format the success message using the service's formatting method
        const discountValue = this.discountService.formatDiscountValue(discount);
        alert(`Discount ${discountValue} applied successfully!`);
        
        // Refresh the discounts list
        this.loadClientDiscounts();
        this.newDiscountCode = '';
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  copyToClipboard(code: string | undefined): void {
    if (!code) return;
    
    navigator.clipboard.writeText(code).then(() => {
      alert('Discount code copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Discount code copied to clipboard!');
    });
  }

  /**
   * Get formatted discount value using the service method
   */
  getDiscountValue(discount: Discount): string {
    return this.discountService.formatDiscountValue(discount);
  }

  /**
   * Check if discount is valid using the service method
   */
  isDiscountValid(discount: Discount): boolean {
    return this.discountService.isDiscountValid(discount);
  }

  /**
   * Calculate discount amount for preview
   */
  calculateDiscountPreview(discount: Discount, amount: number = 100): number {
    return this.discountService.calculateDiscountAmount(discount, amount);
  }

  /**
   * Filter valid discounts
   */
  private filterValidDiscounts(): void {
    this.validDiscounts = this.discounts.filter(discount => 
      this.discountService.isDiscountValid(discount)
    );
  }

  /**
   * Get discount status text
   */
  getDiscountStatus(discount: Discount): string {
    if (discount.used) {
      return 'Used';
    }
    
    if (!this.isDiscountValid(discount)) {
      const now = new Date();
      const validUntil = discount.validUntil ? new Date(discount.validUntil) : null;
      const validFrom = discount.validFrom ? new Date(discount.validFrom) : null;
      
      if (validFrom && now < validFrom) {
        return 'Not yet active';
      }
      if (validUntil && now > validUntil) {
        return 'Expired';
      }
    }
    
    return 'Active';
  }

  /**
   * Get badge class based on discount status
   */
  getDiscountBadgeClass(discount: Discount): string {
    const status = this.getDiscountStatus(discount);
    switch (status) {
      case 'Active':
        return 'bg-success';
      case 'Used':
        return 'bg-secondary';
      case 'Expired':
        return 'bg-danger';
      case 'Not yet active':
        return 'bg-warning';
      default:
        return 'bg-primary';
    }
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.error = '';
  }
}