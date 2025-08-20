import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Mission } from '../models/mission.model';
import { PaymentMethod } from '../models/Payment.model';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  APPROVED = 'APPROVED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
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
  updatedAt?: string;
  notes?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  paymentMethod?: string;
  paymentDate?: string;
  originalAmount?: number;
  processing?: boolean;
  processingPayment?: boolean;
  rating?: number | null;
  rated?: boolean | null;
  specialInstructions?: string;
  actionTime?: Date;
  recipient?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  recipientName?: string;
  recipientPhone?: string;
  address?: string;
  priority?: string;
  estimatedDeliveryTime?: Date;
  scheduledDeliveryTime?: Date;
  // Image analysis fields
  imageAnalyzed?: boolean;
  imageQuality?: string;
  extractedText?: string;
}

export interface DeliveryWithAssignedPersonResponse {
  delivery: DeliveryRequest;
  assignedDeliveryPerson?: {
    id: string;
    firstName?: string;
    lastName?: string;
    fullName: string;
    phone: string;
    email: string;
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
export interface ImageAnalysisResponse {
  success: boolean;
  timestamp?: string;
  analysis?: {
    text_extraction?: {
      full_text?: string;
      words?: {
        text: string;
        confidence: number;
      }[];
      word_count?: number;
    };
    image_properties?: {
      width: number;
      height: number;
      channels: number;
      brightness: number;
      contours_count: number;
      error: string;
    };
  };
  delivery_relevant_info?: {
    has_text?: boolean;
    image_quality?: string;
    suitable_for_delivery?: boolean;
    analyzed_at?: string;
  };
  error?: string;
  // Add these for Angular compatibility
  image_analyzed?: boolean;
  image_quality?: string;
  extracted_text?: string;
}

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private apiUrl = `${environment.apiUrl}/api/deliveries`;

  constructor(
    private http: HttpClient,
    private router: Router,
    public authService: AuthService
  ) {}

  // Create delivery request with image
  createDeliveryRequestWithImage(delivery: Omit<DeliveryRequest, 'id'>, imageFile: File): Observable<any> {
    const formData = new FormData();
    const deliveryBlob = new Blob([JSON.stringify({
        ...delivery,
        scheduledDate: delivery.scheduledDate ? new Date(delivery.scheduledDate).toISOString() : null
    })], { type: 'application/json' });

    formData.append('delivery', deliveryBlob);
    formData.append('image', imageFile);

    return this.http.post<any>(
        `${this.apiUrl}/request-with-image`, 
        formData,
        { headers: this.getAuthHeadersForFormData() }
    ).pipe(
        catchError(error => {
            console.error('Error creating delivery with image:', error);
            return throwError(() => new Error(`Failed to create delivery: ${error.error?.message || error.message}`));
        })
    );
  }

// delivery-service.service.ts
  extractTextFromImage(imageFile: File): Observable<ImageAnalysisResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);

    return this.http.post<any>(
      `${this.apiUrl}/analyze-image`,
      formData,
      { headers: this.getAuthHeadersForFormData() }
    ).pipe(
      map(response => this.mapImageAnalysisResponse(response)),
      catchError(error => {
        console.error('Error analyzing image:', error);
        return throwError(() => new Error(`Failed to analyze image: ${error.error?.message || error.message}`));
      })
    );
  }


