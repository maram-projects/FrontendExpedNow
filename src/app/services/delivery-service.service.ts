import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// Current Angular interface (problematic)
// Updated to match Java DeliveryResponseDTO
export interface DeliveryRequest {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  packageDescription: string;  // Not packageType
  packageWeight: number;
  vehicleId?: string;
  scheduledDate: string;  // Will be in Java's format "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
  additionalInstructions?: string;
  status?: string;  // Not enum since Java sends raw string
  createdAt?: string;
  clientId?: string;
  processing?: boolean;
  // Remove latitude/longitude if not in Java DTO
}

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private apiUrl = `${environment.apiUrl}/api/deliveries`;

  constructor(private http: HttpClient, private authService: AuthService) {}


  createDeliveryRequest(delivery: Omit<DeliveryRequest, 'id'>): Observable<DeliveryRequest> {
    const formattedDelivery = {
      ...delivery,
      scheduledDate: new Date(delivery.scheduledDate).toISOString()
    };
    
    // Log the request for debugging
    console.log('Delivery request payload:', formattedDelivery);
  
    const url = `${this.apiUrl}/request${delivery.clientId ? `?clientId=${delivery.clientId}` : ''}`;
  
    return this.http.post<DeliveryRequest>(url, formattedDelivery, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(error => {
          console.error('Error creating delivery:', error);
          console.error('Request payload was:', formattedDelivery);
          console.error('Server response:', error.error); // Add this to see server error message
          return throwError(() => new Error(`Failed to create delivery request: ${error.message || error.error || 'Unknown error'}`));
        })
      );
  }

  debugDeliveryRequest(delivery: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/debug`, delivery, { headers: this.getAuthHeaders() });
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

 
   

  private handleError(error: any): Observable<never> {
    console.error('An error occurred:', error);
    if (error.status === 0) {
      return throwError(() => new Error('Unable to connect to server'));
    } else if (error.status === 500) {
      return throwError(() => new Error('Server error - check backend logs'));
    }
    return error.error?.message || 'Unknown error occurred';
  }

  acceptDelivery(deliveryId: string): Observable<DeliveryRequest> {
    const userId = this.authService.getCurrentUser()?.userId;
    return this.http.post<DeliveryRequest>(
      `${this.apiUrl}/${deliveryId}/accept?deliveryPersonId=${userId}`,
      {},  // Empty body as query parameter is used
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error accepting delivery:', error);
        return throwError(() => new Error('Failed to accept delivery'));
      })
    );
  }
  
  rejectDelivery(deliveryId: string): Observable<void> {
    const userId = this.authService.getCurrentUser()?.userId;
    return this.http.post<void>(
      `${this.apiUrl}/${deliveryId}/reject?deliveryPersonId=${userId}`,
      {},  // Empty body
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error rejecting delivery:', error);
        return throwError(() => new Error('Failed to reject delivery'));
      })
    );
  }

  // Add this to the getAuthHeaders method in DeliveryService
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    console.log('Current user ID:', this.authService.getCurrentUser()?.userId);
    console.log('Using auth token:', token ? 'Token exists' : 'No token!');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getAssignedDeliveries(): Observable<DeliveryRequest[]> {
    return this.http.get<DeliveryRequest[]>(
      `${this.apiUrl}/assigned-pending`,  // Changed to match Spring endpoint
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  getAssignedPendingDeliveries(): Observable<DeliveryRequest[]> {
    return this.http.get<DeliveryRequest[]>(
      `${this.apiUrl}/assigned-pending`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('API Response:', response)),
      catchError(error => {
        console.error('Error:', error);
        return throwError(() => error);
      })
    );
  }
}

function DeliveryResponseDTO(String: StringConstructor, id: any, String1: StringConstructor, pickupAddress: any, String2: StringConstructor, deliveryAddress: any, String3: StringConstructor, packageDescription: any, double: any, packageWeight: any, String4: StringConstructor, vehicleId: any, Date: DateConstructor, scheduledDate: any, String5: StringConstructor, additionalInstructions: any, String6: StringConstructor, status: string, Date1: DateConstructor, createdAt: any, String7: StringConstructor, clientId: any) {
  throw new Error('Function not implemented.');
}
