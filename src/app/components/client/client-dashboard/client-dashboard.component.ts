import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { DeliveryRequest, DeliveryService, DetailedRatingResponse } from '../../../services/delivery-service.service';
import { DiscountService } from '../../../services/discount.service';
import { Discount } from '../../../models/discount.model';
import { MatDialog } from '@angular/material/dialog';
import { PaymentDialogComponent } from '../payment-dialog/payment-dialog.component';
import { ActivatedRoute } from '@angular/router';
import { PaymentSuccessModalComponent } from '../../../shared/payment-success-modal/payment-success-modal.component';
import { Payment, PaymentStatus } from '../../../models/Payment.model';
import { filter, interval, Subscription, switchMap, takeUntil, timer, Subject, forkJoin, take, finalize } from 'rxjs';
import { PaymentService } from '../../../services/payment.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ToastService } from '../../../services/toast.service';
import { DeliveryRatingModalComponent } from '../delivery-rating-modal/delivery-rating-modal.component';
import { RatingDetailsModalComponent } from '../rating-details-modal/rating-details-modal.component';
interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  paidOrders: number;
  canceledOrders: number;
  expiredOrders: number;
  unpaidOrders: number;
  thisMonthOrders: number;
  paymentRate: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  totalSavings: number;
  totalRevenue: number;
  averageOrderValue: number;
  deliveryRate: number;
  paymentMethods: {
    [method: string]: {
      count: number;
      amount: number;
    }
  };
  statusDistribution: {
    [status: string]: number;
  };
  // Add this property
  ratingStats?: {
    totalDelivered: number;
    totalRated: number;
    pendingRatings: number;
    averageRating: number;
    ratingRate: number;
  };
}
interface PaymentTransaction {
  id: string;
  deliveryId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date | string;
  status: PaymentStatus;
  description: string;
  type: 'PAYMENT' | 'REFUND' | 'DISCOUNT';
  invoiceUrl?: string;
  receiptUrl?: string;
}

