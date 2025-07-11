import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, map, switchMap, takeUntil, finalize, tap } from 'rxjs/operators';

import { convertDtoToVehicle, convertVehicleToDto, Vehicle, VehicleDTO } from '../../../models/Vehicle.model';
import { User, USER_TYPES } from '../../../models/user.model';
import { AdminService } from '../../../services/admin-service.service';
import { AuthService } from '../../../services/auth.service';
import { VehicleService } from '../../../services/vehicle-service.service';
import { UserService } from '../../../services/user.service';
import { ProfessionalRegisterDialogComponent } from '../../dialogs/professional-register-dialog/professional-register-dialog.component';
import { VehiclePhotoPipe } from '../../../shared/pipes/vehicle-photo.pipe';
import { retry } from 'rxjs/operators';


interface DeliveryPersonnel extends User {
  vehicleLoading?: boolean;
  assignedVehicle?: Vehicle | null; // Remove VehicleDTO from type
}

interface VehicleType {
  value: string;
  display: string;
}

@Component({
  selector: 'app-delivery-personnel-management',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    VehiclePhotoPipe  
  ],
  templateUrl: './delivery-personnel-management.component.html',
  styleUrl: './delivery-personnel-management.component.css',
  standalone: true
})
export class DeliveryPersonnelManagementComponent implements OnInit, OnDestroy {
  // Core data
  users: DeliveryPersonnel[] = [];
  availableVehicles: Vehicle[] = [];
   
  debugMode = true; // Set to false for production

  // Loading states
  loading = true;
  formSubmitting = false;
  vehicleSubmitting = false;
  
  // Error handling
  error = '';
  
  // Form management
  userForm: FormGroup;
  formMode: 'add' | 'edit' | '' = '';
  selectedUserId: string | null = null;
  
  // Vehicle assignment
  selectedVehicleId: string | null = null;
  showVehicleSelectionForm = false;
  userForVehicle: DeliveryPersonnel | null = null;
  
  // Dialog management
  showDetailsDialog = false;
  selectedUser: DeliveryPersonnel | null = null;
  
  // Constants
  readonly userTypes = [USER_TYPES.PROFESSIONAL, USER_TYPES.TEMPORARY];
  readonly vehicleTypes: VehicleType[] = [
    { value: 'MOTORCYCLE', display: 'Moto' },
    { value: 'CAR', display: 'Voiture' },
    { value: 'TRUCK', display: 'Camion' }
  ];
  
  // Subscription management
  private destroy$ = new Subject<void>();

constructor(
  private adminService: AdminService,
  private authService: AuthService,
  private fb: FormBuilder,  // Add this line
  private userService: UserService,
  private vehicleService: VehicleService,
  private dialog: MatDialog,
  private snackBar: MatSnackBar,
  private router: Router
) {
  this.userForm = this.createUserForm();
}

  ngOnInit(): void {
    this.initializeComponent();
    this.debugMode = true; // Set this to see debug info
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    this.vehicleService.clearCache();
    this.loadDeliveryPersonnel();
  }

  showEditUserForm(user: DeliveryPersonnel): void {
  this.formMode = 'edit';
  this.selectedUserId = user.id!;
  
  // Set up the form with user data
  this.userForm = this.fb.group({
    firstName: [user.firstName, Validators.required],
    lastName: [user.lastName, Validators.required],
    email: [user.email, [Validators.required, Validators.email]],
    phone: [user.phone, Validators.required],
    address: [user.address, Validators.required],
    userType: [this.getUserType(user.roles || []), Validators.required],
    vehicleType: [user.vehicleType || 'MOTORCYCLE', Validators.required],
    driverLicenseNumber: [user.driverLicenseNumber || '', Validators.required],
    driverLicenseCategory: [user.driverLicenseCategory || '', Validators.required]
  });

  // If user has an assigned vehicle, set it
  if (user.assignedVehicleId) {
    this.selectedVehicleId = user.assignedVehicleId;
  }

  this.loadAvailableVehicles();
}


