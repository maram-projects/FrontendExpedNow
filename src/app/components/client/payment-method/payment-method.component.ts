import { Component, OnInit } from '@angular/core';
import { PaymentService } from '../../../services/payment.service';
import { PaymentMethod, PaymentMethodOption } from '../../../models/Payment.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-payment-method',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payment-method.component.html',
  styleUrls: ['./payment-method.component.css']
})
export class PaymentMethodComponent implements OnInit {
  paymentMethods: PaymentMethodOption[] = [];
  selectedMethod: PaymentMethod | null = null; // تغيير من string إلى PaymentMethod
  cardDetails = {
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  };
  showCardForm = false;
  totalAmount = 0;
  isLoading = false; // إضافة الخاصية المفقودة

  constructor(
    private paymentService: PaymentService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.paymentMethods = this.paymentService.getAvailablePaymentMethods();
    this.totalAmount = this.cartService.getTotalAmount();
  }

  selectMethod(methodId: PaymentMethod): void { // تغيير نوع الباراميتر
    this.selectedMethod = methodId;
    this.showCardForm = methodId === PaymentMethod.CREDIT_CARD;
  }

  getMethodName(methodId: PaymentMethod): string {
    const method = this.paymentMethods.find(m => m.id === methodId);
    return method ? method.name : methodId;
  }

  processPayment(): void {
    if (!this.selectedMethod) {
      alert('Please select a payment method');
      return;
    }

    this.isLoading = true;
    const deliveryId = 'temp-delivery-id'; 
    const clientId = 'current-user-id';

    this.paymentService.createPayment({
      deliveryId,
      clientId,
      amount: this.totalAmount,
      method: this.selectedMethod // تم إصلاح نوع البيانات هنا
    }).subscribe({
      next: (payment) => {
        const paymentDetails = this.selectedMethod === PaymentMethod.CREDIT_CARD 
          ? this.cardDetails 
          : {};

        this.paymentService.processPayment(
          payment.id, 
          this.selectedMethod!, // تأكيد أن القيمة ليست null
          paymentDetails
        ).subscribe({
          next: (processedPayment) => {
            this.isLoading = false;
            alert('Payment successful!');
            // التوجيه لصفحة التأكيد هنا
          },
          error: (err) => {
            this.isLoading = false;
            alert('Payment failed: ' + err.message);
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        alert('Failed to create payment: ' + err.message);
      }
    });
  }
}