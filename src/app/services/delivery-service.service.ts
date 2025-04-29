import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Mission } from '../models/mission.model';

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

  constructor(
    private http: HttpClient,
    public authService: AuthService // Changed to public for component access
  ) {}

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

  getAllDeliveries(): Observable<DeliveryRequest[]> {
    console.log('Fetching all deliveries for debugging');
    return this.http.get<DeliveryRequest[]>(
      `${this.apiUrl}/all`, // Make sure this endpoint exists on your backend
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(deliveries => console.log('All deliveries:', deliveries)),
      catchError(error => {
        console.error('Error fetching all deliveries:', error);
        return throwError(() => new Error('Failed to fetch all deliveries'));
      })
    );
  }

  getPendingDeliveriesUnassigned(): Observable<DeliveryRequest[]> {
    console.log('Fetching unassigned pending deliveries');
    return this.http.get<DeliveryRequest[]>(
      `${this.apiUrl}/pending-unassigned`, // Make sure this endpoint exists
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(deliveries => console.log('Unassigned pending deliveries:', deliveries)),
      catchError(error => {
        console.error('Error fetching unassigned deliveries:', error);
        return throwError(() => new Error('Failed to fetch unassigned deliveries'));
      })
    );
  }

  checkDeliveryPersonStatus(): Observable<any> {
    const userId = this.authService.getCurrentUser()?.userId;
    console.log('Checking delivery person status for user:', userId);
    
    return this.http.get<any>(
      `${environment.apiUrl}/api/deliveriesperson/${userId}/status`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(status => console.log('Delivery person status:', status)),
      catchError(error => {
        console.error('Error checking delivery person status:', error);
        return throwError(() => new Error('Failed to check delivery person status'));
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
    return throwError(() => new Error(error.error?.message || 'Unknown error occurred'));
  }

  acceptDelivery(deliveryId: string): Observable<{ delivery: DeliveryRequest, mission: Mission }> {
    const userId = this.authService.getCurrentUser()?.userId;
    
    if (!userId) {
        return throwError(() => new Error('User ID is missing!'));
    }

    // Make sure data is sent as JSON
    const body = { deliveryPersonId: userId };
    console.log('Request body:', body);

    return this.http.post<{ delivery: DeliveryRequest, mission: Mission }>(
        `${this.apiUrl}/${deliveryId}/accept`,
        body,
        { 
            headers: this.getAuthHeaders(),
            withCredentials: true // If using cookies
        }
    ).pipe(
        catchError(error => {
            console.error('Error accepting delivery:', error);
            return throwError(() => new Error('Failed to accept delivery: ' + 
                (error.error?.message || error.message)));
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
    const userId = this.authService.getCurrentUser()?.userId;
    console.log('Fetching assigned pending deliveries for user:', userId);
    
    // You might need to include the userId as a query parameter if backend requires it
    const url = `${this.apiUrl}/assigned-pending?userId=${userId}`;
    console.log('Request URL:', url);
    
    return this.http.get<DeliveryRequest[]>(
      url,
      { 
        headers: this.getAuthHeaders(),
        observe: 'response' // Get full response with headers
      }
    ).pipe(
      tap(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        console.log('Raw response body:', response.body);
      }),
      map(response => response.body || []),
      tap(deliveries => {
        console.log('Assigned pending deliveries count:', deliveries.length);
        console.log('Assigned pending deliveries:', deliveries);
      }),
      catchError(error => {
        console.error('Error fetching assigned pending deliveries:', error);
        console.error('Request URL was:', url);
        return throwError(() => new Error('Failed to load assigned pending deliveries'));
      })
    );
  }
}