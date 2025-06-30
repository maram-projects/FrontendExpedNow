// client-chat.component.ts
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef, 
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  NgZone,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of, timer, Subject, BehaviorSubject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged, takeUntil, filter, switchMap, tap, catchError } from 'rxjs/operators';
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
  selector: 'app-client-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-chat.component.html',
  styleUrls: ['./client-chat.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientChatComponent implements OnInit, OnDestroy, AfterViewInit {
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
    private webSocketService: WebSocketService,
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
  ngAfterViewInit(): void {
    this.setupScrollListeners();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // Keyboard listeners for better UX
  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: any): void {
    if (this.newMessage.trim()) {
      event.returnValue = 'You have an unsent message. Are you sure you want to leave?';
    }
  }

  @HostListener('window:online', ['$event'])
  onOnline(event: Event): void {
    this.handleConnectionRestore();
  }

  @HostListener('window:offline', ['$event'])
  onOffline(event: Event): void {
    this.updateState({ error: 'You are offline. Messages will be sent when connection is restored.' });
  }

  // Component initialization
  private initializeComponent(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.updateState({ error: 'Authentication required' });
      return;
    }

    this.delivery.clientId = currentUser.userId;
    
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

  private handleConnectionRestore(): void {
    this.updateState({ connectionRetries: 0 });
    this.initializeWebSocket();
  }

  public loadInitialData(): void {
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

  private setupScrollListeners(): void {
    if (this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.addEventListener('scroll', 
        this.onScroll.bind(this), { passive: true });
    }
  }

  private onScroll(): void {
    if (!this.messagesContainer?.nativeElement || this.isLoadingMore || !this.hasMoreMessages) {
      return;
    }

    const element = this.messagesContainer.nativeElement;
    if (element.scrollTop === 0) {
      this.loadMoreMessages();
    }
  }

  public loadMoreMessages(): void {
    if (!this.selectedRoom || this.isLoadingMore || !this.hasMoreMessages) return;

    this.isLoadingMore = true;
    const nextPage = this.currentPage + 1;

    this.chatService.getMessages(
      this.selectedRoom.deliveryId, 
      this.selectedRoom.deliveryPersonId, 
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

  // Room selection
 selectRoom(room: ChatRoom): void {
  console.log('Selecting room:', room);
  
  if (this.selectedRoom?.deliveryId === room.deliveryId) {
    console.log('Room already selected');
    return;
  }

  // التحقق من صحة بيانات الغرفة
  if (!room.deliveryId || !room.deliveryPersonId) {
    console.error('Invalid room data:', room);
    this.updateState({ error: 'Invalid chat room data' });
    return;
  }

  this.selectedRoom = room;
  this.currentPage = 0;
  this.hasMoreMessages = true;
  
  console.log('Room selected successfully:', this.selectedRoom);
  
  this.chatService.setCurrentChatRoom(room.deliveryId);
  
  this.loadMessages(room.deliveryId, room.deliveryPersonId);
  this.loadOtherUser(room.deliveryPersonId);
  this.isOnline$ = this.chatService.isUserOnline(room.deliveryPersonId);
  
  this.markMessagesAsRead();
  this.focusMessageInput();
  this.cdr.markForCheck();
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

  checkConnectionStatus(): void {
  console.log('Connection status check:', {
    isConnected: this.webSocketService.isConnected(),
    connectionState: this.state$.value,
    selectedRoom: this.selectedRoom
  });
}

onMessageInputClick(): void {
  console.log('Message input clicked');
  this.checkConnectionStatus();
}

onMessageInputChange(): void {
  console.log('Message input changed:', this.newMessage);
  this.onTyping();
}
reloadMessages(): void {
  if (this.selectedRoom) {
    console.log('Reloading messages for room:', this.selectedRoom.deliveryId);
    this.loadMessages(this.selectedRoom.deliveryId, this.selectedRoom.deliveryPersonId);
  }
}

private handleConnectionError(error: any): void {
  console.error('Connection error:', error);
  this.updateState({ 
    error: 'Connection lost. Trying to reconnect...',
    isConnecting: true 
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
 sendMessage(): void {
  console.log('sendMessage called');
  
  if (!this.canSendMessage()) {
    console.log('Cannot send message - conditions not met');
    return;
  }

  const messageContent = this.newMessage.trim();
  console.log('Sending message:', messageContent);

  if (!this.selectedRoom) {
    console.error('No room selected');
    return;
  }

  const messageRequest: ChatMessageRequest = {
    receiverId: this.selectedRoom.deliveryPersonId,
    deliveryId: this.selectedRoom.deliveryId,
    content: messageContent,
    messageType: 'TEXT'
  };

  console.log('Message request:', messageRequest);

  // تنظيف النموذج
  const originalMessage = this.newMessage;
  this.newMessage = '';
  this.stopTyping();
  this.resizeTextarea();
  this.updateLastActivity();

  // إرسال الرسالة
  this.chatService.sendMessage(messageRequest).pipe(
    takeUntil(this.destroy$)
  ).subscribe({
    next: (response) => {
      console.log('Message sent successfully:', response);
      // لا حاجة لإضافة الرسالة هنا لأن الخدمة تضيفها
    },
    error: (error) => {
      console.error('Error sending message:', error);
      // استعادة الرسالة في حالة الخطأ
      this.newMessage = originalMessage;
      this.updateState({ 
        error: 'Failed to send message. Please try again.' 
      });
      this.focusMessageInput();
      this.cdr.markForCheck();
    }
  });
}

public canSendMessage(): boolean {
  console.log('Checking if can send message:', {
    newMessage: this.newMessage.trim(),
    selectedRoom: !!this.selectedRoom,
    isLoading: this.state$.value.isLoading,
    isConnected: this.webSocketService.isConnected(),
    connectionStatus: this.connectionStatus$
  });

   return !!(
    this.newMessage.trim() && 
    this.selectedRoom && 
    this.selectedRoom.deliveryPersonId &&
    this.selectedRoom.deliveryId &&
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
      this.selectedRoom.deliveryPersonId,
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
  console.log('Enter key pressed:', event);
  
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Attempting to send message via Enter key');
    this.sendMessage();
  }
}

onSendButtonClick(event?: Event): void {
  console.log('Send button clicked');
  
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  this.sendMessage();
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
      this.selectedRoom.deliveryPersonId
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      error: (error) => {
        console.error('Error marking messages as read:', error);
      }
    });
  }

  // UI utilities
  private scrollToBottom(smooth: boolean = true): void {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        try {
          if (this.messagesContainer?.nativeElement) {
            const element = this.messagesContainer.nativeElement;
            element.scrollTo({
              top: element.scrollHeight,
              behavior: smooth ? 'smooth' : 'auto'
            });
          }
        } catch (err) {
          console.error('Error scrolling to bottom:', err);
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
    return message.senderId === this.delivery.clientId;
  }

  formatMessageTime(timestamp: Date | undefined): string {
    if (!timestamp || !this.isValidDate(timestamp)) return '';
    
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
    if (!this.otherUser) return 'Delivery Person';
    
    const firstName = this.otherUser.firstName || '';
    const lastName = this.otherUser.lastName || '';
    
    return firstName && lastName 
      ? `${firstName} ${lastName}`
      : firstName || lastName || 'Delivery Person';
  }

  getOtherUserFirstName(): string {
    return this.otherUser?.firstName || 'Delivery Person';
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

  // Accessibility
  onRoomKeydown(event: KeyboardEvent, room: ChatRoom): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectRoom(room);
    }
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
    
    // Remove scroll listener
    if (this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.removeEventListener('scroll', this.onScroll);
    }
  }


  // Add this method to the ClientChatComponent class
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
}
}