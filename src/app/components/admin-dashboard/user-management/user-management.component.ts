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
import { RouterModule } from '@angular/router';
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
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
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
        this.users = users;
        this.applyFilters();
        this.totalUsers = this.filteredUsers.length;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load users. Please try again.';
        this.loading = false;
        this.showSnackbar(this.error);
      }
    });
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const statusMatch = !this.filterStatus || this.getUserStatus(user) === this.filterStatus;
      const typeMatch = !this.filterType || user.userType === this.filterType;
      return statusMatch && typeMatch;
    });
    
    // Update pagination
    this.totalUsers = this.filteredUsers.length;
    this.pageIndex = 0;
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
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Approve User',
        message: 'Are you sure you want to approve this user?',
        confirmText: 'Approve',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.approveUser(userId).subscribe({
          next: () => {
            this.updateUserStatus(userId, true);
            this.showSnackbar('User approved successfully');
          },
          error: (err) => {
            this.showSnackbar('Failed to approve user. Please try again.');
          }
        });
      }
    });
  }

  rejectUser(userId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Reject User',
        message: 'Are you sure you want to reject this user? This action cannot be undone.',
        confirmText: 'Reject',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.rejectUser(userId).subscribe({
          next: () => {
            this.users = this.users.filter(user => user.id !== userId);
            this.applyFilters();
            this.showSnackbar('User rejected successfully');
          },
          error: (err) => {
            this.showSnackbar('Failed to reject user. Please try again.');
          }
        });
      }
    });
  }

  toggleUserStatus(user: User): void {
    const action = user.enabled ? 'disable' : 'enable';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
        message: `Are you sure you want to ${action} this user?`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
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
            this.updateUserStatus(user.id!, !user.enabled);
            this.showSnackbar(`User ${action}d successfully`);
          },
          error: (err) => {
            this.showSnackbar(`Failed to ${action} user. Please try again.`);
          }
        });
      }
    });
  }

  private updateUserStatus(userId: string, enabled: boolean): void {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.enabled = enabled;
      user.approved = enabled; // Assuming approval when enabling
      this.applyFilters();
    }
  }

  getUserTypeDisplay(userType: string | undefined): string {
    if (!userType) return 'Unknown';
    switch(userType.toLowerCase()) {
      case USER_TYPES.INDIVIDUAL: return 'Individual';
      case USER_TYPES.ENTERPRISE: return 'Enterprise';
      case USER_TYPES.TEMPORARY: return 'Temporary Driver';
      case USER_TYPES.PROFESSIONAL: return 'Professional Driver';
      case USER_TYPES.ADMIN: return 'Admin';
      default: return userType;
    }
  }

  getUserStatus(user: User): string {
    if (!user.approved) return USER_STATUS.PENDING;
    if (!user.enabled) return USER_STATUS.DISABLED;
    return USER_STATUS.ACTIVE;
  }

  getStatusColor(status: string): string {
    switch(status) {
      case USER_STATUS.ACTIVE: return 'primary';
      case USER_STATUS.PENDING: return 'accent';
      case USER_STATUS.DISABLED: return 'warn';
      default: return '';
    }
  }

  private showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
}