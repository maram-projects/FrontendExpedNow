import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin-service.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Vehicle } from '../../../models/Vehicle.model';
import { VehicleService } from '../../../services/vehicle-service.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';

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
    this.adminService.getAllUsers().subscribe({
      next: (data) => {
        // Filter only delivery personnel (professional or temporary)
        this.users = data.filter((user: any) => 
          user.roles && (
            user.roles.includes('ROLE_PROFESSIONAL') || 
            user.roles.includes('ROLE_TEMPORARY')
          )
        );
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load delivery personnel';
        this.loading = false;
      }
    });
  }

  loadAvailableVehicles(): void {
    this.vehicleService.getAvailableVehicles().subscribe({
      next: (vehicles) => {
        this.availableVehicles = vehicles;
        if (vehicles.length > 0) {
          this.selectedVehicleId = vehicles[0].id || null;
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
  }

  getUserType(roles: string[]): string {
    if (!roles || roles.length === 0) return 'professional';
    
    if (roles.includes('ROLE_PROFESSIONAL')) return 'professional';
    if (roles.includes('ROLE_TEMPORARY')) return 'temporary';
    
    return 'professional';
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
      assignedVehicleId: this.selectedVehicleId // Make sure we're using the correct property name
    };

    // Only include password for new users
    if (this.formMode === 'add') {
      userData.password = formData.password;
    }

    if (this.formMode === 'add') {
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
}