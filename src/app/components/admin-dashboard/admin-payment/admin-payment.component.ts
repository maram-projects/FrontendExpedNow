import { Component, OnInit } from '@angular/core';
import { PaymentService } from '../../../services/payment.service';
import { Payment, PaymentStatus, PaymentMethod } from '../../../models/Payment.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShortenPipe } from '../../../pipes/shorten.pipe';

@Component({
  selector: 'app-admin-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShortenPipe],
  templateUrl: './admin-payment.component.html',
  styleUrls: ['./admin-payment.component.css']
})
export class AdminPaymentComponent implements OnInit {
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];
  searchTerm: string = '';
  selectedStatus: PaymentStatus | 'ALL' = 'ALL';
  
  // Expose PaymentStatus enum for template
  PaymentStatus = PaymentStatus;
  
  constructor(private paymentService: PaymentService) {}
  
  ngOnInit(): void {
    this.loadPayments();
  }
  
  loadPayments(): void {
    this.paymentService.getAllPayments().subscribe({
      next: (payments) => {
        this.payments = payments;
        this.filteredPayments = [...payments];
      },
      error: (err) => console.error('Error loading payments:', err)
    });
  }
  
  filterPayments(): void {
    this.filteredPayments = this.payments.filter(payment => {
      const matchesSearch = payment.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           payment.clientId.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesStatus = this.selectedStatus === 'ALL' || payment.status === this.selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }
  
  refundPayment(paymentId: string): void {
    if (confirm('Are you sure you want to refund this payment?')) {
      this.paymentService.refundPayment(paymentId).subscribe({
        next: (updatedPayment) => {
          const index = this.payments.findIndex(p => p.id === paymentId);
          if (index !== -1) {
            this.payments[index] = updatedPayment;
            this.filterPayments();
          }
        },
        error: (err) => console.error('Error refunding payment:', err)
      });
    }
  }
  
  getStatusClass(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID: return 'badge bg-success';
      case PaymentStatus.PENDING: return 'badge bg-warning';
      case PaymentStatus.FAILED: return 'badge bg-danger';
      case PaymentStatus.REFUNDED: return 'badge bg-info';
      case PaymentStatus.PARTIALLY_REFUNDED: return 'badge bg-primary';
      default: return 'badge bg-secondary';
    }
  }
  
  // Add this method to get enum values as an array
  getEnumValues(enumObj: any): string[] {
    return Object.keys(enumObj).filter(key => isNaN(Number(key)));
  }
}