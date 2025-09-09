import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { BUSINESS_TYPES, User } from '../../../models/user.model';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

// Custom validators
export class CustomValidators {
  static vatNumber(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const vatPattern = /^[A-Z]{2}[0-9]{8,12}$/;
    const valid = vatPattern.test(control.value.toUpperCase());
    return valid ? null : { invalidVat: { value: control.value } };
  }

  static businessPhone(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
    const valid = phonePattern.test(control.value.replace(/[\s\-\(\)]/g, ''));
    return valid ? null : { invalidBusinessPhone: { value: control.value } };
  }

  static strongPassword(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const hasUpperCase = /[A-Z]/.test(control.value);
    const hasLowerCase = /[a-z]/.test(control.value);
    const hasNumbers = /\d/.test(control.value);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(control.value);
    const isLongEnough = control.value.length >= 8;
    
    const validConditions = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar, isLongEnough];
    const validCount = validConditions.filter(Boolean).length;
    
    if (validCount < 4) {
      return { 
        weakPassword: {
          hasUpperCase,
          hasLowerCase,
          hasNumbers,
          hasSpecialChar,
          isLongEnough,
          score: validCount
        }
      };
    }
    
    return null;
  }

  static matchPasswords(passwordField: string, confirmPasswordField: string) {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const password = formGroup.get(passwordField);
      const confirmPassword = formGroup.get(confirmPasswordField);
      
      if (!password || !confirmPassword) return null;
      
      if (confirmPassword.errors && !confirmPassword.errors['passwordMismatch']) {
        return null;
      }
      
      if (password.value !== confirmPassword.value) {
        confirmPassword.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        if (confirmPassword.errors) {
          delete confirmPassword.errors['passwordMismatch'];
          if (Object.keys(confirmPassword.errors).length === 0) {
            confirmPassword.setErrors(null);
          }
        }
      }
      
      return null;
    };
  }
}

interface PasswordStrength {
  score: number;
  message: string;
  class: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    special: boolean;
  };
}

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
export class EnterpriseRegisterComponent implements OnInit, OnDestroy {
 enterpriseForm!: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  businessTypes = BUSINESS_TYPES;
  
