import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Vehicle, VehicleStatistics } from '../../../models/Vehicle.model';
import { VehicleService } from '../../../services/vehicle-service.service';
import { VehiclePhotoPipe } from "../../../shared/pipes/vehicle-photo.pipe";

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
imports: [CommonModule, RouterModule],
  templateUrl: './vehicle-list.component.html',
  styleUrls: ['./vehicle-list.component.css']
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  vehicleStats: Map<string, VehicleStatistics> = new Map();
  loading = true;
  error: string | null = null;

  constructor(private vehicleService: VehicleService) { }

  ngOnInit(): void {
    this.loadVehicles();
  }

  loadVehicles(): void {
    this.loading = true;
    this.error = null;
    
    this.vehicleService.getAllVehicles().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.loading = false;
        
        // Load statistics for each vehicle
        this.loadVehicleStats();
      },
      error: (err) => {
        console.error('Error loading vehicles:', err);
        this.error = 'Failed to load vehicles. Please try again later.';
        this.loading = false;
      }
    });
  }

  loadVehicleStats(): void {
    this.vehicles.forEach(vehicle => {
      if (vehicle.id) {
        this.vehicleService.getVehicleStats(vehicle.id).subscribe(stats => {
          this.vehicleStats.set(vehicle.id!, stats);
        });
      }
    });
  }

  getVehicleStatusClass(available: boolean): string {
    return available ? 'status-available' : 'status-unavailable';
  }

  getVehicleStatusText(available: boolean): string {
    return available ? 'Available' : 'In Use';
  }

  deleteVehicle(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (confirm('Are you sure you want to delete this vehicle?')) {
      this.vehicleService.deleteVehicle(id).subscribe({
        next: () => {
          this.vehicles = this.vehicles.filter(v => v.id !== id);
          this.vehicleStats.delete(id);
        },
        error: (err) => {
          console.error('Error deleting vehicle:', err);
          alert('Failed to delete vehicle. Please try again later.');
        }
      });
    }
  }

  getLastUsedText(vehicleId: string): string {
    const stats = this.vehicleStats.get(vehicleId);
    if (!stats || !stats.lastUsed) {
      return 'Never';
    }
    
    const lastUsed = new Date(stats.lastUsed);
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

  refreshVehicles(): void {
    this.vehicleService.clearCache();
    this.loadVehicles();
  }

  getVehiclePhotoUrl(photoPath: string | undefined): string {
    if (!photoPath) return '/assets/images/no-vehicle-photo.png';
    
    // Check if already a full URL
    if (photoPath.startsWith('http')) return photoPath;
    
    // Construct URL for locally stored photos
    return `http://localhost:8080/uploads/vehicle-photos/${photoPath}`;
}
}