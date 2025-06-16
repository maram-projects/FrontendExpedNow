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
  
  // Mock cart items (optional - for future use)
  private cartItems: any[] = [];

  constructor() {}

  // Return a fixed amount for testing the payment component
  getTotalAmount(): number {
    return this.mockTotalAmount;
  }

  // Clear the cart after successful payment
  clearCart(): void {
    this.cartItems = [];
    console.log('Cart cleared successfully');
    // In a real implementation, you might also:
    // - Clear cart data from localStorage/sessionStorage
    // - Emit an event to notify other components
    // - Update cart count in the UI
    // - Make API call to clear server-side cart
  }

  // Optional: Additional methods you might need in the future
  getCartItems(): any[] {
    return this.cartItems;
  }

  getCartItemsCount(): number {
    return this.cartItems.length;
  }

  // Method to update the mock total amount if needed for testing
  setMockTotal(amount: number): void {
    this.mockTotalAmount = amount;
  }
}