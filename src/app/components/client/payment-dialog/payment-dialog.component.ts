// payment-dialog.component.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PaymentService } from '../../../services/payment.service';
import { DiscountService } from '../../../services/discount.service';
import { PricingService } from '../../../services/pricing.service';
import { StripeService } from '../../../services/stripe.service';
import { ToastService } from '../../../services/toast.service';
import { Payment, PaymentMethod, PaymentStatus } from '../../../models/Payment.model';
import { Discount } from '../../../models/discount.model';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PricingDetailsComponent } from "../pricing-details/pricing-details.component";
import { DeliveryService } from '../../../services/delivery-service.service';

interface DeliveryData {
  id: string;
  amount: number;
  finalAmountAfterDiscount: number;
  pricingDetails: PricingDetails | null;
  pickupAddress: string;
  deliveryAddress: string;
  packageDescription: string;
  packageWeight: number;
  vehicleId?: string;
  scheduledDate?: string;
  packageType?: string;
  additionalInstructions?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  clientId?: string;
  urgentDelivery?: boolean;
  insuranceValue?: number;
  fragile?: boolean;
  paymentStatus?: PaymentStatus;
  paymentId?: string;
}

interface PricingDetails {
  distance: number;
  basePrice: number;
  distanceCost: number;
  weightCost: number;
  urgencyFee: number;
  peakSurcharge: number;
  holidaySurcharge: number;
  discountAmount: number;
  totalAmount: number;
  appliedRules?: Array<{
    description: string;
    amount: number;
    type?: 'fee' | 'discount' | 'surcharge';
  }>;
  currency?: string;
  calculatedAt?: string;
}

interface BillingDetails {
  name: string;
  email: string;
  address: {
    line1: string;
    city: string;
    postal_code: string;
    country: string;
  };
}

@Component({
  selector: 'app-payment-dialog',
  templateUrl: './payment-dialog.component.html',
  styleUrls: ['./payment-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    PricingDetailsComponent
  ]
})
export class PaymentDialogComponent implements OnInit, OnDestroy {
  @ViewChild(PricingDetailsComponent) pricingDetails!: PricingDetailsComponent;

  // Payment data
  delivery: DeliveryData | null = null;
  clientId: string = '';
  paymentStatus: PaymentStatus = PaymentStatus.PENDING;
  paymentId: string | null = null;
  paymentError: string = '';
  
  // Payment methods - Initialize as empty array to avoid "used before initialization" error
  paymentMethods: any[] = [];
  selectedMethod: PaymentMethod | null = null;
  showCardForm: boolean = false;
  showBankDetails: boolean = false;
  
  // Discount
  discountCode: string = '';
  discountApplied: boolean = false;
  discountError: string = '';
  
  // Loading states
  loading: boolean = true;
  discountLoading: boolean = false;
  paymentProcessing: boolean = false;
  
  // Billing details
  billingDetails: BillingDetails = {
    name: '',
    email: '',
    address: {
      line1: '',
      city: '',
      postal_code: '',
      country: 'TN'
    }
  };

