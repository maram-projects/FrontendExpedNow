import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthResponse, User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) {}

  getUserDetails(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  updateProfile(user: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, user);
  }

  updateUser(userId: string, userData: any): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${userId}`, userData);
  }

  assignVehicleToUser(userId: string, vehicleId: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${userId}/assign-vehicle`, { vehicleId });
  }

  getDeliveryPersonnel(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/delivery`);
  }

  getUserById(userId: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${userId}`);
  }
}