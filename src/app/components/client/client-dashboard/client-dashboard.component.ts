import { Component, OnInit } from '@angular/core';
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
import { PaymentStatus } from '../../../models/Payment.model';

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
  // Added new properties
  expiredOrders?: number;
  unpaidOrders?: number;
  totalRevenue?: number;
  averageOrderValue?: number;
  deliveryRate?: number;
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
export class ClientDashboardComponent implements OnInit {
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
  unpaidDeliveries: number = 0;
  isLoading = true;
  errorMessage = '';
  selectedFilter: 'all' | 'paid' | 'unpaid' = 'all';

  constructor(
    private authService: AuthService,
    private deliveryService: DeliveryService,
    private discountService: DiscountService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute
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
    this.loadDashboardStats();
    this.loadRecentDeliveries();
    this.loadActiveDiscounts();
    this.checkExpiredDeliveries();
  
    this.route.queryParams.subscribe(params => {
      if (params['paymentSuccess'] === 'true' && params['deliveryId']) {
        this.handlePaymentSuccess(params['deliveryId'], params['paymentId']);
      }

      if (params['refresh']) {
        this.loadDashboardStats();
        this.loadRecentDeliveries();
        this.loadActiveDiscounts();
    
        if (params['paymentSuccess'] === 'true' && params['deliveryId']) {
          this.showPaymentSuccessModal(params['deliveryId'], params['paymentId']);
        }
      }
    });
  }

