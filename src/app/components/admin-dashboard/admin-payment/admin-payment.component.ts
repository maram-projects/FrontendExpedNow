// admin-payment.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { firstValueFrom } from 'rxjs';

import { PaymentService } from '../../../services/payment.service';
import { 
  Payment, 
  PaymentStatus, 
  PaymentMethod} from '../../../models/Payment.model';
import { ShortenPipe } from '../../../pipes/shorten.pipe';

@Component({
  selector: 'app-admin-payment',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    ShortenPipe,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './admin-payment.component.html',
  styleUrls: ['./admin-payment.component.css'],
  animations: [
    trigger('slideInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('600ms cubic-bezier(0.35, 0, 0.25, 1)', 
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ]),
    trigger('staggerList', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateX(-20px)' }),
          stagger(50, [
            animate('400ms cubic-bezier(0.35, 0, 0.25, 1)',
              style({ opacity: 1, transform: 'translateX(0)' })
            )
          ])
        ], { optional: true })
      ])
    ]),
    trigger('fadeInScale', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('300ms cubic-bezier(0.35, 0, 0.25, 1)',
          style({ opacity: 1, transform: 'scale(1)' })
        )
      ])
    ]),
    trigger('buttonHover', [
      state('normal', style({ transform: 'scale(1)' })),
      state('hovered', style({ transform: 'scale(1.05)' })),
      transition('normal <=> hovered', animate('200ms ease-in-out'))
    ])
  ]
})
export class AdminPaymentComponent implements OnInit {
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];
  searchTerm: string = '';
  selectedStatus: PaymentStatus | 'ALL' = 'ALL';
  isLoading: boolean = false;
  
  // Expose enums for template
  PaymentStatus = PaymentStatus;
  PaymentMethod = PaymentMethod;
  
  // Animation states
  buttonStates: { [key: string]: string } = {};

  constructor(
    private paymentService: PaymentService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  // TrackBy function for better performance
  trackByPaymentId(index: number, payment: Payment): string {
    return payment.id;
  }

  async loadPayments(): Promise<void> {
    this.isLoading = true;
    
    try {
      // Use the getAllPaymentsSimple method from your service
      const response = await firstValueFrom(this.paymentService.getAllPaymentsSimple());
      
      if (response.success && response.data) {
        this.payments = response.data;
        this.filteredPayments = [...this.payments];
      } else {
        this.showError('Failed to load payments');
      }
    } catch (error: any) {
      console.error('Error loading payments:', error);
      this.showError('Error loading payments: ' + error.message);
      // Load mock data as fallback
      this.loadMockPayments();
    } finally {
      this.isLoading = false;
    }
  }

  // Mock data for demonstration - can be removed when service is fully implemented
  private loadMockPayments(): void {
    this.payments = [
      {
        id: 'pay_001',
        deliveryId: 'del_001',
        clientId: 'client_001',
        amount: 50.00,
        finalAmountAfterDiscount: 45.00,
        method: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.COMPLETED,
        transactionId: 'txn_001',
        paymentDate: new Date(),
        cardLast4: '4242',
        cardBrand: 'Visa',
        discountAmount: 5.00,
        discountCode: 'SAVE5'
      },
      {
        id: 'pay_002',
        deliveryId: 'del_002',
        clientId: 'client_002',
        amount: 30.00,
        finalAmountAfterDiscount: 30.00,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
        paymentDate: new Date()
      },
      {
        id: 'pay_003',
        deliveryId: 'del_003',
        clientId: 'client_003',
        amount: 75.00,
        finalAmountAfterDiscount: 75.00,
        method: PaymentMethod.WALLET,
        status: PaymentStatus.FAILED,
        paymentDate: new Date()
      },
      {
        id: 'pay_004',
        deliveryId: 'del_004',
        clientId: 'client_004',
        amount: 120.00,
        finalAmountAfterDiscount: 100.00,
        method: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.REFUNDED,
        transactionId: 'txn_004',
        paymentDate: new Date(Date.now() - 86400000), // Yesterday
        cardLast4: '1234',
        cardBrand: 'Mastercard',
        discountAmount: 20.00,
        discountCode: 'SAVE20'
      }
    ];
    this.filteredPayments = [...this.payments];
  }

  filterPayments(): void {
  this.filteredPayments = this.payments.filter(payment => {
    const searchLower = this.searchTerm.toLowerCase();
    const matchesSearch = 
      payment.id.toLowerCase().includes(searchLower) ||
      payment.clientId.toLowerCase().includes(searchLower) ||
      (payment.deliveryId && payment.deliveryId.toLowerCase().includes(searchLower)) || // Safe check
      (payment.transactionId && payment.transactionId.toLowerCase().includes(searchLower));
    
    const matchesStatus = this.selectedStatus === 'ALL' || payment.status === this.selectedStatus;
    return matchesSearch && matchesStatus;
  });
}

  async refundPayment(paymentId: string): Promise<void> {
    if (!confirm('Are you sure you want to refund this payment?')) {
      return;
    }

    this.isLoading = true;
    
    try {
      const response = await firstValueFrom(this.paymentService.refundPayment(paymentId));
      
      if (response.success && response.data) {
        const index = this.payments.findIndex(p => p.id === paymentId);
        if (index !== -1) {
          this.payments[index] = response.data;
          this.filterPayments();
        }
        this.showSuccess('Payment refunded successfully');
      } else {
        throw new Error(response.message || 'Refund failed');
      }
    } catch (error: any) {
      console.error('Error refunding payment:', error);
      this.showError('Failed to refund payment: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  async cancelPayment(paymentId: string): Promise<void> {
    if (!confirm('Are you sure you want to cancel this payment?')) {
      return;
    }

    this.isLoading = true;
    
    try {
      const response = await firstValueFrom(this.paymentService.cancelPayment(paymentId));
      
      if (response.success && response.data) {
        const index = this.payments.findIndex(p => p.id === paymentId);
        if (index !== -1) {
          this.payments[index] = response.data;
          this.filterPayments();
        }
        this.showSuccess('Payment cancelled successfully');
      } else {
        throw new Error(response.message || 'Cancel failed');
      }
    } catch (error: any) {
      console.error('Error cancelling payment:', error);
      this.showError('Failed to cancel payment: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  async updatePaymentStatus(paymentId: string, newStatus: PaymentStatus): Promise<void> {
    this.isLoading = true;
    
    try {
      const response = await firstValueFrom(
        this.paymentService.updatePaymentStatus(paymentId, newStatus)
      );
      
      if (response.success && response.data) {
        const index = this.payments.findIndex(p => p.id === paymentId);
        if (index !== -1) {
          this.payments[index] = response.data;
          this.filterPayments();
        }
        this.showSuccess('Payment status updated successfully');
      } else {
        throw new Error(response.message || 'Status update failed');
      }
    } catch (error: any) {
      console.error('Error updating payment status:', error);
      this.showError('Failed to update payment status: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

  getStatusClass(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.COMPLETED: return 'status-completed';
      case PaymentStatus.PENDING: return 'status-pending';
      case PaymentStatus.PROCESSING: return 'status-processing';
      case PaymentStatus.FAILED: return 'status-failed';
      case PaymentStatus.CANCELLED: return 'status-cancelled';
      case PaymentStatus.REFUNDED: return 'status-refunded';
      case PaymentStatus.PARTIALLY_REFUNDED: return 'status-partially-refunded';
      case PaymentStatus.PENDING_DELIVERY: return 'status-pending-delivery';
      case PaymentStatus.PENDING_VERIFICATION: return 'status-pending-verification';
      default: return 'status-unknown';
    }
  }

  getPaymentMethodIcon(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.CREDIT_CARD: return '💳';
      case PaymentMethod.BANK_TRANSFER: return '🏦';
      case PaymentMethod.WALLET: return '👛';
      case PaymentMethod.CASH: return '💰';
      default: return '💰';
    }
  }

  getEnumValues(enumObj: any): string[] {
    return Object.keys(enumObj).filter(key => isNaN(Number(key)));
  }

  onButtonHover(buttonId: string, isHovered: boolean): void {
    this.buttonStates[buttonId] = isHovered ? 'hovered' : 'normal';
  }

  getTotalAmount(): number {
    return this.payments.reduce((total, payment) => total + payment.finalAmountAfterDiscount, 0);
  }

  getStatusCount(status: PaymentStatus): number {
    return this.payments.filter(payment => payment.status === status).length;
  }

  getCompletedPaymentsCount(): number {
    return this.getStatusCount(PaymentStatus.COMPLETED);
  }

  getPendingPaymentsCount(): number {
    return this.getStatusCount(PaymentStatus.PENDING);
  }

  getFailedPaymentsCount(): number {
    return this.getStatusCount(PaymentStatus.FAILED);
  }

  getRefundedPaymentsCount(): number {
    return this.getStatusCount(PaymentStatus.REFUNDED);
  }

  exportPayments(): void {
    try {
      const headers = [
        'Payment ID', 
        'Client ID', 
        'Delivery ID', 
        'Amount', 
        'Final Amount', 
        'Method', 
        'Status', 
        'Date', 
        'Transaction ID',
        'Card Last 4',
        'Card Brand',
        'Discount Code',
        'Discount Amount'
      ];
      
      const csvData = this.filteredPayments.map(payment => [
        payment.id,
        payment.clientId,
        payment.deliveryId,
        payment.amount.toString(),
        payment.finalAmountAfterDiscount.toString(),
        payment.method,
        payment.status,
        payment.paymentDate ? payment.paymentDate.toISOString().split('T')[0] : '',
        payment.transactionId || '',
        payment.cardLast4 || '',
        payment.cardBrand || '',
        payment.discountCode || '',
        payment.discountAmount ? payment.discountAmount.toString() : '0'
      ]);

      const csvContent = [headers, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      this.showSuccess('Payments exported successfully');
    } catch (error: any) {
      console.error('Export error:', error);
      this.showError('Failed to export payments');
    }
  }

  refresh(): void {
    this.loadPayments();
  }

  canRefund(payment: Payment): boolean {
    return payment.status === PaymentStatus.COMPLETED;
  }

  canCancel(payment: Payment): boolean {
    return payment.status === PaymentStatus.PENDING || 
           payment.status === PaymentStatus.PROCESSING;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-TN', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}