interface PaymentSummary {
  totalCompleted: number;
  totalPending: number;
  totalFailed: number;
  totalRefunded: number;
  monthlyTrend: {
    month: string;
    amount: number;
  }[];
  methodBreakdown: {
    method: string;
    count: number;
    amount: number;
  }[];
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
    CurrencyPipe,
    MatProgressBarModule,
    MatCardModule,
    MatButtonModule,
    FormsModule
  ]
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  // AI Assistant properties (inline implementation)
  isMinimized = true;
  messages: any[] = [];
  currentMessage = '';
  isSending = false;
  isTyping = false;
  notifications: any[] = [];
  isPerformingGlobalAction = false;
  globalActionMessage = '';
  hoverRating: number = 0;

  // Status filters - Updated to include 'pending-ratings'
  statusFilters: ('all' | 'paid' | 'unpaid' | 'cancelled' | 'expired' | 'pending-ratings')[] = [
    'all', 'paid', 'unpaid', 'cancelled', 'expired', 'pending-ratings'
  ];

  private paymentStatusSubscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  userType: string = '';
  clientId: string = '';
  stats: DashboardStats = {
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    paidOrders: 0,
    canceledOrders: 0,
    expiredOrders: 0,
    unpaidOrders: 0,
    thisMonthOrders: 0,
    paymentRate: 0,
    totalPaidAmount: 0,
    totalUnpaidAmount: 0,
    totalSavings: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    deliveryRate: 0,
    paymentMethods: {},
    statusDistribution: {}
  };
  
  recentDeliveries: DeliveryRequest[] = [];
  filteredDeliveries: DeliveryRequest[] = [];
  activeDiscounts: Discount[] = [];
  paymentTransactions: PaymentTransaction[] = [];
  unpaidDeliveries: number = 0;
  isLoading = true;
  errorMessage = '';
  selectedFilter: 'all' | 'paid' | 'unpaid' | 'cancelled' | 'expired' | 'pending-ratings' = 'all';
  selectedView: 'orders' | 'payments' | 'movements' = 'orders';
  
  paymentStats = {
    totalPayments: 0,
    completedPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    totalAmount: 0,
    lastPayment: null as Payment | null
  };

  paymentSummary: PaymentSummary = {
    totalCompleted: 0,
    totalPending: 0,
    totalFailed: 0,
    totalRefunded: 0,
    monthlyTrend: [],
    methodBreakdown: []
  };

  // Expose enum to template
  PaymentStatus = PaymentStatus;
  private isRefreshing = false;
  private lastRefreshTime = 0;

  constructor(
    private authService: AuthService,
    private deliveryService: DeliveryService,
    private discountService: DiscountService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private paymentService: PaymentService,
    private toastService: ToastService
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
    this.initializeData();
    
    // Handle query params ONCE on init only
    this.route.queryParams.pipe(
      take(1)
    ).subscribe(params => {
      if (params['paymentSuccess'] === 'true' && params['deliveryId']) {
        this.handlePaymentSuccess(params['deliveryId'], params['paymentId']);
      }
      
      // Clear query params immediately
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    });

    // Setup polling
    this.setupDataPolling();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up all payment status subscriptions
    this.paymentStatusSubscriptions.forEach(sub => sub.unsubscribe());
    this.paymentStatusSubscriptions = [];
  }

  // AI Assistant methods (inline implementation)
  toggleChat(): void {
    this.isMinimized = !this.isMinimized;
  }

  getUserName(): string {
    const user = this.authService.getCurrentUser();
    return user?.firstName ? `${user.firstName}` : 'You';
  }

  sendMessage(event?: any): void {
    if (event && event.shiftKey) return;
    if (event) event.preventDefault();
    
    if (!this.currentMessage.trim() || this.isSending) return;

    const userMessage = {
      id: Date.now(),
      content: this.currentMessage.trim(),
      type: 'user',
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    const messageContent = this.currentMessage;
    this.currentMessage = '';
    this.isSending = true;
    this.isTyping = true;

    // Simulate AI response
    setTimeout(() => {
      this.isTyping = false;
      const aiMessage = {
        id: Date.now() + 1,
        content: this.generateAIResponse(messageContent),
        type: 'assistant',
        timestamp: new Date()
      };
      this.messages.push(aiMessage);
      this.isSending = false;
    }, 2000);
  }

  sendQuickMessage(message: string): void {
    this.currentMessage = message;
    this.sendMessage();
  }

  generateAIResponse(userMessage: string): string {
    const responses = [
      `I understand you'd like help with that. Based on your dashboard data, I can see you have ${this.stats.totalOrders} total orders.`,
      `Let me help you with that request. Your current payment rate is ${this.stats.paymentRate}%.`,
      `I can assist you with tracking your deliveries. You have ${this.stats.pendingOrders} pending orders.`,
      "Thank you for your question. I'm here to help you manage your ExpedNow account effectively."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  isAssistantMessage(message: any): boolean {
    return message.type === 'assistant';
  }

  isUserMessage(message: any): boolean {
    return message.type === 'user';
  }

  getMessageClass(message: any): string {
    return 'message message-' + message.type;
  }

  formatMessageContent(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  formatTimestamp(timestamp: any): string {
    return new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }

  trackByMessage(index: number, message: any): number {
    return message.id;
  }

  clearConversation(): void {
    this.messages = [];
  }

  startNewConversation(): void {
    this.clearConversation();
  }

  adjustTextareaHeight(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  }

  // Notification methods
  trackByNotification(index: number, notification: any): number {
    return notification.id;
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  // Rest of your existing methods...
  private setupDataPolling(): void {
    // Main data polling every 30 seconds with proper throttling
    interval(30000).pipe(
      takeUntil(this.destroy$),
      filter(() => {
        const now = Date.now();
        const timeSinceLastRefresh = now - this.lastRefreshTime;
        return !this.isRefreshing && timeSinceLastRefresh > 25000;
      })
    ).subscribe(() => {
      console.log('Scheduled polling refresh');
      this.refreshDashboardData();
    });

    // Payment status checks for pending payments (separate from main polling)
    interval(10000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.deliveryService.getClientDeliveries(this.clientId)),
      filter(() => !this.isRefreshing)
    ).subscribe(deliveries => {
      this.checkPendingPayments(deliveries);
    });
  }

  private initializeData(): void {
    this.isLoading = true;
    forkJoin([
      this.deliveryService.getClientDeliveries(this.clientId),
      this.paymentService.getPaymentsByClient(this.clientId),
      this.discountService.getClientDiscounts(this.clientId)
    ]).subscribe({
      next: ([deliveries, paymentsResponse, discounts]) => {
        const payments = paymentsResponse.payments || paymentsResponse.data || [];
        this.processDashboardData(deliveries, payments, discounts);
        this.isLoading = false;
      },
      error: (err) => {
        this.handleError(err);
        this.isLoading = false;
      }
    });
  }

  // Fixed: Remove duplicate refreshDashboardData method
  refreshDashboardData(): void {
    if (this.isRefreshing) {
      console.log('Already refreshing, skipping...');
      return;
    }

    console.log('Refreshing dashboard data...');
    this.isRefreshing = true;
    this.isLoading = true;
    this.lastRefreshTime = Date.now();

    this.paymentStatusSubscriptions.forEach(sub => sub.unsubscribe());
    this.paymentStatusSubscriptions = [];

    forkJoin([
      this.deliveryService.getClientDeliveries(this.clientId),
      this.paymentService.getPaymentsByClient(this.clientId)
    ]).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isRefreshing = false;
        this.isLoading = false;
      })
    ).subscribe({
      next: ([deliveries, paymentsResponse]) => {
        const payments = paymentsResponse.payments || paymentsResponse.data || [];
        this.processDashboardData(deliveries, payments);
        
        setTimeout(() => {
          this.checkPendingPayments(deliveries);
          this.checkPendingRatings();
        }, 1000);
      },
      error: (err) => {
        console.error('Error refreshing dashboard:', err);
        this.handleError(err);
      }
    });
  }

  private checkPendingPayments(deliveries: DeliveryRequest[]): void {
    const pendingPayments = deliveries.filter(d => 
      d.paymentStatus === PaymentStatus.PENDING && 
      d.paymentId &&
      !this.paymentStatusSubscriptions.some(sub => (sub as any).deliveryId === d.id)
    );

    pendingPayments.forEach(delivery => {
      const sub = this.paymentService.getPaymentStatus(delivery.paymentId!).pipe(
        takeUntil(this.destroy$),
        filter(response => response.success),
        take(1)
      ).subscribe({
        next: (statusResponse) => {
          if (statusResponse.status !== delivery.paymentStatus) {
            this.handlePaymentStatusUpdate(delivery.id, statusResponse);
          }
        },
        error: (err) => console.error('Error checking payment status:', err)
      });
      
      (sub as any).deliveryId = delivery.id;
      this.paymentStatusSubscriptions.push(sub);
    });
  }

  private handlePaymentStatusUpdate(deliveryId: string, statusResponse: any): void {
    const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
    if (delivery) {
      delivery.paymentStatus = statusResponse.status as any;
      delivery.paymentDate = statusResponse.paymentDate 
        ? new Date(statusResponse.paymentDate).toISOString() 
        : new Date().toISOString();
      
      if (statusResponse.status === PaymentStatus.COMPLETED) {
        this.showPaymentSuccessNotification(deliveryId);
      }
      
      this.calculateStats(this.recentDeliveries);
    }
  }

  private showPaymentSuccessNotification(deliveryId: string): void {
    const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
    if (delivery) {
      const notification = this.dialog.open(PaymentSuccessModalComponent, {
        data: {
          deliveryId: delivery.id,
          amount: delivery.amount,
          paymentMethod: delivery.paymentMethod,
          paymentDate: delivery.paymentDate
        },
        disableClose: true
      });

      notification.afterClosed().subscribe(() => {
        this.refreshDashboardData();
      });
    }
  }

  private handlePaymentSuccess(deliveryId: string, paymentId: string): void {
    console.log('Handling payment success for delivery:', deliveryId, 'payment:', paymentId);
    
    const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
    
    if (delivery) {
      delivery.paymentStatus = PaymentStatus.COMPLETED as any;
      delivery.paymentId = paymentId;
      delivery.paymentDate = new Date().toISOString();
      
      this.calculateStats(this.recentDeliveries);
      this.showPaymentSuccessModal(deliveryId, paymentId);
    } else {
      this.refreshDashboardData();
    }
  }

  private showPaymentSuccessModal(deliveryId: string, paymentId: string): void {
    const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
    
    if (delivery) {
      const modalRef = this.dialog.open(PaymentSuccessModalComponent, {
        data: {
          deliveryId: delivery.id,
          amount: delivery.amount,
          paymentMethod: delivery.paymentMethod,
          transactionId: paymentId
        },
        disableClose: true
      });

      modalRef.afterClosed().subscribe(() => {
        this.refreshDashboardData();
        
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      });
    }
  }

  private processDashboardData(deliveries: DeliveryRequest[], payments: Payment[], discounts?: Discount[]): void {
    deliveries.forEach(delivery => {
      const payment = payments.find(p => 
        p.id === delivery.paymentId || p.deliveryId === delivery.id
      );
      
      if (payment) {
        delivery.paymentStatus = payment.status as any;
        delivery.paymentMethod = payment.method;
        
        try {
          delivery.paymentDate = payment.paymentDate 
            ? new Date(payment.paymentDate).toISOString() 
            : undefined;
        } catch (e) {
          console.warn('Invalid payment date:', payment.paymentDate);
          delivery.paymentDate = undefined;
        }
        
        delivery.amount = payment.amount;
        delivery.paymentId = payment.id;
        
        if (delivery.discountAmount && delivery.discountAmount > 0) {
          delivery.originalAmount = (delivery.amount || 0) + delivery.discountAmount;
        }
      }
    });

    this.recentDeliveries = deliveries;
    this.filteredDeliveries = [...deliveries];
    
    this.calculateStats(deliveries);
    this.calculatePaymentStats(payments);
    this.generatePaymentTransactions(deliveries, payments);
    
    if (discounts) {
      this.activeDiscounts = discounts.filter(d => 
        !d.used && d.validUntil && new Date(d.validUntil) > new Date()
      );
    }
  }

  private calculateStats(deliveries: DeliveryRequest[]): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const statusCounts: { [status: string]: number } = {};
    const paymentMethods: { [method: string]: { count: number, amount: number } } = {};

    deliveries.forEach(delivery => {
      const status = delivery.status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (delivery.paymentStatus === PaymentStatus.COMPLETED && delivery.paymentMethod) {
        if (!paymentMethods[delivery.paymentMethod]) {
          paymentMethods[delivery.paymentMethod] = { count: 0, amount: 0 };
        }
        paymentMethods[delivery.paymentMethod].count++;
        paymentMethods[delivery.paymentMethod].amount += this.parseAmount(delivery.amount);
      }
    });

    const completedOrders = statusCounts['DELIVERED'] || 0;
    const paidOrders = deliveries.filter(d => 
      d.paymentStatus === PaymentStatus.COMPLETED
    ).length;

    const thisMonthOrders = deliveries.filter(d => {
      if (!d.createdAt) return false;
      const orderDate = new Date(d.createdAt);
      return orderDate.getMonth() === currentMonth && 
            orderDate.getFullYear() === currentYear;
    }).length;

    const totalPaidAmount = deliveries
      .filter(d => d.paymentStatus === PaymentStatus.COMPLETED)
      .reduce((sum, d) => sum + this.parseAmount(d.amount), 0);
      
    const totalUnpaidAmount = deliveries
      .filter(d => d.status === 'DELIVERED' && d.paymentStatus !== PaymentStatus.COMPLETED)
      .reduce((sum, d) => sum + this.parseAmount(d.amount), 0);

    const totalSavings = deliveries
      .reduce((sum, d) => sum + this.parseAmount(d.discountAmount || 0), 0);

    this.stats = {
      totalOrders: deliveries.length,
      pendingOrders: (statusCounts['PENDING'] || 0) + (statusCounts['ASSIGNED'] || 0) + (statusCounts['IN_TRANSIT'] || 0),
      completedOrders,
      paidOrders,
      canceledOrders: statusCounts['CANCELLED'] || 0,
      expiredOrders: statusCounts['EXPIRED'] || 0,
      unpaidOrders: deliveries.filter(d => 
        d.status === 'DELIVERED' && 
        d.paymentStatus !== PaymentStatus.COMPLETED
      ).length,
      thisMonthOrders,
      paymentRate: completedOrders > 0 
        ? Math.round((paidOrders / completedOrders) * 100 * 100) / 100
        : 0,
      totalPaidAmount,
      totalUnpaidAmount,
      totalSavings,
      totalRevenue: totalPaidAmount,
      averageOrderValue: deliveries.length > 0 
        ? totalPaidAmount / deliveries.length 
        : 0,
      deliveryRate: deliveries.length > 0
        ? (completedOrders / deliveries.length) * 100
        : 0,
      paymentMethods,
      statusDistribution: statusCounts
    };
  }

  private calculatePaymentStats(payments: Payment[]): void {
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend: { month: string; amount: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyTrend.push({
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        amount: 0
      });
    }

    const methodBreakdown: { [method: string]: { method: string; count: number; amount: number } } = {};

    payments.forEach(payment => {
      if (payment.paymentDate && payment.status === PaymentStatus.COMPLETED) {
        const paymentDate = new Date(payment.paymentDate);
        const monthStr = `${monthNames[paymentDate.getMonth()]} ${paymentDate.getFullYear()}`;
        const monthEntry = monthlyTrend.find(m => m.month === monthStr);
        if (monthEntry) {
          monthEntry.amount += payment.amount;
        }
      }

      if (payment.method) {
        if (!methodBreakdown[payment.method]) {
          methodBreakdown[payment.method] = {
            method: payment.method,
            count: 0,
            amount: 0
          };
        }
        methodBreakdown[payment.method].count++;
        methodBreakdown[payment.method].amount += payment.amount;
      }
    });

    this.paymentSummary = {
      totalCompleted: payments.filter(p => p.status === PaymentStatus.COMPLETED).length,
      totalPending: payments.filter(p => p.status === PaymentStatus.PENDING).length,
      totalFailed: payments.filter(p => p.status === PaymentStatus.FAILED).length,
      totalRefunded: payments.filter(p => p.status === PaymentStatus.REFUNDED).length,
      monthlyTrend,
      methodBreakdown: Object.values(methodBreakdown)
    };
  }

  private generatePaymentTransactions(deliveries: DeliveryRequest[], payments: Payment[]): void {
    this.paymentTransactions = [];
    
    payments.forEach(payment => {
      const delivery = deliveries.find(d => d.id === payment.deliveryId);
      
      let paymentDate: string | Date;
      try {
        paymentDate = payment.paymentDate 
          ? new Date(payment.paymentDate) 
          : new Date();
      } catch (e) {
        console.warn('Invalid payment date:', payment.paymentDate);
        paymentDate = new Date();
      }
      
      this.paymentTransactions.push({
        id: payment.id,
        deliveryId: payment.deliveryId || '',
        amount: payment.amount,
        paymentMethod: payment.method || 'UNKNOWN',
        paymentDate: paymentDate,
        status: payment.status as PaymentStatus,
        description: delivery 
          ? `Payment for delivery to ${delivery.deliveryAddress}`
          : 'Standalone payment',
        type: payment.status === PaymentStatus.REFUNDED ? 'REFUND' : 'PAYMENT',
        invoiceUrl: payment.invoiceUrl,
        receiptUrl: payment.receiptUrl
      });
    });

    deliveries.forEach(delivery => {
      if (delivery.discountAmount && delivery.discountAmount > 0) {
        let paymentDate: string | Date;
        try {
          paymentDate = delivery.createdAt 
            ? new Date(delivery.createdAt) 
            : new Date();
        } catch (e) {
          console.warn('Invalid discount date:', delivery.createdAt);
          paymentDate = new Date();
        }
        
        this.paymentTransactions.push({
          id: `disc_${delivery.id}`,
          deliveryId: delivery.id,
          amount: -this.parseAmount(delivery.discountAmount),
          paymentMethod: 'DISCOUNT',
          paymentDate: paymentDate,
          status: PaymentStatus.COMPLETED,
          description: `Discount applied for delivery to ${delivery.deliveryAddress}`,
          type: 'DISCOUNT'
        });
      }
    });
    
    this.paymentTransactions.sort((a, b) => {
      const dateA = a.paymentDate instanceof Date ? a.paymentDate : new Date(a.paymentDate);
      const dateB = b.paymentDate instanceof Date ? b.paymentDate : new Date(b.paymentDate);
      return dateB.getTime() - dateA.getTime();
    });
  }

  private parseAmount(amount: any): number {
    if (amount === null || amount === undefined) return 0;
    
    if (typeof amount === 'string') {
      const numericString = amount.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(numericString);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return typeof amount === 'number' ? amount : 0;
  }

  // Template helper methods
  changeView(view: 'orders' | 'payments' | 'movements') {
    this.selectedView = view;
    if (view === 'payments') {
      this.loadPaymentTransactions();
    }
  }

  filterDeliveries(filter: 'all' | 'paid' | 'unpaid' | 'cancelled' | 'expired' | 'pending-ratings') {
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
      case 'pending-ratings':
        this.filteredDeliveries = this.recentDeliveries.filter(d => 
          d.status === 'DELIVERED' && !d.rated
        );
        break;
      default:
        this.filteredDeliveries = [...this.recentDeliveries];
    }
    
    console.log(`Filtered ${this.filteredDeliveries.length} deliveries for filter: ${filter}`);
  }

  getStatusCount(status: string): number {
    switch (status) {
      case 'paid': return this.stats.paidOrders;
      case 'unpaid': return this.stats.unpaidOrders;
      case 'cancelled': return this.stats.canceledOrders;
      case 'expired': return this.stats.expiredOrders;
      case 'pending-ratings': return this.getPendingRatingsCount();
      default: return this.stats.totalOrders;
    }
  }

  getPaymentStatusIcon(status?: string): string {
    if (!status) return 'fa-question-circle';
    
    const icons: { [key: string]: string } = {
      [PaymentStatus.COMPLETED]: 'fa-check-circle text-success',
      [PaymentStatus.PENDING]: 'fa-clock text-warning',
      [PaymentStatus.FAILED]: 'fa-times-circle text-danger',
      [PaymentStatus.REFUNDED]: 'fa-exchange-alt text-info'
    };
    
    return icons[status] || 'fa-question-circle text-secondary';
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

  getPaymentMethodPercentage(method: string): number {
    const total = this.paymentSummary.totalCompleted;
    if (total === 0) return 0;
    
    const methodData = this.paymentSummary.methodBreakdown.find(m => m.method === method);
    return methodData ? Math.round((methodData.count / total) * 100) : 0;
  }

  getPaymentStatusPercentage(status: PaymentStatus): number {
    const total = this.recentDeliveries.filter(d => d.status === 'DELIVERED').length;
    if (total === 0) return 0;
    
    const count = this.recentDeliveries.filter(d => 
      d.status === 'DELIVERED' && d.paymentStatus === status
    ).length;
    
    return Math.round((count / total) * 100);
  }

  getMethodColor(method: string): string {
    const colors: { [key: string]: string } = {
      'CREDIT_CARD': 'primary',
      'BANK_TRANSFER': 'info',
      'CASH': 'success',
      'CASH_ON_DELIVERY': 'success',
      'MOBILE_MONEY': 'warning',
      'WALLET': 'warning',
      'DISCOUNT': 'secondary'
    };
    return colors[method] || 'dark';
  }

  getTrendBarHeight(amount: number): number {
    const maxAmount = Math.max(...this.paymentSummary.monthlyTrend.map(m => m.amount), 1);
    return Math.min((amount / maxAmount) * 100, 100);
  }

  getPaymentHistory() {
    return this.paymentTransactions.filter(t => t.type === 'PAYMENT');
  }

  getDiscountHistory() {
    return this.paymentTransactions.filter(t => t.type === 'DISCOUNT');
  }

  getTotalPaymentsAmount(): number {
    return this.getPaymentHistory().reduce((sum, t) => sum + t.amount, 0);
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

  getEmptyStateMessage(): string {
    switch (this.selectedFilter) {
      case 'paid': return 'No paid orders found';
      case 'unpaid': return 'No unpaid orders found';
      case 'cancelled': return 'No cancelled orders found';
      case 'expired': return 'No expired orders found';
      case 'pending-ratings': return 'No deliveries pending rating found';
      default: return 'No delivery requests found';
    }
  }

  getEmptyStateDescription(): string {
    switch (this.selectedFilter) {
      case 'paid': return 'You haven\'t made any payments yet.';
      case 'unpaid': return 'All your delivered orders have been paid.';
      case 'cancelled': return 'You haven\'t cancelled any orders.';
      case 'expired': return 'No orders have expired.';
      case 'pending-ratings': return 'All your completed deliveries have been rated.';
      default: return 'Start by creating your first delivery request.';
    }
  }

  // Action methods
  openPaymentDialog(delivery: DeliveryRequest): void {
    if (!delivery.id) return;
    
    // Clear any existing query params first
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });

    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '700px',
      disableClose: true,
      data: { 
        deliveryId: delivery.id,
        clientId: this.clientId
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.refreshDashboardData();
      } else if (result?.error) {
        this.errorMessage = result.error;
      }
      
      // Clear query params after dialog closes
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    });
  }

  retryFailedPayment(delivery: DeliveryRequest): void {
    if (!delivery.id) return;
    
    this.router.navigate(['/client/payment'], {
      queryParams: {
        deliveryId: delivery.id,
        clientId: this.clientId,
        retry: true
      }
    });
  }

  viewPaymentDetails(payment: PaymentTransaction): void {
    if (!payment.id) return;
    
    this.router.navigate(['/client/payments', payment.id]);
  }

  viewDeliveryDetails(deliveryId: string) {
    this.router.navigate(['/client/orders', deliveryId]);
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
          this.toastService.showSuccess('Delivery cancelled successfully!');
        },
        error: (err) => {
          this.toastService.showError('Error: ' + err.message);
          if (delivery) {
            delivery.processing = false;
          }
        }
      });
    }
  }

  rateDelivery(delivery: DeliveryRequest, rating: number): void {
    if (!delivery?.id) {
      console.error('Invalid delivery');
      return;
    }

    // Validate delivery can be rated
    if (delivery.status !== 'DELIVERED') {
      this.errorMessage = 'You can only rate completed deliveries';
      return;
    }

    if (rating < 1 || rating > 5) {
      this.errorMessage = 'Rating must be between 1 and 5';
      return;
    }

    if (delivery.rated) {
      this.errorMessage = 'You have already rated this delivery';
      return;
    }

    delivery.processing = true;
    this.errorMessage = '';

    this.deliveryService.rateDelivery(delivery.id, rating).subscribe({
      next: () => {
        // Update UI optimistically
        delivery.rating = rating;
        delivery.rated = true;
        delivery.status = 'RATED';
        delivery.processing = false;
        
        this.toastService.showSuccess('Rating submitted successfully');
      },
      error: (err) => {
        console.error('Rating error:', err);
        delivery.processing = false;
        this.errorMessage = err.message || 'Failed to submit rating';
        this.toastService.showError(this.errorMessage);
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
      this.toastService.showInfo('No unpaid orders found');
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
        this.toastService.showSuccess('Receipt downloaded successfully');
      },
      error: (err: any) => {
        console.error('Error downloading receipt:', err);
        this.toastService.showError('Error downloading receipt. Please try again.');
      }
    });
  }

  checkExpiredDeliveries() {
    this.deliveryService.expireOldDeliveries().subscribe({
      next: () => {
        console.log('Expired deliveries checked successfully');
        this.refreshDashboardData();
      },
      error: (err: any) => {
        console.error('Error checking expired deliveries:', err.message);
      }
    });
  }

  goToDeliveryRequest() {
    this.router.navigate(['/client/delivery-request']);
  }

  filterPayments(filter: string): void {
    console.log('Filtering payments by:', filter);
    // Implement payment filtering logic based on your requirements
    switch (filter) {
      case 'completed':
        this.paymentTransactions = this.paymentTransactions.filter(t => 
          t.status === PaymentStatus.COMPLETED
        );
        break;
      case 'pending':
        this.paymentTransactions = this.paymentTransactions.filter(t => 
          t.status === PaymentStatus.PENDING
        );
        break;
      case 'failed':
        this.paymentTransactions = this.paymentTransactions.filter(t => 
          t.status === PaymentStatus.FAILED
        );
        break;
      default:
        // Show all payments
        this.loadPaymentTransactions();
        break;
    }
  }

  // Loading and utility methods
  loadPaymentTransactions(): void {
    this.loadPaymentTransactionsPromise()
      .then(() => console.log('Payment transactions loaded'))
      .catch(err => console.error('Error loading payment transactions:', err));
  }

  loadRecentDeliveries(): void {
    this.loadRecentDeliveriesPromise()
      .then(() => console.log('Recent deliveries loaded'))
      .catch(err => console.error('Error loading recent deliveries:', err));
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
          this.generatePaymentTransactions(deliveries, []);
          resolve();
        },
        error: (err) => {
          console.error('Error loading payment transactions:', err);
          resolve();
        }
      });
    });
  }

  private updatePaymentStats(): void {
    // Update payment summary stats
    this.paymentSummary.totalCompleted = this.recentDeliveries
      .filter(d => d.paymentStatus === PaymentStatus.COMPLETED).length;
    
    // Update dashboard stats
    this.stats.paidOrders = this.recentDeliveries
      .filter(d => d.paymentStatus === PaymentStatus.COMPLETED).length;
    
    this.stats.unpaidOrders = this.recentDeliveries
      .filter(d => d.status === 'DELIVERED' && 
                  d.paymentStatus !== PaymentStatus.COMPLETED).length;
    
    // Recalculate payment rate
    if (this.stats.completedOrders > 0) {
      this.stats.paymentRate = Math.round(
        (this.stats.paidOrders / this.stats.completedOrders) * 100
      );
    }
    
    // Update total paid amount
    this.stats.totalPaidAmount = this.recentDeliveries
      .filter(d => d.paymentStatus === PaymentStatus.COMPLETED)
      .reduce((sum, d) => sum + this.parseAmount(d.amount || 0), 0);
    
    // Update total unpaid amount
    this.stats.totalUnpaidAmount = this.recentDeliveries
      .filter(d => d.status === 'DELIVERED' && 
                  d.paymentStatus !== PaymentStatus.COMPLETED)
      .reduce((sum, d) => sum + this.parseAmount(d.amount || 0), 0);
  }

  // Error handling methods
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
      canceledOrders: 0,
      expiredOrders: 0,
      unpaidOrders: 0,
      thisMonthOrders: 0,
      paymentRate: 0,
      totalPaidAmount: 0,
      totalUnpaidAmount: 0,
      totalSavings: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      deliveryRate: 0,
      paymentMethods: {},
      statusDistribution: {}
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

  private showPaymentFailedNotification(deliveryId: string): void {
    const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
    if (delivery) {
      delivery.paymentStatus = PaymentStatus.FAILED as any;
      this.errorMessage = 'Payment processing failed. Please try again.';
      this.calculateStats(this.recentDeliveries);
    }
  }

  private verifyPaymentStatus(paymentId: string, deliveryId: string): void {
    this.paymentService.getPaymentStatus(paymentId).pipe(
      take(1)
    ).subscribe({
      next: (statusResponse) => {
        console.log('Payment verification result:', statusResponse);
        // The data will be updated in the next scheduled refresh
      },
      error: (err) => {
        console.error('Error verifying payment:', err);
      }
    });
  }

  private loadDashboardStats(): void {
    this.isLoading = true;
    
    forkJoin([
      this.deliveryService.getClientDeliveries(this.clientId),
      this.paymentService.getPaymentsByClient(this.clientId)
    ]).subscribe({
      next: ([deliveries, paymentsResponse]) => {
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

  private handleQueryParams(params: any): void {
    console.log('Query params received:', params);
    
    if (params['paymentSuccess'] === 'true') {
      this.handlePaymentSuccess(params['deliveryId'], params['paymentId']);
      this.clearAllQueryParams();
    }

    if (params['refresh'] === 'true') {
      this.refreshDashboardData();
      this.clearAllQueryParams();
    }
  }

  private clearAllQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  private clearRefreshParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { refresh: null, paymentSuccess: null, deliveryId: null, paymentId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Ouvre le dialog d'évaluation pour une livraison
   */
  openRatingDialog(delivery: DeliveryRequest): void {
    if (!delivery.id) {
      this.toastService.showError('Erreur: ID de livraison manquant');
      return;
    }

    // Vérifier que la livraison peut être évaluée
    if (delivery.status !== 'DELIVERED') {
      this.toastService.showError('Cette livraison n\'est pas encore terminée');
      return;
    }

    if (delivery.rated) {
      this.toastService.showInfo('Cette livraison a déjà été évaluée');
      return;
    }

    const dialogRef = this.dialog.open(DeliveryRatingModalComponent, {
      width: '700px',
      maxHeight: '90vh',
      disableClose: true,
      data: { 
        delivery: delivery 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Mettre à jour la livraison avec les nouvelles données d'évaluation
        delivery.rated = true;
        delivery.rating = result.rating.overallRating;
        delivery.status = 'RATED';
        
        this.toastService.showSuccess('Évaluation soumise avec succès!');
        this.refreshDashboardData();
      }
    });
  }

  /**
   * Affiche les détails d'une évaluation existante
   */
viewRatingDetails(delivery: DeliveryRequest): void {
  if (!delivery.id || !delivery.rated) {
    this.toastService.showError('Aucune évaluation trouvée pour cette livraison');
    return;
  }

  delivery.processing = true;

  this.deliveryService.getDetailedRating(delivery.id).subscribe({
    next: (rating: DetailedRatingResponse) => {
      delivery.processing = false;
      this.openRatingDetailsModal(rating);
    },
    error: (error: any) => {
      delivery.processing = false;
      this.toastService.showError('Erreur lors du chargement de l\'évaluation: ' + error.message);
    }
  });
}

private openRatingDetailsModal(ratingData: DetailedRatingResponse): void {
  const dialogRef = this.dialog.open(RatingDetailsModalComponent, {
    width: '650px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    disableClose: false,
    panelClass: 'rating-details-dialog', // Pour le styling personnalisé
    data: { 
      ratingData: ratingData 
    }
  });

  // Optionnel: gérer les actions après fermeture
  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      console.log('Rating details modal closed:', result);
    }
  });
}
getDeliveryRowClass(delivery: DeliveryRequest): string {
  let classes = 'table-row-animated';
  
  // Ajouter une classe pour les livraisons en attente d'évaluation
  if (delivery.status === 'DELIVERED' && !delivery.rated) {
    classes += ' rating-pending';
  }
  
  // Ajouter une classe pour les livraisons déjà évaluées
  if (delivery.rated) {
    classes += ' rating-completed';
  }
  
  return classes;
}

getRatingStatusIcon(delivery: DeliveryRequest): string {
  if (delivery.status !== 'DELIVERED') {
    return 'fas fa-minus text-muted';
  }
  
  if (delivery.rated) {
    return `fas fa-star text-warning`;
  }
  
  return 'fas fa-star-o text-muted';
}

/**
 * Méthode pour obtenir le tooltip d'évaluation
 */
getRatingTooltip(delivery: DeliveryRequest): string {
  if (delivery.status !== 'DELIVERED') {
    return 'Livraison non terminée';
  }
  
  if (delivery.rated) {
    return `Évalué ${delivery.rating}/5 étoiles - Cliquer pour voir les détails`;
  }
  
  return 'Cliquer pour évaluer cette livraison';
}
getRatingSummary(): { 
  total: number, 
  rated: number, 
  pending: number, 
  averageRating: number 
} {
  const deliveredOrders = this.recentDeliveries.filter(d => d.status === 'DELIVERED');
  const ratedOrders = deliveredOrders.filter(d => d.rated);
  const pendingRatings = deliveredOrders.filter(d => !d.rated);
  
  const totalRating = ratedOrders.reduce((sum, d) => sum + (d.rating || 0), 0);
  const averageRating = ratedOrders.length > 0 ? totalRating / ratedOrders.length : 0;
  
  return {
    total: deliveredOrders.length,
    rated: ratedOrders.length,
    pending: pendingRatings.length,
    averageRating: Math.round(averageRating * 10) / 10
  };
}

canRateDelivery(delivery: DeliveryRequest): boolean {
  return delivery.status === 'DELIVERED' && !delivery.rated;
}

private showRatingEncouragement(): void {
  const pendingCount = this.getPendingRatingsCount();
  
  if (pendingCount > 0) {
    // Créer une notification personnalisée avec action
    const notification = {
      id: Date.now(),
      type: 'info' as const,
      title: 'Évaluations en attente',
      message: pendingCount === 1 
        ? 'Vous avez une livraison à évaluer'
        : `Vous avez ${pendingCount} livraisons à évaluer`,
      action: {
        label: 'Voir',
        callback: () => this.showPendingRatings()
      }
    };
    
    // Vous pouvez adapter ceci selon votre système de notifications
    this.toastService.showNotification(notification);
  }
} 


showPendingRatings(): void {
  this.selectedFilter = 'pending-ratings';
  this.filteredDeliveries = this.recentDeliveries.filter(d => 
    d.status === 'DELIVERED' && !d.rated
  );
}

private generateRatingStats(): void {
  const summary = this.getRatingSummary();
  
  // Ajouter aux stats existantes
  this.stats = {
    ...this.stats,
    ratingStats: {
      totalDelivered: summary.total,
      totalRated: summary.rated,
      pendingRatings: summary.pending,
      averageRating: summary.averageRating,
      ratingRate: summary.total > 0 ? Math.round((summary.rated / summary.total) * 100) : 0
    }
  };
}

/**
 * Méthode pour afficher une preview rapide de l'évaluation dans le tableau
 */
getRatingPreview(delivery: DeliveryRequest): string {
  if (!delivery.rated || !delivery.rating) {
    return '';
  }
  
  const stars = '★'.repeat(Math.floor(delivery.rating)) + 
                '☆'.repeat(5 - Math.floor(delivery.rating));
  return `${stars} (${delivery.rating}/5)`;
}

/**
 * Méthode pour gérer l'état de chargement des évaluations
 */
private setRatingLoading(deliveryId: string, isLoading: boolean): void {
  const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
  if (delivery) {
    delivery.processing = isLoading;
  }
}

/**
 * Méthode pour actualiser une évaluation spécifique après modification
 */
refreshRatingData(deliveryId: string): void {
  this.setRatingLoading(deliveryId, true);
  
  this.deliveryService.getDeliveryById(deliveryId).subscribe({
    next: (updatedDelivery: DeliveryRequest) => {
      const index = this.recentDeliveries.findIndex(d => d.id === deliveryId);
      if (index !== -1) {
        // Préserver l'état de traitement
        const wasProcessing = this.recentDeliveries[index].processing;
        this.recentDeliveries[index] = { ...updatedDelivery, processing: wasProcessing };
      }
      this.setRatingLoading(deliveryId, false);
      this.calculateStats(this.recentDeliveries);
    },
    error: (error: any) => {
      this.setRatingLoading(deliveryId, false);
      console.error('Erreur lors de l\'actualisation de l\'évaluation:', error);
    }
  });
}

  /**
   * Affiche une modal avec les détails de l'évaluation
   */
  private showRatingDetailsModal(rating: DetailedRatingResponse): void {
    // Vous pouvez créer un autre composant modal pour afficher les détails
    // ou utiliser une simple alert/modal Bootstrap pour commencer
    const modalContent = this.generateRatingDetailsHTML(rating);
    
    // Option simple avec une modal Bootstrap
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-star text-warning"></i>
              Détails de l'évaluation
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${modalContent}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              Fermer
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Utiliser Bootstrap Modal
    const bootstrapModal = new (window as any).bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Nettoyer après fermeture
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }

  /**
   * Génère le HTML pour afficher les détails de l'évaluation
   */
  private generateRatingDetailsHTML(rating: DetailedRatingResponse): string {
    const stars = (count: number) => {
      return Array(5).fill(0).map((_, i) => 
        `<i class="fas fa-star ${i < count ? 'text-warning' : 'text-muted'}"></i>`
      ).join('');
    };

    return `
      <div class="rating-details">
        <div class="row mb-3">
          <div class="col-md-6">
            <h6>Livraison</h6>
            <p class="text-muted">#${rating.deliveryId.slice(0, 8)}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${rating.deliveryAddress}</p>
          </div>
          <div class="col-md-6">
            <h6>Évaluation globale</h6>
            <div class="mb-2">
              ${stars(Math.round(rating.overallRating))}
              <span class="ms-2 fw-bold">${rating.overallRating}/5</span>
            </div>
            <small class="text-muted">Type: ${this.getRatingTypeLabel(rating.ratingType)}</small>
          </div>
        </div>

        ${rating.punctualityRating || rating.professionalismRating || rating.packageConditionRating || rating.communicationRating ? `
        <div class="detailed-ratings mb-3">
          <h6>Évaluations détaillées</h6>
          <div class="row">
            ${rating.punctualityRating ? `
            <div class="col-md-6 mb-2">
              <small class="text-muted d-block">Ponctualité</small>
              ${stars(Math.round(rating.punctualityRating))} (${rating.punctualityRating}/5)
            </div>` : ''}
            ${rating.professionalismRating ? `
            <div class="col-md-6 mb-2">
              <small class="text-muted d-block">Professionnalisme</small>
              ${stars(Math.round(rating.professionalismRating))} (${rating.professionalismRating}/5)
            </div>` : ''}
            ${rating.packageConditionRating ? `
            <div class="col-md-6 mb-2">
              <small class="text-muted d-block">État du colis</small>
              ${stars(Math.round(rating.packageConditionRating))} (${rating.packageConditionRating}/5)
            </div>` : ''}
            ${rating.communicationRating ? `
            <div class="col-md-6 mb-2">
              <small class="text-muted d-block">Communication</small>
              ${stars(Math.round(rating.communicationRating))} (${rating.communicationRating}/5)
            </div>` : ''}
          </div>
        </div>` : ''}

        ${rating.categories && rating.categories.length > 0 ? `
        <div class="rating-categories mb-3">
          <h6>Aspects appréciés</h6>
          <div class="d-flex flex-wrap gap-2">
            ${rating.categories.map(cat => `
              <span class="badge bg-success">${this.getCategoryLabel(cat)}</span>
            `).join('')}
          </div>
        </div>` : ''}

        ${rating.comment ? `
        <div class="rating-comment mb-3">
          <h6>Commentaire</h6>
          <div class="p-3 bg-light rounded">
            <i class="fas fa-quote-left text-muted"></i>
            <em class="ms-2">${rating.comment}</em>
            <i class="fas fa-quote-right text-muted ms-2"></i>
          </div>
        </div>` : ''}

        ${rating.wouldRecommend !== null ? `
        <div class="recommendation mb-3">
          <h6>Recommandation</h6>
          <p class="mb-0">
            <i class="fas fa-${rating.wouldRecommend ? 'thumbs-up text-success' : 'thumbs-down text-danger'}"></i>
            <span class="ms-2">
              ${rating.wouldRecommend ? 'Recommanderait ExpedNow' : 'Ne recommanderait pas ExpedNow'}
            </span>
          </p>
        </div>` : ''}

        <div class="rating-meta">
          <small class="text-muted">
            <i class="fas fa-calendar"></i>
            Évalué le ${new Date(rating.ratedAt).toLocaleDateString('fr-FR')}
          </small>
        </div>
      </div>
    `;
  }

  /**
   * Obtient le libellé d'un type d'évaluation
   */
  private getRatingTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'overall': 'Service Global',
      'delivery_person': 'Livreur',
      'service': 'Qualité du Service'
    };
    return labels[type] || type;
  }

  /**
   * Obtient le libellé d'une catégorie d'évaluation
   */
  private getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'punctuality': 'Ponctualité',
      'professionalism': 'Professionnalisme',
      'package_condition': 'État du Colis',
      'communication': 'Communication'
    };
    return labels[category] || category;
  }

  /**
   * Vérifie s'il y a des livraisons en attente d'évaluation
   */
  getPendingRatingsCount(): number {
    return this.recentDeliveries.filter(d => 
      d.status === 'DELIVERED' && !d.rated
    ).length;
  }

  /**
   * Affiche une notification pour encourager les évaluations
   */
  private checkPendingRatings(): void {
    const pendingCount = this.getPendingRatingsCount();
    
    if (pendingCount > 0) {
      // Afficher une notification discrète
      setTimeout(() => {
        if (pendingCount === 1) {
          this.toastService.showInfo(
            'Vous avez une livraison terminée qui peut être évaluée',
            'Évaluation en attente'
          );
        } else {
          this.toastService.showInfo(
            `Vous avez ${pendingCount} livraisons terminées qui peuvent être évaluées`,
            'Évaluations en attente'
          );
        }
      }, 3000); // Délai de 3 secondes après le chargement
    }
  }


  

  /**
   * Filtre les livraisons pour n'afficher que celles en attente d'évaluation
   */
 
}