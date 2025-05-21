// discount.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Discount, DiscountType } from '../models/discount.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DiscountService {
  private apiUrl = `${environment.apiUrl}/api/discounts`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // الحصول على الخصومات المتاحة للعميل
  getClientDiscounts(clientId: string) {
    return this.http.get<Discount[]>(`${this.apiUrl}/client/${clientId}`).pipe(
      catchError((err: any) => {
        console.error('Discount error details:', err);
        throw err;
      })
    );
  }
// حذف الخصم (للمسؤول)
deleteDiscount(discountId: string): Observable<void> {
  return this.http.delete<void>(`${this.apiUrl}/${discountId}`);
}
  // التحقق من صحة كود الخصم
  validateDiscount(code: string, clientId: string): Observable<Discount> {
    return this.http.post<Discount>(`${this.apiUrl}/validate`, { code, clientId }); // ✅
  }

  // استخدام الخصم
  useDiscount(code: string, clientId: string, orderId: string): Observable<Discount> {
    return this.http.post<Discount>(`${this.apiUrl}/use`, { code, clientId, orderId }); // ✅
  }

  // إنشاء خصم جديد (للمسؤول)
  createDiscount(discountData: {
    clientId: string;
    percentage: number;
    validUntil: Date;
    type: DiscountType;
    description: string;
  }): Observable<Discount> {
    const payload = {
      ...discountData,
      validUntil: this.formatDate(discountData.validUntil)
    };
    return this.http.post<Discount>(this.apiUrl, payload);
  }

 // discount.service.ts
private formatDate(date: Date | string): string {
  // Convert to Date object if it's a string
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Format with time component
  return new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    dateObj.getHours(),
    dateObj.getMinutes()
  ).toISOString().slice(0, 16) + ':00';
}

  // الحصول على جميع الخصومات (للمسؤول)
  getAllDiscounts(): Observable<Discount[]> {
    return this.http.get<Discount[]>(this.apiUrl);
  }
}