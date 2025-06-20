import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { DiscountService } from '../../../services/discount.service';
import { Discount } from '../../../models/discount.model';
import { MatDialog } from '@angular/material/dialog';
import { PaymentDialogComponent } from '../payment-dialog/payment-dialog.component';
import { ActivatedRoute } from '@angular/router';
import { PaymentSuccessModalComponent } from '../../../shared/payment-success-modal/payment-success-modal.component';
import { Payment, PaymentStatus } from '../../../models/Payment.model';
import { filter, interval, Subscription, switchMap, takeUntil, timer, Subject, forkJoin, take } from 'rxjs';
import { PaymentService } from '../../../services/payment.service';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  paidOrders: number;
  canceledOrders?: number;
  unknownStatus?: number;
  thisMonthOrders: number;
  paymentRate: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  totalSavings: number;
  expiredOrders?: number;
  unpaidOrders?: number;
  totalRevenue?: number;
  averageOrderValue?: number;
  deliveryRate?: number;
}

interface PaymentTransaction {
  id: string;
  deliveryId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date | string;
  status: string;
  description: string;
  type: 'PAYMENT' | 'REFUND' | 'DISCOUNT';
}

@Component({
  selector: 'app-client-dashboard',
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.css'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    DatePipe,
    CurrencyPipe
  ]
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  private paymentStatusSubscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  userType: string = '';
  clientId: string = '';
  stats: DashboardStats = {
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    paidOrders: 0,
    thisMonthOrders: 0,
    paymentRate: 0,
    totalPaidAmount: 0,
    totalUnpaidAmount: 0,
    totalSavings: 0
  };
  recentDeliveries: DeliveryRequest[] = [];
  filteredDeliveries: DeliveryRequest[] = [];
  activeDiscounts: Discount[] = [];
  paymentTransactions: PaymentTransaction[] = [];
  unpaidDeliveries: number = 0;
  isLoading = true;
  errorMessage = '';
  selectedFilter: 'all' | 'paid' | 'unpaid' | 'cancelled' | 'expired' = 'all';
  selectedView: 'orders' | 'payments' | 'movements' = 'orders';
  paymentStats = {
    totalPayments: 0,
    completedPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    totalAmount: 0,
    lastPayment: null as Payment | null
  };

  constructor(
    private authService: AuthService,
    private deliveryService: DeliveryService,
    private discountService: DiscountService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private paymentService: PaymentService,
  ) {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.userType = currentUser.userType || '';
    this.clientId = currentUser.userId?.toString() || '';
  }

  ngOnInit() {
    console.log('Dashboard initializing...');
    this.refreshDashboardData();
    
    this.route.queryParams.subscribe(params => {
      console.log('Query params received:', params);
      
      if (params['paymentSuccess'] === 'true' && params['deliveryId']) {
        console.log('Processing payment success for delivery:', params['deliveryId']);
        this.handlePaymentSuccess(params['deliveryId'], params['paymentId']);
      }

      if (params['refresh'] === 'true') {
        console.log('Refreshing dashboard data...');
        this.refreshDashboardData();
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { refresh: null },
          queryParamsHandling: 'merge'
        });
      }
    });

    interval(30000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadDashboardStats();
      this.loadRecentDeliveries();
    });
  }

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
  
  // Clean up all payment status subscriptions
  this.paymentStatusSubscriptions.forEach(sub => sub.unsubscribe());
  this.paymentStatusSubscriptions = [];
}

private refreshDashboardData(): void {
  console.log('Refreshing dashboard data...');
  this.isLoading = true;

  forkJoin([
    this.deliveryService.getClientDeliveries(this.clientId),
    this.paymentService.getPaymentsByClient(this.clientId)
  ]).subscribe({
    next: ([deliveries, paymentsResponse]) => {
      // Extract the payments array from the response
      const payments = paymentsResponse.payments || paymentsResponse.data || [];
      this.processDashboardData(deliveries, payments);
      this.isLoading = false;
    },
    error: (err) => {
      console.error('Error refreshing dashboard:', err);
      this.isLoading = false;
    }
  });
}

private loadDashboardStatsPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.clientId) {
        reject(new Error('Invalid client ID'));
        return;
      }

      this.deliveryService.getClientDeliveries(this.clientId).subscribe({
        next: (deliveries: DeliveryRequest[]) => {
          try {
            this.calculateStats(deliveries);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        error: reject
      });
    });
  }

  private loadRecentDeliveriesPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.clientId) {
        reject(new Error('Invalid client ID'));
        return;
      }

      this.deliveryService.getClientDeliveries(this.clientId).subscribe({
        next: (deliveries: DeliveryRequest[]) => {
          console.log('Received deliveries:', deliveries);
          this.recentDeliveries = deliveries
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            })
            .slice(0, 20);
          
          console.log('Processed recent deliveries:', this.recentDeliveries);
          resolve();
        },
        error: reject
      });
    });
  }

  private loadActiveDiscountsPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.clientId) {
        resolve();
        return;
      }
      
      this.discountService.getClientDiscounts(this.clientId).subscribe({
        next: (discounts) => {
          this.activeDiscounts = discounts.filter(d => 
            !d.used && 
            d.validUntil && new Date(d.validUntil) > new Date()
          );
          resolve();
        },
        error: (err) => {
          console.error('Error loading discounts:', err);
          resolve();
        }
      });
    });
  }

  private loadPaymentTransactionsPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.clientId) {
        resolve();
        return;
      }
      
      this.deliveryService.getClientDeliveries(this.clientId).subscribe({
        next: (deliveries: DeliveryRequest[]) => {
          this.generatePaymentTransactions(deliveries);
          resolve();
        },
        error: (err) => {
          console.error('Error loading payment transactions:', err);
          resolve();
        }
      });
    });
  }

