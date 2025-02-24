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
    this.loadStoredUser();
  }

 

  private loadStoredUser(): void {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.currentUserSubject.next(user);
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    // Log what we're sending
    console.log('Login request payload:', { email, password });
    
    // Create a user object as expected by the backend
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/login`, 
        { email, password },
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
      )
      .pipe(
        tap((response) => {
          console.log('Login response:', response);
          if (response?.token) {
            localStorage.setItem('currentUser', JSON.stringify(response));
            this.currentUserSubject.next(response);
            this.redirectBasedOnUserType(response.userType);
          }
        }),
        catchError(this.handleError)
      );
  }
  register(user: User, userType: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register?userType=${userType}`, user)
      .pipe(
        tap((response) => {
          // Changed: Don't store user or redirect to dashboard after registration
          // Instead, just return the response and let the component handle redirection
        }),
        catchError(this.handleError)
      );
  }

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

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): AuthResponse | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getCurrentUser()?.token;
  }

  getToken(): string | null {
    return this.getCurrentUser()?.token || null;
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API Error Status:', error.status);
    console.error('Error Body:', error.error);
    
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (typeof error.error === 'object' && error.error !== null) {
        errorMessage = error.error.error || error.error.message || JSON.stringify(error.error);
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
}