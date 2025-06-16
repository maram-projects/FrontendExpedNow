// client-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { DiscountService } from '../../../services/discount.service';
import { Discount } from '../../../models/discount.model';
import { MatDialog } from '@angular/material/dialog';
import { PaymentDialogComponent } from '../payment-dialog/payment-dialog.component';
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
    private router: Router 
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
  }

  cancelDelivery(deliveryId: string) {
    if (confirm('Are you sure you want to cancel this delivery?')) {
      // Set processing state
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
          // Remove processing state on error
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
          d.paymentStatus === 'PAID'
        );
        break;
      case 'unpaid':
        this.filteredDeliveries = this.recentDeliveries.filter(d => 
          d.status === 'DELIVERED' && 
          (!d.paymentStatus || d.paymentStatus === 'UNPAID')
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
      (!d.paymentStatus || d.paymentStatus === 'UNPAID')
    );

    if (unpaidOrders.length === 0) {
      alert('No unpaid orders found');
      return;
    }

    if (confirm(`Are you sure you want to pay all ${unpaidOrders.length} unpaid orders?`)) {
      // You can implement bulk payment logic here
      // For now, let's open payment dialog for each order
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
      case 'paid':
        return 'No paid orders found';
      case 'unpaid':
        return 'No unpaid orders found';
      default:
        return 'No delivery requests found';
    }
  }

  getEmptyStateDescription(): string {
    switch (this.selectedFilter) {
      case 'paid':
        return 'You haven\'t made any payments yet.';
      case 'unpaid':
        return 'All your delivered orders have been paid.';
      default:
        return 'Start by creating your first delivery request.';
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

  // Fixed downloadReceipt method with proper typing
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
          const validStatuses = ['DELIVERED', 'IN_TRANSIT', 'PENDING', 'CANCELLED', 'APPROVED', 'ASSIGNED', 'EXPIRED'];
          
          const statusCounts = deliveries.reduce((acc, delivery) => {
            const status = delivery?.status?.toUpperCase() || 'UNKNOWN';
            const normalizedStatus = validStatuses.includes(status) 
              ? status 
              : 'UNKNOWN';
              
            acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Calculate payment statistics
          const deliveredOrders = deliveries.filter(d => d.status === 'DELIVERED');
          const paidOrders = deliveredOrders.filter(d => d.paymentStatus === 'PAID');
          
          // Calculate unpaid deliveries
          this.unpaidDeliveries = deliveredOrders.filter(d => 
            !d.paymentStatus || d.paymentStatus === 'UNPAID'
          ).length;

          // Calculate this month's orders
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const thisMonthOrders = deliveries.filter(d => {
            if (!d.createdAt) return false;
            const orderDate = new Date(d.createdAt);
            return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
          }).length;

          // Fixed financial calculations with proper type handling
          const totalPaidAmount = paidOrders.reduce((sum, d) => {
            const amount = typeof d.amount === 'string' ? parseFloat(d.amount) : (d.amount || 0);
            return sum + amount;
          }, 0);
          
          const totalUnpaidAmount = deliveredOrders
            .filter(d => !d.paymentStatus || d.paymentStatus === 'UNPAID')
            .reduce((sum, d) => {
              const amount = typeof d.amount === 'string' ? parseFloat(d.amount) : (d.amount || 0);
              return sum + amount;
            }, 0);
            
          const totalSavings = deliveries.reduce((sum, d) => sum + (d.discountAmount || 0), 0);

          // Calculate payment rate
          const paymentRate = deliveredOrders.length > 0 
            ? Math.round((paidOrders.length / deliveredOrders.length) * 100)
            : 0;

          this.stats = {
            totalOrders: deliveries.length,
            pendingOrders: (statusCounts['PENDING'] || 0) + 
                          (statusCounts['IN_TRANSIT'] || 0) + 
                          (statusCounts['ASSIGNED'] || 0) +
                          (statusCounts['APPROVED'] || 0),
            completedOrders: statusCounts['DELIVERED'] || 0,
            paidOrders: paidOrders.length,
            canceledOrders: statusCounts['CANCELLED'] || 0,
            unknownStatus: statusCounts['UNKNOWN'] || 0,
            thisMonthOrders,
            paymentRate,
            totalPaidAmount,
            totalUnpaidAmount,
            totalSavings
          };

          if (deliveries.length === 0) {
            this.errorMessage = 'No delivery history found';
          }

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
          .slice(0, 10); // Show more recent deliveries

        // Apply current filter
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
      canceledOrders: 0,
      unknownStatus: 0,
      thisMonthOrders: 0,
      paymentRate: 0,
      totalPaidAmount: 0,
      totalUnpaidAmount: 0,
      totalSavings: 0
    };
    this.errorMessage = 'Error processing delivery data. Showing partial information.';
  }
}