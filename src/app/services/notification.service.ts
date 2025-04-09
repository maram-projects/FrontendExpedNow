import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WebSocketService, AppNotification } from './web-socket.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = `${environment.apiUrl}/notifications`;

  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService
  ) {}

  // Get unread notifications from the API
  getUnreadNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.apiUrl);
  }

  // Mark a notification as read
  markAsRead(notificationId: string): Observable<AppNotification> {
    return this.http.put<AppNotification>(`${this.apiUrl}/${notificationId}/read`, {});
  }

  // Get real-time notifications
  getRealTimeNotifications(): Observable<AppNotification> {
    return this.webSocketService.getAllNotifications();
  }
}