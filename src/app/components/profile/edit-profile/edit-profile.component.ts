import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit {
  editProfileForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {
    this.editProfileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: ['']
    });
  }

  ngOnInit(): void {
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
  }

  onSubmit(): void {
    if (this.editProfileForm.valid) {
      const updatedUser = {
        firstName: this.editProfileForm.get('firstName')?.value,
        lastName: this.editProfileForm.get('lastName')?.value,
        email: this.editProfileForm.get('email')?.value,
        phone: this.editProfileForm.get('phone')?.value,
        address: this.editProfileForm.get('address')?.value
      };
  
      this.userService.updateProfile(updatedUser.email).subscribe({
        next: (response) => {
          console.log('Profile updated successfully:', response);
          this.router.navigate(['/profile']);
        },
        error: (err) => {
          console.error('Error updating profile:', err);
        }
      });
    }
  }
}