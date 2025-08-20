import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AIMessage {
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  messageType?: string;
  metadata?: any;
}

export interface AIAssistantRequest {
  message: string;
  userId: string;
  conversationId?: string;
  messageType?: string;
  context?: any;
}

export interface AIAssistantResponse {
  success: boolean;
  message: string;
  conversationId: string;
  timestamp: string;
  messages?: AIMessage[];
  error?: string;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AIAssistantService {
  private apiUrl = `${environment.apiUrl}/api/ai-assistant`;
  
  // Current conversation state
  private currentConversationSubject = new BehaviorSubject<string | null>(null);
  public currentConversation$ = this.currentConversationSubject.asObservable();
  
  // Messages state
  private messagesSubject = new BehaviorSubject<AIMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Send a message to the AI assistant
   */
  sendMessage(message: string, conversationId?: string): Observable<AIAssistantResponse> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    this.loadingSubject.next(true);

    const request: AIAssistantRequest = {
      message,
      userId: currentUser.userId.toString(),
      conversationId: conversationId || this.currentConversationSubject.value || undefined
    };

    return this.http.post<AIAssistantResponse>(`${this.apiUrl}/chat`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          // Update current conversation
          this.currentConversationSubject.next(response.conversationId);
          
          // Add messages to the local state
          const currentMessages = this.messagesSubject.value;
          const newMessages = [
            ...currentMessages,
            {
              content: message,
              role: 'user' as const,
              timestamp: new Date().toISOString()
            },
            {
              content: response.message,
              role: 'assistant' as const,
              timestamp: response.timestamp
            }
          ];
          this.messagesSubject.next(newMessages);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error sending message to AI assistant:', error);
        return throwError(() => new Error('Failed to send message. Please try again.'));
      })
    );
  }

  /**
   * Get conversation history
   */
  getConversationHistory(conversationId: string): Observable<AIMessage[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.http.get<AIAssistantResponse>(
      `${this.apiUrl}/conversation/${conversationId}?userId=${currentUser.userId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => {
        if (response.success && response.messages) {
          this.messagesSubject.next(response.messages);
          return response.messages;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error fetching conversation history:', error);
        return throwError(() => new Error('Failed to load conversation history'));
      })
    );
  }

  /**
   * Clear current conversation
   */
  clearConversation(): Observable<void> {
    const currentUser = this.authService.getCurrentUser();
    const conversationId = this.currentConversationSubject.value;
    
    if (!currentUser?.userId || !conversationId) {
      // Just clear local state if no conversation or user
      this.clearLocalState();
      return new Observable(observer => {
        observer.next();
        observer.complete();
      });
    }

    const request: AIAssistantRequest = {
      message: '', // Not used for clear operation
      userId: currentUser.userId.toString(),
      conversationId
    };

    return this.http.post<AIAssistantResponse>(`${this.apiUrl}/clear-conversation`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        this.clearLocalState();
      }),
      map(() => void 0),
      catchError(error => {
        console.error('Error clearing conversation:', error);
        // Clear local state anyway
        this.clearLocalState();
        return throwError(() => new Error('Failed to clear conversation'));
      })
    );
  }

  /**
   * Start a new conversation
   */
  startNewConversation(): void {
    this.clearLocalState();
  }

  /**
   * Get current messages
   */
  getCurrentMessages(): AIMessage[] {
    return this.messagesSubject.value;
  }

  /**
   * Get current conversation ID
   */
  getCurrentConversationId(): string | null {
    return this.currentConversationSubject.value;
  }

  /**
   * Check if assistant is currently processing
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Clear local conversation state
   */
  private clearLocalState(): void {
    this.currentConversationSubject.next(null);
    this.messagesSubject.next([]);
    this.loadingSubject.next(false);
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Suggest quick questions based on user context
   */
  getQuickQuestions(): string[] {
    const currentUser = this.authService.getCurrentUser();
    
    if (currentUser?.userType === 'CLIENT') {
      return [
        'What is the status of my recent deliveries?',
        'How much have I spent on deliveries this month?',
        'Do I have any unpaid deliveries?',
        'How can I track my current delivery?',
        'What are your delivery pricing rates?',
        'How can I cancel a delivery?',
        'What payment methods do you accept?',
        'How long does delivery usually take?'
      ];
    } else if (currentUser?.userType === 'DELIVERY_PERSON') {
      return [
        'How many deliveries have I completed today?',
        'What are my current assigned deliveries?',
        'How can I update my availability?',
        'What is my current rating?',
        'How are delivery payments calculated?',
        'How can I report an issue with a delivery?'
      ];
    }
    
    return [
      'How does ExpedNow work?',
      'What are your service areas?',
      'How can I contact support?',
      'What are your delivery hours?'
    ];
  }
}