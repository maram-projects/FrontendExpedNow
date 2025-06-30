// delivery-chat-component.component.ts
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef, 
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of, timer, Subject, BehaviorSubject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { 
  debounceTime, 
  distinctUntilChanged, 
  takeUntil, 
  catchError 
} from 'rxjs/operators';
import { 
  ChatRoom, 
  Message, 
  TypingIndicator, 
  ChatMessageRequest,
  MessageStatus 
} from '../../../../models/chat.models';
import { ChatService } from '../../../../services/chat.service';
import { UserService } from '../../../../services/user.service';
import { User } from '../../../../models/user.model';
import { AuthService } from '../../../../services/auth.service';
import { WebSocketService } from '../../../../services/web-socket.service';

interface DeliveryRequest {
  deliveryId: string;
  clientId: string;
  deliveryPersonId: string;
}

interface ChatState {
  isLoading: boolean;
  isConnecting: boolean;
  connectionRetries: number;
  error: string | null;
  lastActivity: Date;
}

@Component({
  selector: 'app-delivery-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery-chat-component.component.html',
  styleUrls: ['./delivery-chat-component.component.css']
})
export class DeliveryChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput!: ElementRef<HTMLTextAreaElement>;
  public MessageStatus = MessageStatus; // Expose to template

  // Core data
  messages: Message[] = [];
  rooms: ChatRoom[] = [];
  selectedRoom: ChatRoom | null = null;
  otherUser: User | null = null;
  
  // Input and typing
  newMessage = '';
  private typingTimer: any;
  private typingSubject = new Subject<string>();
  
  // Observables
  typingStatus$: Observable<Map<string, TypingIndicator>> = of(new Map());
  isOnline$: Observable<boolean> = of(false);
  connectionStatus$: Observable<boolean>;
  
  // State management
  state$ = new BehaviorSubject<ChatState>({
    isLoading: false,
    isConnecting: false,
    connectionRetries: 0,
    error: null,
    lastActivity: new Date()
  });
  
  // Component lifecycle
  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();
  
  // Delivery context
  delivery: DeliveryRequest = {
    deliveryId: '',
    clientId: '',
    deliveryPersonId: ''
  };

  // Pagination
  private currentPage = 0;
  private readonly pageSize = 20;
  public hasMoreMessages = true;
  public isLoadingMore = false;

  constructor(
    private chatService: ChatService,
    private userService: UserService,
    private route: ActivatedRoute,
    private authService: AuthService,
    public webSocketService: WebSocketService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.connectionStatus$ = this.webSocketService.getConnectionStatus();
  }
