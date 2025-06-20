// payment-confirmation.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CommonModule } from '@angular/common';
import { ToastService } from '../../../services/toast.service';
import { PaymentService } from '../../../services/payment.service';
import { MatIconModule } from '@angular/material/icon';
import { filter, interval, switchMap, take, takeUntil, timer } from 'rxjs';
import { PaymentStatus } from '../../../models/Payment.model';

@Component({
  selector: 'app-payment-confirmation',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './payment-confirmation.component.html',
  styleUrls: ['./payment-confirmation.component.css']
})
export class PaymentConfirmationComponent implements OnInit {
  paymentId: string | null = null;
  isSuccess = false;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.paymentId = params['paymentId'] || null;
      this.isSuccess = params['success'] === 'true';

      if (this.paymentId && this.isSuccess) {
        this.verifyPayment();
      } else {
        this.isLoading = false;
      }
    });
  }

  verifyPayment(): void {
    if (!this.paymentId) return;

    this.paymentService.getPayment(this.paymentId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.data.status === 'COMPLETED') {
          this.isSuccess = true;
        } else {
          this.isSuccess = false;
          this.toastService.showError('Payment verification failed');
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.isSuccess = false;
        this.toastService.showError('Failed to verify payment: ' + err.message);
      }
    });
  }

  navigateToDashboard(): void {
    this.router.navigate(['/client/dashboard']);
  }
private pollPaymentStatus(paymentId: string): void {
  let attempts = 0;
  const maxAttempts = 10;
  const pollInterval = 2000; // 2 seconds

  const pollSubscription = interval(pollInterval).pipe(
    takeUntil(timer(pollInterval * maxAttempts)),
    switchMap(() => this.paymentService.getPaymentStatus(paymentId)),
    filter(response => response.status === PaymentStatus.COMPLETED),
    take(1)
  ).subscribe({
    next: () => {
      this.router.navigate(['/client/dashboard'], {
        queryParams: { 
          paymentSuccess: 'true',
          paymentId: paymentId,
          refresh: Date.now().toString()
        }
      });
    },
    complete: () => {
      pollSubscription.unsubscribe();
    }
  });
}
  
}