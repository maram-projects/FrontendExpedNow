// payment-success-modal.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { DeliveryService } from '../../services/delivery-service.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-payment-success-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="payment-success-modal">
      <!-- Animated Success Icon -->
      <div class="success-animation">
        <div class="checkmark-circle">
          <div class="checkmark"></div>
        </div>
      </div>

      <!-- Fun Success Message -->
      <div class="success-content">
        <h2 class="success-title">🎉 Woohoo! Payment Complete! 🎉</h2>
        <p class="success-subtitle">Your delivery is now on its way to making your day awesome!</p>
        
        <!-- Payment Details Card -->
        <div class="payment-details-card">
          <div class="payment-row">
            <span class="label">💰 Amount Paid:</span>
            <span class="value">{{ data.amount | currency:'TND':'symbol':'1.2-2' }}</span>
          </div>
          <div class="payment-row">
            <span class="label">💳 Payment Method:</span>
            <span class="value">{{ data.paymentMethod }}</span>
          </div>
          <div class="payment-row" *ngIf="data.transactionId">
            <span class="label">🔢 Transaction ID:</span>
            <span class="value transaction-id">{{ data.transactionId }}</span>
          </div>
        </div>

        <!-- Fun Messages Section -->
        <div class="fun-messages">
          <div class="message-card welcome-card">
            <div class="message-icon">🚀</div>
            <div class="message-content">
              <h4>Welcome to the ExpedNow Family!</h4>
              <p>You're now part of our amazing delivery community. Get ready for lightning-fast deliveries! ⚡</p>
            </div>
          </div>

          <div class="message-card rating-card">
            <div class="message-icon">⭐</div>
            <div class="message-content">
              <h4>Love Our Service? Share the Joy!</h4>
              <p>Your smile is our fuel! Rate us and let others know about your awesome experience! 😊</p>
              <div class="rating-stars">
                <span class="star" *ngFor="let star of [1,2,3,4,5]">⭐</span>
              </div>
            </div>
          </div>

          <div class="message-card social-card">
            <div class="message-icon">🌟</div>
            <div class="message-content">
              <h4>Spread the Word!</h4>
              <p>Tell your friends about ExpedNow and make their deliveries magical too! 🎭</p>
            </div>
          </div>
        </div>

        <!-- Call to Action -->
        <div class="cta-section">
          <p class="cta-text">
            <span class="emoji">🎪</span>
            <strong>Ready for your next adventure?</strong>
            <span class="emoji">🎪</span>
          </p>
          <p class="cta-subtext">Book another delivery and let the magic continue!</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="actions">
        <button mat-stroked-button class="btn-secondary" (click)="downloadReceipt()">
          <mat-icon>receipt</mat-icon>
          Download Receipt
        </button>
        <button mat-raised-button color="primary" class="btn-primary" (click)="rateService()">
          <mat-icon>star</mat-icon>
          Rate Our Service
        </button>
        <button mat-button class="btn-close" (click)="close()">
          Continue Exploring
        </button>
      </div>

      <!-- Floating Emojis Animation -->
      <div class="floating-emojis">
        <span class="floating-emoji" style="animation-delay: 0s;">🎉</span>
        <span class="floating-emoji" style="animation-delay: 0.5s;">🚀</span>
        <span class="floating-emoji" style="animation-delay: 1s;">⭐</span>
        <span class="floating-emoji" style="animation-delay: 1.5s;">🎊</span>
        <span class="floating-emoji" style="animation-delay: 2s;">💝</span>
      </div>
    </div>
  `,
  styles: [`
    .payment-success-modal {
      position: relative;
      text-align: center;
      padding: 32px 24px;
      max-width: 600px;
      min-height: 500px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 20px;
      overflow: hidden;
    }

    /* Success Animation */
    .success-animation {
      margin-bottom: 24px;
    }

    .checkmark-circle {
      width: 80px;
      height: 80px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    }

    .checkmark {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #4caf50;
      position: relative;
      animation: scaleIn 0.5s ease-in-out;
    }

    .checkmark::after {
      content: '';
      position: absolute;
      left: 15px;
      top: 8px;
      width: 8px;
      height: 16px;
      border: solid white;
      border-width: 0 3px 3px 0;
      transform: rotate(45deg);
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    @keyframes scaleIn {
      0% { transform: scale(0); }
      100% { transform: scale(1); }
    }

    /* Content Styling */
    .success-content {
      margin-bottom: 32px;
    }

    .success-title {
      font-size: 28px;
      font-weight: bold;
      margin: 0 0 8px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      animation: bounceIn 0.8s ease-out;
    }

    .success-subtitle {
      font-size: 16px;
      margin: 0 0 24px;
      opacity: 0.9;
      animation: fadeInUp 1s ease-out 0.3s both;
    }

    @keyframes bounceIn {
      0% { transform: scale(0.3); opacity: 0; }
      50% { transform: scale(1.05); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes fadeInUp {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    /* Payment Details Card */
    .payment-details-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 20px;
      margin: 24px 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      animation: slideInLeft 0.8s ease-out 0.5s both;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 8px 0;
    }

    .payment-row:last-child {
      margin-bottom: 0;
    }

    .label {
      font-weight: 500;
      opacity: 0.9;
    }

    .value {
      font-weight: bold;
      font-size: 16px;
    }

    .transaction-id {
      font-family: monospace;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 8px;
      border-radius: 6px;
    }

    /* Fun Messages */
    .fun-messages {
      margin: 32px 0;
      animation: slideInRight 0.8s ease-out 0.7s both;
    }

    .message-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      display: flex;
      align-items: flex-start;
      text-align: left;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.3s ease, background 0.3s ease;
    }

    .message-card:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.2);
    }

    .message-icon {
      font-size: 32px;
      margin-right: 16px;
      flex-shrink: 0;
    }

    .message-content h4 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: bold;
    }

    .message-content p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
      line-height: 1.4;
    }

    .rating-stars {
      margin-top: 8px;
    }

    .star {
      font-size: 18px;
      margin-right: 4px;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .star:hover {
      transform: scale(1.2);
    }

    /* CTA Section */
    .cta-section {
      margin: 24px 0;
      animation: fadeIn 1s ease-out 1s both;
    }

    .cta-text {
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 8px;
    }

    .cta-subtext {
      font-size: 14px;
      opacity: 0.8;
      margin: 0;
    }

    .emoji {
      margin: 0 8px;
      font-size: 20px;
    }

    /* Action Buttons */
    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: slideInUp 0.8s ease-out 1.2s both;
    }

    .btn-primary {
      background: linear-gradient(45deg, #ff6b6b, #ee5a24) !important;
      color: white !important;
      font-weight: bold;
      padding: 12px 24px;
      border-radius: 25px;
      text-transform: none;
      font-size: 16px;
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
      transition: all 0.3s ease;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 107, 107, 0.6);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.2) !important;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      font-weight: 500;
      padding: 10px 20px;
      border-radius: 20px;
      text-transform: none;
    }

    .btn-close {
      color: rgba(255, 255, 255, 0.8) !important;
      text-transform: none;
      font-weight: 500;
    }

    /* Floating Emojis Animation */
    .floating-emojis {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    }

    .floating-emoji {
      position: absolute;
      font-size: 24px;
      animation: float 6s infinite linear;
      opacity: 0;
    }

    .floating-emoji:nth-child(1) { left: 10%; }
    .floating-emoji:nth-child(2) { left: 20%; }
    .floating-emoji:nth-child(3) { left: 50%; }
    .floating-emoji:nth-child(4) { left: 70%; }
    .floating-emoji:nth-child(5) { left: 85%; }

    @keyframes float {
      0% {
        transform: translateY(100vh) rotate(0deg);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translateY(-100px) rotate(360deg);
        opacity: 0;
      }
    }

    @keyframes slideInLeft {
      0% { opacity: 0; transform: translateX(-50px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    @keyframes slideInRight {
      0% { opacity: 0; transform: translateX(50px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    @keyframes slideInUp {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }

    /* Responsive Design */
    @media (max-width: 480px) {
      .payment-success-modal {
        padding: 24px 16px;
        max-width: 100%;
      }

      .success-title {
        font-size: 24px;
      }

      .message-card {
        flex-direction: column;
        text-align: center;
      }

      .message-icon {
        margin: 0 0 12px 0;
      }

      .actions {
        gap: 8px;
      }
    }
  `]
})
export class PaymentSuccessModalComponent {
  constructor(
    public dialogRef: MatDialogRef<PaymentSuccessModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      deliveryId: string;
      amount: number;
      paymentMethod: string;
      transactionId?: string;
    },
    private deliveryService: DeliveryService
  ) {}

  downloadReceipt(): void {
    this.deliveryService.downloadReceipt(this.data.deliveryId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${this.data.deliveryId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success message
        console.log('Receipt downloaded successfully! 📄✨');
      },
      error: (err) => {
        console.error('Error downloading receipt:', err);
        alert('Oops! We couldn\'t download your receipt right now. Please try again later or contact our support team! 😊');
      }
    });
  }

  rateService(): void {
    // This could open a rating dialog or navigate to a rating page
    console.log('Opening rating interface...');
    
    // For now, show a simple alert - you can replace this with actual rating logic
    alert('⭐ Thank you for wanting to rate us! We\'ll redirect you to our rating page soon! Your feedback means the world to us! 🌟');
    
    // You could implement:
    // - Open another dialog for rating
    // - Navigate to a rating page
    // - Integrate with your rating service
  }

  close(): void {
    this.dialogRef.close();
  }
}