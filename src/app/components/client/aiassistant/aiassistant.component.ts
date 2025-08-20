import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { AIMessage, AIAssistantService } from '../../../services/aiassistant.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';


@Component({
  selector: 'app-ai-assistant',
  templateUrl: './aiassistant.component.html',
  styleUrls: ['./aiassistant.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AIAssistantComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: AIMessage[] = [];
  currentMessage = '';
  isLoading = false;
  conversationId: string | null = null;
  isMinimized = true;
  quickQuestions: string[] = [];
  showQuickQuestions = true;
  isTyping = false;
  
  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;
  private messageSubject = new Subject<string>();

  constructor(
    private aiAssistantService: AIAssistantService,
    private authService: AuthService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeAssistant();
    this.setupMessageDebouncing();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private initializeAssistant(): void {
    // Subscribe to messages
    this.aiAssistantService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages;
        this.shouldScrollToBottom = true;
        this.showQuickQuestions = messages.length === 0;
        this.cdr.detectChanges();
      });

    // Subscribe to loading state
    this.aiAssistantService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
        if (loading) {
          this.isTyping = true;
          this.shouldScrollToBottom = true;
        } else {
          this.isTyping = false;
        }
        this.cdr.detectChanges();
      });

    // Subscribe to conversation ID
    this.aiAssistantService.currentConversation$
      .pipe(takeUntil(this.destroy$))
      .subscribe(conversationId => {
        this.conversationId = conversationId;
      });

    // Get quick questions
    this.quickQuestions = this.aiAssistantService.getQuickQuestions();
  }

  private setupMessageDebouncing(): void {
    this.messageSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(message => {
        if (message.trim()) {
          this.sendMessageToAssistant(message);
        }
      });
  }

  toggleChat(): void {
    this.isMinimized = !this.isMinimized;
    if (!this.isMinimized) {
      setTimeout(() => {
        this.focusInput();
        this.scrollToBottom();
      }, 100);
    }
  }

  sendMessage(): void {
    const message = this.currentMessage.trim();
    if (!message || this.isLoading) {
      return;
    }

    this.currentMessage = '';
    this.showQuickQuestions = false;
    this.messageSubject.next(message);
  }

  private sendMessageToAssistant(message: string): void {
    this.aiAssistantService.sendMessage(message, this.conversationId || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.toastService.showError(response.error || 'Failed to send message');
          }
        },
        error: (error) => {
          console.error('Error sending message:', error);
          this.toastService.showError('Failed to send message. Please try again.');
        }
      });
  }

  sendQuickQuestion(question: string): void {
    this.currentMessage = question;
    this.sendMessage();
  }

  clearConversation(): void {
    if (this.messages.length === 0) {
      return;
    }

    this.aiAssistantService.clearConversation()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showQuickQuestions = true;
          this.toastService.showSuccess('Conversation cleared');
        },
        error: (error) => {
          console.error('Error clearing conversation:', error);
          this.toastService.showError('Failed to clear conversation');
        }
      });
  }

  startNewConversation(): void {
    this.aiAssistantService.startNewConversation();
    this.showQuickQuestions = true;
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }

  private focusInput(): void {
    try {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    } catch (error) {
      console.error('Error focusing input:', error);
    }
  }

  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return '';
    }
  }

  getUserName(): string {
    const user = this.authService.getCurrentUser();
    return user?.firstName ? `${user.firstName}` : 'You';
  }

  isUserMessage(message: AIMessage): boolean {
    return message.role === 'user';
  }

  isAssistantMessage(message: AIMessage): boolean {
    return message.role === 'assistant';
  }

  getMessageClass(message: AIMessage): string {
    const baseClass = 'message';
    return this.isUserMessage(message) 
      ? `${baseClass} user-message` 
      : `${baseClass} assistant-message`;
  }

  // Add this method for trackBy functionality
trackByMessage(index: number, message: AIMessage): string {
  return `${message.role}-${message.timestamp}-${index}`;
}

// Add this method to format message content (with basic HTML formatting)
formatMessageContent(content: string): string {
  // Simple formatting - you can enhance this as needed
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
}