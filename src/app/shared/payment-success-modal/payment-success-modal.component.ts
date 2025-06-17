// payment-success-modal.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { DeliveryService } from '../../services/delivery-service.service';

@Component({
  selector: 'app-payment-success-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="payment-success-modal">
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h2>Payment Successful!</h2>
      <div class="payment-details">
        <p><strong>Delivery ID:</strong> {{ data.deliveryId | slice:0:8 }}</p>
        <p><strong>Amount:</strong> {{ data.amount | currency:'TND' }}</p>
        <p><strong>Payment Method:</strong> {{ data.paymentMethod }}</p>
      </div>
      <div class="actions">
        <button (click)="downloadReceipt()" class="btn btn-primary">
          <i class="fas fa-receipt"></i> Download Receipt
        </button>
        <button (click)="close()" class="btn btn-outline-primary">
          Close
        </button>
      </div>
    </div>
  `,
  styles: [`
    .payment-success-modal {
      text-align: center;
      padding: 2rem;
    }
    .success-icon {
      font-size: 4rem;
      color: #28a745;
      margin-bottom: 1rem;
    }
    .payment-details {
      text-align: left;
      margin: 1.5rem 0;
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 0.5rem;
    }
    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }
  `]
})
export class PaymentSuccessModalComponent {
  constructor(
    public dialogRef: MatDialogRef<PaymentSuccessModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private deliveryService: DeliveryService
  ) {}

  downloadReceipt(): void {
    this.deliveryService.downloadReceipt(this.data.deliveryId).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${this.data.deliveryId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}