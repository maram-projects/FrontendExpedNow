// edit-profile.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { User, USER_TYPES, VEHICLE_TYPES, BUSINESS_TYPES } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { Observable } from 'rxjs/internal/Observable';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('stepAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(50px)' }),
        animate('400ms ease-in-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('400ms ease-in-out', style({ opacity: 0, transform: 'translateX(-50px)' }))
      ])
    ])
  ],
  template: `
    <div class="profile-edit-container">
      <!-- Loading Overlay -->
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>

      <!-- Success/Error Notifications -->
      <div class="notification-container" [class.show]="showNotification">
        <div class="notification success" *ngIf="successMessage" [@slideDown]>
          <i class="fas fa-check-circle"></i>
          <span>{{ successMessage }}</span>
        </div>
        <div class="notification error" *ngIf="errorMessage" [@slideDown]>
          <i class="fas fa-exclamation-triangle"></i>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- Main Content -->
      <div class="profile-edit-wrapper animate-in">
        <!-- Header -->
        <div class="profile-header animate-in">
          <div class="header-background"></div>
          <div class="header-content">
            <div class="profile-avatar">
              <img [src]="profilePhotoUrl" alt="Profile Photo" class="avatar-img">
              <button class="avatar-edit-btn" type="button">
                <i class="fas fa-camera"></i>
              </button>
            </div>
            <div class="profile-info">
              <h1 class="profile-title">Edit Your Profile</h1>
              <p class="profile-subtitle">Update your information and preferences</p>
            </div>
          </div>
        </div>

        <!-- Progress Indicator -->
        <div class="progress-container animate-in">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              [style.width.%]="((currentStep + 1) / steps.length) * 100"
            ></div>
          </div>
          <div class="step-indicators">
            <div 
              *ngFor="let step of steps; let i = index"
              class="step-indicator"
              [class.active]="i === currentStep"
              [class.completed]="i < currentStep"
            >
              <div class="step-circle">
                <i 
                  class="fas"
                  [class.fa-check]="i < currentStep"
                  [class.fa-user]="i === 0 && i >= currentStep"
                  [class.fa-phone]="i === 1 && i >= currentStep"
                  [class.fa-cog]="i === 2 && i >= currentStep"
                  [class.fa-save]="i === 3 && i >= currentStep"
                ></i>
              </div>
              <span class="step-label">{{ getStepLabel(i) }}</span>
            </div>
          </div>
        </div>

        <!-- Form Content -->
        <div class="form-container">
          <form [formGroup]="profileForm" (ngSubmit)="onSubmit()" class="profile-form">
            
            <!-- Step 1: Basic Information -->
            <div class="form-step" *ngIf="currentStep === 0" [@stepAnimation]>
              <div class="step-header">
                <h2><i class="fas fa-user"></i> Basic Information</h2>
                <p>Let's start with your basic details</p>
              </div>
              
              <div class="form-grid">
                <div class="form-group">
                  <label for="firstName">
                    First Name <span class="required">*</span>
                  </label>
                  <div class="input-wrapper">
                    <i class="fas fa-user input-icon"></i>
                    <input
                      type="text"
                      id="firstName"
                      formControlName="firstName"
                      class="form-input"
                      [class.error]="isFieldInvalid('firstName')"
                      placeholder="Enter your first name"
                    >
                  </div>
                  <div class="error-message" *ngIf="getErrorMessage('firstName')">
                    {{ getErrorMessage('firstName') }}
                  </div>
                </div>

                <div class="form-group">
                  <label for="lastName">
                    Last Name <span class="required">*</span>
                  </label>
                  <div class="input-wrapper">
                    <i class="fas fa-user input-icon"></i>
                    <input
                      type="text"
                      id="lastName"
                      formControlName="lastName"
                      class="form-input"
                      [class.error]="isFieldInvalid('lastName')"
                      placeholder="Enter your last name"
                    >
                  </div>
                  <div class="error-message" *ngIf="getErrorMessage('lastName')">
                    {{ getErrorMessage('lastName') }}
                  </div>
                </div>

                <div class="form-group full-width">
                  <label for="email">
                    Email Address <span class="required">*</span>
                  </label>
                  <div class="input-wrapper">
                    <i class="fas fa-envelope input-icon"></i>
                    <input
                      type="email"
                      id="email"
                      formControlName="email"
                      class="form-input"
                      [class.error]="isFieldInvalid('email')"
                      placeholder="Enter your email address"
                    >
                  </div>
                  <div class="error-message" *ngIf="getErrorMessage('email')">
                    {{ getErrorMessage('email') }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: Contact Information -->
            <div class="form-step" *ngIf="currentStep === 1" [@stepAnimation]>
              <div class="step-header">
                <h2><i class="fas fa-phone"></i> Contact Information</h2>
                <p>How can we reach you?</p>
              </div>
              
              <div class="form-grid">
                <div class="form-group">
                  <label for="phone">
                    Phone Number <span class="required">*</span>
                  </label>
                  <div class="input-wrapper">
                    <i class="fas fa-phone input-icon"></i>
                    <input
                      type="tel"
                      id="phone"
                      formControlName="phone"
                      class="form-input"
                      [class.error]="isFieldInvalid('phone')"
                      placeholder="+1234567890"
                    >
                  </div>
                  <div class="error-message" *ngIf="getErrorMessage('phone')">
                    {{ getErrorMessage('phone') }}
                  </div>
                </div>

                <div class="form-group full-width">
                  <label for="address">
                    Address <span class="required">*</span>
                  </label>
                  <div class="input-wrapper">
                    <i class="fas fa-map-marker-alt input-icon"></i>
                    <input
                      type="text"
                      id="address"
                      formControlName="address"
                      class="form-input"
                      [class.error]="isFieldInvalid('address')"
                      placeholder="Enter your full address"
                    >
                  </div>
                  <div class="error-message" *ngIf="getErrorMessage('address')">
                    {{ getErrorMessage('address') }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Specific Information (based on user type) -->
            <div class="form-step" *ngIf="currentStep === 2" [@stepAnimation]>
              <div class="step-header">
                <h2><i class="fas fa-cog"></i> Specific Information</h2>
                <p>Additional details for your account type</p>
              </div>

              <!-- Enterprise Fields -->
              <div class="form-section" *ngIf="isEnterprise()">
                <h3><i class="fas fa-building"></i> Business Information</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="companyName">Company Name <span class="required">*</span></label>
                    <div class="input-wrapper">
                      <i class="fas fa-building input-icon"></i>
                      <input
                        type="text"
                        id="companyName"
                        formControlName="companyName"
                        class="form-input"
                        [class.error]="isFieldInvalid('companyName')"
                        placeholder="Your company name"
                      >
                    </div>
                    <div class="error-message" *ngIf="getErrorMessage('companyName')">
                      {{ getErrorMessage('companyName') }}
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="businessType">Business Type <span class="required">*</span></label>
                    <div class="input-wrapper">
                      <i class="fas fa-industry input-icon"></i>
                      <select id="businessType" formControlName="businessType" class="form-select" [class.error]="isFieldInvalid('businessType')">
                        <option value="">Select business type</option>
                        <option 
                          *ngFor="let type of BUSINESS_TYPES" 
                          [value]="type.value"
                        >
                          {{ type.display }}
                        </option>
                      </select>
                    </div>
                    <div class="error-message" *ngIf="getErrorMessage('businessType')">
                      {{ getErrorMessage('businessType') }}
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="vatNumber">VAT Number</label>
                    <div class="input-wrapper">
                      <i class="fas fa-hashtag input-icon"></i>
                      <input
                        type="text"
                        id="vatNumber"
                        formControlName="vatNumber"
                        class="form-input"
                        placeholder="VAT registration number"
                      >
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="businessPhone">Business Phone</label>
                    <div class="input-wrapper">
                      <i class="fas fa-phone-office input-icon"></i>
                      <input
                        type="tel"
                        id="businessPhone"
                        formControlName="businessPhone"
                        class="form-input"
                        placeholder="Business phone number"
                      >
                    </div>
                  </div>

                  <div class="form-group full-width">
                    <label for="businessAddress">Business Address</label>
                    <div class="input-wrapper">
                      <i class="fas fa-map-marker-alt input-icon"></i>
                      <input
                        type="text"
                        id="businessAddress"
                        formControlName="businessAddress"
                        class="form-input"
                        placeholder="Business address"
                      >
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="deliveryRadius">Delivery Radius (km)</label>
                    <div class="input-wrapper">
                      <i class="fas fa-circle input-icon"></i>
                      <input
                        type="number"
                        id="deliveryRadius"
                        formControlName="deliveryRadius"
                        class="form-input"
                        min="0"
                        placeholder="50"
                      >
                    </div>
                  </div>
                </div>
              </div>

              <!-- Delivery Person Fields -->
              <div class="form-section" *ngIf="isDeliveryPerson()">
                <h3><i class="fas fa-truck"></i> Vehicle Information</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="vehicleType">Vehicle Type <span class="required">*</span></label>
                    <div class="input-wrapper">
                      <i class="fas fa-car input-icon"></i>
                      <select id="vehicleType" formControlName="vehicleType" class="form-select" [class.error]="isFieldInvalid('vehicleType')">
                        <option value="">Select vehicle type</option>
                        <option 
                          *ngFor="let vehicle of VEHICLE_TYPES" 
                          [value]="vehicle.value"
                        >
                          {{ vehicle.display }}
                        </option>
                      </select>
                    </div>
                    <div class="error-message" *ngIf="getErrorMessage('vehicleType')">
                      {{ getErrorMessage('vehicleType') }}
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="vehicleBrand">Vehicle Brand</label>
                    <div class="input-wrapper">
                      <i class="fas fa-tag input-icon"></i>
                      <input
                        type="text"
                        id="vehicleBrand"
                        formControlName="vehicleBrand"
                        class="form-input"
                        placeholder="Toyota, BMW, etc."
                      >
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="vehicleModel">Vehicle Model</label>
                    <div class="input-wrapper">
                      <i class="fas fa-car input-icon"></i>
                      <input
                        type="text"
                        id="vehicleModel"
                        formControlName="vehicleModel"
                        class="form-input"
                        placeholder="Corolla, X5, etc."
                      >
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="vehiclePlateNumber">License Plate</label>
                    <div class="input-wrapper">
                      <i class="fas fa-hashtag input-icon"></i>
                      <input
                        type="text"
                        id="vehiclePlateNumber"
                        formControlName="vehiclePlateNumber"
                        class="form-input"
                        placeholder="ABC-1234"
                      >
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="vehicleYear">Vehicle Year</label>
                    <div class="input-wrapper">
                      <i class="fas fa-calendar input-icon"></i>
                      <input
                        type="number"
                        id="vehicleYear"
                        formControlName="vehicleYear"
                        class="form-input"
                        min="1990"
                        max="2024"
                        placeholder="2020"
                      >
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="vehicleColor">Vehicle Color</label>
                    <div class="input-wrapper">
                      <i class="fas fa-palette input-icon"></i>
                      <input
                        type="text"
                        id="vehicleColor"
                        formControlName="vehicleColor"
                        class="form-input"
                        placeholder="Red, Blue, etc."
                      >
                    </div>
                  </div>
                </div>

                <h3><i class="fas fa-id-card"></i> Professional Information</h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="driverLicenseNumber">Driver License Number <span class="required">*</span></label>
                    <div class="input-wrapper">
                      <i class="fas fa-id-card input-icon"></i>
                      <input
                        type="text"
                        id="driverLicenseNumber"
                        formControlName="driverLicenseNumber"
                        class="form-input"
                        [class.error]="isFieldInvalid('driverLicenseNumber')"
                        placeholder="License number"
                      >
                    </div>
                    <div class="error-message" *ngIf="getErrorMessage('driverLicenseNumber')">
                      {{ getErrorMessage('driverLicenseNumber') }}
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="driverLicenseCategory">License Category</label>
                    <div class="input-wrapper">
                      <i class="fas fa-certificate input-icon"></i>
                      <input
                        type="text"
                        id="driverLicenseCategory"
                        formControlName="driverLicenseCategory"
                        class="form-input"
                        placeholder="B, C, D, etc."
                      >
                    </div>
                  </div>

                  <div class="form-group full-width">
                    <label for="preferredZones">Preferred Zones</label>
                    <div class="input-wrapper">
                      <i class="fas fa-map input-icon"></i>
                      <input
                        type="text"
                        id="preferredZones"
                        formControlName="preferredZones"
                        class="form-input"
                        placeholder="Downtown, Suburbs, etc."
                      >
                    </div>
                  </div>
                </div>
              </div>

              <!-- Individual Fields (if any specific fields needed) -->
              <div class="form-section" *ngIf="isIndividual()">
                <div class="info-card">
                  <i class="fas fa-user-circle"></i>
                  <h3>Individual Account</h3>
                  <p>Your basic information is all we need for your individual account.</p>
                </div>
              </div>
            </div>

            <!-- Step 4: Confirmation -->
            <div class="form-step" *ngIf="currentStep === 3" [@stepAnimation]>
              <div class="step-header">
                <h2><i class="fas fa-check-circle"></i> Review & Save</h2>
                <p>Review your information before saving</p>
              </div>

              <div class="review-card">
                <h3>Profile Summary</h3>
                <div class="review-grid">
                  <div class="review-item">
                    <strong>Name:</strong>
                    <span>{{ profileForm.get('firstName')?.value }} {{ profileForm.get('lastName')?.value }}</span>
                  </div>
                  <div class="review-item">
                    <strong>Email:</strong>
                    <span>{{ profileForm.get('email')?.value }}</span>
                  </div>
                  <div class="review-item">
                    <strong>Phone:</strong>
                    <span>{{ profileForm.get('phone')?.value }}</span>
                  </div>
                  <div class="review-item">
                    <strong>Address:</strong>
                    <span>{{ profileForm.get('address')?.value }}</span>
                  </div>
                  
                  <div class="review-item" *ngIf="isEnterprise() && profileForm.get('companyName')?.value">
                    <strong>Company:</strong>
                    <span>{{ profileForm.get('companyName')?.value }}</span>
                  </div>
                  
                  <div class="review-item" *ngIf="isDeliveryPerson() && profileForm.get('vehicleType')?.value">
                    <strong>Vehicle:</strong>
                    <span>{{ profileForm.get('vehicleType')?.value }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <button 
                type="button" 
                class="btn btn-secondary"
                *ngIf="currentStep > 0"
                (click)="previousStep()"
                [disabled]="isAnimating"
              >
                <i class="fas fa-arrow-left"></i>
                Previous
              </button>

              <button 
                type="button" 
                class="btn btn-primary"
                *ngIf="currentStep < steps.length - 1"
                (click)="nextStep()"
                [disabled]="isAnimating"
              >
                Next
                <i class="fas fa-arrow-right"></i>
              </button>

              <button 
                type="submit" 
                class="btn btn-success"
                *ngIf="currentStep === steps.length - 1"
                [disabled]="!profileForm.valid || isSaving"
              >
                <span *ngIf="!isSaving">
                  <i class="fas fa-save"></i>
                  Save Profile
                </span>
                <span *ngIf="isSaving">
                  <i class="fas fa-spinner fa-spin"></i>
                  Saving...
                </span>
              </button>

              <button 
                type="button" 
                class="btn btn-outline"
                (click)="onCancel()"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit {

  // Add these properties
  isAdminEdit = false;
  editingUserId: string | null = null;



  profileForm: FormGroup;
  currentUser: User | null = null;
  userType: string = '';
  isLoading = false;
  isSaving = false;
  isAnimating = false;
  profilePhotoUrl: string = '';
  currentStep = 0;
  showNotification = false;
  
  // Messages
  successMessage = '';
  errorMessage = '';

  // Steps configuration
  steps = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'contact', label: 'Contact' },
    { key: 'specific', label: 'Details' },
    { key: 'review', label: 'Review' }
  ];

  // Constants
  USER_TYPES = USER_TYPES;
  VEHICLE_TYPES = VEHICLE_TYPES;
  BUSINESS_TYPES = BUSINESS_TYPES;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
     private route: ActivatedRoute
  ) {
    this.profileForm = this.createForm();
  }

ngOnInit(): void {
    // Check route parameters to determine if this is admin edit mode
    this.route.params.subscribe(params => {
      if (params['userId']) {
        // Admin is editing another user
        this.isAdminEdit = true;
        this.editingUserId = params['userId'];
        this.loadUserForEdit(params['userId']);
      } else if (params['id']) {
        // Alternative parameter name (from /admin/users/edit/:id)
        this.isAdminEdit = true;
        this.editingUserId = params['id'];
        this.loadUserForEdit(params['id']);
      } else {
        // User is editing their own profile
        this.isAdminEdit = false;
        this.loadUserProfile();
      }
    });
    
    this.setRandomProfilePhoto();
  }
private loadUserForEdit(userId: string): void {
    this.isLoading = true;
    this.clearMessages();
    
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        console.log('User data for admin edit:', user);
        this.currentUser = user;
        this.userType = this.determineUserType(user);
        this.populateForm(user);
        this.setValidators();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user for admin edit:', error);
        this.showErrorMessage('Error loading user data: ' + error.message);
        this.isLoading = false;
        // Navigate back to admin panel on error
        this.router.navigate(['/admin/DeliveryPersonnel']);
      }
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      
      // Enterprise fields
      companyName: [''],
      businessType: [''],
      vatNumber: [''],
      businessPhone: [''],
      businessAddress: [''],
      deliveryRadius: [''],
      
      // Vehicle fields
      vehicleType: [''],
      vehicleBrand: [''],
      vehicleModel: [''],
      vehiclePlateNumber: [''],
      vehicleYear: [''],
      vehicleColor: [''],
      driverLicenseNumber: [''],
      driverLicenseCategory: [''],
      preferredZones: ['']
    });
  }

private loadUserProfile(): void {
    this.isLoading = true;
    this.clearMessages();
    
    this.userService.getUserDetails().subscribe({
      next: (user) => {
        console.log('User data received:', user);
        this.currentUser = user;
        this.userType = this.determineUserType(user);
        this.populateForm(user);
        this.setValidators();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.showErrorMessage('Error loading profile data: ' + error.message);
        this.isLoading = false;
        
        // Try to load by ID if me endpoint fails
        this.loadUserById();
      }
    });
  }


  private loadUserById(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.userId) {
      this.userService.getUserById(currentUser.userId).subscribe({
        next: (user) => {
          console.log('User data loaded by ID:', user);
          this.currentUser = user;
          this.userType = this.determineUserType(user);
          this.populateForm(user);
          this.setValidators();
        },
        error: (error) => {
          console.error('Error loading user by ID:', error);
          this.showErrorMessage('Failed to load user profile');
        }
      });
    }
  }
private determineUserType(user: User): string {
    // Check roles first, then userType field
    if (user.roles && user.roles.length > 0) {
      if (user.roles.includes('ROLE_ADMIN') || user.roles.includes('ADMIN')) return USER_TYPES.ADMIN;
      if (user.roles.includes('ROLE_ENTERPRISE') || user.roles.includes('ENTERPRISE')) return USER_TYPES.ENTERPRISE;
      if (user.roles.includes('ROLE_PROFESSIONAL') || user.roles.includes('PROFESSIONAL')) return USER_TYPES.PROFESSIONAL;
      if (user.roles.includes('ROLE_TEMPORARY') || user.roles.includes('TEMPORARY')) return USER_TYPES.TEMPORARY;
      if (user.roles.includes('ROLE_INDIVIDUAL') || user.roles.includes('INDIVIDUAL')) return USER_TYPES.INDIVIDUAL;
    }
    
    // Fallback to userType field if available
    return user.userType || USER_TYPES.INDIVIDUAL;
  }
 private populateForm(user: User): void {
    // Safely handle null/undefined values with proper fallbacks
    const formData = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      
      // Enterprise fields
      companyName: user.companyName || '',
      businessType: user.businessType || '',
      vatNumber: user.vatNumber || '',
      businessPhone: user.businessPhone || '',
      businessAddress: user.businessAddress || '',
      deliveryRadius: user.deliveryRadius || 0,
      
      // Vehicle fields
      vehicleType: user.vehicleType || '',
      vehicleBrand: user.vehicleBrand || '',
      vehicleModel: user.vehicleModel || '',
      vehiclePlateNumber: user.vehiclePlateNumber || '',
      vehicleYear: user.vehicleYear || null,
      vehicleColor: user.vehicleColor || '',
      
      // Professional fields
      driverLicenseNumber: user.driverLicenseNumber || '',
      driverLicenseCategory: user.driverLicenseCategory || '',
      preferredZones: user.preferredZones || ''
    };

    console.log('Form data to populate:', formData);
    
    // Use setTimeout to ensure form is ready before patching values
    setTimeout(() => {
      this.profileForm.patchValue(formData);
    }, 0);
  }
  private setValidators(): void {
    // Add required validators based on user type
    if (this.isEnterprise()) {
      this.profileForm.get('companyName')?.setValidators([Validators.required]);
      this.profileForm.get('businessType')?.setValidators([Validators.required]);
    }

    if (this.isDeliveryPerson()) {
      this.profileForm.get('vehicleType')?.setValidators([Validators.required]);
      this.profileForm.get('driverLicenseNumber')?.setValidators([Validators.required]);
    }

    // Update validity
    this.profileForm.updateValueAndValidity();
  }

  private setRandomProfilePhoto(): void {
    const photoId = Math.floor(Math.random() * 100) + 1;
    this.profilePhotoUrl = `https://picsum.photos/120/120?random=${photoId}`;
  }

  // Step navigation methods
  nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      if (this.isStepValid(this.currentStep)) {
        this.isAnimating = true;
        setTimeout(() => {
          this.currentStep++;
          this.isAnimating = false;
        }, 200);
      } else {
        this.showErrorMessage('Please fill in all required fields correctly before proceeding.');
      }
    }
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.isAnimating = true;
      setTimeout(() => {
        this.currentStep--;
        this.isAnimating = false;
      }, 200);
    }
  }

  private isStepValid(step: number): boolean {
    switch (step) {
      case 0: // Basic info
        const firstName = this.profileForm.get('firstName');
        const lastName = this.profileForm.get('lastName');
        const email = this.profileForm.get('email');
        return !!(firstName?.valid && lastName?.valid && email?.valid);
      case 1: // Contact info
        const phone = this.profileForm.get('phone');
        const address = this.profileForm.get('address');
        return !!(phone?.valid && address?.valid);
      case 2: // Specific info
        if (this.isEnterprise()) {
          const companyName = this.profileForm.get('companyName');
          const businessType = this.profileForm.get('businessType');
          return !!(companyName?.valid && businessType?.valid);
        }
        if (this.isDeliveryPerson()) {
          const vehicleType = this.profileForm.get('vehicleType');
          const driverLicense = this.profileForm.get('driverLicenseNumber');
          return !!(vehicleType?.valid && driverLicense?.valid);
        }
        return true;
      default:
        return true;
    }
  }

  getStepLabel(index: number): string {
    return this.steps[index]?.label || '';
  }

