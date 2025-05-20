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
  message: string = '';
  error: string = '';
  loading: boolean = false;
  successMessage: string = ''; 

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
    if (this.forgetForm.invalid) { // Changed from forgotPasswordForm to forgetForm
      return;
    }
  
  
    this.loading = true;
    const email = this.forgetForm.get('email')?.value; // Changed from forgotPasswordForm to forgetForm
  
    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.successMessage = 'Password reset instructions sent to your email';
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Failed to send reset instructions';
        this.loading = false;
      }
    });
  }
}