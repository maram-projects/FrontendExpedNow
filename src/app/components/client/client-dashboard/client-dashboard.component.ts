// client-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
  canceledOrders?: number;
  unknownStatus?: number;
}

@Component({
  selector: 'app-client-dashboard',
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.css'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    DatePipe
  ]
})
export class ClientDashboardComponent implements OnInit {
  userType: string = '';
  clientId: string = '';
  stats: DashboardStats = {
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0
  };
  recentDeliveries: DeliveryRequest[] = [];
  activeDiscounts: Discount[] = [];
  unpaidDeliveries: number = 0;
  isLoading = true;
  errorMessage = '';

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
  }
  cancelDelivery(deliveryId: string) {
    if (confirm('Are you sure you want to cancel this delivery?')) {
      this.deliveryService.cancelDelivery(deliveryId).subscribe({
        next: () => {
          this.loadDashboardStats();
          this.loadRecentDeliveries();
          alert('Delivery cancelled successfully!');
        },
        error: (err) => alert('Error: ' + err.message)
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
        // يمكنك عرض رسالة للمستخدم هنا
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
          const validStatuses = ['DELIVERED', 'IN_TRANSIT', 'PENDING', 'CANCELLED'];
          
          const statusCounts = deliveries.reduce((acc, delivery) => {
            const status = delivery?.status?.toUpperCase() || 'UNKNOWN';
            const normalizedStatus = validStatuses.includes(status) 
              ? status 
              : 'UNKNOWN';
              
            acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Calculate unpaid deliveries
          this.unpaidDeliveries = deliveries.filter(d => 
            d.status === 'DELIVERED' && 
            (!d.paymentStatus || d.paymentStatus === 'UNPAID')
          ).length;
  
          this.stats = {
            totalOrders: deliveries.length,
            pendingOrders: (statusCounts['PENDING'] || 0) + (statusCounts['IN_TRANSIT'] || 0),
            completedOrders: statusCounts['DELIVERED'] || 0,
            canceledOrders: statusCounts['CANCELLED'] || 0,
            unknownStatus: statusCounts['UNKNOWN'] || 0
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
          new Date(d.validUntil) > new Date()
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
          .slice(0, 5);
      },
      error: (err) => {
        console.error('Error loading recent deliveries:', err);
      }
    });
  }

  openPaymentDialog(delivery: DeliveryRequest): void {
    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '600px',
      data: {
        delivery,
        clientId: this.clientId,
        discounts: this.activeDiscounts
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Refresh data
        this.loadDashboardStats();
        this.loadRecentDeliveries();
        this.loadActiveDiscounts();
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
      canceledOrders: 0,
      unknownStatus: 0
    };
    this.errorMessage = 'Error processing delivery data. Showing partial information.';
  }
}