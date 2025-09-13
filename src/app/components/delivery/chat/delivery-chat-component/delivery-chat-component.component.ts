// delivery-chat-component.component.ts (Updated with sidebar functionality)
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef, 
  ChangeDetectorRef,
  NgZone,
  AfterViewInit,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of, timer, Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  debounceTime, 
  distinctUntilChanged, 
  takeUntil, 
  catchError,
  tap,
  filter,
  map
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
  selector: 'app-delivery-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery-chat-component.component.html',
  styleUrls: ['./delivery-chat-component.component.css']
})
export class DeliveryChatComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput!: ElementRef<HTMLTextAreaElement>;
  
  public MessageStatus = MessageStatus;

  // Core data
  messages: Message[] = [];
  rooms: ChatRoom[] = [];
  selectedRoom: ChatRoom | null = null;
  otherUser: User | null = null;
  
  // Sidebar management
  isSidebarCollapsed = false;
  isMobile = false;
  showMobileSidebar = false;
  
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

  // Quick messages for both client and delivery person
  quickMessages: string[] = [
    "On my way!",
    "Almost there",
    "Running a bit late",
    "Thank you!",
    "Delivered successfully"
  ];

  constructor(
    private chatService: ChatService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private webSocketService: WebSocketService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.connectionStatus$ = this.webSocketService.getConnectionStatus();
    this.checkIfMobile();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.checkIfMobile();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: any): void {
    if (this.newMessage.trim()) {
      event.returnValue = 'You have an unsent message. Are you sure you want to leave?';
    }
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

  // ===== SIDEBAR MANAGEMENT =====
  
  private checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
    if (this.isMobile) {
      this.isSidebarCollapsed = false;
      this.showMobileSidebar = false;
    }
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.showMobileSidebar = !this.showMobileSidebar;
    } else {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }
  }

  showSidebar(): void {
    if (this.isMobile) {
      this.showMobileSidebar = true;
    }
  }

  hideSidebar(): void {
    if (this.isMobile) {
      this.showMobileSidebar = false;
    }
  }

  // ===== ROOM MANAGEMENT =====
  
  getRoomDisplayName(room: ChatRoom): string {
    const currentUser = this.authService.getCurrentUser();
    const isDeliveryPerson = currentUser?.userType === 'temporary' || currentUser?.userType === 'professional';
    
    if (isDeliveryPerson) {
      return room.clientName || room.otherUserName || 'Client';
    } else {
      return room.deliveryPersonName || room.otherUserName || 'Delivery Person';
    }
  }

  getOtherUserId(room: ChatRoom): string {
    const currentUser = this.authService.getCurrentUser();
    const isDeliveryPerson = currentUser?.userType === 'temporary' || currentUser?.userType === 'professional';
    
    if (isDeliveryPerson) {
      return room.clientId || room.otherUserId || '';
    } else {
      return room.deliveryPersonId || room.otherUserId || '';
    }
  }

  isUserOnline(userId: string): Observable<boolean> {
    if (!userId) return of(false);
    return this.chatService.isUserOnline(userId);
  }

  formatRoomTime(timestamp: Date | undefined): string {
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  selectRoom(room: ChatRoom): void {
    if (this.selectedRoom?.deliveryId === room.deliveryId) {
      if (this.isMobile) {
        this.hideSidebar();
      }
      return;
    }

    console.log('Selecting room:', {
      deliveryId: room.deliveryId,
      clientId: room.clientId,
      deliveryPersonId: room.deliveryPersonId,
      currentUserId: this.delivery.deliveryPersonId || this.delivery.clientId
    });

    this.selectedRoom = room;
    this.currentPage = 0;
    this.hasMoreMessages = true;
    
    this.chatService.setCurrentChatRoom(room.deliveryId);
    
    // Determine other user ID
    const otherUserId = this.getOtherUserId(room);
    
    if (!otherUserId) {
      console.error('No other user found for room:', room);
      this.updateState({ error: 'Invalid chat room configuration - no other participant found' });
      return;
    }
    
    console.log('Will chat with user:', otherUserId);
    
    this.loadMessages(room.deliveryId, otherUserId);
    this.loadOtherUser(otherUserId);
    this.isOnline$ = this.chatService.isUserOnline(otherUserId);
    this.typingUsers$ = this.chatService.getTypingUsers(room.deliveryId);
    
    this.markMessagesAsRead();
    this.focusMessageInput();
    
    // Hide sidebar on mobile after selection
    if (this.isMobile) {
      this.hideSidebar();
    }
    
    // Update URL with selected room
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { deliveryId: room.deliveryId },
      queryParamsHandling: 'merge'
    });
  }

  // ===== COMPONENT INITIALIZATION =====
  
  private initializeComponent(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.updateState({ error: 'Authentication required' });
      return;
    }

    // Determine if this is a delivery person or client
    const isDeliveryPerson = currentUser.userType === 'temporary' || currentUser.userType === 'professional';
    
    if (isDeliveryPerson) {
      this.delivery.deliveryPersonId = currentUser.userId;
    } else {
      this.delivery.clientId = currentUser.userId;
    }
    
    // Load route parameters
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        if (params['deliveryId'] && this.rooms.length > 0) {
          const targetRoom = this.rooms.find(r => r.deliveryId === params['deliveryId']);
          if (targetRoom) {
            this.selectRoom(targetRoom);
          }
        }
      })
    );
    
    this.loadInitialData();
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
      this.chatService.messages$.pipe(
        takeUntil(this.destroy$)
      ).subscribe(messages => {
        this.ngZone.run(() => {
          this.messages = this.sortMessagesByTime(messages);
          this.cdr.markForCheck();
          
          // Only scroll if we're at the bottom or it's a new message
          if (this.shouldScrollToBottom()) {
            this.scrollToBottom();
          }
        });
      })
    );

    // Chat rooms subscription with deduplication
    this.subscriptions.add(
      this.chatService.chatRooms$.pipe(
        takeUntil(this.destroy$),
        map(rooms => this.consolidateRoomsData(rooms)) // Add consolidation
      ).subscribe(rooms => {
        this.ngZone.run(() => {
          this.rooms = this.sortRoomsByActivity(rooms);
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
  }

  // Consolidate multiple rooms for the same user into one with combined data
  private consolidateRoomsData(rooms: ChatRoom[]): ChatRoom[] {
    const consolidatedMap = new Map<string, ChatRoom>();
    
    rooms.forEach(room => {
      const otherUserId = this.getOtherUserId(room);
      
      if (otherUserId) {
        if (consolidatedMap.has(otherUserId)) {
          const existing = consolidatedMap.get(otherUserId)!;
          
          // Consolidate data from multiple rooms for the same user
          const consolidated: ChatRoom = {
            ...existing,
            // Keep the most recent deliveryId if rooms are different deliveries
            deliveryId: room.lastMessageAt && existing.lastMessageAt && 
                       new Date(room.lastMessageAt) > new Date(existing.lastMessageAt) 
                       ? room.deliveryId : existing.deliveryId,
            // Sum up unread counts from all rooms with this user
            unreadCount: existing.unreadCount + room.unreadCount,
            // Keep the most recent message data
            lastMessage: room.lastMessageAt && existing.lastMessageAt && 
                        new Date(room.lastMessageAt) > new Date(existing.lastMessageAt)
                        ? room.lastMessage : existing.lastMessage,
            lastMessageAt: room.lastMessageAt && existing.lastMessageAt && 
                          new Date(room.lastMessageAt) > new Date(existing.lastMessageAt)
                          ? room.lastMessageAt : existing.lastMessageAt,
            // Merge any other relevant data
            deliveryAddress: room.deliveryAddress || existing.deliveryAddress,
            deliveryStatus: room.deliveryStatus || existing.deliveryStatus,
            estimatedDeliveryTime: room.estimatedDeliveryTime || existing.estimatedDeliveryTime
          };
          
          consolidatedMap.set(otherUserId, consolidated);
        } else {
          consolidatedMap.set(otherUserId, { ...room });
        }
      }
    });
    
    return Array.from(consolidatedMap.values());
  }

  private sortRoomsByActivity(rooms: ChatRoom[]): ChatRoom[] {
    return [...rooms].sort((a, b) => {
      // First sort by unread count
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      
      // Then by last message time
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });
  }

  private sortMessagesByTime(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }

  private shouldScrollToBottom(): boolean {
    if (!this.messagesContainer?.nativeElement) return false;
    
    const element = this.messagesContainer.nativeElement;
    const threshold = 100; // pixels from bottom
    
    return (element.scrollHeight - element.scrollTop - element.clientHeight) < threshold;
  }

  private async initializeWebSocket(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser?.token) {
      console.error('❌ No authentication token available');
      return Promise.reject('No authentication token available');
    }

    console.log('🔌 Connecting WebSocket for user:', currentUser.userId);
    this.updateState({ isConnecting: true });
    
    try {
      await this.chatService.connectWebSocket();
      console.log('✅ WebSocket connected successfully');
      this.updateState({ isConnecting: false, error: null });
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
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
      
      // Check if there's a room specified in query params
      const deliveryId = this.route.snapshot.queryParams['deliveryId'];
      if (deliveryId && rooms.length > 0) {
        const targetRoom = rooms.find(r => r.deliveryId === deliveryId);
        if (targetRoom) {
          this.selectRoom(targetRoom);
          return;
        }
      }
      
      // Default to first room if available
      if (rooms.length > 0 && !this.selectedRoom) {
        this.selectRoom(rooms[0]);
      }
    });
  }

  private handleRoomsUpdate(rooms: ChatRoom[]): void {
    // Only auto-select first room if no room is currently selected
    if (rooms.length > 0 && !this.selectedRoom) {
      const deliveryId = this.route.snapshot.queryParams['deliveryId'];
      const targetRoom = deliveryId ? 
        rooms.find(r => r.deliveryId === deliveryId) : 
        rooms[0];
      
      if (targetRoom) {
        this.selectRoom(targetRoom);
      }
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
    // Check if scrolled to top for loading more messages
    if (element.scrollTop === 0) {
      this.loadMoreMessages();
    }
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

  // ===== MESSAGE HANDLING =====

  async sendMessage(): Promise<void> {
    if (!this.canSendMessage()) return;

    // Check WebSocket connection
    if (!this.webSocketService.isConnected()) {
      try {
        await this.initializeWebSocket();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        this.updateState({ error: 'Unable to connect. Please try again.' });
        return;
      }
    }

    const messageContent = this.newMessage.trim();
    
    // Determine receiver ID based on selected room
    let receiverId = this.getOtherUserId(this.selectedRoom!);
    
    if (!receiverId) {
      this.updateState({ error: 'Cannot identify message recipient' });
      return;
    }
    
    const messageRequest: ChatMessageRequest = {
      receiverId: receiverId,
      deliveryId: this.selectedRoom!.deliveryId,
      content: messageContent,
      messageType: 'TEXT'
    };

    console.log('Sending message:', {
      senderId: this.delivery.deliveryPersonId || this.delivery.clientId,
      receiverId,
      deliveryId: this.selectedRoom!.deliveryId,
      content: messageContent.substring(0, 50) + '...'
    });

    // Clear input and update UI state
    this.newMessage = '';
    this.stopTyping();
    this.resizeTextarea();
    this.updateLastActivity();
    this.updateState({ sendingMessage: true });

    this.chatService.sendMessage(messageRequest).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log('Message sent successfully:', response);
        this.updateState({ sendingMessage: false });
        this.scrollToBottom();
      },
      error: (error) => {
        console.error('Error sending message:', error);
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

  // ===== TYPING INDICATORS =====
  
  onTyping(): void {
    this.typingSubject.next(this.newMessage);
    this.resizeTextarea();
  }

  private sendTypingIndicator(isTyping: boolean): void {
    if (!this.selectedRoom || !this.webSocketService.isConnected()) return;

    const receiverId = this.getOtherUserId(this.selectedRoom);
    
    if (receiverId) {
      this.chatService.sendTypingIndicator(
        receiverId,
        this.selectedRoom.deliveryId,
        isTyping
      );
    }
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
    
    if (this.selectedRoom && this.webSocketService.isConnected()) {
      this.sendTypingIndicator(false);
    }
  }

  // ===== INPUT HANDLING =====
  
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

  public setQuickMessage(message: string): void {
    this.ngZone.run(() => {
      this.newMessage = message;
      this.resizeTextarea();
      this.focusMessageInput();
      this.cdr.detectChanges();
    });
  }

  // ===== MESSAGE STATUS =====
  
  private markMessagesAsRead(): void {
    if (!this.selectedRoom) return;

    const currentUser = this.authService.getCurrentUser();
    const isDeliveryPerson = currentUser?.userType === 'temporary' || currentUser?.userType === 'professional';
    
    // Determine the sender ID (the other user whose messages we want to mark as read)
    const senderId = isDeliveryPerson ? 
      this.selectedRoom.clientId : 
      this.selectedRoom.deliveryPersonId;
    
    // Fallback to otherUserId if role-specific ID is missing
    const finalSenderId = senderId || this.selectedRoom.otherUserId;
    
    if (finalSenderId) {
      this.chatService.markMessagesAsRead(
        this.selectedRoom.deliveryId,
        finalSenderId
      ).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          console.log('Messages marked as read from sender:', finalSenderId);
        },
        error: (error) => {
          console.error('Error marking messages as read:', error);
        }
      });
    }
  }

  private isDeliveryPersonComponent(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.userType === 'temporary' || currentUser?.userType === 'professional';
  }

  // ===== SCROLLING =====
  
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

  public loadMoreMessages(): void {
    if (!this.selectedRoom || this.isLoadingMore || !this.hasMoreMessages) return;

    this.isLoadingMore = true;
    const nextPage = this.currentPage + 1;
    const otherUserId = this.getOtherUserId(this.selectedRoom);

    this.chatService.getMessages(
      this.selectedRoom.deliveryId, 
      otherUserId, 
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

  // ===== TEMPLATE HELPER METHODS =====
  
  trackByRoomId(index: number, room: ChatRoom): string {
    return room.deliveryId;
  }

  trackByMessageId(index: number, message: Message): string {
    return message.id || `${message.senderId}-${message.timestamp}-${index}`;
  }

  isOwnMessage(message: Message): boolean {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.userId;
    const isOwn = message.senderId === currentUserId;
    
    return isOwn;
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
    if (!this.otherUser) {
      return this.selectedRoom ? this.getRoomDisplayName(this.selectedRoom) : 'User';
    }
    
    const firstName = this.otherUser.firstName || '';
    const lastName = this.otherUser.lastName || '';
    
    return firstName && lastName 
      ? `${firstName} ${lastName}`
      : firstName || lastName || 'User';
  }

  getOtherUserFirstName(): string {
    if (!this.otherUser) {
      return this.selectedRoom ? this.getRoomDisplayName(this.selectedRoom) : 'User';
    }
    return this.otherUser.firstName || 'User';
  }

  isOtherUserLoaded(): boolean {
    return this.otherUser !== null;
  }

  // ===== CONNECTION MANAGEMENT =====
  
  retryConnection(): void {
    this.updateState({ connectionRetries: 0, error: null });
    this.initializeWebSocket();
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

  // ===== STATE MANAGEMENT =====
  
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

  // ===== CLEANUP =====
  
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
  }}