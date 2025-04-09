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
  vehicleForm!: FormGroup;
  vehicleTypes = Object.values(VehicleType);
  isEditMode = false;
  vehicleId?: string;
  photoFile: File | null = null;
  photoPreview: string | ArrayBuffer | null = null;
  
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
      maxLoad: [null, [Validators.required, Validators.min(0)]] // Add maxLoad field with validation
    });
  }

  loadVehicleData(id: string): void {
    this.vehicleService.getVehicleById(id).subscribe(vehicle => {
      this.vehicleForm.patchValue(vehicle);
      if (vehicle.photoPath) {
        this.photoPreview = `http://localhost:8080/uploads/vehicle-photos/${vehicle.photoPath}`;
      }
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files.length) {
      this.photoFile = input.files[0];
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview = reader.result;
      };
      reader.readAsDataURL(this.photoFile);
    }
  }

  onSubmit(): void {
    if (this.vehicleForm.invalid) {
      return;
    }
    
    const vehicleData: Vehicle = this.vehicleForm.value;
    
    if (this.isEditMode && this.vehicleId) {
      this.vehicleService.updateVehicle(this.vehicleId, vehicleData, this.photoFile)
        .subscribe(() => {
          this.router.navigate(['/vehicles']);
        });
    } else {
      this.vehicleService.createVehicle(vehicleData, this.photoFile)
        .subscribe(() => {
          this.router.navigate(['/vehicles']);
        });
    }
  }

  removePhoto(): void {
    this.photoFile = null;
    this.photoPreview = null;
  }
}