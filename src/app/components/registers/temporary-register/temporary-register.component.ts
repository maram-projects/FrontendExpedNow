import { Component, OnInit } from '@angular/core';
import { 
  FormBuilder, 
  FormGroup, 
  Validators, 
  ReactiveFormsModule,
  FormsModule 
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { User, VEHICLE_TYPES } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-temporary-register',
  templateUrl: './temporary-register.component.html',
  styleUrls: ['./temporary-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink
  ]
})
export class TemporaryRegisterComponent implements OnInit {
  temporaryForm: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  vehicleTypes = VEHICLE_TYPES;
  currentYear: number;
  passwordStrength: number = 0;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.currentYear = new Date().getFullYear();
    this.temporaryForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      vehicleType: ['', Validators.required],
      vehicleBrand: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehiclePlateNumber: ['', Validators.required],
      vehicleColor: ['', Validators.required],
      vehicleYear: [null, [Validators.required, Validators.min(1900), Validators.max(this.currentYear)]],
      vehicleCapacityKg: [0, [Validators.required, Validators.min(0)]],
      vehicleVolumeM3: [0, [Validators.required, Validators.min(0)]],
      vehicleHasFridge: [false],
      driverLicenseNumber: ['', Validators.required],
      driverLicenseCategory: ['', Validators.required],
      preferredZones: [''],
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

  get f() { return this.temporaryForm.controls; }

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

    if (this.temporaryForm.hasError('mustMatch')) {
        this.error = 'Passwords do not match';
        return;
    }

    if (this.temporaryForm.invalid) {
        return;
    }
    
    this.loading = true;
    
    const formValue = this.temporaryForm.value;
    const userData: User = {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        password: formValue.password,
        confirmPassword: formValue.confirmPassword, // Add this
        phone: formValue.phone,
        address: formValue.address,
        vehicleType: formValue.vehicleType,
        vehicleBrand: formValue.vehicleBrand,
        vehicleModel: formValue.vehicleModel,
        vehiclePlateNumber: formValue.vehiclePlateNumber,
        vehicleColor: formValue.vehicleColor,
        vehicleYear: formValue.vehicleYear,
        vehicleCapacityKg: formValue.vehicleCapacityKg,
        vehicleVolumeM3: formValue.vehicleVolumeM3,
        vehicleHasFridge: formValue.vehicleHasFridge,
        driverLicenseNumber: formValue.driverLicenseNumber,
        driverLicenseCategory: formValue.driverLicenseCategory,
        preferredZones: formValue.preferredZones
    };
    
    this.authService.register(userData, 'temporary').subscribe({
        next: (response) => {
            this.loading = false;
            this.router.navigate(['/login'], { 
                state: {
                    registrationSuccess: true,
                    message: response.message || 'Your temporary driver account has been created! An administrator will validate your account within 24 hours.'
                },
                queryParams: { registered: 'temporary' }
            });
        },
        error: (err) => {
            this.loading = false;
            this.error = err.error?.message || 'Registration failed. Please try again.';
        }
    });
}
}