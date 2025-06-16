import { Injectable } from '@angular/core';
import { loadStripe, Stripe, StripeElements, StripeCardElement, StripeError } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

interface PaymentResult {
  success: boolean;
  error?: {
    message: string;
    code?: string;
    type?: string;
  };
  paymentIntent?: any;
}

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private stripePromise: Promise<Stripe | null>;
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;
  private isInitialized = new BehaviorSubject<boolean>(false);

  public isInitialized$ = this.isInitialized.asObservable();

  constructor() {
    this.stripePromise = loadStripe(environment.stripePublishableKey);
    this.initializeStripe();
  }

  private async initializeStripe(): Promise<void> {
    try {
      this.stripe = await this.stripePromise;
      if (this.stripe) {
        this.isInitialized.next(true);
        console.log('Stripe initialized successfully');
      } else {
        throw new Error('Failed to load Stripe');
      }
    } catch (error) {
      console.error('Error initializing Stripe:', error);
      this.isInitialized.next(false);
    }
  }

  async createElements(clientSecret: string): Promise<boolean> {
    if (!this.stripe) {
      await this.initializeStripe();
    }

    if (!this.stripe) {
      return false;
    }

    try {
      this.elements = this.stripe.elements({
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#4361ee',
            colorBackground: '#ffffff',
            colorText: '#2b2d42',
            borderRadius: '12px'
          }
        }
      });

      this.cardElement = this.elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#424770',
            '::placeholder': {
              color: '#aab7c4',
            },
          },
          invalid: {
            color: '#9e2146',
          },
        },
      });

      return true;
    } catch (error) {
      console.error('Error creating Stripe elements:', error);
      return false;
    }
  }

  mountCardElement(elementId: string): boolean {
    if (!this.cardElement) {
      console.error('Card element not created');
      return false;
    }

    try {
      const element = document.getElementById(elementId);
      if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return false;
      }

      this.cardElement.mount(`#${elementId}`);
      return true;
    } catch (error) {
      console.error('Error mounting card element:', error);
      return false;
    }
  }

  async confirmPayment(clientSecret: string, billingDetails: any): Promise<PaymentResult> {
    if (!this.stripe || !this.cardElement) {
      return { 
        success: false,
        error: { 
          message: 'Stripe not properly initialized',
          code: 'stripe_not_initialized'
        } 
      };
    }

    try {
      const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: billingDetails
        }
      });

      if (error) {
        return {
          success: false,
          error: {
            message: error.message || 'Payment failed',
            code: error.code,
            type: error.type
          }
        };
      }

      return { 
        success: true, 
        paymentIntent 
      };
    } catch (err) {
      const stripeError = err as StripeError;
      return {
        success: false,
        error: {
          message: stripeError.message || 'Unknown error during payment confirmation',
          code: stripeError.code,
          type: stripeError.type
        }
      };
    }
  }

  destroy(): void {
    if (this.cardElement) {
      this.cardElement.destroy();
      this.cardElement = null;
    }
    this.elements = null;
  }
}