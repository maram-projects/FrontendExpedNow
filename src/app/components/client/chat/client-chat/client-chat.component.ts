// client-chat.component.ts (fixed)
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
import { 
  debounceTime, 
  distinctUntilChanged, 
  takeUntil, 
  filter, 
  switchMap, 
  tap, 
  catchError 
} from 'rxjs/operators';
import { 
  ChatRoom, 
  Message, 
  TypingIndicator, 
  ChatMessageRequest,
  MessageStatus,
  PageResponse
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
  sendingMessage: boolean;
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
  
  public MessageStatus = MessageStatus;

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
  typingUsers$: Observable<TypingIndicator[]> = of([]);
  isOnline$: Observable<boolean> = of(false);
  connectionStatus$: Observable<boolean>;
  
  // State management
  private state$ = new BehaviorSubject<ChatState>({
    isLoading: false,
    isConnecting: false,
    connectionRetries: 0,
    error: null,
    lastActivity: new Date(),
    sendingMessage: false
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
    this.monitorConnection();
  }

  ngAfterViewInit(): void {
    this.setupScrollListeners();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

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
    // Messages subscription - using the correct observable
    this.subscriptions.add(
      this.chatService.messages$.pipe(
        takeUntil(this.destroy$)
      ).subscribe(messages => {
        this.ngZone.run(() => {
          this.messages = this.sortMessagesByTime(messages);
          this.cdr.markForCheck();
          this.scrollToBottom();
        });
      })
    );

    // Chat rooms subscription
    this.subscriptions.add(
      this.chatService.chatRooms$.pipe(
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

    // Error subscription
    this.subscriptions.add(
      this.chatService.error$.pipe(
        filter(error => error !== null),
        takeUntil(this.destroy$)
      ).subscribe(error => {
        this.updateState({ error });
      })
    );

    // Loading state subscription
    this.subscriptions.add(
      this.chatService.loading$.pipe(
        takeUntil(this.destroy$)
      ).subscribe(isLoading => {
        this.updateState({ isLoading });
      })
    );

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

  // Add missing methods
  private async initializeWebSocket(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser?.token) {
      this.updateState({ error: 'Authentication token missing' });
      return Promise.reject();
    }

    this.updateState({ isConnecting: true });

    try {
      await this.chatService.connectWebSocket();
      this.updateState({ isConnecting: false, error: null });
      return Promise.resolve();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.updateState({ 
        isConnecting: false, 
        error: 'Failed to connect to chat server. Retrying...' 
      });
      this.scheduleReconnection();
      return Promise.reject(error);
    }
  }

  private monitorConnection(): void {
    this.webSocketService.getConnectionStatus().pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(isConnected => {
      if (!isConnected) {
        console.warn('WebSocket disconnected! Attempting reconnection...');
        this.initializeWebSocket();
      }
    });
  }

  private setupScrollListeners(): void {
    if (this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.addEventListener('scroll', 
        this.onScroll.bind(this), { passive: true });
    }
  }

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
    
    if (this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.removeEventListener('scroll', this.onScroll);
    }
  }

  private handleConnectionRestore(): void {
    if (navigator.onLine) {
      this.updateState({ error: null });
      this.initializeWebSocket();
    }
  }

  private updateState(updates: Partial<ChatState>): void {
    const currentState = this.state$.value;
    this.state$.next({ 
      ...currentState, 
      ...updates, 
      lastActivity: new Date() 
    });
    this.cdr.markForCheck();
  }

  private loadInitialData(): void {
    this.updateState({ isLoading: true });
    
    this.chatService.loadChatRooms().pipe(
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

  private sendTypingIndicator(isTyping: boolean): void {
    if (!this.selectedRoom || !this.webSocketService.isConnected()) return;

    this.chatService.sendTypingIndicator(
      this.selectedRoom.deliveryPersonId, // Note: This is different from delivery component
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

  private sortMessagesByTime(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }

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

  private handleRoomsUpdate(rooms: ChatRoom[]): void {
    if (rooms.length > 0 && !this.selectedRoom) {
      this.selectRoom(rooms[0]);
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

  private stopTyping(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    
    if (this.selectedRoom && this.webSocketService.isConnected()) {
      this.sendTypingIndicator(false);
    }
  }

  // Add missing selectRoom method
  selectRoom(room: ChatRoom): void {
    if (this.selectedRoom?.deliveryId === room.deliveryId) return;

    this.selectedRoom = room;
    this.currentPage = 0;
    this.hasMoreMessages = true;
    
    this.chatService.setCurrentChatRoom(room.deliveryId);
    
    if (room.deliveryPersonId) {
      this.loadMessages(room.deliveryId, room.deliveryPersonId);
      this.loadOtherUser(room.deliveryPersonId);
      this.isOnline$ = this.chatService.isUserOnline(room.deliveryPersonId);
      this.typingUsers$ = this.chatService.getTypingUsers(room.deliveryId);
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

  // Add missing loadMoreMessages method
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
      next: (response: PageResponse<Message>) => {
        this.currentPage = nextPage;
        this.hasMoreMessages = !response.last;
        this.isLoadingMore = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading more messages:', error);
        this.isLoadingMore = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Message handling
  async sendMessage(): Promise<void> {
    if (!this.canSendMessage()) return;

    // Check WebSocket connection
    if (!this.webSocketService.isConnected()) {
      try {
        await this.initializeWebSocket();
        // Small delay to ensure connection is established
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        this.updateState({ error: 'Unable to connect. Please try again.' });
        return;
      }
    }

    const messageContent = this.newMessage.trim();
    const messageRequest: ChatMessageRequest = {
      receiverId: this.selectedRoom!.deliveryPersonId,
      deliveryId: this.selectedRoom!.deliveryId,
      content: messageContent,
      messageType: 'TEXT'
    };

    // Clear input and update UI state
    this.newMessage = '';
    this.stopTyping();
    this.resizeTextarea();
    this.updateLastActivity();
    this.updateState({ sendingMessage: true });

    this.chatService.sendMessage(messageRequest).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.updateState({ sendingMessage: false });
      },
      error: (error) => {
        console.error('Error sending message:', error);
        // Restore message on error
        this.newMessage = messageContent;
        this.updateState({ 
          error: 'Failed to send message. Please try again.',
          sendingMessage: false 
        });
        this.focusMessageInput();
      }
    });
  }

  public canSendMessage(): boolean {
    return !!(
      this.newMessage.trim() && 
      this.selectedRoom && 
      !this.state$.value.sendingMessage &&
      !this.state$.value.isLoading
    );
  }

  // Typing indicators
  onTyping(): void {
    this.typingSubject.next(this.newMessage);
    this.resizeTextarea();
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onBlurMessageInput(): void {
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
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
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

  // Connection management
  retryConnection(): void {
    this.updateState({ connectionRetries: 0, error: null });
    this.initializeWebSocket();
  }

  // Component state getters
  get state(): ChatState {
    return this.state$.value;
  }

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
    return this.isLoading || this.isConnecting || this.state$.value.sendingMessage;
  }

  setQuickMessage(message: string): void {
    this.ngZone.run(() => {
      this.newMessage = message;
      this.resizeTextarea();
      this.focusMessageInput();
      this.cdr.detectChanges();
    });
  }

  // Add this property to both components for quick messages functionality
quickMessages: string[] = [
  "On my way!",
  "Almost there",
  "Running a bit late",
  "Thank you!",
  "Delivered successfully"
];
}