onSubmit(): void {
    if (this.profileForm.valid && this.currentUser) {
      this.isSaving = true;
      this.clearMessages();
      
      const formData = this.profileForm.value;
      const updatedUser: User = {
        ...this.currentUser,
        ...formData
      };

      let updateObservable: Observable<any>;
      
      if (this.isAdminEdit && this.editingUserId) {
        // Admin editing another user - use the comprehensive updateUser method
        updateObservable = this.userService.updateUser(this.editingUserId, updatedUser);
      } else {
        // User editing their own profile
        updateObservable = this.userService.updateProfile(updatedUser);
      }

      updateObservable.subscribe({
        next: (response) => {
          this.showSuccessMessage('Profile saved successfully!');
          this.isSaving = false;
          
          // Navigate back after 2 seconds
          setTimeout(() => {
            if (this.isAdminEdit) {
              this.router.navigate(['/admin/DeliveryPersonnel']);
            } else {
              this.router.navigate(['/profile']);
            }
          }, 2000);
        },
        error: (error) => {
          this.showErrorMessage('Error saving profile: ' + error.message);
          this.isSaving = false;
        }
      });
    } else {
      this.markAllFieldsAsTouched();
      this.showErrorMessage('Please fill in all required fields correctly.');
    }
  }

  onCancel(): void {
    if (this.isAdminEdit) {
      this.router.navigate(['/admin/DeliveryPersonnel']);
    } else {
      this.router.navigate(['/profile']);
    }
  }
  getPageTitle(): string {
    if (this.isAdminEdit && this.currentUser) {
      return `Edit ${this.currentUser.firstName} ${this.currentUser.lastName}'s Profile`;
    }
    return 'Edit Your Profile';
  }

  // Add method to get breadcrumb text
  getBreadcrumbText(): string {
    if (this.isAdminEdit) {
      return 'Admin > Delivery Personnel > Edit Profile';
    }
    return 'My Profile > Edit';
  }
  getErrorMessage(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (!field || !field.touched || field.valid) {
      return '';
    }

    if (field.hasError('required')) {
      return `${this.getFieldDisplayName(fieldName)} is required.`;
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return `${this.getFieldDisplayName(fieldName)} must be at least ${minLength} characters long.`;
    }
    if (field.hasError('email')) {
      return 'Please enter a valid email address.';
    }
    if (field.hasError('pattern')) {
      return `Please enter a valid ${this.getFieldDisplayName(fieldName).toLowerCase()}.`;
    }
    
    return 'This field is invalid.';
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone Number',
      address: 'Address',
      companyName: 'Company Name',
      businessType: 'Business Type',
      vatNumber: 'VAT Number',
      businessPhone: 'Business Phone',
      businessAddress: 'Business Address',
      vehicleType: 'Vehicle Type',
      vehicleBrand: 'Vehicle Brand',
      vehicleModel: 'Vehicle Model',
      vehiclePlateNumber: 'License Plate',
      vehicleYear: 'Vehicle Year',
      vehicleColor: 'Vehicle Color',
      driverLicenseNumber: 'Driver License Number',
      driverLicenseCategory: 'License Category',
      preferredZones: 'Preferred Zones'
    };
    return fieldNames[fieldName] || fieldName;
  }

  // Utility methods
isEnterprise(): boolean {
  return this.userType === USER_TYPES.ENTERPRISE || 
         (this.currentUser?.roles || []).includes('ROLE_ENTERPRISE');
}


isDeliveryPerson(): boolean {
  return this.userType === USER_TYPES.PROFESSIONAL || 
         this.userType === USER_TYPES.TEMPORARY ||
         (this.currentUser?.roles || []).includes('ROLE_PROFESSIONAL') ||
         (this.currentUser?.roles || []).includes('ROLE_TEMPORARY');
}

isIndividual(): boolean {
  return this.userType === USER_TYPES.INDIVIDUAL || 
         (this.currentUser?.roles || []).includes('ROLE_INDIVIDUAL');
}

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.markAsTouched();
    });
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.showNotification = false;
  }

  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    this.showNotification = true;
  }

  private showErrorMessage(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    this.showNotification = true;
  }
}