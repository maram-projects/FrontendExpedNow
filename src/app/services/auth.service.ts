  // services/auth.service.ts
  import { inject, Injectable } from '@angular/core';
  import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
  import { BehaviorSubject, Observable, throwError } from 'rxjs';
  import { catchError, tap } from 'rxjs/operators';
  import { User, AuthResponse, USER_TYPES } from '../models/user.model';
  import { Router } from '@angular/router';

  @Injectable({
    providedIn: 'root',
  })
  export class AuthService {
    private apiUrl = 'http://localhost:8080/api/auth';
    private currentUserSubject = new BehaviorSubject<AuthResponse | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();
    private router = inject(Router);

    constructor(private http: HttpClient) {
      this.initializeUserSession();
    }

    private initializeUserSession(): void {
      const storedUser = localStorage.getItem('currentUser');
      
      if (storedUser) {
        try {
          const user: AuthResponse = JSON.parse(storedUser);
          if (user?.token) {
            this.currentUserSubject.next(user);
          } else {
            this.clearUserSession();
          }
        } catch (error) {
          this.clearUserSession();
        }
      } else {
        this.clearUserSession();
      }
    }

    login(email: string, password: string): Observable<AuthResponse> {
      return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
        tap((response) => {
          if (response?.token && response?.userId) {
            const authData: AuthResponse = {
              token: response.token,
              userType: response.userType?.toLowerCase() || '',
              userId: response.userId,
              email: response.email,
              firstName: response.firstName,
              lastName: response.lastName,
              phone: response.phone,
              address: response.address,
              companyName: response.companyName,
              vehicleType: response.vehicleType,
              assignedVehicleId: response.assignedVehicleId,
              
            };

            localStorage.setItem('currentUser', JSON.stringify(authData));
        this.currentUserSubject.next(authData);
        
        // Special handling for admin redirect
        if (authData.userType === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.redirectBasedOnUserType(authData.userType);
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Login failed';
      if (error.error?.error) {
        errorMessage += `: ${error.error.error}`;
      }
      return throwError(() => new Error(errorMessage));
    })
  );
}

    register(user: User, userType: string): Observable<any> {
      // Create payload that matches your backend expectations
      const payload = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          password: user.password,
          confirmPassword: user.confirmPassword,
          phone: user.phone,
          address: user.address,
          vehicleType: user.vehicleType,
          vehicleBrand: user.vehicleBrand,
          vehicleModel: user.vehicleModel,
          vehiclePlateNumber: user.vehiclePlateNumber,
          driverLicenseNumber: user.driverLicenseNumber,
          driverLicenseCategory: user.driverLicenseCategory
      };
  
      return this.http.post<any>(`${this.apiUrl}/register?userType=${userType}`, payload).pipe(
          tap((response) => {
              if (response?.token) {
                  const authData: AuthResponse = {
                      token: response.token,
                      userType: response.userType?.toLowerCase() || '',
                      userId: response.userId,
                      email: response.email,
                      firstName: response.firstName,
                      lastName: response.lastName,
                      phone: response.phone,
                      address: response.address,
                      vehicleType: response.vehicleType,
                      assignedVehicleId: response.assignedVehicleId
                  };
  
                  if (response.userType?.toLowerCase() === USER_TYPES.ADMIN) {
                      localStorage.setItem('currentUser', JSON.stringify(authData));
                      this.currentUserSubject.next(authData);
                      this.redirectBasedOnUserType(authData.userType);
                  }
              }
          }),
          catchError((error) => {
              if (error.error?.message?.includes('email already exists')) {
                  return throwError(() => new Error('This email is already registered'));
              }
              return this.handleError(error);
          })
      );
  }
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email }).pipe(
      catchError(error => {
        let errorMsg = 'Password reset failed';
        if (error.error?.error) {
          errorMsg += `: ${error.error.error}`;
        }
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  resetPassword(token: string, newPassword: string, confirmPassword: string): Observable<any> {
      return this.http.post(`${this.apiUrl}/reset-password`, { 
          token, 
          newPassword, 
          confirmPassword 
      });
  }

    private buildRegistrationPayload(user: User, userType: string): any {
      // Don't manually set roles in payload - backend will handle it based on userType parameter
      const basePayload = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: user.password,
        phone: user.phone,
        address: user.address
      };

      switch(userType) {
        case USER_TYPES.ENTERPRISE:
          return {
            ...basePayload,
            companyName: user.companyName,
            businessType: user.businessType,
            vatNumber: user.vatNumber,
            businessPhone: user.businessPhone,
            businessAddress: user.businessAddress,
            deliveryRadius: user.deliveryRadius
          };
        case USER_TYPES.TEMPORARY:
        case USER_TYPES.PROFESSIONAL:
          return {
            ...basePayload,
            vehicleType: user.vehicleType,
            vehicleBrand: user.vehicleBrand,
            vehicleModel: user.vehicleModel,
            vehiclePlateNumber: user.vehiclePlateNumber,
            vehicleColor: user.vehicleColor,
            vehicleYear: user.vehicleYear,
            vehicleCapacityKg: user.vehicleCapacityKg,
            vehicleVolumeM3: user.vehicleVolumeM3,
            vehicleHasFridge: user.vehicleHasFridge,
            driverLicenseNumber: user.driverLicenseNumber,
            driverLicenseCategory: user.driverLicenseCategory,
            preferredZones: user.preferredZones
          };
        default: // INDIVIDUAL
          return basePayload;
      }
    }

    logout(): void {
      console.log('Logout initiated');
      this.clearUserSession();
      console.log('Session cleared, navigating to login');
      this.router.navigate(['/login']).then(success => {
          console.log(success ? 'Navigation successful' : 'Navigation failed');
      });
  }

    private clearUserSession(): void {
      localStorage.removeItem('currentUser');
      this.currentUserSubject.next(null);
    }

    getCurrentUser(): AuthResponse | null {
      try {
          const user = localStorage.getItem('currentUser');
          return user ? JSON.parse(user) as AuthResponse : null;
      } catch (e) {
          this.clearUserSession();
          return null;
      }
  }

    isSessionValid(): boolean {
      try {
        const user = this.getCurrentUser();
        return !!user?.token && !!user?.userId;
      } catch {
        return false;
      }
    }
    isClient(): boolean {
      const user = this.getCurrentUser();
      return !!user && [USER_TYPES.INDIVIDUAL, USER_TYPES.ENTERPRISE].includes(user.userType);
    }

    isAdmin(): boolean {
      const user = this.getCurrentUser();
      return !!user && user.userType.toLowerCase() === 'admin'; // Ensure case insensitivity
  }
    
    isLoggedIn(): boolean {
      return !!this.getCurrentUser()?.token;
    }

    getToken(): string | null {
      return this.getCurrentUser()?.token || null;
    }

    private handleError(error: HttpErrorResponse) {
      let errorMessage = 'An error occurred';
      if (error.error instanceof ErrorEvent) {
        errorMessage = error.error.message;
      } else {
        if (typeof error.error === 'object' && error.error !== null) {
          errorMessage = error.error.error || error.error.message || JSON.stringify(error.error);
        } else {
          errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
        }
      }
      return throwError(() => new Error(errorMessage));
    }

    updateProfile(user: User): Observable<User> {
      return this.http.put<User>(`${this.apiUrl}/profile`, user);
    }

    isAuthenticated(): boolean {
      return !!this.getToken();
    }

    getUserType(): string | null {
      const user = this.getCurrentUser();
      return user?.userType || null;
    }

    redirectBasedOnUserType(userType: string): void {
      const routes = {
        [USER_TYPES.INDIVIDUAL]: '/client/dashboard',
        [USER_TYPES.ENTERPRISE]: '/client/dashboard',
        [USER_TYPES.TEMPORARY]: '/delivery/dashboard',
        [USER_TYPES.PROFESSIONAL]: '/delivery/dashboard',
        [USER_TYPES.ADMIN]: '/admin/dashboard'
      };

      const route = routes[userType.toLowerCase() as keyof typeof routes] || '/login';
      this.router.navigate([route]);
    }

    updateLocalUserData(userData: any): void {
      const currentUser = this.getCurrentUser();
      if (currentUser) {
        // Update the current user data with new information
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        this.currentUserSubject.next(updatedUser);
      }


    }
  }