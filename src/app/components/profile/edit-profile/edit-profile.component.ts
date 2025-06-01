import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { User, USER_TYPES } from '../../../models/user.model';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule, 
    HttpClientModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit {
  editProfileForm: FormGroup;
  isAdminMode = false;
  userId: string | null = null;
  userToEdit: User | null = null;
  loading = true;
  error = '';
  isCurrentUser = false;
  availableRoles = [
    { value: 'ROLE_ADMIN', display: 'Admin' },
    { value: 'ROLE_CLIENT', display: 'Client' },
    { value: 'ROLE_INDIVIDUAL', display: 'Individual' },
    { value: 'ROLE_ENTERPRISE', display: 'Enterprise' },
    { value: 'ROLE_PROFESSIONAL', display: 'Professional Driver' },
    { value: 'ROLE_TEMPORARY', display: 'Temporary Driver' }
  ];
  
  // User types for admin dropdown
  userTypes = [
    { value: USER_TYPES.INDIVIDUAL, label: 'Individual' },
    { value: USER_TYPES.ENTERPRISE, label: 'Enterprise' },
    { value: USER_TYPES.TEMPORARY, label: 'Temporary Driver' },
    { value: USER_TYPES.PROFESSIONAL, label: 'Professional Driver' },
    { value: USER_TYPES.ADMIN, label: 'Admin' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.editProfileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      userType: [''], // Only for admin mode
      enabled: [true], // Only for admin mode
      approved: [true], // Only for admin mode
      rejected: [false], // Add this line for admin mode
      roles: [[]] // For multiple roles selection
    });
  }

  ngOnInit(): void {
    // Check if user ID is provided in route (admin editing mode)
    this.userId = this.route.snapshot.paramMap.get('id');
    const currentUser = this.authService.getCurrentUser();
    
    if (this.userId) {
      // Admin editing mode
      this.isAdminMode = this.authService.isAdmin();
      if (!this.isAdminMode) {
        this.error = 'Access denied. Admin privileges required.';
        this.loading = false;
        return;
      }
      
      // Check if editing current user
      this.isCurrentUser = currentUser?.userId === this.userId;
      
      // Load user data for editing
      this.loadUserData(this.userId);
      
      // Add admin-only form controls
      this.addAdminControls();
    } else {
      // Self-editing mode
      this.isAdminMode = false;
      this.loadCurrentUserData();
    }
  }

  private addAdminControls(): void {
    // Add validators for admin-only fields
    this.editProfileForm.get('userType')?.setValidators([Validators.required]);
    this.editProfileForm.get('userType')?.updateValueAndValidity();
  }

  private loadUserData(userId: string): void {
    this.loading = true;
    this.userService.getUserById(userId).subscribe({
        next: (user) => {
            this.userToEdit = user;
            this.editProfileForm.patchValue({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                phone: user.phone || '',
                address: user.address || '',
                userType: user.userType || this.getUserTypeFromRoles(user.roles),
                enabled: user.enabled ?? true,
                approved: user.approved ?? true,
                rejected: user.rejected ?? false,
                roles: user.roles || []
            });
            this.loading = false;
        },
        error: (err) => {
            this.error = 'Failed to load user data. Please try again.';
            this.loading = false;
            this.showSnackbar(this.error);
        }
    });
  }

  private getUserTypeFromRoles(roles?: string[]): string {
    if (!roles || roles.length === 0) return '';
    if (roles.includes('ROLE_ADMIN')) return USER_TYPES.ADMIN;
    if (roles.includes('ROLE_PROFESSIONAL')) return USER_TYPES.PROFESSIONAL;
    if (roles.includes('ROLE_TEMPORARY')) return USER_TYPES.TEMPORARY;
    if (roles.includes('ROLE_ENTERPRISE')) return USER_TYPES.ENTERPRISE;
    if (roles.includes('ROLE_INDIVIDUAL')) return USER_TYPES.INDIVIDUAL;
    return '';
  }

  private loadCurrentUserData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.editProfileForm.patchValue({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        address: currentUser.address || ''
      });
    }
    this.loading = false;
  }

  onSubmit(): void {
    if (this.editProfileForm.valid) {
        const formValue = this.editProfileForm.value;
        
        // Update userType based on selected roles
        const updatedUserType = this.getUserTypeFromRoles(formValue.roles);
        
        const updatedUserData = {
            firstName: this.editProfileForm.get('firstName')?.value,
            lastName: this.editProfileForm.get('lastName')?.value,
            email: this.editProfileForm.get('email')?.value,
            phone: this.editProfileForm.get('phone')?.value,
            address: this.editProfileForm.get('address')?.value,
            roles: formValue.roles || [],
            userType: updatedUserType, // This will be sent to backend
            ...(this.isAdminMode && {
                enabled: this.editProfileForm.get('enabled')?.value,
                approved: this.editProfileForm.get('approved')?.value,
                rejected: this.userToEdit?.rejected || false
            })
        };

        const updateObservable = this.isAdminMode && this.userId
            ? this.userService.updateUserById(this.userId, updatedUserData)
            : this.userService.updateProfile(updatedUserData as User);
            
        updateObservable.subscribe({
            next: (response) => {
                const message = this.isAdminMode ? 'User updated successfully' : 'Profile updated successfully';
                this.showSnackbar(message);
                
                if (this.isAdminMode) {
                    this.router.navigate(['/admin/users']);
                } else {
                    this.router.navigate(['/profile']);
                }
            },
            error: (err) => {
                const message = this.isAdminMode ? 'Error updating user' : 'Error updating profile';
                this.showSnackbar(`${message}: ${err.message || 'Please try again'}`);
            }
        });
    } else {
        this.markFormGroupTouched();
    }
  }

  onCancel(): void {
    if (this.isAdminMode) {
      this.router.navigate(['/admin/users']);
    } else {
      this.router.navigate(['/profile']);
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.editProfileForm.controls).forEach(key => {
      const control = this.editProfileForm.get(key);
      control?.markAsTouched();
    });
  }

  private showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  // Helper methods for template
  getFieldError(fieldName: string): string {
    const field = this.editProfileForm.get(fieldName);
    if (field?.hasError('required')) {
      return `${fieldName} is required`;
    }
    if (field?.hasError('email')) {
      return 'Please enter a valid email address';
    }
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.editProfileForm.get(fieldName);
    return !!(field?.invalid && (field?.dirty || field?.touched));
  }
}