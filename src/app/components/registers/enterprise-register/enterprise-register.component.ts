import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { BUSINESS_TYPES, User } from '../../../models/user.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-enterprise-register',
  templateUrl: './enterprise-register.component.html',
  styleUrls: ['./enterprise-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ]
})
export class EnterpriseRegisterComponent implements OnInit {
  enterpriseForm: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  businessTypes = BUSINESS_TYPES;

  passwordStrength: number = 0;
passwordStrengthText: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.enterpriseForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      companyName: ['', Validators.required],
      businessType: ['', Validators.required],
      vatNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}?[0-9]+$/)]],
      businessPhone: ['', Validators.required],
      businessAddress: ['', Validators.required],
      deliveryRadius: [5, [Validators.required, Validators.min(1)]],
      termsAccepted: [false, Validators.requiredTrue]
    }, { 
      validators: this.mustMatch('password', 'confirmPassword') 
    });}

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

  get f() { return this.enterpriseForm.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    
    if (this.enterpriseForm.hasError('mustMatch')) {
        this.error = 'Passwords do not match';
        return;
    }
    
    if (this.enterpriseForm.invalid) {
        console.error('Form invalid:', this.enterpriseForm.errors);
        return;
    }
    
    this.loading = true;
    
    const formValue = this.enterpriseForm.value;
    const userData: User = {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        password: formValue.password,
        confirmPassword: formValue.confirmPassword, // Add this
        phone: formValue.phone,
        address: formValue.address,
        companyName: formValue.companyName,
        businessType: formValue.businessType,
        vatNumber: formValue.vatNumber,
        businessPhone: formValue.businessPhone,
        businessAddress: formValue.businessAddress,
        deliveryRadius: formValue.deliveryRadius
    };
    
    this.authService.register(userData, 'enterprise').subscribe({
        next: (response) => {
            this.loading = false;
            this.router.navigate(['/login'], { 
                state: { 
                    registrationSuccess: true,
                    message: response.message || 'Votre compte entreprise a été créé avec succès!'
                },
                queryParams: { registered: 'enterprise' }
            });
        },
        error: (err) => {
            this.loading = false;
            this.error = err.error?.message || 'Échec de l\'inscription. Veuillez réessayer.';
            console.error('Registration error:', err);
        }
    });
}

  calculatePasswordStrength(password: string): number {
    if (!password) return 0;
    
    let strength = 0;
    // Length contributes up to 50%
    strength += Math.min(50, (password.length / 12) * 50);
    
    // Contains both cases
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 15;
    
    // Contains numbers
    if (/\d/.test(password)) strength += 15;
    
    // Contains special chars
    if (/[^a-zA-Z0-9]/.test(password)) strength += 20;
    
    // Ensure it's between 0-100
    this.passwordStrength = Math.max(0, Math.min(100, strength));
    return this.passwordStrength;
  }
  
  getPasswordStrengthText(): string {
    if (this.passwordStrength < 40) return 'Weak';
    if (this.passwordStrength < 80) return 'Medium';
    return 'Strong';
  }
}