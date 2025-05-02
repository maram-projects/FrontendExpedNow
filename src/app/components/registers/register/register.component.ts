// components/register/register.component.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { User, USER_TYPES, VEHICLE_TYPES } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ]
})
export class RegisterComponent {
  registerForm: FormGroup;
  error: string = '';
  loading: boolean = false;
  userTypes = [USER_TYPES.INDIVIDUAL, USER_TYPES.ENTERPRISE, USER_TYPES.TEMPORARY];
  vehicleTypes = VEHICLE_TYPES;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required]],
      userType: ['individual', [Validators.required]],
      vehicleType: ['']
    });

    this.registerForm.get('userType')?.valueChanges.subscribe(userType => {
      const vehicleTypeControl = this.registerForm.get('vehicleType');
      
      if (userType === USER_TYPES.TEMPORARY) {
        vehicleTypeControl?.setValidators([Validators.required]);
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
        vehicleType: formData.vehicleType || null
      };
      
      this.authService.register(userData, userType).subscribe({
        next: () => {
          this.handleRegistrationSuccess(userType);
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

  private handleRegistrationSuccess(userType: string): void {
    this.loading = false;
    
    const messages = {
      [USER_TYPES.INDIVIDUAL]: 'Votre compte client particulier a été créé avec succès!',
      [USER_TYPES.ENTERPRISE]: 'Votre compte entreprise a été créé avec succès!',
      [USER_TYPES.TEMPORARY]: 'Votre compte livreur temporaire a été créé! Un administrateur validera votre compte sous 24h.'
    };

    this.router.navigate(['/login'], { 
      state: {
        registrationSuccess: true,
        message: messages[userType as keyof typeof messages] || 'Inscription réussie!'
      },
      queryParams: { registered: userType }
    });
  }
}