  // Professional Registration Dialog
  openProfessionalRegisterDialog(): void {
    const dialogRef = this.dialog.open(ProfessionalRegisterDialogComponent, {
      width: '800px',
      disableClose: true,
      data: { vehicleTypes: this.vehicleTypes }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.registerProfessional(result);
        }
      });
  }

  registerProfessional(formData: any): void {
    this.setLoadingState(true);
    
    const userData: User = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.password,
      phone: formData.phone,
      address: formData.address,
      vehicleType: formData.vehicleType,
      vehicleBrand: formData.vehicleBrand,
      vehicleModel: formData.vehicleModel,
      vehiclePlateNumber: formData.vehiclePlateNumber,
      driverLicenseNumber: formData.driverLicenseNumber,
      driverLicenseCategory: formData.driverLicenseCategory
    };

    this.authService.register(userData, USER_TYPES.PROFESSIONAL)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setLoadingState(false))
      )
      .subscribe({
        next: (response) => {
          const message = response.message || 'Professional delivery person registered successfully!';
          this.showSuccessMessage(message);
          this.loadDeliveryPersonnel();
        },
        error: (err) => {
          this.handleError('Failed to register professional', err);
        }
      });
  }

  // Form Management
private createUserForm(): FormGroup {
  return this.fb.group({  // <-- Changed from formBuilder to fb
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[\d\s-()]+$/)]],
    address: ['', [Validators.required, Validators.minLength(10)]],
    userType: ['professional', [Validators.required]],
    
    // Professional fields
    driverLicenseNumber: ['', [Validators.required]],
    driverLicenseCategory: ['', [Validators.required]],
    identityPhotoUrl: [''],
    criminalRecordDocumentUrl: [''],
    
    // Vehicle fields
    vehicleType: ['MOTORCYCLE', [Validators.required]],
    vehicleBrand: [''],
    vehicleModel: [''],
    vehiclePlateNumber: [''],
    vehicleInsuranceExpiry: [''],
    vehicleInspectionExpiry: ['']
  });
}

loadDeliveryPersonnel(): void {
  this.loading = true;
  
  this.userService.getDeliveryPersonnel().pipe(
    switchMap((users: User[]) => this.processDeliveryPersonnel(users)),
    finalize(() => this.loading = false),
    takeUntil(this.destroy$)
  ).subscribe({
    next: (users) => {
      this.users = users;
      console.log('Final users loaded:', this.users.length);
    },
    error: (err) => {
      console.error('Error loading delivery personnel:', err);
      this.handleError('Failed to load delivery personnel', err);
    }
  });
}


 // Fixed component methods
private processDeliveryPersonnel(users: User[]) {
  console.log('Processing users:', users);
  
  // Filter delivery personnel with more flexible role checking
  const deliveryPersonnel = users.filter(user => {
    const roles = user.roles || [];
    const userType = user.userType?.toLowerCase();
    
    const isDeliveryPerson = 
      // Check roles
      roles.some(role => 
        role.includes('PROFESSIONAL') || 
        role.includes('TEMPORARY') || 
        role.includes('DELIVERY')
      ) ||
      // Check userType
      userType === 'professional' || 
      userType === 'temporary' ||
      // Fallback: if user has vehicle-related properties, likely a delivery person
      !!(user.vehicleType || user.driverLicenseNumber || user.assignedVehicleId);
    
    console.log(`User ${user.email} is delivery person:`, isDeliveryPerson, {
      roles,
      userType,
      hasVehicleProps: !!(user.vehicleType || user.driverLicenseNumber || user.assignedVehicleId)
    });
    
    return isDeliveryPerson;
  });

  // Normalize assignedVehicleId field for each user
  deliveryPersonnel.forEach(user => {
    const vehicleId = user.assignedVehicleId || 
                     (user as any).assigned_vehicle_id || 
                     (user as any).vehicleId || 
                     null;
    
    user.assignedVehicleId = (vehicleId && typeof vehicleId === 'string' && vehicleId.trim() !== '') 
                           ? vehicleId 
                           : null;
  });

  console.log('=== NORMALIZED VEHICLE IDs ===');
  deliveryPersonnel.forEach(user => {
    console.log(`User ${user.firstName}: assignedVehicleId=${user.assignedVehicleId}`);
  });

  // Load vehicle details for users with assigned vehicles
  const usersWithVehicles = deliveryPersonnel.filter(user => 
    user.assignedVehicleId && 
    user.assignedVehicleId.trim() !== ''
  );

  if (usersWithVehicles.length === 0) {
    console.log('No users with assigned vehicles found');
    return of(deliveryPersonnel);
  }

  const vehicleObservables = usersWithVehicles.map(user =>
    this.vehicleService.getVehicleById(user.assignedVehicleId!)
      .pipe(
        catchError(err => {
          console.warn(`Failed to load vehicle ${user.assignedVehicleId} for user ${user.id}:`, err);
          return of(null);
        }),
        map(vehicle => ({ userId: user.id, vehicle }))
      )
  );

  return forkJoin(vehicleObservables).pipe(
    map(results => {
      console.log('Vehicle loading results:', results);
      
      results.forEach(({ userId, vehicle }) => {
        const user = deliveryPersonnel.find(u => u.id === userId);
        if (user && vehicle) {
          console.log(`Assigning vehicle to user ${user.firstName}:`, vehicle);
          user.assignedVehicle = vehicle;
        }
      });
      
      return deliveryPersonnel;
    })
  );
}

  private loadAvailableVehicles(): void {
    this.vehicleService.clearCache();
    
    this.vehicleService.getAvailableVehicles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vehicles) => {
          this.availableVehicles = vehicles;
          this.selectedVehicleId = null;
        },
        error: (err) => {
          console.error('Error loading available vehicles:', err);
          this.showErrorMessage('Failed to load available vehicles');
        }
      });
  }

  // User Management
  showAddUserForm(): void {
    this.formMode = 'add';
    this.selectedUserId = null;
    this.resetForm();
    this.loadAvailableVehicles();
    this.setPasswordValidators(true);
  }


