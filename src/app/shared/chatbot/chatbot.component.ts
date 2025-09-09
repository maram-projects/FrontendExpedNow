import { Component, OnInit, ViewChild, ElementRef, signal, computed, OnDestroy } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ChatbotService, ChatResponse } from '../../services/chatbot.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

interface ChatMessage {
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  id?: string;
  source?: 'openai' | 'fallback' | 'error' | 'validation';
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css'],
})
export class ChatbotComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Signals for state management
  private _isOpen = signal(false);
  private _messages = signal<ChatMessage[]>([]);
  private _userInput = signal('');
  private _isTyping = signal(false);
  private _isConnected = signal(false);
  private _isAuthenticated = signal(false);
  private _userType = signal<string | null>(null);
  private _connectionRetryCount = signal(0);
  private _showQuickActions = signal(false);
  private _serviceStatus = signal({
    isHealthy: true,
    quotaExceeded: false,
    usingFallback: false,
    statusMessage: 'يعمل بشكل طبيعي'
  });
  
  private longPressTimer: any = null;

  // Computed properties
  isOpen = computed(() => this._isOpen());
  messages = computed(() => this._messages());
  userInput = computed(() => this._userInput());
  isTyping = computed(() => this._isTyping());
  isConnected = computed(() => this._isConnected());
  isAuthenticated = computed(() => this._isAuthenticated());
  messageCount = computed(() => this._messages().length);
  showQuickActions = computed(() => this._showQuickActions());
  serviceStatus = computed(() => this._serviceStatus());
  
  canSend = computed(() => 
    this._userInput().trim().length > 0 && 
    !this._isTyping() && 
    this._isConnected()
  );

  private subscriptions: Subscription[] = [];
  private reconnectTimer?: any;
  private healthCheckInterval?: any;

  constructor(
    private chatbotService: ChatbotService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.checkAuthStatus();
    this.initializeChat();
    this.setupAuthListener();
    this.subscribeToServiceStatus();
    this.startHealthCheckInterval();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.clearLongPressTimer();
  }

  private subscribeToServiceStatus() {
    const statusSub = this.chatbotService.serviceStatus$.subscribe(status => {
      this._serviceStatus.set({
        isHealthy: status.isHealthy,
        quotaExceeded: status.quotaExceeded,
        usingFallback: status.usingFallback,
        statusMessage: this.chatbotService.getServiceStatusMessage()
      });
      
      this._isConnected.set(status.isHealthy);
    });
    
    this.subscriptions.push(statusSub);
  }

  private startHealthCheckInterval() {
    // Check service health every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.chatbotService.refreshServiceHealth();
    }, 300000);
  }

  // Long press handlers
  startLongPress() {
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this._showQuickActions.set(true);
    }, 800);
  }

  endLongPress() {
    this.clearLongPressTimer();
  }

  private clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // Quick action methods
executeQuickAction(action: string) {
  this._showQuickActions.set(false);
  
  const userContext = this.chatbotService.getUserContext();
  const isAdmin = userContext.isAdmin;
  const isClient = userContext.isClient;
  const userType = userContext.userType;
  
  switch(action) {
    case 'stats':
      if (isAdmin) {
        this.sendQuickMessage('Afficher les statistiques globales du système');
      } else if (isClient) {
        this.sendQuickMessage('Afficher mes statistiques de livraison');
      } else {
        this.sendQuickMessage('Quelles sont les dernières statistiques ?');
      }
      break;
      
    case 'users':
      if (isAdmin) {
        this.sendQuickMessage('Combien d\'utilisateurs sont actifs sur la plateforme ?');
      } else {
        this.sendQuickMessage('Comment gérer mon profil utilisateur ?');
      }
      break;
      
    case 'help':
      if (isAdmin) {
        this.sendQuickMessage('Comment administrer le système de livraison ?');
      } else if (isClient) {
        this.sendQuickMessage('Comment passer une commande de livraison ?');
      } else if (userType === 'temporary' || userType === 'professional') {
        this.sendQuickMessage('Comment gérer mes livraisons ?');
      } else {
        this.sendQuickMessage('Comment puis-je utiliser la plateforme ?');
      }
      break;
      
    case 'reports':
      if (isAdmin) {
        this.sendQuickMessage('Générer un rapport administratif complet');
      } else if (isClient) {
        this.sendQuickMessage('Afficher l\'historique de mes commandes');
      } else {
        this.sendQuickMessage('Afficher les rapports disponibles');
      }
      break;
  }
}


  sendQuickMessage(message: string) {
    this._userInput.set(message);
    this.sendMessage();
  }

  private setupAuthListener() {
    // Implementation if your AuthService supports auth state changes
  }

  private checkAuthStatus() {
    try {
      const userContext = this.chatbotService.getUserContext();
      this._isAuthenticated.set(userContext.isAuthenticated);
      this._userType.set(userContext.userType);
      this._isConnected.set(true);
      this._connectionRetryCount.set(0);
    } catch (error) {
      console.error('Error checking auth status:', error);
      this._isConnected.set(false);
    }
  }

 private initializeChat() {
  this._messages.set([]);
  const welcomeMessage = this._isAuthenticated() 
    ? `Bonjour ! Je suis l'assistant administratif IA. Comment puis-je vous aider aujourd'hui ?\n\n${this.getServiceStatusWelcomeMessage()}`
    : `Bonjour ! Je suis l'assistant administratif. Je peux répondre aux questions générales.\n\n${this.getServiceStatusWelcomeMessage()}`;
  
  this.addBotMessage(welcomeMessage);
}

