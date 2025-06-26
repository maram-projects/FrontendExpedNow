import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, CurrencyPipe, CommonModule } from '@angular/common';
import { Subject, takeUntil, finalize, catchError, of, retry, delay } from 'rxjs';
import { DeliveryRequest, DeliveryService, DeliveryWithAssignedPersonResponse, PaymentStatus } from '../../../services/delivery-service.service';
import { PaymentService, PaymentResponse } from '../../../services/payment.service'; // Add this import
import { environment } from '../../../../environments/environment';
import { MapService } from '../../../services/map.service';
import { latLng } from 'leaflet';
import { UserService } from '../../../services/user.service';

interface StatusConfig {
  class: string;
  icon: string;
  label: string;
  color: string;
}

interface PaymentMethodConfig {
  icon: string;
  label: string;
}

@Component({
  selector: 'app-delivery-details',
  templateUrl: './delivery-details.component.html',
  styleUrls: ['./delivery-details.component.css'],
  providers: [DatePipe, CurrencyPipe],
  standalone: true,
  imports: [CommonModule]
})
export class DeliveryDetailsComponent implements OnInit, OnDestroy {

private readonly userService = inject(UserService);

  isLoadingPerson = false;
personError: string | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly deliveryService = inject(DeliveryService);
  private readonly paymentService = inject(PaymentService); // Add this injection
  private readonly datePipe = inject(DatePipe);
  private readonly currencyPipe = inject(CurrencyPipe);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly mapService = inject(MapService);

  mapInitialized = false;
  mapError = false;
  mapErrorMessage = '';
  isDownloadingMap = false;

  routeInfo: { distance: string; duration: string } | null = null;
  currentMapType: 'roadmap' | 'satellite' = 'roadmap';

  get packageType(): string {
    return this.delivery?.packageType || 'Standard';
  }

  get packageDimensions(): string {
    return '30x20x15 cm';
  }

  get isFragile(): boolean {
    return false;
  }

  get requiresTemperatureControl(): boolean {
    return false;
  }

  // State properties
  deliveryId: string = '';
  delivery: DeliveryRequest | null = null;
  assignedPerson: any = null;
  isLoading = true;
  errorMessage = '';
  isDownloading = false;
  retryCount = 0;
  maxRetryAttempts = 3;

  // Configuration objects
  readonly statusConfig: Record<string, StatusConfig> = {
    PENDING: { class: 'status-pending', icon: 'clock', label: 'Pending', color: '#fbbf24' },
    ASSIGNED: { class: 'status-assigned', icon: 'user-check', label: 'Assigned', color: '#3b82f6' },
    IN_TRANSIT: { class: 'status-transit', icon: 'truck', label: 'In Transit', color: '#8b5cf6' },
    DELIVERED: { class: 'status-delivered', icon: 'check-circle', label: 'Delivered', color: '#10b981' },
    APPROVED: { class: 'status-approved', icon: 'check-double', label: 'Approved', color: '#059669' },
    CANCELLED: { class: 'status-cancelled', icon: 'times-circle', label: 'Cancelled', color: '#ef4444' },
    EXPIRED: { class: 'status-expired', icon: 'hourglass-end', label: 'Expired', color: '#6b7280' }
  };

