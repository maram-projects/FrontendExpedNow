import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { User, USER_STATUS, USER_TYPES } from '../models/user.model';
import { AuthService } from './auth.service';
import { VehicleService } from './vehicle-service.service';
import { Vehicle, VehicleDTO, VehicleType } from '../models/Vehicle.model';

// Interface for update user payload
interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  enabled?: boolean;
  approved?: boolean;
  roles?: string[];
  userType?: keyof typeof USER_TYPES;
}


// Interface for assign vehicle payload
interface AssignVehiclePayload {
  vehicleId: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apiUrl = 'http://localhost:8080/api/users';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private vehicleService: VehicleService
  ) {}

  // ================ USER CRUD OPERATIONS ================

  /**
   * Get all users
   * @returns Observable of User array
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get user by ID
   * @param userId The user's ID
   * @returns Observable of User
   */
  getUserById(userId: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get current user details
   * @returns Observable of User
   */
  getUserDetails(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Update user by ID
   * @param userId The user's ID
   * @param userData Partial user data to update
   * @returns Observable of updated User
   */

  updateUserById(userId: string, userData: Partial<User>): Observable<User> {
    const payload: UpdateUserPayload = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      enabled: userData.enabled,
      approved: userData.approved,
      roles: userData.roles,
      userType: userData.userType as keyof typeof USER_TYPES
    };

    return this.http.put<User>(`${this.apiUrl}/${userId}`, payload).pipe(
      catchError(this.handleError)
    );
  }


  /**
   * Update current user profile
   * @param user The user data to update
   * @returns Observable of updated User
   */
  updateProfile(user: User): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profile`, user).pipe(
      catchError(this.handleError)
    );
  }

  // ================ USER APPROVAL/STATUS ================

  /**
   * Get pending approval users
   * @returns Observable of User array
   */
  getPendingUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/pending-approvals`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Approve a user
   * @param userId The user's ID to approve
   * @returns Observable of approved User
   */
approveUser(userId: string): Observable<User> {
  return this.http.post<User>(
    `${this.apiUrl}/approve-user/${userId}`,  // Changed to match Spring endpoint
    {}
  ).pipe(
    catchError(this.handleError)
  );
}

  /**
   * Reject a user
   * @param userId The user's ID to reject
   * @returns Observable of void
   */
rejectUser(userId: string): Observable<void> {
  return this.http.post<void>(
    `${this.apiUrl}/reject-user/${userId}`,  // Changed to match Spring endpoint
    {}
  ).pipe(
    catchError(this.handleError)
  );
}

  /**
   * Enable a user account
   * @param userId The user's ID to enable
   * @returns Observable of enabled User
   */
  enableUser(userId: string): Observable<User> {
    return this.setUserStatus(userId, true);
  }

  /**
   * Disable a user account
   * @param userId The user's ID to disable
   * @returns Observable of disabled User
   */
  disableUser(userId: string): Observable<User> {
    return this.setUserStatus(userId, false);
  }

  /**
   * Set user status (enabled/disabled)
   * @param userId The user's ID
   * @param enabled Whether to enable or disable
   * @returns Observable of updated User
   */
private setUserStatus(userId: string, enabled: boolean): Observable<User> {
  // Change to:
  return this.http.patch<User>(
    `${this.apiUrl}/${userId}/${enabled ? 'enable' : 'disable'}`, 
    {}
  )
}
  // ================ VEHICLE OPERATIONS ================

/**
 * Assign vehicle to user
 * @param userId The user's ID
 * @param vehicleId The vehicle's ID
 * @returns Observable with user and vehicle
 */
assignVehicleToUser(userId: string, vehicleId: string): Observable<{user: User, vehicle: Vehicle}> {
  return this.http.patch<{user: any, vehicle: any}>(
    `${this.apiUrl}/${userId}/assign-vehicle`,  // Match Spring endpoint
    { vehicleId }  // Send vehicleId in request body
  ).pipe(
    map(response => {
      // Validate response structure
      if (!response.user || !response.vehicle) {
        throw new Error('Invalid response structure from server');
      }

      // Convert DTO to Vehicle model if needed
      const vehicle = this.isVehicleDTO(response.vehicle) ? 
        this.convertDtoToVehicle(response.vehicle) : 
        response.vehicle;

      return {
        user: response.user,
        vehicle: vehicle
      };
    }),
    catchError(error => {
      console.error(`Error assigning vehicle ${vehicleId} to user ${userId}:`, error);
      return throwError(() => new Error(`Failed to assign vehicle: ${error.message || 'Unknown error'}`));
    })
  );
}
isVehicleDTO(vehicle: Vehicle | VehicleDTO): vehicle is VehicleDTO {
  return 'vehicleBrand' in vehicle;
}

  /**
   * Unassign vehicle from user
   * @param userId The user's ID
   * @returns Observable of updated User
   */
  unassignVehicleFromUser(userId: string): Observable<User> {
    return this.http.patch<User>(
      `${this.apiUrl}/${userId}/unassign-vehicle`, 
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ================ SPECIAL USER TYPES ================

  /**
   * Get delivery personnel users
   * @returns Observable of User array
   */
getDeliveryPersonnel(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/delivery-personnel`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get available drivers
   * @returns Observable of User array
   */
  getAvailableDrivers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/available-drivers`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get users by type
   * @param userType The type of users to get
   * @returns Observable of User array
   */
  getUsersByType(userType:keyof typeof USER_TYPES): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/type/${userType}`).pipe(
      catchError(this.handleError)
    );
  }

  // ================ UTILITY METHODS ================

  /**
   * Convert user type to roles array
   * @param userType The user type
   * @returns Array of roles
   */
private mapUserTypeToRoles(userType: keyof typeof USER_TYPES): string[] {
  const roleMap: Record<keyof typeof USER_TYPES, string[]> = {
    ADMIN: ['ADMIN'],
    ENTERPRISE: ['ROLE_ENTERPRISE'],
    INDIVIDUAL: ['ROLE_INDIVIDUAL'],
    PROFESSIONAL: ['ROLE_PROFESSIONAL'],
    TEMPORARY: ['ROLE_TEMPORARY']
  };
  return roleMap[userType] || ['ROLE_CLIENT'];
}
  /**
   * Convert VehicleDTO to Vehicle
   * @param dto The VehicleDTO to convert
   * @returns Vehicle object
   */
   private convertDtoToVehicle(dto: VehicleDTO): Vehicle {
    return {
      id: dto.id || '',
      make: dto.vehicleBrand || 'Unknown',
      model: dto.vehicleModel || 'Unknown',
      year: dto.vehicleYear || 0,
      licensePlate: dto.vehiclePlateNumber || 'N/A',
      vehicleType: dto.vehicleType || VehicleType.CAR,
      available: dto.available !== false,
      maxLoad: dto.vehicleCapacityKg || 0
    };
  }

  /**
   * Handle HTTP errors
   * @param error The HttpErrorResponse
   * @returns Error observable
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error?.message) {
        errorMessage += `\nDetails: ${error.error.message}`;
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }


  /**
 * Update user (alias for updateUserById)
 * @param userId The user's ID
 * @param userData Partial user data to update
 * @returns Observable of updated User
 */
 updateUser(userId: string, userData: Partial<User>): Observable<User> {
    return this.updateUserById(userId, userData);
  }

}