private getServiceStatusWelcomeMessage(): string {
  const status = this._serviceStatus();
  
  if (status.quotaExceeded) {
    return '⚠️ Note : Nous fonctionnons actuellement en mode limité en raison de l\'épuisement du quota API externe. Vous recevrez des réponses de la base de connaissances locale.';
  }
  
  if (status.usingFallback) {
    return 'ℹ️ Nous fonctionnons actuellement en mode de secours pour assurer les meilleures performances.';
  }
  
  return '✅ Tous les services fonctionnent normalement.';
}

  toggleChat() {
    this._isOpen.set(!this._isOpen());
    if (this._isOpen()) {
      setTimeout(() => {
        const inputElement = document.querySelector('.message-input') as HTMLTextAreaElement;
        inputElement?.focus();
      }, 100);
      this.checkAuthStatus();
      this.chatbotService.refreshServiceHealth();
    }
  }

  clearChat() {
    this._messages.set([]);
    this.initializeChat();
  }

  sendMessage() {
    const message = this._userInput().trim();
    if (!message || this._isTyping()) return;

    this.addUserMessage(message);
    this._userInput.set('');
    this._isTyping.set(true);

    const chatRequest = this._isAuthenticated() 
      ? this.chatbotService.sendMessage(message)
      : this.chatbotService.sendPublicMessage(message);

    const subscription = chatRequest.subscribe({
      next: (response: ChatResponse) => {
        this.addBotMessage(response.reply, response.source);
        this._isTyping.set(false);
        this._connectionRetryCount.set(0);
        
        // Update service status indicator if needed
        if (response.source === 'fallback' && !this._serviceStatus().usingFallback) {
          this.showFallbackNotification();
        }
      },
      error: (error) => {
        this.handleChatError(error);
        this._isTyping.set(false);
      }
    });

    this.subscriptions.push(subscription);
  }

private showFallbackNotification() {
  this.addBotMessage(
    '⚠️ Basculement vers le mode de secours. Vous recevrez des réponses de la base de connaissances locale.',
    'fallback'
  );
}


  onKeyPress(event: KeyboardEvent) {
    const target = event.target as HTMLTextAreaElement;
    
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    } else {
      this._userInput.set(target.value);
      this.autoResizeTextarea(target);
    }
  }

  onInputChange(value: string) {
    this._userInput.set(value);
  }

  private autoResizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

private handleChatError(error: any) {
  let errorMessage = 'Désolé, une erreur de connexion s\'est produite.';
  let shouldRetry = false;
  
  if (error.message) {
    if (error.message.includes('not authenticated')) {
      errorMessage = 'Veuillez vous connecter pour utiliser l\'assistant IA.';
      this.showLoginPrompt();
    } else if (error.message.includes('expired')) {
      errorMessage = 'Session expirée. Veuillez vous reconnecter.';
      this.showLoginPrompt();
    } else if (error.message.includes('Access denied')) {
      errorMessage = 'Vous n\'avez pas l\'autorisation d\'utiliser ce service.';
    } else if (error.message.includes('Too many requests')) {
      errorMessage = 'Limite de requêtes dépassée. Veuillez réessayer dans un moment.';
    } else if (error.message.includes('temporarily unavailable')) {
      errorMessage = 'Service temporairement indisponible. Veuillez réessayer.';
      shouldRetry = true;
    } else if (error.status === 0 || error.status >= 500) {
      errorMessage = 'Problème de connexion réseau. Nouvelle tentative en cours...';
      shouldRetry = true;
    } else {
      errorMessage = 'Désolé, une erreur s\'est produite. Veuillez réessayer.';
    }
  }
  
  this.addBotMessage(errorMessage, 'error');
  this._isConnected.set(!shouldRetry);
  
  if (shouldRetry && this._connectionRetryCount() < 3) {
    this._connectionRetryCount.update(count => count + 1);
    this.reconnectTimer = setTimeout(() => {
      this.checkAuthStatus();
      this.chatbotService.refreshServiceHealth();
    }, 3000 * this._connectionRetryCount());
  }
}

