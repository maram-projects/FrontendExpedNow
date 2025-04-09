import { Component, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { VehicleService, VehicleStatistics } from '../../../services/vehicle-service.service';
import { Vehicle, VehicleType } from '../../../models/Vehicle.model';
import { trigger, transition, style, animate, state } from '@angular/animations';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TitleCasePipe],
  templateUrl: './vehicle-list.component.html',
  styleUrls: ['./vehicle-list.component.css'],
  animations: [
    trigger('cardAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.3s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('statAnimation', [
      state('inactive', style({
        height: '0',
        opacity: 0,
        overflow: 'hidden'
      })),
      state('active', style({
        height: '*',
        opacity: 1
      })),
      transition('inactive => active', animate('300ms ease-in')),
      transition('active => inactive', animate('300ms ease-out'))
    ])
  ]
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  availableVehicles: Vehicle[] = [];
  loading = true;
  showAvailable = false;
  vehicleStats = new Map<string, VehicleStatistics>();
  expandedVehicleId: string | null = null;
  
  // Determine if user is admin (in a real app, this would come from auth service)
  isAdmin = true; // For demo purposes

  constructor(private vehicleService: VehicleService, private router: Router) { }

  ngOnInit(): void {
    this.loadVehicles();
    
    // Subscribe to vehicle stats
    this.vehicleService.vehicleStats$.subscribe(stats => {
      this.vehicleStats = stats;
    });
  }

  loadVehicles(): void {
    this.loading = true;
    this.vehicleService.getAllVehicles().subscribe({
      next: (data) => {
        this.vehicles = data;
        this.loading = false;
        
        // Load stats for each vehicle
        this.vehicles.forEach(vehicle => {
          if (vehicle.id) {
            this.vehicleService.getVehicleStats(vehicle.id).subscribe();
          }
        });
      },
      error: (error) => {
        console.error('Error loading vehicles:', error);
        this.loading = false;
      }
    });
  }

  loadAvailableVehicles(): void {
    this.loading = true;
    this.vehicleService.getAvailableVehicles().subscribe({
      next: (vehicles) => {
        this.availableVehicles = vehicles;
        this.loading = false;
        
        // Load stats for each available vehicle
        this.availableVehicles.forEach(vehicle => {
          if (vehicle.id) {
            this.vehicleService.getVehicleStats(vehicle.id).subscribe();
          }
        });
      },
      error: (error) => {
        console.error('Error loading available vehicles:', error);
        this.loading = false;
      }
    });
  }

  deleteVehicle(id: string): void {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      this.vehicleService.deleteVehicle(id).subscribe({
        next: () => {
          this.vehicles = this.vehicles.filter(vehicle => vehicle.id !== id);
          this.availableVehicles = this.availableVehicles.filter(vehicle => vehicle.id !== id);
        },
        error: (error) => {
          console.error('Error deleting vehicle:', error);
        }
      });
    }
  }

  getVehicleIcon(type: VehicleType): string {
    switch (type) {
      case VehicleType.CAR: return 'fas fa-car';
      case VehicleType.TRUCK: return 'fas fa-truck';
      case VehicleType.MOTORCYCLE: return 'fas fa-motorcycle';
      default: return 'fas fa-question-circle';
    }
  }

  toggleView(): void {
    this.showAvailable = !this.showAvailable;
    if (this.showAvailable) {
      this.loadAvailableVehicles();
    } else {
      this.loadVehicles();
    }
  }

  selectForDelivery(vehicle: Vehicle): void {
    // Update vehicle availability and set it as selected
    this.vehicleService.setVehicleForDelivery(vehicle).subscribe({
      next: (updatedVehicle) => {
        // Update local copy of the vehicle
        const index = this.vehicles.findIndex(v => v.id === vehicle.id);
        if (index !== -1) {
          this.vehicles[index] = updatedVehicle;
        }
        
        // Update available vehicles list if showing
        if (this.showAvailable) {
          this.availableVehicles = this.availableVehicles.filter(v => v.id !== vehicle.id);
        }
        
        // Set as selected and navigate
        this.vehicleService.setSelectedVehicle(updatedVehicle);
        this.router.navigate(['/client/delivery-request']);
      },
      error: (error) => {
        console.error('Error updating vehicle availability:', error);
      }
    });
  }
  
  toggleVehicleStats(vehicleId: string): void {
    if (this.expandedVehicleId === vehicleId) {
      this.expandedVehicleId = null;
    } else {
      this.expandedVehicleId = vehicleId;
    }
  }
  
  getStatAnimationState(vehicleId: string): string {
    return this.expandedVehicleId === vehicleId ? 'active' : 'inactive';
  }
  
  getVehicleStats(vehicleId: string): VehicleStatistics {
    return this.vehicleStats.get(vehicleId) || {
      totalTrips: 0,
      totalDistance: 0,
      lastUsed: null,
      utilizationRate: 0
    };
  }
  
  formatLastUsed(date: Date | null): string {
    if (!date) return 'Never used';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  }
}