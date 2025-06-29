import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import SockJS from 'sockjs-client';
import { Stomp, CompatClient, IMessage } from '@stomp/stompjs';
import { TypingIndicator, WebSocketMessage, WebSocketMessageType } from '../models/chat.models';
import { AppNotification } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: CompatClient | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new Subject<WebSocketMessage>();
  private typingSubject = new Subject<TypingIndicator>();
  private userStatusSubject = new Subject<{userId: string, status: string}>();
  private notificationSubject = new Subject<AppNotification>();
    private maxReconnectAttemptsReachedSubject = new Subject<boolean>(); // Add this line


 // Add missing properties
  private currentUserId: string | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly reconnectInterval: number = 5000; // 5 seconds

  constructor() {}

connect(token: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 1. Vérification du token
      if (!token) {
        reject(new Error('No token provided'));
        return;
      }

      // 2. Vérification de la connexion existante
      if (this.stompClient && this.isConnected()) {
        resolve();
        return;
      }

      this.currentUserId = userId;
      this.reconnectAttempts = 0;

      // 3. Création de la connexion SockJS avec token dans l'URL
      const socket = new SockJS(`http://localhost:8080/ws?token=${encodeURIComponent(token)}`);
      this.stompClient = Stomp.over(socket);

      // 4. Configuration sans headers (utilise uniquement le paramètre de requête)
      this.stompClient.configure({
        debug: (str) => console.log('STOMP Debug:', str),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onDisconnect: () => {
          console.log('Disconnected');
          this.isConnectedSubject.next(false);
        }
      });

      // 5. Gestionnaires d'événements
      this.stompClient.onConnect = (frame) => {
        console.log('WebSocket Connected:', frame);
        this.isConnectedSubject.next(true);
        this.reconnectAttempts = 0;
        this.subscribeToChannels(userId);
        resolve();
      };

      this.stompClient.onStompError = (frame) => {
        console.error('WebSocket STOMP Error:', frame);
        this.isConnectedSubject.next(false);
        reject(new Error('WebSocket connection failed: ' + frame.headers['message']));
      };

      this.stompClient.onWebSocketError = (error) => {
        console.error('WebSocket Error:', error);
        this.isConnectedSubject.next(false);
        this.handleReconnection();
      };

      this.stompClient.onWebSocketClose = (event) => {
        console.log('WebSocket Closed:', event);
        this.isConnectedSubject.next(false);
        this.handleReconnection();
      };

      // 6. Activation de la connexion
      this.stompClient.activate();
    });
  }


  private subscribeToChannels(userId: string): void {
    if (!this.stompClient) return;

    // Personal message queue
    this.stompClient.subscribe(`/user/queue/messages`, (message: IMessage) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        this.messageSubject.next(wsMessage);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Typing indicators
    this.stompClient.subscribe(`/user/queue/typing`, (message: IMessage) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        if (wsMessage.type === WebSocketMessageType.USER_TYPING || 
            wsMessage.type === WebSocketMessageType.USER_STOP_TYPING) {
          this.typingSubject.next(wsMessage.payload as TypingIndicator);
        }
      } catch (error) {
        console.error('Error parsing typing indicator:', error);
      }
    });

    // User status updates
    this.stompClient.subscribe(`/topic/user.status.${userId}`, (message: IMessage) => {
      try {
        const statusUpdate = JSON.parse(message.body);
        this.userStatusSubject.next(statusUpdate);
      } catch (error) {
        console.error('Error parsing user status update:', error);
      }
    });

    // Notifications
    this.stompClient.subscribe(`/user/queue/notifications`, (message: IMessage) => {
      try {
        const notification: AppNotification = JSON.parse(message.body);
        this.notificationSubject.next(notification);
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    });
  }

  getUserStatusUpdates(): Observable<{userId: string, status: string}> {
    return this.userStatusSubject.asObservable();
  }
private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      const token = localStorage.getItem('token');
      if (!token || !this.currentUserId) {
        console.error('No token or user ID available for reconnection');
        this.maxReconnectAttemptsReachedSubject.next(true);
        return;
      }

      setTimeout(() => {
        this.connect(token, this.currentUserId!)
          .catch(err => console.error('Reconnection attempt failed:', err));
      }, this.reconnectInterval * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.maxReconnectAttemptsReachedSubject.next(true);
    }
  }
  sendMessage(destination: string, message: any): void {
    if (this.stompClient && this.isConnected()) {
      this.stompClient.publish({
        destination: destination,
        body: JSON.stringify(message)
      });
    } else {
      console.error('WebSocket not connected. Cannot send message.');
    }
  }

  sendChatMessage(message: any): void {
    this.sendMessage('/app/chat/send', message);
  }

  sendTypingIndicator(indicator: TypingIndicator): void {
    this.sendMessage('/app/chat/typing', indicator);
  }

  sendStopTypingIndicator(indicator: TypingIndicator): void {
    this.sendMessage('/app/chat/stop-typing', indicator);
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.isConnectedSubject.next(false);
      this.currentUserId = null;
      this.reconnectAttempts = 0;
      console.log('WebSocket Disconnected');
    }
  }

  isConnected(): boolean {
    return this.stompClient?.connected || false;
  }

  getConnectionStatus(): Observable<boolean> {
    return this.isConnectedSubject.asObservable();
  }

  getMessages(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }

  getTypingIndicators(): Observable<TypingIndicator> {
    return this.typingSubject.asObservable();
  }

  // Force reconnection
  reconnect(): void {
    this.disconnect();
    if (this.currentUserId) {
      const token = localStorage.getItem('token') || '';
      this.connect(token, this.currentUserId);
    }
  }

  getAllNotifications(): Observable<AppNotification> {
    return this.notificationSubject.asObservable();
  }

  // Additional utility methods
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  getMaxReconnectAttempts(): number {
    return this.maxReconnectAttempts;
  }

  getMaxReconnectAttemptsReached(): Observable<boolean> {
    return this.maxReconnectAttemptsReachedSubject.asObservable();
  }
}