ngOnInit(): void {
  this.initializeComponent();
  this.setupTypingHandler();
  this.setupSubscriptions();
  this.initializeWebSocket();
  this.monitorConnection(); // Add this line to monitor WebSocket connection
}

  ngOnDestroy(): void {
    this.cleanup();
  }

  // Component initialization
  private initializeComponent(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.updateState({ error: 'Authentication required' });
      return;
    }

    this.delivery.deliveryPersonId = currentUser.userId;
    
    // Load route data
    this.subscriptions.add(
      this.route.data.pipe(
        takeUntil(this.destroy$)
      ).subscribe(data => {
        if (data['delivery']) {
          this.delivery = { ...this.delivery, ...data['delivery'] };
        }
        this.loadInitialData();
      })
    );
  }

  private setupTypingHandler(): void {
    this.subscriptions.add(
      this.typingSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      ).subscribe(message => {
        if (message.trim() && !this.state$.value.isLoading) {
          this.sendTypingIndicator(true);
          this.scheduleStopTyping();
        }
      })
    );
  }

  private setupSubscriptions(): void {
    // Messages subscription
    this.subscriptions.add(
      this.chatService.getMessagesObservable().pipe(
        takeUntil(this.destroy$)
      ).subscribe(messages => {
        this.ngZone.run(() => {
          this.messages = messages;
          this.cdr.markForCheck();
          this.scrollToBottom();
        });
      })
    );

    // Chat rooms subscription
    this.subscriptions.add(
      this.chatService.getChatRoomsObservable().pipe(
        takeUntil(this.destroy$)
      ).subscribe(rooms => {
        this.ngZone.run(() => {
          this.rooms = rooms;
          this.handleRoomsUpdate(rooms);
          this.cdr.markForCheck();
        });
      })
    );

    // Connection status subscription
    this.subscriptions.add(
      this.connectionStatus$.pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      ).subscribe(isConnected => {
        this.ngZone.run(() => {
          if (isConnected) {
            this.updateState({ isConnecting: false, error: null });
          } else {
            this.updateState({ 
              isConnecting: true, 
              error: 'Connecting to chat server...' 
            });
          }
          this.cdr.markForCheck();
        });
      })
    );

    // Typing status
    this.typingStatus$ = this.chatService.getTypingUsersObservable();

    // WebSocket max reconnect attempts
    this.subscriptions.add(
      this.webSocketService.getMaxReconnectAttemptsReached().pipe(
        takeUntil(this.destroy$)
      ).subscribe(maxReached => {
        if (maxReached) {
          this.updateState({ 
            error: 'Unable to connect to chat server. Please refresh the page.',
            isConnecting: false 
          });
        }
      })
    );
  }

  private async initializeWebSocket(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser?.token) {
      this.updateState({ error: 'Authentication token missing' });
      return;
    }

    this.updateState({ isConnecting: true });

    try {
      await this.webSocketService.connect(currentUser.token, currentUser.userId);
      this.updateState({ isConnecting: false, error: null });
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.updateState({ 
        isConnecting: false, 
        error: 'Failed to connect to chat server. Retrying...' 
      });
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    const state = this.state$.value;
    if (state.connectionRetries < 3) {
      timer(2000 * (state.connectionRetries + 1)).pipe(
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.updateState({ connectionRetries: state.connectionRetries + 1 });
        this.initializeWebSocket();
      });
    }
  }

  private loadInitialData(): void {
    this.updateState({ isLoading: true });
    
    this.chatService.getChatRooms().pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Failed to load chat rooms:', error);
        this.updateState({ 
          isLoading: false, 
          error: 'Failed to load chat rooms' 
        });
        return of([]);
      })
    ).subscribe(rooms => {
      this.updateState({ isLoading: false });
      if (rooms.length > 0) {
        this.selectRoom(rooms[0]);
      }
    });
  }

  private handleRoomsUpdate(rooms: ChatRoom[]): void {
    if (rooms.length > 0 && !this.selectedRoom) {
      this.selectRoom(rooms[0]);
    }
  }

  // Room selection
  selectRoom(room: ChatRoom): void {
    if (this.selectedRoom?.deliveryId === room.deliveryId) return;

    this.selectedRoom = room;
    this.currentPage = 0;
    this.hasMoreMessages = true;
    
    this.chatService.setCurrentChatRoom(room.deliveryId);
    
    if (room.clientId) {
      this.loadMessages(room.deliveryId, room.clientId);
      this.loadOtherUser(room.clientId);
      this.isOnline$ = this.chatService.isUserOnline(room.clientId);
    }
    
    this.markMessagesAsRead();
    this.focusMessageInput();
  }

  private loadMessages(deliveryId: string, otherUserId: string): void {
    this.chatService.getMessages(deliveryId, otherUserId, 0, this.pageSize).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      error: (error) => {
        console.error('Error loading messages:', error);
        this.updateState({ error: 'Failed to load messages' });
      }
    });
  }

  private loadOtherUser(userId: string): void {
    this.userService.getUserById(userId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (user: User) => {
        this.otherUser = user;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.otherUser = null;
        this.cdr.markForCheck();
      }
    });
  }

  // Message handling
async sendMessage(): Promise<void> {
  if (!this.webSocketService.isConnected()) {
    await this.initializeWebSocket();
    // Add small delay to ensure connection
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  if (!this.canSendMessage()) return;

  const messageContent = this.newMessage.trim();
  const messageRequest: ChatMessageRequest = {
    receiverId: this.selectedRoom!.clientId,
    deliveryId: this.selectedRoom!.deliveryId,
    content: messageContent,
    messageType: 'TEXT'
  };

  // Optimistic UI update
  this.newMessage = '';
  this.stopTyping();
  this.resizeTextarea();
  this.updateLastActivity();

  this.chatService.sendMessage(messageRequest).pipe(
    takeUntil(this.destroy$)
  ).subscribe({
    next: () => {
      // Message already added optimistically in service
    },
    error: (error) => {
      console.error('Error sending message:', error);
      // Restore message on error
      this.newMessage = messageContent;
      this.updateState({ error: 'Failed to send message. Please try again.' });
      this.focusMessageInput();
    }
  });
}

// In delivery-chat-component.component.ts
public canSendMessage(): boolean {
  return !!(
    this.newMessage.trim() && 
    this.selectedRoom && 
    !this.state$.value.isLoading
    // Removed: this.webSocketService.isConnected()
  );
}

  // Typing indicators
  onTyping(): void {
    this.typingSubject.next(this.newMessage);
    this.resizeTextarea();
  }

  private sendTypingIndicator(isTyping: boolean): void {
    if (!this.selectedRoom) return;

    this.chatService.sendTypingIndicator(
      this.selectedRoom.clientId,
      this.selectedRoom.deliveryId,
      isTyping
    );
  }

  private scheduleStopTyping(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    
    this.typingTimer = setTimeout(() => {
      this.stopTyping();
    }, 3000);
  }

  private stopTyping(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    
    if (this.selectedRoom) {
      this.sendTypingIndicator(false);
    }
  }

  // Input handling
  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onBlurMessageInput(): void {
    // Delay to allow click events to register first
    setTimeout(() => this.stopTyping(), 100);
  }

  private resizeTextarea(): void {
    if (this.messageInput?.nativeElement) {
      const element = this.messageInput.nativeElement;
      element.style.height = 'auto';
      element.style.height = Math.min(element.scrollHeight, 120) + 'px';
    }
  }

  public focusMessageInput(): void {
    setTimeout(() => {
      if (this.messageInput?.nativeElement) {
        this.messageInput.nativeElement.focus();
      }
    }, 100);
  }

  // Message management
  private markMessagesAsRead(): void {
    if (!this.selectedRoom) return;

    this.chatService.markMessagesAsRead(
      this.selectedRoom.deliveryId,
      this.selectedRoom.clientId
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      error: (error) => {
        console.error('Error marking messages as read:', error);
      }
    });
  }

