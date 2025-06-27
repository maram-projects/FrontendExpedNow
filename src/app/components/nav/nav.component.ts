import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { NotificationService } from '../../services/notification.service';
import { WebSocketService, AppNotification } from '../../services/web-socket.service';
import { Subscription } from 'rxjs';

interface Message {
  id: number;
  from: string;
  content: string;
  time: string;
  read: boolean;
  avatar: string;
}

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, NgbDropdownModule],
  template: `
    <nav class="navbar navbar-expand-lg">
      <div class="container">
        <a class="navbar-brand" routerLink="/">
          <span class="logo-text">Exped<span class="logo-highlight">Now</span></span>
        </a>
        
        <button class="navbar-toggler" type="button" (click)="toggleNavbar()" [class.collapsed]="!isNavbarOpen">
          <span class="toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" [ngClass]="{ 'show': isNavbarOpen }">
          <ul class="navbar-nav me-auto">
            <ng-container *ngIf="authService.getCurrentUser() as user">
              <!-- Admin Navigation -->
              <ng-container *ngIf="user.userType === 'admin'">
                <li class="nav-item">
                  <a class="nav-link" routerLink="/admin/dashboard" routerLinkActive="active">
                    <i class="fas fa-tachometer-alt me-1"></i> Dashboard
                  </a>
                </li>
              </ng-container>

              <!-- Client Navigation -->
             <!-- Client Navigation -->
<ng-container *ngIf="user.userType === 'individual' || user.userType === 'enterprise'">
  <li class="nav-item">
    <a class="nav-link" routerLink="/client/dashboard" routerLinkActive="active">
      <i class="fas fa-columns me-1"></i> Dashboard
    </a>
  </li>
  <li class="nav-item">
    <a class="nav-link" routerLink="/client/orders" routerLinkActive="active">
      <i class="fas fa-shopping-cart me-1"></i> Orders
    </a>
  </li>
  <!-- Add this new payment link -->
   <li class="nav-item">
    <a class="nav-link" routerLink="/client/payment" routerLinkActive="active">
      <i class="fas fa-credit-card me-1"></i> Payments
    </a>
  </li>
</ng-container>

              <!-- Delivery Navigation -->
              <ng-container *ngIf="user.userType === 'temporary' || user.userType === 'professional'">
                <li class="nav-item">
                  <a class="nav-link" routerLink="/delivery/dashboard" routerLinkActive="active">
                    <i class="fas fa-chart-line me-1"></i> Dashboard
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" routerLink="/delivery/deliveries" routerLinkActive="active">
                    <i class="fas fa-truck me-1"></i> Deliveries
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" routerLink="/delivery/missions" routerLinkActive="active">
                    <i class="fas fa-tasks me-1"></i> Missions
                  </a>
                </li>

              
              </ng-container>
            </ng-container>
          </ul>

          <ul class="navbar-nav ms-auto">
            <ng-container *ngIf="authService.getCurrentUser(); else loginRegister">
              <!-- Notifications Dropdown -->
              <li class="nav-item dropdown notification-dropdown" ngbDropdown>
                <a class="nav-link" id="notificationsDropdown" ngbDropdownToggle>
                  <i class="fas fa-bell"></i>
                  <span *ngIf="hasUnreadNotifications" class="badge badge-pill">{{ unreadNotificationsCount }}</span>
                </a>
                <div class="dropdown-menu dropdown-menu-end notification-menu" ngbDropdownMenu>
                  <div class="dropdown-header">
                    <span>Notifications</span>
                    <a (click)="markAllNotificationsRead()" class="text-link">Mark all read</a>
                  </div>
                  <div class="notification-list">
                    <div *ngFor="let notification of notifications" 
                         class="dropdown-item notification-item"
                         [class.unread]="!notification.read"
                         (click)="markNotificationAsRead(notification)">
                      <div class="notification-content">
                        <p class="notification-text">{{notification.message}}</p>
                        <small class="notification-time">{{notification.createdAt | date:'short'}}</small>
                      </div>
                    </div>
                    <div *ngIf="notifications.length === 0" class="dropdown-item no-notifications">
                      <p class="text-muted text-center my-2">No notifications</p>
                    </div>
                  </div>
                  <div class="dropdown-footer">
                    <a routerLink="/notifications" class="text-center">View all notifications</a>
                  </div>
                </div>
              </li>

              <!-- Messages Dropdown -->
              <li class="nav-item dropdown message-dropdown" ngbDropdown>
                <a class="nav-link" id="messagesDropdown" ngbDropdownToggle>
                  <i class="fas fa-envelope"></i>
                  <span *ngIf="unreadMessages" class="badge badge-pill">{{unreadMessages}}</span>
                </a>
                <div class="dropdown-menu dropdown-menu-end message-menu" ngbDropdownMenu>
                  <div class="dropdown-header">
                    <span>Messages</span>
                    <a (click)="markAllMessagesRead()" class="text-link">Mark all read</a>
                  </div>
                  <div class="message-list">
                    <div *ngFor="let message of messages" 
                         class="dropdown-item message-item"
                         [class.unread]="!message.read">
                      <img [src]="message.avatar" class="user-avatar" alt="User avatar" (error)="handleImageError($event)">
                      <div class="message-content">
                        <div class="message-header">
                          <strong>{{message.from}}</strong>
                          <small class="message-time">{{message.time}}</small>
                        </div>
                        <p class="message-text">{{message.content}}</p>
                      </div>
                    </div>
                  </div>
                  <div class="dropdown-footer">
                    <a routerLink="/messages" class="text-center">View all messages</a>
                  </div>
                </div>
              </li>

              <!-- Profile Dropdown -->
              <li class="nav-item dropdown profile-dropdown" ngbDropdown>
                <a class="nav-link user-profile" id="profileDropdown" ngbDropdownToggle>
                  <img [src]="userAvatar" class="user-avatar" alt="User avatar" (error)="handleImageError($event)">
                  <span class="user-name d-none d-md-inline">{{getUserName()}}</span>
                </a>
                <div class="dropdown-menu dropdown-menu-end profile-menu" ngbDropdownMenu>
                  <h6 class="dropdown-header">{{getUserName()}}</h6>
                  <a class="dropdown-item" routerLink="/profile">
                    <i class="fas fa-user me-2"></i> My Profile
                  </a>
                  <a class="dropdown-item" routerLink="/profile/edit">
                    <i class="fas fa-user-edit me-2"></i> Edit Profile
                  </a>
                  <a class="dropdown-item" routerLink="/settings">
                    <i class="fas fa-cog me-2"></i> Settings
                  </a>
                  <div class="dropdown-divider"></div>
                  <a class="dropdown-item logout-item" (click)="logout()">
                    <i class="fas fa-sign-out-alt me-2"></i> Logout
                  </a>
                </div>
              </li>
            </ng-container>
            <ng-template #loginRegister>
              <li class="nav-item">
                <a class="nav-link login-button" routerLink="/login">
                  <i class="fas fa-sign-in-alt me-1"></i> Login
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link register-button" routerLink="/register">
                  <i class="fas fa-user-plus me-1"></i> Register
                </a>
              </li>
            </ng-template>
          </ul>
        </div>
      </div>
    </nav>
  `,
  styleUrls: ['./nav.component.css']
})
export class NavComponent implements OnInit, OnDestroy {
  isNavbarOpen = false;
  notifications: AppNotification[] = [];
  messages: Message[] = [];
  hasUnreadNotifications = false;
  unreadNotificationsCount = 0;
  unreadMessages = 0;
  userAvatar = '/assets/images/default-avatar.png';
  
