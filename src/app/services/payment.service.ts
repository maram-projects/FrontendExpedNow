import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment';
import { 
  Payment, 
  PaymentMethod, 
  PaymentMethodOption, 
  PaymentStatus 
} from '../models/Payment.model';

interface CreatePaymentIntentResponse {
  success: boolean;
  message: string;
  data: Payment;
  clientSecret?: string;
  paymentId: string;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  data: Payment;
}

export interface PaymentListResponse {  // Make sure it has 'export'
  payments: Payment[];
    message?: string; // Add this line

  success: boolean;
  data: Payment[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalElements: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  count?: number;
}

interface PaymentQueryParams {
  status?: PaymentStatus;
  method?: PaymentMethod;
  clientId?: string;
  deliveryId?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

interface PaymentStatsResponse {
  success: boolean;
  data: {
    totalPayments: number;
    totalRevenue: number;
    statusBreakdown: { [key in PaymentStatus]: number };
    methodBreakdown: { [key in PaymentMethod]: number };
  };
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = `${environment.apiUrl}/api/payments`;

  constructor(private http: HttpClient,   private router: Router ) {}

  /**
   * Creates HTTP headers with authentication token
   */
  private createHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Get all payments with optional filters and pagination
   */
  getAllPayments(queryParams?: PaymentQueryParams): Observable<PaymentListResponse> {
    let params = new HttpParams();
    
    if (queryParams) {
      Object.keys(queryParams).forEach(key => {
        const value = queryParams[key as keyof PaymentQueryParams];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<PaymentListResponse>(this.apiUrl, { 
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      tap(response => console.log('Get all payments response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Get all payments without pagination
   */
getAllPaymentsSimple(): Observable<PaymentListResponse> {
  return this.http.get<PaymentListResponse>(`${this.apiUrl}`, { 
    headers: this.createHeaders(),
    params: new HttpParams().set('includeDeliveryPerson', 'true')
  }).pipe(
    map(response => {
      // Ensure consistent response structure
      if (response.success && response.data) {
        return {
          ...response,
          data: response.data.map(payment => this.processPaymentData(payment))
        };
      }
      return response;
    }),
    catchError(error => {
      console.error('Get payments error:', error);
      return throwError(() => new Error('Failed to fetch payments'));
    })
  );
}

  /**
   * Create a new payment intent
   */
createPaymentIntent(paymentData: {
  deliveryId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  clientId: string;
  discountCode?: string;
}): Observable<CreatePaymentIntentResponse> {
  console.log('Creating payment intent with data:', paymentData);
  
  return this.http.post<CreatePaymentIntentResponse>(
    this.apiUrl,
    paymentData,
    { headers: this.createHeaders() }
  ).pipe(
    tap(response => {
      // Only require clientSecret for credit card payments
      const isCardPayment = paymentData.paymentMethod === PaymentMethod.CREDIT_CARD;
      
      if (!response || !response.paymentId) {
        console.error('Invalid response:', response);
        throw new Error('Payment service returned invalid response');
      }

      if (isCardPayment && !response.clientSecret) {
        console.error('Missing clientSecret for card payment:', response);
        throw new Error('Payment initialization failed for card');
      }
    }),
    catchError(error => {
      console.error('Payment intent creation error:', error);
      let errorMessage = 'Payment failed';
      
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    })
  );
}
  /**
   * Get a specific payment by ID
   */
getPayment(paymentId: string): Observable<PaymentResponse> {
  return this.http.get<any>(`${this.apiUrl}/${paymentId}`, {
    headers: this.createHeaders(),
    withCredentials: true
  }).pipe(
    map(response => {
      console.log('Raw payment response:', response);
      
      // Handle both direct payment object and wrapped response
      const paymentData = response.data || response;
      
      return {
        success: response.success !== false, // Default to true if not specified
        data: {
          ...paymentData,
          status: paymentData.status?.toString() || 'PENDING',
          method: paymentData.method?.toString() || paymentData.paymentMethod?.toString() || 'UNKNOWN',
          paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : undefined,
          createdAt: paymentData.createdAt ? new Date(paymentData.createdAt) : undefined,
          updatedAt: paymentData.updatedAt ? new Date(paymentData.updatedAt) : undefined
        }
      } as PaymentResponse;
    }),
    catchError(this.handleError)
  );
}

  /**
   * Process a payment
   */
  processPayment(paymentId: string, discountCode?: string): Observable<PaymentResponse> {
    const params = discountCode ? new HttpParams().set('discountCode', discountCode) : new HttpParams();
    
    return this.http.post<PaymentResponse>(`${this.apiUrl}/${paymentId}/process`, {}, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      tap(response => console.log('Process payment response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Confirm a payment
   */
confirmPayment(transactionId: string, amount: number): Observable<PaymentResponse> {
    // Validate parameters first
    if (!transactionId || amount == null) {
      return throwError(() => new Error('transactionId and amount are required'));
    }

    const requestBody = {
      transactionId: transactionId,
      amount: amount
    };

    return this.http.post<PaymentResponse>(
      `${this.apiUrl}/confirm`,
      requestBody,  // Send as request body instead of query params
      {
        headers: this.createHeaders(),
        withCredentials: true
      }
    ).pipe(
      catchError(error => {
        console.error('Payment confirmation failed:', error);
        return throwError(() => new Error('Payment confirmation failed'));
      })
    );
  }

private refreshDashboardData(): void {
  if (this.router) {
    this.router.navigate([], {
      queryParams: { refresh: Date.now().toString() },
      queryParamsHandling: 'merge'
    });
  }
}

  /**
   * Fail/Cancel a payment
   */
  failPayment(transactionId: string): Observable<PaymentResponse> {
    const params = new HttpParams().set('transactionId', transactionId);

    return this.http.post<PaymentResponse>(`${this.apiUrl}/fail`, {}, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Fail payment response:', response)),
      catchError(this.handleError)
    );
  }


  /**
   * Update payment status
   */
updatePaymentStatus(paymentId: string, status: string): Observable<any> {
    return this.http.put(
        `${this.apiUrl}/${paymentId}/status`,
        { status },  // Send as JSON body
        { headers: this.createHeaders() }
    ).pipe(
        catchError(error => {
            console.error('Update payment status error:', error);
            let errorMessage = 'Failed to update payment status';
            if (error.error?.message) {
                errorMessage = error.error.message;
            }
            return throwError(() => new Error(errorMessage));
        })
    );
}

  /**
   * Cancel a payment
   */
  cancelPayment(paymentId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${paymentId}/cancel`,
      {},
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Cancel payment error:', error);
        
        let errorMessage = 'Failed to cancel payment';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }
  /**
   * Refund a payment
   */
refundPayment(paymentId: string, amount?: number, currency: string = 'TND'): Observable<any> {
  const payload = {
    amount: amount ?? undefined,  // Send undefined if amount not provided
    currency
  };

  return this.http.post(
    `${this.apiUrl}/${paymentId}/refund`,
    payload,
    { headers: this.createHeaders() }
  ).pipe(
    catchError(error => {
      console.error('Refund payment error:', error);
      let errorMessage = 'Failed to refund payment';
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
      return throwError(() => new Error(errorMessage));
    })
  );
}


  /**
   * Get payments by client ID
   */
  getPaymentsByClient(clientId: string): Observable<PaymentListResponse> {
    return this.http.get<PaymentListResponse>(`${this.apiUrl}/client/${clientId}`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Get payments by client response:', response)),
      catchError(this.handleError)
    );
  }


  

  /**
   * Get payments by delivery ID
   */
  getPaymentsByDelivery(deliveryId: string): Observable<PaymentListResponse> {
    return this.http.get<PaymentListResponse>(`${this.apiUrl}/delivery/${deliveryId}`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Get payments by delivery response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Get client secret for Stripe payment
   */
  getPaymentClientSecret(paymentId: string): Observable<{success: boolean, clientSecret: string}> {
    return this.http.get<{success: boolean, clientSecret: string}>(`${this.apiUrl}/${paymentId}/client-secret`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Get client secret response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Process specific payment methods
   */
  processCardPayment(paymentId: string, discountCode?: string): Observable<PaymentResponse> {
    const params = discountCode ? new HttpParams().set('discountCode', discountCode) : new HttpParams();
    
    return this.http.post<PaymentResponse>(`${this.apiUrl}/${paymentId}/process/card`, {}, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Process card payment response:', response)),
      catchError(this.handleError)
    );
  }

  processCashPayment(paymentId: string, discountCode?: string): Observable<PaymentResponse> {
    const params = discountCode ? new HttpParams().set('discountCode', discountCode) : new HttpParams();
    
    return this.http.post<PaymentResponse>(`${this.apiUrl}/${paymentId}/process/cash`, {}, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Process cash payment response:', response)),
      catchError(this.handleError)
    );
  }

  processWalletPayment(paymentId: string, discountCode?: string): Observable<PaymentResponse> {
    const params = discountCode ? new HttpParams().set('discountCode', discountCode) : new HttpParams();
    
    return this.http.post<PaymentResponse>(`${this.apiUrl}/${paymentId}/process/wallet`, {}, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Process wallet payment response:', response)),
      catchError(this.handleError)
    );
  }

  processBankTransferPayment(paymentId: string, discountCode?: string): Observable<PaymentResponse> {
    const params = discountCode ? new HttpParams().set('discountCode', discountCode) : new HttpParams();
    
    return this.http.post<PaymentResponse>(`${this.apiUrl}/${paymentId}/process/bank-transfer`, {}, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Process bank transfer payment response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Check if payment method is supported
   */
  isPaymentMethodSupported(method: PaymentMethod): Observable<{success: boolean, method: PaymentMethod, supported: boolean}> {
    return this.http.get<{success: boolean, method: PaymentMethod, supported: boolean}>(`${this.apiUrl}/methods/${method}/supported`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Payment method support response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Get payment statistics
   */
  getPaymentStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`, { headers: this.createHeaders() })
      .pipe(
        catchError(error => {
          console.error('Get payment stats error:', error);
          return throwError(() => new Error('Failed to fetch payment statistics'));
        })
      );
  }
  /**
   * Get available payment methods
   */
  getAvailablePaymentMethods(): PaymentMethodOption[] {
    return [
      { 
        id: PaymentMethod.CREDIT_CARD, 
        name: 'Credit Card', 
        icon: 'credit-card',
        description: 'Secure payment with Stripe',
        available: true
      },
      { 
        id: PaymentMethod.BANK_TRANSFER, 
        name: 'Bank Transfer', 
        icon: 'bank',
        description: 'Direct bank transfer',
        available: true
      },
      { 
        id: PaymentMethod.WALLET, 
        name: 'Digital Wallet', 
        icon: 'wallet',
        description: 'Pay from your account balance',
        available: true
      }
    ];
  }



processNonCardPayment(paymentId: string, discountCode?: string): Observable<PaymentResponse> {
  const params = discountCode ? new HttpParams().set('discountCode', discountCode) : new HttpParams();
  
  return this.http.post<PaymentResponse>(`${this.apiUrl}/${paymentId}/process`, {}, {
    params,
    headers: this.createHeaders(),
    withCredentials: true
  }).pipe(
    retry(2),
    tap(response => console.log('Process non-card payment response:', response)),
    catchError(this.handleError)
  );
}
getPaymentStatus(paymentId: string): Observable<{success: boolean, status: PaymentStatus, updatedAt: Date}> {
  return this.http.get<{success: boolean, status: PaymentStatus, updatedAt: Date}>(
    `${this.apiUrl}/${paymentId}/status`,
    { headers: this.createHeaders() }
  ).pipe(
    catchError(this.handleError)
  );
}





  /**
   * Enhanced error handling
   */
private handleError = (error: HttpErrorResponse) => {
  console.error('Payment service error:', error);
  
  let errorMessage = 'An unexpected error occurred';
  
  if (error.error instanceof ErrorEvent) {
    // Client-side error
    errorMessage = `Error: ${error.error.message}`;
  } else {
    // Server-side error
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else {
      switch (error.status) {
        case 400:
          errorMessage = 'Invalid payment data provided';
          break;
        case 401:
          errorMessage = 'Authentication required. Please log in again.';
          break;
        case 402:
          errorMessage = 'Payment required or insufficient funds';
          break;
        case 403:
          errorMessage = 'Access denied. You do not have permission to perform this action.';
          break;
        case 404:
          errorMessage = 'Payment not found';
          break;
        case 409:
          errorMessage = 'Payment conflict. This payment may have already been processed.';
          break;
        case 422:
          errorMessage = 'Invalid payment data. Please check your input.';
          break;
        case 500:
          errorMessage = 'Payment processing temporarily unavailable. Please try again later.';
          break;
        case 502:
          errorMessage = 'Payment gateway error. Please try again.';
          break;
        case 503:
          errorMessage = 'Payment service temporarily unavailable. Please try again later.';
          break;
        default:
          errorMessage = `Payment failed with status ${error.status}. Please try again.`;
      }
    }
  }
  
  return throwError(() => new Error(errorMessage));
};

// In your PaymentService, add this helper method
private parsePaymentDates(payment: Payment): Payment {
  return {
    ...payment,
    paymentDate: payment.paymentDate ? new Date(payment.paymentDate.toString()) : undefined,
    createdAt: payment.createdAt ? new Date(payment.createdAt.toString()) : undefined,
    updatedAt: payment.updatedAt ? new Date(payment.updatedAt.toString()) : undefined
  };
}

getPaymentDetails(paymentId: string): Observable<PaymentResponse> {
  return this.http.get<PaymentResponse>(`${this.apiUrl}/${paymentId}`, {
    headers: this.createHeaders(),
    withCredentials: true
  }).pipe(
    map(response => {
      if (response.success && response.data) {
        // Parse dates
        const payment = response.data;
        return {
          ...response,
          data: {
            ...payment,
            paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : undefined,
            createdAt: payment.createdAt ? new Date(payment.createdAt) : undefined,
            updatedAt: payment.updatedAt ? new Date(payment.updatedAt) : undefined
          }
        };
      }
      return response;
    }),
    catchError(this.handleError)
  );
}




  getDeliveryPersonPayments(deliveryPersonId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(
      `${this.apiUrl}/delivery-person/${deliveryPersonId}`
    );
  }

  formatCurrency(amount: number, currency: string = 'TND'): string {
    if (amount === undefined || amount === null) return `${currency} 0.00`;
    
    try {
      return new Intl.NumberFormat('en-TN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // في حالة فشل التنسيق، استخدم تنسيق بسيط
      return `${currency} ${amount.toFixed(2)}`;
    }
  }


 getPaymentById(paymentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${paymentId}`, { headers: this.createHeaders() })
      .pipe(
        catchError(error => {
          console.error('Get payment by ID error:', error);
          return throwError(() => new Error('Failed to fetch payment'));
        })
      );
  }


getPaymentsByDeliveryPerson(deliveryPersonId: string): Observable<PaymentListResponse> {
  return this.http.get<PaymentListResponse>(
    `${this.apiUrl}/delivery-person/${deliveryPersonId}`, 
    { 
      headers: this.createHeaders(),
      params: new HttpParams()
        .set('includeAll', 'true')
        .set('includeDeliveryPerson', 'true')
    }
  ).pipe(
    map(response => {
      if (response.success && response.data) {
        return {
          ...response,
          data: response.data.map(payment => this.processPaymentData(payment))
        };
      }
      return response;
    }),
    catchError(error => {
      console.error('Error fetching delivery person payments:', error);
      return throwError(() => new Error('Failed to fetch delivery person payments'));
    })
  );
}
getDeliveryPersonPaymentSummary(deliveryPersonId: string): Observable<any> {
  return this.http.get<any>(
    `${this.apiUrl}/delivery-person/${deliveryPersonId}/summary`,
    { headers: this.createHeaders() }
  ).pipe(
    catchError(error => {
      console.error('Error fetching payment summary:', error);
      return throwError(() => new Error('Failed to fetch payment summary'));
    })
  );
}

public processPaymentData(payment: any): Payment {
  console.log('Processing payment data:', payment); // Debug log
  
  const processedPayment = {
    // Preserve original payment data
    ...payment,
    
    // Ensure numeric fields are properly parsed
    amount: this.safeParseNumber(payment.amount),
    finalAmountAfterDiscount: this.safeParseNumber(payment.finalAmountAfterDiscount),
    deliveryPersonShare: this.safeParseNumber(payment.deliveryPersonShare) || 0,
    discountAmount: this.safeParseNumber(payment.discountAmount) || 0,
    
    // Ensure boolean fields are properly parsed
    deliveryPersonPaid: payment.deliveryPersonPaid === true,
    
    // Ensure string/ID fields are properly handled
    id: payment.id?.toString() || payment._id?.toString(),
    deliveryPersonId: payment.deliveryPersonId?.toString(), // Single declaration here
    customerId: payment.customerId?.toString(),
    orderId: payment.orderId?.toString(),
    
    // Ensure status field is properly handled
    status: payment.status?.toUpperCase() || 'PENDING',
    
    // Ensure payment method is handled
    paymentMethod: payment.paymentMethod || 'UNKNOWN',
    
    // Ensure dates are properly parsed
    paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : undefined,
    deliveryPersonPaidAt: payment.deliveryPersonPaidAt ? new Date(payment.deliveryPersonPaidAt) : undefined,
    createdAt: payment.createdAt ? new Date(payment.createdAt) : undefined,
    updatedAt: payment.updatedAt ? new Date(payment.updatedAt) : undefined,
    
    // Ensure delivery person data is preserved and properly formatted
    deliveryPerson: payment.deliveryPerson ? {
      id: payment.deliveryPerson.id?.toString(),
      fullName: payment.deliveryPerson.fullName || 'Unknown Delivery Person',
      phone: payment.deliveryPerson.phone || '',
      email: payment.deliveryPerson.email || ''
    } : null,
    
    // Ensure customer data is preserved
    customer: payment.customer ? {
      id: payment.customer.id?.toString(),
      fullName: payment.customer.fullName || 'Unknown Customer',
      phone: payment.customer.phone || '',
      email: payment.customer.email || ''
    } : null,
    
    // Ensure order data is preserved
    order: payment.order ? {
      id: payment.order.id?.toString(),
      orderNumber: payment.order.orderNumber || '',
      items: payment.order.items || []
    } : null,
    
    // Additional fields that might be needed
    notes: payment.notes || '',
    transactionId: payment.transactionId || '',
    
    // Ensure address fields if present
    deliveryAddress: payment.deliveryAddress || '',
    
    // Handle any discount information
    discountType: payment.discountType || null,
    discountPercentage: this.safeParseNumber(payment.discountPercentage) || 0
  } as Payment;
  
  console.log('Processed payment result:', processedPayment); // Debug log
  
  return processedPayment;
}

public safeParseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

releaseToDeliveryPerson(paymentId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${paymentId}/release-to-delivery`, 
      {}, 
      { headers: this.createHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Release payment error:', error);
        
        let errorMessage = 'Failed to release payment';
        
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 400) {
          errorMessage = 'Invalid payment state for release';
        } else if (error.status === 404) {
          errorMessage = 'Payment not found';
        } else if (error.status === 403) {
          errorMessage = 'Not authorized to release payment';
        } else if (error.status === 500) {
          errorMessage = 'Server error occurred';
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }
}