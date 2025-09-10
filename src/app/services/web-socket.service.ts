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
  private maxReconnectAttemptsReachedSubject = new Subject<boolean>();

  // Connection properties
  private currentUserId: string | null = null;
  private currentToken: string | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 5000; // 5 seconds
  private reconnectTimeout: any = null;

  constructor() {}

connect(token: string, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting WebSocket for user: ${userId}`);
    
    if (this.stompClient && this.isConnected()) {
      console.log('✅ Already connected');
      resolve();
      return;
    }

    this.currentUserId = userId;
    this.currentToken = token;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    const socket = new SockJS(`http://localhost:8080/ws?token=${encodeURIComponent(token)}`);
    this.stompClient = Stomp.over(socket);
    
    this.stompClient.configure({
      debug: (str) => console.debug('🔧 STOMP Debug:', str),
      reconnectDelay: 0,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onDisconnect: () => {
        console.log('🔌 STOMP disconnected');
        this.isConnectedSubject.next(false);
        this.handleReconnection();
      },
      onWebSocketError: (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnectedSubject.next(false);
      }
    });

    const connectionTimeout = setTimeout(() => {
      console.error('⏰ Connection timeout');
      reject(new Error('Connection timeout'));
    }, 10000);

    this.stompClient.onConnect = (frame) => {
      clearTimeout(connectionTimeout);
      console.log('✅ STOMP connected successfully:', frame);
      this.isConnectedSubject.next(true);
      this.reconnectAttempts = 0;
      this.reconnectInterval = 5000;
      
      // **الأهم** - Subscribe with correct userId
      this.subscribeToChannels(userId);
      resolve();
    };

    this.stompClient.onStompError = (frame) => {
      clearTimeout(connectionTimeout);
      console.error('❌ STOMP error:', frame);
      reject(new Error(frame.headers['message'] || 'Connection failed'));
    };

    try {
      this.stompClient.activate();
    } catch (error) {
      clearTimeout(connectionTimeout);
      console.error('❌ Failed to activate STOMP client:', error);
      reject(error);
    }
  });
}

 private subscribeToChannels(userId: string): void {
  if (!this.stompClient) return;

  try {
    // 1. **الأهم** - Personal message queue with userId
    this.stompClient.subscribe(`/user/${userId}/queue/messages`, (message: IMessage) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        console.log('✅ Message received for user:', userId, wsMessage);
        this.messageSubject.next(wsMessage);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    });

    // 2. Typing indicators - Fixed path
    this.stompClient.subscribe(`/user/${userId}/queue/typing`, (message: IMessage) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        console.log('⌨️ Typing received for user:', userId, wsMessage);
        if (wsMessage.type === WebSocketMessageType.TYPING_START || 
            wsMessage.type === WebSocketMessageType.TYPING_STOP) {
          this.typingSubject.next(wsMessage.payload as TypingIndicator);
        }
      } catch (error) {
        console.error('❌ Error parsing typing indicator:', error);
      }
    });

    // 3. Chat rooms updates
    this.stompClient.subscribe(`/user/${userId}/queue/chat-rooms`, (message: IMessage) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        console.log('🏠 Chat room update for user:', userId, wsMessage);
        this.messageSubject.next(wsMessage);
      } catch (error) {
        console.error('❌ Error parsing chat room update:', error);
      }
    });

    // 4. User status updates - Fixed
    this.stompClient.subscribe(`/user/${userId}/queue/status`, (message: IMessage) => {
      try {
        const statusUpdate = JSON.parse(message.body);
        console.log('👤 User status update:', statusUpdate);
        this.userStatusSubject.next(statusUpdate);
      } catch (error) {
        console.error('❌ Error parsing user status:', error);
      }
    });

    // 5. Notifications
    this.stompClient.subscribe(`/user/${userId}/queue/notifications`, (message: IMessage) => {
      try {
        const notification: AppNotification = JSON.parse(message.body);
        console.log('🔔 Notification received:', notification);
        this.notificationSubject.next(notification);
      } catch (error) {
        console.error('❌ Error parsing notification:', error);
      }
    });

    console.log(`✅ Successfully subscribed to ALL channels for user: ${userId}`);
  } catch (error) {
    console.error('❌ CRITICAL: Error subscribing to channels:', error);
  }
}

public enableDebugLogging(): void {
  console.log('🔍 WebSocket Debug Mode Enabled');
  
  this.getConnectionStatus().subscribe(status => {
    console.log('🔌 Connection Status:', status);
  });
  
  this.getMessages().subscribe(msg => {
    console.log('📨 Raw WebSocket Message:', msg);
  });
}




  private handleReconnection(): void {
    if (this.reconnectTimeout) {
      return; // Already attempting reconnection
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.maxReconnectAttemptsReachedSubject.next(true);
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    if (!this.currentToken || !this.currentUserId) {
      console.error('No token or user ID available for reconnection');
      this.maxReconnectAttemptsReachedSubject.next(true);
      return;
    }

    const delay = this.reconnectInterval * this.reconnectAttempts;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(this.currentToken!, this.currentUserId!)
        .then(() => {
          console.log('Reconnection successful');
        })
        .catch(err => {
          console.error('Reconnection attempt failed:', err);
          this.handleReconnection(); // Try again
        });
    }, delay);
  }

  sendMessage(destination: string, message: any): void {
    if (this.stompClient && this.isConnected()) {
      try {
        this.stompClient.publish({
          destination: destination,
          body: JSON.stringify(message)
        });
      } catch (error) {
        console.error('Error sending message:', error);
      }
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

  sendHeartbeat(): void {
    if (this.isConnected()) {
      // Fixed: Use correct destination for heartbeat
      this.sendMessage('/app/heartbeat', {
        type: 'PING',
        payload: { timestamp: Date.now() }
      });
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.stompClient) {
      try {
        this.stompClient.deactivate();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
      this.stompClient = null;
      this.isConnectedSubject.next(false);
      this.currentUserId = null;
      this.currentToken = null;
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
    if (this.currentUserId && this.currentToken) {
      this.connect(this.currentToken, this.currentUserId);
    }
  }

  getAllNotifications(): Observable<AppNotification> {
    return this.notificationSubject.asObservable();
  }

  getUserStatusUpdates(): Observable<{userId: string, status: string}> {
    return this.userStatusSubject.asObservable();
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