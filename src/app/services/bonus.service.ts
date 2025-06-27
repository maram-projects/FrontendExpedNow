// bonus.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, tap, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { 
  Bonus, 
  BonusStatus, 
  CreateBonusRequest, 
  UpdateBonusRequest, 
  BonusFilter,
  BonusSummary 
} from '../models/bonus.model';
import { AuthService } from './auth.service';

// Response interfaces
interface BonusResponse {
  success: boolean;
  message: string;
  data: Bonus;
}

interface BonusListResponse {
  success: boolean;
  message: string;
  data: Bonus[];
  bonuses?: Bonus[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalElements: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  count?: number;
}

interface DeliveryStatsResponse {
  success: boolean;
  message: string;
  data: {
    weeklyDeliveries: number;
    monthlyDeliveries: number;
    totalEarnings: number;
    pendingBonuses: number;
    totalBonuses?: number;
    paidBonuses?: number;
    approvedBonuses?: number;
    rejectedBonuses?: number;
  };
}

interface BonusStatsResponse {
  success: boolean;
  message: string;
  data: {
    totalBonuses: number;
    totalAmount: number;
    statusBreakdown: { [key in BonusStatus]: number };
    monthlyBreakdown: { [key: string]: number };
    deliveryPersonBreakdown: { [key: string]: number };
  };
}

interface BonusQueryParams {
  status?: BonusStatus;
  deliveryPersonId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

interface BulkOperationResponse {
  success: boolean;
  message: string;
  processedCount: number;
  errors?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class BonusService {
  private apiUrl = `${environment.apiUrl}/api/bonuses`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

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
   * Helper method to build HttpParams from object
   */
  private buildHttpParams(params: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return httpParams;
  }

  /**
   * Helper method to parse bonus dates
   */
  private parseBonusDates(bonus: Bonus): Bonus {
    return {
      ...bonus,
      startDate: bonus.startDate ? new Date(bonus.startDate.toString()) : bonus.startDate,
      endDate: bonus.endDate ? new Date(bonus.endDate.toString()) : bonus.endDate,
      createdAt: bonus.createdAt ? new Date(bonus.createdAt.toString()) : undefined,
      updatedAt: bonus.updatedAt ? new Date(bonus.updatedAt.toString()) : undefined,
      approvedAt: bonus.approvedAt ? new Date(bonus.approvedAt.toString()) : undefined,
      paidAt: bonus.paidAt ? new Date(bonus.paidAt.toString()) : undefined,
      rejectedAt: bonus.rejectedAt ? new Date(bonus.rejectedAt.toString()) : undefined
    };
  }

  /**
   * Helper method to process bonus list response
   */
  private processBonusListResponse(response: BonusListResponse): BonusListResponse {
    return {
      ...response,
      data: (response.data || response.bonuses || []).map(bonus => this.parseBonusDates(bonus))
    };
  }

  // =============================================================================
  // MAIN BONUS OPERATIONS
  // =============================================================================

  /**
   * Get all bonuses with optional filters and pagination
   */
  getAllBonuses(queryParams?: BonusQueryParams): Observable<BonusListResponse> {
    const params = queryParams ? this.buildHttpParams(queryParams) : new HttpParams();

    return this.http.get<BonusListResponse>(this.apiUrl, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      map(response => this.processBonusListResponse(response)),
      tap(response => console.log('Get all bonuses response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Get all bonuses without pagination (simple version)
   */
  getAllBonusesSimple(): Observable<Bonus[]> {
    return this.http.get<BonusListResponse>(`${this.apiUrl}/all`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      map(response => (response.data || response.bonuses || []).map(bonus => this.parseBonusDates(bonus))),
      tap(bonuses => console.log('Get all bonuses simple:', bonuses)),
      catchError(this.handleError)
    );
  }

  /**
   * Get a specific bonus by ID
   */
  getBonus(bonusId: string): Observable<Bonus> {
    return this.http.get<BonusResponse>(`${this.apiUrl}/${bonusId}`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.parseBonusDates(response.data);
        }
        throw new Error(response.message || 'Bonus not found');
      }),
      tap(bonus => console.log('Get bonus response:', bonus)),
      catchError(this.handleError)
    );
  }

  /**
   * Create a new bonus
   */
// In your bonus.service.ts
createBonus(bonusData: CreateBonusRequest): Observable<Bonus> {
    // Convert dates to ISO string format
    const payload = {
        ...bonusData,
        startDate: bonusData.startDate ? new Date(bonusData.startDate).toISOString() : null,
        endDate: bonusData.endDate ? new Date(bonusData.endDate).toISOString() : null
    };
    
    return this.http.post<BonusResponse>(this.apiUrl, payload, {
        headers: this.createHeaders(),
        withCredentials: true
    }).pipe(
        map(response => this.parseBonusDates(response.data))
    );
}

  /**
   * Update bonus
   */
  updateBonus(bonusId: string, bonusData: UpdateBonusRequest): Observable<Bonus> {
    return this.http.put<BonusResponse>(`${this.apiUrl}/${bonusId}`, bonusData, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.parseBonusDates(response.data);
        }
        throw new Error(response.message || 'Failed to update bonus');
      }),
      tap(bonus => console.log('Update bonus response:', bonus)),
      catchError(this.handleError)
    );
  }

