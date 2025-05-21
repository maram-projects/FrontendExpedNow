import { Component, OnInit } from '@angular/core';
import { DiscountService } from '../../../services/discount.service';
import { Discount } from '../../../models/discount.model';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-client-discounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-discounts.component.html',
  styleUrls: ['./client-discounts.component.css']
})
export class ClientDiscountsComponent implements OnInit {
  discounts: Discount[] = [];
  newDiscountCode: string = '';

  constructor(
    private discountService: DiscountService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadClientDiscounts();
  }

  loadClientDiscounts(): void {
    const clientId = this.authService.getCurrentUser()?.userId;
    if (clientId) {
      this.discountService.getClientDiscounts(clientId).subscribe({
        next: (discounts) => this.discounts = discounts,
        error: (err) => console.error('Error loading discounts:', err)
      });
    }
  }

  applyDiscount(): void {
    const clientId = this.authService.getCurrentUser()?.userId;
    if (clientId && this.newDiscountCode) {
      this.discountService.validateDiscount(this.newDiscountCode, clientId).subscribe({
        next: (discount) => {
          alert(`Discount ${discount.percentage}% applied successfully!`);
          this.discounts.unshift(discount);
          this.newDiscountCode = '';
        },
        error: (err) => alert('Invalid discount code: ' + err.message)
      });
    }
  }

  copyToClipboard(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      alert('Discount code copied to clipboard!');
    });
  }
}