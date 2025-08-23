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

import { PaymentService, PaymentListResponse } from '../../../services/payment.service';
import { UserService } from '../../../services/user.service';  // Add this import
import { 
  Payment, 
  PaymentStatus, 
  PaymentMethod
} from '../../../models/Payment.model';
import { ShortenPipe } from '../../../pipes/shorten.pipe';
import { User } from '../../../models/user.model';

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
    private userService: UserService,  // Add this injection
    private snackBar: MatSnackBar,
    private datePipe: DatePipe,
    private dialog: MatDialog
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

    if (response && response.success && response.data) {
      // Step 1: Process each payment (parse numbers, dates, etc.)
      this.payments = response.data
        .map((payment: Payment) => {
          try {
            let processedPayment = this.paymentService.processPaymentData
              ? this.paymentService.processPaymentData(payment)
              : payment;

            processedPayment = this.processPaymentForDisplay(processedPayment);

            return processedPayment;
          } catch (processingError) {
            console.error('Error processing individual payment:', processingError, payment);
            return this.processPaymentForDisplay(payment);
          }
        })
        .filter(payment => payment !== null);

      // 🔥 Step 2: Enrich with delivery person details (this fixes "Unknown")
      this.payments = await this.enrichPaymentsWithDeliveryPerson(this.payments);

      // Step 3: Update UI
      this.filteredPayments = [...this.payments];
      this.lastUpdated = new Date();

      // Log analysis
      const completedPayments = this.payments.filter(p => p.status === PaymentStatus.COMPLETED);
      const releaseablePayments = completedPayments.filter(p => this.canReleaseToDelivery(p));

      console.log(`Loaded ${this.payments.length} payments`);
      console.log(`${completedPayments.length} completed payments`);
      console.log(`${releaseablePayments.length} payments ready for release`);

      // Check invalid dates
      const invalidDatePayments = this.payments.filter(p =>
        !this.isValidDate(p.paymentDate) ||
        (p.deliveryPersonPaidAt && !this.isValidDate(p.deliveryPersonPaidAt))
      );

      if (invalidDatePayments.length > 0) {
        console.warn(`Found ${invalidDatePayments.length} payments with invalid dates:`,
          invalidDatePayments.map(p => ({
            id: p.id,
            paymentDate: p.paymentDate,
            deliveryPersonPaidAt: p.deliveryPersonPaidAt
          }))
        );
      }
    } else {
      const errorMessage = response?.message || 'Failed to load payments';
      this.showError(errorMessage);
    }
  } catch (error: any) {
    console.error('Error loading payments:', error);
    this.showError('Error loading payments: ' + (error.message || 'Unknown error'));
  } finally {
    this.isLoading = false;
  }
}
private async enrichPaymentsWithDeliveryPerson(payments: Payment[]): Promise<Payment[]> {
  // Extract unique deliveryPersonIds
  const idsToFetch = [
    ...new Set(payments
      .filter(p => p.deliveryPersonId && !p.deliveryPerson)
      .map(p => p.deliveryPersonId!))  // Add non-null assertion
  ];

  if (idsToFetch.length === 0) return payments;

  // Fetch all at once (if your backend supports batch)
  const userRequests = idsToFetch.map(id =>
    firstValueFrom(this.userService.getUserById(id)).catch(() => null)
  );

  const users = await Promise.all(userRequests);
  const userMap = idsToFetch.reduce((map, id, index) => {
    const user = users[index];
    if (user) map[id] = user;
    return map;
  }, {} as Record<string, User>);

  // Attach to payments with proper type handling
  return payments.map(payment => {
    if (!payment.deliveryPersonId || payment.deliveryPerson) {
      return payment;
    }

    const person = userMap[payment.deliveryPersonId];
    
    // Ensure deliveryPerson.id is always a string, not undefined
    const deliveryPersonId = payment.deliveryPersonId || 'unknown';
    
    return {
      ...payment,
      deliveryPerson: person ? {
        id: person.id || deliveryPersonId, // Fallback to deliveryPersonId if person.id is undefined
        fullName: `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown',
        phone: person.phone || '',
        email: person.email || ''
      } : {
        id: deliveryPersonId, // Use the known deliveryPersonId
        fullName: 'Unknown Delivery Person',
        phone: '',
        email: ''
      }
    };
  });
}
filterPayments(): void {
  try {
    if (!this.payments || this.payments.length === 0) {
      this.filteredPayments = [];
      return;
    }

    this.filteredPayments = this.payments.filter(payment => {
      try {
        if (!this.validatePayment(payment)) {
          console.warn('Invalid payment data:', payment);
          return false;
        }

        const searchLower = (this.searchTerm || '').toLowerCase().trim();
        
        let matchesSearch = true;
        if (searchLower) {
          const searchableFields = [
            payment.id,
            payment.clientId,
            payment.deliveryId,
            payment.transactionId,
            payment.deliveryPerson?.fullName
          ].filter(field => field); // Remove null/undefined fields
          
          matchesSearch = searchableFields.some(field => 
            String(field).toLowerCase().includes(searchLower)
          );
        }
        
        const matchesStatus = this.selectedStatus === 'ALL' || payment.status === this.selectedStatus;
        return matchesSearch && matchesStatus;
      } catch (error) {
        console.error('Error filtering payment:', error, payment);
        return false; // Exclude payments that cause errors
      }
    });
  } catch (error) {
    console.error('Error in filterPayments:', error);
    this.filteredPayments = []; // Fallback to empty array
    this.showError('Error filtering payments. Please try refreshing the data.');
  }
}

  

  async refundPayment(payment: Payment): Promise<void> {
    if (!confirm('Are you sure you want to refund this payment?')) {
      return;
    }

    this.isLoading = true;
    
    try {
      const currency = payment.currency || 'TND';
      const refundAmount = payment.finalAmountAfterDiscount || payment.amount || 0;
      
      if (refundAmount <= 0) {
        throw new Error('Invalid refund amount');
      }

      const response = await firstValueFrom(
        this.paymentService.refundPayment(payment.id, refundAmount, currency)
      );
      
      // Handle different response structures
      let updatedPayment: Payment | null = null;
      
      if (response?.success && response.data) {
        updatedPayment = response.data;
      } else if (response?.data) {
        updatedPayment = response.data;
      } else if (response) {
        updatedPayment = response as Payment;
      }

      if (updatedPayment) {
        const index = this.payments.findIndex(p => p.id === payment.id);
        if (index !== -1) {
          this.payments[index] = this.paymentService.processPaymentData(updatedPayment);
          this.filterPayments();
        }
        this.showSuccess('Payment refunded successfully');
      } else {
        throw new Error('Invalid refund response');
      }
    } catch (error: any) {
      console.error('Error refunding payment:', error);
      this.showError('Failed to refund payment: ' + (error.message || 'Unknown error'));
    } finally {
      this.isLoading = false;
    }
  }

  async markAsCompleted(paymentId: string): Promise<void> {
    this.isLoading = true;
    try {
      const response = await firstValueFrom(
        this.paymentService.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED)
      );
      
      if (response?.success || response?.data) {
        await this.loadPayments();
        this.showSuccess('Payment marked as completed');
      } else {
        throw new Error('Failed to update payment status');
      }
    } catch (error: any) {
      console.error('Error updating payment status:', error);
      this.showError('Failed to update status: ' + (error.message || 'Unknown error'));
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
      
      let updatedPayment: Payment | null = null;
      
      if (response?.success && response.data) {
        updatedPayment = response.data;
      } else if (response?.data) {
        updatedPayment = response.data;
      } else if (response) {
        updatedPayment = response as Payment;
      }

      if (updatedPayment) {
        const index = this.payments.findIndex(p => p.id === paymentId);
        if (index !== -1) {
          this.payments[index] = this.paymentService.processPaymentData(updatedPayment);
          this.filterPayments();
        }
        this.showSuccess('Payment cancelled successfully');
      } else {
        throw new Error('Invalid cancel response');
      }
    } catch (error: any) {
      console.error('Error cancelling payment:', error);
      this.showError('Failed to cancel payment: ' + (error.message || 'Unknown error'));
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
      
      if (response?.success || response?.data) {
        await this.loadPayments();
        this.showSuccess('Payment status updated successfully');
      } else {
        throw new Error('Failed to update payment status');
      }
    } catch (error: any) {
      console.error('Error updating payment status:', error);
      this.showError('Failed to update payment status: ' + (error.message || 'Unknown error'));
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
    const shareAmount = payment.deliveryPersonShare || (payment.finalAmountAfterDiscount * 0.8);
    const amount = this.formatCurrency(shareAmount, payment.currency);

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
      
      if (response?.success) {
        this.showSuccess(`Successfully released ${amount} to ${deliveryPersonName}`);
        await this.loadPayments();
      } else {
        throw new Error(response?.message || 'Release failed');
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
    // Must have a delivery person assigned
    const hasDeliveryPerson = !!payment.deliveryPersonId || !!payment.deliveryPerson?.id;
    if (!hasDeliveryPerson) {
      return false;
    }

    // Must not have been released already
    if (payment.deliveryPersonPaid === true) {
      return false;
    }

    // Must be in COMPLETED status
    if (payment.status !== PaymentStatus.COMPLETED) {
      return false;
    }

    // Must have a valid final amount
    const finalAmount = payment.finalAmountAfterDiscount || payment.amount || 0;
    if (finalAmount <= 0) {
      return false;
    }

    // Must have a valid ID
    if (!payment.id) {
      return false;
    }

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
      return this.getCannotReleaseReason(payment);
    }
    
    const shareAmount = payment.deliveryPersonShare || 
      Math.floor((payment.finalAmountAfterDiscount || payment.amount || 0) * 0.8);
    
    return `Release ${this.formatCurrency(shareAmount, payment.currency)}`;
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
      .reduce((total, payment) => {
        const shareAmount = payment.deliveryPersonShare || 
          ((payment.finalAmountAfterDiscount || payment.amount || 0) * 0.8);
        return total + shareAmount;
      }, 0);
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
      total + (payment.finalAmountAfterDiscount || payment.amount || 0), 0
    );
  }

getStatusCount(status: PaymentStatus | string): number {
  try {
    if (typeof status === 'string') {
      // Convert string to enum value if needed
      const enumValue = PaymentStatus[status as keyof typeof PaymentStatus];
      if (enumValue === undefined) {
        console.warn('Invalid payment status:', status);
        return 0;
      }
      status = enumValue;
    }
    
    return this.payments.filter(payment => {
      try {
        return payment && payment.status === status;
      } catch (error) {
        console.error('Error checking payment status:', error, payment);
        return false;
      }
    }).length;
  } catch (error) {
    console.error('Error counting status:', error);
    return 0;
  }
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
    if (!this.filteredPayments || this.filteredPayments.length === 0) {
      this.showError('No payments to export');
      return;
    }

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
      'Delivery Person Paid',
      'Delivery Person Share'
    ];
    
    const csvData = this.filteredPayments.map(payment => {
      try {
        return [
          payment.id || '',
          payment.clientId || '',
          payment.deliveryId || '',
          (payment.amount && typeof payment.amount === 'number' ? payment.amount : 0).toString(),
          (payment.finalAmountAfterDiscount && typeof payment.finalAmountAfterDiscount === 'number' 
            ? payment.finalAmountAfterDiscount : 0).toString(),
          payment.method || '',
          payment.status || '',
          this.isValidDate(payment.paymentDate) ? this.formatDate(payment.paymentDate) : 'N/A',
          payment.transactionId || '',
          payment.cardLast4 || '',
          payment.cardBrand || '',
          payment.discountCode || '',
          (payment.discountAmount && typeof payment.discountAmount === 'number' ? payment.discountAmount : 0).toString(),
          payment.deliveryPerson?.fullName || '',
          payment.deliveryPersonPaid ? 'Yes' : 'No',
          (payment.deliveryPersonShare && typeof payment.deliveryPersonShare === 'number' 
            ? payment.deliveryPersonShare : 0).toString()
        ];
      } catch (error) {
        console.error('Error processing payment for export:', error, payment);
        // Return a row with basic info even if there's an error
        return [
          payment.id || 'ERROR',
          payment.clientId || '',
          payment.deliveryId || '',
          '0',
          '0',
          payment.method || '',
          payment.status || '',
          'N/A',
          payment.transactionId || '',
          '',
          '',
          '',
          '0',
          '',
          'No',
          '0'
        ];
      }
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => {
        // Escape quotes and wrap in quotes
        const escapedCell = String(cell).replace(/"/g, '""');
        return `"${escapedCell}"`;
      }).join(','))
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
    
    this.showSuccess(`Successfully exported ${this.filteredPayments.length} payments`);
  } catch (error: any) {
    console.error('Export error:', error);
    this.showError('Failed to export payments: ' + (error.message || 'Unknown error'));
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
  const safeAmount = amount === undefined || amount === null || isNaN(amount) ? 0 : amount;
  const safeCurrency = currency || 'TND';
  
  try {
    return new Intl.NumberFormat('en-TN', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2
    }).format(safeAmount);
  } catch (error) {
    console.warn('Currency formatting error:', error);
    return `${safeCurrency} ${safeAmount.toFixed(2)}`;
  }
}
private validatePayment(payment: any): payment is Payment {
  try {
    return (
      payment &&
      typeof payment.id === 'string' &&
      typeof payment.clientId === 'string' &&
      typeof payment.status === 'string' &&
      (payment.amount === null || payment.amount === undefined || typeof payment.amount === 'number')
    );
  } catch (error) {
    console.error('Error validating payment:', error);
    return false;
  }
}


formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      // Handle various string formats
      if (date.trim() === '' || date === 'null' || date === 'undefined') {
        return 'N/A';
      }
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'N/A';
    }
    
    // Check if the date is valid
    if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) {
      console.warn('Invalid date encountered:', date);
      return 'N/A';
    }
    
    // Check for reasonable date range (not too far in past/future)
    const year = dateObj.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn('Date out of reasonable range:', date);
      return 'N/A';
    }
    
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error, 'Date value:', date);
    return 'N/A';
  }
}

formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      if (date.trim() === '' || date === 'null' || date === 'undefined') {
        return 'N/A';
      }
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'N/A';
    }
    
    if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) {
      console.warn('Invalid date encountered:', date);
      return 'N/A';
    }
    
    const year = dateObj.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn('Date out of reasonable range:', date);
      return 'N/A';
    }
    
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date only:', error, 'Date value:', date);
    return 'N/A';
  }
}


 formatTimeOnly(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      if (date.trim() === '' || date === 'null' || date === 'undefined') {
        return 'N/A';
      }
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'N/A';
    }
    
    if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) {
      console.warn('Invalid time encountered:', date);
      return 'N/A';
    }
    
    return dateObj.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting time only:', error, 'Date value:', date);
    return 'N/A';
  }
}


isValidDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      if (date.trim() === '' || date === 'null' || date === 'undefined') {
        return false;
      }
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return false;
    }
    
    // Check if date is valid and not epoch time (0)
    return dateObj !== null && 
           !isNaN(dateObj.getTime()) && 
           dateObj.getTime() > 0 &&
           dateObj.getFullYear() >= 1900 && 
           dateObj.getFullYear() <= 2100;
  } catch (error) {
    console.error('Error validating date:', error, 'Date value:', date);
    return false;
  }
}

private safeDate(date: Date | string | null | undefined): Date | undefined {
  if (!date) return undefined;
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      if (date.trim() === '' || date === 'null' || date === 'undefined') {
        return undefined;
      }
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return undefined;
    }
    
    if (!dateObj || isNaN(dateObj.getTime()) || dateObj.getTime() === 0) {
      return undefined;
    }
    
    const year = dateObj.getFullYear();
    if (year < 1900 || year > 2100) {
      return undefined;
    }
    
    return dateObj;
  } catch (error) {
    console.error('Error creating safe date:', error, 'Date value:', date);
    return undefined;
  }
}

processPaymentForDisplay(payment: Payment): Payment {
  try {
    return {
      ...payment,
      paymentDate: this.safeDate(payment.paymentDate) || new Date(), // Fallback to current date if invalid
      createdAt: this.safeDate(payment.createdAt) || new Date(),
      updatedAt: this.safeDate(payment.updatedAt) || new Date(),
      // Fix: Convert null to undefined for deliveryPersonPaidAt
      deliveryPersonPaidAt: this.safeDate(payment.deliveryPersonPaidAt) || undefined,
      // Ensure numeric fields are properly formatted
      amount: typeof payment.amount === 'number' ? payment.amount : 0,
      finalAmountAfterDiscount: typeof payment.finalAmountAfterDiscount === 'number' 
        ? payment.finalAmountAfterDiscount 
        : payment.amount || 0,
      discountAmount: typeof payment.discountAmount === 'number' ? payment.discountAmount : 0,
      deliveryPersonShare: typeof payment.deliveryPersonShare === 'number' ? payment.deliveryPersonShare : 0,
      // Fix: Convert null to undefined for convertedAmount
      convertedAmount: typeof payment.convertedAmount === 'number' ? payment.convertedAmount : undefined,
    };
  } catch (error) {
    console.error('Error processing payment for display:', error);
    return payment; // Return original payment if processing fails
  }
}

  getFilteredTotalAmount(): number {
    return this.filteredPayments.reduce((sum, payment) => 
      sum + (payment.finalAmountAfterDiscount || payment.amount || 0), 0
    );
  }

formatConvertedAmount(payment: Payment): string {
  try {
    if (payment.convertedAmount && payment.convertedCurrency && 
        typeof payment.convertedAmount === 'number' && 
        !isNaN(payment.convertedAmount)) {
      return this.formatCurrency(payment.convertedAmount, payment.convertedCurrency);
    }
    return 'N/A';
  } catch (error) {
    console.error('Error formatting converted amount:', error);
    return 'N/A';
  }
}

  // Add these methods to your AdminPaymentComponent class

copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).then(() => {
    this.showSuccess('Copied to clipboard');
  });
}

getDeliveryStatusAriaLabel(payment: Payment): string {
  return this.getDeliveryPaymentStatus(payment);
}

getReleaseButtonAriaLabel(payment: Payment): string {
  return this.getReleaseButtonText(payment);
}

// Add these properties for pagination and selection
selectedPaymentIds: string[] = [];
totalPages: number = 1;
currentPage: number = 1;
autoRefreshEnabled: boolean = false;
autoRefreshInterval: number = 30000;
lastUpdated: Date = new Date();
showStatusIndicators: boolean = false;
isOnline: boolean = true;
syncStatus: string = 'synced';
dataFreshness: string = 'fresh';
toasts: any[] = [];
showShortcutsModal: boolean = false;

// Add these methods
exportSelectedPayments(): void {
  // Implement export logic for selected payments
}

clearSelection(): void {
  this.selectedPaymentIds = [];
}

goToPreviousPage(): void {
  if (this.currentPage > 1) {
    this.currentPage--;
    this.loadPayments();
  }
}

goToNextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
    this.loadPayments();
  }
}

toggleAutoRefresh(): void {
  // Implement auto-refresh toggle logic
}

getTimeAgo(date: Date): string {
  if (!this.isValidDate(date)) {
    return 'Unknown';
  }
  
  try {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return this.formatDateOnly(date);
  } catch (error) {
    console.error('Error calculating time ago:', error);
    return 'Unknown';
  }
}

openSettings(): void {
  // Implement settings open logic
}

getSyncIcon(status: string): string {
  const icons: Record<string, string> = {
    synced: '🔄',
    syncing: '⏳',
    error: '❌'
  };
  return icons[status] || '🔃';
}

getFreshnessIcon(freshness: string): string {
  const icons: Record<string, string> = {
    fresh: '✅',
    stale: '⚠️',
    outdated: '❌'
  };
  return icons[freshness] || '❓';
}

openHelp(): void {
  // Implement help open logic
}

openSupport(): void {
  // Implement support open logic
}

showKeyboardShortcuts(): void {
  this.showShortcutsModal = true;
}

trackByToastId(index: number, toast: any): string {
  return toast.id;
}

getToastIcon(type: string): string {
  const icons: Record<string, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[type] || '💬';
}

// Add this method to safely access enum values
getPaymentStatusValue(statusKey: string): PaymentStatus {
  return PaymentStatus[statusKey as keyof typeof PaymentStatus];
}

dismissToast(id: string): void {
  this.toasts = this.toasts.filter(toast => toast.id !== id);
}

closeShortcutsModal(): void {
  this.showShortcutsModal = false;
}

}