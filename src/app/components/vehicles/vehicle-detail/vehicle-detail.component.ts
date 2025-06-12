// vehicle-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Vehicle, VehicleStatistics } from '../../../models/Vehicle.model';
import { VehicleService } from '../../../services/vehicle-service.service';
import { UserService } from '../../../services/user.service'; // Add this import
import { VehiclePhotoPipe } from "../../../shared/pipes/vehicle-photo.pipe";
import { User } from '../../../models/user.model';

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
  assignedUser: User | null = null; // Add this property
  loading = true;
  error: string | null = null;
  
  // Add these properties to track the context
  fromUserManagement = false;
  userId: string | null = null;

  constructor(
    private vehicleService: VehicleService,
    private userService: UserService, // Add this service
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const vehicleId = params['id'];
      
      // Check query parameters for user context
      this.route.queryParams.subscribe(queryParams => {
        this.userId = queryParams['userId'];
        this.fromUserManagement = queryParams['from'] === 'user-management';
        
        if (vehicleId) {
          this.loadVehicleData(vehicleId);
          
          // If coming from user management, load user data too
          if (this.userId) {
            this.loadUserData(this.userId);
          }
        } else {
          this.error = 'No vehicle ID provided';
          this.loading = false;
        }
      });
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
        this.loading = false;
      }
    });
  }

  // Add this method to load user data
  loadUserData(userId: string): void {
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        this.assignedUser = user;
      },
      error: (err) => {
        console.error('Error loading user data:', err);
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

  // Add method to check if user is professional
  isProfessional(user: User): boolean {
    return user.roles?.some(role => role === 'PROFESSIONAL') || false;
  }

  // Update back navigation based on context
  goBack(): void {
    if (this.fromUserManagement) {
      this.router.navigate(['/admin/delivery-management']);
    } else {
      this.router.navigate(['/admin/vehicles']);
    }
  }

  deleteVehicle(): void {
    if (!this.vehicle?.id) return;
    
    if (confirm('Are you sure you want to delete this vehicle?')) {
      this.vehicleService.deleteVehicle(this.vehicle.id).subscribe({
        next: () => {
          this.goBack();
        },
        error: (err) => {
          console.error('Error deleting vehicle:', err);
          alert('Failed to delete vehicle. Please try again later.');
        }
      });
    }
  }
}