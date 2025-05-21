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
  selectedMethod: string = '';
  cardDetails: any = {
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  };
  showCardForm: boolean = false;
  totalAmount: number = 0;

  constructor(
    private paymentService: PaymentService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.paymentMethods = this.paymentService.getAvailablePaymentMethods();
    this.totalAmount = this.cartService.getTotalAmount();
  }

  selectMethod(methodId: string): void {
    this.selectedMethod = methodId;
    this.showCardForm = methodId === PaymentMethod.CREDIT_CARD;
  }

  // Add this method to fix the template error
  getMethodName(methodId: string): string {
    const method = this.paymentMethods.find(m => m.id === methodId);
    return method ? method.name : methodId;
  }

  processPayment(): void {
    // Here you would normally get the delivery ID from your order flow
    const deliveryId = 'temp-delivery-id'; 
    const clientId = 'current-user-id'; // Normally from your auth service

    // First create the payment record
    this.paymentService.createPayment({
      deliveryId: deliveryId,
      clientId: clientId,
      amount: this.totalAmount,
      method: this.selectedMethod as PaymentMethod
    }).subscribe({
      next: (payment) => {
        // Once payment is created, process it based on method
        if (this.selectedMethod === PaymentMethod.CREDIT_CARD) {
          this.paymentService.processPayment(payment.id, this.cardDetails).subscribe({
            next: (processedPayment) => {
              alert('Payment successful!');
              // Navigate to order confirmation or clear cart
              // this.router.navigate(['/order-confirmation', processedPayment.id]);
            },
            error: (err) => alert('Payment failed: ' + err.message)
          });
        } else if (this.selectedMethod === PaymentMethod.BANK_TRANSFER) {
          // For bank transfer, just show instructions
          alert(`Payment ID: ${payment.id}. Please complete your bank transfer using the reference number and follow the instructions.`);
          // this.router.navigate(['/bank-transfer-instructions', payment.id]);
        } else {
          // For cash on delivery
          alert('Order placed successfully. You will pay when you receive your order.');
          // this.router.navigate(['/order-confirmation', payment.id]);
        }
      },
      error: (err) => {
        alert('Failed to create payment: ' + err.message);
      }
    });
  }
}