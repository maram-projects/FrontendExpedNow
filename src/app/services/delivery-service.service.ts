  import { Injectable } from '@angular/core';
  import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
  import { Observable, throwError } from 'rxjs';
  import { catchError, filter, map, tap } from 'rxjs/operators';
  import { environment } from '../../environments/environment';
  import { AuthService } from './auth.service';
  import { Mission } from '../models/mission.model';
  import { PaymentMethod } from '../models/Payment.model'; // Add this import

export enum DeliveryStatus {
   PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  APPROVED = 'APPROVED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',  // Rating should happen at this stage
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  RATED = 'RATED'  
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}


// delivery-service.service.ts
interface PaymentStatusUpdateBody {
  paymentId: string;
  paymentStatus: string;
  paymentMethod?: PaymentMethod;
}
  // Updated to match Java DeliveryResponseDTO
 export interface DeliveryRequest {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  packageDescription: string;
  packageWeight: number;
  vehicleId?: string;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
  discountCode?: string;
  discountAmount?: number;
  preferredPaymentMethod?: string;
  clientId: string;
  packageType?: string;
  additionalInstructions?: string;
  status: string;
  deliveryPersonId?: string;
  amount?: number;
  finalAmountAfterDiscount?: number;
  discountId?: string;
  scheduledDate?: string;
  createdAt?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  updatedAt?: string;
  paymentMethod?: string;
  paymentDate?: string;
   originalAmount?: number; // Add this for discount display
  processing?: boolean;    // Add this for UI state management
  processingPayment?: boolean; // Specifically for payment processing
  rating?: number | null;
  rated?: boolean | null;

}

