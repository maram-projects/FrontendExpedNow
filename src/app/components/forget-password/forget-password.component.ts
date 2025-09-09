import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-forget-password',
  templateUrl: './forget-password.component.html',
  styleUrls: ['./forget-password.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatProgressSpinnerModule
  ]
})
export class ForgetPasswordComponent {
  forgetForm: FormGroup;
  error: string = '';
  loading: boolean = false;
  emailSent: boolean = false;
  emailAddress: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.forgetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit() {
    if (this.forgetForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const email = this.forgetForm.get('email')?.value;
    this.emailAddress = email;

    this.authService.forgotPassword(email).subscribe({
      next: (response) => {
        this.loading = false;
        this.emailSent = true;
        // Optionally disable the form after successful submission
        this.forgetForm.disable();
      },
      error: (error) => {
        this.loading = false;
        this.error = error.message || 'Failed to send reset instructions. Please try again.';
      }
    });
  }

  private markFormGroupTouched() {
    Object.keys(this.forgetForm.controls).forEach(key => {
      const control = this.forgetForm.get(key);
      control?.markAsTouched();
    });
  }

  resendEmail() {
    if (this.emailAddress) {
      this.emailSent = false;
      this.forgetForm.enable();
      this.forgetForm.patchValue({ email: this.emailAddress });
      this.onSubmit();
    }
  }

  goBackToLogin() {
    this.router.navigate(['/login']);
  }
}