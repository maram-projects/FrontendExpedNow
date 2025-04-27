import { Component, OnInit } from '@angular/core';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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


  constructor(private deliveryService: DeliveryService,private router: Router) {}

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
    if (this.isProcessing(deliveryId)) return;
    
    this.processingItems.add(deliveryId);
    
    this.deliveryService.acceptDelivery(deliveryId).subscribe({
        next: (response: any) => {
            console.log('API response:', response);
            this.successMessage = 'تم قبول التسليم وإنشاء المهمة بنجاح';
            setTimeout(() => {
                this.router.navigate(['/delivery/missions']);
            }, 1500);
        },
        error: (err) => {
            console.error('API error:', err);
            this.errorMessage = err.message || 'فشل في قبول التسليم';
            if (err.status === 400) {
                this.errorMessage = 'حالة الطلب غير صالحة للقبول';
            }
        },
        complete: () => {
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