  private handlePaymentSuccess(deliveryId: string, paymentId: string): void {
    const deliveryIndex = this.recentDeliveries.findIndex(d => d.id === deliveryId);
    if (deliveryIndex !== -1) {
      this.recentDeliveries[deliveryIndex].paymentStatus = PaymentStatus.COMPLETED;
      this.recentDeliveries[deliveryIndex].paymentId = paymentId;
      this.recentDeliveries[deliveryIndex].paymentDate = new Date().toISOString();
      
      this.filterDeliveries(this.selectedFilter);
      this.loadDashboardStats();
    }

    const delivery = this.recentDeliveries[deliveryIndex];
    if (delivery) {
      const modalRef = this.dialog.open(PaymentSuccessModalComponent, {
        data: {
          deliveryId: delivery.id,
          amount: delivery.amount,
          paymentMethod: delivery.paymentMethod || 'Unknown'
        }
      });

      modalRef.afterClosed().subscribe(() => {
        this.loadRecentDeliveries();
      });
    }
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
        this.loadDashboardStats();
        this.loadRecentDeliveries();
      });
    }
  }

  cancelDelivery(deliveryId: string) {
    if (confirm('Are you sure you want to cancel this delivery?')) {
      const delivery = this.recentDeliveries.find(d => d.id === deliveryId);
      if (delivery) {
        delivery.processing = true;
      }

      this.deliveryService.cancelDelivery(deliveryId).subscribe({
        next: () => {
          this.loadDashboardStats();
          this.loadRecentDeliveries();
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

  filterDeliveries(filter: 'all' | 'paid' | 'unpaid') {
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
      default:
        this.filteredDeliveries = [...this.recentDeliveries];
    }
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
        this.loadDashboardStats();
        this.loadRecentDeliveries();
        this.loadActiveDiscounts();
      }
    });
  }

  getEmptyStateMessage(): string {
    switch (this.selectedFilter) {
      case 'paid': return 'No paid orders found';
      case 'unpaid': return 'No unpaid orders found';
      default: return 'No delivery requests found';
    }
  }

  getEmptyStateDescription(): string {
    switch (this.selectedFilter) {
      case 'paid': return 'You haven\'t made any payments yet.';
      case 'unpaid': return 'All your delivered orders have been paid.';
      default: return 'Start by creating your first delivery request.';
    }
  }

  getPaymentMethodLabel(method: string): string {
    const labels: { [key: string]: string } = {
      'CREDIT_CARD': 'Credit Card',
      'CASH_ON_DELIVERY': 'Cash on Delivery',
      'MOBILE_MONEY': 'Mobile Money',
      'BANK_TRANSFER': 'Bank Transfer'
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

  private loadDashboardStats(): void {
    if (!this.clientId || typeof this.clientId !== 'string') {
      console.error('Invalid client ID:', this.clientId);
      this.handleAuthError();
      return;
    }

    this.deliveryService.getClientDeliveries(this.clientId).subscribe({
      next: (deliveries: DeliveryRequest[]) => {
        try {
          const validDeliveries = deliveries.filter(delivery => 
            delivery && typeof delivery === 'object'
          );

          if (validDeliveries.length === 0) {
            this.errorMessage = 'No delivery history found';
            this.isLoading = false;
            return;
          }

          const validStatuses = ['DELIVERED', 'IN_TRANSIT', 'PENDING', 'CANCELLED', 'APPROVED', 'ASSIGNED', 'EXPIRED'];
          
          const statusCounts = validDeliveries.reduce((acc, delivery) => {
            const status = delivery?.status?.toString().toUpperCase() || 'UNKNOWN';
            const normalizedStatus = validStatuses.includes(status) ? status : 'UNKNOWN';
            acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const deliveredOrders = validDeliveries.filter(d => 
            d.status?.toUpperCase() === 'DELIVERED'
          );

          const paidOrders = deliveredOrders.filter(d => {
            return d.paymentStatus === PaymentStatus.COMPLETED;
          });

          const unpaidOrders = deliveredOrders.filter(d => {
            return d.paymentStatus !== PaymentStatus.COMPLETED;
          });

          const thisMonthOrders = validDeliveries.filter(d => {
            if (!d.createdAt) return false;
            try {
              const orderDate = new Date(d.createdAt);
              if (isNaN(orderDate.getTime())) return false;
              return orderDate.getMonth() === currentMonth && 
                     orderDate.getFullYear() === currentYear;
            } catch (dateError) {
              console.warn('Invalid date format:', d.createdAt);
              return false;
            }
          }).length;

          const totalPaidAmount = paidOrders.reduce((sum, d) => {
            try {
              let amount = 0;
              if (d.amount) {
                if (typeof d.amount === 'string') {
amount = typeof d.amount === 'string' ? 
         parseFloat(d.amount.replace(/[^\d.-]/g, '')) || 0 :
         typeof d.amount === 'number' ? d.amount : 0;
                        } else if (typeof d.amount === 'number') {
                  amount = d.amount;
                }
              }
              return sum + (isNaN(amount) ? 0 : amount);
            } catch (error) {
              console.warn('Error parsing amount for delivery:', d.id, error);
              return sum;
            }
          }, 0);
          
          const totalUnpaidAmount = unpaidOrders.reduce((sum, d) => {
            try {
              let amount = 0;
              if (d.amount) {
                if (typeof d.amount === 'string') {
                  amount = parseFloat(d.amount.toString().replace(/[^\d.-]/g, '')) || 0;
                } else if (typeof d.amount === 'number') {
                  amount = d.amount;
                }
              }
              return sum + (isNaN(amount) ? 0 : amount);
            } catch (error) {
              console.warn('Error parsing amount for unpaid delivery:', d.id, error);
              return sum;
            }
          }, 0);
          
  const totalSavings = validDeliveries.reduce((sum, d) => {
  try {
    const delivery = d as any;
    const discountAmount = delivery.discountAmount;
    
    // Early return if no discount
    if (!discountAmount) {
      return sum;
    }
    
    let discount = 0;
    
    // Explicit type checking to avoid 'never' type
    if (discountAmount && typeof discountAmount === 'string') {
      const stringValue: string = discountAmount; // Explicit typing
      discount = parseFloat(stringValue.replace(/[^\d.-]/g, '')) || 0;
    } else if (discountAmount && typeof discountAmount === 'number') {
      discount = discountAmount;
    }
    
    return sum + discount;
  } catch (error) {
    console.warn('Error parsing discount for delivery:', d.id, error);
    return sum;
  }
}, 0);

          const paymentRate = deliveredOrders.length > 0 
            ? Math.round((paidOrders.length / deliveredOrders.length) * 100 * 100) / 100
            : 0;

          const pendingStatuses = ['PENDING', 'IN_TRANSIT', 'ASSIGNED', 'APPROVED'];
          const pendingOrders = pendingStatuses.reduce((sum, status) => 
            sum + (statusCounts[status] || 0), 0
          );

          this.unpaidDeliveries = unpaidOrders.length;

          this.stats = {
            totalOrders: validDeliveries.length,
            pendingOrders: pendingOrders,
            completedOrders: statusCounts['DELIVERED'] || 0,
            canceledOrders: statusCounts['CANCELLED'] || 0,
            expiredOrders: statusCounts['EXPIRED'] || 0,
            paidOrders: paidOrders.length,
            unpaidOrders: unpaidOrders.length,
            paymentRate: paymentRate,
            totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
            totalUnpaidAmount: Math.round(totalUnpaidAmount * 100) / 100,
            totalSavings: Math.round(totalSavings * 100) / 100,
            totalRevenue: Math.round((totalPaidAmount + totalUnpaidAmount) * 100) / 100,
            thisMonthOrders: thisMonthOrders,
            averageOrderValue: deliveredOrders.length > 0 
              ? Math.round(((totalPaidAmount + totalUnpaidAmount) / deliveredOrders.length) * 100) / 100
              : 0,
            deliveryRate: validDeliveries.length > 0 
              ? Math.round((deliveredOrders.length / validDeliveries.length) * 100 * 100) / 100
              : 0
          };

          console.log('Dashboard Statistics:', {
            totalDeliveries: validDeliveries.length,
            delivered: deliveredOrders.length,
            paid: paidOrders.length,
            unpaid: unpaidOrders.length,
            paymentRate: paymentRate + '%'
          });

        } catch (parseError) {
          console.error('Error processing delivery data:', parseError);
          this.handleDataError();
        }
        
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('API Error loading dashboard stats:', err);
        this.isLoading = false;
        
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
    });
  }

  private loadActiveDiscounts(): void {
    if (!this.clientId) return;
    
    this.discountService.getClientDiscounts(this.clientId).subscribe({
      next: (discounts) => {
        this.activeDiscounts = discounts.filter(d => 
          !d.used && 
          d.validUntil && new Date(d.validUntil) > new Date()
        );
      },
      error: (err) => console.error('Error loading discounts:', err)
    });
  }

  private loadRecentDeliveries() {
    if (!this.clientId) return;

    this.deliveryService.getClientDeliveries(this.clientId).subscribe({
      next: (deliveries: DeliveryRequest[]) => {
        this.recentDeliveries = deliveries
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 10);

        this.filterDeliveries(this.selectedFilter);
      },
      error: (err) => {
        console.error('Error loading recent deliveries:', err);
        this.filteredDeliveries = [];
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
}