
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, map, catchError, of, throwError, Subscription } from 'rxjs';
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
    private authService: AuthService
  ) {
    this.initializeWebSocketListeners();
    this.initializeUserStatusTracking();
  }

  private getRequestOptions(params?: HttpParams): { 
  headers: HttpHeaders; 
  params?: HttpParams 
} {
  return {
    headers: this.authService.getAuthHeaders(),
    params
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

    const currentMessages = this.messagesSubject.value;
    const updatedMessages = [message, ...currentMessages];
    this.messagesSubject.next(updatedMessages);
    
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
    if (!indicator?.senderId || !indicator?.deliveryId) {
      console.error('Invalid typing indicator:', indicator);
      return;
    }

    const typingUsers = new Map(this.typingUsersSubject.value);
    const key = `${indicator.senderId}-${indicator.deliveryId}`;

    if (indicator.isTyping) {
      typingUsers.set(key, indicator);
      
      // Clear existing timeout
      if (this.typingTimeouts.has(key)) {
        clearTimeout(this.typingTimeouts.get(key));
      }
      
      // Set new timeout to remove typing indicator
      const timeout = setTimeout(() => {
        typingUsers.delete(key);
        this.typingUsersSubject.next(new Map(typingUsers));
        this.typingTimeouts.delete(key);
      }, this.config.typingTimeoutDuration);
      
      this.typingTimeouts.set(key, timeout);
    } else {
      typingUsers.delete(key);
      if (this.typingTimeouts.has(key)) {
        clearTimeout(this.typingTimeouts.get(key));
        this.typingTimeouts.delete(key);
      }
    }
    
    this.typingUsersSubject.next(new Map(typingUsers));
  }

  // HTTP API Methods
  sendMessage(request: ChatMessageRequest): Observable<Message> {
    if (!request.content?.trim() || !request.receiverId || !request.deliveryId) {
      return throwError(() => new Error('Invalid message request'));
    }

    return this.http.post<Message>(`${this.API_URL}/send`, request).pipe(
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
      catchError(error => {
        console.error('Error sending message:', error);
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

  return this.http.get<PageResponse<Message>>(
    `${this.API_URL}/messages`,
    this.getRequestOptions(params)
  ).pipe(
      map(response => {
        // Ensure response has the correct structure
        if (!response || !Array.isArray(response.content)) {
          throw new Error('Invalid response format');
        }

        // Convert timestamp strings to Date objects and ensure all required properties exist
        response.content = response.content.map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          readAt: msg.readAt ? new Date(msg.readAt) : undefined,
          status: msg.status || MessageStatus.DELIVERED,
          senderId: msg.senderId || '',
          deliveryId: msg.deliveryId || deliveryId
        }));
        
        if (page === 0) {
          // If it's the first page, replace all messages
          this.messagesSubject.next(response.content);
        } else {
          // If it's a subsequent page, append to existing messages
          const currentMessages = this.messagesSubject.value;
          this.messagesSubject.next([...currentMessages, ...response.content]);
        }
        
        return response;
      }),
      catchError(error => {
        console.error('Error loading messages:', error);
        // Return properly structured empty response
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
      map(rooms => {
        if (!Array.isArray(rooms)) {
          throw new Error('Invalid chat rooms response');
        }

        // Convert date strings to Date objects and ensure required properties
        const processedRooms = rooms.map(room => ({
          ...room,
          createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
          lastMessageAt: room.lastMessageAt ? new Date(room.lastMessageAt) : undefined,
          unreadCount: room.unreadCount || 0,
          status: room.status || 'ACTIVE'
        }));
        
        this.chatRoomsSubject.next(processedRooms);
        return processedRooms;
      }),
      catchError(error => {
        console.error('Error loading chat rooms:', error);
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

    return this.http.post<void>(`${this.API_URL}/mark-read`, null, { params }).pipe(
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
      catchError(error => {
        console.error('Error marking messages as read:', error);
        return throwError(() => new Error('Failed to mark messages as read'));
      })
    );
  }

  getUnreadCount(deliveryId: string): Observable<number> {
    if (!deliveryId) {
      return of(0);
    }

    const params = new HttpParams().set('deliveryId', deliveryId);
    
    return this.http.get<number>(`${this.API_URL}/unread-count`, { params }).pipe(
      catchError(error => {
        console.error('Error getting unread count:', error);
        return of(0);
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
    // Implement based on your authentication system
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        return user.userId || '';
      } catch (error) {
        console.error('Error parsing current user:', error);
      }
    }
    return '';
  }

  private loadChatRooms(): void {
    this.getChatRooms().subscribe({
      next: (rooms) => {
        // Successfully loaded rooms
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
    this.loadChatRooms();
    this.updateUnreadCount();
  }

  // Cleanup
  destroy(): void {
    // Complete all subjects
    this.messagesSubject.complete();
    this.chatRoomsSubject.complete();
    this.typingUsersSubject.complete();
    this.unreadCountSubject.complete();
    this.currentChatRoomSubject.complete();
    
    // Clear typing timeouts
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
  }
}