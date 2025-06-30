import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, map, catchError, of, throwError, Subscription, retry, tap } from 'rxjs';
import { ChatConfig, DEFAULT_CHAT_CONFIG, ChatRoom, TypingIndicator, WebSocketMessage, WebSocketMessageType, MessageStatus, ChatMessageRequest, PageResponse, Message } from '../models/chat.models';
import { WebSocketService } from './web-socket.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly API_URL = 'http://localhost:8080/api/chat';
  private readonly config: ChatConfig = DEFAULT_CHAT_CONFIG;
  private connectionState = new BehaviorSubject<boolean>(false);
  public connectionState$ = this.connectionState.asObservable();

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private chatRoomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  private typingUsersSubject = new BehaviorSubject<Map<string, TypingIndicator>>(new Map());
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private currentChatRoomSubject = new BehaviorSubject<string | null>(null);
  private userStatusSubject = new BehaviorSubject<Map<string, boolean>>(new Map());
  
  private typingTimeouts = new Map<string, any>();
  private subscriptions = new Subscription();

  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    this.initializeWebSocketListeners();
    this.initializeUserStatusTracking();
  }

private getRequestOptions(params?: HttpParams): { 
    headers: HttpHeaders; 
    params?: HttpParams;
    withCredentials?: boolean
} {
    const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.authService.getToken()}`
    });
    
    return {
        headers,
        params,
        withCredentials: true
    };
}

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
  }

  isUserOnline(userId: string): Observable<boolean> {
    return this.userStatusSubject.pipe(
      map(statusMap => statusMap.get(userId) || false)
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

  private handleWebSocketMessage(wsMessage: WebSocketMessage): void {
    try {
      switch (wsMessage.type) {
        case WebSocketMessageType.CHAT_MESSAGE:
          this.handleNewMessage(wsMessage.payload as Message);
          break;
        case WebSocketMessageType.MESSAGE_READ:
          this.handleMessageRead(wsMessage.payload);
          break;
        case WebSocketMessageType.DELIVERY_UPDATE:
          this.handleDeliveryUpdate(wsMessage.payload);
          break;
        default:
          console.warn('Unknown WebSocket message type:', wsMessage.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private handleNewMessage(message: Message): void {
    if (!message || !message.deliveryId) {
      console.error('Invalid message received:', message);
      return;
    }

    this.ngZone.run(() => {
      const currentMessages = this.messagesSubject.value;
      const updatedMessages = [message, ...currentMessages];
      this.messagesSubject.next(updatedMessages);
    });

    // Update chat rooms list
    this.loadChatRooms();
    
    // Update unread count if message is not from current chat room
    const currentRoom = this.currentChatRoomSubject.value;
    if (currentRoom !== message.deliveryId) {
      this.updateUnreadCount();
    }
  }

  private handleMessageRead(payload: any): void {
    if (!payload?.deliveryId) {
      console.error('Invalid message read payload:', payload);
      return;
    }

    const { deliveryId, readCount } = payload;
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(msg => {
      if (msg.deliveryId === deliveryId && msg.status !== MessageStatus.READ) {
        return { ...msg, status: MessageStatus.READ, readAt: new Date() };
      }
      return msg;
    });
    this.messagesSubject.next(updatedMessages);
  }

  private handleDeliveryUpdate(payload: any): void {
    console.log('Delivery update received:', payload);
    // Handle delivery status updates
    // You can emit events or update relevant state here
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
  // HTTP API Methods
  sendMessage(request: ChatMessageRequest): Observable<Message> {
    if (!request.content?.trim() || !request.receiverId || !request.deliveryId) {
      return throwError(() => new Error('Invalid message request'));
    }

    console.log('Sending message:', request); // Debug log

    return this.http.post<Message>(`${this.API_URL}/send`, request, this.getRequestOptions()).pipe(
      tap(response => console.log('Send message response:', response)), // Debug log
      map(message => {
        // Ensure message has all required properties
        const completeMessage: Message = {
          ...message,
          status: message.status || MessageStatus.SENT,
          timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
          senderId: message.senderId || this.getCurrentUserId(),
          deliveryId: message.deliveryId || request.deliveryId,
          receiverId: message.receiverId || request.receiverId
        };

        // Add to local messages immediately for better UX
        const currentMessages = this.messagesSubject.value;
        this.messagesSubject.next([completeMessage, ...currentMessages]);
        return completeMessage;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error sending message:', error);
        if (error.status === 401) {
          console.error('Authentication error - user may need to login again');
          this.handleAuthenticationError();
        }
        return throwError(() => new Error('Failed to send message'));
      })
    );
  }

getMessages(deliveryId: string, otherUserId: string, page: number = 0, size: number = 20): Observable<PageResponse<Message>> {
  const params = new HttpParams()
    .set('deliveryId', deliveryId)
    .set('otherUserId', otherUserId)
    .set('page', page.toString())
    .set('size', size.toString());

  console.log('Getting messages with params:', { deliveryId, otherUserId, page, size });

  return this.http.get<PageResponse<Message>>(
    `${this.API_URL}/messages`,
    this.getRequestOptions(params)
  ).pipe(
    retry(1),
    tap(response => console.log('Get messages response:', response)),
    map(response => {
      if (!response || !Array.isArray(response.content)) {
        throw new Error('Invalid response format');
      }

      // Convert timestamp strings to Date objects safely
      response.content = response.content.map(msg => ({
        ...msg,
        timestamp: this.safeCreateDate(msg.timestamp) || new Date(),
        readAt: this.safeCreateDate(msg.readAt), // Keep as undefined if invalid
        status: msg.status || MessageStatus.DELIVERED,
        senderId: msg.senderId || '',
        deliveryId: msg.deliveryId || deliveryId
      }));
      
      if (page === 0) {
        this.messagesSubject.next(response.content);
      } else {
        const currentMessages = this.messagesSubject.value;
        this.messagesSubject.next([...currentMessages, ...response.content]);
      }
      
      return response;
    }),
    catchError((error: HttpErrorResponse) => {
      console.error('Error loading messages:', error);
      if (error.status === 401) {
        console.error('Authentication error while loading messages');
        this.handleAuthenticationError();
      }
      const emptyResponse: PageResponse<Message> = {
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: size,
        number: page,
        first: true,
        last: true,
        numberOfElements: 0,
        empty: true,
        pageable: {
          sort: { empty: true, sorted: false, unsorted: true },
          offset: 0,
          pageSize: size,
          pageNumber: page,
          paged: true,
          unpaged: false
        },
        sort: { empty: true, sorted: false, unsorted: true }
      };
      return of(emptyResponse);
    })
  );
}

getChatRooms(): Observable<ChatRoom[]> {
  return this.http.get<ChatRoom[]>(
    `${this.API_URL}/rooms`,
    this.getRequestOptions()
  ).pipe(
    retry(1),
    tap(response => console.log('Get chat rooms response:', response)),
    map(rooms => {
      if (!Array.isArray(rooms)) {
        console.error('Invalid chat rooms response - not an array:', rooms);
        throw new Error('Invalid chat rooms response');
      }

      // Convert date strings to Date objects safely
      const processedRooms = rooms.map(room => ({
        ...room,
        createdAt: this.safeCreateDate(room.createdAt) || new Date(),
        lastMessageAt: this.safeCreateDate(room.lastMessageAt), // Keep as undefined if invalid
        unreadCount: room.unreadCount || 0,
        status: room.status || 'ACTIVE'
      }));
      
      this.chatRoomsSubject.next(processedRooms);
      return processedRooms;
    }),
    catchError((error: HttpErrorResponse) => {
      console.error('Error loading chat rooms:', error);
      if (error.status === 401) {
        console.error('Authentication error while loading chat rooms');
        this.handleAuthenticationError();
      } else if (error.status === 500) {
        console.error('Server error while loading chat rooms - check backend logs');
      }
      return of([]);
    })
  );
}


  markMessagesAsRead(deliveryId: string, senderId: string): Observable<void> {
    if (!deliveryId || !senderId) {
      return throwError(() => new Error('DeliveryId and senderId are required'));
    }

    const params = new HttpParams()
      .set('deliveryId', deliveryId)
      .set('senderId', senderId);

    return this.http.post<void>(`${this.API_URL}/mark-read`, null, {
      ...this.getRequestOptions(),
      params
    }).pipe(
      tap(() => console.log('Messages marked as read')), // Debug log
      map(() => {
        // Update local messages status
        const currentMessages = this.messagesSubject.value;
        const updatedMessages = currentMessages.map(msg => {
          if (msg.deliveryId === deliveryId && msg.senderId === senderId && msg.status !== MessageStatus.READ) {
            return { ...msg, status: MessageStatus.READ, readAt: new Date() };
          }
          return msg;
        });
        this.messagesSubject.next(updatedMessages);
        
        // Update chat rooms
        this.loadChatRooms();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error marking messages as read:', error);
        if (error.status === 401) {
          this.handleAuthenticationError();
        }
        return throwError(() => new Error('Failed to mark messages as read'));
      })
    );
  }

  getUnreadCount(deliveryId: string): Observable<number> {
    if (!deliveryId) {
      return of(0);
    }

    const params = new HttpParams().set('deliveryId', deliveryId);
    
    return this.http.get<number>(`${this.API_URL}/unread-count`, {
      ...this.getRequestOptions(),
      params
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error getting unread count:', error);
        if (error.status === 401) {
          this.handleAuthenticationError();
        }
        return of(0);
      })
    );
  }

  // Test method to check authentication
  testChatHealth(): Observable<string> {
    return this.http.get<string>(`${this.API_URL}/health`, {
      ...this.getRequestOptions(),
      responseType: 'text' as 'json'
    }).pipe(
      tap(response => console.log('Chat health response:', response)),
      catchError((error: HttpErrorResponse) => {
        console.error('Chat health check failed:', error);
        if (error.status === 401) {
          this.handleAuthenticationError();
        }
        return throwError(() => error);
      })
    );
  }

  // WebSocket Methods
  sendMessageViaWebSocket(request: ChatMessageRequest): void {
    if (!request.content?.trim() || !request.receiverId || !request.deliveryId) {
      console.error('Invalid message request for WebSocket:', request);
      return;
    }
    this.webSocketService.sendChatMessage(request);
  }

  sendTypingIndicator(receiverId: string, deliveryId: string, isTyping: boolean = true): void {
    if (!receiverId || !deliveryId) {
      console.error('Invalid typing indicator parameters');
      return;
    }

    const indicator: TypingIndicator = {
      senderId: this.getCurrentUserId(),
      receiverId,
      deliveryId,
      isTyping,
      timestamp: new Date()
    };

    if (isTyping) {
      this.webSocketService.sendTypingIndicator(indicator);
    } else {
      this.webSocketService.sendStopTypingIndicator(indicator);
    }
  }

  // State Management Methods
  setCurrentChatRoom(deliveryId: string | null): void {
    this.currentChatRoomSubject.next(deliveryId);
    if (deliveryId) {
      this.messagesSubject.next([]); // Clear messages when switching rooms
    }
  }

  getCurrentChatRoom(): Observable<string | null> {
    return this.currentChatRoomSubject.asObservable();
  }

  getMessagesObservable(): Observable<Message[]> {
    return this.messagesSubject.asObservable();
  }

  getChatRoomsObservable(): Observable<ChatRoom[]> {
    return this.chatRoomsSubject.asObservable();
  }

  getTypingUsersObservable(): Observable<Map<string, TypingIndicator>> {
    return this.typingUsersSubject.asObservable();
  }

  getUnreadCountObservable(): Observable<number> {
    return this.unreadCountSubject.asObservable();
  }

  // Utility Methods
  private getCurrentUserId(): string {
    // Use the AuthService to get current user ID
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.userId) {
      return currentUser.userId;
    }
    
    console.error('Unable to get current user ID');
    return '';
  }

  private handleAuthenticationError(): void {
    console.warn('Authentication error detected, redirecting to login');
    // Clear any cached user data and redirect to login
    this.authService.logout();
  }

  private loadChatRooms(): void {
    // Only load if user is authenticated
    if (!this.authService.isAuthenticated()) {
      console.warn('User not authenticated, skipping chat room load');
      return;
    }

    this.getChatRooms().subscribe({
      next: (rooms) => {
        console.log('Successfully loaded chat rooms:', rooms.length);
      },
      error: (error) => {
        console.error('Failed to load chat rooms:', error);
      }
    });
  }

  private updateUnreadCount(): void {
    // Calculate total unread count across all chat rooms
    const chatRooms = this.chatRoomsSubject.value;
    const totalUnread = chatRooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0);
    this.unreadCountSubject.next(totalUnread);
  }

  // Public utility methods
  isUserTyping(userId: string, deliveryId: string): boolean {
    const key = `${userId}-${deliveryId}`;
    return this.typingUsersSubject.value.has(key);
  }

  getTypingUsersForRoom(deliveryId: string): TypingIndicator[] {
    const typingUsers = this.typingUsersSubject.value;
    const result: TypingIndicator[] = [];
    
    typingUsers.forEach((indicator, key) => {
      if (indicator.deliveryId === deliveryId && indicator.isTyping) {
        result.push(indicator);
      }
    });
    
    return result;
  }

  // Initialize chat service
  initialize(): void {
    console.log('Initializing chat service...');
    
    // Check if user is authenticated first
    if (!this.authService.isAuthenticated()) {
      console.warn('User not authenticated, skipping chat service initialization');
      return;
    }
    
    // Test authentication first
    this.testChatHealth().subscribe({
      next: (response) => {
        console.log('Chat service authenticated successfully');
        this.loadChatRooms();
        this.updateUnreadCount();
      },
      error: (error) => {
        console.error('Chat service authentication failed:', error);
      }
    });
  }

  // Method to check if chat service is ready
  isReady(): boolean {
    return this.authService.isAuthenticated() && this.connectionState.value;
  }

  // Method to get current user info for chat
  getCurrentUserInfo(): { userId: string; userType: string } | null {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.userId && currentUser?.userType) {
      return {
        userId: currentUser.userId,
        userType: currentUser.userType
      };
    }
    return null;
  }

  // Cleanup
  destroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.unsubscribe();
    
    // Complete all subjects
    this.messagesSubject.complete();
    this.chatRoomsSubject.complete();
    this.typingUsersSubject.complete();
    this.unreadCountSubject.complete();
    this.currentChatRoomSubject.complete();
    this.userStatusSubject.complete();
    this.connectionState.complete();
    
    // Clear typing timeouts
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
  }

  private safeCreateDate(dateValue: any): Date | undefined {
    if (!dateValue) return undefined;
    
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? undefined : date;
  }
}