import { Component, OnInit, OnDestroy, ViewChild, Inject } from '@angular/core';
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
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { StripeCardElement, StripeElements } from '@stripe/stripe-js';
import { CartService } from '../../../services/cart.service';

// Import the PaymentStatus from DeliveryService to avoid conflicts
import { PaymentStatus as DeliveryPaymentStatus } from '../../../services/delivery-service.service';

interface DeliveryData {
  id: string;
  amount: number;
  originalAmount?: number;
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
  discountAmount?: number;
  discountCode?: string;
  paymentMethod?: PaymentMethod; // Add this line
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

// Define the dialog data interface
interface DialogData {
  clientId?: string;
  deliveryId?: string;
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
    public dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: DialogData
  ) {}

  ngOnInit(): void {
    console.log('PaymentDialogComponent initialized');
    this.paymentMethods = this.paymentService.getAvailablePaymentMethods();
    
    if (this.dialogData) {
      console.log('Opened as dialog with data:', this.dialogData);
      this.clientId = this.dialogData.clientId || '';
      const deliveryId = this.dialogData.deliveryId;
      
      if (deliveryId) {
        this.loadDeliveryDetails(deliveryId);
      } else {
        console.error('No delivery ID provided in dialog data');
        this.toastService.showError('No delivery ID provided');
        this.dialogRef.close();
      }
    } else {
      console.log('Opened as regular component');
      this.loadData();
    }
  }

  private loadData(): void {
    console.log('Loading data from query params');
    const paramsSubscription = this.route.queryParams.subscribe(params => {
      this.clientId = params['clientId'] || '';
      const deliveryId = params['deliveryId'];
      
      console.log('Query params:', params);
      
      if (deliveryId) {
        this.loadDeliveryDetails(deliveryId);
      } else {
        console.error('No delivery ID provided in query params');
        this.toastService.showError('No delivery ID provided');
        this.navigateToDashboard();
      }
    });
    
    this.subscriptions.add(paramsSubscription);
  }

private loadDeliveryDetails(deliveryId: string): void {
  console.log(`Loading delivery details for ID: ${deliveryId}`);
  this.loading = true;
  
  const deliverySub = this.deliveryService.getDeliveryById(deliveryId).subscribe({
    next: (delivery) => {
      console.log('Received delivery data:', delivery);
      
      const deliveryAmount = delivery.amount ? parseFloat(delivery.amount.toString()) : 0;
      const discountAmount = delivery.discountAmount ? parseFloat(delivery.discountAmount.toString()) : 0;
      
      this.delivery = {
        ...delivery,
        amount: deliveryAmount,
        discountAmount: discountAmount,
        finalAmountAfterDiscount: deliveryAmount - discountAmount,
        pricingDetails: null,
        paymentStatus: delivery.paymentStatus as PaymentStatus,
        // Fix: Cast paymentMethod from string to PaymentMethod enum
        paymentMethod: delivery.paymentMethod as PaymentMethod
      };
      
      console.log('Processed delivery object:', this.delivery);
      
      if (deliveryAmount === 0) {
        console.warn('Delivery amount is 0, loading pricing details');
        this.toastService.showWarning('Delivery amount is not set. Loading pricing details...');
        this.loadPricingDetails();
        return;
      }
      
      if (delivery.paymentStatus === PaymentStatus.COMPLETED) {
        console.log('Delivery already paid, closing dialog');
        this.toastService.showWarning('This delivery has already been paid');
        this.closeDialog();
        return;
      }

      if (delivery.paymentStatus) {
        console.log('Handling existing payment');
        this.handleExistingPayment(this.delivery);
      } else {
        console.log('No payment status, loading pricing details');
        this.loadPricingDetails();
      }
    },
    error: (err) => {
      console.error('Error loading delivery details:', err);
      this.toastService.showError('Failed to load delivery details');
      this.loading = false;
    }
  });
  
  this.subscriptions.add(deliverySub);
}

