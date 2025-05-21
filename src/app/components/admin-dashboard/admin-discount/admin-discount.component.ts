import { Component, OnInit } from '@angular/core';
import { DiscountService } from '../../../services/discount.service';
import { Discount, DiscountType } from '../../../models/discount.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShortenPipe } from '../../../pipes/shorten.pipe';

@Component({
  selector: 'app-admin-discount',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShortenPipe],
  templateUrl: './admin-discount.component.html',
  styleUrls: ['./admin-discount.component.css']
})
export class AdminDiscountComponent implements OnInit {
  discounts: Discount[] = [];
  today = new Date();
  errorMessage: string = '';
  showCreateForm = false;
  
  newDiscount: Partial<Discount> = {
    type: DiscountType.PROMOTIONAL,
    percentage: 10,
    validUntil: new Date(this.today.getFullYear(), this.today.getMonth() + 1, this.today.getDate()),
    description: ''
  };

  protected discountTypeEnum = DiscountType;

  constructor(private discountService: DiscountService) {}

  ngOnInit(): void {
    this.loadDiscounts();
  }

  getEnumValues(enumObj: any): string[] {
    return Object.keys(enumObj).filter(key => isNaN(Number(key)));
  }

  loadDiscounts(): void {
    this.discountService.getAllDiscounts().subscribe({
      next: (discounts) => this.discounts = discounts,
      error: (err) => console.error('Error loading discounts:', err)
    });
  }

  createDiscount(): void {
    this.errorMessage = '';
    
    // Ensure validUntil is a Date object
    if (typeof this.newDiscount.validUntil === 'string') {
      this.newDiscount.validUntil = new Date(this.newDiscount.validUntil);
    }

    this.discountService.createDiscount(this.newDiscount as Discount).subscribe({
      next: (createdDiscount) => {
        this.discounts.unshift(createdDiscount);
        this.showCreateForm = false;
        this.resetForm();
      },
      error: (err) => {
        console.error('Error creating discount:', err);
        this.errorMessage = err.error?.message || 'Failed to create discount';
      }
    });
  }

  deleteDiscount(discountId: string): void {
    if (confirm('Are you sure you want to delete this discount?')) {
      this.discountService.deleteDiscount(discountId).subscribe({
        next: () => {
          this.discounts = this.discounts.filter(d => d.id !== discountId);
        },
        error: (err) => console.error('Error deleting discount:', err)
      });
    }
  }

  getTypeClass(type: DiscountType): string {
    switch (type) {
      case DiscountType.LOYALTY: return 'badge bg-primary';
      case DiscountType.PROMOTIONAL: return 'badge bg-success';
      case DiscountType.SPECIAL_EVENT: return 'badge bg-warning';
      case DiscountType.WELCOME: return 'badge bg-info';
      case DiscountType.REFERRAL: return 'badge bg-secondary';
      default: return 'badge bg-dark';
    }
  }

  private resetForm(): void {
    this.newDiscount = {
      type: DiscountType.PROMOTIONAL,
      percentage: 10,
      validUntil: new Date(this.today.getFullYear(), this.today.getMonth() + 1, this.today.getDate()),
      description: ''
    };
  }

  // Handle date input conversion
  parseDate(dateString: string): Date {
    return new Date(dateString);
  }
}