export interface DeliveryWithAssignedPersonResponse {
  delivery: DeliveryRequest;
  assignedDeliveryPerson?: {
    id: string;
    fullName: string;
    phone: string;
    rating?: number;
    ratingCount?: number;
    completedDeliveries?: number;
    vehicle?: {
      model: string;
      licensePlate: string;
      type: string;
    };
  };
}


  @Injectable({ providedIn: 'root' })
  export class DeliveryService {
    private apiUrl = `${environment.apiUrl}/api/deliveries`;
    router: any;

    constructor(
      private http: HttpClient,
      public authService: AuthService
    ) {}

    createDeliveryRequest(delivery: Omit<DeliveryRequest, 'id'>): Observable<DeliveryRequest> {
      const formattedDelivery = {
        ...delivery,
        scheduledDate: new Date(delivery.scheduledDate || '').toISOString()
      };
      
      console.log('Delivery request payload:', formattedDelivery);
    
      const url = `${this.apiUrl}/request${delivery.clientId ? `?clientId=${delivery.clientId}` : ''}`;
    
      return this.http.post<DeliveryRequest>(url, formattedDelivery, { headers: this.getAuthHeaders() })
        .pipe(
          catchError(error => {
            console.error('Error creating delivery:', error);
            console.error('Request payload was:', formattedDelivery);
            console.error('Server response:', error.error);
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
        `${this.apiUrl}/all`,
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
        `${this.apiUrl}/pending-unassigned`,
        { headers: this.getAuthHeaders() }
      ).pipe(
        tap(deliveries => console.log('Unassigned pending deliveries:', deliveries)),
        catchError(error => {
          console.error('Error fetching unassigned deliveries:', error);
          return throwError(() => new Error('Failed to fetch unassigned deliveries'));
        })
      );
    }

    cancelDelivery(deliveryId: string): Observable<void> {
      const userId = this.authService.getCurrentUser()?.userId;
      return this.http.delete<void>(
        `${this.apiUrl}/client/${deliveryId}?clientId=${userId}`,
        { headers: this.getAuthHeaders() }
      ).pipe(
        catchError(error => {
          console.error('Error canceling delivery:', error);
          return throwError(() => new Error('Failed to cancel delivery'));
        })
      );
    }

    checkExpiredDeliveries(): Observable<void> {
      return this.http.post<void>(`${this.apiUrl}/expire-old`, {}).pipe(
        catchError(error => {
          if (error.status === 403) {
            return throwError(() => new Error('You do not have permission to perform this action'));
          } else if (error.status === 500) {
            return throwError(() => new Error('Server error while expiring deliveries'));
          } else {
            return throwError(() => new Error('Failed to check expired deliveries'));
          }
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

    // Added the missing downloadReceipt method
    downloadReceipt(deliveryId: string): Observable<Blob> {
      return this.http.get(`${this.apiUrl}/${deliveryId}/receipt`, {
        headers: this.getAuthHeaders(),
        responseType: 'blob'
      }).pipe(
        catchError(error => {
          console.error('Error downloading receipt:', error);
          return throwError(() => new Error('Failed to download receipt'));
        })
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

      const body = { deliveryPersonId: userId };
      console.log('Request body:', body);

      return this.http.post<{ delivery: DeliveryRequest, mission: Mission }>(
          `${this.apiUrl}/${deliveryId}/accept`,
          body,
          { 
              headers: this.getAuthHeaders(),
              withCredentials: true
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
        {},
        { headers: this.getAuthHeaders() }
      ).pipe(
        catchError(error => {
          console.error('Error rejecting delivery:', error);
          return throwError(() => new Error('Failed to reject delivery'));
        })
      );
    }

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
        `${this.apiUrl}/assigned-pending`,
        { headers: this.getAuthHeaders() }
      ).pipe(
        catchError(this.handleError)
      );
    }

    getAssignedPendingDeliveries(): Observable<DeliveryRequest[]> {
      const userId = this.authService.getCurrentUser()?.userId;
      console.log('Fetching assigned pending deliveries for user:', userId);
      
      const url = `${this.apiUrl}/assigned-pending`;
      
      return this.http.get<DeliveryRequest[]>(
        url,
        { 
          headers: this.getAuthHeaders(),
          params: { userId: userId || '' }
        }
      ).pipe(
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

    getDeliveryHistory(): Observable<DeliveryRequest[]> {
      const userId = this.authService.getCurrentUser()?.userId;
      console.log('Fetching delivery history for user:', userId);
      
      return this.http.get<DeliveryRequest[]>(
        `${this.apiUrl}/history`,
        { headers: this.getAuthHeaders() }
      ).pipe(
        tap(history => {
          console.log('Delivery history count:', history.length);
          console.log('Delivery history:', history);
        }),
        catchError(error => {
          console.error('Error fetching delivery history:', error);
          return throwError(() => new Error('Failed to load delivery history'));
        })
      );
    }


  getDeliveryById(deliveryId: string): Observable<DeliveryRequest> {
      return this.http.get<DeliveryRequest>(
          `${this.apiUrl}/${deliveryId}`,
          { 
              headers: this.getAuthHeaders(),
              withCredentials: true
          }
      ).pipe(
          catchError((error: HttpErrorResponse) => {
              console.error('Error fetching delivery:', error);
              if (error.status === 404) {
                  return throwError(() => new Error('Delivery not found'));
              } else if (error.status === 401) {
                  return throwError(() => new Error('Unauthorized access'));
              } else {
                  return throwError(() => new Error('Failed to load delivery details'));
              }
          })
      );
  }

getDeliveryWithAssignedPerson(deliveryId: string): Observable<DeliveryWithAssignedPersonResponse> {
  return this.http.get<DeliveryWithAssignedPersonResponse>(
    `${this.apiUrl}/${deliveryId}/with-assigned`,
    { 
      headers: this.getAuthHeaders(),
      withCredentials: true
    }
  ).pipe(
    map(response => {
      // Ensure assigned person data has proper defaults
      if (response.assignedDeliveryPerson) {
        response.assignedDeliveryPerson = {
          ...response.assignedDeliveryPerson,
          fullName: response.assignedDeliveryPerson.fullName || 'Unknown',
          phone: response.assignedDeliveryPerson.phone || 'Not provided',
          vehicle: response.assignedDeliveryPerson.vehicle || {
            model: 'Unknown',
            licensePlate: 'N/A',
            type: 'Unknown'
          }
        };
      }
      return response;
    }),
    catchError((error: HttpErrorResponse) => {
      console.error('Error fetching delivery with assigned person:', error);
      if (error.status === 404) {
        return throwError(() => new Error('Delivery not found'));
      } else if (error.status === 401) {
        return throwError(() => new Error('Unauthorized access'));
      } else {
        return throwError(() => new Error('Failed to load delivery details'));
      }
    })
  );
}



updateDeliveryPaymentStatus(
  deliveryId: string,
  paymentId: string,
  status: string,
  method?: PaymentMethod,
  finalAmount?: number,
  originalAmount?: number,
  discountAmount?: number,
  discountCode?: string
): Observable<any> {
  const body = {
    paymentId,
    paymentStatus: status,
    paymentMethod: method,
    finalAmount,
    originalAmount,
    discountAmount,
    discountCode
  };

  return this.http.patch(`${this.apiUrl}/${deliveryId}/payment-status`, body, { 
    headers: this.getAuthHeaders() 
  });
}



  navigateToDashboard(queryParams: any = {}): void {
    // Add refresh token to force update
    this.router.navigate(['/client/dashboard'], { 
      queryParams: {
        ...queryParams,
        refresh: Date.now().toString()
      }
    });
  }

rateDelivery(deliveryId: string, rating: number, comment?: string): Observable<any> {
  if (!deliveryId || !rating) {
    return throwError(() => new Error('Invalid rating data'));
  }

  const payload = { rating, comment };
  
  return this.http.post(
    `${this.apiUrl}/${deliveryId}/rate`,
    payload,
    { 
      headers: this.getAuthHeaders(),
      withCredentials: true
    }
  ).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('Rating error details:', error);
      console.error('Request body was:', payload);
      let errorMsg = error.error?.error || 
                    error.error?.message || 
                    error.message || 
                    'Failed to submit rating';
      return throwError(() => new Error(errorMsg));
    })
  );
}

}

interface DeliveryWithDetails extends DeliveryRequest {
  deliveryPerson?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    rating?: number;
    ratingCount?: number;
    vehicle?: {
      type: string;
      model: string;
      licensePlate: string;
    };
  };
}
