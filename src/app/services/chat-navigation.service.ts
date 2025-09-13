// Alternative simple version - services/chat-navigation.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatNavigationService {
  
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  /**
   * Navigate to client chat (explicitly for clients)
   */
  navigateToClientChat(deliveryId: string, deliveryPersonId: string): void {
    console.log(`Navigating to client chat: delivery=${deliveryId}, deliveryPerson=${deliveryPersonId}`);
    this.router.navigate(['/client/chat', deliveryId, deliveryPersonId]);
  }

  /**
   * Navigate to delivery chat (explicitly for delivery persons)
   */
  navigateToDeliveryChat(deliveryId: string, clientId: string): void {
    console.log(`Navigating to delivery chat: delivery=${deliveryId}, client=${clientId}`);
    this.router.navigate(['/delivery/chat', deliveryId, clientId]);
  }

  /**
   * Navigate based on current route context
   * Use this when you know the user context from the current page
   */
  navigateFromClientContext(deliveryId: string, deliveryPersonId: string): void {
    // User is on client pages, so navigate to client chat
    this.navigateToClientChat(deliveryId, deliveryPersonId);
  }

  /**
   * Navigate based on current route context
   * Use this when you know the user context from the current page
   */
  navigateFromDeliveryContext(deliveryId: string, clientId: string): void {
    // User is on delivery pages, so navigate to delivery chat
    this.navigateToDeliveryChat(deliveryId, clientId);
  }

  /**
   * Get current user info (without roles dependency)
   */
  private getCurrentUser(): any {
    return this.authService.getCurrentUser();
  }

  /**
   * Check if current user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }
}