private showLoginPrompt() {
  this.checkAuthStatus();
  setTimeout(() => {
    this.addBotMessage('Vous pouvez continuer à utiliser la version publique de l\'assistant IA, ou vous connecter pour obtenir une aide plus personnalisée et des fonctionnalités avancées.');
    
    // Add quick login suggestions based on user type
    const suggestions = this._isAuthenticated() 
      ? 'Vous êtes connecté ! Vous avez accès à toutes les fonctionnalités.'
      : 'Connectez-vous pour accéder aux rapports personnalisés, statistiques détaillées et gestion avancée.';
    
    this.addBotMessage(suggestions);
  }, 1000);
}

  private addUserMessage(text: string) {
    const newMessage: ChatMessage = {
      id: this.generateMessageId(),
      text,
      sender: 'user',
      timestamp: new Date()
    };
    this._messages.update(messages => [...messages, newMessage]);
    this.scrollToBottom();
  }

  private addBotMessage(text: string, source?: 'openai' | 'fallback' | 'error' | 'validation') {
    const newMessage: ChatMessage = {
      id: this.generateMessageId(),
      text,
      sender: 'bot',
      timestamp: new Date(),
      source
    };
    this._messages.update(messages => [...messages, newMessage]);
    this.scrollToBottom();
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  // Template helper methods
  trackByMessage(index: number, message: ChatMessage): string {
    return message.id || `${message.timestamp.getTime()}-${message.sender}`;
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  formatMessage(text: string): string {
    return text.replace(/\n/g, '<br>');
  }

getConnectionStatusText(): string {
  const status = this._serviceStatus();
  const userContext = this.chatbotService.getUserContext();
  
  if (this._isConnected()) {
    if (status.quotaExceeded) {
      return this._isAuthenticated() ? 'Connecté - Mode limité' : 'Connecté - Mode public limité';
    }
    if (status.usingFallback) {
      return this._isAuthenticated() ? 'Connecté - Mode alternatif' : 'Connecté - Mode public';
    }
    
    // Enhanced status based on user type
    if (this._isAuthenticated()) {
      if (userContext.isAdmin) {
        return 'Connecté - Administrateur';
      } else if (userContext.isClient) {
        return 'Connecté - Client';
      } else if (userContext.userType === 'temporary') {
        return 'Connecté - Livreur temporaire';
      } else if (userContext.userType === 'professional') {
        return 'Connecté - Livreur professionnel';
      } else {
        return 'Connecté - Authentifié';
      }
    }
    
    return 'Connecté - Mode public';
  }
  return this._connectionRetryCount() > 0 ? 'Nouvelle tentative...' : 'Déconnecté';
}
  getServiceStatusIndicator(): string {
    const status = this._serviceStatus();
    
    if (!status.isHealthy) return '🔴';
    if (status.quotaExceeded) return '🟡';
    if (status.usingFallback) return '🟠';
    return '🟢';
  }

getDisabledReason(): string {
  if (this._isTyping()) return 'Envoi de message en cours...';
  if (!this._isConnected()) return 'Pas de connexion réseau';
  if (this._userInput().trim().length === 0) return 'Écrivez d\'abord un message';
  return 'Impossible d\'envoyer';
}

  shouldShowRetryButton(): boolean {
    return !this._isConnected() && this._connectionRetryCount() >= 3;
  }

  retryConnection() {
    this._connectionRetryCount.set(0);
    this.checkAuthStatus();
    this.chatbotService.refreshServiceHealth();
    this.addBotMessage('جارٍ إعادة الاتصال...');
  }

  // Show service status details
showServiceDetails() {
  const status = this._serviceStatus();
  let details = `État du service : ${status.statusMessage}\n\n`;
  
  if (status.quotaExceeded) {
    details += '• Quota API externe épuisé\n';
    details += '• Fonctionnement avec la base de connaissances locale\n';
    details += '• Le service redeviendra normal bientôt\n';
  } else if (status.usingFallback) {
    details += '• Fonctionnement en mode de secours\n';
    details += '• Pour assurer les meilleures performances et vitesse\n';
  } else {
    details += '• Tous les services sont disponibles\n';
    details += '• Fonctionne normalement\n';
  }
  
  this.addBotMessage(details);
}

  // Getter and setter for template binding
  get userInputValue(): string {
    return this._userInput();
  }

  set userInputValue(value: string) {
    this._userInput.set(value);
  }

  // Helper method to get message style class
  getMessageStyleClass(message: ChatMessage): string {
    let baseClass = `message ${message.sender}`;
    
    if (message.source === 'fallback') {
      baseClass += ' fallback-response';
    } else if (message.source === 'error') {
      baseClass += ' error-response';
    }
    
    return baseClass;
  }
}