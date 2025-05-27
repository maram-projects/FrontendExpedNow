// stripe.service.ts
import { Injectable } from '@angular/core';
import { loadStripe } from '@stripe/stripe-js';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  stripePromise = loadStripe('your-publishable-key');

  async getStripe() {
    return await this.stripePromise;
  }
}