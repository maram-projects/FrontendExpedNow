import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ]
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  token: string = '';
  loading: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  tokenValid: boolean = false;
  tokenChecked: boolean = false;
  resetSuccess: boolean = false;
  errorMessage: string = '';

  // Password strength indicators
  passwordStrength = {
    score: 0,
    message: '',
    class: 'weak'
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.resetForm = this.fb.group({
      newPassword: ['', [
        Validators.required, 
        Validators.minLength(8),
        this.passwordStrengthValidator
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.validateToken();
      } else {
        this.tokenChecked = true;
        this.tokenValid = false;
        this.errorMessage = 'Invalid password reset link. Please request a new one.';
      }
    });

    // Listen to password changes for strength indicator
    this.resetForm.get('newPassword')?.valueChanges.subscribe(password => {
      this.updatePasswordStrength(password || '');
    });
  }

  // Add these helper methods for template validation
  hasMinLength(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return password.length >= 8;
  }

  hasUpperCase(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return /[A-Z]/.test(password);
  }

  hasNumber(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return /[0-9]/.test(password);
  }

  hasSpecialChar(): boolean {
    const password = this.resetForm.get('newPassword')?.value || '';
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  }

  private validateToken() {
    // You might want to add a backend endpoint to validate token
    // For now, we'll assume it's valid if it exists
    this.tokenChecked = true;
    this.tokenValid = !!this.token;
    if (!this.tokenValid) {
      this.errorMessage = 'Invalid or expired reset token.';
    }
  }

  private passwordStrengthValidator(control: any) {
    const password = control.value;
    if (!password) return null;

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);
    
    const score = [hasLowerCase, hasUpperCase, hasNumbers, hasNonalphas].reduce((acc, curr) => acc + (curr ? 1 : 0), 0);
    
    if (password.length < 8 || score < 2) {
      return { weakPassword: true };
    }
    
    return null;
  }

  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (!newPassword || !confirmPassword) {
      return null;
    }
    
    return newPassword.value === confirmPassword.value ? null : { mismatch: true };
  }

  private updatePasswordStrength(password: string) {
    if (!password) {
      this.passwordStrength = { score: 0, message: '', class: 'weak' };
      return;
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const isLongEnough = password.length >= 8;

    let score = 0;
    if (hasLowerCase) score++;
    if (hasUpperCase) score++;
    if (hasNumbers) score++;
    if (hasSpecialChar) score++;
    if (isLongEnough) score++;

    let message = '';
    let cssClass = 'weak';

    if (score < 2) {
      message = 'Very weak password';
      cssClass = 'very-weak';
    } else if (score < 3) {
      message = 'Weak password';
      cssClass = 'weak';
    } else if (score < 4) {
      message = 'Good password';
      cssClass = 'good';
    } else if (score < 5) {
      message = 'Strong password';
      cssClass = 'strong';
    } else {
      message = 'Very strong password';
      cssClass = 'very-strong';
    }

    this.passwordStrength = { score, message, class: cssClass };
  }

  togglePasswordVisibility(field: 'newPassword' | 'confirmPassword'): void {
    if (field === 'newPassword') {
      this.showNewPassword = !this.showNewPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  onSubmit() {
    if (this.resetForm.invalid || !this.token || !this.tokenValid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const { newPassword, confirmPassword } = this.resetForm.value;

    this.authService.resetPassword(this.token, newPassword, confirmPassword).subscribe({
      next: (response) => {
        this.loading = false;
        this.resetSuccess = true;
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.message || 'Failed to reset password. Please try again or request a new reset link.';
      }
    });
  }

  private markFormGroupTouched() {
    Object.keys(this.resetForm.controls).forEach(key => {
      const control = this.resetForm.get(key);
      control?.markAsTouched();
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  requestNewResetLink() {
    this.router.navigate(['/forgot-password']);
  }
}