  readonly paymentMethodConfig: Record<string, PaymentMethodConfig> = {
    CREDIT_CARD: { icon: 'credit-card', label: 'Credit Card' },
    BANK_TRANSFER: { icon: 'bank', label: 'Bank Transfer' },
    WALLET: { icon: 'wallet', label: 'Digital Wallet' },
    CASH: { icon: 'money-bill', label: 'Cash on Delivery' }
  };

readonly paymentStatusConfig: Record<string, StatusConfig> = {
  PENDING: { class: 'payment-pending', icon: 'clock', label: 'Pending', color: '#fbbf24' },
  COMPLETED: { class: 'payment-completed', icon: 'check-circle', label: 'Completed', color: '#10b981' },
  APPROVED: { class: 'payment-approved', icon: 'check-double', label: 'Approved', color: '#059669' },
  FAILED: { class: 'payment-failed', icon: 'times-circle', label: 'Failed', color: '#ef4444' },
  REFUNDED: { class: 'payment-refunded', icon: 'undo', label: 'Refunded', color: '#6b7280' }
};


  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.mapService) {
      this.mapService.destroy();
    }
  }

  private initializeComponent(): void {
    this.deliveryId = this.route.snapshot.paramMap.get('id') || '';
    
    if (!this.deliveryId) {
      this.handleError('Invalid delivery ID provided');
      return;
    }

    this.loadDeliveryDetails();
  }

 loadDeliveryDetails(): void {
  if (this.retryCount >= this.maxRetryAttempts) {
    this.handleError('Maximum retry attempts reached. Please refresh the page.');
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';
  this.retryCount++;

  this.deliveryService.getDeliveryWithAssignedPerson(this.deliveryId)
    .pipe(
      retry(2),
      delay(this.retryCount > 1 ? 1000 : 0),
      takeUntil(this.destroy$),
      catchError((error) => {
        console.error('Error loading delivery details:', error);
        // Check for specific error cases
        if (error.status === 404) {
          this.handleError('Delivery not found');
        } else if (error.status === 403) {
          this.handleError('You do not have permission to view this delivery');
        } else {
          this.handleError('Failed to load delivery details. Please try again.');
        }
        return of(null);
      }),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response: DeliveryWithAssignedPersonResponse | null) => {
        if (response) {
          this.processDeliveryResponse(response);
          this.retryCount = 0;
          
          // If we have a payment ID but no status, force load payment
          if (response.delivery.paymentId && !response.delivery.paymentStatus) {
            this.loadPaymentStatus(response.delivery.paymentId);
          }
        } else {
          this.handleError('Failed to load delivery details. Please try again.');
        }
      },
      error: (err) => {
        console.error('Subscription error:', err);
        this.handleError('An unexpected error occurred while loading delivery details');
      }
    });
}
  
private processDeliveryResponse(response: DeliveryWithAssignedPersonResponse): void {
  try {
    this.delivery = response.delivery;
    
    // Ensure assigned person data is properly handled
    this.assignedPerson = response.assignedDeliveryPerson 
      ? {
          ...response.assignedDeliveryPerson,
          // Map vehicle data if available
          vehicle: response.assignedDeliveryPerson.vehicle 
            ? {
                model: response.assignedDeliveryPerson.vehicle.model || 'Unknown',
                licensePlate: response.assignedDeliveryPerson.vehicle.licensePlate || 'N/A',
                type: response.assignedDeliveryPerson.vehicle.type || 'CAR'
              }
            : null
        }
      : null;
    
    // Debug logs
    console.log('Assigned person data:', this.assignedPerson);
    console.log('Vehicle data:', this.assignedPerson?.vehicle);

    // Fetch payment details if paymentId exists
    if (this.delivery.paymentId) {
      this.loadPaymentStatus(this.delivery.paymentId);
    }

    this.initializeMap();
  } catch (error) {
    console.error('Error processing delivery response:', error);
    this.handleError('Error processing delivery information');
  }
}

