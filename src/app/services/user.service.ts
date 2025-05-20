import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { User, USER_STATUS, USER_TYPES } from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8080/api/users'; // Changed to match your UserController

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // User management methods
  getPendingUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/pending-approvals`).pipe(
      catchError(this.handleError)
    );
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}`).pipe(
      catchError(this.handleError)
    );
  }

  approveUser(userId: string): Observable<User> {
    return this.http.post<User>(
      `${this.apiUrl}/approve-user/${userId}`, 
      {} // empty body
    ).pipe(
      catchError(this.handleError)
    );
  }
  rejectUser(userId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reject-user/${userId}`, {}).pipe(
      catchError(this.handleError)
    );
  }

  enableUser(userId: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${userId}/enable`, {}).pipe(
      catchError(this.handleError)
    );
  }

  disableUser(userId: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${userId}/disable`, {}).pipe(
      catchError(this.handleError)
    );
  }

  updateUser(userId: string, userData: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${userId}`, userData).pipe(
      catchError(this.handleError)
    );
  }

  getUserDetails(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      catchError(this.handleError)
    );
  }
  
  updateProfile(user: User): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profile`, user).pipe(
      catchError(this.handleError)
    );
  }
  
  assignVehicleToUser(userId: string, vehicleId: string): Observable<User> {
    return this.http.patch<User>(
      `${this.apiUrl}/${userId}/assign-vehicle`, 
      { vehicleId }
    ).pipe(
      catchError(this.handleError)
    );
  }

 
  getDeliveryPersonnel(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/delivery-personnel`).pipe(
      catchError(this.handleError)
    );
  }

  getAvailableDrivers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/available-drivers`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client-side error: ${error.error.message}`;
    } else {
      errorMessage = `Server-side error: ${error.status} - ${error.message}`;
      if (error.error?.message) {
        errorMessage += `\nDetails: ${error.error.message}`;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}