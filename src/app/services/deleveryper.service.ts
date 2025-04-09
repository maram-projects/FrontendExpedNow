import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { filter, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { WebSocketService } from './web-socket.service';

export interface DeliveryRequest {
  id?: string;
  customerId: string;
  pickupAddress: string;
  deliveryAddress: string;
  packageDescription: string;
  packageWeight: number;
  deliveryPersonId?: string;
  status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  scheduledDate: Date;
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root'
})
export class DeleveryperService {

  // Fixed: Remove the duplicated /api prefix
  private apiUrl = `${environment.apiUrl}/deliveriesperson`;

  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService,
    private authService: AuthService
  ) {}

  // Get all deliveries assigned to the current delivery person
  getAssignedDeliveries(): Observable<DeliveryRequest[]> {
    const url = `${this.apiUrl}/my-deliveries`;
    console.log('Requesting URL:', url);
    return this.http.get<DeliveryRequest[]>(url);
  }

  // Update the status of a delivery
  updateDeliveryStatus(deliveryId: string, status: string): Observable<DeliveryRequest> {
    return this.http.put<DeliveryRequest>(
      `${this.apiUrl}/${deliveryId}/status`,
      { status }
    );
  }

  // Update the delivery person's location
  updateLocation(latitude: number, longitude: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/location`, {
      latitude,
      longitude
    });
  }

  // Update delivery person's availability
  updateAvailability(available: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/availability`, {
      available
    });
  }

  // Get real-time delivery updates via WebSocket
  getRealTimeUpdates(): Observable<any> {
    return this.webSocketService.getNotificationsByType('DELIVERY_UPDATE')
      .pipe(
        map(notification => notification)
      );
  }

  // Listen for new delivery assignments
  getNewAssignments(): Observable<any> {
    return this.webSocketService.getNotificationsByType('DELIVERY_ASSIGNMENT');
  }

 
}