onSubmit(): void {
  if (this.userForm.invalid) {
    this.markFormGroupTouched();
    return;
  }

  this.formSubmitting = true;
  const formData = this.userForm.value;
  const userData = this.buildUserData(formData);

  let operation$: Observable<any>;

  if (this.formMode === 'add') {
    operation$ = this.authService.register(userData, formData.userType);
  } else {
    operation$ = this.userService.updateUser(this.selectedUserId!, userData);
  }

  operation$.pipe(
    takeUntil(this.destroy$),
    finalize(() => this.formSubmitting = false)
  ).subscribe({
    next: (response) => {
      const message = this.formMode === 'add' 
        ? 'Delivery person added successfully!' 
        : 'Delivery person updated successfully!';
      this.showSuccessMessage(message);
      
      // FIXED: Update user in place instead of reloading all data
      if (this.formMode === 'edit' && response.user) {
        this.updateUserInPlace(response.user);
      } else {
        // Only reload if adding new user or if update response doesn't include user data
        this.loadDeliveryPersonnel();
      }
      
      this.resetFormState();
    },
    error: (err) => {
      this.handleError(`Failed to ${this.formMode} delivery person`, err);
    }
  });
}

// Add this new method to update user in place
private updateUserInPlace(updatedUser: User): void {
  const userIndex = this.users.findIndex(u => u.id === updatedUser.id);
  if (userIndex !== -1) {
    // Preserve the assigned vehicle data
    const existingVehicle = this.users[userIndex].assignedVehicle;
    const existingVehicleId = this.users[userIndex].assignedVehicleId;
    
    this.users[userIndex] = {
      ...updatedUser,
      assignedVehicle: existingVehicle,
      assignedVehicleId: existingVehicleId || updatedUser.assignedVehicleId
    };
  }
}


  private buildUserData(formData: any): any {
  const userData: any = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone,
    address: formData.address,
    vehicleType: formData.vehicleType,
    assignedVehicleId: this.selectedVehicleId,
    userType: formData.userType,
    driverLicenseNumber: formData.driverLicenseNumber,
    driverLicenseCategory: formData.driverLicenseCategory
  };

  if (this.formMode === 'add') {
    userData.password = formData.password;
    userData.confirmPassword = formData.password;
  }

  return userData;
}

  blockUser(userId: string): void {
    const user = this.users.find(u => u.id === userId);
    const userName = user ? `${user.firstName} ${user.lastName}` : 'this delivery person';
    
    if (confirm(`Are you sure you want to block ${userName}?`)) {
      this.adminService.updateUserStatus(userId, 'BLOCKED')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showSuccessMessage('Delivery person blocked successfully!');
            this.loadDeliveryPersonnel();
          },
          error: (err) => {
            this.handleError('Failed to block delivery person', err);
          }
        });
    }
  }

  // Vehicle Management
  showSelectVehicleForm(user: DeliveryPersonnel): void {
    this.userForVehicle = user;
    this.selectedVehicleId = null;
    this.showVehicleSelectionForm = true;
    this.loadAvailableVehicles();
  }

  closeVehicleSelectionForm(): void {
    this.showVehicleSelectionForm = false;
    this.userForVehicle = null;
    this.selectedVehicleId = null;
  }

  selectVehicle(vehicleId: string): void {
    this.selectedVehicleId = vehicleId;
  }

