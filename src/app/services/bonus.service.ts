// bonus.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Bonus, BonusStatus } from '../models/bonus.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class BonusService {
  private apiUrl = `${environment.apiUrl}/api/bonuses`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // الحصول على مكافآت الموصل
  getDeliveryPersonBonuses(deliveryPersonId: string): Observable<Bonus[]> {
    return this.http.get<Bonus[]>(`${this.apiUrl}/delivery-person/${deliveryPersonId}`);
  }

  // الحصول على إحصائيات التوصيل
  getDeliveryStats(deliveryPersonId: string): Observable<{
    weeklyDeliveries: number;
    monthlyDeliveries: number;
    totalEarnings: number;
    pendingBonuses: number;
  }> {
    return this.http.get<{
      weeklyDeliveries: number;
      monthlyDeliveries: number;
      totalEarnings: number;
      pendingBonuses: number;
    }>(`${environment.apiUrl}/api/deliveries/stats`, {
      params: { deliveryPersonId }
    });
  }

  // الموافقة على المكافأة (للمسؤول)
  approveBonus(bonusId: string): Observable<Bonus> {
    return this.http.patch<Bonus>(`${this.apiUrl}/${bonusId}/approve`, {});
  }

  // دفع المكافأة (للمسؤول)
  payBonus(bonusId: string): Observable<Bonus> {
    return this.http.patch<Bonus>(`${this.apiUrl}/${bonusId}/pay`, {});
  }

  // الحصول على جميع المكافآت (للمسؤول)
  getAllBonuses(): Observable<Bonus[]> {
    return this.http.get<Bonus[]>(this.apiUrl);
  }
}