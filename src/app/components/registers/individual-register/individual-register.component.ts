import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-individual-register',
  templateUrl: './individual-register.component.html',
  styleUrls: ['./individual-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
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
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,15}$/)]],
      address: ['', [Validators.required]],
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

  ngOnInit(): void {}

  get f() { return this.individualForm.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  calculatePasswordStrength(password: string): number {
    if (!password) return 0;
    
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

  onSubmit(): void {
    this.submitted = true;
    this.error = '';

    if (this.individualForm.hasError('mustMatch')) {
        this.error = 'Passwords do not match';
        return;
    }
    
    if (this.individualForm.invalid) {
        return;
    }
    
    this.loading = true;
    
    const userData: User = {
        firstName: this.individualForm.value.firstName,
        lastName: this.individualForm.value.lastName,
        email: this.individualForm.value.email,
        password: this.individualForm.value.password,
        confirmPassword: this.individualForm.value.confirmPassword, // Add this
        phone: this.individualForm.value.phone,
        address: this.individualForm.value.address
    };
    
    this.authService.register(userData, 'individual').subscribe({
        next: (response) => {
            this.loading = false;
            this.router.navigate(['/login'], { 
                state: {
                    registrationSuccess: true,
                    message: response.message || 'Your individual account has been created successfully!'
                },
                queryParams: { registered: 'individual' }
            });
        },
        error: (err) => {
            this.loading = false;
            this.error = err.error?.message || 'Registration failed. Please try again.';
        }
    });
}
}