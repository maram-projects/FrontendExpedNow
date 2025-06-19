import { Injectable } from '@angular/core';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  public stripePromise: Promise<Stripe | null>;
  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  card: StripeCardElement | null = null;
  
  private _isInitialized = new BehaviorSubject<boolean>(false);
  public isInitialized$ = this._isInitialized.asObservable();

  constructor() {
    this.stripePromise = loadStripe(environment.stripePublishableKey);
    this.initializeStripe();
  }

  private async initializeStripe(): Promise<void> {
    try {
      this.stripe = await this.stripePromise;
      if (this.stripe) {
        console.log('Stripe initialized successfully');
        this._isInitialized.next(true);
      } else {
        throw new Error('Stripe failed to initialize');
      }
    } catch (error) {
      console.error('Stripe initialization error:', error);
      this._isInitialized.next(false);
    }
  }

  async ensureReady(): Promise<boolean> {
    if (this._isInitialized.value && this.stripe) {
      return true;
    }
    
    try {
      this.stripe = await this.stripePromise;
      const isReady = !!this.stripe;
      this._isInitialized.next(isReady);
      return isReady;
    } catch (error) {
      console.error('Error ensuring Stripe is ready:', error);
      this._isInitialized.next(false);
      return false;
    }
  }

  async ensureStripeReady(): Promise<boolean> {
    return this.ensureReady();
  }

  async createElements(clientSecret: string): Promise<StripeElements | null> {
    const isReady = await this.ensureReady();
    if (!isReady || !this.stripe) {
      console.error('Stripe not ready for creating elements');
      return null;
    }

    try {
      this.elements = this.stripe.elements({ 
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#6772e5',
          }
        }
      });
      return this.elements;
    } catch (error) {
      console.error('Error creating Stripe elements:', error);
      return null;
    }
  }

  async createCardElement(clientSecret: string): Promise<boolean> {
    const isReady = await this.ensureReady();
    if (!isReady || !this.stripe) {
      console.error('Stripe not ready for creating card element');
      return false;
    }

    try {
      // Create elements if not exists
      if (!this.elements) {
        this.elements = await this.createElements(clientSecret);
      }
      
      if (!this.elements) {
        throw new Error('Failed to create Stripe elements');
      }
      
      // Create card element
      this.card = this.elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#32325d',
            '::placeholder': {
              color: '#aab7c4'
            }
          },
          invalid: {
            color: '#fa755a',
            iconColor: '#fa755a'
          }
        }
      });

      return true;
    } catch (error) {
      console.error('Error creating card element:', error);
      return false;
    }
  }

  mountCardElement(elementId: string): boolean {
    if (!this.card) {
      console.error('Card element not created');
      return false;
    }

    try {
      const element = document.getElementById(elementId);
      if (!element) {
        console.error(`Element with ID '${elementId}' not found`);
        return false;
      }

      this.card.mount(`#${elementId}`);
      console.log('Card element mounted successfully');
      return true;
    } catch (error) {
      console.error('Error mounting card element:', error);
      return false;
    }
  }

  async confirmPayment(options: {
    elements: StripeElements;
    clientSecret: string;
    confirmParams: any;
  }): Promise<{paymentIntent?: any; error?: any}> {
    const isReady = await this.ensureReady();
    if (!isReady || !this.stripe) {
      return { error: { message: 'Stripe not initialized' } };
    }

    return this.stripe.confirmPayment(options);
  }    

  destroy(): void {
    if (this.card) {
      this.card.destroy();
      this.card = null;
    }
    this.elements = null;
  }
}