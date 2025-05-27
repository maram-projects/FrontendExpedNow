import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private apiUrl = `${environment.apiUrl}/api/pricing`;

  constructor(private http: HttpClient) { }

  // pricing.service.ts
calculatePricing(deliveryRequest: any): Observable<any> {
  // إنشاء كائن جديد بدون الحقول غير الضرورية
  const requestData = {
    pickupAddress: deliveryRequest.pickupAddress,
    deliveryAddress: deliveryRequest.deliveryAddress,
    packageDescription: deliveryRequest.packageDescription,
    packageWeight: deliveryRequest.packageWeight,
    vehicleId: deliveryRequest.vehicleId,
    scheduledDate: deliveryRequest.scheduledDate,
    packageType: deliveryRequest.packageType,
    additionalInstructions: deliveryRequest.additionalInstructions,
    pickupLatitude: deliveryRequest.pickupLatitude,
    pickupLongitude: deliveryRequest.pickupLongitude,
    deliveryLatitude: deliveryRequest.deliveryLatitude,
    deliveryLongitude: deliveryRequest.deliveryLongitude,
    clientId: deliveryRequest.clientId
  };

  return this.http.post(`${this.apiUrl}/calculate`, requestData).pipe(
    catchError((error: any) => {
      console.error('Pricing calculation error:', error);
      return throwError(() => {
        // تحسين رسالة الخطأ
        const errorMsg = error.error?.message || 
                       error.message || 
                       'فشل في حساب السعر. يرجى التحقق من البيانات والمحاولة لاحقاً';
        return new Error(errorMsg);
      });
    })
  );
}
}