private loadPaymentStatus(paymentId: string): void {
  this.paymentService.getPayment(paymentId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: PaymentResponse) => {
        if (response.success && response.data) {
          const payment = response.data;
          
          // Update delivery with comprehensive payment info
          if (this.delivery) {
            this.delivery = {
              ...this.delivery,
              // Fix 1: Convert enum to string for paymentStatus
paymentStatus: payment.status as PaymentStatus,
              paymentMethod: payment.method.toString(),
              // Fix 2: Handle Date type for paymentDate - convert to string if it's a Date
              paymentDate: payment.paymentDate instanceof Date 
                ? payment.paymentDate.toISOString() 
                : payment.paymentDate,
              paymentId: payment.id,
              amount: payment.amount,
              // Fix 3: Use finalAmountAfterDiscount instead of originalAmount
              originalAmount: payment.amount, // Use amount as originalAmount fallback
              discountAmount: payment.discountAmount,
              discountCode: payment.discountCode,
              // Add the finalAmountAfterDiscount property
              finalAmountAfterDiscount: payment.finalAmountAfterDiscount
            };
            
            console.log('Updated payment data:', this.delivery);
          }
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error('Error fetching payment status:', err);
        // Fix 4: Use string literal instead of enum
        if (this.delivery) {
this.delivery.paymentStatus = PaymentStatus.PENDING;
          this.cdr.detectChanges();
        }
      }
    });
}
  formatDate(date: any): string {
    if (!date) return 'Not specified';
    
    try {
      let dateObj: Date;
      
      if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (typeof date === 'number') {
        dateObj = new Date(date);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        return 'Invalid date';
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
      }
      
      return this.datePipe.transform(dateObj, 'MMM dd, yyyy HH:mm') || 'Not specified';
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  }

  formatCurrency(amount: any): string {
    if (amount === null || amount === undefined) {
      return '$0.00';
    }

    let numericAmount: number;
    
    if (typeof amount === 'string') {
      numericAmount = parseFloat(amount);
    } else if (typeof amount === 'number') {
      numericAmount = amount;
    } else {
      return '$0.00';
    }

    if (isNaN(numericAmount)) {
      return '$0.00';
    }

    return this.currencyPipe.transform(numericAmount, 'USD', 'symbol', '1.2-2') || '$0.00';
  }

  getStatusConfig(status: string): StatusConfig {
    return this.statusConfig[status] || 
           { class: 'status-unknown', icon: 'question', label: status, color: '#6b7280' };
  }

 getPaymentMethodConfig(method?: string | null): PaymentMethodConfig {
  return this.paymentMethodConfig[method || ''] || 
         { icon: 'question', label: method || 'Unknown' };
}

getPaymentStatusConfig(status?: string | null): StatusConfig {
    if (!status) return {
      class: 'payment-unknown', 
      icon: 'question', 
      label: 'Unknown', 
      color: '#6b7280' 
    };

    const normalizedStatus = status.toUpperCase().trim();
    
    const statusMap: Record<string, StatusConfig> = {
      'COMPLETED': { class: 'payment-completed', icon: 'check-circle', label: 'Completed', color: '#10b981' },
      'PAID': { class: 'payment-completed', icon: 'check-circle', label: 'Paid', color: '#10b981' },
      'SUCCESS': { class: 'payment-completed', icon: 'check-circle', label: 'Success', color: '#10b981' },
      'PENDING': { class: 'payment-pending', icon: 'clock', label: 'Pending', color: '#fbbf24' },
      'FAILED': { class: 'payment-failed', icon: 'times-circle', label: 'Failed', color: '#ef4444' },
      'REFUNDED': { class: 'payment-refunded', icon: 'undo', label: 'Refunded', color: '#6b7280' },
      'APPROVED': { class: 'payment-approved', icon: 'check-double', label: 'Approved', color: '#059669' },
      'PROCESSING': { class: 'payment-processing', icon: 'sync', label: 'Processing', color: '#3b82f6' },
      'CANCELLED': { class: 'payment-cancelled', icon: 'ban', label: 'Cancelled', color: '#6b7280' }
    };

    return statusMap[normalizedStatus] || { 
      class: 'payment-unknown', 
      icon: 'question', 
      label: normalizedStatus,  // Show actual status value
      color: '#6b7280' 
    };
  }

getSafeProperty<T>(obj: any, prop: string, defaultValue: T): T {
  return obj && obj[prop] !== undefined ? obj[prop] : defaultValue;
}

hasFinancialInfo(): boolean {
  // Always show financial section to clients
  return true;
}

  getFinalAmount(): number {
    if (!this.delivery) return 0;
    
    const originalAmount = this.parseAmount(this.delivery.originalAmount) || 0;
    const amount = this.parseAmount(this.delivery.amount) || 0;
    const discountAmount = this.parseAmount(this.delivery.discountAmount) || 0;
    
    const baseAmount = originalAmount || amount;
    const finalAmount = Math.max(0, baseAmount - discountAmount);
    
    return finalAmount;
  }

  private parseAmount(amount: any): number {
    if (amount === null || amount === undefined) return 0;
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'string') {
      const parsed = parseFloat(amount);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  hasVehicleInfo(): boolean {
    return !!(this.assignedPerson?.vehicle?.model || this.assignedPerson?.vehicle?.licensePlate);
  }

  canDownloadReceipt(): boolean {
    return !!(this.delivery?.status === 'DELIVERED' || 
              this.delivery?.status === 'APPROVED' || 
              this.delivery?.paymentStatus === 'COMPLETED');
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/client/dashboard']).catch(() => {
        this.router.navigate(['/']);
      });
    }
  }

  downloadReceipt(): void {
    if (!this.deliveryId || this.isDownloading || !this.canDownloadReceipt()) {
      return;
    }

    this.isDownloading = true;
    
    this.deliveryService.downloadReceipt(this.deliveryId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Receipt download error:', error);
          this.showErrorMessage('Failed to download receipt. Please try again later.');
          return of(null);
        }),
        finalize(() => {
          this.isDownloading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (blob) => {
          if (blob) {
            this.handleDownload(blob);
          }
        }
      });
  }

  refreshDelivery(): void {
    this.retryCount = 0;
    this.loadDeliveryDetails();
  }

  private handleDownload(blob: Blob): void {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `delivery-receipt-${this.deliveryId}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      this.showSuccessMessage('Receipt downloaded successfully!');
      
    } catch (error) {
      console.error('Error creating download link:', error);
      this.showErrorMessage('Error occurred while downloading file');
    }
  }

  private handleError(message: string): void {
    this.errorMessage = message;
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private showErrorMessage(message: string): void {
    alert(message);
  }

  private showSuccessMessage(message: string): void {
    console.log('Success:', message);
  }

  getDeliveryAge(): string {
    if (!this.delivery?.createdAt) return '';
    
    const created = new Date(this.delivery.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  isRecentDelivery(): boolean {
    if (!this.delivery?.createdAt) return false;
    
    const created = new Date(this.delivery.createdAt);
    const now = new Date();
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    
    return diffHours < 24;
  }

private async initializeMap(): Promise<void> {
    const pickupLat = this.delivery?.pickupLatitude;
    const pickupLng = this.delivery?.pickupLongitude;
    const deliveryLat = this.delivery?.deliveryLatitude;
    const deliveryLng = this.delivery?.deliveryLongitude;

    if (!pickupLat || !pickupLng || !deliveryLat || !deliveryLng) {
      this.handleMapError('Location coordinates are missing');
      return;
    }

    const coords = [pickupLat, pickupLng, deliveryLat, deliveryLng];
    if (coords.some(coord => isNaN(Number(coord)))) {
      this.handleMapError('Invalid location coordinates');
      return;
    }

    setTimeout(async () => {
      const mapElement = document.getElementById('delivery-map');
      
      if (mapElement && !this.mapInitialized) {
        try {
          this.resetMapState();
          
          const pickup = latLng(Number(pickupLat), Number(pickupLng));
          const delivery = latLng(Number(deliveryLat), Number(deliveryLng));

          await this.mapService.initMap(mapElement, { 
            center: pickup,
            zoom: 12,
            mapType: this.currentMapType
          });

          // First try to show route (this will add custom pickup/delivery markers)
          const routeResult = await this.mapService.showRoute(pickup, delivery);
          
          if (routeResult) {
            this.routeInfo = {
              distance: routeResult.distance,
              duration: routeResult.duration
            };
          } else {
            // If route failed, add individual markers and fit bounds
            await this.mapService.addMarker({
              position: pickup,
              title: 'Pickup Location',
              label: 'P',
              color: '#4285F4',
              address: this.delivery?.pickupAddress || 'Pickup Location'
            });

            await this.mapService.addMarker({
              position: delivery,
              title: 'Delivery Location',
              label: 'D',
              color: '#EA4335',
              address: this.delivery?.deliveryAddress || 'Delivery Location'
            });

            await this.mapService.fitBounds([pickup, delivery]);
          }

          this.mapInitialized = true;
        } catch (error) {
          this.handleMapError(error);
        } finally {
          this.cdr.detectChanges();
        }
      } else if (!mapElement) {
        this.handleMapError('Map container not found');
      }
    }, 500);
  }

  openOSMaps(): void {
    if (this.delivery?.pickupLatitude != null && 
        this.delivery?.pickupLongitude != null && 
        this.delivery?.deliveryLatitude != null && 
        this.delivery?.deliveryLongitude != null) {
      
      const pickup = `${this.delivery.pickupLatitude},${this.delivery.pickupLongitude}`;
      const delivery = `${this.delivery.deliveryLatitude},${this.delivery.deliveryLongitude}`;
      const url = `https://www.openstreetmap.org/directions?engine=osrm_car&route=${pickup}%3B${delivery}`;
      window.open(url, '_blank');
    }
  }

  private resetMapState(): void {
    this.mapError = false;
    this.mapErrorMessage = '';
    this.routeInfo = null;
  }

  private handleMapError(error: any): void {
    console.error('Map error:', error);
    this.mapError = true;
    this.mapInitialized = false;
    
    if (typeof error === 'string') {
      this.mapErrorMessage = error;
    } else if (error?.message) {
      this.mapErrorMessage = error.message;
    } else {
      this.mapErrorMessage = 'Unable to load map. Please try again later.';
    }
    
    this.cdr.detectChanges();
  }

  retryMapInitialization(): void {
    this.mapInitialized = false;
    this.mapError = false;
    this.mapErrorMessage = '';
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.initializeMap();
    }, 500);
  }

  async toggleMapType(): Promise<void> {
    if (!this.mapInitialized) return;
    
    this.currentMapType = this.currentMapType === 'roadmap' ? 'satellite' : 'roadmap';
    await this.mapService.setMapType(this.currentMapType);
    this.cdr.detectChanges();
  }

  centerMap(): void {
    if (!this.mapInitialized || !this.delivery) return;
    
    const pickup = latLng(
      Number(this.delivery.pickupLatitude),
      Number(this.delivery.pickupLongitude)
    );
    const delivery = latLng(
      Number(this.delivery.deliveryLatitude),
      Number(this.delivery.deliveryLongitude)
    );
    
    this.mapService.centerMap(pickup, delivery);
  }

  async downloadRouteImage(): Promise<void> {
    if (!this.mapInitialized) return;
    
    try {
      this.isDownloadingMap = true;
      this.cdr.detectChanges();
      
      const imageData = await this.mapService.captureMapImage();
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `delivery-route-${this.deliveryId}-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
      
      this.showSuccessMessage('Map image downloaded successfully!');
    } catch (error) {
      console.error('Error downloading map image:', error);
      this.mapError = true;
      this.mapErrorMessage = 'Failed to download map image';
    } finally {
      this.isDownloadingMap = false;
      this.cdr.detectChanges();
    }
  }

  // Add these helper methods to your DeliveryDetailsComponent class

hasAmount(): boolean {
  if (!this.delivery) return false;
  
  const amount = this.parseAmount(this.delivery.amount);
  const originalAmount = this.parseAmount(this.delivery.originalAmount);
  
  return amount > 0 || originalAmount > 0;
}

hasDiscount(): boolean {
  if (!this.delivery) return false;
  
  const discountAmount = this.parseAmount(this.delivery.discountAmount);
  return discountAmount > 0;
}

getBaseAmount(): number {
  if (!this.delivery) return 0;
  
  const originalAmount = this.parseAmount(this.delivery.originalAmount);
  const amount = this.parseAmount(this.delivery.amount);
  
  return originalAmount > 0 ? originalAmount : amount;
}

hasPaymentMethod(): boolean {
  return !!(this.delivery?.paymentMethod && 
           this.delivery.paymentMethod.trim() !== '');
}

hasPaymentStatus(): boolean {
  return !!(this.delivery?.paymentStatus && 
           this.delivery.paymentStatus.trim() !== '');
}

hasPaymentDate(): boolean {
  return !!(this.delivery?.paymentDate);
}

hasPaymentId(): boolean {
  return !!(this.delivery?.paymentId && 
           this.delivery.paymentId.trim() !== '');
}

getSafeDiscountAmount(): number {
  return this.delivery?.discountAmount || 0;
}

getDiscountAmount(): number {
  return this.delivery?.discountAmount || 0;
}

getFinalAmountDisplay(): number {
  // First try to use the finalAmountAfterDiscount property
  if (this.delivery?.finalAmountAfterDiscount !== undefined && this.delivery.finalAmountAfterDiscount !== null) {
    return this.delivery.finalAmountAfterDiscount;
  }
  
  // Fallback to calculated final amount
  return this.getFinalAmount();
}

hasValidDiscountAmount(): boolean {
  return !!(this.delivery?.discountAmount && this.delivery.discountAmount > 0);
}


getInitials(person: any): string {
  if (person.firstName && person.lastName) {
    return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
  }
  if (person.firstName) return person.firstName.charAt(0).toUpperCase();
  if (person.lastName) return person.lastName.charAt(0).toUpperCase();
  return 'DP'; // Default initials
}

getAvatarColor(person: any): string {
  // Create a consistent color based on person ID
  const colors = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6'];
  const idNum = parseInt(person.id.replace(/[^0-9]/g, ''), 10) || 0;
  return colors[idNum % colors.length];
}

refreshDeliveryPerson(): void {
  this.loadDeliveryPerson();
}
loadDeliveryPerson(): void {
  if (!this.delivery?.deliveryPersonId) return;
  
  this.isLoadingPerson = true;
  this.personError = null;
  
  this.userService.getUserById(this.delivery.deliveryPersonId)
    .pipe(
      finalize(() => this.isLoadingPerson = false),
      takeUntil(this.destroy$)
    )
    .subscribe({
      next: (person) => {
        this.assignedPerson = person;
      },
      error: (err) => {
        this.personError = 'Failed to load delivery person details';
        console.error('Error loading delivery person:', err);
      }
    });
}
showMoreContactOptions() {
  console.log("نفّذت الدالة showMoreContactOptions");
  // مثلا نفتح modal أو نعرض خيارات إضافية
}

}