private scrollToBottom(smooth: boolean = true): void {
  this.ngZone.runOutsideAngular(() => {
    setTimeout(() => {
      try {
        if (this.messagesContainer?.nativeElement) {
          const element = this.messagesContainer.nativeElement;
          // Scroll to TOP instead of bottom
          element.scrollTo({
            top: 0,  // Changed to 0 (top) instead of scrollHeight (bottom)
            behavior: smooth ? 'smooth' : 'auto'
          });
        }
      } catch (err) {
        console.error('Error scrolling to top:', err); // Updated error message
      }
    }, 50);
  });
}

  // State management
  private updateState(updates: Partial<ChatState>): void {
    const currentState = this.state$.value;
    this.state$.next({ 
      ...currentState, 
      ...updates, 
      lastActivity: new Date() 
    });
    this.cdr.markForCheck();
  }

  private updateLastActivity(): void {
    this.updateState({ lastActivity: new Date() });
  }

  // Template helper methods
  trackByRoomId(index: number, room: ChatRoom): string {
    return room.deliveryId;
  }

  trackByMessageId(index: number, message: Message): string {
    return message.id || `${message.senderId}-${message.timestamp}-${index}`;
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.delivery.deliveryPersonId;
  }

  formatMessageTime(timestamp: Date | undefined): string {
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  }

  isValidDate(date: Date | undefined): boolean {
    if (!date) return false;
    const dateObj = date instanceof Date ? date : new Date(date);
    return !isNaN(dateObj.getTime());
  }

  getOtherUserDisplayName(): string {
    if (!this.otherUser) return 'Client';
    
    const firstName = this.otherUser.firstName || '';
    const lastName = this.otherUser.lastName || '';
    
    return firstName && lastName 
      ? `${firstName} ${lastName}`
      : firstName || lastName || 'Client';
  }

  getOtherUserFirstName(): string {
    return this.otherUser?.firstName || 'Client';
  }

  isOtherUserLoaded(): boolean {
    return this.otherUser !== null;
  }

  isUserTypingInCurrentRoom(userId: string): boolean {
    if (!this.selectedRoom) return false;
    return this.chatService.isUserTyping(userId, this.selectedRoom.deliveryId);
  }

  getTypingUsersForCurrentRoom(): TypingIndicator[] {
    if (!this.selectedRoom) return [];
    return this.chatService.getTypingUsersForRoom(this.selectedRoom.deliveryId);
  }

  // Connection management
  retryConnection(): void {
    this.updateState({ connectionRetries: 0, error: null });
    this.initializeWebSocket();
  }

  // Component state getters
  get isLoading(): boolean {
    return this.state$.value.isLoading;
  }

  get isConnecting(): boolean {
    return this.state$.value.isConnecting;
  }

  get hasError(): boolean {
    return !!this.state$.value.error;
  }

  get errorMessage(): string | null {
    return this.state$.value.error;
  }

  get canRetry(): boolean {
    return this.hasError && !this.isConnecting;
  }

  get isInputDisabled(): boolean {
    return this.isLoading || this.isConnecting || !this.webSocketService.isConnected();
  }

  // Cleanup
  private cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
    this.state$.complete();
    
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    
    this.stopTyping();
    this.chatService.setCurrentChatRoom(null);
  }

  // Add to DeliveryChatComponent class
public loadMoreMessages(): void {
  if (!this.selectedRoom || this.isLoadingMore || !this.hasMoreMessages) return;

  this.isLoadingMore = true;
  const nextPage = this.currentPage + 1;

  this.chatService.getMessages(
    this.selectedRoom.deliveryId, 
    this.selectedRoom.clientId, 
    nextPage, 
    this.pageSize
  ).pipe(
    takeUntil(this.destroy$)
  ).subscribe({
    next: (response) => {
      this.currentPage = nextPage;
      this.hasMoreMessages = !response.last;
      this.isLoadingMore = false;
    },
    error: (error) => {
      console.error('Error loading more messages:', error);
      this.isLoadingMore = false;
    }
  });
}
setQuickMessage(message: string): void {
  this.ngZone.run(() => {
    this.newMessage = message;
    this.resizeTextarea();
    this.focusMessageInput();
    this.cdr.detectChanges();
  });
}


monitorConnection() {
    this.webSocketService.getConnectionStatus().subscribe(isConnected => {
        if (!isConnected) {
            console.warn('WebSocket disconnected! Reconnecting...');
            this.initializeWebSocket();
        }
    });
}}