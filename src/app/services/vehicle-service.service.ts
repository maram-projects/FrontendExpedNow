import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { Vehicle, VehicleStatistics, VehicleDTO, convertDtoToVehicle, convertVehicleToDto } from '../models/Vehicle.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private apiUrl = 'http://localhost:8080/api/vehicles';
  private vehicleCache: Map<string, Vehicle> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private cacheTimestamps: Map<string, number> = new Map();

  // BehaviorSubject for selected vehicle
  private selectedVehicleSource = new BehaviorSubject<Vehicle | null>(null);
  selectedVehicle$ = this.selectedVehicleSource.asObservable();
  
  // BehaviorSubject for vehicle statistics
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

  // Fetch all vehicles and convert from DTOs
  getAllVehicles(): Observable<Vehicle[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(dtos => {
        // Check if response is already in vehicle format or needs conversion
        if (dtos.length > 0 && 'vehicleBrand' in dtos[0]) {
          // If it's a DTO response, convert it
          return dtos.map(dto => convertDtoToVehicle(dto as VehicleDTO));
        } else {
          // Already in Vehicle format
          return dtos as Vehicle[];
        }
      }),
      tap(vehicles => {
        // Update cache with these vehicles
        vehicles.forEach(vehicle => {
          if (vehicle.id) {
            this.updateCache(vehicle.id, vehicle);
          }
        });
      }),
      catchError(error => {
        console.error('Error fetching all vehicles:', error);
        return throwError(() => new Error(`Failed to load vehicles: ${error.message}`));
      })
    );
  }

  private updateCache(id: string, vehicle: Vehicle): void {
    this.vehicleCache.set(id, vehicle);
    this.cacheTimestamps.set(id, Date.now());
  }

  private isCacheValid(id: string): boolean {
    const timestamp = this.cacheTimestamps.get(id);
    if (!timestamp) return false;
    return (Date.now() - timestamp) < this.cacheTTL;
  }

  getVehicleById(id: string): Observable<Vehicle> {
    const cachedVehicle = this.vehicleCache.get(id);
    if (cachedVehicle && this.isCacheValid(id)) return of(cachedVehicle);

    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        // Check if response is already in vehicle format or needs conversion
        if (response && 'vehicleBrand' in response) {
          // If it's a DTO response, convert it
          return convertDtoToVehicle(response as VehicleDTO);
        } else {
          // Already in Vehicle format
          return response as Vehicle;
        }
      }),
      tap(vehicle => this.updateCache(id, vehicle)),
      catchError(error => {
        console.error(`Error fetching vehicle ${id}:`, error);
        return throwError(() => new Error('Failed to load vehicle'));
      })
    );
  }

  getAvailableVehicles(): Observable<Vehicle[]> {
    return this.http.get<any[]>(`${this.apiUrl}/available`).pipe(
      map(dtos => {
        // Check if response is already in vehicle format or needs conversion
        if (dtos.length > 0 && 'vehicleBrand' in dtos[0]) {
          // If it's a DTO response, convert it
          return dtos.map(dto => convertDtoToVehicle(dto as VehicleDTO));
        } else {
          // Already in Vehicle format
          return dtos as Vehicle[];
        }
      }),
      tap(vehicles => {
        console.log(`Fetched ${vehicles.length} available vehicles`);
        vehicles.forEach(vehicle => {
          if (vehicle.id) {
            this.updateCache(vehicle.id, vehicle);
          }
        });
      }),
      catchError(error => {
        console.error('Error fetching available vehicles:', error);
        return throwError(() => new Error(`Failed to load available vehicles: ${error.message}`));
      })
    );
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
    
    const vehicleForSending = convertVehicleToDto(vehicle);
    formData.append('vehicle', new Blob([JSON.stringify(vehicleForSending)], {
        type: 'application/json'
    }));
    
    if (photo) {
        formData.append('photo', photo);
    }
    
    return this.http.post<VehicleDTO>(this.apiUrl, formData).pipe(
        map(response => convertDtoToVehicle(response)),
        catchError(error => {
            console.error('Error creating vehicle:', error);
            return throwError(() => new Error('Failed to create vehicle'));
        })
    );
}

getVehiclePhotoUrl(photoPath: string | undefined): string {
    if (!photoPath) {
        return '/assets/images/no-vehicle-photo.png';
    }
    if (photoPath.startsWith('http')) {
        return photoPath;
    }
    // Construct proper URL
    return `${environment.apiUrl}/uploads/vehicle-photos/${photoPath}`;
}

  updateVehicle(id: string, vehicle: Vehicle, photo: File | null): Observable<Vehicle> {
    const formData = new FormData();
    
    // Convert to DTO if needed
    const vehicleForSending = convertVehicleToDto(vehicle);
    const vehicleBlob = new Blob([JSON.stringify(vehicleForSending)], { type: 'application/json' });
    
    formData.append('vehicle', vehicleBlob);
    if (photo) {
      formData.append('photo', photo);
    }
    
    return this.http.put<any>(`${this.apiUrl}/${id}`, formData).pipe(
      map(response => {
        // Convert response if needed
        if (response && 'vehicleBrand' in response) {
          return convertDtoToVehicle(response as VehicleDTO);
        }
        return response as Vehicle;
      }),
      tap(updatedVehicle => {
        this.updateCache(id, updatedVehicle);
      }),
      catchError(error => {
        console.error('Error updating vehicle:', error);
        return throwError(() => new Error(`Failed to update vehicle: ${error.message}`));
      })
    );
  }

  deleteVehicle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.removeFromCache(id);
      }),
      catchError(error => {
        console.error('Error deleting vehicle:', error);
        return throwError(() => new Error(`Failed to delete vehicle: ${error.message}`));
      })
    );
  }

  setVehicleUnavailable(id: string): Observable<Vehicle> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/set-unavailable`, {}).pipe(
      map(response => {
        // Convert response if needed
        if (response && 'vehicleBrand' in response) {
          return convertDtoToVehicle(response as VehicleDTO);
        }
        return response as Vehicle;
      }),
      tap(vehicle => {
        this.updateCache(id, vehicle);
      }),
      catchError(error => {
        console.error('Error setting vehicle unavailable:', error);
        return throwError(() => new Error(`Failed to update vehicle availability: ${error.message}`));
      })
    );
  }

  // Assign vehicle to user
  // Update the vehicle assignment methods
  assignVehicleToUser(userId: string, vehicleId: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/${userId}/assign-vehicle`, // Remove '/users' from the path
      { vehicleId },
      { 
        headers: new HttpHeaders({'Content-Type': 'application/json'}),
        responseType: 'json'
      }
    )
  }

  /**
   * Clear the vehicle cache to force fresh data
   */
  clearCache(): void {
    console.log('Clearing vehicle cache');
    this.vehicleCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Remove a specific vehicle from cache
   */
  removeFromCache(id: string): void {
    console.log(`Removing vehicle ${id} from cache`);
    this.vehicleCache.delete(id);
    this.cacheTimestamps.delete(id);
  }



}