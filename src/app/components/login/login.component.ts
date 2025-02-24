import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  private authSubscription?: Subscription;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      const user = this.authService.getCurrentUser();
      if (user) {
        this.authService.redirectBasedOnUserType(user.userType);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  private initializeForm(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return (field?.invalid && (field?.touched || field?.dirty)) || false;
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    
    if (!field) return '';
    
    if (field.hasError('required')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    
    if (fieldName === 'email' && field.hasError('email')) {
      return 'Please enter a valid email address';
    }
    
    if (fieldName === 'password') {
      if (field.hasError('minlength')) {
        return 'Password must be at least 6 characters long';
      }
    }
    
    return 'Invalid input';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.error = 'Please correct the errors in the form';
      return;
    }
    
    this.loading = true;
    this.error = '';
    const { email, password } = this.loginForm.value;
    
    console.log('Attempting login with:', { email, password: '***' });
    
    this.authSubscription = this.authService.login(email, password).subscribe({
      next: (response) => {
        console.log('Login successful:', response);
        this.loading = false;
        // Redirection is handled in the service
      },
      error: (error) => {
        console.error('Login failed:', error);
        this.loading = false;
        
        if (error instanceof Error) {
          this.error = error.message;
        } else {
          this.error = 'Login failed. Please check your credentials.';
        }
      }
    });
  }

  loginWithGoogle() {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  }

  loginWithFacebook(): void {
    window.location.href = 'http://localhost:8080/oauth2/authorization/facebook';
  }
}