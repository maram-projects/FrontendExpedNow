import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { User, USER_STATUS, USER_TYPES } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule
  ]
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  displayedColumns: string[] = ['name', 'email', 'type', 'status', 'registrationDate', 'actions'];
  loading = true;
  error = '';
  
  // Pagination
  pageSize = 10;
  pageIndex = 0;
  pageSizeOptions = [5, 10, 25];
  totalUsers = 0;

  // Filters
  filterStatus = '';
  filterType = '';

  constructor(
    private userService: UserService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      this.error = 'Access denied. Admin privileges required.';
      this.loading = false;
      return;
    }
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        console.log('Loaded users:', users);
        users.forEach(user => {
          console.log(`User ${user.email} has type:`, user.userType);
        });
        
        this.users = users;
        this.applyFilters();
        this.totalUsers = this.filteredUsers.length;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.error = 'Unable to load users. Please check your connection and try again.';
        this.loading = false;
        this.showErrorSnackbar('Failed to load users', err);
      }
    });
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
        const statusMatch = !this.filterStatus || 
                          this.getUserStatus(user) === this.filterStatus;
        const typeMatch = !this.filterType || 
                         user.userType === this.filterType;
        return statusMatch && typeMatch;
    });
    
    this.totalUsers = this.filteredUsers.length;
    this.pageIndex = 0; 
  }

  resetFilters(): void {
    this.filterStatus = '';
    this.filterType = '';
    this.applyFilters();
    this.showSuccessSnackbar('Filters have been reset successfully');
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
  }

  getPaginatedUsers(): User[] {
    const startIndex = this.pageIndex * this.pageSize;
    return this.filteredUsers.slice(startIndex, startIndex + this.pageSize);
  }

  approveUser(userId: string): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      this.showErrorSnackbar('User not found');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
            title: 'Approve User Registration',
            message: `Are you sure you want to approve ${user.firstName} ${user.lastName}'s registration? This will allow them to access the system.`,
            confirmText: 'Yes, Approve',
            cancelText: 'Cancel'
        }
    });

    dialogRef.afterClosed().subscribe(result => {
        if (result) {
            this.userService.approveUser(userId).subscribe({
                next: (updatedUser) => {
                    // Preserve the original user type and merge with updated data
                    const index = this.users.findIndex(u => u.id === userId);
                    if (index !== -1) {
                        this.users[index] = {
                            ...this.users[index], // Keep original data
                            ...updatedUser,       // Apply updates
                            userType: this.users[index].userType // Explicitly preserve userType
                        };
                        this.applyFilters();
                    }
                    this.showSuccessSnackbar(
                        `✅ User Approved Successfully`,
                        `${user.firstName} ${user.lastName} has been approved and can now access the system`
                    );
                },
                error: (err) => {
                    console.error('Error approving user:', err);
                    this.showErrorSnackbar(
                        'Failed to Approve User',
                        err?.error?.message || 'An unexpected error occurred. Please try again.'
                    );
                }
            });
        }
    });
  }

  rejectUser(userId: string): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      this.showErrorSnackbar('User not found');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Reject User Registration',
        message: `Are you sure you want to reject ${user.firstName} ${user.lastName}'s registration? This action cannot be undone and the user will be permanently removed from the system.`,
        confirmText: 'Yes, Reject',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.rejectUser(userId).subscribe({
          next: () => {
            this.users = this.users.filter(user => user.id !== userId);
            this.applyFilters();
            this.showSuccessSnackbar(
              `❌ User Rejected`,
              `${user.firstName} ${user.lastName}'s registration has been rejected and removed from the system`
            );
          },
          error: (err) => {
            console.error('Error rejecting user:', err);
            this.showErrorSnackbar(
              'Failed to Reject User',
              err?.error?.message || 'An unexpected error occurred. Please try again.'
            );
          }
        });
      }
    });
  }

  toggleUserStatus(user: User): void {
    const action = user.enabled ? 'disable' : 'enable';
    const actionPast = user.enabled ? 'disabled' : 'enabled';
    const actionDescription = user.enabled 
      ? 'This will prevent the user from accessing the system'
      : 'This will allow the user to access the system again';

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
            title: `${action.charAt(0).toUpperCase() + action.slice(1)} User Account`,
            message: `Are you sure you want to ${action} ${user.firstName} ${user.lastName}'s account? ${actionDescription}.`,
            confirmText: `Yes, ${action.charAt(0).toUpperCase() + action.slice(1)}`,
            cancelText: 'Cancel'
        }
    });

    dialogRef.afterClosed().subscribe(result => {
        if (result) {
            const serviceCall = user.enabled 
                ? this.userService.disableUser(user.id!) 
                : this.userService.enableUser(user.id!);

            serviceCall.subscribe({
                next: (updatedUser) => {
                    const index = this.users.findIndex(u => u.id === user.id);
                    if (index !== -1) {
                        // Preserve the original user type and other data
                        this.users[index] = {
                            ...this.users[index],   // Keep original data
                            ...updatedUser,         // Apply updates
                            userType: this.users[index].userType // Explicitly preserve userType
                        };
                        this.applyFilters();
                    }
                    
                    const statusIcon = user.enabled ? '🔒' : '🔓';
                    this.showSuccessSnackbar(
                        `${statusIcon} User Account ${actionPast.charAt(0).toUpperCase() + actionPast.slice(1)}`,
                        `${user.firstName} ${user.lastName}'s account has been ${actionPast} successfully`
                    );
                },
                error: (err) => {
                    console.error('Error toggling user status:', err);
                    this.showErrorSnackbar(
                        `Failed to ${action.charAt(0).toUpperCase() + action.slice(1)} User`,
                        err?.error?.message || 'An unexpected error occurred. Please try again.'
                    );
                }
            });
        }
    });
  }

  getUserTypeDisplay(userType: string | undefined): string {
    console.log('User type received:', userType);
    
    if (!userType) {
      console.warn('User type is undefined or null');
      return 'Unknown';
    }
    
    // Ensure we're working with lowercase for comparison
    const normalizedType = userType.toLowerCase();
    
    switch(normalizedType) {
      case USER_TYPES.INDIVIDUAL:
      case 'individual':
        return 'Individual';
      case USER_TYPES.ENTERPRISE:
      case 'enterprise':
        return 'Enterprise';
      case USER_TYPES.TEMPORARY:
      case 'temporary':
        return 'Temporary Driver';
      case USER_TYPES.PROFESSIONAL:
      case 'professional':
        return 'Professional Driver';
      case USER_TYPES.ADMIN:
      case 'admin':
        return 'Admin';
      default: 
        console.warn('Unknown user type:', userType);
        return userType; // Return the raw value if not recognized
    }
  }

  getUserStatus(user: User): string {
    if (user.rejected) return 'rejected';
    if (!user.approved && !user.enabled) return 'pending';
    if (user.approved && !user.enabled) return 'disabled';
    if (user.approved && user.enabled) return 'active';
    return 'unknown';
  }

  getStatusTooltip(user: User): string {
    const status = this.getUserStatus(user);
    switch(status) {
      case 'pending':
        return 'User registration is pending admin approval';
      case 'active':
        return 'User is active and can access the system';
      case 'disabled':
        return 'User account has been disabled by an admin';
      case 'rejected':
        return 'User registration has been rejected and removed';
      default:
        return 'User status is unknown';
    }
  }

  navigateToDetails(id: string) {
    if (!id) {
      console.error('No user ID provided for navigation');
      this.showErrorSnackbar('Cannot view user details', 'User ID is missing');
      return;
    }
    
    console.log('Navigating to user details with ID:', id);
    this.router.navigate(['/admin/users/view', id]).then(success => {
      if (!success) {
        console.error('Navigation failed');
        this.showErrorSnackbar('Navigation Failed', 'Unable to navigate to user details page');
      }
    }).catch(err => {
      console.error('Navigation error:', err);
      this.showErrorSnackbar('Navigation Error', 'An error occurred while navigating to user details');
    });
  }

  getStatusColor(status: string): string {
    switch(status) {
      case USER_STATUS.ACTIVE: return 'primary';
      case USER_STATUS.PENDING: return 'accent';
      case USER_STATUS.DISABLED: return 'warn';
      default: return '';
    }
  }

  // Enhanced notification methods
  private showSuccessSnackbar(title: string, message?: string): void {
    const displayMessage = message ? `${title}\n${message}` : title;
    this.snackBar.open(displayMessage, '✓ Close', {
      duration: 6000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });
  }

  private showErrorSnackbar(title: string, message?: string): void {
    const displayMessage = message ? `${title}\n${message}` : title;
    this.snackBar.open(displayMessage, '✗ Close', {
      duration: 8000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }

  // Legacy method for backward compatibility
  private showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
}