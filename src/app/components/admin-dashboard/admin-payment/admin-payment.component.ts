// admin-payment.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';

import { PaymentService } from '../../../services/payment.service';
import { 
  Payment, 
  PaymentStatus, 
  PaymentMethod
} from '../../../models/Payment.model';
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
  providers: [DatePipe],
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
    private snackBar: MatSnackBar,
    private datePipe: DatePipe
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
      const response = await firstValueFrom(this.paymentService.getAllPaymentsSimple());
      
      if (response.success && response.data) {
        this.payments = response.data.map(payment => this.processPaymentData(payment));
        this.filteredPayments = [...this.payments];
      } else {
        this.showError('Failed to load payments');
      }
    } catch (error: any) {
      console.error('Error loading payments:', error);
      this.showError('Error loading payments: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  private processPaymentData(payment: Payment): Payment {
    return {
      ...payment,
      amount: this.safeParseNumber(payment.amount),
      finalAmountAfterDiscount: this.safeParseNumber(payment.finalAmountAfterDiscount) || this.safeParseNumber(payment.amount),
      discountAmount: this.safeParseNumber(payment.discountAmount),
      paymentDate: this.parseDate(payment.paymentDate),
      createdAt: this.parseDate(payment.createdAt),
      updatedAt: this.parseDate(payment.updatedAt),
          currency: payment.currency || 'TND', // Add default if missing

    };
  }

  private safeParseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private parseDate(date: any): Date | undefined {
    if (!date) return undefined;
    
    try {
      // If it's already a Date object
      if (date instanceof Date) {
        return isNaN(date.getTime()) ? undefined : new Date(date);
      }
      
      // If it's a string or number
      const parsedDate = new Date(date);
      return isNaN(parsedDate.getTime()) ? undefined : parsedDate;
    } catch (e) {
      console.error('Error parsing date:', e, 'Input date:', date);
      return undefined;
    }
  }

  filterPayments(): void {
    this.filteredPayments = this.payments.filter(payment => {
      const searchLower = this.searchTerm.toLowerCase();
      const matchesSearch = 
        payment.id.toLowerCase().includes(searchLower) ||
        payment.clientId.toLowerCase().includes(searchLower) ||
        (payment.deliveryId && payment.deliveryId.toLowerCase().includes(searchLower)) ||
        (payment.transactionId && payment.transactionId.toLowerCase().includes(searchLower));
      
      const matchesStatus = this.selectedStatus === 'ALL' || payment.status === this.selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }

  async refundPayment(payment: Payment): Promise<void> {
    if (!confirm('Are you sure you want to refund this payment?')) {
        return;
    }

    this.isLoading = true;
    
    try {
        // Use payment.currency with fallback to 'TND'
        const currency = payment.currency || 'TND';
        
        const response = await firstValueFrom(
            this.paymentService.refundPayment(
                payment.id, 
                payment.finalAmountAfterDiscount,
                currency  // Pass currency
            )
        );
        
        if (response.success && response.data) {
            const index = this.payments.findIndex(p => p.id === payment.id);
            if (index !== -1) {
                this.payments[index] = this.processPaymentData(response.data);
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
          this.payments[index] = this.processPaymentData(response.data);
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
          this.payments[index] = this.processPaymentData(response.data);
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

  async releaseToDeliveryPerson(paymentId: string): Promise<void> {
    if (!confirm('Are you sure you want to release payment to delivery person?')) {
      return;
    }

    this.isLoading = true;
    
    try {
      const response = await firstValueFrom(
        this.paymentService.releaseToDeliveryPerson(paymentId)
      );
      
      if (response.success) {
        this.showSuccess('Payment released to delivery person successfully');
        this.loadPayments(); // Refresh the list
      } else {
        throw new Error(response.message || 'Release failed');
      }
    } catch (error: any) {
      console.error('Error releasing payment:', error);
      this.showError('Failed to release payment: ' + error.message);
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

  getStatusClass(status: PaymentStatus | string): string {
    const paymentStatus = status as PaymentStatus;
    switch (paymentStatus) {
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

  getPaymentMethodIcon(method: PaymentMethod | string): string {
    const paymentMethod = method as PaymentMethod;
    switch (paymentMethod) {
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
    return this.payments.reduce((total, payment) => 
      total + (payment.finalAmountAfterDiscount || 0), 0
    );
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
        payment.deliveryId || '',
        (payment.amount || 0).toString(),
        (payment.finalAmountAfterDiscount || 0).toString(),
        payment.method,
        payment.status,
        payment.paymentDate ? this.formatDate(payment.paymentDate) : '',
        payment.transactionId || '',
        payment.cardLast4 || '',
        payment.cardBrand || '',
        payment.discountCode || '',
        (payment.discountAmount || 0).toString()
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

  canReleaseToDelivery(payment: Payment): boolean {
    return payment.status === PaymentStatus.COMPLETED && 
           !payment.deliveryPersonPaid && 
           !!payment.deliveryPersonId;
  }

 formatCurrency(amount: number | undefined | null, currency: string = 'TND'): string {
  if (amount === undefined || amount === null) return `${currency} 0.00`;
  
  return new Intl.NumberFormat('en-TN', {
    style: 'currency',
    currency: currency
  }).format(amount);
}
  formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    
    try {
      const dateObj = this.parseDate(date);
      if (!dateObj) return 'N/A';
      
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  }

  formatDateOnly(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    
    try {
      const dateObj = this.parseDate(date);
      if (!dateObj) return 'N/A';
      
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  }

  formatTimeOnly(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    
    try {
      const dateObj = this.parseDate(date);
      if (!dateObj) return 'N/A';
      
      return dateObj.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'N/A';
    }
  }

  isValidDate(date: Date | string | null | undefined): boolean {
    if (!date) return false;
    
    try {
      const dateObj = this.parseDate(date);
      return dateObj !== null && dateObj !== undefined;
    } catch (error) {
      return false;
    }
  }

  getFilteredTotalAmount(): number {
  return this.filteredPayments.reduce((sum, payment) => 
    sum + (payment.finalAmountAfterDiscount || 0), 0
  );
}

 formatConvertedAmount(payment: Payment): string {
    if (payment.convertedAmount && payment.convertedCurrency) {
      return this.paymentService.formatCurrency(
        payment.convertedAmount, 
        payment.convertedCurrency
      );
    }
    return 'N/A';
  }

}