  private notificationSubscription!: Subscription;
  private wsSubscription!: Subscription;

  constructor(
    public authService: AuthService,
    private notificationService: NotificationService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.loadMessages();
    this.setupWebSocket();
  }
  
  ngOnDestroy(): void {
    this.notificationSubscription?.unsubscribe();
    this.wsSubscription?.unsubscribe();
  }

  private setupWebSocket(): void {
    // Subscribe to all notifications via WebSocket
    this.wsSubscription = this.webSocketService.getAllNotifications()
      .subscribe({
        next: (notification) => {
          this.notifications.unshift(notification);
          this.updateUnreadCount();
          
          // Show browser notification if supported
          this.showBrowserNotification(notification.title, notification.message);
        },
        error: (err) => console.error('WebSocket error in nav component:', err)
      });
  }

  private showBrowserNotification(title: string, message: string): void {
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

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAvSURBVHgB7cxBEQAACAIwtH8Pzw52kxD8OBZgNXsPAAAAAElFTkSuQmCC';
  }

  toggleNavbar(): void {
    this.isNavbarOpen = !this.isNavbarOpen;
  }

  logout(): void {
    this.authService.logout();
  }

  getUserName(): string {
    const user = this.authService.getCurrentUser();
    return user ? (user.firstName || 'User') : 'User';
  }

  markAllNotificationsRead(): void {
    // Mark all notifications as read in the UI
    this.notifications.forEach(notification => {
      if (!notification.read) {
        this.markNotificationAsRead(notification);
      }
    });
  }
  
  markNotificationAsRead(notification: AppNotification): void {
    if (!notification.read) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          notification.read = true;
          this.updateUnreadCount();
        },
        error: (err) => console.error('Error marking notification as read', err)
      });
    }
  }

  markAllMessagesRead(): void {
    this.messages.forEach(message => message.read = true);
    this.unreadMessages = 0;
  }

  private loadNotifications(): void {
    this.notificationSubscription = this.notificationService.getUnreadNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.updateUnreadCount();
      },
      error: (err) => console.error('Error loading notifications', err)
    });
  }
  
  private updateUnreadCount(): void {
    this.unreadNotificationsCount = this.notifications.filter(n => !n.read).length;
    this.hasUnreadNotifications = this.unreadNotificationsCount > 0;
  }

  private loadMessages(): void {
    // For now, keeping the dummy messages since there's no MessageService yet
    this.messages = [
      { 
        id: 1, 
        from: 'John Doe', 
        content: 'Is my package arriving today?', 
        time: '5 minutes ago', 
        read: false,
        avatar: '/assets/images/john-doe-avatar.png'
      },
      { 
        id: 2, 
        from: 'Delivery Team', 
        content: 'Your delivery report is ready for review', 
        time: '2 hours ago', 
        read: false,
        avatar: '/assets/images/delivery-team-avatar.jpg' 
      },
      { 
        id: 3, 
        from: 'ExpedNow Support', 
        content: 'Your support ticket has been resolved', 
        time: 'Yesterday', 
        read: true,
        avatar: '/assets/images/support-avatar.jpg' 
      }
    ];
    this.unreadMessages = this.messages.filter(m => !m.read).length;
  }
}