import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin-service.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Vehicle, VehicleType } from '../../../models/Vehicle.model';
import { VehicleService } from '../../../services/vehicle-service.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  loading = true;
  error = '';

  // Form related properties
  userForm: FormGroup;
  formMode = ''; // 'add' or 'edit'
  selectedUserId: string | null = null;
  formSubmitting = false;

  // Vehicle assignment
  availableVehicles: Vehicle[] = [];
  selectedVehicleId: string | null = null;

  // User types for delivery personnel
  userTypes = ['professional', 'temporary'];

  vehicleTypes = [
    { value: 'MOTORCYCLE', display: 'Moto' },
    { value: 'CAR', display: 'Voiture' },
    { value: 'TRUCK', display: 'Camion' }
  ];

  // Vehicle selection properties
  showVehicleSelectionForm = false;
  userForVehicle: any = null;
  vehicleSubmitting = false;

  // User details dialog properties
  showDetailsDialog = false;
  selectedUser: any = null;

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private userService: UserService,
    private vehicleService: VehicleService
  ) {
    this.userForm = this.createUserForm();
  }

  ngOnInit() {
    // Clear vehicle cache on component initialization to ensure fresh data
    this.vehicleService.clearCache();
    this.loadDeliveryPersonnel();
  }

  createUserForm(): FormGroup {
    return this.formBuilder.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required]],
      userType: ['professional', [Validators.required]],
      vehicleType: ['MOTORCYCLE', [Validators.required]]
    });
  }

  loadDeliveryPersonnel() {
    this.loading = true;
    this.error = '';
    
    this.adminService.getAllUsers().pipe(
      switchMap(users => {
        this.users = users.filter((user: any) => 
          user.roles?.includes('ROLE_PROFESSIONAL') || 
          user.roles?.includes('ROLE_TEMPORARY')
        );
        
        const vehicleObservables = this.users
          .filter(user => user.assignedVehicleId)
          .map(user => 
            this.vehicleService.getVehicleById(user.assignedVehicleId).pipe(
              catchError(() => of(null)), // Handle errors without breaking the stream
              map(vehicle => ({ user, vehicle })))
          );
        
        return vehicleObservables.length ? forkJoin(vehicleObservables) : of([]);
      })
    ).subscribe({
      next: (results: any[]) => {
        results.forEach(({ user, vehicle }) => {
          if (vehicle) {
            user.assignedVehicle = vehicle;
          }
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load delivery personnel';
        this.loading = false;
        console.error('Error loading users:', err);
      }
    });
  }

  loadAllAssignedVehicles() {
    const usersWithVehicles = this.users.filter(user => user.assignedVehicleId);
    
    if (usersWithVehicles.length === 0) {
      this.loading = false;
      return;
    }
    
    let loadedCount = 0;
    
    // For each user with an assigned vehicle, load vehicle details
    usersWithVehicles.forEach(user => {
      // Force vehicle to load by clearing cache for this specific vehicle
      this.vehicleService.removeFromCache(user.assignedVehicleId);
      
      this.vehicleService.getVehicleById(user.assignedVehicleId).subscribe({
        next: (vehicle) => {
          // Find the user in the array and update their vehicle info
          const index = this.users.findIndex(u => u.id === user.id);
          if (index !== -1) {
            this.users[index].assignedVehicle = vehicle;
          }
          
          // Update user if it's currently selected
          if (this.selectedUser && this.selectedUser.id === user.id) {
            this.selectedUser.assignedVehicle = vehicle;
          }
          
          loadedCount++;
          if (loadedCount === usersWithVehicles.length) {
            this.loading = false;
          }
        },
        error: (err) => {
          console.error(`Error loading vehicle for user ${user.id}:`, err);
          loadedCount++;
          if (loadedCount === usersWithVehicles.length) {
            this.loading = false;
          }
        }
      });
    });
  }

  loadVehicleDetails(user: any) {
    if (!user.assignedVehicleId) return;

    // Force refresh from server by removing from cache
    this.vehicleService.removeFromCache(user.assignedVehicleId);
    
    this.vehicleService.getVehicleById(user.assignedVehicleId).subscribe({
      next: (vehicle) => {
        user.assignedVehicle = vehicle;
      },
      error: (err) => {
        console.error(`Error loading vehicle details for user ${user.id}:`, err);
      }
    });
  }

  loadAvailableVehicles(): void {
    // Clear cache to ensure we get fresh data
    this.vehicleService.clearCache();
    
    this.vehicleService.getAvailableVehicles().subscribe({
      next: (vehicles) => {
        this.availableVehicles = vehicles;
        if (vehicles.length > 0) {
          this.selectedVehicleId = null; // Don't pre-select, let user choose
        }
      },
      error: (err) => {
        console.error('Error loading available vehicles:', err);
      }
    });
  }

  blockUser(userId: string): void {
    if (confirm('Are you sure you want to block this delivery person?')) {
      this.adminService.updateUserStatus(userId, 'BLOCKED').subscribe({
        next: () => {
          alert('Delivery person blocked successfully!');
          this.loadDeliveryPersonnel();
        },
        error: (err) => {
          console.error('Error blocking user:', err);
          alert('Failed to block delivery person. Please try again.');
        }
      });
    }
  }

  showAddUserForm(): void {
    this.formMode = 'add';
    this.selectedUserId = null;
    this.resetForm();
    this.loadAvailableVehicles();

    // Set validators for password field
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
  }

  showEditUserForm(user: any): void {
    this.formMode = 'edit';
    this.selectedUserId = user.id;

    // Remove validators for password field when editing
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();

    const userType = this.getUserType(user.roles);

    this.userForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      userType: userType,
      vehicleType: user.vehicleType || 'MOTORCYCLE'
    });

    // Load available vehicles for this user
    this.loadAvailableVehicles();
  }

  // Show vehicle selection form for a specific user
  showSelectVehicleForm(user: any): void {
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

  assignSelectedVehicle() {
    if (this.selectedVehicleId && this.userForVehicle?.id) {
      this.vehicleSubmitting = true;
      
      // We'll use the auth service's method for assignment
      this.userService.assignVehicleToUser(this.userForVehicle.id, this.selectedVehicleId)
        .subscribe({
          next: () => {
            // Clear the vehicle cache to ensure fresh data
            this.vehicleService.clearCache();
            
            // Update the user in the local array
            const userIndex = this.users.findIndex(u => u.id === this.userForVehicle.id);
            if (userIndex !== -1) {
              // Update the assignedVehicleId in the user object
              this.users[userIndex].assignedVehicleId = this.selectedVehicleId;
              
              // Force reload the vehicle details
              this.vehicleService.getVehicleById(this.selectedVehicleId!).subscribe({
                next: (vehicle) => {
                  this.users[userIndex].assignedVehicle = vehicle;
                  
                  // Update the selected user if it's currently being viewed
                  if (this.selectedUser && this.selectedUser.id === this.userForVehicle.id) {
                    this.selectedUser.assignedVehicleId = this.selectedVehicleId;
                    this.selectedUser.assignedVehicle = vehicle;
                  }
                  
                  alert('Vehicle assigned successfully!');
                  this.closeVehicleSelectionForm();
                  this.vehicleSubmitting = false;
                },
                error: (err) => {
                  console.error('Failed to load vehicle details:', err);
                  alert('Vehicle assigned but details could not be loaded. Please refresh the page.');
                  this.closeVehicleSelectionForm();
                  this.vehicleSubmitting = false;
                }
              });
            } else {
              alert('Vehicle assigned successfully!');
              this.closeVehicleSelectionForm();
              this.vehicleSubmitting = false;
              // Reload all data to ensure consistency
              this.loadDeliveryPersonnel();
            }
          },
          error: (err) => {
            console.error('Assignment failed:', err);
            alert('Failed to assign vehicle. Please try again.');
            this.vehicleSubmitting = false;
          }
        });
    }
  }

  // Show user details dialog
  showUserDetails(user: any): void {
    // Always force a fresh load of vehicle info when viewing details
    if (user.assignedVehicleId) {
      this.loadVehicleDetails(user);
    }
    
    this.selectedUser = { ...user };
    this.showDetailsDialog = true;
  }

  closeDetailsDialog(): void {
    this.showDetailsDialog = false;
    this.selectedUser = null;
  }

  // Helper functions for vehicle display
  getVehicleIcon(vehicleType: string): string {
    switch (vehicleType) {
      case 'MOTORCYCLE':
        return 'fa-motorcycle';
      case 'TRUCK':
        return 'fa-truck';
      case 'CAR':
      default:
        return 'fa-car';
    }
  }

  getVehicleTypeName(vehicleType: string): string {
    switch (vehicleType) {
      case 'MOTORCYCLE':
        return 'Motorcycle';
      case 'TRUCK':
        return 'Truck';
      case 'CAR':
        return 'Car';
      default:
        return vehicleType;
    }
  }

  getUserType(roles: string[]): string {
    if (!roles || roles.length === 0) return 'professional';

    if (roles.includes('ROLE_PROFESSIONAL')) return 'professional';
    if (roles.includes('ROLE_TEMPORARY')) return 'temporary';

    return 'professional';
  }

  // Check if user is professional delivery person
  isProfessional(user: any): boolean {
    return user.roles && user.roles.includes('ROLE_PROFESSIONAL');
  }

  resetForm(): void {
    this.userForm.reset({
      userType: 'professional',
      vehicleType: 'MOTORCYCLE'
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      Object.keys(this.userForm.controls).forEach(key => {
        this.userForm.get(key)?.markAsTouched();
      });
      return;
    }
  
    this.formSubmitting = true;
    const formData = this.userForm.value;
  
    const userData: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      vehicleType: formData.vehicleType,
      assignedVehicleId: this.selectedVehicleId,
      userType: formData.userType
        };
  
    // Only include password for new users
    if (this.formMode === 'add') {
      userData.password = formData.password;
    }
  
    if (this.formMode === 'add') {
      // FIX: Remove the second parameter since the register method only expects one
      this.authService.register(userData, formData.userType).subscribe({
        next: () => {
          alert('Delivery person added successfully!');
          this.formSubmitting = false;
          this.formMode = '';
          this.loadDeliveryPersonnel();
        },
        error: (err) => {
          this.formSubmitting = false;
          this.error = err.message || 'Failed to create delivery person. Please try again.';
        }
      });
    } else if (this.formMode === 'edit' && this.selectedUserId) {
      this.userService.updateUser(this.selectedUserId, userData).subscribe({
        next: () => {
          alert('Delivery person updated successfully!');
          this.formSubmitting = false;
          this.formMode = '';
          this.loadDeliveryPersonnel();
        },
        error: (err) => {
          this.formSubmitting = false;
          this.error = err.message || 'Failed to update delivery person. Please try again.';
        }
      });
    }
  }

  onVehicleSelected(event: any) {
    this.selectedVehicleId = event.target.value;
  }

  // Check if a user has a vehicle assigned
  hasAssignedVehicle(user: any): boolean {
    return user.assignedVehicleId != null;
  }
}