import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Payment } from '../../../models/Payment.model';
import { PaymentService } from '../../../services/payment.service';

@Component({
  selector: 'app-payment-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-details.component.html',
  styleUrls: ['./payment-details.component.css'],
  providers: [DatePipe, DecimalPipe]
})
export class PaymentDetailsComponent implements OnInit {
  payment: Payment | null = null;
  isLoading = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router, // Added missing Router import and injection
    private paymentService: PaymentService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadPaymentDetails();
  }

  async loadPaymentDetails(): Promise<void> {
    this.isLoading = true;
    const paymentId = this.route.snapshot.paramMap.get('id');
        
    if (!paymentId) {
      this.errorMessage = 'Invalid payment ID';
      this.isLoading = false;
      return;
    }

    try {
      const response = await firstValueFrom(this.paymentService.getPaymentDetails(paymentId));
      if (response.success && response.data) {
        this.payment = response.data;
      } else {
        this.errorMessage = response.message || 'Failed to load payment details';
      }
    } catch (error: any) {
      this.errorMessage = error.message || 'Error loading payment details';
    } finally {
      this.isLoading = false;
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return this.datePipe.transform(date, 'medium') || 'N/A';
  }

async refundPayment(): Promise<void> {
  if (!this.payment) return;
  
  if (confirm('Are you sure you want to refund this payment?')) {
    try {
      this.isLoading = true;
      
      // Get currency from payment or default to TND
      const currency = this.payment.currency || 'TND';
      
      const response = await firstValueFrom(
        this.paymentService.refundPayment(
          this.payment.id,
          this.payment.finalAmountAfterDiscount, // Pass the amount
          currency // Pass the currency
        )
      );
      
      if (response.success) {
        // Reload payment details to show updated status
        await this.loadPaymentDetails();
        alert('Payment refunded successfully');
      } else {
        alert('Failed to refund payment: ' + response.message);
      }
    } catch (error: any) {
      alert('Error refunding payment: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }
}

  async cancelPayment(): Promise<void> {
    if (!this.payment) return;
    
    if (confirm('Are you sure you want to cancel this payment?')) {
      try {
        this.isLoading = true;
        const response = await firstValueFrom(this.paymentService.cancelPayment(this.payment.id));
        if (response.success) {
          // Reload payment details to show updated status
          await this.loadPaymentDetails();
          alert('Payment cancelled successfully');
        } else {
          alert('Failed to cancel payment: ' + response.message);
        }
      } catch (error: any) {
        alert('Error cancelling payment: ' + error.message);
      } finally {
        this.isLoading = false;
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/payments']);
  }
}