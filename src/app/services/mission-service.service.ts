// src/app/services/mission.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Mission } from '../models/mission.model';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MissionService {
  private apiUrl = `${environment.apiUrl}/api/missions`;

  constructor(private http: HttpClient , private authService: AuthService) {}

  createMission(deliveryId: string, deliveryPersonId: string) {
    return this.http.post<Mission>(
      `${this.apiUrl}?deliveryId=${deliveryId}&deliveryPersonId=${deliveryPersonId}`,
      {}
    );
  }


  getDeliveryPersonMissions(deliveryPersonId: string) {
    // تحقق إضافي من الـ ID
    if (!deliveryPersonId || deliveryPersonId === 'undefined') {
      return throwError(() => new Error('Delivery person ID is required and must be valid'));
    }
  
    return this.http.get<Mission[]>(
      `${this.apiUrl}/delivery-person/${deliveryPersonId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authService.getToken()}`
        }
      }
    ).pipe(
      catchError(error => {
        console.error('API Error:', error);
        return throwError(() => error);
      })
    );
  }

  getMissionDetails(missionId: string) {
    return this.http.get<Mission>(
      `${this.apiUrl}/${missionId}`
    );
  }

  // In MissionService
  startMission(missionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${missionId}/start`, {}).pipe(
      tap(() => {
        // إعلام المستخدم بنجاح العملية
        console.log('Mission started successfully');
      }),
      catchError(error => {
        console.error('Error starting mission:', error);
        throw error;
      })
    );
  }
  
  completeMission(missionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${missionId}/complete`, {}).pipe(
      tap(() => {
        console.log('Mission completed successfully');
      }),
      catchError(error => {
        console.error('Error completing mission:', error);
        throw error;
      })
    );
  }
}