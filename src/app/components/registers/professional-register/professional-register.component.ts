import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User, VEHICLE_TYPES } from '../../../models/user.model';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../services/vehicle-service.service';

@Component({
  selector: 'app-professional-register',
  templateUrl: './professional-register.component.html',
  styleUrls: ['./professional-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ]
})
export class ProfessionalRegisterComponent implements OnInit {
  professionalForm: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  vehicleTypes = VEHICLE_TYPES;
  currentYear: number;
  passwordStrength: number = 0;
  availableVehicles: any[] = [];
  selectedVehicleId: string | null = null;
  adminMode = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private vehicleService: VehicleService,
        private route: ActivatedRoute,

  ) {
    this.currentYear = new Date().getFullYear();
    this.professionalForm = this.fb.group({
      // Personal Information
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      
      // Vehicle Information
      vehicleType: ['', Validators.required],
      vehicleBrand: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehiclePlateNumber: ['', Validators.required],
      vehicleColor: ['', Validators.required],
      vehicleYear: [null, [Validators.required, Validators.min(1900), Validators.max(this.currentYear)]],
      vehicleCapacityKg: [0, [Validators.required, Validators.min(0)]],
      vehicleVolumeM3: [0, [Validators.required, Validators.min(0)]],
      vehicleHasFridge: [false],
      vehicleInsuranceExpiry: ['', Validators.required],
      vehicleInspectionExpiry: ['', Validators.required],
      
      // Professional Information
      driverLicenseNumber: ['', Validators.required],
      driverLicenseCategory: ['', Validators.required],
      driverLicenseIssueDate: ['', Validators.required],
      driverLicenseExpiryDate: ['', Validators.required],
      preferredZones: [''],
      availabilitySchedule: [''],
      hasCompanyAffiliation: [false],
      
      // Documents
      identityPhotoUrl: [''],
      criminalRecordDocumentUrl: [''],
      medicalCertificateUrl: [''],
      
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
    this.adminMode = this.route.snapshot.data['adminMode'] || false;
    if (this.adminMode) {
      this.prepareAdminForm();
    }
  }
  private prepareAdminForm(): void {
    // Set default values for admin mode
    this.professionalForm.patchValue({
      termsAccepted: true,
      verified: true
    });
  }



  get f() { return this.professionalForm.controls; }

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

  loadAvailableVehicles(): void {
    this.vehicleService.getAvailableVehicles().subscribe({
      next: (vehicles) => {
        this.availableVehicles = vehicles;
      },
      error: (err) => {
        console.error('Error loading available vehicles:', err);
      }
    });
  }

  onVehicleSelect(event: any): void {
    this.selectedVehicleId = event.target.value;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';

    if (this.professionalForm.hasError('mustMatch')) {
      this.error = 'Passwords do not match';
      return;
    }
    
    
    if (this.professionalForm.invalid) {
      return;
    }
    
    this.loading = true;
    
    const formValue = this.professionalForm.value;
    const userData: User = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password,
      phone: formValue.phone,
      address: formValue.address,
      
      // Vehicle Information
      vehicleType: formValue.vehicleType,
      vehicleBrand: formValue.vehicleBrand,
      vehicleModel: formValue.vehicleModel,
      vehiclePlateNumber: formValue.vehiclePlateNumber,
      vehicleColor: formValue.vehicleColor,
      vehicleYear: formValue.vehicleYear,
      vehicleCapacityKg: formValue.vehicleCapacityKg,
      vehicleVolumeM3: formValue.vehicleVolumeM3,
      vehicleHasFridge: formValue.vehicleHasFridge,
      vehicleInsuranceExpiry: new Date(formValue.vehicleInsuranceExpiry),
      vehicleInspectionExpiry: new Date(formValue.vehicleInspectionExpiry),
     // assignedVehicleId: this.selectedVehicleId,
      
      // Professional Information
      driverLicenseNumber: formValue.driverLicenseNumber,
      driverLicenseCategory: formValue.driverLicenseCategory,
      driverLicenseIssueDate: new Date(formValue.driverLicenseIssueDate),
      driverLicenseExpiryDate: new Date(formValue.driverLicenseExpiryDate),
      preferredZones: formValue.preferredZones,
      availabilitySchedule: formValue.availabilitySchedule,
      hasCompanyAffiliation: formValue.hasCompanyAffiliation,
      
      // Documents
      identityPhotoUrl: formValue.identityPhotoUrl,
      criminalRecordDocumentUrl: formValue.criminalRecordDocumentUrl,
      medicalCertificateUrl: formValue.medicalCertificateUrl,
      
      // Account status
      verified: false,
      enabled: true,
      available: false,
      
      id: '',
      roles: ['ROLE_PROFESSIONAL']
    };
    
    this.authService.register(userData, 'professional').subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/login'], { 
          state: {
            registrationSuccess: true,
            message: 'Your professional driver account has been created! It will be reviewed by our team.'
          },
          queryParams: { registered: 'professional' }
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }
}