private calculateStats(deliveries: DeliveryRequest[]): void {
  const validDeliveries = deliveries.filter(delivery => 
    delivery && typeof delivery === 'object'
  );

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const pendingOrders = validDeliveries.filter(d => 
    ['PENDING', 'ASSIGNED', 'IN_TRANSIT'].includes(d.status || '')
  ).length;

  const completedOrders = validDeliveries.filter(d => 
    d.status === 'DELIVERED'
  ).length;

  const paidOrders = validDeliveries.filter(d => 
    d.paymentStatus === PaymentStatus.COMPLETED
  ).length;

  const unpaidOrders = validDeliveries.filter(d => 
    d.status === 'DELIVERED' && 
    d.paymentStatus !== PaymentStatus.COMPLETED
  ).length;

  const thisMonthOrders = validDeliveries.filter(d => {
    if (!d.createdAt) return false;
    const orderDate = new Date(d.createdAt);
    return orderDate.getMonth() === currentMonth && 
           orderDate.getFullYear() === currentYear;
  }).length;

 const totalPaidAmount = validDeliveries
  .filter(d => d.paymentStatus === PaymentStatus.COMPLETED)
  .reduce((sum, d) => sum + this.parseAmount(d.amount), 0);
  
const totalUnpaidAmount = validDeliveries
  .filter(d => d.status === 'DELIVERED' && d.paymentStatus !== PaymentStatus.COMPLETED)
  .reduce((sum, d) => sum + this.parseAmount(d.amount), 0);

const totalSavings = validDeliveries
  .reduce((sum, d) => sum + this.parseAmount(d.discountAmount), 0);
  this.stats = {
    ...this.stats,
    totalOrders: validDeliveries.length,
    pendingOrders,
    completedOrders,
    paidOrders,
    unpaidOrders,
    thisMonthOrders,
    totalPaidAmount,
    totalUnpaidAmount,
    totalSavings,
    paymentRate: completedOrders > 0 
      ? Math.round((paidOrders / completedOrders) * 100 * 100) / 100
      : 0
  };
}

  private generatePaymentTransactions(deliveries: DeliveryRequest[]): void {
    this.paymentTransactions = [];
    
    deliveries.forEach(delivery => {
      const toDateString = (date: any): string => {
        if (!date) return new Date().toISOString();
        if (date instanceof Date) return date.toISOString();
        if (typeof date === 'string') return new Date(date).toISOString();
        return new Date(date).toISOString();
      };

      if (delivery.paymentStatus === PaymentStatus.COMPLETED && delivery.paymentDate) {
        this.paymentTransactions.push({
          id: `pay_${delivery.id}`,
          deliveryId: delivery.id,
          amount: this.parseAmount(delivery.amount),
          paymentMethod: delivery.paymentMethod || 'UNKNOWN',
          paymentDate: toDateString(delivery.paymentDate),
          status: 'COMPLETED',
          description: `Payment for delivery to ${delivery.deliveryAddress}`,
          type: 'PAYMENT'
        });
      }
      
      if (delivery.paymentStatus === PaymentStatus.REFUNDED) {
        this.paymentTransactions.push({
          id: `ref_${delivery.id}`,
          deliveryId: delivery.id,
          amount: -this.parseAmount(delivery.amount),
          paymentMethod: delivery.paymentMethod || 'UNKNOWN',
          paymentDate: toDateString(delivery.updatedAt || delivery.paymentDate),
          status: 'REFUNDED',
          description: `Refund for delivery to ${delivery.deliveryAddress}`,
          type: 'REFUND'
        });
      }
      
      if (delivery.discountAmount && delivery.discountAmount > 0) {
        this.paymentTransactions.push({
          id: `disc_${delivery.id}`,
          deliveryId: delivery.id,
          amount: -this.parseAmount(delivery.discountAmount),
          paymentMethod: 'DISCOUNT',
          paymentDate: toDateString(delivery.createdAt),
          status: 'APPLIED',
          description: `Discount applied for delivery to ${delivery.deliveryAddress}`,
          type: 'DISCOUNT'
        });
      }
    });
    
    this.paymentTransactions.sort((a, b) => 
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  }

private handlePaymentSuccess(deliveryId: string, paymentId: string): void {
  console.log('Handling payment success for delivery:', deliveryId, 'payment:', paymentId);
  
  // Immediate UI update
  const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
  if (delivery) {
    delivery.paymentStatus = PaymentStatus.COMPLETED;
    delivery.paymentId = paymentId;
    delivery.paymentDate = new Date().toISOString();
  }

  // Force refresh of all data
  this.refreshDashboardData();

  // Add navigation with refresh parameter
  this.router.navigate(['/client/dashboard'], {
    queryParams: { 
      paymentSuccess: 'true',
      paymentId: paymentId,
      refresh: Date.now().toString()
    }
  });
}

private pollPaymentStatus(paymentId: string): void {
  let pollCount = 0;
  const maxPolls = 15;
  
  const statusSub = interval(2000).pipe(
    takeUntil(timer(30000)),
    switchMap(() => {
      pollCount++;
      return this.paymentService.getPaymentStatus(paymentId);
    }),
    filter(response => response.success && response.status === PaymentStatus.COMPLETED),
    take(1)
  ).subscribe({
    next: () => {
      console.log('Payment confirmed, final refresh...');
      this.refreshDashboardData();
    },
    error: (err) => {
      console.error('Error checking payment status:', err);
    },
    complete: () => {
      statusSub.unsubscribe();
    }
  });
  
  this.paymentStatusSubscriptions.push(statusSub);
}
  private showPaymentSuccessModal(deliveryId: string, paymentId: string): void {
    const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
    
    if (delivery) {
      const modalRef = this.dialog.open(PaymentSuccessModalComponent, {
        data: {
          deliveryId: delivery.id,
          amount: delivery.amount,
          paymentMethod: delivery.paymentMethod
        }
      });

      modalRef.afterClosed().subscribe(() => {
        console.log('Payment success modal closed, refreshing data...');
        this.refreshDashboardData();
      });
    }
  }

private loadDashboardStats(): void {
    this.isLoading = true;
    
    forkJoin([
      this.deliveryService.getClientDeliveries(this.clientId),
      this.paymentService.getPaymentsByClient(this.clientId)
    ]).subscribe({
      next: ([deliveries, paymentsResponse]) => {
        // Extract the payments array from the response
        const payments = paymentsResponse.payments || paymentsResponse.data || paymentsResponse;
        this.processDashboardData(deliveries, payments);
        this.isLoading = false;
      },
      error: (err) => {
        this.handleError(err);
        this.isLoading = false;
      }
    });
  }

 private calculatePaymentStats(payments: Payment[]): void {
    // Ensure payments is an array
    const validPayments = Array.isArray(payments) ? payments.filter(p => p.paymentDate) : [];
    
    this.paymentStats = {
      totalPayments: validPayments.length,
      completedPayments: validPayments.filter(p => p.status === PaymentStatus.COMPLETED).length,
      pendingPayments: validPayments.filter(p => p.status === PaymentStatus.PENDING).length,
      failedPayments: validPayments.filter(p => p.status === PaymentStatus.FAILED).length,
      totalAmount: validPayments.reduce((sum, p) => sum + (p.status === PaymentStatus.COMPLETED ? p.amount : 0), 0),
      lastPayment: validPayments.length > 0 ? 
        validPayments.sort((a, b) => 
          new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime()
        )[0] : null
    };
  }

private processDashboardData(deliveries: DeliveryRequest[], payments: Payment[]): void {
  // Ensure we have arrays
  const deliveriesArray = Array.isArray(deliveries) ? deliveries : [];
  const paymentsArray = Array.isArray(payments) ? payments : [];
  
  // Merge payment data into deliveries
  deliveriesArray.forEach(delivery => {
    if (delivery.paymentId) {
      const payment = paymentsArray.find(p => p.id === delivery.paymentId);
      if (payment) {
        delivery.paymentStatus = payment.status;
        delivery.paymentMethod = payment.method;
        delivery.paymentDate = payment.paymentDate;
        delivery.amount = payment.amount;
      }
    } else {
      // Find payment by deliveryId if paymentId is not set
      const relatedPayment = paymentsArray.find(p => p.deliveryId === delivery.id);
      if (relatedPayment) {
        delivery.paymentStatus = relatedPayment.status;
        delivery.paymentMethod = relatedPayment.method;
        delivery.paymentDate = relatedPayment.paymentDate;
        delivery.amount = relatedPayment.amount;
        delivery.paymentId = relatedPayment.id;
      }
    }
  });

  this.recentDeliveries = deliveriesArray;
  this.calculateStats(deliveriesArray);
  this.filterDeliveries(this.selectedFilter);
  this.calculatePaymentStats(paymentsArray);
}

  private loadRecentDeliveries(): void {
    this.loadRecentDeliveriesPromise().then(() => {
      this.filterDeliveries(this.selectedFilter);
    }).catch(err => {
      console.error('Error in loadRecentDeliveries:', err);
      this.filteredDeliveries = [];
    });
  }

  private loadActiveDiscounts(): void {
    this.loadActiveDiscountsPromise().catch(err => {
      console.error('Error in loadActiveDiscounts:', err);
    });
  }

  private loadPaymentTransactions(): void {
    this.loadPaymentTransactionsPromise().catch(err => {
      console.error('Error in loadPaymentTransactions:', err);
    });
  }

private parseAmount(amount: any): number {
  if (amount === null || amount === undefined) return 0;
  
  // Convert string to number
  if (typeof amount === 'string') {
    // Remove any non-numeric characters except decimal point and minus sign
    const numericString = amount.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(numericString);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  // If it's already a number
  return typeof amount === 'number' ? amount : 0;
}

  changeView(view: 'orders' | 'payments' | 'movements') {
    this.selectedView = view;
    if (view === 'payments') {
      this.loadPaymentTransactions();
    }
  }

  filterDeliveries(filter: 'all' | 'paid' | 'unpaid' | 'cancelled' | 'expired') {
    this.selectedFilter = filter;
    
    switch (filter) {
      case 'paid':
        this.filteredDeliveries = this.recentDeliveries.filter(d => 
          d.paymentStatus === PaymentStatus.COMPLETED
        );
        break;
      case 'unpaid':
        this.filteredDeliveries = this.recentDeliveries.filter(d => 
          d.status === 'DELIVERED' && 
          d.paymentStatus !== PaymentStatus.COMPLETED
        );
        break;
      case 'cancelled':
        this.filteredDeliveries = this.recentDeliveries.filter(d => 
          d.status === 'CANCELLED'
        );
        break;
      case 'expired':
        this.filteredDeliveries = this.recentDeliveries.filter(d => 
          d.status === 'EXPIRED'
        );
        break;
      default:
        this.filteredDeliveries = [...this.recentDeliveries];
    }
    
    console.log(`Filtered ${this.filteredDeliveries.length} deliveries for filter: ${filter}`);
  }

  getPaymentHistory() {
    return this.paymentTransactions.filter(t => t.type === 'PAYMENT');
  }

  getDiscountHistory() {
    return this.paymentTransactions.filter(t => t.type === 'DISCOUNT');
  }

  getTotalPaidThisMonth(): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return this.paymentTransactions
      .filter(t => {
        const transactionDate = new Date(t.paymentDate);
        return t.type === 'PAYMENT' && 
               transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getTotalDiscountsThisMonth(): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return this.paymentTransactions
      .filter(t => {
        const transactionDate = new Date(t.paymentDate);
        return t.type === 'DISCOUNT' && 
               transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  cancelDelivery(deliveryId: string) {
    if (confirm('Are you sure you want to cancel this delivery?')) {
      const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
      if (delivery) {
        delivery.processing = true;
      }

      this.deliveryService.cancelDelivery(deliveryId).subscribe({
        next: () => {
          this.refreshDashboardData();
          alert('Delivery cancelled successfully!');
        },
        error: (err) => {
          alert('Error: ' + err.message);
          if (delivery) {
            delivery.processing = false;
          }
        }
      });
    }
  }

  checkExpiredDeliveries() {
    this.deliveryService.checkExpiredDeliveries().subscribe({
      next: () => {
        console.log('Expired deliveries checked successfully');
        this.loadRecentDeliveries();
      },
      error: (err) => {
        console.error('Error checking expired deliveries:', err.message);
      }
    });
  }

  showUnpaidOrders() {
    this.filterDeliveries('unpaid');
  }

  payAllUnpaid() {
    const unpaidOrders = this.recentDeliveries.filter(d => 
      d.status === 'DELIVERED' && 
      d.paymentStatus !== PaymentStatus.COMPLETED
    );

    if (unpaidOrders.length === 0) {
      alert('No unpaid orders found');
      return;
    }

    if (confirm(`Are you sure you want to pay all ${unpaidOrders.length} unpaid orders?`)) {
      this.openBulkPaymentDialog(unpaidOrders);
    }
  }

  private openBulkPaymentDialog(orders: DeliveryRequest[]) {
    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '700px',
      data: {
        bulkPayment: true,
        deliveries: orders,
        clientId: this.clientId,
        discounts: this.activeDiscounts
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.refreshDashboardData();
      }
    });
  }

  getEmptyStateMessage(): string {
    switch (this.selectedFilter) {
      case 'paid': return 'No paid orders found';
      case 'unpaid': return 'No unpaid orders found';
      case 'cancelled': return 'No cancelled orders found';
      case 'expired': return 'No expired orders found';
      default: return 'No delivery requests found';
    }
  }

  getEmptyStateDescription(): string {
    switch (this.selectedFilter) {
      case 'paid': return 'You haven\'t made any payments yet.';
      case 'unpaid': return 'All your delivered orders have been paid.';
      case 'cancelled': return 'You haven\'t cancelled any orders.';
      case 'expired': return 'No orders have expired.';
      default: return 'Start by creating your first delivery request.';
    }
  }

  getPaymentMethodLabel(method: string): string {
    const labels: { [key: string]: string } = {
      'CREDIT_CARD': 'Credit Card',
      'CASH_ON_DELIVERY': 'Cash on Delivery',
      'MOBILE_MONEY': 'Mobile Money',
      'BANK_TRANSFER': 'Bank Transfer',
      'DISCOUNT': 'Discount Applied',
      'WALLET': 'Digital Wallet'
    };
    return labels[method] || method;
  }

  downloadReceipt(delivery: DeliveryRequest) {
    console.log('Downloading receipt for delivery:', delivery.id);
    
    this.deliveryService.downloadReceipt(delivery.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receipt-${delivery.id}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err: any) => {
        console.error('Error downloading receipt:', err);
        alert('Error downloading receipt. Please try again.');
      }
    });
  }

  openPaymentDialog(delivery: DeliveryRequest): void {
    this.router.navigate(['/client/payment'], {
      queryParams: {
        deliveryId: delivery.id,
        clientId: this.clientId
      }
    });
  }

  goToDeliveryRequest() {
    this.router.navigate(['/client/delivery-request']);
  }
  
  private handleAuthError(): void {
    this.errorMessage = 'Authentication error. Please login again.';
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  private handleDataError(): void {
    this.stats = { 
      totalOrders: 0, 
      pendingOrders: 0, 
      completedOrders: 0,
      paidOrders: 0,
      thisMonthOrders: 0,
      paymentRate: 0,
      totalPaidAmount: 0,
      totalUnpaidAmount: 0,
      totalSavings: 0
    };
    this.errorMessage = 'Error processing delivery data. Showing partial information.';
  }

  private handleError(err: any): void {
    if (err.status === 401) {
      this.handleAuthError();
    } else if (err.status === 403) {
      this.errorMessage = 'Access denied. Please check your permissions.';
    } else if (err.status >= 500) {
      this.errorMessage = 'Server error. Please try again later.';
    } else {
      this.errorMessage = err.message || 'Failed to load dashboard data. Please try again later.';
    }
  }
}