import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-individual-register',
  templateUrl: './individual-register.component.html',
  styleUrls: ['./individual-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class IndividualRegisterComponent implements OnInit {
  individualForm: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  passwordStrength: number = 0;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.individualForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      // Fixed: Use consistent phone validation pattern
      phone: ['', [Validators.required, Validators.pattern(/^[\+]?[1-9][\d]{0,15}$/)]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      termsAccepted: [false, Validators.requiredTrue]
    }, { 
      validators: this.mustMatch('password', 'confirmPassword') 
    });
  }

  mustMatch(controlName: string, matchingControlName: string) {
    return (formGroup: FormGroup) => {
      const control = formGroup.controls[controlName];
      const matchingControl = formGroup.controls[matchingControlName];
  
      if (matchingControl.errors && !matchingControl.errors['mustMatch']) {
        return;
      }
  
      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({ mustMatch: true });
      } else {
        matchingControl.setErrors(null);
      }
    };
  }

  ngOnInit(): void {
    // Enhanced debugging
    console.log('Individual registration component initialized');
    
    this.individualForm.valueChanges.subscribe(values => {
      console.log('Form values:', values);
      console.log('Form valid:', this.individualForm.valid);
      console.log('Form errors:', this.individualForm.errors);
    });
  }

  get f() { return this.individualForm.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  calculatePasswordStrength(event: Event): number {
    const input = event.target as HTMLInputElement;
    const password = input?.value || '';
    
    if (!password) {
      this.passwordStrength = 0;
      return 0;
    }
    
    let strength = 0;
    strength += Math.min(50, (password.length / 12) * 50);

    if (/[a-z]/.test(password)) strength += 10;
    if (/[A-Z]/.test(password)) strength += 10;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

    this.passwordStrength = Math.max(0, Math.min(100, strength));
    return this.passwordStrength;
  }

  getPasswordStrengthText(): string {
    if (this.passwordStrength < 40) return 'Weak';
    if (this.passwordStrength < 80) return 'Medium';
    return 'Strong';
  }

  // Enhanced error handling methods
  getFieldError(fieldName: string): string {
    const field = this.individualForm.get(fieldName);
    if (!field || !field.errors || (!field.touched && !this.submitted)) return '';

    const errors = field.errors;
    
    const fieldDisplayNames: { [key: string]: string } = {
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone number',
      address: 'Address',
      password: 'Password',
      confirmPassword: 'Confirm password',
      termsAccepted: 'Terms acceptance'
    };

    const displayName = fieldDisplayNames[fieldName] || fieldName;
    
    if (errors['required']) return `${displayName} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['minlength']) return `${displayName} must be at least ${errors['minlength'].requiredLength} characters`;
    if (errors['pattern'] && fieldName === 'phone') return 'Please enter a valid phone number (8-15 digits)';
    if (errors['mustMatch']) return 'Passwords do not match';
    if (errors['requiredTrue']) return 'You must accept the terms and conditions';

    return 'Invalid input';
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.individualForm.get(fieldName);
    return !!(field && field.errors && (field.touched || this.submitted));
  }

  onSubmit(): void {
    console.log('=== INDIVIDUAL REGISTRATION FORM SUBMISSION ===');
    this.submitted = true;
    this.error = '';

    // Enhanced validation logging
    console.log('Form valid:', this.individualForm.valid);
    console.log('Form value:', this.individualForm.value);
    console.log('Form errors:', this.individualForm.errors);

    // Check for password mismatch
    if (this.individualForm.hasError('mustMatch')) {
        this.error = 'Passwords do not match';
        console.log('ERROR: Password mismatch');
        return;
    }
    
    if (this.individualForm.invalid) {
        this.error = 'Please fill in all required fields correctly';
        console.log('ERROR: Form is invalid');
        
        // Log specific field errors
        Object.keys(this.individualForm.controls).forEach(key => {
          const control = this.individualForm.get(key);
          if (control && control.errors) {
            console.log(`Field ${key} errors:`, control.errors);
          }
        });
        return;
    }
    
    console.log('Form validation passed, starting registration...');
    this.loading = true;
    
    // Prepare user data with proper formatting
    const formValue = this.individualForm.value;
    const userData: User = {
        firstName: formValue.firstName?.trim(),
        lastName: formValue.lastName?.trim(),
        email: formValue.email?.toLowerCase().trim(),
        password: formValue.password,
        confirmPassword: formValue.confirmPassword,
        phone: formValue.phone?.trim(),
        address: formValue.address?.trim(),
        // Ensure proper defaults for individual users
        userType: 'individual',
        roles: ['ROLE_INDIVIDUAL'],
        verified: false,
        enabled: true,
        approved: true // Individual users are usually auto-approved
    };
    
    console.log('Sending user data to register service:', {
        ...userData,
        password: '[HIDDEN]',
        confirmPassword: '[HIDDEN]'
    });
    
    this.authService.register(userData, 'individual').subscribe({
        next: (response) => {
            console.log('✅ Registration successful:', response);
            this.loading = false;
            this.router.navigate(['/login'], { 
                state: {
                    registrationSuccess: true,
                    message: response.message || 'Your individual account has been created successfully! You can now sign in.'
                },
                queryParams: { registered: 'individual' }
            });
        },
        error: (err) => {
            console.error('❌ Registration failed:', err);
            this.loading = false;
            
            // Enhanced error handling
            if (typeof err === 'string') {
                this.error = err;
            } else if (err instanceof Error) {
                this.error = err.message;
            } else if (err.error?.message) {
                this.error = err.error.message;
            } else if (err.error?.error) {
                this.error = err.error.error;
            } else if (err.message) {
                this.error = err.message;
            } else {
                this.error = 'Registration failed. Please try again.';
            }
            
            console.log('Final error message set to:', this.error);
            
            // Scroll to top to show error
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
  }
}