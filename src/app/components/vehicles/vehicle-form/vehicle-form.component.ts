import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Vehicle, VehicleType } from '../../../models/Vehicle.model';
import { VehicleService } from '../../../services/vehicle-service.service';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './vehicle-form.component.html',
  styleUrls: ['./vehicle-form.component.css']
})
export class VehicleFormComponent implements OnInit {

     photoFile: File | null = null;
    photoPreview: string | ArrayBuffer | null = null;
  vehicleForm!: FormGroup;
  vehicleTypes = Object.values(VehicleType);
  isEditMode = false;
  vehicleId?: string;
  
  isSubmitting = false; // Add this flag to prevent duplicate submissions
  
  constructor(
    private fb: FormBuilder,
    private vehicleService: VehicleService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.initForm();
    
    // Check if we're in edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.vehicleId = params['id'];
        
        // Ensure vehicleId is defined before calling loadVehicleData
        if (this.vehicleId) {
          this.loadVehicleData(this.vehicleId);
        }
      }
    });
  }

  initForm(): void {
    this.vehicleForm = this.fb.group({
      make: ['', [Validators.required]],
      model: ['', [Validators.required]],
      year: [null, [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
      licensePlate: ['', [Validators.required]],
      vehicleType: [VehicleType.CAR, [Validators.required]],
      maxLoad: [null, [Validators.required, Validators.min(0)]]
    });
  }

  loadVehicleData(id: string): void {
    this.vehicleService.getVehicleById(id).subscribe({
      next: (vehicle) => {
        // Update form values
        this.vehicleForm.patchValue({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          licensePlate: vehicle.licensePlate,
          vehicleType: vehicle.vehicleType,
          maxLoad: vehicle.maxLoad
        });
        
        // Set photo preview if exists
        if (vehicle.photoPath) {
          // Check if path is a full URL or just a filename
          if (vehicle.photoPath.startsWith('http')) {
            this.photoPreview = vehicle.photoPath;
          } else {
            this.photoPreview = `http://localhost:8080/uploads/vehicle-photos/${vehicle.photoPath}`;
          }
        }
      },
      error: (err) => {
        console.error('Error loading vehicle:', err);
        // Show error notification to user
      }
    });
  }

   onFileChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        
        if (input.files && input.files.length) {
            this.photoFile = input.files[0];
            
            // Create preview
            const reader = new FileReader();
            reader.onload = () => {
                this.photoPreview = reader.result;
            };
            reader.readAsDataURL(this.photoFile);
        }
    }


  onSubmit(): void {
    if (this.vehicleForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.vehicleForm.controls).forEach(key => {
        const control = this.vehicleForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    // Prevent duplicate submissions
    if (this.isSubmitting) {
      console.log('Form submission already in progress');
      return;
    }
    
    this.isSubmitting = true;
    
    // Create vehicle object from form values
    const vehicleData: Vehicle = {
      ...this.vehicleForm.value,
      available: true // Default to available
    };
    
    if (this.isEditMode && this.vehicleId) {
      vehicleData.id = this.vehicleId;
      this.vehicleService.updateVehicle(this.vehicleId, vehicleData, this.photoFile)
        .subscribe({
          next: () => {
            // Navigate back to vehicle list
            this.router.navigate(['/admin/vehicles']);
          },
          error: (err) => {
            console.error('Error updating vehicle:', err);
            // Show error notification to user
            this.isSubmitting = false; // Reset submission flag on error
          },
          complete: () => {
            this.isSubmitting = false; // Reset submission flag on completion
          }
        });
    } else {
      this.vehicleService.createVehicle(vehicleData, this.photoFile)
        .subscribe({
          next: () => {
            // Navigate back to vehicle list
            this.router.navigate(['/admin/vehicles']);
          },
          error: (err) => {
            console.error('Error creating vehicle:', err);
            // Show error notification to user
            this.isSubmitting = false; // Reset submission flag on error
          },
          complete: () => {
            this.isSubmitting = false; // Reset submission flag on completion
          }
        });
    }
  }

  removePhoto(): void {
    this.photoFile = null;
    this.photoPreview = null;
  }
}