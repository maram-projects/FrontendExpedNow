import { Injectable } from '@angular/core';

/**
 * Mock Cart Service
 * 
 * This is a minimal implementation just to satisfy Angular dependency injection
 * and provide the basic functionality required by the PaymentMethodComponent.
 * 
 * No backend integration is needed for this service.
 */
@Injectable({
  providedIn: 'root'
})
export class CartService {
  // Fixed mock total amount - you can replace this with any value you need for testing
  private mockTotalAmount = 250;

  constructor() {}

  // Return a fixed amount for testing the payment component
  getTotalAmount(): number {
    return this.mockTotalAmount;
  }
}