assignSelectedVehicle(): void {
  if (!this.selectedVehicleId || !this.userForVehicle?.id) {
    this.showErrorMessage('Please select both a user and a vehicle');
    return;
  }

  this.vehicleSubmitting = true;

  this.userService.assignVehicleToUser(this.userForVehicle.id, this.selectedVehicleId)
    .pipe(
      finalize(() => this.vehicleSubmitting = false)
    )
    .subscribe({
      next: (response) => {
        // Update the specific user in the users array
        const userIndex = this.users.findIndex(u => u.id === this.userForVehicle?.id);
        if (userIndex !== -1) {
          this.users[userIndex] = {
            ...this.users[userIndex],
            assignedVehicleId: response.vehicle.id,
            assignedVehicle: response.vehicle
          };
        }

        // Remove the assigned vehicle from available vehicles
        this.availableVehicles = this.availableVehicles.filter(
          v => v.id !== response.vehicle.id
        );

        this.showSuccessMessage('Vehicle assigned successfully!');
        this.closeVehicleSelectionForm();
      },
      error: (err) => {
        console.error('Assignment failed:', err);
        this.showErrorMessage('Failed to assign vehicle. Please try again.');
      }
    });
}
isVehicleAssigned(user: User): boolean {
  // Check multiple conditions to ensure vehicle is properly assigned
  const hasVehicleId = !!(user.assignedVehicleId && user.assignedVehicleId.trim() !== '');
  const hasVehicleObject = !!(user.assignedVehicle && 
                             typeof user.assignedVehicle === 'object' && 
                             user.assignedVehicle.id);
  
  console.log(`Vehicle assignment check for ${user.firstName}:`, {
    hasVehicleId,
    hasVehicleObject,
    assignedVehicleId: user.assignedVehicleId,
    assignedVehicle: user.assignedVehicle
  });
  
  return hasVehicleId && hasVehicleObject;
}

debugAssignedVehicle(user: User): void {
  console.log('=== ASSIGNED VEHICLE DEBUG ===');
  // ... other debug info
  if (user.assignedVehicle) {
    this.logAnyVehicleDetails(user.assignedVehicle, 'Assigned Vehicle');
  }
  console.log('==============================');
}


getVehicleById(vehicleId: string): Vehicle | undefined {
  return this.availableVehicles.find(v => v.id === vehicleId);
}
// Example in your component template:
getVehicleDisplayInfo(user: User): string {
  if (!user?.assignedVehicle) {
    return user?.assignedVehicleId ? 'Loading...' : 'No vehicle assigned';
  }

  const vehicle = user.assignedVehicle;
  if (this.isVehicleDTO(vehicle)) {
    return `${vehicle.vehicleBrand} ${vehicle.vehicleModel} (${vehicle.vehiclePlateNumber})`;
  } else {
    return `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`;
  }
}

debugVehicleAssignment(user: User): void {
  console.log('=== VEHICLE ASSIGNMENT DEBUG ===');
  console.log('User:', {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    assignedVehicleId: user.assignedVehicleId,
    assignedVehicle: user.assignedVehicle
  });
  
  if (user.assignedVehicle) {
    const vehicle = user.assignedVehicle;
    
    // Type guard to check if it's a VehicleDTO
    const isVehicleDTO = (v: Vehicle | VehicleDTO): v is VehicleDTO => {
      return 'vehicleBrand' in v && 'vehicleModel' in v && 'vehiclePlateNumber' in v;
    };
    
    if (isVehicleDTO(vehicle)) {
      const dto = vehicle as VehicleDTO;
      console.log('Vehicle details (DTO format):', {
        id: dto.id,
        brand: dto.vehicleBrand,
        model: dto.vehicleModel,
        plate: dto.vehiclePlateNumber,
        type: dto.vehicleType,
        year: dto.vehicleYear,
        capacity: dto.vehicleCapacityKg
      });
    } else {
      const v = vehicle as Vehicle;
      console.log('Vehicle details (Vehicle format):', {
        id: v.id,
        make: v.make,
        model: v.model,
        plate: v.licensePlate,
        type: v.vehicleType,
        year: v.year,
        maxLoad: v.maxLoad
      });
    }
  }
  console.log('=================================');
}

