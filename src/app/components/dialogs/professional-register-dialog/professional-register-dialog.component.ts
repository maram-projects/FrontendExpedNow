import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog'; // Add this import
import { MatCheckboxModule } from '@angular/material/checkbox'; // Add this for the checkbox

@Component({
  selector: 'app-professional-register-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatIconModule,
    MatDialogModule, // Add this
    MatCheckboxModule // Add this
  ],
  templateUrl: './professional-register-dialog.component.html',
  styleUrls: ['./professional-register-dialog.component.css']
})
export class ProfessionalRegisterDialogComponent {
  professionalForm: FormGroup;
  showPassword = false;
  vehicleTypes: any[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ProfessionalRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.vehicleTypes = data.vehicleTypes || [];
    
    this.professionalForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],

      phone: ['', Validators.required],
      address: ['', Validators.required],
      vehicleType: ['', Validators.required],
      vehicleBrand: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehiclePlateNumber: ['', Validators.required],
      driverLicenseNumber: ['', Validators.required],
      driverLicenseCategory: ['', Validators.required],
      termsAccepted: [false, Validators.requiredTrue]
    });
  }
  checkPasswords(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { notSame: true };
  }
  onSubmit() {
    if (this.professionalForm.invalid) {
      if (this.professionalForm.hasError('notSame')) {
        alert('Passwords do not match');
      }
      return;
    }
  
    if (this.professionalForm.valid) {
      this.dialogRef.close(this.professionalForm.value);
    }
  }
  onCancel() {
    this.dialogRef.close();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}