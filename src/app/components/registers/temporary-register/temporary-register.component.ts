import { Component, OnInit } from '@angular/core';
import { 
  FormBuilder, 
  FormGroup, 
  Validators, 
  ReactiveFormsModule,
  FormsModule 
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { User, VEHICLE_TYPES } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-temporary-register',
  templateUrl: './temporary-register.component.html',
  styleUrls: ['./temporary-register.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink
  ]
})
export class TemporaryRegisterComponent implements OnInit {
  temporaryForm: FormGroup;
  submitted = false;
  error: string = '';
  loading: boolean = false;
  showPassword: boolean = false;
  vehicleTypes = VEHICLE_TYPES;
  currentYear: number;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.currentYear = new Date().getFullYear();
    this.temporaryForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      vehicleType: ['', Validators.required],
      vehicleBrand: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehiclePlateNumber: ['', Validators.required],
      vehicleColor: ['', Validators.required],
      vehicleYear: [null, [Validators.required, Validators.min(1900), Validators.max(this.currentYear)]],
      vehicleCapacityKg: [0, [Validators.required, Validators.min(0)]],
      vehicleVolumeM3: [0, [Validators.required, Validators.min(0)]],
      vehicleHasFridge: [false],
      driverLicenseNumber: ['', Validators.required],
      driverLicenseCategory: ['', Validators.required],
      preferredZones: [''],
      termsAccepted: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {}

  get f() { return this.temporaryForm.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    
    if (this.temporaryForm.invalid) {
      return;
    }
    
    this.loading = true;
    
    const formValue = this.temporaryForm.value;
    const userData: User = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password,
      phone: formValue.phone,
      address: formValue.address,
      vehicleType: formValue.vehicleType,
      vehicleBrand: formValue.vehicleBrand,
      vehicleModel: formValue.vehicleModel,
      vehiclePlateNumber: formValue.vehiclePlateNumber,
      vehicleColor: formValue.vehicleColor,
      vehicleYear: formValue.vehicleYear,
      vehicleCapacityKg: formValue.vehicleCapacityKg,
      vehicleVolumeM3: formValue.vehicleVolumeM3,
      vehicleHasFridge: formValue.vehicleHasFridge,
      driverLicenseNumber: formValue.driverLicenseNumber,
      driverLicenseCategory: formValue.driverLicenseCategory,
      preferredZones: formValue.preferredZones,
      id: ''
    };
    
    this.authService.register(userData, 'temporary').subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/login'], { 
          state: {
            registrationSuccess: true,
            message: 'Votre compte livreur temporaire a été créé! Un administrateur validera votre compte sous 24h.'
          },
          queryParams: { registered: 'temporary' }
        });
      },
      error: (err: { error: { message: string; }; }) => {
        this.loading = false;
        this.error = err.error?.message || 'Échec de l\'inscription. Veuillez réessayer.';
      }
    });
  }
}