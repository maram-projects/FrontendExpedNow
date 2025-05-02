// components/individual-register/individual-register.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-individual-register',
  templateUrl: './individual-register.component.html',
  styleUrls: ['./individual-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ]
})
export class IndividualRegisterComponent implements OnInit {
  individualForm: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.individualForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,15}$/)]],
      address: ['', [Validators.required]],
      termsAccepted: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {}

  get f() { return this.individualForm.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    
    if (this.individualForm.invalid) {
      return;
    }
    
    this.loading = true;
    
    const userData: User = {
      firstName: this.individualForm.value.firstName,
      lastName: this.individualForm.value.lastName,
      email: this.individualForm.value.email,
      password: this.individualForm.value.password,
      phone: this.individualForm.value.phone,
      address: this.individualForm.value.address
    };
    
    this.authService.register(userData, 'individual').subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/login'], { 
          state: {
            registrationSuccess: true,
            message: 'Votre compte client particulier a été créé avec succès!'
          },
          queryParams: { registered: 'individual' }
        });
      },
      error: (err: { error: { message: string; }; }) => {
        this.loading = false;
        this.error = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }
}