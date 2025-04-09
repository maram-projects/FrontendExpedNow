import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { NotificationService } from '../../../services/notification.service';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { WebSocketService, AppNotification } from '../../../services/web-socket.service';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
}

@Component({
  selector: 'app-delivery-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './delivery-dashboard.component.html',
  styleUrls: ['./delivery-dashboard.component.css']
})
export class DeliveryDashboardComponent implements OnInit, OnDestroy {
  private wsSubscription!: Subscription;
  private locationSubscription!: Subscription;
  private notificationSubscription!: Subscription;
  
  userType: string = '';
  stats: DashboardStats = {
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0
  };

  deliveries: DeliveryRequest[] = [];
  availability: boolean = true;
  latitude: number = 0;
  longitude: number = 0;
  
  notifications: AppNotification[] = [];
  hasUnreadNotifications: boolean = false;

  constructor(
    private authService: AuthService,
    private deliveryService: DeliveryService,
    private webSocketService: WebSocketService,
    private notificationService: NotificationService
  ) {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.userType = currentUser.userType;
    }
  }
  
  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
    this.locationSubscription?.unsubscribe();
    this.notificationSubscription?.unsubscribe();
    this.webSocketService.close();
  }

  ngOnInit() {
    this.loadDashboardStats();
    this.loadAssignedDeliveries();
    this.loadUnreadNotifications();
    this.setupWebSocket();
    this.setupLocationTracking();
  }
  
  private loadData() {
    this.loadDashboardStats();
    this.loadAssignedDeliveries();
    this.loadUnreadNotifications();
  }
  
  private loadUnreadNotifications() {
    this.notificationService.getUnreadNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.hasUnreadNotifications = notifications.length > 0;
      },
      error: (err) => console.error('Error loading notifications', err)
    });
  }

  private setupWebSocket() {
    // Subscribe to delivery assignments
    this.wsSubscription = this.webSocketService.getNotificationsByType('DELIVERY_ASSIGNMENT')
      .subscribe({
        next: (notification) => {
          console.log('New delivery assignment received:', notification);
          this.loadData();
          this.showNotification(notification.title, notification.message);
        },
        error: (err) => console.error('WebSocket error:', err)
      });
    
    // Subscribe to all notifications
    this.notificationSubscription = this.webSocketService.getAllNotifications()
      .subscribe({
        next: (notification) => {
          this.notifications.unshift(notification);
          this.hasUnreadNotifications = true;
        }
      });
  }
  
  // Track location periodically
  private setupLocationTracking() {
    if (navigator.geolocation) {
      // Update location every 2 minutes
      this.locationSubscription = interval(120000)
        .pipe(
          switchMap(() => {
            return new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject);
            });
          }),
          takeWhile(() => this.availability) // Only track if delivery person is available
        )
        .subscribe({
          next: (position) => {
            this.latitude = position.coords.latitude;
            this.longitude = position.coords.longitude;
            this.updateLocation();
          },
          error: (err) => console.error('Error getting location:', err)
        });
      
      // Initial location update
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.latitude = position.coords.latitude;
          this.longitude = position.coords.longitude;
          this.updateLocation();
        },
        (err) => console.error('Error getting initial location:', err)
      );
    }
  }

  loadAssignedDeliveries() {
    this.deliveryService.getAssignedDeliveries().subscribe({
      next: (data) => {
        this.deliveries = data.sort((a, b) => 
          new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
        );
      },
      error: (err) => console.error('Error loading deliveries', err)
    });
  }
  
  loadDashboardStats() {
    // Based on actual assigned deliveries
    this.deliveryService.getAssignedDeliveries().subscribe({
      next: (data) => {
        this.stats.totalOrders = data.length;
        this.stats.pendingOrders = data.filter(d => d.status === 'PENDING' || d.status === 'APPROVED' || d.status === 'IN_TRANSIT').length;
        this.stats.completedOrders = data.filter(d => d.status === 'DELIVERED').length;
      },
      error: (err) => console.error('Error loading stats', err)
    });
  }

  updateStatus(deliveryId: string, status: string) {
    this.deliveryService.updateDeliveryStatus(deliveryId, status).subscribe({
      next: () => {
        this.loadAssignedDeliveries();
        this.loadDashboardStats();
      },
      error: (err) => console.error('Error updating status', err)
    });
  }

  updateLocation() {
    this.deliveryService.updateLocation(this.latitude, this.longitude).subscribe({
      next: () => console.log('Location updated successfully'),
      error: (err) => console.error('Error updating location', err)
    });
  }

  updateAvailability() {
    this.deliveryService.updateAvailability(this.availability).subscribe({
      next: () => console.log('Availability updated'),
      error: (err) => console.error('Error updating availability', err)
    });
  }
  
  markNotificationAsRead(notification: AppNotification) {
    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.read = true;
        this.hasUnreadNotifications = this.notifications.some(n => !n.read);
      },
      error: (err) => console.error('Error marking notification as read', err)
    });
  }
  
  openMap(delivery: DeliveryRequest) {
    // Example implementation - could open a map modal or navigate to a map view
    console.log('Opening map for delivery:', delivery);
    
    // Example: Open in Google Maps
    const origin = encodeURIComponent(delivery.pickupAddress);
    const destination = encodeURIComponent(delivery.deliveryAddress);
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`, '_blank');
  }
  
  showNotification(title: string, message: string) {
    // Check if browser notifications are supported
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body: message });
          }
        });
      }
    }
  }
}