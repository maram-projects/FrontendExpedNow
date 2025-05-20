// admin-service.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { DashboardStats } from '../models/dashboard.model';
import { User } from '../models/user.model';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = 'http://localhost:8080/api/admin';
  
  constructor(
    private http: HttpClient,
    private router: Router ,  private authService: AuthService
  ) {}
  
  getDashboardStats(): Observable<any> {
    const token = this.authService.getToken(); // جيب التوكن من AuthService
    if (!token) {
      console.error('ما فماش توكن متاح!');
      return throwError(() => new Error('المستخدم موش متصل'));
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`, // ضيف التوكن في الـ Headers
      'Content-Type': 'application/json',
    });

    return this.http.get<any>(`${this.apiUrl}/dashboard-stats`, { headers }).pipe(
      catchError((error) => {
        console.error('غلط في جلب البيانات:', error);
        return throwError(() => new Error(error.message));
      })
    );
  }

  getPendingApprovals(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pending-approvals`);
  }

  approveUser(userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/approve-user/${userId}`, {});
  }

  rejectUser(userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reject-user/${userId}`, {});
  }
  
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`).pipe(
      map((users: any[]) => users.map(user => ({
        ...user,
        assignedVehicle: user.assignedVehicle ? {
          ...user.assignedVehicle,
          vehicleType: user.assignedVehicle.vehicleType?.toLowerCase()
        } : null
      }))
    ));
  }
  
  createVehicle(vehicle: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/vehicles`, vehicle).pipe(
      catchError((error) => {
        console.error('Error creating vehicle:', error);
        return throwError(() => error);
      })
    );
  }
  
  updateUserStatus(userId: string, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/status`, { status }).pipe(
      catchError((error) => {
        console.error('Error updating user status:', error);
        return throwError(() => error);
      })
    );
  }

  
}