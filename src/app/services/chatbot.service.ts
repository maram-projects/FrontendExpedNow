// chatbot.service.ts - Fixed version
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of, timer } from 'rxjs';
import { map, catchError, timeout, retry, shareReplay } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

// Interfaces
export interface ChatResponse {
  reply: string;
  source?: 'openai' | 'fallback' | 'error' | 'validation';
  userRole?: string;
  timestamp?: Date;
}

export interface ChatbotHealth {
  status: string;
  quotaExceeded: boolean;
  requestsThisHour: number;
  maxRequestsPerHour: number;
  fallbackEnabled: boolean;
  quotaResetTime: string;
}

export interface ServiceStatus {
  isHealthy: boolean;
  quotaExceeded: boolean;
  usingFallback: boolean;
  lastChecked: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  // FIXED: Use environment configuration for API base URL
  private readonly API_BASE = `${environment.apiUrl}/api/ai`; // This will use http://localhost:8080/api/ai
  
  private readonly TIMEOUT_DURATION = 30000;
  
  // Service status management
  private serviceStatusSubject = new BehaviorSubject<ServiceStatus>({
    isHealthy: true,
    quotaExceeded: false,
    usingFallback: false,
    lastChecked: new Date()
  });
  
  public serviceStatus$ = this.serviceStatusSubject.asObservable();
  
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeService();
  }

  private initializeService(): void {
    // Check service health on initialization with delay
    setTimeout(() => {
      this.refreshServiceHealth();
    }, 1000);
  }

  /**
   * Send authenticated message
   */
  sendMessage(message: string): Observable<ChatResponse> {
    const url = `${this.API_BASE}/chat`;
    const body = { message: message.trim() };
    
    console.log('Sending authenticated message to:', url);
    
    const headers = this.getHttpHeaders(true);

    return this.http.post<any>(url, body, {
      headers,
      responseType: 'json'
    }).pipe(
      timeout(this.TIMEOUT_DURATION),
      map(response => this.processResponse(response)),
      catchError(error => this.handleError(error)),
      shareReplay(1)
    );
  }

  /**
   * Send public message (no authentication required)
   */
  sendPublicMessage(message: string): Observable<ChatResponse> {
    const url = `${this.API_BASE}/chat/public`;
    const body = { message: message.trim() };
    
    console.log('Sending public message to:', url);
    
    const headers = this.getHttpHeaders(false);

    return this.http.post<any>(url, body, {
      headers,
      responseType: 'json'
    }).pipe(
      timeout(this.TIMEOUT_DURATION),
      map(response => this.processResponse(response)),
      catchError(error => this.handleError(error)),
      shareReplay(1)
    );
  }

  /**
   * Get service health status with better error handling
   */
  getServiceHealth(): Observable<ChatbotHealth> {
    const url = `${this.API_BASE}/health`;
    console.log('Checking service health at:', url);
    
    return this.http.get<ChatbotHealth>(url).pipe(
      timeout(10000), // Shorter timeout for health check
      catchError(error => {
        console.error('Health check failed:', error);
        return of({
          status: 'error',
          quotaExceeded: false,
          requestsThisHour: 0,
          maxRequestsPerHour: 100,
          fallbackEnabled: true,
          quotaResetTime: new Date().toISOString()
        });
      })
    );
  }

  /**
   * Better HTTP headers management
   */
  private getHttpHeaders(authenticated: boolean = false): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    if (authenticated && this.authService.isAuthenticated()) {
      try {
        const authHeaders = this.authService.getAuthHeaders();
        // Merge auth headers with base headers
        authHeaders.keys().forEach(key => {
          const values = authHeaders.getAll(key);
          if (values && values.length > 0) {
            headers = headers.set(key, values[0]);
          }
        });
      } catch (error) {
        console.warn('Failed to get auth headers:', error);
      }
    }

    return headers;
  }

  /**
   * Validate health response structure
   */
  private isValidHealthResponse(response: any): boolean {
    return response && 
           typeof response === 'object' && 
           (response.hasOwnProperty('status') || 
            response.hasOwnProperty('quotaExceeded') || 
            response.hasOwnProperty('fallbackEnabled'));
  }

  /**
   * Better error status determination
   */
  private getErrorStatus(error: any): string {
    if (error.status === 404) return 'endpoint_not_found';
    if (error.status === 401) return 'unauthorized';
    if (error.status === 403) return 'forbidden';
    if (error.status === 429) return 'rate_limited';
    if (error.status >= 500) return 'server_error';
    if (error.status === 0) return 'network_error';
    return 'error';
  }

  /**
   * Refresh service health status
   */
  refreshServiceHealth(): void {
    this.getServiceHealth().subscribe({
      next: (health) => {
        console.log('Service health updated:', health);
        this.updateServiceStatus(health);
      },
      error: (error) => {
        console.error('Failed to refresh service health:', error);
        this.serviceStatusSubject.next({
          isHealthy: false,
          quotaExceeded: false,
          usingFallback: true,
          lastChecked: new Date()
        });
      }
    });
  }

  /**
   * Get user context for chat
   */
  getUserContext() {
    try {
      const user = this.authService.getCurrentUser();
      const isAuthenticated = this.authService.isAuthenticated();
      
      return {
        isAuthenticated: isAuthenticated,
        userType: user?.userType || 'guest',
        userId: user?.userId || null,
        email: user?.email || null,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        isAdmin: this.authService.isAdmin(),
        isClient: this.authService.isClient()
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return {
        isAuthenticated: false,
        userType: 'guest',
        userId: null,
        email: null,
        firstName: null,
        lastName: null,
        isAdmin: false,
        isClient: false
      };
    }
  }

  /**
   * Get service status message in French
   */
  getServiceStatusMessage(): string {
    const status = this.serviceStatusSubject.value;
    
    if (!status.isHealthy) {
      return 'Service temporairement indisponible';
    }
    
    if (status.quotaExceeded) {
      return 'Quota dépassé - Mode limité';
    }
    
    if (status.usingFallback) {
      return 'Mode de secours actif';
    }
    
    return 'Fonctionne normalement';
  }

  /**
   * Process API response
   */
  private processResponse(response: any): ChatResponse {
    console.log('Processing server response:', response);
    
    if (typeof response === 'string') {
      return {
        reply: response,
        source: 'fallback',
        timestamp: new Date()
      };
    }
    
    if (response && typeof response === 'object') {
      return {
        reply: response.reply || response.message || 'Réponse reçue',
        source: response.source || 'openai',
        userRole: response.userRole,
        timestamp: new Date()
      };
    }
    
    return {
      reply: 'Désolé, une erreur inattendue s\'est produite.',
      source: 'error',
      timestamp: new Date()
    };
  }

  /**
   * Handle HTTP errors with better error categorization
   */
  private handleError(error: HttpErrorResponse): Observable<ChatResponse> {
    console.error('Chat service error:', error);
    
    let errorMessage = 'Désolé, une erreur de service s\'est produite.';
    let source: 'error' | 'fallback' = 'error';
    
    if (error.status === 0) {
      errorMessage = 'Problème de connexion réseau. Vérifiez votre internet.';
    } else if (error.status === 401) {
      errorMessage = 'Session expirée. Veuillez vous reconnecter.';
    } else if (error.status === 403) {
      errorMessage = 'Accès non autorisé. Permissions insuffisantes.';
    } else if (error.status === 404) {
      errorMessage = 'Service d\'IA temporairement indisponible. Le serveur backend pourrait être arrêté.';
      source = 'fallback';
    } else if (error.status === 429) {
      errorMessage = 'Limite de requêtes atteinte. Veuillez patienter.';
      source = 'fallback';
    } else if (error.status >= 500) {
      errorMessage = 'Erreur serveur. L\'équipe technique a été notifiée.';
      source = 'fallback';
    } else if (error.error?.reply) {
      errorMessage = error.error.reply;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    this.updateServiceStatusOnError(error);
    
    return of({
      reply: errorMessage,
      source: source,
      timestamp: new Date()
    });
  }

  /**
   * Update service status based on health response
   */
  private updateServiceStatus(health: ChatbotHealth): void {
    const newStatus: ServiceStatus = {
      isHealthy: health.status === 'active' || health.status === 'healthy',
      quotaExceeded: health.quotaExceeded,
      usingFallback: health.fallbackEnabled || health.quotaExceeded,
      lastChecked: new Date()
    };
    
    this.serviceStatusSubject.next(newStatus);
  }

  /**
   * Update service status on error
   */
  private updateServiceStatusOnError(error: HttpErrorResponse): void {
    const currentStatus = this.serviceStatusSubject.value;
    
    const newStatus: ServiceStatus = {
      isHealthy: error.status !== 0 && error.status !== 404 && error.status < 500,
      quotaExceeded: error.status === 429 || currentStatus.quotaExceeded,
      usingFallback: true,
      lastChecked: new Date()
    };
    
    this.serviceStatusSubject.next(newStatus);
  }

  // Getters for service status
  get isServiceHealthy(): boolean {
    return this.serviceStatusSubject.value.isHealthy;
  }

  get isQuotaExceeded(): boolean {
    return this.serviceStatusSubject.value.quotaExceeded;
  }

  get isUsingFallback(): boolean {
    return this.serviceStatusSubject.value.usingFallback;
  }
}