  private subscriptions: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private discountService: DiscountService,
    private deliveryService: DeliveryService,
    private pricingService: PricingService,
    private stripeService: StripeService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Initialize payment methods after paymentService is available
    this.paymentMethods = this.paymentService.getAvailablePaymentMethods();
    this.loadData();
  }

  private loadData(): void {
    const paramsSubscription = this.route.queryParams.subscribe(params => {
      this.clientId = params['clientId'] || '';
      const deliveryId = params['deliveryId'];
      
      if (deliveryId) {
        this.loadDeliveryDetails(deliveryId);
      } else {
        this.toastService.showError('No delivery ID provided');
        this.navigateToDashboard();
      }
    });
    
    this.subscriptions.add(paramsSubscription);
  }

  private loadDeliveryDetails(deliveryId: string): void {
    this.loading = true;
    
    const deliverySub = this.deliveryService.getDeliveryById(deliveryId).subscribe({
      next: (delivery) => {
        this.delivery = {
          ...delivery,
          amount: parseFloat(delivery.amount.toString()),
          finalAmountAfterDiscount: parseFloat(delivery.amount.toString()),
          pricingDetails: null
        };
        
        if (delivery.paymentStatus) {
          this.handleExistingPayment(delivery);
        } else {
          this.loadPricingDetails();
        }
      },
      error: (err) => {
        this.toastService.showError('Failed to load delivery details');
        this.loading = false;
      }
    });
    
    this.subscriptions.add(deliverySub);
  }

  private handleExistingPayment(delivery: DeliveryData): void {
    this.paymentStatus = delivery.paymentStatus || PaymentStatus.PENDING;
    this.paymentId = delivery.paymentId || null;
    
    switch (this.paymentStatus) {
      case PaymentStatus.COMPLETED:
        this.toastService.showSuccess('Payment already completed');
        break;
      case PaymentStatus.FAILED:
        this.toastService.showWarning('Previous payment failed. Please try again.');
        break;
      case PaymentStatus.PROCESSING:
        this.toastService.showInfo('Payment is being processed');
        break;
      case PaymentStatus.PENDING_VERIFICATION:
        this.toastService.showInfo('Payment is pending verification');
        break;
    }
    
    this.loading = false;
  }

  private loadPricingDetails(): void {
    if (!this.delivery) return;

    const pricingSub = this.pricingService.calculatePricing({
      pickupAddress: this.delivery.pickupAddress,
      deliveryAddress: this.delivery.deliveryAddress,
      packageDescription: this.delivery.packageDescription,
      packageWeight: this.delivery.packageWeight,
      vehicleId: this.delivery.vehicleId || '',
      scheduledDate: this.delivery.scheduledDate,
      packageType: this.delivery.packageType || 'standard',
      pickupLatitude: this.delivery.pickupLatitude || 0,
      pickupLongitude: this.delivery.pickupLongitude || 0,
      deliveryLatitude: this.delivery.deliveryLatitude || 0,
      deliveryLongitude: this.delivery.deliveryLongitude || 0,
      clientId: this.clientId,
      urgentDelivery: this.delivery.urgentDelivery,
      insuranceValue: this.delivery.insuranceValue,
      fragile: this.delivery.fragile
    }).subscribe({
      next: (response: any) => this.handlePricingSuccess(response),
      error: (error: any) => {
        this.toastService.showError('Failed to calculate pricing');
        this.loading = false;
      }
    });

    this.subscriptions.add(pricingSub);
  }

  private handlePricingSuccess(response: any): void {
    if (!this.delivery) return;

    const pricingData = response?.data || response;
    
    this.delivery.pricingDetails = {
      distance: pricingData.distance || 0,
      basePrice: pricingData.basePrice || 0,
      distanceCost: pricingData.distanceCost || 0,
      weightCost: pricingData.weightCost || 0,
      urgencyFee: pricingData.urgencyFee || 0,
      peakSurcharge: pricingData.peakSurcharge || 0,
      holidaySurcharge: pricingData.holidaySurcharge || 0,
      discountAmount: pricingData.discountAmount || 0,
      totalAmount: pricingData.totalAmount || 0,
      appliedRules: pricingData.appliedRules || [],
      currency: pricingData.currency || 'TND',
      calculatedAt: pricingData.calculatedAt || new Date().toISOString()
    };

    this.delivery.amount = pricingData.totalAmount;
    this.delivery.finalAmountAfterDiscount = pricingData.totalAmount;
    this.loading = false;
  }

  applyDiscount(): void {
    if (!this.discountCode.trim()) {
      this.toastService.showWarning('Please enter a discount code');
      return;
    }
    
    if (!this.clientId) {
      this.toastService.showError('Client ID not found');
      return;
    }
    
    this.discountLoading = true;
    this.discountError = '';
    
    const discountSub = this.discountService.validateDiscount(this.discountCode, this.clientId).subscribe({
      next: (discount: Discount) => {
        if (this.delivery && this.delivery.pricingDetails) {
          const discountAmount = this.calculateDiscountAmount(discount);
          
          this.delivery.pricingDetails.discountAmount = discountAmount;
          this.delivery.finalAmountAfterDiscount = this.delivery.amount - discountAmount;
          this.discountApplied = true;
          
          this.toastService.showSuccess('Discount applied successfully');
        }
        this.discountLoading = false;
      },
      error: (err: any) => {
        this.discountError = err.error?.message || 'Invalid discount code';
        this.discountLoading = false;
        this.toastService.showError(this.discountError);
      }
    });
    
    this.subscriptions.add(discountSub);
  }

  private calculateDiscountAmount(discount: Discount): number {
    if (discount.type === 'PERCENTAGE' && discount.percentage) {
      return (this.delivery?.amount || 0) * (discount.percentage / 100);
    } else if (discount.type === 'FIXED_AMOUNT' && discount.fixedAmount) {
      return Math.min(discount.fixedAmount, this.delivery?.amount || 0);
    }
    return 0;
  }

  removeDiscount(): void {
    if (!this.delivery || !this.delivery.pricingDetails) return;
    
    this.discountCode = '';
    this.discountApplied = false;
    this.discountError = '';
    this.delivery.pricingDetails.discountAmount = 0;
    this.delivery.finalAmountAfterDiscount = this.delivery.amount;
  }

  selectPaymentMethod(method: PaymentMethod): void {
    this.selectedMethod = method;
    this.paymentError = '';
    this.showCardForm = method === PaymentMethod.CREDIT_CARD;
    this.showBankDetails = method === PaymentMethod.BANK_TRANSFER;
  }

  processPayment(): void {
    if (!this.validatePayment()) return;

    this.paymentProcessing = true;
    this.paymentError = '';
    
    const paymentData = {
      deliveryId: this.delivery!.id,
      amount: this.delivery!.finalAmountAfterDiscount,
      currency: 'TND',
      paymentMethod: this.selectedMethod!,
      clientId: this.clientId,
      discountCode: this.discountApplied ? this.discountCode : undefined,
      billingDetails: this.selectedMethod === PaymentMethod.CREDIT_CARD ? this.billingDetails : undefined
    };

    // Use createPaymentIntent instead of createPayment
    const paymentSub = this.paymentService.createPaymentIntent(paymentData).subscribe({
      next: (response: any) => this.handlePaymentResponse(response),
      error: (err: any) => this.handlePaymentError(err)
    });
    
    this.subscriptions.add(paymentSub);
  }

  private validatePayment(): boolean {
    if (!this.selectedMethod) {
      this.toastService.showWarning('Please select a payment method');
      return false;
    }

    if (!this.delivery) {
      this.toastService.showError('Delivery information not found');
      return false;
    }

    if (this.selectedMethod === PaymentMethod.CREDIT_CARD && 
        (!this.billingDetails.name || !this.billingDetails.email)) {
      this.toastService.showWarning('Please fill in all billing details');
      return false;
    }

    return true;
  }

  private handlePaymentResponse(response: any): void {
    this.paymentId = response.paymentId;
    
    if (this.selectedMethod === PaymentMethod.CREDIT_CARD) {
      this.processStripePayment(response.clientSecret);
    } else {
      this.handleNonCardPayment(response.paymentId);
    }
  }

  private handlePaymentError(err: any): void {
    this.paymentError = err.error?.message || 'Payment processing failed';
    this.paymentProcessing = false;
    this.toastService.showError(this.paymentError);
  }

  private async processStripePayment(clientSecret: string): Promise<void> {
    if (!this.paymentId) return;

    try {
      // Handle Stripe payment as Promise instead of Observable
      const result = await this.stripeService.confirmPayment(clientSecret, {
        name: this.billingDetails.name,
        email: this.billingDetails.email,
        address: this.billingDetails.address
      });

      if (result.success) {
        this.confirmPayment(this.paymentId, result.paymentIntent);
      } else {
        throw new Error(result.error?.message || 'Payment failed');
      }
    } catch (err: any) {
      this.paymentError = err.message || 'Stripe payment failed';
      this.paymentProcessing = false;
      this.toastService.showError(this.paymentError);
    }
  }

  private handleNonCardPayment(paymentId: string): void {
    // Use processNonCardPayment method from the service
    const confirmSub = this.paymentService.processNonCardPayment(paymentId, this.discountApplied ? this.discountCode : undefined).subscribe({
      next: (response: any) => {
        const payment = response.data;
        this.paymentStatus = payment.status;
        this.paymentProcessing = false;
        
        if (payment.status === PaymentStatus.COMPLETED) {
          this.handlePaymentSuccess(payment);
        } else if (payment.status === PaymentStatus.PENDING_VERIFICATION) {
          this.handlePendingVerification(payment);
        }
      },
      error: (err: any) => {
        this.paymentError = err.error?.message || 'Payment confirmation failed';
        this.paymentProcessing = false;
        this.toastService.showError(this.paymentError);
      }
    });
    
    this.subscriptions.add(confirmSub);
  }

  private confirmPayment(paymentId: string, paymentIntentId?: string): void {
    // Fix the confirmPayment call to match the service signature
    const amount = this.delivery?.finalAmountAfterDiscount || 0;
    const transactionId = paymentIntentId || paymentId;
    
    const confirmSub = this.paymentService.confirmPayment(transactionId, amount).subscribe({
      next: (response: any) => {
        const payment = response.data;
        this.paymentStatus = payment.status;
        this.paymentProcessing = false;
        
        if (payment.status === PaymentStatus.COMPLETED) {
          this.handlePaymentSuccess(payment);
        }
      },
      error: (err: any) => {
        this.paymentError = err.error?.message || 'Payment confirmation failed';
        this.paymentProcessing = false;
        this.toastService.showError(this.paymentError);
      }
    });
    
    this.subscriptions.add(confirmSub);
  }

  private handlePaymentSuccess(payment: Payment): void {
    this.toastService.showSuccess('Payment completed successfully');
    this.navigateToDashboard({
      paymentSuccess: true,
      paymentId: payment.id
    });
  }

  private handlePendingVerification(payment: Payment): void {
    this.toastService.showInfo('Payment is pending verification');
    this.navigateToDashboard({
      paymentPending: true,
      paymentId: payment.id
    });
  }

  resetPayment(): void {
    this.paymentStatus = PaymentStatus.PENDING;
    this.paymentId = null;
    this.paymentError = '';
  }

  navigateToDashboard(queryParams: any = {}): void {
    this.router.navigate(['/client/dashboard'], { queryParams });
  }

  getOrderId(): string {
    return this.delivery?.id?.slice(0, 8) || 'N/A';
  }

  getDiscountAmount(): number {
    return this.delivery?.pricingDetails?.discountAmount || 0;
  }

  getFinalAmount(): number {
    return this.delivery?.finalAmountAfterDiscount || 0;
  }

  getPaymentStatusMessage(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.COMPLETED: return 'Payment Completed';
      case PaymentStatus.FAILED: return 'Payment Failed';
      case PaymentStatus.PROCESSING: return 'Processing Payment';
      case PaymentStatus.PENDING_VERIFICATION: return 'Pending Verification';
      default: return 'Payment Pending';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.selectedMethod === PaymentMethod.CREDIT_CARD) {
      this.stripeService.destroy();
    }
  }
}