import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../../services/web-socket.service';
import { AppNotification } from '../../models/notification.model';
import { ChatService } from '../../services/chat.service'; // Add ChatService import

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
        
        <button 
          class="navbar-toggler" 
          type="button" 
          (click)="toggleNavbar()" 
          [class.collapsed]="!isNavbarOpen"
          aria-label="Toggle navigation">
          <span class="toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" [ngClass]="{ 'show': isNavbarOpen }">
          <ul class="navbar-nav me-auto">
            <ng-container *ngIf="currentUser">
              <!-- Admin Navigation -->
              <ng-container *ngIf="currentUser.userType === 'admin'">
                <li class="nav-item">
                  <a class="nav-link" routerLink="/admin/dashboard" routerLinkActive="active">
                    <i class="fas fa-tachometer-alt me-1"></i> Dashboard
                  </a>
                </li>
              </ng-container>

              <!-- Client Navigation -->
              <ng-container *ngIf="currentUser.userType === 'individual' || currentUser.userType === 'enterprise'">
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
                <li class="nav-item">
                  <a class="nav-link" routerLink="/client/payment" routerLinkActive="active">
                    <i class="fas fa-credit-card me-1"></i> Payments
                  </a>
                </li>
                <!-- Add Chat for Clients -->
                <li class="nav-item">
                  <a class="nav-link" routerLink="/client/chat" routerLinkActive="active">
                    <i class="fas fa-comments me-1"></i> Chat
                    <span *ngIf="unreadChatCount > 0" class="badge bg-danger ms-1">{{unreadChatCount}}</span>
                  </a>
                </li>
              </ng-container>

              <!-- Delivery Navigation -->
              <ng-container *ngIf="currentUser.userType === 'temporary' || currentUser.userType === 'professional'">
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
                <!-- Add Chat for Delivery Persons -->
                <li class="nav-item">
                  <a class="nav-link" routerLink="/delivery/chat" routerLinkActive="active">
                    <i class="fas fa-comments me-1"></i> Chat
                    <span *ngIf="unreadChatCount > 0" class="badge bg-danger ms-1">{{unreadChatCount}}</span>
                  </a>
                </li>
              </ng-container>
            </ng-container>
          </ul>

          <ul class="navbar-nav ms-auto">
            <ng-container *ngIf="currentUser; else loginRegister">
              <!-- Chat Notifications (Quick Access) -->
              <li class="nav-item dropdown chat-dropdown" ngbDropdown *ngIf="currentUser">
                <a class="nav-link" 
                   id="chatDropdown" 
                   ngbDropdownToggle
                   role="button"
                   aria-haspopup="true"
                   aria-expanded="false">
                  <i class="fas fa-comment-dots"></i>
                  <span *ngIf="unreadChatCount > 0" class="badge badge-pill chat-badge">{{ unreadChatCount }}</span>
                </a>
                <div class="dropdown-menu dropdown-menu-end chat-menu" ngbDropdownMenu>
                  <div class="dropdown-header">
                    <span>Recent Chats</span>
                    <a [routerLink]="getChatRoute()" class="text-link" role="button">View all</a>
                  </div>
                  <div class="chat-list">
                    <div *ngFor="let room of recentChatRooms; trackBy: trackByChatRoomId" 
                         class="dropdown-item chat-item"
                         [class.unread]="room.unreadCount > 0"
                         (click)="navigateToChat(room.deliveryId)"
                         role="button">
                      <div class="chat-content">
                        <div class="chat-header">
                          <strong>{{ getChatRoomTitle(room) }}</strong>
                          <small class="chat-time" *ngIf="room.lastMessageAt">
                            {{ formatChatTime(room.lastMessageAt) }}
                          </small>
                        </div>
                        <p class="chat-text">{{ room.lastMessage || 'No messages yet' }}</p>
                        <span *ngIf="room.unreadCount > 0" class="unread-indicator">{{ room.unreadCount }}</span>
                      </div>
                    </div>
                    <div *ngIf="recentChatRooms.length === 0" class="dropdown-item no-chats">
                      <p class="text-muted text-center my-2">No recent chats</p>
                    </div>
                  </div>
                </div>
              </li>

              <!-- Notifications Dropdown -->
              <li class="nav-item dropdown notification-dropdown" ngbDropdown>
                <a class="nav-link" 
                   id="notificationsDropdown" 
                   ngbDropdownToggle
                   role="button"
                   aria-haspopup="true"
                   aria-expanded="false">
                  <i class="fas fa-bell"></i>
                  <span *ngIf="hasUnreadNotifications" class="badge badge-pill">{{ unreadNotificationsCount }}</span>
                </a>
                <div class="dropdown-menu dropdown-menu-end notification-menu" ngbDropdownMenu>
                  <div class="dropdown-header">
                    <span>Notifications</span>
                    <a (click)="markAllNotificationsRead()" class="text-link" role="button">Mark all read</a>
                  </div>
                  <div class="notification-list">
                    <div *ngFor="let notification of notifications; trackBy: trackByNotificationId" 
                         class="dropdown-item notification-item"
                         [class.unread]="!notification.read"
                         (click)="markNotificationAsRead(notification)"
                         role="button">
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
                <a class="nav-link" 
                   id="messagesDropdown" 
                   ngbDropdownToggle
                   role="button"
                   aria-haspopup="true"
                   aria-expanded="false">
                  <i class="fas fa-envelope"></i>
                  <span *ngIf="unreadMessages > 0" class="badge badge-pill">{{unreadMessages}}</span>
                </a>
                <div class="dropdown-menu dropdown-menu-end message-menu" ngbDropdownMenu>
                  <div class="dropdown-header">
                    <span>Messages</span>
                    <a (click)="markAllMessagesRead()" class="text-link" role="button">Mark all read</a>
                  </div>
                  <div class="message-list">
                    <div *ngFor="let message of messages; trackBy: trackByMessageId" 
                         class="dropdown-item message-item"
                         [class.unread]="!message.read"
                         role="button">
                      <img [src]="message.avatar" 
                           class="user-avatar" 
                           alt="{{message.from}} avatar" 
                           (error)="handleImageError($event)">
                      <div class="message-content">
                        <div class="message-header">
                          <strong>{{message.from}}</strong>
                          <small class="message-time">{{message.time}}</small>
                        </div>
                        <p class="message-text">{{message.content}}</p>
                      </div>
                    </div>
                    <div *ngIf="messages.length === 0" class="dropdown-item no-messages">
                      <p class="text-muted text-center my-2">No messages</p>
                    </div>
                  </div>
                  <div class="dropdown-footer">
                    <a routerLink="/messages" class="text-center">View all messages</a>
                  </div>
                </div>
              </li>

              <!-- Profile Dropdown -->
              <li class="nav-item dropdown profile-dropdown" ngbDropdown>
                <a class="nav-link user-profile" 
                   id="profileDropdown" 
                   ngbDropdownToggle
                   role="button"
                   aria-haspopup="true"
                   aria-expanded="false">
                  <img [src]="userAvatar" 
                       class="user-avatar" 
                       alt="User avatar" 
                       (error)="handleImageError($event)">
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
                  <a class="dropdown-item logout-item" (click)="logout()" role="button">
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

    <style>
      /* Chat-specific styles */
      .chat-dropdown .chat-badge {
        background: #28a745;
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: -5px;
        right: -5px;
      }

      .chat-menu {
        width: 320px;
        max-height: 400px;
        overflow-y: auto;
      }

      .chat-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        position: relative;
      }

      .chat-item:hover {
        background-color: #f8f9fa;
      }

      .chat-item.unread {
        background-color: #f0f8ff;
        border-left: 3px solid #007bff;
      }

      .chat-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .chat-text {
        font-size: 14px;
        color: #666;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chat-time {
        font-size: 12px;
        color: #999;
      }

      .unread-indicator {
        background: #dc3545;
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        position: absolute;
        top: 8px;
        right: 8px;
        min-width: 18px;
        text-align: center;
      }

      .no-chats {
        text-align: center;
        padding: 20px;
      }
    </style>
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
  currentUser: any = null;
  
  // Chat-related properties
  unreadChatCount = 0;
  recentChatRooms: any[] = [];
  
  private notificationSubscription?: Subscription;
  private wsSubscription?: Subscription;
  private userSubscription?: Subscription;
  private chatSubscription?: Subscription;

  constructor(
    public authService: AuthService,
    private notificationService: NotificationService,
    private webSocketService: WebSocketService,
    private chatService: ChatService, // Add ChatService
    private router: Router
  ) {}

  ngOnInit(): void {
    try {
      this.updateCurrentUser();
      this.setupUserSubscription();
      
      if (this.currentUser) {
        this.initializeAuthenticatedFeatures();
        this.initializeChatFeatures(); // Initialize chat features
      }
    } catch (error) {
      console.error('Error initializing nav component:', error);
    }
  }
  
  ngOnDestroy(): void {
    this.cleanupSubscriptions();
  }

  private updateCurrentUser(): void {
    this.currentUser = this.authService.getCurrentUser();
  }

  private setupUserSubscription(): void {
    if (this.authService.currentUser$) {
      this.userSubscription = this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.initializeAuthenticatedFeatures();
          this.initializeChatFeatures();
        } else {
          this.cleanupAuthenticatedFeatures();
          this.cleanupChatFeatures();
        }
      });
    }
  }

  private initializeAuthenticatedFeatures(): void {
    const token = this.authService.getToken();
    const userId = this.currentUser?.userId;
    
    if (token && userId) {
      this.setupWebSocket(token, userId);
      this.loadNotifications();
      this.loadMessages();
    }
  }

  private initializeChatFeatures(): void {
    if (!this.currentUser) return;

    // Connect to chat WebSocket
    this.chatService.connectWebSocket().catch(error => {
      console.error('Failed to connect to chat WebSocket:', error);
    });

    // Subscribe to chat updates
    this.chatSubscription = this.chatService.unreadCount$.subscribe(count => {
      this.unreadChatCount = count;
    });

    // Load recent chat rooms
    this.chatService.loadChatRooms().subscribe({
      next: (rooms) => {
        this.recentChatRooms = rooms
          .filter(room => room.unreadCount > 0 || room.lastMessage)
          .sort((a, b) => {
            const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 5); // Show only 5 most recent
      },
      error: (error) => {
        console.error('Failed to load chat rooms:', error);
      }
    });
  }

  private cleanupAuthenticatedFeatures(): void {
    this.notifications = [];
    this.messages = [];
    this.hasUnreadNotifications = false;
    this.unreadNotificationsCount = 0;
    this.unreadMessages = 0;
    this.webSocketService.disconnect();
  }

  private cleanupChatFeatures(): void {
    this.unreadChatCount = 0;
    this.recentChatRooms = [];
    this.chatService.disconnectWebSocket();
  }

  private setupWebSocket(token: string, userId: string): void {
    try {
      if (!this.webSocketService.isConnected()) {
        this.webSocketService.connect(token, userId)
          .then(() => {
            this.subscribeToNotifications();
          })
          .catch(error => {
            console.error('Failed to connect to WebSocket:', error);
          });
      } else {
        this.subscribeToNotifications();
      }
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }
  }

  private subscribeToNotifications(): void {
    try {
      this.wsSubscription = this.webSocketService.getAllNotifications()
        .subscribe({
          next: (notification: AppNotification) => {
            this.notifications.unshift(notification);
            this.updateUnreadCount();
            this.showBrowserNotification(notification.title, notification.message);
          },
          error: (err: any) => {
            console.error('WebSocket error in nav component:', err);
          }
        });
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
    }
  }

  private showBrowserNotification(title: string, message: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { 
          body: message,
          icon: '/assets/images/notification-icon.png'
        });
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }
  }

  private loadNotifications(): void {
    try {
      this.notificationSubscription = this.notificationService.getUnreadNotifications().subscribe({
        next: (notifications) => {
          this.notifications = notifications || [];
          this.updateUnreadCount();
        },
        error: (err) => {
          console.error('Error loading notifications:', err);
          this.notifications = [];
        }
      });
    } catch (error) {
      console.error('Error setting up notification subscription:', error);
    }
  }
  
  private updateUnreadCount(): void {
    this.unreadNotificationsCount = this.notifications.filter(n => !n.read).length;
    this.hasUnreadNotifications = this.unreadNotificationsCount > 0;
  }

  private loadMessages(): void {
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

  private cleanupSubscriptions(): void {
    this.notificationSubscription?.unsubscribe();
    this.wsSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
    this.chatSubscription?.unsubscribe();
  }

  // Chat-related methods
  getChatRoute(): string {
    if (this.currentUser?.userType === 'temporary' || this.currentUser?.userType === 'professional') {
      return '/delivery/chat';
    } else if (this.currentUser?.userType === 'individual' || this.currentUser?.userType === 'enterprise') {
      return '/client/chat';
    }
    return '/chat';
  }

  getChatRoomTitle(room: any): string {
    const isDeliveryPerson = this.currentUser?.userType === 'temporary' || this.currentUser?.userType === 'professional';
    
    if (isDeliveryPerson) {
      return room.clientName || room.otherUserName || 'Client';
    } else {
      return room.deliveryPersonName || room.otherUserName || 'Delivery Person';
    }
  }

  navigateToChat(deliveryId?: string): void {
    const chatRoute = this.getChatRoute();
    if (deliveryId) {
      this.router.navigate([chatRoute], { queryParams: { deliveryId } });
    } else {
      this.router.navigate([chatRoute]);
    }
  }

  formatChatTime(timestamp: Date): string {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  // Existing methods...
  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNFNUU3RUIiLz4KPHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAxNCAxNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI5IiB5PSI5Ij4KPHBhdGggZD0iTTcgMEMzLjEzNDAxIDAgMCAzLjEzNDAxIDAgN0MwIDEwLjg2NiAzLjEzNDAxIDE0IDcgMTRDMTAuODY2IDE0IDE0IDEwLjg2NiAxNCA3QzE0IDMuMTM0MDEgMTAuODY2IDAgNyAwWk03IDIuMzMzMzNDOC4zODA4IDIuMzMzMzMgOS41IDMuNDUyNTggOS41IDVDOS41IDYuNTQ3NDIgOC4zODA4IDcuNjY2NjcgNyA3LjY2NjY3QzUuNjE5MTcgNy42NjY2NyA0LjUgNi41NDc0MiA0LjUgNUM0LjUgMy40NTI1OCA1LjYxOTE3IDIuMzMzMzMgNyAyLjMzMzMzWk03IDEyLjgzMzNDNS4yNSAxMi44MzMzIDMuNzA4MzMgMTEuODc5MiAzIDEwLjU0MTdDMy4wNDE2NyA5LjE4NzUgNS44MzMzMyA4LjQ1ODMzIDcgOC40NTgzM0M4LjE2NjY3IDguNDU4MzMgMTAuOTU4MyA5LjE4NzUgMTEgMTAuNTQxN0MxMC4yOTE3IDExLjg3OTIgOC43NSAxMi44MzMzIDcgMTIuODMzM1oiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+Cjwvc3ZnPgo=';
  }

  toggleNavbar(): void {
    this.isNavbarOpen = !this.isNavbarOpen;
  }

  logout(): void {
    try {
      this.cleanupAuthenticatedFeatures();
      this.cleanupChatFeatures();
      this.authService.logout();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  getUserName(): string {
    return this.currentUser?.firstName || this.currentUser?.name || 'User';
  }

  markAllNotificationsRead(): void {
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
        error: (err) => {
          console.error('Error marking notification as read:', err);
        }
      });
    }
  }

  markAllMessagesRead(): void {
    this.messages.forEach(message => message.read = true);
    this.unreadMessages = 0;
  }

  // TrackBy functions for performance
  trackByNotificationId(index: number, notification: AppNotification): number {
    return notification.id;
  }

  trackByMessageId(index: number, message: Message): number {
    return message.id;
  }

  trackByChatRoomId(index: number, room: any): string {
    return room.deliveryId;
  }
}