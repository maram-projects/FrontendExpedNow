import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { User, AuthResponse } from '../models/user.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api/auth';
  private currentUserSubject = new BehaviorSubject<AuthResponse | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private router = inject(Router);

  constructor(private http: HttpClient) {
    this.initializeUserSession();
  }

  /**
   * Ensures a clean user session upon service initialization.
   */
  private initializeUserSession(): void {
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedUser) {
      try {
        const user: AuthResponse = JSON.parse(storedUser);
        
        // Ensure the user object is valid (e.g., token exists)
        if (user?.token) {
          this.currentUserSubject.next(user);
        } else {
          this.clearUserSession();
        }
      } catch (error) {
        this.clearUserSession();
      }
    } else {
      this.clearUserSession();
    }
  }

  /**
   * Logs in the user and stores authentication data.
   */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response) => {
        if (response?.token && response?.userId) {
          // Ensure all required fields exist
          const authData: AuthResponse = {
            token: response.token,
            userType: response.userType?.toLowerCase() || '',
            userId: response.userId?.toString() || '',
            email: response.email,
            firstName: response.firstName || '',
            lastName: response.lastName || '',
            phone: response.phone || '',
            address: response.address || ''
          };

          localStorage.setItem('currentUser', JSON.stringify(authData));
          this.currentUserSubject.next(authData);
          this.redirectBasedOnUserType(authData.userType);
        } else {
          throw new Error('Invalid login response structure');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Registers a new user.
   */
  register(user: User, userType: string): Observable<AuthResponse> {
    const payload = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: user.password,
      phone: user.phone,
      address: user.address
    };

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/register?userType=${userType}`,
      JSON.stringify(payload),
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' })
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Redirects users based on their user type.
   */
 public redirectBasedOnUserType(userType: string): void {
    switch (userType.toLowerCase()) {
      case 'individual':
      case 'enterprise':
        this.router.navigate(['/client/dashboard']);
        break;
      case 'temporary':
      case 'professional':
        this.router.navigate(['/delivery/dashboard']);
        break;
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      default:
        this.router.navigate(['/login']);
    }
  }

  /**
   * Logs out the user and clears session data.
   */
  logout(): void {
    this.clearUserSession();
    this.router.navigate(['/login']);
  }

  /**
   * Clears user session data from localStorage.
   */
  private clearUserSession(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  /**
   * Retrieves the currently logged-in user.
   */
  getCurrentUser(): AuthResponse | null {
    return this.currentUserSubject.value;
  }

  /**
   * Checks if the current user is a client.
   */
  isClient(): boolean {
    const user = this.getCurrentUser();
    return !!user && ['individual', 'enterprise'].includes(user.userType);
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.userType.toLowerCase() === 'admin';
  }
  

  /**
   * Checks if a user is logged in.
   */
  isLoggedIn(): boolean {
    return !!this.getCurrentUser()?.token;
  }

  /**
   * Retrieves the authentication token.
   */
  getToken(): string | null {
    return this.getCurrentUser()?.token || null;
  }

  /**
   * Handles API errors gracefully.
   */
  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);

    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (typeof error.error === 'object' && error.error !== null) {
        errorMessage = error.error.error || error.error.message || JSON.stringify(error.error);
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Updates user profile information.
   */
  updateProfile(user: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, user);
  }

  /**
   * Checks if a user is authenticated by validating their token.
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token; // You can add token expiration validation here if needed
  }
}
