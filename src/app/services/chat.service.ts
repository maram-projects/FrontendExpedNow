import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, map, catchError, of, throwError, Subscription, retry, tap, timer, switchMap, filter, finalize } from 'rxjs';
import { ChatConfig, DEFAULT_CHAT_CONFIG, ChatRoom, TypingIndicator, WebSocketMessage, WebSocketMessageType, MessageStatus, ChatMessageRequest, PageResponse, Message } from '../models/chat.models';
import { WebSocketService } from './web-socket.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly API_URL = 'http://localhost:8080/api/chat';
  private readonly config: ChatConfig = DEFAULT_CHAT_CONFIG;
  
  // Enhanced connection management
  private connectionState = new BehaviorSubject<'connected' | 'connecting' | 'disconnected' | 'reconnecting'>('disconnected');
  public connectionState$ = this.connectionState.asObservable();
  
  // Enhanced subjects with better error handling
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private chatRoomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  private typingUsersSubject = new BehaviorSubject<Map<string, TypingIndicator>>(new Map());
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private currentChatRoomSubject = new BehaviorSubject<string | null>(null);
  private userStatusSubject = new BehaviorSubject<Map<string, boolean>>(new Map());
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  
  // Enhanced message handling
  private pendingMessages = new Map<string, ChatMessageRequest>();
  private messageQueue: ChatMessageRequest[] = [];
  private isProcessingQueue = false;
  
  // Connection management
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second
  private heartbeatInterval: any;
  private connectionTimeout: any;
  
  private typingTimeouts = new Map<string, any>();
  private subscriptions = new Subscription();
  
  // Public observables
  public messages$ = this.messagesSubject.asObservable();
  public chatRooms$ = this.chatRoomsSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();
  public currentChatRoom$ = this.currentChatRoomSubject.asObservable();
  public userStatus$ = this.userStatusSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    this.initializeWebSocketListeners();
    this.initializeUserStatusTracking();
    this.initializeConnectionManagement();
    this.startHeartbeat();
  }

  private getRequestOptions(params?: HttpParams): { 
    headers: HttpHeaders; 
    params?: HttpParams;
    withCredentials?: boolean
  } {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    return {
      headers,
      params,
      withCredentials: true
    };
  }

  private handleHttpError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.message || error.error?.error || `Error ${error.status}: ${error.statusText}`;
    }
    
    console.error('HTTP Error:', error);
    this.errorSubject.next(errorMessage);
    return throwError(() => errorMessage);
  }

  // Public API methods
  
  public sendMessage(request: ChatMessageRequest): Observable<any> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    // Add to pending messages for retry logic
    const messageId = this.generateMessageId();
    this.pendingMessages.set(messageId, request);
    
    return this.http.post<any>(`${this.API_URL}/send`, request, this.getRequestOptions())
      .pipe(
        tap(response => {
          this.pendingMessages.delete(messageId);
          if (response.success && response.data) {
            this.handleNewMessage(response.data);
          }
        }),
        catchError(error => {
          // Add to queue for retry if connection is lost
          if (error.status === 0 || error.status >= 500) {
            this.messageQueue.push(request);
          }
          this.pendingMessages.delete(messageId);
          return this.handleHttpError(error);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  public getMessages(deliveryId: string, otherUserId: string, page: number = 0, size: number = 20): Observable<PageResponse<Message>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = new HttpParams()
      .set('deliveryId', deliveryId)
      .set('otherUserId', otherUserId)
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<any>(`${this.API_URL}/messages`, this.getRequestOptions(params))
      .pipe(
        map(response => {
          if (response.success) {
            return {
              content: response.data || [],
              pagination: response.pagination
            } as PageResponse<Message>;
          }
          throw new Error(response.message || 'Failed to load messages');
        }),
        tap(result => {
          if (page === 0) {
            // First page, replace all messages
            this.messagesSubject.next(result.content);
          } else {
            // Subsequent pages, append to existing messages
            const currentMessages = this.messagesSubject.value;
            this.messagesSubject.next([...currentMessages, ...result.content]);
          }
        }),
        catchError(this.handleHttpError.bind(this)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  public loadChatRooms(): Observable<ChatRoom[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    return this.http.get<any>(`${this.API_URL}/rooms`, this.getRequestOptions())
      .pipe(
        map(response => {
          if (response.success) {
            return response.data || [];
          }
          throw new Error(response.message || 'Failed to load chat rooms');
        }),
        tap(rooms => {
          this.chatRoomsSubject.next(rooms);
          this.updateTotalUnreadCount();
        }),
        catchError(this.handleHttpError.bind(this)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  public markMessagesAsRead(deliveryId: string, senderId: string): Observable<void> {
    const params = new HttpParams()
      .set('deliveryId', deliveryId)
      .set('senderId', senderId);

    return this.http.post<any>(`${this.API_URL}/mark-read`, {}, this.getRequestOptions(params))
      .pipe(
        tap(() => {
          // Update local message status
          const currentMessages = this.messagesSubject.value;
          const updatedMessages = currentMessages.map(msg => {
            if (msg.deliveryId === deliveryId && msg.senderId === senderId && msg.status !== MessageStatus.READ) {
              return { ...msg, status: MessageStatus.READ, readAt: new Date() };
            }
            return msg;
          });
          this.messagesSubject.next(updatedMessages);
          
          // Update chat rooms
          this.updateChatRoomUnreadCount(deliveryId);
        }),
        map(() => void 0),
        catchError(this.handleHttpError.bind(this))
      );
  }

  public getUnreadCount(deliveryId: string): Observable<number> {
    const params = new HttpParams().set('deliveryId', deliveryId);
    
    return this.http.get<any>(`${this.API_URL}/unread-count`, this.getRequestOptions(params))
      .pipe(
        map(response => {
          if (response.success) {
            return response.data?.unreadCount || 0;
          }
          return 0;
        }),
        catchError(error => {
          console.error('Error getting unread count:', error);
          return of(0);
        })
      );
  }

  // WebSocket and real-time functionality - ENHANCED VERSION
  public connectWebSocket(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.token) {
      console.error('❌ No authentication token available');
      return Promise.reject('No authentication token available');
    }

    console.log('🔌 Connecting WebSocket for user:', currentUser.userId);
    this.connectionState.next('connecting');
    
    return this.webSocketService.connect(currentUser.token, currentUser.userId)
      .then(() => {
        console.log('✅ WebSocket connected successfully');
        this.connectionState.next('connected');
        this.reconnectAttempts = 0;
        this.reconnectInterval = 1000;
        
        // Enable debug logging
        this.webSocketService.enableDebugLogging();
        
        // Test the connection
        this.testWebSocketConnection();
        
        // Process any queued messages
        this.processMessageQueue();
      })
      .catch(error => {
        console.error('❌ WebSocket connection failed:', error);
        this.connectionState.next('disconnected');
        throw error;
      });
  }

  public disconnectWebSocket(): void {
    this.webSocketService.disconnect();
    this.connectionState.next('disconnected');
  }

  public sendTypingIndicator(receiverId: string, deliveryId: string, isTyping: boolean): void {
    if (this.webSocketService.isConnected()) {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        this.webSocketService.sendTypingIndicator({
          senderId: currentUser.userId,
          receiverId: receiverId,
          deliveryId: deliveryId,
          isTyping: isTyping,
          timestamp: new Date()
        });
      }
    }
  }

  public setCurrentChatRoom(deliveryId: string | null): void {
    this.currentChatRoomSubject.next(deliveryId);
    
    if (deliveryId) {
      // Mark messages as read when entering chat room
      const currentMessages = this.messagesSubject.value;
      const currentUser = this.authService.getCurrentUser();
      
      if (currentUser) {
        const unreadMessages = currentMessages.filter(msg => 
          msg.deliveryId === deliveryId && 
          msg.receiverId === currentUser.userId && 
          msg.status !== MessageStatus.READ
        );
        
        if (unreadMessages.length > 0) {
          const senderIds = [...new Set(unreadMessages.map(msg => msg.senderId))];
          senderIds.forEach(senderId => {
            this.markMessagesAsRead(deliveryId, senderId).subscribe();
          });
        }
      }
    }
  }

  public isUserOnline(userId: string): Observable<boolean> {
    return this.userStatusSubject.pipe(
      map(statusMap => statusMap.get(userId) || false)
    );
  }

  public getTypingUsers(deliveryId: string): Observable<TypingIndicator[]> {
    return this.typingUsersSubject.pipe(
      map(typingMap => {
        const indicators: TypingIndicator[] = [];
        typingMap.forEach((indicator, key) => {
          if (indicator.deliveryId === deliveryId) {
            indicators.push(indicator);
          }
        });
        return indicators;
      })
    );
  }

  // Add method to get messages in correct order
  public getMessagesInOrder(): Observable<Message[]> {
    return this.messages$.pipe(
      map(messages => [...messages]
        .filter(msg => msg.timestamp !== undefined)
        .sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return dateA - dateB;
        })
      )
    );
  }

  // Debug method
  public enableDetailedLogging(): void {
    console.log('🔍 ChatService Debug Mode Enabled');
    
    // Log messages array changes
    this.messages$.subscribe(messages => {
      console.log('📋 Messages array updated:', {
        count: messages.length,
        lastMessage: messages[messages.length - 1]
      });
    });
    
    // Log connection status
    this.connectionState$.subscribe(state => {
      console.log('🔌 Connection state changed:', state);
    });
  }

  // Private methods

  private initializeWebSocketListeners(): void {
    this.subscriptions.add(
      this.webSocketService.getMessages().subscribe((wsMessage: WebSocketMessage) => {
        this.handleWebSocketMessage(wsMessage);
      })
    );

    this.subscriptions.add(
      this.webSocketService.getTypingIndicators().subscribe((indicator: TypingIndicator) => {
        this.handleTypingIndicator(indicator);
      })
    );

    this.subscriptions.add(
      this.webSocketService.getConnectionStatus().subscribe(isConnected => {
        this.ngZone.run(() => {
          if (isConnected) {
            this.connectionState.next('connected');
            this.reconnectAttempts = 0;
            this.reconnectInterval = 1000;
            this.processMessageQueue();
          } else {
            this.connectionState.next('disconnected');
            this.attemptReconnection();
          }
        });
      })
    );
  }

  private initializeConnectionManagement(): void {
    this.subscriptions.add(
      this.connectionState$.subscribe(state => {
        if (state === 'connected') {
          this.clearConnectionTimeout();
        } else if (state === 'disconnected') {
          this.scheduleConnectionCheck();
        }
      })
    );
  }

  private initializeUserStatusTracking(): void {
    this.subscriptions.add(
      this.webSocketService.getUserStatusUpdates().subscribe(statusUpdate => {
        const currentStatus = this.userStatusSubject.value;
        currentStatus.set(statusUpdate.userId, statusUpdate.status === 'ONLINE');
        this.userStatusSubject.next(new Map(currentStatus));
      })
    );
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.webSocketService.isConnected()) {
        this.webSocketService.sendHeartbeat();
      }
    }, 30000);
  }

  private scheduleConnectionCheck(): void {
    if (this.connectionTimeout) return;
    
    this.connectionTimeout = setTimeout(() => {
      if (!this.webSocketService.isConnected()) {
        console.warn('Connection check failed - attempting reconnection');
        this.attemptReconnection();
      }
    }, 5000);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.connectionState.next('disconnected');
      return;
    }

    this.connectionState.next('reconnecting');
    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.webSocketService.isConnected()) {
        const currentUser = this.authService.getCurrentUser();
        if (currentUser?.token) {
          this.webSocketService.connect(currentUser.token, currentUser.userId)
            .then(() => {
              console.log('Reconnection successful');
            })
            .catch(error => {
              console.error('Reconnection failed:', error);
              this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
              this.attemptReconnection();
            });
        }
      }
    }, this.reconnectInterval);
  }

  private processMessageQueue(): void {
    if (this.isProcessingQueue || this.messageQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    queue.forEach(request => {
      this.sendMessage(request).subscribe({
        error: (error) => {
          console.error('Failed to send queued message:', error);
          // Re-queue if still failing
          this.messageQueue.push(request);
        }
      });
    });
    
    this.isProcessingQueue = false;
  }

  // Test WebSocket connection
  private testWebSocketConnection(): void {
    setTimeout(() => {
      if (this.webSocketService.isConnected()) {
        console.log('🧪 Testing WebSocket connection...');
        this.webSocketService.sendMessage('/app/chat/ping', {
          timestamp: new Date().getTime(),
          test: true
        });
      }
    }, 1000);
  }

  // ENHANCED handleWebSocketMessage method
  private handleWebSocketMessage(wsMessage: WebSocketMessage): void {
    try {
      console.log('🔄 Processing WebSocket message:', wsMessage);
      
      this.ngZone.run(() => {
        switch (wsMessage.type) {
          case WebSocketMessageType.CHAT_MESSAGE:
            console.log('💬 Processing chat message');
            this.handleNewMessage(wsMessage.payload as Message);
            break;
            
          case WebSocketMessageType.MESSAGE_READ:
            console.log('👀 Processing message read');
            this.handleMessageRead(wsMessage.payload);
            break;
            
          case WebSocketMessageType.TYPING_START:
          case WebSocketMessageType.TYPING_STOP:
            console.log('⌨️ Processing typing indicator');
            this.handleTypingIndicator(wsMessage.payload as TypingIndicator);
            break;
            
          case WebSocketMessageType.DELIVERY_UPDATE:
            console.log('🚚 Processing delivery update');
            this.handleDeliveryUpdate(wsMessage.payload);
            break;
            
          case WebSocketMessageType.SYSTEM_NOTIFICATION:
            console.log('🔔 Processing system notification');
            this.handleSystemNotification(wsMessage.payload);
            break;
            
          case WebSocketMessageType.ERROR:
            console.error('❌ WebSocket error message:', wsMessage.payload);
            this.errorSubject.next('Connection error: ' + JSON.stringify(wsMessage.payload));
            break;
            
          default:
            console.warn('⚠️ Unknown WebSocket message type:', wsMessage.type);
        }
      });
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  }

  // ENHANCED handleNewMessage method
  private handleNewMessage(message: Message): void {
    if (!message || !message.deliveryId) {
      console.error('❌ Invalid message received:', message);
      return;
    }

    console.log('📨 Processing new message:', {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      deliveryId: message.deliveryId,
      content: message.content?.substring(0, 50) + '...',
      timestamp: message.timestamp
    });
    
    const currentMessages = this.messagesSubject.value;
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      console.error('❌ No current user found');
      return;
    }
    
    // Check if message already exists
    const existingIndex = currentMessages.findIndex(m => m.id === message.id);
    
    if (existingIndex === -1) {
      // Add new message
      const updatedMessages = [...currentMessages, message];
      
      // Sort messages by timestamp
      updatedMessages.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });
      
      this.messagesSubject.next(updatedMessages);
      console.log('✅ Message added to messages list. Total messages:', updatedMessages.length);
      
      // Update unread count if message is not from current user
      if (message.senderId !== currentUser.userId) {
        console.log('📬 Updating unread count for message from:', message.senderId);
        this.updateUnreadCount();
      }
      
    } else {
      // Update existing message
      currentMessages[existingIndex] = { ...currentMessages[existingIndex], ...message };
      this.messagesSubject.next([...currentMessages]);
      console.log('✅ Message updated in messages list');
    }
  }

  private handleMessageRead(payload: any): void {
    if (!payload?.deliveryId) {
      console.error('Invalid message read payload:', payload);
      return;
    }

    const { deliveryId, readCount, readBy, readAt } = payload;
    const currentMessages = this.messagesSubject.value;
    
    const updatedMessages = currentMessages.map(msg => {
      if (msg.deliveryId === deliveryId && 
          msg.receiverId === readBy && 
          msg.status !== MessageStatus.READ) {
        return { 
          ...msg, 
          status: MessageStatus.READ, 
          readAt: readAt ? new Date(readAt) : new Date() 
        };
      }
      return msg;
    });
    
    this.messagesSubject.next(updatedMessages);
    this.updateChatRoomUnreadCount(deliveryId);
  }

  private handleDeliveryUpdate(payload: any): void {
    console.log('Delivery update received:', payload);
    // Reload chat rooms to reflect any changes
    this.loadChatRooms().subscribe();
  }

  // Add system notification handler
  private handleSystemNotification(payload: any): void {
    console.log('🔔 System notification:', payload);
    // Handle system notifications like chat room creation, etc.
    this.loadChatRooms().subscribe();
  }

  private handleTypingIndicator(indicator: TypingIndicator): void {
    const typingUsers = new Map(this.typingUsersSubject.value);
    const key = `${indicator.senderId}-${indicator.deliveryId}`;

    clearTimeout(this.typingTimeouts.get(key));

    if (indicator.isTyping) {
      typingUsers.set(key, indicator);
      const timeout = setTimeout(() => {
        typingUsers.delete(key);
        this.typingUsersSubject.next(new Map(typingUsers));
      }, 3000);
      this.typingTimeouts.set(key, timeout);
    } else {
      typingUsers.delete(key);
    }
    
    this.typingUsersSubject.next(new Map(typingUsers));
  }

  private updateUnreadCount(): void {
    const totalUnread = this.chatRoomsSubject.value
      .reduce((sum, room) => sum + (room.unreadCount || 0), 0);
    this.unreadCountSubject.next(totalUnread);
  }

  private updateTotalUnreadCount(): void {
    const rooms = this.chatRoomsSubject.value;
    const totalUnread = rooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0);
    this.unreadCountSubject.next(totalUnread);
  }

  private updateChatRoomUnreadCount(deliveryId: string): void {
    const rooms = this.chatRoomsSubject.value;
    const updatedRooms = rooms.map(room => {
      if (room.deliveryId === deliveryId) {
        return { ...room, unreadCount: 0 };
      }
      return room;
    });
    this.chatRoomsSubject.next(updatedRooms);
    this.updateTotalUnreadCount();
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.disconnectWebSocket();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
  }
}