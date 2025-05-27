import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PaymentService } from '../../../services/payment.service';
import { DiscountService } from '../../../services/discount.service';
import { PaymentMethod, PaymentMethodOption } from '../../../models/Payment.model';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PricingService } from '../../../services/pricing.service';
import { PricingDetailsComponent } from "../pricing-details/pricing-details.component";

@Component({
  selector: 'app-payment-dialog',
  templateUrl: './payment-dialog.component.html',
  styleUrls: ['./payment-dialog.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PricingDetailsComponent]
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
    private discountService: DiscountService,
    private pricingService: PricingService,

  ) {}

  ngOnInit(): void {
    this.paymentMethods = this.paymentService.getAvailablePaymentMethods();
    this.loadPricingDetails();
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

 // في PaymentDialogComponent
processPayment(): void {
  if (!this.selectedMethod) {
    this.discountError = 'Please select a payment method';
    return;
  }

  this.loading = true;
  
  const paymentData = {
    deliveryId: this.data.delivery.id,
    amount: this.data.delivery.finalAmountAfterDiscount || this.data.delivery.amount,
    method: this.selectedMethod,
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

  // payment-dialog.component.ts
loadPricingDetails() {
  this.loading = true;
  this.discountError = '';

  if (!this.data?.delivery) {
    this.discountError = 'بيانات الطلب غير موجودة';
    this.loading = false;
    return;
  }

  // التحقق من الحقول المطلوبة
  if (!this.validateDeliveryRequest(this.data.delivery)) {
    this.discountError = 'بيانات الطلب غير مكتملة';
    this.loading = false;
    return;
  }

  this.pricingService.calculatePricing(this.data.delivery).subscribe({
    next: (pricing) => {
      this.data.delivery.pricingDetails = pricing || this.getDefaultPricing();
      this.data.delivery.amount = pricing?.totalAmount || 0;
      this.data.delivery.finalAmountAfterDiscount = this.data.delivery.amount;
      this.loading = false;
    },
    error: (err) => {
      console.error('Pricing calculation error:', err);
      this.data.delivery.pricingDetails = this.getDefaultPricing();
      this.data.delivery.amount = 0;
      this.data.delivery.finalAmountAfterDiscount = 0;
      this.discountError = this.getErrorMessage(err);
      this.loading = false;
    }
  });
}

private validateDeliveryRequest(delivery: any): boolean {
  return !!delivery.pickupAddress && 
         !!delivery.deliveryAddress &&
         !!delivery.packageDescription &&
         delivery.packageWeight > 0 &&
         delivery.pickupLatitude !== undefined &&
         delivery.pickupLongitude !== undefined &&
         delivery.deliveryLatitude !== undefined &&
         delivery.deliveryLongitude !== undefined;
}

private getDefaultPricing(): any {
  return {
    distance: 0,
    basePrice: 0,
    distanceCost: 0,
    weightCost: 0,
    urgencyFee: 0,
    peakSurcharge: 0,
    holidaySurcharge: 0,
    discountAmount: 0,
    totalAmount: 0,
    appliedRules: []
  };
}

private getErrorMessage(error: any): string {
  if (error.message.includes('JSON parse error')) {
    return 'خطأ في تنسيق البيانات المرسلة';
  }
  return error.error?.message || error.message || 'حدث خطأ غير متوقع';
}
}