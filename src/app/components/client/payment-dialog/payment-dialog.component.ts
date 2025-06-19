import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Observable, Subscription, tap } from 'rxjs';
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
import { PaymentSuccessModalComponent } from '../../../shared/payment-success-modal/payment-success-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { StripeCardElement, StripeElements } from '@stripe/stripe-js';
import { CartService } from '../../../services/cart.service';

// Import the PaymentStatus from DeliveryService to avoid conflicts
import { PaymentStatus as DeliveryPaymentStatus } from '../../../services/delivery-service.service';

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
  paymentDate?: string | number | Date;
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
  styleUrls: ['./payment-dialog.component.css'],
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
  
  exchangeRate = 0.32; // 1 TND = 0.32 USD
  private minimumUsdAmount = 0.5; // Minimum $0.50 USD equivalent

  // Component properties
  delivery: DeliveryData | null = null;
  clientId: string = '';
  paymentStatus: PaymentStatus = PaymentStatus.PENDING;
  paymentId: string | null = null;
  paymentError: string = '';
  cardErrors: string = '';
  paymentMethods: any[] = [];
  selectedMethod: PaymentMethod | null = null;
  showCardForm: boolean = false;
  showBankDetails: boolean = false;
  discountCode: string = '';
  discountApplied: boolean = false;
  discountError: string = '';
  loading: boolean = true;
  discountLoading: boolean = false;
  paymentProcessing: boolean = false;
  clientSecret: string = '';
  
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

  stripeElements: StripeElements | null = null;
  cardElement: StripeCardElement | null = null;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private discountService: DiscountService,
    private deliveryService: DeliveryService,
    private pricingService: PricingService,
    private stripeService: StripeService,
    private toastService: ToastService,
    private dialog: MatDialog,
    private cartService: CartService,
  ) {}

  ngOnInit(): void {
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
          pricingDetails: null,
          paymentStatus: delivery.paymentStatus as PaymentStatus
        };
        
        if (delivery.paymentStatus === PaymentStatus.COMPLETED) {
          this.toastService.showWarning('This delivery has already been paid');
          this.navigateToDashboard();
          return;
        }

        if (delivery.paymentStatus) {
          this.handleExistingPayment(this.delivery);
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
    
    let scheduledDate: string | undefined;
    if (this.delivery.scheduledDate) {
      try {
        scheduledDate = new Date(this.delivery.scheduledDate).toISOString();
      } catch (e) {
        scheduledDate = undefined;
      }
    }

    const pricingSub = this.pricingService.calculatePricing({
      pickupAddress: this.delivery.pickupAddress,
      deliveryAddress: this.delivery.deliveryAddress,
      packageDescription: this.delivery.packageDescription,
      packageWeight: this.delivery.packageWeight,
      vehicleId: this.delivery.vehicleId || '',
      scheduledDate: scheduledDate,
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
    
    let calculatedAt: string;
    try {
      calculatedAt = pricingData.calculatedAt ? new Date(pricingData.calculatedAt).toISOString() : new Date().toISOString();
    } catch (e) {
      calculatedAt = new Date().toISOString();
    }
    
    this.delivery.pricingDetails = {
      distance: pricingData.distance || 0,
      basePrice: pricingData.basePrice || 0,
      distanceCost: pricingData.distanceCost || 0,
      weightCost: pricingData.weightCost || 0,
      urgencyFee: pricingData.urgencyFee || 0,
      peakSurcharge: pricingData.peakSurcharge || 0,
      calculatedAt: calculatedAt,
      holidaySurcharge: pricingData.holidaySurcharge || 0,
      discountAmount: pricingData.discountAmount || 0,
      totalAmount: pricingData.totalAmount || 0,
      appliedRules: pricingData.appliedRules || [],
      currency: pricingData.currency || 'TND',
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
    
    if (this.showCardForm) {
      this.initializeCardForm();
    }
  }

  private async initializeCardForm(): Promise<void> {
    try {
      const isReady = await this.stripeService.ensureReady();
      if (!isReady) {
        this.toastService.showError('Payment system not ready. Please wait and try again.');
        return;
      }

      if (!this.clientSecret && this.delivery) {
        await this.createPaymentIntent();
      }
      
      if (this.clientSecret) {
        await this.initializeStripeElements(this.clientSecret);
      } else {
        this.toastService.showError('Failed to initialize payment form');
      }
    } catch (error) {
      console.error('Error initializing card form:', error);
      this.toastService.showError('Failed to initialize payment form');
    }
  }

  private async createPaymentIntent(): Promise<void> {
    if (!this.delivery) {
      this.toastService.showError('Delivery information not available');
      return;
    }

    try {
      // First ensure Stripe is ready
      const isStripeReady = await this.stripeService.ensureReady();
      if (!isStripeReady) {
        this.toastService.showError('Payment system not ready. Please try again.');
        return;
      }

      // Calculate USD amount from TND
      const tndAmount = this.delivery.finalAmountAfterDiscount;
      const usdAmount = tndAmount * this.exchangeRate;

      // Validate amount
      if (usdAmount < this.minimumUsdAmount) {
        const minTndAmount = this.minimumUsdAmount / this.exchangeRate;
        this.toastService.showError(
          `Minimum payment is ${minTndAmount.toFixed(2)} TND (equivalent to $${this.minimumUsdAmount} USD)`
        );
        return;
      }

      if (tndAmount <= 0) {
        this.toastService.showError('Payment amount must be greater than zero');
        return;
      }

      const paymentData = {
        deliveryId: this.delivery.id,
        clientId: this.clientId,
        amount: Math.round(usdAmount * 100), // Convert to cents
        currency: 'usd',     // Explicitly set currency to USD
        paymentMethod: PaymentMethod.CREDIT_CARD
      };

      const response = await firstValueFrom(
        this.paymentService.createPaymentIntent(paymentData)
      );
      
      if (!response || !response.clientSecret || !response.paymentId) {
        console.error('Invalid response from payment service:', response);
        throw new Error('Payment service returned invalid response');
      }
      
      this.clientSecret = response.clientSecret;
      this.paymentId = response.paymentId;
      
      console.log('PaymentIntent created successfully:', {
        clientSecret: this.clientSecret,
        paymentId: this.paymentId
      });
      
    } catch (error: any) {
      console.error('Payment intent creation failed:', error);
      let errorMsg = 'Failed to initialize payment';
      
      if (error.error?.message) {
        errorMsg += `: ${error.error.message}`;
      } else if (error.message) {
        errorMsg += `: ${error.message}`;
      }
      
      this.showError(errorMsg);
    }
  }

  private validateForm(): boolean {
    if (this.selectedMethod === PaymentMethod.CREDIT_CARD) {
      if (!this.billingDetails.name?.trim()) {
        this.paymentError = 'Please enter cardholder name';
        return false;
      }
      if (!this.billingDetails.email?.trim()) {
        this.paymentError = 'Please enter email address';
        return false;
      }
    }
    return true;
  }

  private showError(message: string): void {
    this.paymentError = message;
    this.toastService.showError(message);
  }

  async processPayment(): Promise<void> {
    if (!this.selectedMethod) {
      this.toastService.showWarning('Please select a payment method');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.paymentProcessing = true;
    this.paymentError = '';

    try {
      if (this.selectedMethod === PaymentMethod.CREDIT_CARD) {
        await this.processCardPayment();
      } else {
        await this.processNonCardPayment();
      }
    } catch (error: any) {
      this.showError('Payment failed: ' + error.message);
    } finally {
      this.paymentProcessing = false;
    }
  }

  private async processCardPayment(): Promise<void> {
    if (!this.clientSecret) {
      this.showError('Payment session not initialized');
      return;
    }

    this.paymentProcessing = true;
    
    if (!this.billingDetails.name || !this.billingDetails.email) {
      this.showError('Please fill in all required fields');
      this.paymentProcessing = false;
      return;
    }

    try {
      const isReady = await this.stripeService.ensureReady();
      if (!isReady) {
        throw new Error('Payment system not ready');
      }

      const stripe = await this.stripeService.stripePromise;
      if (!stripe || !this.stripeService.card) {
        throw new Error('Payment system not ready');
      }

      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
        type: 'card',
        card: this.stripeService.card,
        billing_details: {
          name: this.billingDetails.name,
          email: this.billingDetails.email,
          address: {
            line1: this.billingDetails.address.line1,
            city: this.billingDetails.address.city,
            country: 'TN'
          }
        }
      });

      if (pmError) throw pmError;
      if (!paymentMethod) throw new Error('Failed to create payment method');

      const result = await stripe.confirmCardPayment(this.clientSecret, {
        payment_method: paymentMethod.id,
        receipt_email: this.billingDetails.email
      });

      if (result.error) throw result.error;

      if (result.paymentIntent) {
        const payment = await firstValueFrom(
          this.paymentService.confirmPayment(
            result.paymentIntent.id,
            result.paymentIntent.amount / 100
          )
        );

        if (this.delivery) {
          await firstValueFrom(
            this.deliveryService.updateDeliveryPaymentStatus(
              this.delivery.id,
              payment.data.id,
              'COMPLETED',
              this.selectedMethod || undefined
            )
          ).catch(error => {
            console.error('Failed to update delivery payment status:', error);
          });

          this.showSuccess('Payment successful!');
          this.cartService.clearCart();
          this.router.navigate(['/client/payment/confirmation'], {
            queryParams: { 
              paymentId: payment.data.id,
              success: 'true'
            }
          });
        }
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      this.showError(error.message || 'Payment failed');
    } finally {
      this.paymentProcessing = false;
    }
  }

  private showSuccess(message: string): void {
    this.toastService.showSuccess(message);
  }

  private async processNonCardPayment(): Promise<void> {
    if (!this.paymentId && this.delivery) {
      const paymentData = {
        deliveryId: this.delivery.id,
        clientId: this.clientId,
        amount: this.delivery.finalAmountAfterDiscount,
        currency: 'usd',
        paymentMethod: this.selectedMethod!
      };

      const response = await firstValueFrom(
        this.paymentService.createPaymentIntent(paymentData)
      );
      
      if (!response.paymentId) {
        throw new Error('Payment ID not received from payment service');
      }
      
      this.paymentId = response.paymentId;
    }

    if (this.paymentId) {
      const payment = await firstValueFrom(
        this.paymentService.processNonCardPayment(this.paymentId)
      );
      
      if (payment && payment.data) {
        this.showPaymentSuccess(payment.data);
      } else {
        throw new Error('Payment processing failed - no payment data received');
      }
    } else {
      throw new Error('No payment ID available for processing');
    }
  }

  async initializeStripeElements(clientSecret: string): Promise<void> {
    try {
      const isReady = await this.stripeService.ensureReady();
      if (!isReady) {
        throw new Error('Stripe service not ready');
      }
      
      this.stripeElements = await this.stripeService.createElements(clientSecret);
      
      if (!this.stripeElements) {
        throw new Error('Failed to create Stripe elements');
      }
      
      const cardCreated = await this.stripeService.createCardElement(clientSecret);
      if (!cardCreated) {
        throw new Error('Failed to create card element');
      }
      
      setTimeout(() => {
        if (this.stripeService.card) {
          const mounted = this.stripeService.mountCardElement('card-element');
          if (mounted) {
            this.stripeService.card.on('change', (event) => {
              this.cardErrors = event.error?.message || '';
            });
          } else {
            this.toastService.showError('Failed to mount payment form');
          }
        } else {
          this.toastService.showError('Payment form container not found');
        }
      }, 200);
    } catch (error) {
      console.error('Error initializing Stripe elements:', error);
      this.toastService.showError('Failed to initialize payment form');
    }
  }

  private getMethodName(method: PaymentMethod): string {
    const methodNames: Record<PaymentMethod, string> = {
      [PaymentMethod.CREDIT_CARD]: 'Credit Card',
      [PaymentMethod.BANK_TRANSFER]: 'Bank Transfer',
      [PaymentMethod.CASH]: 'Cash on Delivery',
      [PaymentMethod.WALLET]: 'Digital Wallet'
    };
    
    return methodNames[method] || 'Unknown Payment Method';
  }

  private showPaymentSuccess(payment: Payment): void {
    if (!this.delivery) return;

    const modalRef = this.dialog.open(PaymentSuccessModalComponent, {
      data: {
        deliveryId: this.delivery.id,
        amount: this.delivery.finalAmountAfterDiscount,
        paymentMethod: this.getMethodName(this.selectedMethod!),
        transactionId: payment.transactionId
      }
    });

    modalRef.afterClosed().subscribe(() => {
      if (this.delivery && payment.id) {
        this.deliveryService.updateDeliveryPaymentStatus(
          this.delivery.id,
          payment.id,
          this.mapToDeliveryPaymentStatus(PaymentStatus.COMPLETED)
        ).subscribe({
          next: () => {
            this.router.navigate(['/client/dashboard'], {
              queryParams: {
                paymentSuccess: 'true',
                paymentId: payment.id,
                refresh: Date.now().toString()
              }
            });
          },
          error: () => {
            this.router.navigate(['/client/dashboard'], {
              queryParams: {
                paymentSuccess: 'true',
                paymentId: payment.id,
                refresh: Date.now().toString()
              }
            });
          }
        });
      }
    });
  }

  private updateDeliveryPaymentStatus(deliveryId: string, paymentId: string): Observable<any> {
    return this.deliveryService.updateDeliveryPaymentStatus(
      deliveryId,
      paymentId,
      this.mapToDeliveryPaymentStatus(PaymentStatus.COMPLETED)
    ).pipe(
      tap(() => {
        if (this.delivery) {
          this.delivery.paymentStatus = PaymentStatus.COMPLETED;
          this.delivery.paymentId = paymentId;
          this.delivery.paymentDate = new Date();
        }
      })
    );
  }

  private mapToDeliveryPaymentStatus(status: PaymentStatus): DeliveryPaymentStatus {
    switch (status) {
      case PaymentStatus.PENDING:
        return 'PENDING' as DeliveryPaymentStatus;
      case PaymentStatus.PROCESSING:
        return 'PROCESSING' as DeliveryPaymentStatus;
      case PaymentStatus.COMPLETED:
        return 'COMPLETED' as DeliveryPaymentStatus;
      case PaymentStatus.FAILED:
        return 'FAILED' as DeliveryPaymentStatus;
      case PaymentStatus.CANCELLED:
        return 'CANCELLED' as DeliveryPaymentStatus;
      case PaymentStatus.REFUNDED:
        return 'REFUNDED' as DeliveryPaymentStatus;
      case PaymentStatus.PARTIALLY_REFUNDED:
        return 'PARTIALLY_REFUNDED' as DeliveryPaymentStatus;
      case PaymentStatus.PENDING_DELIVERY:
        return 'PENDING_DELIVERY' as DeliveryPaymentStatus;
      case PaymentStatus.PENDING_VERIFICATION:
        return 'PENDING_VERIFICATION' as DeliveryPaymentStatus;
      default:
        return 'PENDING' as DeliveryPaymentStatus;
    }
  }

  resetPayment(): void {
    this.paymentStatus = PaymentStatus.PENDING;
    this.paymentId = null;
    this.paymentError = '';
  }

  navigateToDashboard(queryParams: any = {}): void {
    this.router.navigate(['/client/dashboard'], { 
      queryParams: {
        ...queryParams,
        refresh: Date.now().toString()
      }
    });
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
    if (this.cardElement) {
      this.cardElement.destroy();
    }
  }
}