import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Mission, MissionViewModel } from '../models/mission.model';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MissionService {
  private apiUrl = `${environment.apiUrl}/api/missions`;
  
  constructor(private http: HttpClient, private authService: AuthService) {}
  
  createMission(deliveryId: string, deliveryPersonId: string): Observable<Mission> {
    return this.http.post<Mission>(
      `${this.apiUrl}?deliveryId=${deliveryId}&deliveryPersonId=${deliveryPersonId}`,
      {}
    );
  }

  // Get delivery person missions - returns Mission[] to match interface
  getDeliveryPersonMissions(deliveryPersonId: string): Observable<Mission[]> {
    return this.http.get<Mission[]>(`${this.apiUrl}/delivery-person/${deliveryPersonId}`);
  }
  
  // Helper method to convert backend dates for display purposes
  private arrayToDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    // Handle case when date comes as a comma-separated string like "2025,5,21,1,28,49,637000000"
    if (typeof dateValue === 'string' && dateValue.includes(',')) {
      const parts = dateValue.split(',').map(part => parseInt(part.trim(), 10));
      return new Date(
        parts[0],         // year
        parts[1] - 1,     // month (subtract 1 to convert from 1-indexed to 0-indexed)
        parts[2],         // day
        parts[3] || 0,    // hours
        parts[4] || 0,    // minutes
        parts[5] || 0,    // seconds
        Math.floor((parts[6] || 0) / 1000000) // convert nanoseconds to milliseconds
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
        Math.floor((dateValue[6] || 0) / 1000000) // convert nanoseconds to milliseconds
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

  getMissionDetails(missionId: string): Observable<Mission> {
    return this.http.get<Mission>(`${this.apiUrl}/${missionId}`);
  }
  
  // Start mission
  startMission(missionId: string): Observable<Mission> {
    return this.http.post<Mission>(`${this.apiUrl}/${missionId}/start`, {}).pipe(
      tap(() => {
        console.log('Mission started successfully');
      }),
      catchError(error => {
        console.error('Error starting mission:', error);
        return throwError(() => new Error('Failed to start mission'));
      })
    );
  }
  
  completeMission(missionId: string): Observable<Mission> {
    return this.http.post<Mission>(`${this.apiUrl}/${missionId}/complete`, {}).pipe(
      tap(() => {
        console.log('Mission completed successfully');
      }),
      catchError(error => {
        console.error('Error completing mission:', error);
        return throwError(() => new Error('Failed to complete mission'));
      })
    );
  }

  /**
   * Get all missions for admin dashboard
   */
  getAllMissions(): Observable<Mission[]> {
    return this.http.get<Mission[]>(`${this.apiUrl}/active`).pipe(
      catchError(error => {
        console.error('Error fetching all missions:', error);
        return throwError(() => new Error('Failed to fetch missions'));
      })
    );
  }

  /**
   * Cancel a mission
   */
  cancelMission(missionId: string): Observable<Mission> {
    return this.http.post<Mission>(`${this.apiUrl}/${missionId}/cancel`, {}).pipe(
      tap(() => {
        console.log('Mission cancelled successfully');
      }),
      catchError(error => {
        console.error('Error cancelling mission:', error);
        return throwError(() => new Error('Failed to cancel mission'));
      })
    );
  }

  /**
   * Update mission status
   */
  updateMissionStatus(missionId: string, status: string): Observable<Mission> {
    return this.http.patch<Mission>(`${this.apiUrl}/${missionId}/status?status=${status}`, {}).pipe(
      catchError(error => {
        console.error('Error updating mission status:', error);
        return throwError(() => new Error('Failed to update mission status'));
      })
    );
  }

  /**
   * Add notes to mission
   */
  addMissionNotes(missionId: string, notes: string): Observable<Mission> {
    return this.http.patch<Mission>(`${this.apiUrl}/${missionId}/notes`, notes, {
      headers: { 'Content-Type': 'text/plain' }
    }).pipe(
      catchError(error => {
        console.error('Error adding mission notes:', error);
        return throwError(() => new Error('Failed to add mission notes'));
      })
    );
  }

  // Helper methods to convert Mission to MissionViewModel when you need parsed dates
  convertToViewModel(mission: Mission): MissionViewModel {
    return {
      ...mission,
      parsedStartTime: this.arrayToDate(mission.startTime),
      parsedEndTime: mission.endTime ? this.arrayToDate(mission.endTime) : null
    };
  }

  // Helper method to convert multiple missions to view models
  convertToViewModels(missions: Mission[]): MissionViewModel[] {
    return missions.map(mission => this.convertToViewModel(mission));
  }

  // Convenience method to get missions with parsed dates
  getDeliveryPersonMissionsWithParsedDates(deliveryPersonId: string): Observable<MissionViewModel[]> {
    return this.getDeliveryPersonMissions(deliveryPersonId).pipe(
      map(missions => this.convertToViewModels(missions))
    );
  }

  // Convenience method to get all missions with parsed dates
  getAllMissionsWithParsedDates(): Observable<MissionViewModel[]> {
    return this.getAllMissions().pipe(
      map(missions => this.convertToViewModels(missions))
    );
  }
}