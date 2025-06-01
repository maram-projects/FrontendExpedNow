import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { User, USER_TYPES } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatChipsModule
    ],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.css']
})
export class UserDetailsComponent implements OnInit {
  readonly USER_TYPES = USER_TYPES;

  user: User | null = null;
  loading = true;
  error = '';
  activeTab = 'profile';

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.loadUser(userId);
    } else {
      this.error = 'No user ID provided';
      this.loading = false;
    }
  }

  loadUser(userId: string): void {
    this.loading = true;
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        this.user = user;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load user details';
        this.loading = false;
        this.showSnackbar(this.error);
      }
    });
  }

  toggleUserStatus(): void {
    if (!this.user) return;

    const action = this.user.enabled ? 'disable' : 'enable';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
        message: `Are you sure you want to ${action} this user?`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.user) {
        const serviceCall = this.user.enabled 
          ? this.userService.disableUser(this.user.id!) 
          : this.userService.enableUser(this.user.id!);

        serviceCall.subscribe({
          next: (updatedUser) => {
            this.user = updatedUser;
            this.showSnackbar(`User ${action}d successfully`);
          },
          error: (err) => {
            this.showSnackbar(`Failed to ${action} user. Please try again.`);
          }
        });
      }
    });
  }

  approveUser(): void {
    if (!this.user) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Approve User',
        message: 'Are you sure you want to approve this user?',
        confirmText: 'Approve',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.user) {
        this.userService.approveUser(this.user.id!).subscribe({
          next: (updatedUser) => {
            this.user = updatedUser;
            this.showSnackbar('User approved successfully');
          },
          error: (err) => {
            this.showSnackbar('Failed to approve user. Please try again.');
          }
        });
      }
    });
  }

  rejectUser(): void {
    if (!this.user) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Reject User',
        message: 'Are you sure you want to reject this user? This action cannot be undone.',
        confirmText: 'Reject',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.user) {
        this.userService.rejectUser(this.user.id!).subscribe({
          next: () => {
            this.showSnackbar('User rejected successfully');
            // Navigate back to user list or handle as needed
          },
          error: (err) => {
            this.showSnackbar('Failed to reject user. Please try again.');
          }
        });
      }
    });
  }

  getUserStatus(): string {
    if (!this.user) return 'unknown';
    if (this.user.rejected) return 'rejected';
    if (!this.user.approved && !this.user.enabled) return 'pending';
    if (this.user.approved && !this.user.enabled) return 'disabled';
    if (this.user.approved && this.user.enabled) return 'active';
    return 'unknown';
  }

  getUserTypeDisplay(): string {
    if (!this.user || !this.user.userType) return 'Unknown';
    
    switch(this.user.userType) {
      case USER_TYPES.INDIVIDUAL: return 'Individual';
      case USER_TYPES.ENTERPRISE: return 'Enterprise';
      case USER_TYPES.TEMPORARY: return 'Temporary Driver';
      case USER_TYPES.PROFESSIONAL: return 'Professional Driver';
      case USER_TYPES.ADMIN: return 'Admin';
      default: return this.user.userType;
    }
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
  }

  getUserStatusColor(): string {
    switch(this.getUserStatus()) {
      case 'active': return 'primary';
      case 'pending': return 'accent';
      case 'disabled': return 'warn';
      case 'rejected': return 'warn';
      default: return '';
    }
  }
}