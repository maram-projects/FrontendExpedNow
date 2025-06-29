// src/app/services/notification.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppNotification } from '../models/notification.model';
import { WebSocketService } from './web-socket.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService
  ) {}

  getUnreadNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>('/api/notifications/unread');
  }

  markAsRead(id: number): Observable<any> {
    return this.http.post(`/api/notifications/${id}/read`, {});
  }

  getRealTimeNotifications(): Observable<AppNotification> {
    return this.webSocketService.getAllNotifications();
  }
}