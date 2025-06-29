// delivery-chat-component.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
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
import { WebSocketService } from '../../../../services/web-socket.service'; // Added import

interface DeliveryRequest {
  deliveryId: string;
  clientId: string;
  deliveryPersonId: string;
}

@Component({
  selector: 'app-delivery-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery-chat-component.component.html',
  styleUrls: ['./delivery-chat-component.component.css']
})
export class DeliveryChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  
  messages: Message[] = [];
  rooms: ChatRoom[] = [];
  selectedRoom: ChatRoom | null = null;
  otherUser: User | null = null;
  newMessage = '';
  isTyping = false;
  typingStatus$: Observable<Map<string, TypingIndicator>> = of(new Map());
  isOnline$: Observable<boolean> = of(false);
  private subscriptions = new Subscription();

  delivery: DeliveryRequest = {
    deliveryId: '',
    clientId: '',
    deliveryPersonId: ''
  };

  constructor(
    private chatService: ChatService,
    private userService: UserService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private webSocketService: WebSocketService // Injected WebSocketService
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (currentUser) {
      this.delivery.deliveryPersonId = currentUser.userId;
      
      // Connect to WebSocket with token
      if (currentUser.token) {
        this.webSocketService.connect(currentUser.token, currentUser.userId)
          .catch(err => console.error('WebSocket connection error', err));
      }
    }

    this.subscriptions.add(
      this.route.data.subscribe(data => {
        if (data['delivery']) {
          this.delivery = data['delivery'];
        }
        this.loadChatRooms();
      })
    );

    this.subscriptions.add(
      this.chatService.getMessagesObservable().subscribe(messages => {
        this.messages = messages;
        this.scrollToBottom();
      })
    );

    this.subscriptions.add(
      this.chatService.getChatRoomsObservable().subscribe(rooms => {
        this.rooms = rooms;
        if (rooms.length > 0 && !this.selectedRoom) {
          this.selectRoom(rooms[0]);
        }
      })
    );

    this.typingStatus$ = this.chatService.getTypingUsersObservable();
  }

  trackByRoomId(index: number, room: ChatRoom): string {
    return room.deliveryId;
  }

  trackByMessageId(index: number, message: Message): string {
    return message.id || `${index}`;
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  loadChatRooms(): void {
    this.chatService.getChatRooms().subscribe({
      next: (rooms) => {
        if (rooms.length > 0) {
          this.selectRoom(rooms[0]);
        }
      },
      error: (error) => console.error('Failed to load chat rooms', error)
    });
  }

  selectRoom(room: ChatRoom): void {
    this.selectedRoom = room;
    this.chatService.setCurrentChatRoom(room.deliveryId);
    
    if (room.clientId) {
      this.loadMessages(room.deliveryId, room.clientId);
      this.loadOtherUser(room.clientId);
      this.isOnline$ = this.chatService.isUserOnline(room.clientId);
    }
    
    this.markMessagesAsRead();
  }

  loadMessages(deliveryId: string, otherUserId: string): void {
    this.chatService.getMessages(deliveryId, otherUserId, 0, 20).subscribe({
      next: (response) => {
        // Messages handled by observable
      },
      error: (error) => {
        console.error('Error loading messages:', error);
      }
    });
  }

  loadOtherUser(userId: string): void {
    this.userService.getUserById(userId).subscribe({
      next: (user: User) => {
        this.otherUser = user;
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.otherUser = null;
      }
    });
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedRoom) return;

    const messageRequest: ChatMessageRequest = {
      receiverId: this.selectedRoom.clientId,
      deliveryId: this.selectedRoom.deliveryId,
      content: this.newMessage,
      messageType: 'TEXT'
    };

    this.chatService.sendMessage(messageRequest).subscribe({
      next: () => {
        this.newMessage = '';
        this.stopTyping();
      },
      error: (error) => {
        console.error('Error sending message:', error);
      }
    });
  }

  onTyping(): void {
    if (!this.isTyping && this.selectedRoom) {
      this.isTyping = true;
      this.sendTypingIndicator(true);
    }
  }

  stopTyping(): void {
    if (this.isTyping && this.selectedRoom) {
      this.isTyping = false;
      this.sendTypingIndicator(false);
    }
  }

  sendTypingIndicator(isTyping: boolean): void {
    if (!this.selectedRoom) return;

    this.chatService.sendTypingIndicator(
      this.selectedRoom.clientId,
      this.selectedRoom.deliveryId,
      isTyping
    );
  }

  markMessagesAsRead(): void {
    if (!this.selectedRoom) return;

    this.chatService.markMessagesAsRead(
      this.selectedRoom.deliveryId,
      this.selectedRoom.clientId
    ).subscribe({
      next: () => {
        // Success
      },
      error: (error) => {
        console.error('Error marking messages as read:', error);
      }
    });
  }

  scrollToBottom(): void {
    setTimeout(() => {
      try {
        if (this.messagesContainer?.nativeElement) {
          this.messagesContainer.nativeElement.scrollTop =
            this.messagesContainer.nativeElement.scrollHeight;
        }
      } catch (err) {
        console.error('Error scrolling to bottom:', err);
      }
    }, 100);
  }

  isUserTypingInCurrentRoom(userId: string): boolean {
    if (!this.selectedRoom) return false;
    return this.chatService.isUserTyping(userId, this.selectedRoom.deliveryId);
  }

  getTypingUsersForCurrentRoom(): TypingIndicator[] {
    if (!this.selectedRoom) return [];
    return this.chatService.getTypingUsersForRoom(this.selectedRoom.deliveryId);
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.delivery.deliveryPersonId;
  }

  formatMessageTime(timestamp: Date | undefined): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  isClientTyping(): boolean {
    if (!this.selectedRoom) return false;
    return this.isUserTypingInCurrentRoom(this.selectedRoom.clientId);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.chatService.setCurrentChatRoom(null);
  }

  getOtherUserDisplayName(): string {
  if (!this.otherUser) return 'Client';
  
  const firstName = this.otherUser.firstName || '';
  const lastName = this.otherUser.lastName || '';
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  }
  
  return 'Client';
}

getOtherUserFirstName(): string {
  return this.otherUser?.firstName || 'Client';
}

isOtherUserLoaded(): boolean {
  return this.otherUser !== null;
}
}