  private handleExistingPayment(delivery: DeliveryData): void {
    console.log('Handling existing payment with status:', delivery.paymentStatus);
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
    
    console.log('Loading pricing details');
    
    let scheduledDate: string | undefined;
    if (this.delivery.scheduledDate) {
      try {
        scheduledDate = new Date(this.delivery.scheduledDate).toISOString();
      } catch (e) {
        console.warn('Invalid scheduled date:', this.delivery.scheduledDate);
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
        console.error('Error calculating pricing:', error);
        this.toastService.showError('Failed to calculate pricing');
        this.loading = false;
      }
    });

    this.subscriptions.add(pricingSub);
  }

  private handlePricingSuccess(response: any): void {
    if (!this.delivery) return;

    console.log('Pricing calculation successful:', response);
    
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
    
    console.log('Updated delivery with pricing details:', this.delivery);
  }

  applyDiscount(): void {
    console.log('Applying discount with code:', this.discountCode);
    
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
        console.log('Discount validated:', discount);
        
        if (this.delivery && this.delivery.pricingDetails) {
          const discountAmount = this.calculateDiscountAmount(discount);
          
          console.log('Applying discount amount:', discountAmount);
          
          this.delivery.pricingDetails.discountAmount = discountAmount;
          this.delivery.finalAmountAfterDiscount = this.delivery.amount - discountAmount;
          this.discountApplied = true;
          
          this.toastService.showSuccess('Discount applied successfully');
        }
        this.discountLoading = false;
      },
      error: (err: any) => {
        console.error('Discount validation error:', err);
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
    console.log('Removing discount');
    
    if (!this.delivery || !this.delivery.pricingDetails) return;
    
    this.discountCode = '';
    this.discountApplied = false;
    this.discountError = '';
    this.delivery.pricingDetails.discountAmount = 0;
    this.delivery.finalAmountAfterDiscount = this.delivery.amount;
  }

  selectPaymentMethod(method: PaymentMethod): void {
    console.log('Selected payment method:', method);
    this.selectedMethod = method;
    this.paymentError = '';
    this.showCardForm = method === PaymentMethod.CREDIT_CARD;
    this.showBankDetails = method === PaymentMethod.BANK_TRANSFER;
    
    if (this.showCardForm) {
      this.initializeCardForm();
    }
  }

  private async initializeCardForm(): Promise<void> {
    console.log('Initializing card form');
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
  const tndAmount = this.delivery.finalAmountAfterDiscount;
  const minTndAmount = 1.56; // $0.50 USD / 0.32 exchange rate

  // Validate minimum TND amount
  if (tndAmount < minTndAmount) {
    this.showError(`Amount too small. Minimum charge is ${minTndAmount} TND (≈$0.50 USD)`);
    return;
  }
  console.log('Creating payment intent');

  try {
    const isStripeReady = await this.stripeService.ensureReady();
    if (!isStripeReady) {
      this.toastService.showError('Payment system not ready. Please try again.');
      return;
    }

    const tndAmount = this.delivery.finalAmountAfterDiscount;

    // Validate in TND
    if (tndAmount <= 0) {
      this.toastService.showError('Payment amount must be greater than zero');
      return;
    }

    // Send original TND amount to backend
    const paymentData = {
      deliveryId: this.delivery.id,
      clientId: this.clientId,
      amount: tndAmount,
       currency: 'TND', // Always send as TND
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
    
    console.log('PaymentIntent created:', {
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

    
  // Validate minimum TND amount
  if (tndAmount < minTndAmount) {
    this.showError(`Amount too small. Minimum charge is ${minTndAmount} TND (≈$0.50 USD)`);
    return;
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
    console.log('Processing payment');
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
      console.error('Payment processing error:', error);
      this.showError('Payment failed: ' + error.message);
    } finally {
      this.paymentProcessing = false;
    }
  }
private async processCardPayment(): Promise<void> {
  console.log('Processing card payment');
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

    // Use the recommended approach: confirm payment with inline payment method
    const { paymentIntent, error } = await stripe.confirmCardPayment(this.clientSecret, {
      payment_method: {
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
      },
      receipt_email: this.billingDetails.email
    });

    if (error) throw error;
    
    if (!paymentIntent) {
      throw new Error('No payment intent returned');
    }

    console.log('Payment intent status:', paymentIntent.status);

    // Handle different payment intent statuses
    switch (paymentIntent.status) {
      case 'succeeded':
        await this.handleSuccessfulPayment(paymentIntent);
        break;
      case 'requires_action':
        await this.handleRequiresAction(paymentIntent);
        break;
      case 'requires_payment_method':
        throw new Error('Payment method was declined. Please try a different payment method.');
      case 'processing':
        // Payment is being processed, you might want to poll for status
        throw new Error('Payment is being processed. Please wait and try again.');
      default:
        throw new Error(`Unexpected payment intent status: ${paymentIntent.status}`);
    }

  } catch (error: unknown) {
    console.error('Payment processing error:', error);
    let errorMessage = 'Payment failed';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    this.showError(errorMessage);
  } finally {
    this.paymentProcessing = false;
  }
}

private async handleSuccessfulPayment(paymentIntent: any): Promise<void> {
  const amountInDollars = paymentIntent.amount / 100;
  const tndAmount = this.delivery!.finalAmountAfterDiscount;
  
  console.log('Payment successful. Confirming payment with:', {
    transactionId: paymentIntent.id,
    amount: amountInDollars
  });

  const paymentResponse = await firstValueFrom(
    this.paymentService.confirmPayment(
      paymentIntent.id,
      amountInDollars
    )
  );

  console.log('Payment confirmation response:', paymentResponse);

  if (this.delivery) {
    console.log('Updating delivery payment status with:', {
      deliveryId: this.delivery.id,
      paymentId: paymentResponse.data.id,
      status: 'COMPLETED',
      method: this.selectedMethod || undefined,
      finalAmount: tndAmount,
      originalAmount: this.delivery.amount,
      discountAmount: this.delivery.discountAmount || 0,
      discountCode: this.discountCode
    });
    
    // CRITICAL UPDATE: Update local delivery object immediately
    this.delivery.paymentStatus = PaymentStatus.COMPLETED;
    this.delivery.paymentId = paymentResponse.data.id;
    this.delivery.paymentDate = new Date().toISOString();
    this.delivery.paymentMethod = this.selectedMethod || undefined;
    this.delivery.finalAmountAfterDiscount = tndAmount;
    this.delivery.discountAmount = this.delivery.discountAmount || 0;
    this.delivery.discountCode = this.discountCode;
    
    // Update backend
await firstValueFrom(
  this.deliveryService.updateDeliveryPaymentStatus(
    this.delivery.id,
    paymentResponse.data.id,
    'COMPLETED',
    this.selectedMethod || undefined
  )
);
    // Clear cart
    this.cartService.clearCart();
    
    if (this.dialogData) {
      console.log('Closing dialog with success');
      this.dialogRef.close({
        success: true,
        paymentId: paymentResponse.data.id,
        delivery: this.delivery // Send updated delivery back
      });
    } else {
      console.log('Navigating to dashboard');
      this.router.navigate(['/client/dashboard'], {
        queryParams: {
          paymentId: paymentResponse.data.id,
          success: 'true',
          deliveryId: this.delivery.id,
          refresh: Date.now().toString()
        }
      });
    }
  }
}

private async handleRequiresAction(paymentIntent: any): Promise<void> {
  console.log('Payment requires additional action (3D Secure)');
  
  const stripe = await this.stripeService.stripePromise;
  if (!stripe) {
    throw new Error('Stripe not available');
  }

  // Handle 3D Secure authentication
  const { paymentIntent: confirmedPaymentIntent, error } = await stripe.confirmCardPayment(
    paymentIntent.client_secret
  );

  if (error) {
    throw error;
  }

  if (confirmedPaymentIntent && confirmedPaymentIntent.status === 'succeeded') {
    await this.handleSuccessfulPayment(confirmedPaymentIntent);
  } else {
    throw new Error('Authentication failed or payment was not completed');
  }
}

  private showSuccess(message: string): void {
    this.toastService.showSuccess(message);
  }

private async processNonCardPayment(): Promise<void> {
  console.log('Processing non-card payment');
  
  if (!this.delivery) {
    throw new Error('Delivery information not available');
  }

  try {
    if (!this.paymentId) {
      const paymentData = {
        deliveryId: this.delivery.id,
        clientId: this.clientId,
    amount: this.delivery.finalAmountAfterDiscount, // Remove multiplication
        currency: 'TND', // Always TND
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

    const payment = await firstValueFrom(
      this.paymentService.processNonCardPayment(this.paymentId)
    );
    
    if (payment && payment.data) {
      this.showPaymentSuccess(payment.data);
    } else {
      throw new Error('Payment processing failed - no payment data received');
    }
  } catch (error: any) {
    console.error('Non-card payment processing error:', error);
    this.showError('Non-card payment failed: ' + (error.message || 'Unknown error'));
    throw error;
  }
}

  async initializeStripeElements(clientSecret: string): Promise<void> {
    console.log('Initializing Stripe elements');
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
    console.log('Showing payment success');
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
          this.mapToDeliveryPaymentStatus(PaymentStatus.COMPLETED),
          this.selectedMethod || undefined,
          this.delivery.finalAmountAfterDiscount,
          this.delivery.amount,
          this.delivery.discountAmount || 0,
          this.discountCode
        ).subscribe({
          next: () => {
            this.navigateAfterPayment(payment.id);
          },
          error: () => {
            this.navigateAfterPayment(payment.id);
          }
        });
      }
    });
  }

  private navigateAfterPayment(paymentId: string): void {
    console.log('Navigating after payment');
    const queryParams = {
      paymentSuccess: 'true',
      paymentId: paymentId,
      refresh: Date.now().toString()
    };

    if (this.dialogData) {
      this.dialogRef.close({
        success: true,
        paymentId: paymentId,
        delivery: this.delivery // Send updated delivery back
      });
    } else {
      this.router.navigate(['/client/dashboard'], { 
        queryParams: {
          ...queryParams,
          deliveryId: this.delivery?.id
        }
      });
    }
  }

private updateDeliveryPaymentStatus(deliveryId: string, paymentId: string): Observable<any> {
  return this.deliveryService.updateDeliveryPaymentStatus(
    deliveryId,
    paymentId,
    'COMPLETED',
    this.selectedMethod || undefined,
    this.delivery?.finalAmountAfterDiscount || 0,
    this.delivery?.amount || 0,
    this.delivery?.discountAmount || 0,
    this.discountCode
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
            return 'DELIVERED' as DeliveryPaymentStatus; // Changed from 'COMPLETED'
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
    console.log('Resetting payment');
    this.paymentStatus = PaymentStatus.PENDING;
    this.paymentId = null;
    this.paymentError = '';
  }

  navigateToDashboard(queryParams: any = {}): void {
    console.log('Navigating to dashboard');
    if (this.dialogData) {
      this.dialogRef.close();
    } else {
      this.router.navigate(['/client/dashboard'], { 
        queryParams: {
          ...queryParams,
          refresh: Date.now().toString()
        }
      });
    }
  }

  closeDialog(): void {
    console.log('Closing dialog');
    if (this.dialogData) {
      this.dialogRef.close();
    } else {
      this.navigateToDashboard();
    }
  }

  getOrderId(): string {
    return this.delivery?.id?.slice(0, 8) || 'N/A';
  }
  
  getFinalAmount(): number {
    return this.delivery?.finalAmountAfterDiscount || 0;
  }

  getDiscountAmount(): number {
    return this.delivery?.pricingDetails?.discountAmount || 0;
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
    console.log('PaymentDialogComponent destroyed');
    this.subscriptions.unsubscribe();
    if (this.cardElement) {
      this.cardElement.destroy();
    }
  }
}