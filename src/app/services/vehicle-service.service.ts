  import { Injectable } from '@angular/core';
  import { HttpClient, HttpHeaders } from '@angular/common/http';
  import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
  import { map, tap, catchError, switchMap } from 'rxjs/operators';
  import { Vehicle, VehicleStatistics, VehicleDTO, convertDtoToVehicle, convertVehicleToDto } from '../models/Vehicle.model';
  import { environment } from '../../environments/environment';
  import { User } from '../models/user.model';

  @Injectable({
    providedIn: 'root'
  })
  export class VehicleService {
    private readonly apiUrl = `${environment.apiUrl || 'http://localhost:8080'}/api/vehicles`;
    private readonly vehicleCache: Map<string, Vehicle> = new Map();
    private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
    private readonly cacheTimestamps: Map<string, number> = new Map();

    // BehaviorSubject for selected vehicle
    private readonly selectedVehicleSource = new BehaviorSubject<Vehicle | null>(null);
    readonly selectedVehicle$ = this.selectedVehicleSource.asObservable();
    
    // BehaviorSubject for vehicle statistics
    private readonly vehicleStatsSource = new BehaviorSubject<Map<string, VehicleStatistics>>(new Map());
    readonly vehicleStats$ = this.vehicleStatsSource.asObservable();

    constructor(private http: HttpClient) {
      this.loadVehicleStats();
    }

    private loadVehicleStats(): void {
      try {
        const storedStats = localStorage.getItem('vehicleStats');
        if (storedStats) {
          const statsObject = JSON.parse(storedStats);
          const statsMap = new Map<string, VehicleStatistics>();
          
          Object.keys(statsObject).forEach(key => {
            const stat = statsObject[key];
            if (stat && typeof stat === 'object') {
              statsMap.set(key, {
                totalTrips: stat.totalTrips || 0,
                totalDistance: stat.totalDistance || 0,
                lastUsed: stat.lastUsed ? new Date(stat.lastUsed) : null,
                utilizationRate: stat.utilizationRate || 0
              });
            }
          });
          
          this.vehicleStatsSource.next(statsMap);
        }
      } catch (error) {
        console.error('Error loading vehicle stats from localStorage:', error);
        // Initialize with empty stats if loading fails
        this.vehicleStatsSource.next(new Map());
      }
    }

    private saveVehicleStats(): void {
      try {
        const statsMap = this.vehicleStatsSource.value;
        const statsObject = Object.fromEntries(statsMap);
        localStorage.setItem('vehicleStats', JSON.stringify(statsObject));
      } catch (error) {
        console.error('Error saving vehicle stats to localStorage:', error);
      }
    }

    getVehicleStats(vehicleId: string): Observable<VehicleStatistics> {
      if (!vehicleId) {
        return throwError(() => new Error('Vehicle ID is required'));
      }

      const statsMap = this.vehicleStatsSource.value;
      
      if (statsMap.has(vehicleId)) {
        const stats = statsMap.get(vehicleId)!;
        return of(stats);
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
      if (!vehicleId) {
        console.error('Cannot update stats: Vehicle ID is required');
        return;
      }

      const statsMap = this.vehicleStatsSource.value;
      const currentStats = statsMap.get(vehicleId) || {
        totalTrips: 0,
        totalDistance: 0,
        lastUsed: null,
        utilizationRate: 0
      };
      
      // Update the stats with validation
      const distance = Math.max(0, trip.distance || 0);
      const updatedStats: VehicleStatistics = {
        totalTrips: currentStats.totalTrips + 1,
        totalDistance: currentStats.totalDistance + distance,
        lastUsed: new Date(),
        utilizationRate: Math.min(100, Math.max(0, currentStats.utilizationRate + 5))
      };
      
      statsMap.set(vehicleId, updatedStats);
      this.vehicleStatsSource.next(statsMap);
      this.saveVehicleStats();
    }

    private convertResponseToVehicles(response: any[]): Vehicle[] {
      if (!Array.isArray(response)) {
        throw new Error('Invalid response format: expected array');
      }

      return response
        .map(item => {
          if (!item) return null;
          
          // Check if response is already in vehicle format or needs conversion
          if ('vehicleBrand' in item) {
            return convertDtoToVehicle(item as VehicleDTO);
          } else {
            return item as Vehicle;
          }
        })
        .filter((vehicle): vehicle is Vehicle => vehicle !== null);
    }

    private convertResponseToVehicle(response: any): Vehicle {
      if (!response) {
        throw new Error('Invalid response: vehicle data is null or undefined');
      }

      // Check if response is already in vehicle format or needs conversion
      if ('vehicleBrand' in response) {
        const converted = convertDtoToVehicle(response as VehicleDTO);
        if (!converted) {
          throw new Error('Failed to convert DTO to vehicle');
        }
        return converted;
      } else {
        return response as Vehicle;
      }
    }

    // Fetch all vehicles and convert from DTOs
    getAllVehicles(): Observable<Vehicle[]> {
      return this.http.get<any[]>(this.apiUrl).pipe(
        map(response => this.convertResponseToVehicles(response)),
        tap(vehicles => {
          // Update cache with these vehicles
          vehicles.forEach(vehicle => {
            if (vehicle?.id) {
              this.updateCache(vehicle.id, vehicle);
            }
          });
          console.log(`Cached ${vehicles.length} vehicles`);
        }),
        catchError(error => {
          console.error('Error fetching all vehicles:', error);
          return throwError(() => new Error(`Failed to load vehicles: ${error.message || 'Unknown error'}`));
        })
      );
    }

    private updateCache(id: string, vehicle: Vehicle): void {
      if (!id || !vehicle) {
        console.warn('Cannot update cache: invalid id or vehicle data');
        return;
      }
      this.vehicleCache.set(id, vehicle);
      this.cacheTimestamps.set(id, Date.now());
    }

    private isCacheValid(id: string): boolean {
      const timestamp = this.cacheTimestamps.get(id);
      if (!timestamp) return false;
      return (Date.now() - timestamp) < this.cacheTTL;
    }

    getVehicleById(id: string): Observable<Vehicle> {
      if (!id) {
        return throwError(() => new Error('Vehicle ID is required'));
      }

      const cachedVehicle = this.vehicleCache.get(id);
      if (cachedVehicle && this.isCacheValid(id)) {
        return of(cachedVehicle);
      }

      return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
        map(response => this.convertResponseToVehicle(response)),
        tap(vehicle => {
          if (vehicle?.id) {
            this.updateCache(vehicle.id, vehicle);
          }
        }),
        catchError(error => {
          console.error(`Error fetching vehicle ${id}:`, error);
          return throwError(() => new Error(`Failed to load vehicle: ${error.message || 'Unknown error'}`));
        })
      );
    }

    getAvailableVehicles(): Observable<Vehicle[]> {
      return this.http.get<any[]>(`${this.apiUrl}/available`).pipe(
        map(response => this.convertResponseToVehicles(response)),
        tap(vehicles => {
          console.log(`Fetched ${vehicles.length} available vehicles`);
          vehicles.forEach(vehicle => {
            if (vehicle?.id) {
              this.updateCache(vehicle.id, vehicle);
            }
          });
        }),
        catchError(error => {
          console.error('Error fetching available vehicles:', error);
          return throwError(() => new Error(`Failed to load available vehicles: ${error.message || 'Unknown error'}`));
        })
      );
    }

    setSelectedVehicle(vehicle: Vehicle | null): void {
      this.selectedVehicleSource.next(vehicle);
    }

    // Update vehicle availability when selected for delivery
    setVehicleForDelivery(vehicle: Vehicle): Observable<Vehicle> {
      if (!vehicle?.id) {
        return throwError(() => new Error('Invalid vehicle: ID is required'));
      }

      const updatedVehicle = { ...vehicle, available: false };
      return this.updateVehicle(vehicle.id, updatedVehicle, null).pipe(
        tap(updated => {
          // Update stats when vehicle is used
          if (updated?.id) {
            this.updateVehicleStats(updated.id, { distance: 0 });
          }
        })
      );
    }

    resetVehicleAvailability(vehicleId: string): Observable<Vehicle> {
      if (!vehicleId) {
        return throwError(() => new Error('Vehicle ID is required'));
      }

      return this.getVehicleById(vehicleId).pipe(
        switchMap(vehicle => {
          if (!vehicle) {
            return throwError(() => new Error('Vehicle not found'));
          }
          const updatedVehicle = { ...vehicle, available: true };
          return this.updateVehicle(vehicleId, updatedVehicle, null);
        })
      );
    }

    createVehicle(vehicle: Vehicle, photo: File | null = null): Observable<Vehicle> {
      if (!vehicle) {
        return throwError(() => new Error('Vehicle data is required'));
      }

      try {
        const formData = new FormData();
        const vehicleDto = convertVehicleToDto(vehicle);
        
        formData.append('vehicle', new Blob([JSON.stringify(vehicleDto)], {
          type: 'application/json'
        }));
        
        if (photo) {
          formData.append('photo', photo);
        }
        
        return this.http.post<any>(this.apiUrl, formData).pipe(
          map(response => this.convertResponseToVehicle(response)),
          tap(created => {
            if (created?.id) {
              this.updateCache(created.id, created);
            }
          }),
          catchError(error => {
            console.error('Error creating vehicle:', error);
            return throwError(() => new Error(`Failed to create vehicle: ${error.message || 'Unknown error'}`));
          })
        );
      } catch (error) {
        return throwError(() => new Error(`Failed to prepare vehicle data: ${error}`));
      }
    }

    getVehiclePhotoUrl(photoPath: string | undefined): string {
      if (!photoPath) {
        return '/assets/images/no-vehicle-photo.png';
      }
      
      if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
        return photoPath;
      }
      
      // Construct proper URL with environment configuration
      const baseUrl = environment.apiUrl || 'http://localhost:8080';
      return `${baseUrl}/uploads/vehicle-photos/${photoPath}`;
    }

    updateVehicle(id: string, vehicle: Vehicle, photo: File | null = null): Observable<Vehicle> {
      if (!id) {
        return throwError(() => new Error('Vehicle ID is required'));
      }
      
      if (!vehicle) {
        return throwError(() => new Error('Vehicle data is required'));
      }

      try {
        const formData = new FormData();
        const vehicleDto = convertVehicleToDto(vehicle);
        
        formData.append('vehicle', new Blob([JSON.stringify(vehicleDto)], { 
          type: 'application/json' 
        }));
        
        if (photo) {
          formData.append('photo', photo);
        }
        
        return this.http.put<any>(`${this.apiUrl}/${id}`, formData).pipe(
          map(response => this.convertResponseToVehicle(response)),
          tap(updated => {
            if (updated?.id) {
              this.updateCache(updated.id, updated);
            }
          }),
          catchError(error => {
            console.error(`Error updating vehicle ${id}:`, error);
            return throwError(() => new Error(`Failed to update vehicle: ${error.message || 'Unknown error'}`));
          })
        );
      } catch (error) {
        return throwError(() => new Error(`Failed to prepare vehicle data: ${error}`));
      }
    }

    deleteVehicle(id: string): Observable<void> {
      if (!id) {
        return throwError(() => new Error('Vehicle ID is required'));
      }

      return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
        tap(() => {
          this.removeFromCache(id);
          // Also remove from stats
          const statsMap = this.vehicleStatsSource.value;
          if (statsMap.has(id)) {
            statsMap.delete(id);
            this.vehicleStatsSource.next(statsMap);
            this.saveVehicleStats();
          }
        }),
        catchError(error => {
          console.error(`Error deleting vehicle ${id}:`, error);
          return throwError(() => new Error(`Failed to delete vehicle: ${error.message || 'Unknown error'}`));
        })
      );
    }

    setVehicleUnavailable(id: string): Observable<Vehicle> {
      if (!id) {
        return throwError(() => new Error('Vehicle ID is required'));
      }

      return this.http.patch<any>(`${this.apiUrl}/${id}/set-unavailable`, {}).pipe(
        map(response => this.convertResponseToVehicle(response)),
        tap(vehicle => {
          if (vehicle?.id) {
            this.updateCache(vehicle.id, vehicle);
          }
        }),
        catchError(error => {
          console.error(`Error setting vehicle ${id} unavailable:`, error);
          return throwError(() => new Error(`Failed to update vehicle availability: ${error.message || 'Unknown error'}`));
        })
      );
    }

    // Update the vehicle assignment method in VehicleService
  // Replace your existing assignVehicleToUser method with this fixed version:

assignVehicleToUser(userId: string, vehicleId: string): Observable<{user: User, vehicle: Vehicle}> {
  return this.http.patch<{user: any, vehicle: any}>(
    `${this.apiUrl}/${vehicleId}/assign-vehicle`, // Note: Using vehicleId in URL
    { userId } // Sending userId in request body
  ).pipe(
    map(response => {
      if (!response.vehicle) {
        throw new Error('Vehicle data is missing from response');
      }
      
      const convertedVehicle = convertDtoToVehicle(response.vehicle);
      
      if (!convertedVehicle) {
        throw new Error('Failed to convert vehicle DTO to vehicle');
      }
      
      return {
        user: {
          ...response.user,
          assignedVehicleId: response.user.assignedVehicleId || response.vehicle?.id
        },
        vehicle: convertedVehicle
      };
    }),
    catchError(error => {
      console.error(`Error assigning vehicle ${vehicleId} to user ${userId}:`, error);
      return throwError(() => new Error(`Failed to assign vehicle: ${error.message || 'Unknown error'}`));
    })
  );
}
    private mapUserResponse(userData: any): User {
      if (!userData) {
        throw new Error('User data is required');
      }

      return {
        ...userData,
        assignedVehicleId: userData.assignedVehicleId || null,
        assignedVehicle: userData.assignedVehicle ? 
          this.convertResponseToVehicle(userData.assignedVehicle) : null
      };
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
      if (!id) {
        console.warn('Cannot remove from cache: Vehicle ID is required');
        return;
      }
      
      console.log(`Removing vehicle ${id} from cache`);
      this.vehicleCache.delete(id);
      this.cacheTimestamps.delete(id);
    }

    /**
     * Get cache size for debugging
     */
    getCacheSize(): number {
      return this.vehicleCache.size;
    }

    /**
     * Check if a vehicle is cached
     */
    isCached(id: string): boolean {
      return this.vehicleCache.has(id) && this.isCacheValid(id);
    }
  }