  // =============================================================================
  // BONUS STATUS OPERATIONS
  // =============================================================================

  /**
   * Approve bonus (for admin)
   */
  approveBonus(bonusId: string): Observable<Bonus> {
    return this.http.patch<BonusResponse>(`${this.apiUrl}/${bonusId}/approve`, {}, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.parseBonusDates(response.data);
        }
        throw new Error(response.message || 'Failed to approve bonus');
      }),
      tap(bonus => console.log('Approve bonus response:', bonus)),
      catchError(this.handleError)
    );
  }

  /**
   * Reject bonus (for admin)
   */
  rejectBonus(bonusId: string, reason: string): Observable<Bonus> {
    return this.http.patch<BonusResponse>(`${this.apiUrl}/${bonusId}/reject`, 
      { reason }, 
      {
        headers: this.createHeaders(),
        withCredentials: true
      }
    ).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.parseBonusDates(response.data);
        }
        throw new Error(response.message || 'Failed to reject bonus');
      }),
      tap(bonus => console.log('Reject bonus response:', bonus)),
      catchError(this.handleError)
    );
  }

  /**
   * Pay bonus (for admin)
   */
  payBonus(bonusId: string): Observable<Bonus> {
    return this.http.patch<BonusResponse>(`${this.apiUrl}/${bonusId}/pay`, {}, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.parseBonusDates(response.data);
        }
        throw new Error(response.message || 'Failed to pay bonus');
      }),
      tap(bonus => console.log('Pay bonus response:', bonus)),
      catchError(this.handleError)
    );
  }

  /**
   * Cancel bonus
   */
  cancelBonus(bonusId: string): Observable<Bonus> {
    return this.http.patch<BonusResponse>(`${this.apiUrl}/${bonusId}/cancel`, {}, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.parseBonusDates(response.data);
        }
        throw new Error(response.message || 'Failed to cancel bonus');
      }),
      tap(bonus => console.log('Cancel bonus response:', bonus)),
      catchError(this.handleError)
    );
  }

  /**
   * Update bonus status directly
   */
  updateBonusStatus(bonusId: string, status: BonusStatus): Observable<Bonus> {
    return this.http.patch<BonusResponse>(`${this.apiUrl}/${bonusId}/status`, 
      { status }, 
      {
        headers: this.createHeaders(),
        withCredentials: true
      }
    ).pipe(
      map(response => {
        if (response.success && response.data) {
          return this.parseBonusDates(response.data);
        }
        throw new Error(response.message || 'Failed to update bonus status');
      }),
      tap(bonus => console.log('Update bonus status response:', bonus)),
      catchError(this.handleError)
    );
  }

  // =============================================================================
  // DELIVERY PERSON SPECIFIC OPERATIONS
  // =============================================================================

  /**
   * Get delivery person bonuses
   */
