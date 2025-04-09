import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { Observable, Subject } from 'rxjs';
import { filter, map, share } from 'rxjs/operators';

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceId: string;
  createdAt: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket$!: WebSocketSubject<any>;
  private readonly WS_ENDPOINT = `${environment.wsUrl}/ws/websocket`;
  private notificationsSubject = new Subject<AppNotification>();
  private notifications$ = this.notificationsSubject.asObservable().pipe(share());

  constructor(private authService: AuthService) {}

  connect(): WebSocketSubject<any> {
    if (!this.socket$ || this.socket$.closed) {
      const token = this.authService.getToken();
      this.socket$ = webSocket({
        url: `${this.WS_ENDPOINT}?token=${token}`,
        protocol: 'Bearer',
      });

      // Subscribe to incoming messages
      this.socket$.subscribe({
        next: (message) => {
          console.log('WebSocket message received:', message);
          if (message.type) {
            this.notificationsSubject.next(message as AppNotification);
          }
        },
        error: (err) => console.error('WebSocket error:', err),
        complete: () => console.log('WebSocket connection closed')
      });
    }
    return this.socket$;
  }

  // Get notifications of specific type
  getNotificationsByType(type: string): Observable<AppNotification> {
    return this.notifications$.pipe(
      filter(notification => notification.type === type)
    );
  }

  // Get all notifications
  getAllNotifications(): Observable<AppNotification> {
    return this.notifications$;
  }

  // Get specific delivery notifications
  getDeliveryNotifications(): Observable<AppNotification> {
    return this.notifications$.pipe(
      filter(notification => notification.type.startsWith('DELIVERY_'))
    );
  }

  receiveNotifications() {
    this.connect(); // Ensure connection is established
    return this.notifications$;
  }

  close() {
    this.socket$?.complete();
  }
}