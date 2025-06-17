  import { Injectable } from '@angular/core';
  import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
  import { environment } from '../../environments/environment';
  import { catchError, Observable, throwError, timeout, retry } from 'rxjs';

  export interface PricingRequest {
    pickupAddress: string;
    deliveryAddress: string;
    packageDescription?: string;
    packageWeight: number;
    vehicleId: string;
    scheduledDate?: string;
    packageType: string;
    additionalInstructions?: string;
    pickupLatitude: number;
    pickupLongitude: number;
    deliveryLatitude: number;
    deliveryLongitude: number;
    clientId: string;
    urgentDelivery?: boolean;
    insuranceValue?: number;
    fragile?: boolean;
  }

  export interface PricingResponse {
    success: boolean;
    data: {
      distance: number;
      basePrice: number;
      distanceCost: number;
      weightCost: number;
      urgencyFee?: number;
      peakSurcharge?: number;
      holidaySurcharge?: number;
      discountAmount?: number;
      totalAmount: number;
      appliedRules?: Array<{
        description: string;
        amount: number;
        type?: 'fee' | 'discount' | 'surcharge';
      }>;
      currency: string;
      calculatedAt: string;
      validUntil?: string;
    };
    message?: string;
    errors?: string[];
  }

  @Injectable({
    providedIn: 'root'
  })
  export class PricingService {
    private readonly apiUrl = `${environment.apiUrl}/api/pricing`;
    private readonly requestTimeout = 30000; // 30 seconds
    private readonly maxRetries = 2;
    
    private readonly httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      })
    };

    constructor(private http: HttpClient) {}

    /**
     * Calculate pricing for a delivery request
     */
   calculatePricing(deliveryRequest: PricingRequest): Observable<PricingResponse> {
  // Convert dates to strings
  const requestData = {
    ...deliveryRequest,
    scheduledDate: deliveryRequest.scheduledDate ? 
      new Date(deliveryRequest.scheduledDate).toISOString() : 
      undefined
  };

  return this.http.post<PricingResponse>(
    `${this.apiUrl}/calculate`, 
    requestData, 
    this.httpOptions
  ).pipe(
    timeout(this.requestTimeout),
    retry(this.maxRetries),
    catchError((error: HttpErrorResponse) => {
      console.error('Pricing calculation error:', error);
      if (error.status === 400) {
        return throwError(() => 'Invalid request data');
      } else if (error.status === 401) {
        return throwError(() => 'Authentication required');
      } else {
        return throwError(() => 'Server error during price calculation');
      }
    })
  );
}
    /**
     * Get pricing estimates for multiple delivery options
     */
    getPricingEstimates(requests: PricingRequest[]): Observable<PricingResponse[]> {
      const sanitizedRequests = requests.map(req => this.sanitizeRequest(req));
      
      return this.http.post<PricingResponse[]>(
        `${this.apiUrl}/estimates`, 
        { requests: sanitizedRequests }, 
        this.httpOptions
      ).pipe(
        timeout(this.requestTimeout),
        retry(this.maxRetries),
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
    }

    /**
     * Get pricing rules and factors
     */
    getPricingRules(): Observable<any> {
      return this.http.get(`${this.apiUrl}/rules`, this.httpOptions).pipe(
        timeout(this.requestTimeout),
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
    }

    /**
     * Validate pricing calculation
     */
    validatePricing(pricingId: string): Observable<boolean> {
      return this.http.get<boolean>(
        `${this.apiUrl}/validate/${pricingId}`, 
        this.httpOptions
      ).pipe(
        timeout(this.requestTimeout),
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
    }

    /**
     * Apply discount code to pricing
     */
    applyDiscount(pricingData: any, discountCode: string): Observable<PricingResponse> {
      const requestData = {
        ...pricingData,
        discountCode: discountCode.trim().toUpperCase()
      };
      
      return this.http.post<PricingResponse>(
        `${this.apiUrl}/apply-discount`, 
        requestData, 
        this.httpOptions
      ).pipe(
        timeout(this.requestTimeout),
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
    }

    /**
     * Sanitize and validate request data
     */
    private sanitizeRequest(deliveryRequest: PricingRequest): PricingRequest {
      const sanitized: PricingRequest = {
        pickupAddress: this.sanitizeString(deliveryRequest.pickupAddress),
        deliveryAddress: this.sanitizeString(deliveryRequest.deliveryAddress),
        packageWeight: this.sanitizeNumber(deliveryRequest.packageWeight, 0.1),
        vehicleId: this.sanitizeString(deliveryRequest.vehicleId),
        packageType: this.sanitizeString(deliveryRequest.packageType),
        pickupLatitude: this.sanitizeCoordinate(deliveryRequest.pickupLatitude),
        pickupLongitude: this.sanitizeCoordinate(deliveryRequest.pickupLongitude),
        deliveryLatitude: this.sanitizeCoordinate(deliveryRequest.deliveryLatitude),
        deliveryLongitude: this.sanitizeCoordinate(deliveryRequest.deliveryLongitude),
        clientId: this.sanitizeString(deliveryRequest.clientId)
      };

      // Add optional fields if they exist
      if (deliveryRequest.packageDescription) {
        sanitized.packageDescription = this.sanitizeString(deliveryRequest.packageDescription);
      }
      if (deliveryRequest.scheduledDate) {
        sanitized.scheduledDate = deliveryRequest.scheduledDate;
      }
      if (deliveryRequest.additionalInstructions) {
        sanitized.additionalInstructions = this.sanitizeString(deliveryRequest.additionalInstructions);
      }
      if (typeof deliveryRequest.urgentDelivery === 'boolean') {
        sanitized.urgentDelivery = deliveryRequest.urgentDelivery;
      }
      if (deliveryRequest.insuranceValue) {
        sanitized.insuranceValue = this.sanitizeNumber(deliveryRequest.insuranceValue, 0);
      }
      if (typeof deliveryRequest.fragile === 'boolean') {
        sanitized.fragile = deliveryRequest.fragile;
      }

      return sanitized;
    }

    private sanitizeString(value: string): string {
      return (value || '').toString().trim();
    }

    private sanitizeNumber(value: number, min: number = 0): number {
      const num = parseFloat(value?.toString() || '0');
      return isNaN(num) ? min : Math.max(num, min);
    }

    private sanitizeCoordinate(value: number): number {
      const coord = parseFloat(value?.toString() || '0');
      return isNaN(coord) ? 0 : coord;
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
  let errorMessage = 'حدث خطأ غير متوقع في حساب السعر';
  let errorCode = 'UNKNOWN_ERROR';

  console.error('تفاصيل الخطأ:', error);

  if (error.error instanceof ErrorEvent) {
    // Client-side or network error
    errorMessage = `خطأ في الاتصال: ${error.error.message}`;
    errorCode = 'NETWORK_ERROR';

  } else {
    // Server-side error
    const backendMessage = error.error?.message;
    const backendErrors = error.error?.errors;

    switch (error.status) {
      case 400:
        errorMessage = backendMessage || 'البيانات المرسلة غير صحيحة';
        errorCode = 'VALIDATION_ERROR';
        break;

      case 401:
        errorMessage = 'يجب تسجيل الدخول للمتابعة';
        errorCode = 'AUTHENTICATION_ERROR';
        break;

      case 403:
        errorMessage = 'ليس لديك صلاحية للوصول لهذه الخدمة';
        errorCode = 'AUTHORIZATION_ERROR';
        break;

      case 404:
        errorMessage = 'الخدمة غير متوفرة حالياً';
        errorCode = 'SERVICE_NOT_FOUND';
        break;

      case 422:
        errorMessage = backendMessage || 'البيانات المدخلة غير صالحة';
        if (backendErrors && Array.isArray(backendErrors)) {
          errorMessage += ': ' + backendErrors.join(', ');
        }
        errorCode = 'UNPROCESSABLE_ENTITY';
        break;

      case 429:
        errorMessage = 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً';
        errorCode = 'RATE_LIMIT_EXCEEDED';
        break;

      case 500:
        errorMessage = 'خطأ داخلي في الخادم. يرجى المحاولة لاحقاً';
        errorCode = 'SERVER_ERROR';
        break;

      case 503:
        errorMessage = 'الخدمة غير متوفرة مؤقتاً. يرجى المحاولة لاحقاً';
        errorCode = 'SERVICE_UNAVAILABLE';
        break;

      default:
        errorMessage = backendMessage || `خطأ في الخادم (${error.status})`;
        errorCode = `HTTP_${error.status}`;
        if (backendErrors && Array.isArray(backendErrors)) {
          errorMessage += ': ' + backendErrors.join(', ');
        }
        break;
    }
  }

  // Logging for debugging
  console.error('خطأ في خدمة التسعير:', {
    message: errorMessage,
    code: errorCode,
    status: error.status,
    error: error
  });

  // Return observable error
  return throwError(() => ({
    message: errorMessage,
    code: errorCode,
    status: error.status,
    originalError: error
  }));
}
  }