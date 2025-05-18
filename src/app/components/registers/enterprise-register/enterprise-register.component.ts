import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { BUSINESS_TYPES, User } from '../../../models/user.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-enterprise-register',
  templateUrl: './enterprise-register.component.html',
  styleUrls: ['./enterprise-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ]
})
export class EnterpriseRegisterComponent implements OnInit {
  enterpriseForm: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  businessTypes = BUSINESS_TYPES;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.enterpriseForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      companyName: ['', Validators.required],
      businessType: ['', Validators.required],
      vatNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}?[0-9]+$/)]],
      businessPhone: ['', Validators.required],
      businessAddress: ['', Validators.required],
      deliveryRadius: [5, [Validators.required, Validators.min(1)]],
      termsAccepted: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {}

  get f() { return this.enterpriseForm.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    
    if (this.enterpriseForm.invalid) {
      console.error('Form invalid:', this.enterpriseForm.errors);
      return;
    }
    
    this.loading = true;
    
    const formValue = this.enterpriseForm.value;
    const userData: User = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password, // Ensure password is included
      phone: formValue.phone,
      address: formValue.address,
      companyName: formValue.companyName,
      businessType: formValue.businessType,
      vatNumber: formValue.vatNumber,
      businessPhone: formValue.businessPhone,
      businessAddress: formValue.businessAddress,
      deliveryRadius: formValue.deliveryRadius,
      id: ''
    };
    
    console.log('Submitting registration:', userData); // Debug log
    
    this.authService.register(userData, 'enterprise').subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/login'], { 
          state: { 
            registrationSuccess: true,
            message: 'Votre compte entreprise a été créé avec succès!'
          },
          queryParams: { registered: 'enterprise' }
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Échec de l\'inscription. Veuillez réessayer.';
        console.error('Registration error:', err);
      }
    });
  }
}