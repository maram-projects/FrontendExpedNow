// vehicle-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Vehicle, VehicleStatistics } from '../../../models/Vehicle.model';
import { VehicleService } from '../../../services/vehicle-service.service';
import { VehiclePhotoPipe } from "../../../shared/pipes/vehicle-photo.pipe";

@Component({
  selector: 'app-vehicle-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, VehiclePhotoPipe],
  templateUrl: './vehicle-detail.component.html',
  styleUrls: ['./vehicle-detail.component.css']
})
export class VehicleDetailComponent implements OnInit {
  vehicle: Vehicle | null = null;
  vehicleStats: VehicleStatistics | null = null;
  loading = true;
  error: string | null = null;
  
  constructor(
    private vehicleService: VehicleService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadVehicleData(id);
      } else {
        this.error = 'No vehicle ID provided';
        this.loading = false;
      }
    });
  }

  loadVehicleData(id: string): void {
    this.loading = true;
    this.error = null;
    
    this.vehicleService.getVehicleById(id).subscribe({
      next: (vehicle) => {
        this.vehicle = vehicle;
        this.loadVehicleStats(id);
      },
      error: (err) => {
        console.error('Error loading vehicle:', err);
        this.error = 'Failed to load vehicle details. Please try again later.';
        this.loading = false;
      }
    });
  }

  loadVehicleStats(id: string): void {
    this.vehicleService.getVehicleStats(id).subscribe({
      next: (stats) => {
        this.vehicleStats = stats;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading vehicle statistics:', err);
        // Don't set an error, just log it - we still have the vehicle data
        this.loading = false;
      }
    });
  }

  getVehicleStatusClass(): string {
    return this.vehicle?.available ? 'status-available' : 'status-unavailable';
  }

  getVehicleStatusText(): string {
    return this.vehicle?.available ? 'Available' : 'In Use';
  }

  getLastUsedText(): string {
    if (!this.vehicleStats || !this.vehicleStats.lastUsed) {
      return 'Never';
    }
    
    const lastUsed = new Date(this.vehicleStats.lastUsed);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastUsed.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return `${diffDays} days ago`;
    }
  }

  deleteVehicle(): void {
    if (!this.vehicle?.id) return;
    
    if (confirm('Are you sure you want to delete this vehicle?')) {
      this.vehicleService.deleteVehicle(this.vehicle.id).subscribe({
        next: () => {
          this.router.navigate(['/admin/vehicles']);
        },
        error: (err) => {
          console.error('Error deleting vehicle:', err);
          alert('Failed to delete vehicle. Please try again later.');
        }
      });
    }
  }
}