import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PaymentService } from '../../../services/payment.service';
import { DiscountService } from '../../../services/discount.service';
import { PaymentMethod, PaymentMethodOption } from '../../../models/Payment.model';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-payment-dialog',
  templateUrl: './payment-dialog.component.html',
  styleUrls: ['./payment-dialog.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule]
})
export class PaymentDialogComponent implements OnInit {
  paymentMethods: PaymentMethodOption[] = []; // Changed from PaymentMethod[] to PaymentMethodOption[]
  selectedMethod: PaymentMethod | null = null;
  discountCode: string = '';
  discountApplied = false;
  discountError = '';
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private paymentService: PaymentService,
    private discountService: DiscountService
  ) {}

  ngOnInit(): void {
    this.paymentMethods = this.paymentService.getAvailablePaymentMethods();
  }

  applyDiscount(): void {
    if (!this.discountCode) return;
    
    this.loading = true;
    this.discountError = '';
    
    this.discountService.validateDiscount(this.discountCode, this.data.clientId).subscribe({
      next: (discount) => {
        this.data.delivery.finalAmountAfterDiscount = 
          this.data.delivery.amount * (1 - discount.percentage / 100);
        this.discountApplied = true;
        this.loading = false;
      },
      error: (err) => {
        this.discountError = err.message || 'Invalid discount code';
        this.loading = false;
      }
    });
  }

  processPayment(): void {
    // Check if payment method is selected
    if (!this.selectedMethod) {
      this.discountError = 'Please select a payment method';
      return;
    }

    this.loading = true;
    
    const paymentData = {
      deliveryId: this.data.delivery.id,
      amount: this.data.delivery.finalAmountAfterDiscount || this.data.delivery.amount,
      method: this.selectedMethod, // Now guaranteed to be non-null
      clientId: this.data.clientId
    };

    this.paymentService.createPayment(paymentData).subscribe({
      next: (payment) => {
        this.dialogRef.close({ success: true, payment });
      },
      error: (err) => {
        this.discountError = 'Payment failed: ' + err.message;
        this.loading = false;
      }
    });
  }

  close(): void {
    this.dialogRef.close({ success: false });
  }
}