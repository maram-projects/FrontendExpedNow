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
      <div class="success-icon">
        <mat-icon>check_circle</mat-icon>
      </div>
      <h2>Payment Successful!</h2>
      <div class="payment-details">
        <p><strong>Amount:</strong> {{ data.amount | currency:'TND':'symbol':'1.2-2' }}</p>
        <p><strong>Payment Method:</strong> {{ data.paymentMethod }}</p>
        <p *ngIf="data.transactionId"><strong>Transaction ID:</strong> {{ data.transactionId }}</p>
      </div>
      <div class="actions">
        <button mat-raised-button color="primary" (click)="downloadReceipt()">
          <mat-icon>receipt</mat-icon> Download Receipt
        </button>
        <button mat-button (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .payment-success-modal {
      text-align: center;
      padding: 24px;
      max-width: 500px;
    }
    .success-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      color: #4caf50;
      margin: 0 auto 16px;
    }
    .payment-details {
      text-align: left;
      margin: 24px 0;
      background: #f5f5f5;
      padding: 16px;
      border-radius: 4px;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    h2 {
      margin: 0 0 16px;
      color: #4caf50;
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
      },
      error: (err) => {
        console.error('Error downloading receipt:', err);
        alert('Failed to download receipt. Please try again later.');
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}