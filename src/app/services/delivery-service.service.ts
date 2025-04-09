import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, filter, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface DeliveryRequest {
  id?: string;
  pickupAddress: string;
  deliveryAddress: string;
  packageDescription: string;
  packageWeight: number;
  vehicleId: string;
  scheduledDate: string; // ISO 8601 format
  additionalInstructions?: string;
  status?: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  createdAt?: string;
  clientId?: string;
}

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private apiUrl = `${environment.apiUrl}/api/deliveries`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  createDeliveryRequest(delivery: Omit<DeliveryRequest, 'id'>): Observable<DeliveryRequest> {
    const formattedDelivery = {
      ...delivery,
      scheduledDate: new Date(delivery.scheduledDate).toISOString()
    };

    const url = `${this.apiUrl}/request${delivery.clientId ? `?clientId=${delivery.clientId}` : ''}`;

    return this.http.post<DeliveryRequest>(url, formattedDelivery, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error creating delivery:', error);
          return throwError(() => new Error('Failed to create delivery request'));
        })
      );
  }

  getClientDeliveries(clientId: string): Observable<DeliveryRequest[]> {
    return this.http.get<DeliveryRequest[]>(`${this.apiUrl}?clientId=${clientId}`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error fetching deliveries:', error);
          return throwError(() => new Error('Failed to load deliveries'));
        })
      );
  }

  getPendingDeliveries(): Observable<DeliveryRequest[]> {
    return this.http.get<DeliveryRequest[]>(`${this.apiUrl}/pending`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error fetching pending deliveries:', error);
          return throwError(() => new Error('Failed to load pending deliveries'));
        })
      );
  }

  updateDeliveryStatus(id: string, status: string): Observable<DeliveryRequest> {
    return this.http.patch<DeliveryRequest>(
      `${this.apiUrl}/${id}/status`,
      { status },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error updating delivery status:', error);
        return throwError(() => new Error('Failed to update delivery status'));
      })
    );
  }

  cancelDelivery(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error canceling delivery:', error);
          return throwError(() => new Error('Failed to cancel delivery'));
        })
      );
  }


  getAssignedDeliveries(): Observable<DeliveryRequest[]> {
    return this.http.get<DeliveryRequest[]>(
      `${environment.apiUrl}/api/deliveriesperson/my-deliveries`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  updateLocation(latitude: number, longitude: number): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/api/deliveriesperson/location`,
      { latitude, longitude },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  updateAvailability(available: boolean): Observable<any> {
    return this.http.put(
      `${environment.apiUrl}/api/deliveriesperson/availability`,
      { available },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('An error occurred:', error);
    return throwError(() => new Error(error.message || 'Server error'));
  }

}