isVehicleDTO(vehicle: Vehicle | VehicleDTO): vehicle is VehicleDTO {
  return 'vehicleBrand' in vehicle;
}
 

 
logVehicleDetails(vehicle: Vehicle | VehicleDTO | undefined): void {
  if (!vehicle) {
    console.log('No vehicle provided');
    return;
  }
  
  // Type guard to check if it's a VehicleDTO
  const isVehicleDTO = (v: Vehicle | VehicleDTO): v is VehicleDTO => {
    return 'vehicleBrand' in v && 'vehicleModel' in v && 'vehiclePlateNumber' in v;
  };
  
  if (isVehicleDTO(vehicle)) {
    console.log('Vehicle details (DTO):', {
      id: vehicle.id,
      brand: vehicle.vehicleBrand,
      model: vehicle.vehicleModel,
      plate: vehicle.vehiclePlateNumber,
      type: vehicle.vehicleType,
      year: vehicle.vehicleYear,
      capacity: vehicle.vehicleCapacityKg
    });
  } else {
    console.log('Vehicle details (Vehicle):', {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      plate: vehicle.licensePlate,
      type: vehicle.vehicleType,
      year: vehicle.year,
      maxLoad: vehicle.maxLoad
    });
  }
}
  private updateUserVehicleAssignment(user: User, vehicle: Vehicle): void {
    const index = this.users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      this.users[index] = {
        ...this.users[index],
        assignedVehicleId: vehicle.id,
        assignedVehicle: vehicle
      };
    }
    
    this.availableVehicles = this.availableVehicles.filter(v => v.id !== vehicle.id);
  }

navigateToVehicleDetails(vehicleId: string, userId?: string): void {
  if (userId) {
    // Navigate with user context when coming from user details
    this.router.navigate(['/admin/vehicles', vehicleId], { 
      queryParams: { userId: userId, from: 'user-management' } 
    });
  } else {
    // Regular vehicle details navigation
    this.router.navigate(['/admin/vehicles', vehicleId]);
  }
}

  // User Details Dialog
  showUserDetails(user: DeliveryPersonnel): void {
    this.selectedUser = { ...user };
    
    if (user.assignedVehicleId && !user.assignedVehicle) {
      this.setLoadingState(true);
      this.vehicleService.getVehicleById(user.assignedVehicleId)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.setLoadingState(false))
        )
        .subscribe({
          next: (vehicle) => {
            this.selectedUser!.assignedVehicle = vehicle;
            this.showDetailsDialog = true;
          },
          error: (err) => {
            console.error('Error loading vehicle details:', err);
            this.selectedUser!.assignedVehicle = undefined;
            this.showDetailsDialog = true;
          }
        });
    } else {
      this.showDetailsDialog = true;
    }
  }

  closeDetailsDialog(): void {
    this.showDetailsDialog = false;
    this.selectedUser = null;
  }

  viewVehicleFromUserDetails(vehicleId: string, userId: string): void {
  this.closeDetailsDialog(); // Close the user details modal first
  this.navigateToVehicleDetails(vehicleId, userId);
}

  // Utility Methods
  getVehicleIcon(vehicleType: string): string {
    const icons: Record<string, string> = {
      'MOTORCYCLE': 'fa-motorcycle',
      'TRUCK': 'fa-truck',
      'CAR': 'fa-car'
    };
    return icons[vehicleType] || 'fa-car';
  }

  getVehicleTypeName(vehicleType: string): string {
    const names: Record<string, string> = {
      'MOTORCYCLE': 'Motorcycle',
      'TRUCK': 'Truck',
      'CAR': 'Car'
    };
    return names[vehicleType] || vehicleType;
  }

  getUserType(roles: string[]): string {
    if (!roles || roles.length === 0) return 'professional';
    if (roles.includes('ROLE_PROFESSIONAL')) return 'professional';
    if (roles.includes('ROLE_TEMPORARY')) return 'temporary';
    return 'professional';
  }

  isProfessional(user: DeliveryPersonnel): boolean {
    return user?.userType === 'professional' || 
           user?.roles?.includes('ROLE_PROFESSIONAL') || false;
  }

