// src/app/services/discount.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { 
  Discount, 
  CreateDiscountRequest, 
  ValidateDiscountRequest, 
  UseDiscountRequest 
} from '../models/discount.model';

@Injectable({
  providedIn: 'root'
})
export class DiscountService {
  private readonly API_URL = 'http://localhost:8080/api/discounts';
  
  // Observable pour suivre les changements de discounts
  private discountsSubject = new BehaviorSubject<Discount[]>([]);
  public discounts$ = this.discountsSubject.asObservable();
  
  private clientDiscountsSubject = new BehaviorSubject<Discount[]>([]);
  public clientDiscounts$ = this.clientDiscountsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Récupérer tous les discounts
   */
  getAllDiscounts(): Observable<Discount[]> {
    return this.http.get<Discount[]>(`${this.API_URL}`)
      .pipe(
        tap(discounts => {
          console.log('Fetched all discounts:', discounts);
          this.discountsSubject.next(discounts);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Récupérer les discounts actifs d'un client
   */
  getClientDiscounts(clientId: string): Observable<Discount[]> {
    console.log('Fetching discounts for client:', clientId);
    
    return this.http.get<Discount[]>(`${this.API_URL}/client/${clientId}`)
      .pipe(
        tap(discounts => {
          console.log('Fetched client discounts:', discounts);
          this.clientDiscountsSubject.next(discounts);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Créer un nouveau discount
   */
createDiscount(discountRequest: CreateDiscountRequest): Observable<Discount> {
    // Convert dates to ISO string without milliseconds
    const formatDate = (date?: Date): string | undefined => {
        if (!date) return undefined;
        return date.toISOString().split('.')[0] + 'Z'; // Remove milliseconds
    };

    const requestBody = {
        ...discountRequest,
        validFrom: formatDate(discountRequest.validFrom),
        validUntil: formatDate(discountRequest.validUntil)
    };

    return this.http.post<Discount>(`${this.API_URL}`, requestBody)
        .pipe(
            tap(discount => {
                console.log('Created discount:', discount);
                this.refreshAllDiscounts();
            }),
            catchError(this.handleError)
        );
}
  /**
   * Valider un code de discount
   */
  validateDiscount(code: string, clientId: string): Observable<Discount> {
    const params = new HttpParams()
      .set('code', code)
      .set('clientId', clientId);

    return this.http.post<Discount>(`${this.API_URL}/validate`, null, { params })
      .pipe(
        tap(discount => {
          console.log('Validated discount:', discount);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Utiliser un discount
   */
  useDiscount(code: string, clientId: string, orderId: string): Observable<Discount> {
    const params = new HttpParams()
      .set('code', code)
      .set('clientId', clientId)
      .set('orderId', orderId);

    return this.http.post<Discount>(`${this.API_URL}/use`, null, { params })
      .pipe(
        tap(discount => {
          console.log('Used discount:', discount);
          // Refresh les discounts du client après utilisation
          this.refreshClientDiscounts(clientId);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Supprimer un discount
   */
  deleteDiscount(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`)
      .pipe(
        tap(() => {
          console.log('Deleted discount:', id);
          // Refresh la liste des discounts
          this.refreshAllDiscounts();
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Calculer le montant de la réduction
   */
  calculateDiscountAmount(discount: Discount, orderAmount: number): number {
    if (!discount) return 0;

    switch (discount.type) {
      case 'PERCENTAGE':
        return (orderAmount * (discount.percentage || 0)) / 100;
      case 'FIXED_AMOUNT':
        return Math.min(discount.fixedAmount || 0, orderAmount);
      default:
        return 0;
    }
  }

  /**
   * Vérifier si un discount est encore valide
   */
  isDiscountValid(discount: Discount): boolean {
    if (!discount) return false;
    
    const now = new Date();
    const validUntil = discount.validUntil ? new Date(discount.validUntil) : null;
    const validFrom = discount.validFrom ? new Date(discount.validFrom) : null;
    
    // Vérifier si le discount n'est pas utilisé
    if (discount.used) return false;
    
    // Vérifier les dates de validité
    if (validFrom && now < validFrom) return false;
    if (validUntil && now > validUntil) return false;
    
    return true;
  }

  /**
   * Filtrer les discounts valides pour un client
   */
  getValidDiscountsForClient(clientId: string): Observable<Discount[]> {
    return this.getClientDiscounts(clientId)
      .pipe(
        tap(discounts => {
          const validDiscounts = discounts.filter(discount => this.isDiscountValid(discount));
          console.log('Valid discounts for client:', validDiscounts);
        })
      );
  }

  /**
   * Formater le discount pour l'affichage
   */
/**
 * Formater le discount pour l'affichage
 */
formatDiscountValue(discount: Discount): string {
  if (!discount) return '';

  switch (discount.type) {
    case 'PERCENTAGE':
      return `${discount.percentage}%`;
    case 'FIXED_AMOUNT':
      return `${discount.fixedAmount} DT`;
    case 'LOYALTY':
      return `${discount.percentage}% (Fidélité)`;
    case 'PROMOTIONAL':
      // Fix: Check if the promotional discount has a percentage or fixed amount
      if (discount.percentage) {
        return `${discount.percentage}% (Promo)`;
      } else if (discount.fixedAmount) {
        return `${discount.fixedAmount} DT (Promo)`;
      } else {
        return 'Promo';
      }
    default:
      return 'Discount';
  }
}

  /**
   * Méthodes utilitaires privées
   */
  private refreshAllDiscounts(): void {
    this.getAllDiscounts().subscribe();
  }

  private refreshClientDiscounts(clientId: string): void {
    this.getClientDiscounts(clientId).subscribe();
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Discount service error:', error);
    
    let errorMessage = 'Une erreur est survenue';
    
    if (error.error && typeof error.error === 'string') {
      errorMessage = error.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Traduire les messages d'erreur du backend
    switch (errorMessage) {
      case 'كود الخصم غير صالح':
        errorMessage = 'Code de réduction invalide';
        break;
      case 'هذا الكود غير مخصص لك':
        errorMessage = 'Ce code ne vous est pas destiné';
        break;
      case 'تم استخدام هذا الكود مسبقاً':
        errorMessage = 'Ce code a déjà été utilisé';
        break;
      case 'انتهت صلاحية هذا الكود':
        errorMessage = 'Ce code a expiré';
        break;
    }
    
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Méthodes pour la gestion des observables
   */
  getCurrentDiscounts(): Discount[] {
    return this.discountsSubject.getValue();
  }

  getCurrentClientDiscounts(): Discount[] {
    return this.clientDiscountsSubject.getValue();
  }

  /**
   * Nettoyer les observables
   */
  clearDiscounts(): void {
    this.discountsSubject.next([]);
    this.clientDiscountsSubject.next([]);
  }
}