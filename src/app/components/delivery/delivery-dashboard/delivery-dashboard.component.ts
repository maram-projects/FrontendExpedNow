import { Component, OnInit } from '@angular/core';
import { DeliveryRequest, DeliveryService } from '../../../services/delivery-service.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-delivery-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delivery-dashboard.component.html',
  styleUrls: ['./delivery-dashboard.component.css']
})
export class DeliveryDashboardComponent implements OnInit {
  assignedDeliveries: DeliveryRequest[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';
  successMessage: string = '';
  debugMode: boolean = false; // Toggle for showing debug info
  allDeliveries: DeliveryRequest[] = []; // For debugging
  
  // Set to track delivery IDs that are being processed
  processingItems: Set<string> = new Set<string>();

  // Add access to authService for the template
  constructor(
    public deliveryService: DeliveryService, // Changed to public for template access
    private router: Router,
    public authService: AuthService // Inject and expose AuthService
  ) {}

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

  // Check if the item is being processed
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
    // Prevent repeated clicks while processing
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
  
  // Helper function to shorten delivery ID
  shortenId(id: string): string {
    return id.substring(0, 8);
  }
  
  // Clear success messages
  clearSuccessMessage(): void {
    this.successMessage = '';
  }
  
  // Clear error messages
  clearErrorMessage(): void {
    this.errorMessage = '';
  }

  // Method to toggle debug mode
  toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    if (this.debugMode) {
      this.loadAllDeliveries();
    }
  }

  // Load all deliveries for debugging
  loadAllDeliveries(): void {
    this.deliveryService.getAllDeliveries().subscribe({
      next: (deliveries) => {
        this.allDeliveries = deliveries;
        console.log('All deliveries loaded:', deliveries.length);
      },
      error: (err) => {
        console.error('Failed to load all deliveries:', err);
      }
    });
  }

  // Check if there are deliveries in the system that could be assigned
  checkAvailableDeliveries(): void {
    this.deliveryService.getPendingDeliveriesUnassigned().subscribe({
      next: (deliveries) => {
        if (deliveries && deliveries.length > 0) {
          this.successMessage = `There are ${deliveries.length} unassigned deliveries available in the system.`;
        } else {
          this.successMessage = 'There are no unassigned deliveries available at the moment.';
        }
      },
      error: (err) => {
        this.errorMessage = 'Failed to check for available deliveries.';
        console.error('Error checking available deliveries:', err);
      }
    });
  }

  // Method to manually refresh assignments
  refreshAssignments(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = 'Refreshing assignments...';
    
    this.loadAssignedDeliveries();
  }

  // Check delivery person status
  checkDeliveryPersonStatus(): void {
    this.deliveryService.checkDeliveryPersonStatus().subscribe({
      next: (status) => {
        this.successMessage = `Your current status: ${JSON.stringify(status)}`;
      },
      error: (err) => {
        this.errorMessage = 'Failed to check your delivery person status.';
        console.error('Error checking status:', err);
      }
    });
  }
  
  // Helper methods to expose user data to the template
  getCurrentUserId(): string | undefined {
    return this.authService.getCurrentUser()?.userId;
  }
  
  getCurrentUserRole(): string | undefined {
    return this.authService.getCurrentUser()?.userType;
  }
}