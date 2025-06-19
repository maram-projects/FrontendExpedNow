// payment-method.component.ts
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { firstValueFrom, Subscription } from 'rxjs';

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
  cardErrors: string = '';
  cardElementMounted: boolean = false;
  
  private subscriptions = new Subscription();
  
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
    const stripeSub = this.stripeService.isInitialized$.subscribe(initialized => {
      console.log('Stripe initialization status:', initialized);
      this.stripeInitialized = initialized;
      if (!initialized) {
        this.showError('Payment system initialization failed');
      }
    });
    
    this.subscriptions.add(stripeSub);
  }

  ngAfterViewInit(): void {
    // Wait for view to be ready before mounting Stripe elements
    setTimeout(() => {
      if (this.showCardForm && this.clientSecret && !this.cardElementMounted && this.stripeInitialized) {
        this.mountStripeElements();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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
    // First ensure Stripe is ready
    const isStripeReady = await this.stripeService.ensureReady();
    if (!isStripeReady) {
      this.showError('Payment system not ready. Please try again.');
      return;
    }

    this.isLoading = true;
    
    const paymentData = {
      deliveryId: this.getDeliveryId(),
      clientId: this.getCurrentUserId(),
      amount: Math.round(this.totalAmount * 100), // Convert to cents
      currency: this.currency.toLowerCase(),
      paymentMethod: PaymentMethod.CREDIT_CARD
    };

    try {
      const response = await firstValueFrom(
        this.paymentService.createPaymentIntent(paymentData)
      );
      
      if (response && response.clientSecret) {
        this.clientSecret = response.clientSecret;
        this.paymentId = response.paymentId;
        
        console.log('Payment intent created, client secret:', this.clientSecret);
        
        // Create elements and wait for them
        const elementsCreated = await this.stripeService.createElements(this.clientSecret);
        if (elementsCreated) {
          // Wait for the view to update before mounting
          setTimeout(() => this.mountStripeElements(), 200);
        } else {
          this.showError('Failed to initialize payment form');
        }
      } else {
        this.showError('Failed to initialize payment - no client secret received');
      }
    } catch (error: any) {
      console.error('Payment intent creation error:', error);
      this.showError('Failed to initialize payment: ' + (error.message || 'Unknown error'));
    } finally {
      this.isLoading = false;
    }
  }

  private async mountStripeElements(): Promise<void> {
    if (this.cardElementMounted) {
      console.log('Card element already mounted');
      return;
    }

    try {
      console.log('Attempting to mount Stripe elements...');
      
      // 1. Ensure Stripe is ready
      const isReady = await this.stripeService.ensureStripeReady();
      if (!isReady) {
        throw new Error('Stripe not ready');
      }
      
      // 2. Create card element if not exists
      if (!this.stripeService.card) {
        console.log('Creating card element...');
        const cardCreated = await this.stripeService.createCardElement(this.clientSecret);
        if (!cardCreated) {
          throw new Error('Failed to create card element');
        }
      }
      
      // 3. Check if DOM element exists
      const cardElement = document.getElementById('card-element');
      if (!cardElement) {
        throw new Error('Card element container not found in DOM');
      }
      
      // 4. Mount the card
      console.log('Mounting card element...');
      const mounted = this.stripeService.mountCardElement('card-element');
      if (!mounted) {
        throw new Error('Failed to mount card element');
      }
      
      this.cardElementMounted = true;
      console.log('Card element mounted successfully');
      
      // 5. Listen for changes
      if (this.stripeService.card) {
        this.stripeService.card.on('change', (event) => {
          this.cardErrors = event.error?.message || '';
        });
      }
      
    } catch (error) {
      console.error('Failed to mount Stripe elements:', error);
      this.showError('Failed to load payment form. Please refresh the page.');
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
      console.error('Payment processing error:', error);
      this.showError('Payment failed: ' + (error.message || 'Unknown error'));
    } finally {
      this.paymentProcessing = false;
    }
  }

  async processCardPayment(): Promise<void> {
    if (!this.clientSecret) {
      this.showError('Payment session not initialized');
      return;
    }

    // Ensure Stripe is fully ready
    try {
      const isReady = await this.stripeService.ensureReady();
      if (!isReady) {
        this.showError('Payment system is still initializing. Please try again.');
        return;
      }

      if (!this.stripeService.card) {
        this.showError('Payment form not properly loaded. Please refresh the page.');
        return;
      }

      console.log('Processing card payment...');
      this.paymentProcessing = true;
      
      const stripe = await this.stripeService.stripePromise;
      if (!stripe) throw new Error('Stripe not available');

      // Create payment method
      const { paymentMethod, error: createError } = await stripe.createPaymentMethod({
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

      if (createError) {
        console.error('Payment method creation error:', createError);
        throw createError;
      }
      
      if (!paymentMethod) throw new Error('Failed to create payment method');

      console.log('Payment method created:', paymentMethod.id);

      // Confirm payment
      const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
        this.clientSecret,
        {
          payment_method: paymentMethod.id,
          receipt_email: this.billingDetails.email
        }
      );

      if (confirmError) {
        console.error('Payment confirmation error:', confirmError);
        throw confirmError;
      }
      
      if (!paymentIntent) throw new Error('No payment intent received');

      console.log('Payment confirmed:', paymentIntent.id);

      // Handle successful payment
      const payment = await firstValueFrom(
        this.paymentService.confirmPayment(
          paymentIntent.id,
          paymentIntent.amount / 100
        )
      );

      this.handlePaymentSuccess(payment.data.id);
      
    } catch (error: any) {
      console.error('Payment error:', error);
      this.showError(error.message || 'Payment failed');
    } finally {
      this.paymentProcessing = false;
    }
  }

  private handlePaymentSuccess(paymentId: string): void {
    this.showSuccess('Payment successful!');
    this.cartService.clearCart();
    this.router.navigate(['/payment/confirmation'], {
      queryParams: { 
        paymentId,
        success: 'true'
      }
    });
  }

  private async processNonCardPayment(): Promise<void> {
    if (!this.paymentId) {
      // Create payment for non-card methods
      const paymentData = {
        deliveryId: this.getDeliveryId(),
        clientId: this.getCurrentUserId(),
        amount: Math.round(this.totalAmount * 100),
        currency: this.currency.toLowerCase(),
        paymentMethod: this.selectedMethod!
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