getDeliveryPersonBonuses(userId: string): Observable<Bonus[]> {
  return this.http.get<BonusListResponse>(
    `${this.apiUrl}/delivery-person/${userId}`,
    {
      headers: this.createHeaders(),
      withCredentials: true
    }
  ).pipe(
    map(response => (response.data || []).map(bonus => this.parseBonusDates(bonus))),
    catchError(this.handleError)
  );
}

  /**
   * Get bonus history for a delivery person
   */
  getBonusHistory(deliveryPersonId: string, limit?: number): Observable<Bonus[]> {
    const params = limit ? new HttpParams().set('limit', limit.toString()) : new HttpParams();

    return this.http.get<BonusListResponse>(`${this.apiUrl}/delivery-person/${deliveryPersonId}/history`, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      map(response => (response.data || response.bonuses || []).map(bonus => this.parseBonusDates(bonus))),
      tap(bonuses => console.log('Get bonus history:', bonuses)),
      catchError(this.handleError)
    );
  }

  /**
   * Calculate potential bonus for delivery person
   */
  calculatePotentialBonus(deliveryPersonId: string): Observable<{ 
    success: boolean; 
    potentialBonus: number; 
    criteria: any; 
  }> {
    return this.http.get<{ 
      success: boolean; 
      potentialBonus: number; 
      criteria: any; 
    }>(`${this.apiUrl}/delivery-person/${deliveryPersonId}/potential`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      tap(response => console.log('Calculate potential bonus response:', response)),
      catchError(this.handleError)
    );
  }

  // =============================================================================
  // FILTERING AND SEARCHING
  // =============================================================================

  /**
   * Get bonuses by status
   */
  getBonusesByStatus(status: BonusStatus): Observable<Bonus[]> {
    const params = new HttpParams().set('status', status);

    return this.http.get<BonusListResponse>(`${this.apiUrl}/status/${status}`, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      map(response => (response.data || response.bonuses || []).map(bonus => this.parseBonusDates(bonus))),
      tap(bonuses => console.log(`Get ${status} bonuses:`, bonuses)),
      catchError(this.handleError)
    );
  }

  /**
   * Get pending bonuses
   */
  getPendingBonuses(): Observable<Bonus[]> {
    return this.getBonusesByStatus(BonusStatus.PENDING);
  }

  /**
   * Get approved bonuses
   */
  getApprovedBonuses(): Observable<Bonus[]> {
    return this.getBonusesByStatus(BonusStatus.APPROVED);
  }

  /**
   * Get paid bonuses
   */
  getPaidBonuses(): Observable<Bonus[]> {
    return this.getBonusesByStatus(BonusStatus.PAID);
  }

  /**
   * Get rejected bonuses
   */
  getRejectedBonuses(): Observable<Bonus[]> {
    return this.getBonusesByStatus(BonusStatus.REJECTED);
  }

  /**
   * Search bonuses with filters
   */
  searchBonuses(filter: BonusFilter): Observable<Bonus[]> {
    const params = this.buildHttpParams(filter);

    return this.http.get<BonusListResponse>(`${this.apiUrl}/search`, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      map(response => (response.data || response.bonuses || []).map(bonus => this.parseBonusDates(bonus))),
      tap(bonuses => console.log('Search bonuses:', bonuses)),
      catchError(this.handleError)
    );
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Bulk approve bonuses
   */
  bulkApproveBonuses(bonusIds: string[]): Observable<BulkOperationResponse> {
    return this.http.post<BulkOperationResponse>(
      `${this.apiUrl}/bulk/approve`,
      { bonusIds },
      {
        headers: this.createHeaders(),
        withCredentials: true
      }
    ).pipe(
      tap(response => console.log('Bulk approve bonuses response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Bulk pay bonuses
   */
  bulkPayBonuses(bonusIds: string[]): Observable<BulkOperationResponse> {
    return this.http.post<BulkOperationResponse>(
      `${this.apiUrl}/bulk/pay`,
      { bonusIds },
      {
        headers: this.createHeaders(),
        withCredentials: true
      }
    ).pipe(
      tap(response => console.log('Bulk pay bonuses response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Bulk reject bonuses
   */
  bulkRejectBonuses(bonusIds: string[], reason: string): Observable<BulkOperationResponse> {
    return this.http.post<BulkOperationResponse>(
      `${this.apiUrl}/bulk/reject`,
      { bonusIds, reason },
      {
        headers: this.createHeaders(),
        withCredentials: true
      }
    ).pipe(
      tap(response => console.log('Bulk reject bonuses response:', response)),
      catchError(this.handleError)
    );
  }

  // =============================================================================
  // STATISTICS AND SUMMARY
  // =============================================================================

  /**
   * Get delivery statistics
   */
  getDeliveryStats(deliveryPersonId: string): Observable<{
    weeklyDeliveries: number;
    monthlyDeliveries: number;
    totalEarnings: number;
    pendingBonuses: number;
    totalBonuses?: number;
    paidBonuses?: number;
    approvedBonuses?: number;
    rejectedBonuses?: number;
  }> {
    const params = new HttpParams().set('deliveryPersonId', deliveryPersonId);

    return this.http.get<DeliveryStatsResponse>(`${environment.apiUrl}/api/deliveries/stats`, {
      params,
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      map(response => response.data),
      tap(stats => console.log('Get delivery stats:', stats)),
      catchError(this.handleError)
    );
  }

  /**
   * Get bonus statistics
   */
  getBonusStats(): Observable<{
    totalBonuses: number;
    totalAmount: number;
    statusBreakdown: { [key in BonusStatus]: number };
    monthlyBreakdown: { [key: string]: number };
    deliveryPersonBreakdown: { [key: string]: number };
  }> {
    return this.http.get<BonusStatsResponse>(`${this.apiUrl}/stats`, {
      headers: this.createHeaders(),
      withCredentials: true
    }).pipe(
      retry(2),
      map(response => response.data),
      tap(stats => console.log('Get bonus stats:', stats)),
      catchError(this.handleError)
    );
  }

  /**
   * Get bonus summary
   */
getBonusSummary(): Observable<BonusSummary> {
  return this.http.get<{ success: boolean; data: BonusSummary }>(`${this.apiUrl}/summary`, {
    headers: this.createHeaders(),
    withCredentials: true
  }).pipe(
    retry(2),
    map(response => response.data),
    tap(summary => console.log('Bonus summary:', summary)),
    catchError(this.handleError)
  );
}

getDeliveryPersonBonusSummary(userId: string): Observable<any> {
  return this.http.get<{ success: boolean; data: any }>(
    `${this.apiUrl}/delivery-person/${userId}/stats`,
    {
      headers: this.createHeaders(),
      withCredentials: true
    }
  ).pipe(
    map(response => response.data),
    catchError(this.handleError)
  );
}
  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Refresh dashboard data
   */
  refreshDashboardData(): void {
    if (this.router) {
      this.router.navigate([], {
        queryParams: { refresh: Date.now().toString() },
        queryParamsHandling: 'merge'
      });
    }
  }

  /**
   * Enhanced error handling
   */
  private handleError = (error: HttpErrorResponse) => {
    console.error('Bonus service error:', error);
    
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
            errorMessage = 'بيانات المكافأة غير صالحة / Invalid bonus data provided';
            break;
          case 401:
            errorMessage = 'يجب تسجيل الدخول مرة أخرى / Authentication required. Please log in again.';
            break;
          case 403:
            errorMessage = 'غير مسموح لك بتنفيذ هذا الإجراء / Access denied. You do not have permission to perform this action.';
            break;
          case 404:
            errorMessage = 'المكافأة غير موجودة / Bonus not found';
            break;
          case 409:
            errorMessage = 'تعارض في المكافأة. قد تكون معالجة بالفعل / Bonus conflict. This bonus may have already been processed.';
            break;
          case 422:
            errorMessage = 'بيانات المكافأة غير صالحة. يرجى التحقق من المدخلات / Invalid bonus data. Please check your input.';
            break;
          case 500:
            errorMessage = 'معالجة المكافآت غير متاحة مؤقتاً. يرجى المحاولة لاحقاً / Bonus processing temporarily unavailable. Please try again later.';
            break;
          case 502:
            errorMessage = 'خطأ في بوابة خدمة المكافآت. يرجى المحاولة مرة أخرى / Bonus service gateway error. Please try again.';
            break;
          case 503:
            errorMessage = 'خدمة المكافآت غير متاحة مؤقتاً. يرجى المحاولة لاحقاً / Bonus service temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage = `فشل في عملية المكافأة مع الحالة ${error.status}. يرجى المحاولة مرة أخرى / Bonus operation failed with status ${error.status}. Please try again.`;
        }
      }
    }
    
    return throwError(() => new Error(errorMessage));
  };


  getBonusSummaryForUser(userId: string): Observable<BonusSummary> {
  const params = new HttpParams().set('userId', userId);
  return this.http.get<{ success: boolean; data: BonusSummary }>(
    `${this.apiUrl}/summary/user`,
    { params, headers: this.createHeaders(), withCredentials: true }
  ).pipe(
    map(response => response.data),
    catchError(this.handleError)
  );
}
getDeliveryPersonSummary(userId: string): Observable<any> {
  return this.http.get<BonusSummary>(`${this.apiUrl}/delivery-person/${userId}/summary`, {
    headers: this.createHeaders(),
    withCredentials: true
  }).pipe(
    catchError(this.handleError)
  );
}

}