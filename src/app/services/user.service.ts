import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, of, tap, throwError } from 'rxjs';
import { AuthResponse, User } from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8080/api/users';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

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
    
  assignVehicleToUser(userId: string, vehicleId: string): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/${userId}/assign-vehicle`, 
      { vehicleId },
      { headers: new HttpHeaders({'Content-Type': 'application/json'}) }
    ).pipe(
      tap((updatedUser: any) => {
        // Update local data if current user is updated
        const currentUser = this.authService.getCurrentUser();
        if (currentUser && currentUser.userId === userId) {
          this.authService.updateLocalUserData(updatedUser);
        }
      }),
      catchError(this.handleError)
    );
  }

  getDeliveryPersonnel(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/delivery`).pipe(
      catchError(error => {
        console.error('Error fetching delivery personnel:', error);
        return of([]);
      })
    );
  }
   
  getUserByAssignedVehicle(vehicleId: string): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/by-vehicle/${vehicleId}`).pipe(
      catchError(error => {
        console.error('Error fetching user by vehicle:', error);
        return of(null);
      })
    );
  }

  getAvailableDrivers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/available-drivers`).pipe(
      catchError(error => {
        console.error('Error fetching available drivers:', error);
        return of([]);
      })
    );
  }
        
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createUser(user: User): Observable<User> {
    return this.http.post<User>(this.apiUrl, user).pipe(
      catchError(this.handleError)
    );
  }

  updateUser(selectedUserId: string, user: User): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${user.id}`, user).pipe(
      catchError(this.handleError)
    );
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
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
  
  unassignVehicleFromUser(userId: string, vehicleId: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/${userId}/unassign-vehicle`,
      { vehicleId },
      { 
        headers: new HttpHeaders({'Content-Type': 'application/json'}),
        responseType: 'json'
      }
    ).pipe(
      catchError(error => {
        console.error('Error unassigning vehicle:', error);
        let errorMsg = 'Failed to unassign vehicle';
        if (error.error?.message) {
          errorMsg += `: ${error.error.message}`;
        }
        return throwError(() => new Error(errorMsg));
      })
    );
  }
}