import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, forkJoin, Observable, throwError } from 'rxjs';
import { AvailabilitySchedule, DayOfWeek, DaySchedule } from '../models/availability.model';
import { environment } from '../../environments/environment';

// Fixed response interfaces to match actual backend responses
interface BaseApiResponse {
  success: boolean;
  message?: string;
}

interface ScheduleResponse extends BaseApiResponse {
  schedule?: AvailabilitySchedule;
  data?: AvailabilitySchedule;
  isNewSchedule?: boolean;
}

interface DeliveryPersonsResponse extends BaseApiResponse {
  deliveryPersonsWithoutSchedule: any[];
  total: number;
}

interface StatisticsResponse extends BaseApiResponse {
  statistics: {
    totalDeliveryPersons: number;
    withSchedule: number;
    withoutSchedule: number;
    scheduleCompletionRate: number;
  };
}

interface ValidationResponse extends BaseApiResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private apiUrl = `${environment.apiUrl}/api/availability`;

  constructor(private http: HttpClient) {}

  // Get schedule for a user
  getSchedule(userId: string): Observable<ScheduleResponse> {
    return this.http.get<ScheduleResponse>(`${this.apiUrl}/${userId}`)
      .pipe(catchError(this.handleError));
  }

  // Save schedule
  saveSchedule(schedule: AvailabilitySchedule): Observable<ScheduleResponse> {
    return this.http.post<ScheduleResponse>(this.apiUrl, schedule)
      .pipe(catchError(this.handleError));
  }

  // Admin create schedule for delivery person
  adminCreateScheduleForDeliveryPerson(
    deliveryPersonId: string, 
    schedule: AvailabilitySchedule
  ): Observable<ScheduleResponse> {
    return this.http.post<ScheduleResponse>(
      `${this.apiUrl}/admin/create-for-delivery-person/${deliveryPersonId}`, 
      schedule
    ).pipe(catchError(this.handleError));
  }

  // Get delivery persons without schedule
  getDeliveryPersonsWithoutSchedule(): Observable<DeliveryPersonsResponse> {
    return this.http.get<DeliveryPersonsResponse>(
      `${this.apiUrl}/admin/delivery-persons-without-schedule`
    ).pipe(catchError(this.handleError));
  }

  // Get schedule statistics
  getScheduleStatistics(): Observable<StatisticsResponse> {
    return this.http.get<StatisticsResponse>(
      `${this.apiUrl}/admin/schedule-statistics`
    ).pipe(catchError(this.handleError));
  }

  // Validate schedule
  validateSchedule(schedule: AvailabilitySchedule): Observable<ValidationResponse> {
    return this.http.post<ValidationResponse>(`${this.apiUrl}/validate`, schedule)
      .pipe(catchError(this.handleError));
  }

  // Update day availability
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
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Check day availability
  checkDayAvailability(userId: string, day: DayOfWeek, time: string): Observable<boolean> {
    const params = new HttpParams()
      .set('day', day)
      .set('time', time);

    return this.http.get<boolean>(`${this.apiUrl}/${userId}/check/day`, { params })
      .pipe(catchError(this.handleError));
  }

  // Update date availability
  updateDateAvailability(
    userId: string,
    date: string,  // ISO date string (YYYY-MM-DD)
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(date)) {
      return throwError(() => new Error('Invalid date format'));
    }

    let params = new HttpParams().set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/date/${date}`,
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Update date range availability
  updateDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      return throwError(() => new Error('Invalid date format'));
    }

    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/daterange`,
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Check date availability
  checkDateAvailability(userId: string, date: string, time: string): Observable<boolean> {
    if (!this.isValidDate(date) || !this.isValidTime(time)) {
      return throwError(() => new Error('Invalid date or time format'));
    }
    
    const params = new HttpParams()
      .set('date', date)
      .set('time', time);

    return this.http.get<boolean>(`${this.apiUrl}/${userId}/check/date`, { params })
      .pipe(catchError(this.handleError));
  }

  // Check datetime availability
  checkDateTimeAvailability(userId: string, dateTime: string): Observable<boolean> {
    if (!this.isValidDateTime(dateTime)) {
      return throwError(() => new Error('Invalid datetime format'));
    }
    
    const params = new HttpParams().set('dateTime', dateTime);

    return this.http.get<boolean>(`${this.apiUrl}/${userId}/check/datetime`, { params })
      .pipe(catchError(this.handleError));
  }

  // Generate monthly from weekly
  generateMonthlyFromWeekly(
    userId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      return throwError(() => new Error('Invalid date format'));
    }

    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.post<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/generate-monthly`,
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Set weekdays in range
  setWeekdaysInRange(
    userId: string,
    startDate: string,
    endDate: string,
    daysOfWeek: DayOfWeek[],
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      return throwError(() => new Error('Invalid date format'));
    }

    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('isWorking', isWorking.toString());

    daysOfWeek.forEach(day => {
      params = params.append('daysOfWeek', day);
    });

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/weekdays-in-range`,
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Copy month availability
  copyMonthAvailability(
    userId: string,
    sourceMonth: string,  // YYYY-MM-DD
    targetMonth: string   // YYYY-MM-DD
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(sourceMonth) || !this.isValidDate(targetMonth)) {
      return throwError(() => new Error('Invalid date format'));
    }

    const params = new HttpParams()
      .set('sourceMonth', sourceMonth)
      .set('targetMonth', targetMonth);

    return this.http.post<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/copy-month`,
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Clear monthly schedule
  clearMonthlySchedule(userId: string): Observable<AvailabilitySchedule> {
    return this.http.delete<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/clear-monthly`
    ).pipe(catchError(this.handleError));
  }

  // Admin update date availability
  adminUpdateDateAvailability(
    userId: string,
    date: string,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(date)) {
      return throwError(() => new Error('Invalid date format'));
    }

    let params = new HttpParams().set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/admin/${userId}/date/${date}`,
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Admin update date range availability
  adminUpdateDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string,
    isWorking: boolean,
    startTime?: string,
    endTime?: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      return throwError(() => new Error('Invalid date format'));
    }

    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('isWorking', isWorking.toString());

    if (isWorking && startTime && endTime) {
      params = params.set('startTime', startTime).set('endTime', endTime);
    }

    return this.http.put<AvailabilitySchedule>(
      `${this.apiUrl}/admin/${userId}/daterange`,
      {},
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Clear date availability
  clearDateAvailability(userId: string, date: string): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(date)) {
      return throwError(() => new Error('Invalid date format'));
    }

    return this.http.delete<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/date/${date}`
    ).pipe(catchError(this.handleError));
  }

  // Admin clear date availability
  adminClearDateAvailability(userId: string, date: string): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(date)) {
      return throwError(() => new Error('Invalid date format'));
    }

    return this.http.delete<AvailabilitySchedule>(
      `${this.apiUrl}/admin/${userId}/date/${date}`
    ).pipe(catchError(this.handleError));
  }

  // Get monthly schedule
  getMonthlySchedule(
    userId: string,
    monthStart: string,
    monthEnd?: string
  ): Observable<Record<string, DaySchedule>> {
    if (!this.isValidDate(monthStart)) {
      return throwError(() => new Error('Invalid date format'));
    }

    let params = new HttpParams().set('monthStart', monthStart);

    if (monthEnd) {
      if (!this.isValidDate(monthEnd)) {
        return throwError(() => new Error('Invalid end date format'));
      }
      params = params.set('monthEnd', monthEnd);
    }

    return this.http.get<Record<string, DaySchedule>>(
      `${this.apiUrl}/${userId}/month`,
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Clear date range availability
  clearDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      return throwError(() => new Error('Invalid date format'));
    }

    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.delete<AvailabilitySchedule>(
      `${this.apiUrl}/${userId}/daterange`,
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Admin clear date range availability
  adminClearDateRangeAvailability(
    userId: string,
    startDate: string,
    endDate: string
  ): Observable<AvailabilitySchedule> {
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      return throwError(() => new Error('Invalid date format'));
    }

    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.delete<AvailabilitySchedule>(
      `${this.apiUrl}/admin/${userId}/daterange`,
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Find available delivery persons on date
  findAvailableDeliveryPersonsOnDate(date: string, time: string): Observable<string[]> {
    if (!this.isValidDate(date) || !this.isValidTime(time)) {
      return throwError(() => new Error('Invalid date or time format'));
    }
    
    const params = new HttpParams()
      .set('date', date)
      .set('time', time);

    return this.http.get<string[]>(
      `${this.apiUrl}/available-delivery-persons/date`, 
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Find available delivery persons on datetime
  findAvailableDeliveryPersonsOnDateTime(dateTime: string): Observable<string[]> {
    if (!this.isValidDateTime(dateTime)) {
      return throwError(() => new Error('Invalid datetime format'));
    }
    
    const params = new HttpParams().set('dateTime', dateTime);

    return this.http.get<string[]>(
      `${this.apiUrl}/available-delivery-persons/datetime`, 
      { params }
    ).pipe(catchError(this.handleError));
  }

  // Set user schedule for week
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

    return forkJoin(updates);
  }

  // Error handling
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.statusText) {
        errorMessage = `${error.status}: ${error.statusText}`;
      }
    }
    
    console.error('API Error:', error);
    return throwError(() => new Error(errorMessage));
  }

  // Utility functions for validation
  private isValidDate(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
  }

  private isValidTime(time: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  }

  private isValidDateTime(dateTime: string): boolean {
    return !isNaN(Date.parse(dateTime));
  }
}