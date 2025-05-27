import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Mission } from '../models/mission.model';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MissionService {
  private apiUrl = `${environment.apiUrl}/api/missions`;
  
  constructor(private http: HttpClient, private authService: AuthService) {}
  
  createMission(deliveryId: string, deliveryPersonId: string) {
    return this.http.post<Mission>(
      `${this.apiUrl}?deliveryId=${deliveryId}&deliveryPersonId=${deliveryPersonId}`,
      {}
    );
  }
  // In your mission.service.ts
  getDeliveryPersonMissions(deliveryPersonId: string) {
    return this.http.get<any[]>(`${this.apiUrl}/delivery-person/${deliveryPersonId}`).pipe(
      map(missions => missions.map(mission => ({
        ...mission,
        startTime: this.arrayToDate(mission.startTime),
        endTime: mission.endTime ? this.arrayToDate(mission.endTime) : null
      })))
    );  // Added missing closing parenthesis and semicolon here
  }
  
  
  private arrayToDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    // Handle case when date comes as a comma-separated string like "2025,5,21,1,28,49,637000000"
    if (typeof dateValue === 'string' && dateValue.includes(',')) {
      const parts = dateValue.split(',').map(part => parseInt(part.trim(), 10));
      // Note: Months in JavaScript Date are 0-indexed (0-11), but our data might be 1-indexed
      // Adjust month if needed - subtract 1 if you confirm your backend sends months as 1-12
      return new Date(
        parts[0],         // year
        parts[1] - 1,     // month (subtract 1 to convert from 1-indexed to 0-indexed)
        parts[2],         // day
        parts[3] || 0,    // hours
        parts[4] || 0,    // minutes
        parts[5] || 0,    // seconds
        parts[6] || 0     // milliseconds
      );
    }
    
    // Handle case when date comes as an array
    if (Array.isArray(dateValue)) {
      return new Date(
        dateValue[0],                // year
        dateValue[1] - 1,            // month (subtract 1 to convert from 1-indexed to 0-indexed)
        dateValue[2],                // day
        dateValue[3] || 0,           // hours
        dateValue[4] || 0,           // minutes
        dateValue[5] || 0,           // seconds
        dateValue[6] || 0            // milliseconds
      );
    }
    
    // Try to create date from other formats
    try {
      return new Date(dateValue);
    } catch (e) {
      console.error('Failed to parse date:', dateValue);
      return null;
    }
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