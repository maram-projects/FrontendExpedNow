// payment.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Payment, PaymentMethod, PaymentMethodOption } from '../models/Payment.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = `${environment.apiUrl}/api/payments`;

  constructor(private http: HttpClient) {}

  // إنشاء عملية دفع جديدة
  createPayment(paymentData: {
    deliveryId: string;
    amount: number;
    method: PaymentMethod;
    clientId: string;
  }): Observable<Payment> {
    return this.http.post<Payment>(this.apiUrl, paymentData);
  }

  // معالجة الدفع
  processPayment(paymentId: string, cardDetails?: any, discountCode?: string): Observable<Payment> {
    let url = `${this.apiUrl}/${paymentId}/process`;
    const params: any = {};
    
    if (discountCode) {
      params.discountCode = discountCode;
    }
    
    return this.http.post<Payment>(url, cardDetails || {}, { params });
  }

  // الحصول على تفاصيل الدفع
  getPayment(paymentId: string): Observable<Payment> {
    return this.http.get<Payment>(`${this.apiUrl}/${paymentId}`);
  }

  // الحصول على جميع عمليات الدفع (للمسؤول)
  getAllPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(this.apiUrl);
  }

  // استرجاع المبلغ
  refundPayment(paymentId: string, amount?: number): Observable<Payment> {
    const params: any = {};
    if (amount) {
      params.amount = amount.toString();
    }
    return this.http.post<Payment>(`${this.apiUrl}/${paymentId}/refund`, {}, { params });
  }

  // الحصول على طرق الدفع المتاحة
  getAvailablePaymentMethods(): PaymentMethodOption[] {
    return [
      { 
        id: PaymentMethod.CREDIT_CARD, 
        name: 'بطاقة ائتمان', 
        icon: 'credit_card',
        description: 'الدفع الآمن عبر البطاقة الائتمانية',
        available: true
      },
      { 
        id: PaymentMethod.BANK_TRANSFER, 
        name: 'تحويل بنكي', 
        icon: 'account_balance',
        description: 'تحويل مباشر من حسابك البنكي',
        available: true
      },
      { 
        id: PaymentMethod.CASH, 
        name: 'نقدي عند الاستلام', 
        icon: 'money',
        description: 'الدفع عند استلام الطلب',
        available: true
      },
      { 
        id: PaymentMethod.WALLET, 
        name: 'المحفظة الإلكترونية', 
        icon: 'account_balance_wallet',
        description: 'الدفع من رصيدك في المحفظة',
        available: false // حاليًا غير متاح
      }
    ].filter(method => method.available);
  }
}