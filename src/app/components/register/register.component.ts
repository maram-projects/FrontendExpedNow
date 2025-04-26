import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  error: string = '';
  loading: boolean = false;

  userTypes = ['individual', 'enterprise', 'temporary'];
  
  // Updated to match Java enum values
  vehicleTypes = [
    { value: 'MOTORCYCLE', display: 'Moto' },
    { value: 'CAR', display: 'Voiture' },
    { value: 'TRUCK', display: 'Camion' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.formBuilder.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required]],
      userType: ['individual', [Validators.required]],
      authorizedVehicleType: [''] // optional
    });
  }

  ngOnInit(): void {
    // Removed 'professional' from public registration options
    // Only admins can add professional users through admin panel
    
    // Update vehicleType validation based on user type selection
    this.registerForm.get('userType')?.valueChanges.subscribe(userType => {
      const vehicleTypeControl = this.registerForm.get('authorizedVehicleType');
      
      if (userType === 'temporary') {
        vehicleTypeControl?.setValidators([Validators.required]);
        // Set default value for temporary delivery persons
        vehicleTypeControl?.setValue('MOTORCYCLE');
      } else {
        vehicleTypeControl?.clearValidators();
        vehicleTypeControl?.setValue(null);
      }
      
      vehicleTypeControl?.updateValueAndValidity();
    });
  }

  onSubmit(): void {
    this.error = '';
    this.loading = true;
  
    if (this.registerForm.valid) {
      const formData = this.registerForm.value;
      const userType = formData.userType;
  
      // Extra safety check to prevent professional delivery registration
      if (userType === 'professional') {
        this.loading = false;
        this.error = 'Seul l\'administrateur peut ajouter un livreur professionnel.';
        return;
      }
  
      const userData: User = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        vehicleType: formData.authorizedVehicleType || null, // This will now be one of the enum values
      };
  
      this.authService.register(userData, userType).subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || 'Registration failed. Please try again.';
        },
      });
    } else {
      this.loading = false;
      this.error = 'Please fill all required fields correctly.';
    }
  }
}