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
  processPayment(paymentId: string, method: PaymentMethod, details: any): Observable<Payment> {
    if (method === PaymentMethod.CREDIT_CARD) {
      return this.processCreditCardPayment(paymentId, details);
    }
    return this.http.post<Payment>(`${this.apiUrl}/${paymentId}/process`, { method, ...details });
  }

  private processCreditCardPayment(paymentId: string, cardDetails: any): Observable<Payment> {
    // في الواقع يجب استخدام Stripe Elements أو بوابة دفع آمنة
    // هذا مثال فقط للتوضيح
    const paymentData = {
      cardNumber: cardDetails.number,
      expiry: cardDetails.expiry,
      cvv: cardDetails.cvv,
      name: cardDetails.name
    };
    return this.http.post<Payment>(`${this.apiUrl}/${paymentId}/process-card`, paymentData);
  }

  getPayment(paymentId: string): Observable<Payment> {
    return this.http.get<Payment>(`${this.apiUrl}/${paymentId}`);
  }

  getAllPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(this.apiUrl);
  }

  refundPayment(paymentId: string, amount?: number): Observable<Payment> {
    const params: any = {};
    if (amount) params.amount = amount.toString();
    return this.http.post<Payment>(`${this.apiUrl}/${paymentId}/refund`, {}, { params });
  }

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
      }
    ].filter(method => method.available);
  }
}