hasAssignedVehicle(user: DeliveryPersonnel): boolean {
  // For temporary delivery, consider they always have a vehicle
  if (!this.isProfessional(user)) return true;
  
  // For professionals, check actual assignment
  return !!(user?.assignedVehicle?.id || user?.assignedVehicleId);
}

  onVehicleSelected(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedVehicleId = target.value;
  }

  // Form Utilities
  private resetForm(): void {
    this.userForm.reset({
      userType: 'professional',
      vehicleType: 'MOTORCYCLE'
    });
  }

  private resetFormState(): void {
    this.formMode = '';
    this.selectedUserId = null;
    this.resetForm();
  }

  private setPasswordValidators(required: boolean): void {
    const passwordControl = this.userForm.get('password');
    if (required) {
      passwordControl?.setValidators([Validators.required, Validators.minLength(6)]);
    } else {
      passwordControl?.clearValidators();
    }
    passwordControl?.updateValueAndValidity();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });
  }

  // State Management
  private setLoadingState(loading: boolean): void {
    this.loading = loading;
  }

  private clearError(): void {
    this.error = '';
  }

  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.error = error.message || message;
    this.showErrorMessage(this.error);
  }

  private showSuccessMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showErrorMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

hasValidAssignedVehicle(user: User | null | undefined): boolean {
  if (!user) return false;
  
  // Check if we have a vehicle object with required properties
  if (user.assignedVehicle && typeof user.assignedVehicle === 'object') {
    // Type guard to determine if it's VehicleDTO or Vehicle
    const isVehicleDTO = (v: Vehicle | VehicleDTO): v is VehicleDTO => {
      return 'vehicleBrand' in v && 'vehicleModel' in v && 'vehiclePlateNumber' in v;
    };
    
    if (isVehicleDTO(user.assignedVehicle)) {
      const dto = user.assignedVehicle as VehicleDTO;
      return !!dto.id && !!dto.vehicleType && !!dto.vehicleBrand;
    } else {
      const vehicle = user.assignedVehicle as Vehicle;
      return !!vehicle.id && !!vehicle.vehicleType && !!vehicle.make;
    }
  }
  
  // Check if we have at least a vehicle ID
  return !!user.assignedVehicleId;
}
  isBooleanPropertyTrue(value: string | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false; // Handle null/undefined by returning false
}

convertToVehicleModel(vehicleData: Vehicle | VehicleDTO | null | undefined): Vehicle | null {
  if (!vehicleData) return null;
  
  // Type guard to check if it's already a Vehicle model
  const isVehicleModel = (v: Vehicle | VehicleDTO): v is Vehicle => {
    return 'make' in v && 'model' in v && 'licensePlate' in v;
  };
  
  if (isVehicleModel(vehicleData)) {
    return vehicleData as Vehicle;
  } else {
    // It's a DTO, convert it
    return convertDtoToVehicle(vehicleData as VehicleDTO);
  }
}
convertToVehicleDTO(vehicleData: Vehicle | VehicleDTO | null | undefined): VehicleDTO | null {
  if (!vehicleData) return null;
  
  // Type guard to check if it's already a VehicleDTO
  const isVehicleDTO = (v: Vehicle | VehicleDTO): v is VehicleDTO => {
    return 'vehicleBrand' in v && 'vehicleModel' in v && 'vehiclePlateNumber' in v;
  };
  
  if (isVehicleDTO(vehicleData)) {
    return vehicleData as VehicleDTO;
  } else {
    // It's a Vehicle model, convert it
    return convertVehicleToDto(vehicleData as Vehicle);
  }
}

navigateToProfessionalRegister(): void {
  this.router.navigate(['/admin/delivery-personnel/register']);
}

// Remove: logVehicleDetailsDTO(), logVehicleDetailsModel()

// Add this instead:
logAnyVehicleDetails(vehicle: Vehicle | VehicleDTO | undefined, label: string = 'Vehicle'): void {
  if (!vehicle) {
    console.log(`${label}: No vehicle provided`);
    return;
  }

  if ('make' in vehicle) {
    // Vehicle type
    console.log(`${label} (Vehicle):`, {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      plate: vehicle.licensePlate,
      type: vehicle.vehicleType,
      year: vehicle.year,
      maxLoad: vehicle.maxLoad,
      available: vehicle.available
    });
  } else {
    // VehicleDTO type
    console.log(`${label} (DTO):`, {
      id: vehicle.id,
      brand: vehicle.vehicleBrand,
      model: vehicle.vehicleModel,
      plate: vehicle.vehiclePlateNumber,
      type: vehicle.vehicleType,
      year: vehicle.vehicleYear,
      capacity: vehicle.vehicleCapacityKg,
      available: vehicle.available
    });
  }
}
}