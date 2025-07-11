// admin-payment.component.ts - Fixed version
import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PaymentService } from '../../../services/payment.service';
import { 
  Payment, 
  PaymentStatus, 
  PaymentMethod
} from '../../../models/Payment.model';
import { ShortenPipe } from '../../../pipes/shorten.pipe';

// Dialog component for release confirmation
@Component({
  template: `
    <h2 mat-dialog-title>Confirm Release</h2>
    <div mat-dialog-content>
      <p>You are about to release {{ data.amount }} to {{ data.deliveryPersonName }}.</p>
      <p>This action cannot be undone.</p>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="onNoClick()">Cancel</button>
      <button mat-button color="primary" (click)="onConfirm()" cdkFocusInitial>Confirm</button>
    </div>
  `,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule]
})
export class ReleaseConfirmationDialog {
  constructor(
    public dialogRef: MatDialogRef<ReleaseConfirmationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { deliveryPersonName: string; amount: string }
  ) {}

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

@Component({
  selector: 'app-admin-payment',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    ShortenPipe,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatButtonModule
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
    private datePipe: DatePipe,
    private dialog: MatDialog  // Add MatDialog injection
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
        this.payments = response.data.map((payment: Payment) => this.processPaymentData(payment));
        this.filteredPayments = [...this.payments];
        
        // Log analysis
        const completedPayments = this.payments.filter(p => p.status === PaymentStatus.COMPLETED);
        const releaseablePayments = completedPayments.filter(p => this.canReleaseToDelivery(p));
        
        console.log(`Loaded ${this.payments.length} payments`);
        console.log(`${completedPayments.length} completed payments`);
        console.log(`${releaseablePayments.length} payments ready for release`);
        
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

private processPaymentData(payment: any): Payment {
  // Safely parse all critical fields with fallbacks
  const processed: Payment = {
    ...payment,

    // Required fields with type safety
    id: payment.id || '',
    clientId: payment.clientId || '',
    status: (payment.status as PaymentStatus) || PaymentStatus.PENDING,
    method: (payment.method as PaymentMethod) || PaymentMethod.CREDIT_CARD,
    currency: payment.currency || 'TND',

    // Numeric fields with safe parsing
    amount: this.safeParseNumber(payment.amount),
    finalAmountAfterDiscount: this.safeParseNumber(payment.finalAmountAfterDiscount) || this.safeParseNumber(payment.amount),
    discountAmount: this.safeParseNumber(payment.discountAmount) || 0,
    deliveryPersonShare: this.safeParseNumber(payment.deliveryPersonShare) || 0,

    // Date fields with validation
    paymentDate: this.parseDate(payment.paymentDate),
    createdAt: this.parseDate(payment.createdAt),
    updatedAt: this.parseDate(payment.updatedAt),
    deliveryPersonPaidAt: this.parseDate(payment.deliveryPersonPaidAt),

    // Boolean fields with explicit checks
    deliveryPersonPaid: payment.deliveryPersonPaid === true,

    // Delivery person data with null checks
    deliveryPersonId: payment.deliveryPersonId || payment.deliveryPerson?.id || null,
    deliveryPerson: payment.deliveryPerson ? {
      id: payment.deliveryPerson.id || payment.deliveryPersonId || '',
      fullName: payment.deliveryPerson.fullName || 'Unknown Delivery Person',
      phone: payment.deliveryPerson.phone || '',
      email: payment.deliveryPerson.email || '',
      vehicle: payment.deliveryPerson.vehicle ? {
        type: payment.deliveryPerson.vehicle.type || 'CAR',
        licensePlate: payment.deliveryPerson.vehicle.licensePlate || 'N/A',
        model: payment.deliveryPerson.vehicle.model || 'Unknown'
      } : undefined
    } : null,

    // Optional fields with null checks
    transactionId: payment.transactionId || null,
    clientSecret: payment.clientSecret || null,
    discountCode: payment.discountCode || null,
    discountId: payment.discountId || null,
    invoiceUrl: payment.invoiceUrl || null,
    receiptUrl: payment.receiptUrl || null,
    cardLast4: payment.cardLast4 || null,
    cardBrand: payment.cardBrand || null,
    convertedAmount: this.safeParseNumber(payment.convertedAmount),
    exchangeRate: this.safeParseNumber(payment.exchangeRate),
    convertedCurrency: payment.convertedCurrency || null
  };

  // Debug log the processed payment
  console.debug('Processed payment data:', processed);
  return processed;
}

// Helper methods used by processPaymentData
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
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? undefined : new Date(date);
    }
    
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
      const currency = payment.currency || 'TND';
      const response = await firstValueFrom(
        this.paymentService.refundPayment(
          payment.id, 
          payment.finalAmountAfterDiscount,
          currency
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

  async markAsCompleted(paymentId: string): Promise<void> {
    this.isLoading = true;
    try {
      await firstValueFrom(
        this.paymentService.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED)
      );
      await this.loadPayments();
      this.showSuccess('Payment marked as completed');
    } catch (error: any) {
      this.showError('Failed to update status: ' + error.message);
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
  const payment = this.payments.find(p => p.id === paymentId);
  if (!payment) {
    this.showError('Payment not found');
    return;
  }

  if (!this.canReleaseToDelivery(payment)) {
    this.showError(this.getCannotReleaseReason(payment));
    return;
  }

  const deliveryPersonName = payment.deliveryPerson?.fullName || 'Unknown';
  const amount = this.formatCurrency(payment.finalAmountAfterDiscount * 0.8, payment.currency);

  const dialogRef = this.dialog.open(ReleaseConfirmationDialog, {
    data: { deliveryPersonName, amount }
  });

  const result = await firstValueFrom(dialogRef.afterClosed());
  
  if (!result) {
    return; // User cancelled
  }

  this.isLoading = true;
    
  try {
    const response = await firstValueFrom(
      this.paymentService.releaseToDeliveryPerson(paymentId)
    );
    
    if (response.success) {
      this.showSuccess(`Successfully released ${amount} to ${deliveryPersonName}`);
      await this.loadPayments();
    } else {
      throw new Error(response.message || 'Release failed');
    }
  } catch (error: any) {
    console.error('Error releasing payment:', error);
    this.showError('Failed to release payment: ' + (error.message || 'Unknown error'));
  } finally {
    this.isLoading = false;
  }
}

  // Helper methods for delivery person release
  canMarkAsCompleted(payment: Payment): boolean {
    return payment.status === PaymentStatus.PENDING || 
           payment.status === PaymentStatus.PROCESSING;
  }

 canReleaseToDelivery(payment: Payment): boolean {
  // Debug logging to help diagnose issues
  console.debug('Checking if payment can be released:', {
    paymentId: payment.id,
    status: payment.status,
    hasDeliveryPerson: !!payment.deliveryPersonId || !!payment.deliveryPerson?.id,
    notReleased: payment.deliveryPersonPaid !== true,
    validAmount: payment.finalAmountAfterDiscount > 0,
    isCompleted: payment.status === PaymentStatus.COMPLETED
  });

  // 1. Must have a delivery person assigned (check both possible fields)
  const hasDeliveryPerson = !!payment.deliveryPersonId || !!payment.deliveryPerson?.id;
  if (!hasDeliveryPerson) {
    console.debug('Cannot release - no delivery person assigned');
    return false;
  }

  // 2. Must not have been released already
  if (payment.deliveryPersonPaid === true) {
    console.debug('Cannot release - already released to delivery person');
    return false;
  }

  // 3. Must be in COMPLETED status
  if (payment.status !== PaymentStatus.COMPLETED) {
    console.debug(`Cannot release - payment status is ${payment.status} (needs COMPLETED)`);
    return false;
  }

  // 4. Must have a valid final amount
  const finalAmount = payment.finalAmountAfterDiscount || payment.amount || 0;
  if (finalAmount <= 0) {
    console.debug('Cannot release - invalid amount:', finalAmount);
    return false;
  }

  // 5. Additional safety check - must have a valid ID
  if (!payment.id) {
    console.debug('Cannot release - payment has no ID');
    return false;
  }

  // All conditions met
  return true;
}
getCannotReleaseReason(payment: Payment): string {
  if (!payment.id) return 'Invalid payment (missing ID)';
  
  if (!payment.deliveryPersonId && !payment.deliveryPerson?.id) {
    return 'No delivery person assigned';
  }
  
  if (payment.deliveryPersonPaid) {
    return 'Already released to delivery person';
  }
  
  if (payment.status !== PaymentStatus.COMPLETED) {
    return `Payment status is ${payment.status} (must be COMPLETED)`;
  }
  
  const amount = payment.finalAmountAfterDiscount || payment.amount || 0;
  if (amount <= 0) {
    return `Invalid amount: ${this.formatCurrency(amount, payment.currency)}`;
  }
  
  return 'Ready for release';
}

 getReleaseButtonText(payment: Payment): string {
  if (!this.canReleaseToDelivery(payment)) {
    return this.getCannotReleaseReason(payment).split('\n')[0];
  }
  
  const amount = payment.finalAmountAfterDiscount || payment.amount || 0;
  const share = payment.deliveryPersonShare || Math.floor(amount * 0.8);
  
  return `Release ${this.formatCurrency(share, payment.currency)}`;
}

  getDeliveryPaymentStatus(payment: Payment): string {
    const hasDeliveryPerson = payment.deliveryPersonId || payment.deliveryPerson?.id;
    
    if (!hasDeliveryPerson) {
      return 'No delivery person assigned';
    }
    
    if (payment.deliveryPersonPaid) {
      return 'Payment released to delivery person';
    }
    
    if (payment.status === PaymentStatus.COMPLETED) {
      return 'Ready for release';
    }
    
    return 'Payment not completed yet';
  }

  getTotalPendingReleaseAmount(): number {
    return this.payments
      .filter(p => this.canReleaseToDelivery(p))
      .reduce((total, payment) => total + (payment.finalAmountAfterDiscount || 0), 0);
  }

  getPendingReleaseCount(): number {
    return this.payments.filter(p => this.canReleaseToDelivery(p)).length;
  }

  // Utility methods
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
        'Discount Amount',
        'Delivery Person',
        'Delivery Person Paid'
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
        (payment.discountAmount || 0).toString(),
        payment.deliveryPerson?.fullName || '',
        payment.deliveryPersonPaid ? 'Yes' : 'No'
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