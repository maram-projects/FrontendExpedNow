// payment-method.component.ts
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';


import { CartService } from '../../../services/cart.service';
import { 
  Payment, 
  PaymentMethod, 
  PaymentMethodOption 
} from '../../../models/Payment.model';
import { PaymentService } from '../../../services/payment.service';
import { StripeService } from '../../../services/stripe.service';

@Component({
  selector: 'app-payment-method',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './payment-method.component.html',
  styleUrls: ['./payment-method.component.css'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class PaymentMethodComponent implements OnInit, OnDestroy, AfterViewInit {
  paymentMethods: PaymentMethodOption[] = [];
  selectedMethod: PaymentMethod | null = null;
  
  billingDetails = {
    name: '',
    email: '',
    address: {
      line1: '',
      city: '',
      country: 'TN'
    }
  };
  
  showCardForm = false;
  totalAmount = 0;
  currency = 'TND';
  isLoading = false;
  paymentProcessing = false;
  paymentError = '';
  
  // Stripe-specific properties
  clientSecret = '';
  paymentId = '';
  stripeInitialized = false;
  cardElementMounted = false;

  constructor(
    private paymentService: PaymentService,
    private stripeService: StripeService,
    private cartService: CartService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.paymentMethods = this.paymentService.getAvailablePaymentMethods();
    this.totalAmount = this.cartService.getTotalAmount();
    
    // Subscribe to Stripe initialization status
    this.stripeService.isInitialized$.subscribe(initialized => {
      this.stripeInitialized = initialized;
      if (!initialized) {
        this.showError('Payment system initialization failed');
      }
    });
  }

  ngAfterViewInit(): void {
    // Wait for view to be ready before mounting Stripe elements
    setTimeout(() => {
      if (this.showCardForm && this.clientSecret && !this.cardElementMounted) {
        this.mountStripeElements();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.stripeService.destroy();
  }

  async selectMethod(methodId: PaymentMethod): Promise<void> {
    this.selectedMethod = methodId;
    this.showCardForm = methodId === PaymentMethod.CREDIT_CARD;
    this.paymentError = '';

    if (this.showCardForm && !this.clientSecret) {
      await this.createPaymentIntent();
    }
  }
private async createPaymentIntent(): Promise<void> {
  if (!this.stripeInitialized) {
    this.showError('Payment system not ready. Please try again.');
    return;
  }

  this.isLoading = true;
  
  const paymentData = {
    deliveryId: this.getDeliveryId(),
    clientId: this.getCurrentUserId(),
    amount: Math.round(this.totalAmount * 100), // Convert to cents
    currency: this.currency.toLowerCase(),
    paymentMethod: PaymentMethod.CREDIT_CARD // Fix: should be paymentMethod
  };

  try {
    const response = await firstValueFrom(
      this.paymentService.createPaymentIntent(paymentData)
    );
    
    if (response) {
      this.clientSecret = response.clientSecret || '';
      this.paymentId = response.paymentId;
      
      const elementsCreated = await this.stripeService.createElements(this.clientSecret);
      if (elementsCreated) {
        // Wait for the view to update before mounting
        setTimeout(() => this.mountStripeElements(), 100);
      } else {
        this.showError('Failed to initialize payment form');
      }
    }
  } catch (error: any) {
    this.showError('Failed to initialize payment: ' + error.message);
  } finally {
    this.isLoading = false;
  }
}

  private mountStripeElements(): void {
    if (this.cardElementMounted) return;
    
    const mounted = this.stripeService.mountCardElement('card-element');
    if (mounted) {
      this.cardElementMounted = true;
    } else {
      this.showError('Failed to load payment form');
    }
  }

  async processPayment(): Promise<void> {
    if (!this.selectedMethod) {
      this.showError('Please select a payment method');
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
    throw new Error('Payment not properly initialized');
  }

  const result = await this.stripeService.confirmPayment(this.clientSecret, this.billingDetails);
  
  if (result.success && result.paymentIntent) {
    // Confirm payment on backend - fix the parameter mismatch
    const payment = await firstValueFrom(
      this.paymentService.confirmPayment(
        result.paymentIntent.id, // This should be the transaction ID
        result.paymentIntent.amount / 100 // Convert from cents to currency units
      )
    );
    
    if (payment) {
      this.showSuccess('Payment successful!');
      this.navigateToConfirmation(payment.data);
    }
  } else {
    throw new Error(result.error?.message || 'Payment failed');
  }
}
private async processNonCardPayment(): Promise<void> {
  if (!this.paymentId) {
    // Create payment for non-card methods
    const paymentData = {
      deliveryId: this.getDeliveryId(),
      clientId: this.getCurrentUserId(),
      amount: Math.round(this.totalAmount * 100),
      currency: this.currency.toLowerCase(),
      paymentMethod: this.selectedMethod! // Fix: should be paymentMethod, not method
    };

    const intentResponse = await firstValueFrom(
      this.paymentService.createPaymentIntent(paymentData)
    );
    
    if (intentResponse) {
      this.paymentId = intentResponse.paymentId;
    }
  }

  const payment = await firstValueFrom(
    this.paymentService.processNonCardPayment(this.paymentId)
  );
  
  if (payment) {
    this.showSuccess('Payment initiated successfully!');
    this.navigateToConfirmation(payment.data);
  }
}

  private validateForm(): boolean {
    if (this.showCardForm) {
      if (!this.billingDetails.name.trim()) {
        this.showError('Please enter cardholder name');
        return false;
      }
      if (!this.billingDetails.email.trim()) {
        this.showError('Please enter email address');
        return false;
      }
    }
    return true;
  }

  private navigateToConfirmation(payment: Payment): void {
    // Clear cart
    this.cartService.clearCart();
    
    // Navigate to confirmation page
    this.router.navigate(['/payment/confirmation'], {
      queryParams: { paymentId: payment.id }
    });
  }

  private showError(message: string): void {
    this.paymentError = message;
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  getMethodName(methodId: PaymentMethod): string {
    const method = this.paymentMethods.find(m => m.id === methodId);
    return method ? method.name : methodId;
  }

  private getDeliveryId(): string {
    // TODO: Get actual delivery ID from your app state/service
    return 'temp-delivery-id';
  }

  private getCurrentUserId(): string {
    // TODO: Get actual user ID from your auth service
    return 'current-user-id';
  }

   public navigateToCart(): void {
    this.router.navigate(['/cart']);
  }
}