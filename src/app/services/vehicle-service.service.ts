import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { Vehicle } from '../models/Vehicle.model';

export interface VehicleStatistics {
  totalTrips: number;
  totalDistance: number;
  lastUsed: Date | null;
  utilizationRate: number; // percentage of time the vehicle is in use
}

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private apiUrl = 'http://localhost:8080/api/vehicles';
  
  // BehaviorSubject for selected vehicle
  private selectedVehicleSource = new BehaviorSubject<Vehicle | null>(null);
  selectedVehicle$ = this.selectedVehicleSource.asObservable();
  
  // New BehaviorSubject for vehicle statistics
  private vehicleStatsSource = new BehaviorSubject<Map<string, VehicleStatistics>>(new Map());
  vehicleStats$ = this.vehicleStatsSource.asObservable();

  constructor(private http: HttpClient) {
    // Initialize with mock statistics from localStorage or create new ones
    this.loadVehicleStats();
  }

  private loadVehicleStats(): void {
    const storedStats = localStorage.getItem('vehicleStats');
    if (storedStats) {
      // Convert JSON back to Map
      const statsObject = JSON.parse(storedStats);
      const statsMap = new Map<string, VehicleStatistics>();
      
      Object.keys(statsObject).forEach(key => {
        const stat = statsObject[key];
        statsMap.set(key, {
          ...stat,
          lastUsed: stat.lastUsed ? new Date(stat.lastUsed) : null
        });
      });
      
      this.vehicleStatsSource.next(statsMap);
    }
  }

  private saveVehicleStats(): void {
    const statsMap = this.vehicleStatsSource.value;
    const statsObject = Object.fromEntries(statsMap);
    localStorage.setItem('vehicleStats', JSON.stringify(statsObject));
  }

  getVehicleStats(vehicleId: string): Observable<VehicleStatistics> {
    const statsMap = this.vehicleStatsSource.value;
    
    if (statsMap.has(vehicleId)) {
      return of(statsMap.get(vehicleId)!);
    } else {
      // Create default stats for a new vehicle
      const defaultStats: VehicleStatistics = {
        totalTrips: 0,
        totalDistance: 0,
        lastUsed: null,
        utilizationRate: 0
      };
      
      statsMap.set(vehicleId, defaultStats);
      this.vehicleStatsSource.next(statsMap);
      this.saveVehicleStats();
      
      return of(defaultStats);
    }
  }

  updateVehicleStats(vehicleId: string, trip: { distance?: number }): void {
    const statsMap = this.vehicleStatsSource.value;
    const currentStats = statsMap.get(vehicleId) || {
      totalTrips: 0,
      totalDistance: 0,
      lastUsed: null,
      utilizationRate: 0
    };
    
    // Update the stats
    const updatedStats = {
      ...currentStats,
      totalTrips: currentStats.totalTrips + 1,
      totalDistance: currentStats.totalDistance + (trip.distance || 0),
      lastUsed: new Date(),
      utilizationRate: Math.min(100, currentStats.utilizationRate + 5) // Simple mock increase
    };
    
    statsMap.set(vehicleId, updatedStats);
    this.vehicleStatsSource.next(statsMap);
    this.saveVehicleStats();
  }

  getAllVehicles(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(this.apiUrl);
  }

  getVehicleById(id: string): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.apiUrl}/${id}`);
  }

  getAvailableVehicles(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.apiUrl}/available`);
  }

  setSelectedVehicle(vehicle: Vehicle) {
    this.selectedVehicleSource.next(vehicle);
  }

  // Update vehicle availability when selected for delivery
  setVehicleForDelivery(vehicle: Vehicle): Observable<Vehicle> {
    const updatedVehicle = { ...vehicle, available: false };
    return this.updateVehicle(vehicle.id!, updatedVehicle, null).pipe(
      tap(() => {
        // Update stats when vehicle is used
        this.updateVehicleStats(vehicle.id!, { distance: 0 });
      })
    );
  }

  resetVehicleAvailability(vehicleId: string): Observable<Vehicle> {
    return this.getVehicleById(vehicleId).pipe(
      switchMap(vehicle => {
        const updatedVehicle = { ...vehicle, available: true };
        return this.updateVehicle(vehicleId, updatedVehicle, null);
      })
    );
  }

  createVehicle(vehicle: Vehicle, photo: File | null): Observable<Vehicle> {
    const formData = new FormData();
    const vehicleBlob = new Blob([JSON.stringify(vehicle)], { type: 'application/json' });
    
    formData.append('vehicle', vehicleBlob);
    if (photo) {
      formData.append('photo', photo);
    }
    
    return this.http.post<Vehicle>(this.apiUrl, formData);
  }

  updateVehicle(id: string, vehicle: Vehicle, photo: File | null): Observable<Vehicle> {
    const formData = new FormData();
    const vehicleBlob = new Blob([JSON.stringify(vehicle)], { type: 'application/json' });
    
    formData.append('vehicle', vehicleBlob);
    if (photo) {
      formData.append('photo', photo);
    }
    
    return this.http.put<Vehicle>(`${this.apiUrl}/${id}`, formData);
  }

  deleteVehicle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  setVehicleUnavailable(id: string): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.apiUrl}/${id}/set-unavailable`, {});
  }

  // Assign vehicle to user
  assignVehicleToUser(vehicleId: string, userId: string): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.apiUrl}/${vehicleId}/assign`, { userId });
  }
}