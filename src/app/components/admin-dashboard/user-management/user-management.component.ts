import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin-service.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  loading = true;
  error = '';

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load users';
        this.loading = false;
      }
    });
  }

  blockUser(userId: string): void {
    if (confirm('Are you sure you want to block this user?')) {
      this.adminService.updateUserStatus(userId, 'BLOCKED').subscribe({
        next: () => {
          alert('User blocked successfully!');
          this.loadUsers(); // Refresh the user list
        },
        error: (err) => {
          console.error('Error blocking user:', err);
          alert('Failed to block user. Please try again.');
        }
      });
    }
  }
}