  // Password strength tracking
  passwordStrength: PasswordStrength = {
    score: 0,
    message: '',
    class: 'danger',
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      numbers: false,
      special: false
    }
  };

  // Email availability tracking
  emailChecking = false;
  emailAvailable: boolean | null = null;

  // Form state management
  private destroy$ = new Subject<void>();
  formTouched = false;

  // Step management for better UX
  currentStep = 1;
  totalSteps = 3;
  stepValid = {
    1: false, // Company info
    2: false, // Contact info  
    3: false  // Account info
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.enterpriseForm = this.fb.group({
      // Company Information
      companyName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      businessType: ['', Validators.required],
      vatNumber: ['', [Validators.required, CustomValidators.vatNumber]],
      businessPhone: ['', [Validators.required, CustomValidators.businessPhone]],
      businessAddress: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
      deliveryRadius: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
      
      // Contact Information
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[\+]?[1-9][\d]{0,15}$/)]],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
      
      // Account Information
      password: ['', [Validators.required, Validators.minLength(8), CustomValidators.strongPassword]],
      confirmPassword: ['', Validators.required],
      termsAccepted: [false, Validators.requiredTrue],
      dataProcessingAccepted: [false, Validators.requiredTrue],
      marketingAccepted: [false] // Optional
    }, { 
      validators: [CustomValidators.matchPasswords('password', 'confirmPassword')]
    });

    this.setupFormValidation();
    this.setupPasswordStrengthTracking();
    this.setupEmailAvailabilityCheck();
  }

  private setupFormValidation(): void {
    // Track form changes to update step validation
    this.enterpriseForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.updateStepValidation();
        this.formTouched = true;
      });
  }

  private setupPasswordStrengthTracking(): void {
    this.enterpriseForm.get('password')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(password => {
        if (password) {
          this.updatePasswordStrength(password);
        } else {
          this.resetPasswordStrength();
        }
      });
  }

  private setupEmailAvailabilityCheck(): void {
    this.enterpriseForm.get('email')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(email => {
        if (email && this.enterpriseForm.get('email')?.valid) {
          this.checkEmailAvailability(email);
        } else {
          this.emailAvailable = null;
          this.emailChecking = false;
        }
      });
  }

  private updateStepValidation(): void {
    // Step 1: Company Information
    const step1Fields = ['companyName', 'businessType', 'vatNumber', 'businessPhone', 'businessAddress'];
    this.stepValid[1] = step1Fields.every(field => 
      this.enterpriseForm.get(field)?.valid || false
    );

    // Step 2: Contact Information  
    const step2Fields = ['firstName', 'lastName', 'email', 'phone', 'address'];
    this.stepValid[2] = step2Fields.every(field => 
      this.enterpriseForm.get(field)?.valid || false
    ) && this.emailAvailable !== false;

    // Step 3: Account Information
    const step3Fields = ['password', 'confirmPassword', 'termsAccepted', 'dataProcessingAccepted'];
    this.stepValid[3] = step3Fields.every(field => 
      this.enterpriseForm.get(field)?.valid || false
    ) && !this.enterpriseForm.hasError('passwordMismatch');
  }

  private checkEmailAvailability(email: string): void {
    this.emailChecking = true;
    this.emailAvailable = null;
    
    // Simulate email availability check (replace with actual service call)
    setTimeout(() => {
      // For demo purposes, assume email is available unless it contains 'test'
      this.emailAvailable = !email.toLowerCase().includes('test');
      this.emailChecking = false;
    }, 1000);
  }

  private updatePasswordStrength(password: string): void {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const score = Object.values(requirements).filter(Boolean).length;
    let message = '';
    let className = '';

    switch (score) {
      case 0:
      case 1:
        message = 'Very weak password';
        className = 'danger';
        break;
      case 2:
        message = 'Weak password';
        className = 'warning';
        break;
      case 3:
        message = 'Good password';
        className = 'info';
        break;
      case 4:
        message = 'Strong password';
        className = 'success';
        break;
      case 5:
        message = 'Very strong password';
        className = 'success';
        break;
    }

    this.passwordStrength = {
      score: (score / 5) * 100,
      message,
      class: className,
      requirements
    };
  }

  private resetPasswordStrength(): void {
    this.passwordStrength = {
      score: 0,
      message: '',
      class: 'danger',
      requirements: {
        length: false,
        uppercase: false,
        lowercase: false,
        numbers: false,
        special: false
      }
    };
  }

  ngOnInit(): void {
    // Set up any additional initialization
    this.updateStepValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Getters
  get f() { 
    return this.enterpriseForm.controls; 
  }

  get isStepValid(): boolean {
    return this.stepValid[this.currentStep as keyof typeof this.stepValid];
  }

  get canProceedToNext(): boolean {
    return this.isStepValid && this.currentStep < this.totalSteps;
  }

  get canGoBack(): boolean {
    return this.currentStep > 1;
  }

  get isLastStep(): boolean {
    return this.currentStep === this.totalSteps;
  }

  // Step navigation
  nextStep(): void {
    if (this.canProceedToNext) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.canGoBack) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
    }
  }

  // UI helpers
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  getFieldError(fieldName: string): string {
    const field = this.enterpriseForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    const errors = field.errors;
    
    if (errors['required']) return `${this.getFieldDisplayName(fieldName)} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['minlength']) return `${this.getFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters`;
    if (errors['maxlength']) return `${this.getFieldDisplayName(fieldName)} must not exceed ${errors['maxlength'].requiredLength} characters`;
    if (errors['pattern']) return `${this.getFieldDisplayName(fieldName)} format is invalid`;
    if (errors['min']) return `Minimum value is ${errors['min'].min}`;
    if (errors['max']) return `Maximum value is ${errors['max'].max}`;
    if (errors['invalidVat']) return 'VAT number format is invalid (e.g., FR12345678901)';
    if (errors['invalidBusinessPhone']) return 'Business phone format is invalid';
    if (errors['weakPassword']) return 'Password must meet security requirements';
    if (errors['passwordMismatch']) return 'Passwords do not match';

    return 'Invalid input';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      companyName: 'Company name',
      businessType: 'Business type',
      vatNumber: 'VAT number',
      businessPhone: 'Business phone',
      businessAddress: 'Business address',
      deliveryRadius: 'Delivery radius',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      password: 'Password',
      confirmPassword: 'Confirm password'
    };
    
    return displayNames[fieldName] || fieldName;
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.enterpriseForm.get(fieldName);
    return !!(field && field.errors && (field.touched || this.submitted));
  }

  // Form submission
  onSubmit(): void {
    this.submitted = true;
    this.error = '';

    // Mark all fields as touched to show validation errors
    this.markFormGroupTouched(this.enterpriseForm);

    if (this.enterpriseForm.invalid) {
      this.error = 'Please correct the errors below and try again.';
      this.scrollToFirstError();
      return;
    }

    if (this.emailAvailable === false) {
      this.error = 'This email address is already registered. Please use a different email.';
      return;
    }

    this.loading = true;
    
    const formValue = this.enterpriseForm.value;
    
    const userData: User = {
      // Company information
      companyName: formValue.companyName?.trim(),
      businessType: formValue.businessType,
      vatNumber: formValue.vatNumber?.toUpperCase().trim(),
      businessPhone: formValue.businessPhone?.trim(),
      businessAddress: formValue.businessAddress?.trim(),
      deliveryRadius: formValue.deliveryRadius,
      
      // Contact information
      firstName: formValue.firstName?.trim(),
      lastName: formValue.lastName?.trim(),
      email: formValue.email?.toLowerCase().trim(),
      phone: formValue.phone?.trim(),
      address: formValue.address?.trim(),
      
      // Account information
      password: formValue.password,
      confirmPassword: formValue.confirmPassword,
      
      // Account status
      verified: false,
      enabled: true,
      approved: false, // Enterprises need approval
      
      // Metadata
      id: '',
      roles: ['ROLE_ENTERPRISE'],
      userType: 'enterprise',
      dateOfRegistration: new Date()
    };
    
    this.authService.register(userData, 'enterprise').subscribe({
      next: (response) => {
        this.loading = false;
        this.router.navigate(['/login'], { 
          state: {
            registrationSuccess: true,
            message: 'Your enterprise account has been created successfully! Please check your email for verification instructions.',
            userType: 'enterprise'
          },
          queryParams: { 
            registered: 'enterprise',
            email: userData.email 
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message || 'Registration failed. Please try again.';
        this.submitted = false;
        this.scrollToTop();
      }
    });
  }

  // Utility methods
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      control?.markAsTouched({ onlySelf: true });

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const firstError = document.querySelector('.er-is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  private scrollToTop(): void {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }

  // Format display methods
  formatVatNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Add basic formatting for common EU VAT formats
    if (value.length > 2) {
      value = value.substring(0, 2) + value.substring(2);
    }
    
    input.value = value;
    this.enterpriseForm.get('vatNumber')?.setValue(value);
  }

  formatPhoneNumber(event: Event, fieldName: string): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^\d\+]/g, '');
    
    // Basic international format
    if (value.length > 0 && !value.startsWith('+')) {
      value = '+' + value;
    }
    
    input.value = value;
    this.enterpriseForm.get(fieldName)?.setValue(value);
  }

  // Validation helpers
  getPasswordRequirements(): Array<{label: string, met: boolean}> {
    return [
      { label: 'At least 8 characters', met: this.passwordStrength.requirements.length },
      { label: 'Uppercase letter (A-Z)', met: this.passwordStrength.requirements.uppercase },
      { label: 'Lowercase letter (a-z)', met: this.passwordStrength.requirements.lowercase },
      { label: 'Number (0-9)', met: this.passwordStrength.requirements.numbers },
      { label: 'Special character (!@#$...)', met: this.passwordStrength.requirements.special }
    ];
  }
}