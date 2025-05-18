import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, Observable, of, throwError } from 'rxjs';
import { AvailabilitySchedule, DayOfWeek, TimeRange, DaySchedule } from '../models/availability.model';
import { environment } from '../../environments/environment';

// Response interfaces to match Spring controller responses
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  schedule?: T;
  data?: T;
  isNewSchedule?: boolean;
  existingSchedule?: any;
}

interface ValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface DeliveryPersonInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  available: boolean;
}

interface ScheduleStatistics {
  totalDeliveryPersons: number;
  withSchedule: number;
  withoutSchedule: number;
  scheduleCompletionRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private apiUrl = `${environment.apiUrl}/api/availability`;

  constructor(private http: HttpClient) {}

  // Basic CRUD operations
  getSchedule(userId: string): Observable<ApiResponse<AvailabilitySchedule>> {
    return this.http.get<ApiResponse<AvailabilitySchedule>>(`${this.apiUrl}/${userId}`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) {
            // Return an observable with a "not found" response
            return of({
              success: false,
              message: 'No schedule found',
              isNewSchedule: true
            });
          }
          return this.handleError(error);
        })
      );
  }

  saveSchedule(schedule: AvailabilitySchedule): Observable<ApiResponse<AvailabilitySchedule>> {
    return this.http.post<ApiResponse<AvailabilitySchedule>>(this.apiUrl, schedule)
      .pipe(catchError(this.handleError));
  }

  // Admin operations for delivery persons
  adminCreateScheduleForDeliveryPerson(
    deliveryPersonId: string, 
    schedule: AvailabilitySchedule
  ): Observable<ApiResponse<AvailabilitySchedule>> {
    return this.http.post<ApiResponse<AvailabilitySchedule>>(
      `${this.apiUrl}/admin/create-for-delivery-person/${deliveryPersonId}`, 
      schedule
    ).pipe(catchError(this.handleError));
  }

  getDeliveryPersonsWithoutSchedule(): Observable<ApiResponse<DeliveryPersonInfo[]>> {
    return this.http.get<ApiResponse<DeliveryPersonInfo[]>>(
      `${this.apiUrl}/admin/delivery-persons-without-schedule`
    ).pipe(catchError(this.handleError));
  }

  getScheduleStatistics(): Observable<ApiResponse<{ statistics: ScheduleStatistics }>> {
    return this.http.get<ApiResponse<{ statistics: ScheduleStatistics }>>(
      `${this.apiUrl}/admin/schedule-statistics`
    ).pipe(catchError(this.handleError));
  }

  // Schedule validation
  validateSchedule(schedule: AvailabilitySchedule): Observable<ValidationResponse> {
    return this.http.post<ValidationResponse>(`${this.apiUrl}/validate`, schedule)
      .pipe(catchError(this.handleError));
  }

  // Weekly schedule operations
  updateDayAvailability(
    userId: string,
    day: DayOfWeek,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    let params = new HttpParams().set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/day/${day}`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  checkDayAvailability(userId: string, day: DayOfWeek, time: string): Observable<boolean> {
    const params = new HttpParams()
      .set('day', day)
      .set('time', time);

    return this.http.get<boolean>(`${this.apiUrl}/${userId}/check/day`, { params })
      .pipe(catchError(this.handleError));
  }

  // Date-specific operations
  updateDateAvailability(
    userId: string,
    date: string,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    let params = new HttpParams().set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/date/${date}`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  updateDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/daterange`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  checkDateAvailability(userId: string, date: string, time: string): Observable<boolean> {
    const params = new HttpParams()
      .set('date', date)
      .set('time', time);

    return this.http.get<boolean>(`${this.apiUrl}/${userId}/check/date`, { params })
      .pipe(catchError(this.handleError));
  }

  checkDateTimeAvailability(userId: string, dateTime: string): Observable<boolean> {
    const params = new HttpParams().set('dateTime', dateTime);

    return this.http.get<boolean>(`${this.apiUrl}/${userId}/check/datetime`, { params })
      .pipe(catchError(this.handleError));
  }

  // Utility operations
  generateMonthlyFromWeekly(
    userId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilitySchedule> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.post<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/generate-monthly`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  setWeekdaysInRange(
    userId: string,
    startDate: string,
    endDate: string,
    daysOfWeek: DayOfWeek[],
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('isWorking', isWorking.toString());

    // Add each day of week as a separate parameter
    daysOfWeek.forEach(day => {
      params = params.append('daysOfWeek', day);
    });

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/weekdays-in-range`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  copyMonthAvailability(
    userId: string,
    sourceMonth: string,
    targetMonth: string
  ): Observable<AvailabilitySchedule> {
    const params = new HttpParams()
      .set('sourceMonth', sourceMonth)
      .set('targetMonth', targetMonth);

    return this.http.post<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/copy-month`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  clearMonthlySchedule(userId: string): Observable<AvailabilitySchedule> {
    return this.http.delete<AvailabilitySchedule>(`${this.apiUrl}/${userId}/clear-monthly`)
      .pipe(catchError(this.handleError));
  }

  // Admin-specific operations
  adminUpdateDateAvailability(
    userId: string,
    date: string,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    let params = new HttpParams().set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/admin/${userId}/date/${date}`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  adminUpdateDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/admin/${userId}/daterange`,
      null,
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Delete operations
  clearDateAvailability(userId: string, date: string): Observable<AvailabilitySchedule> {
    return this.http.delete<AvailabilitySchedule>(`${this.apiUrl}/${userId}/date/${date}`)
      .pipe(catchError(this.handleError));
  }

  adminClearDateAvailability(userId: string, date: string): Observable<AvailabilitySchedule> {
    return this.http.delete<AvailabilitySchedule>(`${this.apiUrl}/admin/${userId}/date/${date}`)
      .pipe(catchError(this.handleError));
  }

  getMonthlySchedule(
    userId: string,
    monthStart: string,
    monthEnd?: string
  ): Observable<Record<string, DaySchedule>> {
    let params = new HttpParams().set('monthStart', monthStart);

    if (monthEnd) {
      params = params.set('monthEnd', monthEnd);
    }

    return this.http.get<Record<string, DaySchedule>>(
      `${this.apiUrl}/${userId}/month`,
      { params }
    ).pipe(catchError(this.handleError));
  }

  clearDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilitySchedule> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.delete<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/daterange`,
      { params }
    ).pipe(catchError(this.handleError));
  }

  adminClearDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilitySchedule> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.delete<AvailabilitySchedule>(
      `${this.apiUrl}/admin/${userId}/daterange`,
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Delivery person availability queries
  findAvailableDeliveryPersonsOnDate(date: string, time: string): Observable<string[]> {
    const params = new HttpParams()
      .set('date', date)
      .set('time', time);

    return this.http.get<string[]>(`${this.apiUrl}/available-delivery-persons/date`, { params })
      .pipe(catchError(this.handleError));
  }

  findAvailableDeliveryPersonsOnDateTime(dateTime: string): Observable<string[]> {
    const params = new HttpParams().set('dateTime', dateTime);

    return this.http.get<string[]>(`${this.apiUrl}/available-delivery-persons/datetime`, { params })
      .pipe(catchError(this.handleError));
  }

  // Helper method for error handling
  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    
    let errorMessage = 'An error occurred';
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Convenience methods for common operations
  setUserScheduleForWeek(
    userId: string,
    weeklySchedule: Record<DayOfWeek, { isWorking: boolean; startTime?: string; endTime?: string }>
  ): Observable<AvailabilitySchedule[]> {
    const updates: Observable<AvailabilitySchedule>[] = [];
    
    Object.entries(weeklySchedule).forEach(([day, schedule]) => {
      updates.push(
        this.updateDayAvailability(
          userId,
          day as DayOfWeek,
          schedule.isWorking,
          schedule.startTime,
          schedule.endTime
        )
      );
    });

    // Note: This returns an array of observables. In your component, you might want to use forkJoin
    // to wait for all updates to complete
    return throwError(() => new Error('Use forkJoin to combine multiple updates'));
  }

  // Check if user has any schedule configured
  hasScheduleConfigured(schedule: AvailabilitySchedule): boolean {
    // Check weekly schedule
    const hasWeeklySchedule = schedule.weeklySchedule && 
      Object.values(schedule.weeklySchedule).some(day => day.working);
    
    // Check monthly schedule
    const hasMonthlySchedule = schedule.monthlySchedule && 
      Object.values(schedule.monthlySchedule).some(day => day.working);
    
    return hasWeeklySchedule || hasMonthlySchedule;
  }
}