private mapImageAnalysisResponse(backendResponse: any): ImageAnalysisResponse {
    console.log('Backend response:', backendResponse);
    
    // Map the response to match frontend expectations
    const mappedResponse: ImageAnalysisResponse = {
      success: backendResponse.success,
      timestamp: backendResponse.timestamp,
      error: backendResponse.error,
      image_analyzed: backendResponse.image_analyzed,
      image_quality: backendResponse.image_quality,
      extracted_text: backendResponse.extracted_text,
      analysis: backendResponse.analysis ? {
        text_extraction: {
          full_text: backendResponse.analysis.text_extraction?.full_text || '',
          words: backendResponse.analysis.text_extraction?.words || [],
          word_count: backendResponse.analysis.text_extraction?.word_count || 0
        },
        image_properties: backendResponse.analysis.image_properties
      } : undefined,
      delivery_relevant_info: backendResponse.delivery_relevant_info ? {
        has_text: backendResponse.delivery_relevant_info.has_text,
        image_quality: backendResponse.delivery_relevant_info.image_quality,
        suitable_for_delivery: backendResponse.delivery_relevant_info.suitable_for_delivery,
        analyzed_at: backendResponse.delivery_relevant_info.analyzed_at
      } : undefined
    };

    console.log('Mapped response:', mappedResponse);
    return mappedResponse;
  }


  // Analyze image (generic method)
  analyzeImage(formData: FormData): Observable<ImageAnalysisResponse> {
    return this.http.post<ImageAnalysisResponse>(
      `${this.apiUrl}/analyze-image`, 
      formData,
      { headers: this.getAuthHeadersForFormData() }
    ).pipe(
      catchError(error => {
        console.error('Error analyzing image:', error);
        return throwError(() => new Error(`Failed to analyze image: ${error.error?.message || error.message}`));
      })
    );
  }

  // Re-analyze image for existing delivery
  reanalyzeImage(deliveryId: string, imageFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    return this.http.post<any>(`${this.apiUrl}/${deliveryId}/reanalyze-image`, formData, { 
      headers: this.getAuthHeadersForFormData() 
    }).pipe(
      catchError(error => {
        console.error('Error reanalyzing image:', error);
        return throwError(() => new Error(`Failed to reanalyze image: ${error.message || error.error || 'Unknown error'}`));
      })
    );
  }

  // Get image analysis results
  getImageAnalysis(deliveryId: string): Observable<ImageAnalysisResponse> {
    return this.http.get<any>(`${this.apiUrl}/${deliveryId}/image-analysis`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      map(response => this.mapImageAnalysisResponse(response)),
      catchError(error => {
        console.error('Error getting image analysis:', error);
        return throwError(() => new Error(`Failed to get image analysis: ${error.message || error.error || 'Unknown error'}`));
      })
    );
  }

  // Regular delivery request without image
  createDeliveryRequest(delivery: Omit<DeliveryRequest, 'id'>): Observable<DeliveryRequest> {
    const formattedDelivery = {
      ...delivery,
      scheduledDate: delivery.scheduledDate ? new Date(delivery.scheduledDate).toISOString() : null
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

  // Get all deliveries (matches controller endpoint)
  getAllDeliveries(): Observable<DeliveryRequest[]> {
    console.log('Fetching all deliveries');
    return this.http.get<DeliveryRequest[]>(
      `${this.apiUrl}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(deliveries => console.log('All deliveries:', deliveries)),
      catchError(error => {
        console.error('Error fetching all deliveries:', error);
        return throwError(() => new Error('Failed to fetch all deliveries'));
      })
    );
  }

  // Get client deliveries
  getClientDeliveries(clientId: string): Observable<DeliveryRequest[]> {
    return this.http.get<DeliveryRequest[]>(`${this.apiUrl}?clientId=${clientId}`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching client deliveries:', error);
        return throwError(() => new Error('Failed to load client deliveries'));
      })
    );
  }

  // Get pending deliveries
  getPendingDeliveries(): Observable<DeliveryRequest[]> {
    return this.http.get<DeliveryRequest[]>(`${this.apiUrl}/pending`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching pending deliveries:', error);
        return throwError(() => new Error('Failed to load pending deliveries'));
      })
    );
  }

  // Cancel delivery (client)
  cancelDelivery(deliveryId: string): Observable<void> {
    const userId = this.authService.getCurrentUser()?.userId;
    return this.http.delete<void>(
      `${this.apiUrl}/client/${deliveryId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error canceling delivery:', error);
        return throwError(() => new Error('Failed to cancel delivery'));
      })
    );
  }

  // Admin cancel delivery
  adminCancelDelivery(deliveryId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/${deliveryId}`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error admin canceling delivery:', error);
        return throwError(() => new Error('Failed to cancel delivery'));
      })
    );
  }

  // Expire old deliveries
  expireOldDeliveries(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/expire-old`, {}, { 
      headers: this.getAuthHeaders() 
    }).pipe(
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

  // Accept delivery
  acceptDelivery(deliveryId: string): Observable<{ delivery: DeliveryRequest, mission: Mission }> {
    const userId = this.authService.getCurrentUser()?.userId;
    
    if (!userId) {
      return throwError(() => new Error('User ID is missing!'));
    }

    const body = { deliveryPersonId: userId };
    console.log('Accept delivery request body:', body);

    return this.http.post<{ delivery: DeliveryRequest, mission: Mission }>(
      `${this.apiUrl}/${deliveryId}/accept`,
      body,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error accepting delivery:', error);
        return throwError(() => new Error('Failed to accept delivery: ' + 
          (error.error?.message || error.message)));
      })
    );
  }

  // Reject delivery
  rejectDelivery(deliveryId: string): Observable<DeliveryRequest> {
    const userId = this.authService.getCurrentUser()?.userId;
    return this.http.post<DeliveryRequest>(
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

  // Get assigned pending deliveries
  getAssignedPendingDeliveries(): Observable<DeliveryRequest[]> {
    const userId = this.authService.getCurrentUser()?.userId;
    console.log('Fetching assigned pending deliveries for user:', userId);
    
    return this.http.get<DeliveryRequest[]>(
      `${this.apiUrl}/assigned-pending`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(deliveries => {
        console.log('Assigned pending deliveries count:', deliveries.length);
        console.log('Assigned pending deliveries:', deliveries);
      }),
      catchError(error => {
        console.error('Error fetching assigned pending deliveries:', error);
        return throwError(() => new Error('Failed to load assigned pending deliveries'));
      })
    );
  }

  // Get delivery history
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

  // Update delivery status
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

  // Get delivery by ID
  getDeliveryById(deliveryId: string): Observable<DeliveryRequest> {
    return this.http.get<DeliveryRequest>(
      `${this.apiUrl}/${deliveryId}`,
      { headers: this.getAuthHeaders() }
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

  // Get delivery with assigned person
  getDeliveryWithAssignedPerson(deliveryId: string): Observable<DeliveryWithAssignedPersonResponse> {
    return this.http.get<DeliveryWithAssignedPersonResponse>(
      `${this.apiUrl}/${deliveryId}/with-assigned`,
      { headers: this.getAuthHeaders() }
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

  // Update delivery payment status
  updateDeliveryPaymentStatus(
    deliveryId: string,
    paymentId: string,
    paymentStatus: string,
    paymentMethod?: PaymentMethod
  ): Observable<any> {
    const body = {
      paymentId,
      paymentStatus,
      paymentMethod
    };

    return this.http.patch(`${this.apiUrl}/${deliveryId}/payment-status`, body, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error updating payment status:', error);
        return throwError(() => new Error('Failed to update payment status'));
      })
    );
  }

  // Rate delivery
  rateDelivery(deliveryId: string, rating: number, comment?: string): Observable<any> {
    if (!deliveryId || !rating) {
      return throwError(() => new Error('Invalid rating data'));
    }

    const payload = { rating, comment };
    
    return this.http.post(
      `${this.apiUrl}/${deliveryId}/rate`,
      payload,
      { headers: this.getAuthHeaders() }
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

  // Get today's completed deliveries count
  getTodayCompletedDeliveries(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/today-completed`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching today\'s completed deliveries:', error);
        return throwError(() => new Error('Failed to load today\'s completed deliveries'));
      })
    );
  }

  // Get delivery with details
  getDeliveryWithDetails(deliveryId: string): Observable<DeliveryRequest> {
    return this.http.get<DeliveryRequest>(`${this.apiUrl}/${deliveryId}/with-details`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      catchError(error => {
        console.error('Error fetching delivery with details:', error);
        return throwError(() => new Error('Failed to load delivery details'));
      })
    );
  }

  // Navigation helper
  navigateToDashboard(queryParams: any = {}): void {
    this.router.navigate(['/client/dashboard'], { 
      queryParams: {
        ...queryParams,
        refresh: Date.now().toString()
      }
    });
  }

  // Download receipt
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

  // Location and availability updates (for delivery persons)
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

  // Check delivery person status
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

  // Private helper methods
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    console.log('Current user ID:', this.authService.getCurrentUser()?.userId);
    console.log('Using auth token:', token ? 'Token exists' : 'No token!');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  private getAuthHeadersForFormData(): HttpHeaders {
    const token = this.authService.getToken();
    // Don't set Content-Type for FormData - let browser set it with boundary
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
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
}

// Additional interfaces for completeness
export interface DeliveryWithDetails extends DeliveryRequest {
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