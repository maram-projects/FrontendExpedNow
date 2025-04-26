import { Component, OnInit } from '@angular/core';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-delivery-dashboard',
  standalone: true, // إذا كنت تستخدم standalone components
  imports: [CommonModule], // أضف هذا السطر
  templateUrl: './delivery-dashboard.component.html',
  styleUrls: ['./delivery-dashboard.component.css']
})
export class DeliveryDashboardComponent implements OnInit {
  assignedDeliveries: DeliveryRequest[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
  
  // مجموعة لتتبع معرفات الطلبات قيد المعالجة
  processingItems: Set<string> = new Set<string>();

  constructor(private deliveryService: DeliveryService) {}

  ngOnInit(): void {
    this.loadAssignedDeliveries();
  }

  loadAssignedDeliveries(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.processingItems.clear();

    this.deliveryService.getAssignedPendingDeliveries().subscribe({
      next: (deliveries) => {
        this.assignedDeliveries = deliveries;
        this.isLoading = false;
        console.log('Deliveries loaded successfully:', deliveries);
      },
      error: (err) => {
        this.errorMessage = 'Failed to load deliveries. Please try again later.';
        this.isLoading = false;
        console.error('Error loading deliveries:', err);
      }
    });
  }

  // التحقق مما إذا كان العنصر قيد المعالجة
  isProcessing(deliveryId: string): boolean {
    return this.processingItems.has(deliveryId);
  }

  acceptDelivery(deliveryId: string): void {
    // منع النقر المتكرر إذا كانت المعالجة جارية
    if (this.isProcessing(deliveryId)) {
      return;
    }
    
    this.processingItems.add(deliveryId);
    
    this.deliveryService.acceptDelivery(deliveryId).subscribe({
      next: () => {
        this.successMessage = 'Delivery accepted successfully!';
        console.log('Delivery accepted successfully');
        this.loadAssignedDeliveries();
      },
      error: (err) => {
        this.errorMessage = 'Failed to accept delivery. Please try again.';
        console.error('Error accepting delivery:', err);
        this.processingItems.delete(deliveryId);
      }
    });
  }

  rejectDelivery(deliveryId: string): void {
    // منع النقر المتكرر إذا كانت المعالجة جارية
    if (this.isProcessing(deliveryId)) {
      return;
    }
    
    this.processingItems.add(deliveryId);
    
    this.deliveryService.rejectDelivery(deliveryId).subscribe({
      next: () => {
        this.successMessage = 'Delivery rejected successfully!';
        console.log('Delivery rejected successfully');
        this.loadAssignedDeliveries();
      },
      error: (err) => {
        this.errorMessage = 'Failed to reject delivery. Please try again.';
        console.error('Error rejecting delivery:', err);
        this.processingItems.delete(deliveryId);
      }
    });
  }
  
  // دالة مساعدة لتقصير معرف التوصيل
  shortenId(id: string): string {
    return id.substring(0, 8);
  }
  
  // مسح رسائل النجاح
  clearSuccessMessage(): void {
    this.successMessage = '';
  }
  
  // مسح رسائل الخطأ
  clearErrorMessage(): void {
    this.errorMessage = '';
  }
}