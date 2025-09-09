import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { User, USER_TYPES } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { MapService } from '../../../services/map.service'; // Import your MapService
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog/confirm-dialog.component';
import { Subject, interval, takeUntil } from 'rxjs';

// Define interfaces for location
interface UserLocation {
  latitude: number;
  longitude: number;
  lastUpdated: Date;
  address?: string;
}

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatListModule
  ],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.css']
})
export class UserDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly USER_TYPES = USER_TYPES;
  
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  user: User | null = null;
  loading = true;
  error = '';
  activeTabIndex = 0;
  isCurrentUser = false;
  canEdit = false;
  
  // Location related properties
  userLocation: UserLocation | null = null;
  locationLoading = false;
  locationError = '';
  isMapInitialized = false;
  
  // Location permission status
  locationPermissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';
  
  private destroy$ = new Subject<void>();
  private locationUpdateInterval = 30000; // 30 seconds

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private authService: AuthService,
    private mapService: MapService, // Inject MapService
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    const isSelfView = this.route.snapshot.data['selfView'];
    
    if (isSelfView || !userId) {
      // Self-view mode
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.userId) {
        this.checkPermissions(currentUser.userId);
        this.loadUser(currentUser.userId);
        // Only start location tracking for current user
        this.initializeLocationTracking();
      } else {
        this.error = 'No user information available';
        this.loading = false;
      }
    } else {
      // Admin viewing another user
      this.checkPermissions(userId);
      this.loadUser(userId);
      // Load location data for other users (read-only)
      this.loadUserLocation(userId);
    }
  }

  ngAfterViewInit(): void {
    // Initialize map when tab becomes active and location is available
    if (this.activeTabIndex === 2 && this.userLocation && !this.isMapInitialized) {
      this.initializeMap();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopLocationTracking();
    // Clean up map
    if (this.isMapInitialized) {
      this.mapService.destroy();
    }
  }

  private checkPermissions(userId: string): void {
    const currentUser = this.authService.getCurrentUser();
    this.isCurrentUser = currentUser?.userId === userId;
    this.canEdit = this.authService.isAdmin() || this.isCurrentUser;
  }

  loadUser(userId: string): void {
    this.loading = true;
    this.error = '';
    
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
            console.log('Loaded user:', user); // Add this debug line
      console.log('User type:', user.userType); // Add this debug line
        this.user = user;
        this.loading = false;
        
        // Load location after user is loaded
        if (this.isCurrentUser) {
          this.loadUserLocation(userId);
        }
      },
      error: (err) => {
        console.error('Error loading user:', err);
        this.error = 'Failed to load user details';
        this.loading = false;
        this.showSnackbar(this.error, 'error');
      }
    });
  }

  // ================ LOCATION METHODS ================

  private initializeLocationTracking(): void {
    if (!this.isCurrentUser) return;
    
    this.checkLocationPermission();
    
    if ('geolocation' in navigator) {
      this.startLocationTracking();
    } else {
      this.locationError = 'Geolocation is not supported by this browser';
    }
  }

  private async checkLocationPermission(): Promise<void> {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        this.locationPermissionStatus = permission.state as 'granted' | 'denied' | 'prompt';
        
        // Listen for permission changes
        permission.onchange = () => {
          this.locationPermissionStatus = permission.state as 'granted' | 'denied' | 'prompt';
        };
      }
    } catch (error) {
      console.warn('Could not check location permission:', error);
    }
  }

  private startLocationTracking(): void {
    if (!navigator.geolocation || !this.isCurrentUser) return;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000 // 1 minute
    };

    // Get current position once
    navigator.geolocation.getCurrentPosition(
      (position) => this.handleLocationSuccess(position),
      (error) => this.handleLocationError(error),
      options
    );

    // Set up periodic location updates
    interval(this.locationUpdateInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => this.handleLocationSuccess(position),
          (error) => this.handleLocationError(error),
          options
        );
      });
  }

  private handleLocationSuccess(position: GeolocationPosition): void {
    this.locationLoading = false;
    this.locationError = '';
    
    const { latitude, longitude } = position.coords;
    const lastUpdated = new Date();
    
    this.userLocation = {
      latitude,
      longitude,
      lastUpdated
    };
    
    // Reverse geocoding to get address (optional)
    this.reverseGeocode(latitude, longitude);
    
    // Update location on server
    this.updateUserLocationOnServer(latitude, longitude);
    
    // Update map if tab is active
    if (this.activeTabIndex === 2) {
      this.updateMap();
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data && data.display_name) {
        this.userLocation!.address = data.display_name;
      }
    } catch (error) {
      console.warn('Could not reverse geocode location:', error);
    }
  }

  private handleLocationError(error: GeolocationPositionError): void {
    this.locationLoading = false;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        this.locationError = 'Location access denied. Please enable location permissions.';
        this.locationPermissionStatus = 'denied';
        break;
      case error.POSITION_UNAVAILABLE:
        this.locationError = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        this.locationError = 'Location request timed out.';
        break;
      default:
        this.locationError = 'Unknown error occurred while getting location.';
        break;
    }
    
    console.error('Geolocation error:', error);
  }

  private updateUserLocationOnServer(latitude: number, longitude: number): void {
    // In a real implementation, you would call your location service here
    // For example:
    // this.locationService.updateUserLocation(this.user!.id!, latitude, longitude)
    //   .subscribe({
    //     next: () => console.log('Location updated on server'),
    //     error: (err) => console.error('Failed to update location on server', err)
    //   });
    
    console.log(`Would update location on server: ${latitude}, ${longitude}`);
  }

  private loadUserLocation(userId: string): void {
    this.locationLoading = true;
    
    // In a real implementation, you would call your location service here
    // For now, simulate loading with Tunis coordinates
    setTimeout(() => {
      this.locationLoading = false;
      this.userLocation = {
        latitude: 36.8065,
        longitude: 10.1815,
        lastUpdated: new Date(),
        address: 'Tunis, Tunisia'
      };
      // Update map if tab is active
      if (this.activeTabIndex === 2) {
        this.updateMap();
      }
    }, 1000);
  }

  // ================ MAP METHODS ================

  private async initializeMap(): Promise<void> {
    if (!this.mapContainer?.nativeElement || !this.userLocation || this.isMapInitialized) return;
    
    try {
      // Initialize the map
      await this.mapService.initMap(this.mapContainer.nativeElement, {
        center: [this.userLocation.latitude, this.userLocation.longitude],
        zoom: 15,
        mapType: 'roadmap'
      });

      // Add user location marker
      await this.mapService.addMarker({
        position: [this.userLocation.latitude, this.userLocation.longitude],
        title: 'User Location',
        label: 'U',
        color: '#667eea',
        address: this.userLocation.address
      });

      this.isMapInitialized = true;
      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
      this.locationError = 'Failed to load map';
    }
  }

  private async updateMap(): Promise<void> {
    if (!this.userLocation) return;
    
    if (!this.isMapInitialized) {
      // Initialize map if not already done
      setTimeout(() => this.initializeMap(), 100);
    } else {
      // Update existing map
      try {
        // Clear existing markers and add new one
        this.mapService.destroy();
        this.isMapInitialized = false;
        setTimeout(() => this.initializeMap(), 100);
      } catch (error) {
        console.error('Error updating map:', error);
      }
    }
  }

  private stopLocationTracking(): void {
    // Location tracking is handled by the interval subscription
    // which will be automatically unsubscribed via takeUntil(this.destroy$)
  }

  requestLocationPermission(): void {
    if (!navigator.geolocation) return;
    
    this.locationLoading = true;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handleLocationSuccess(position);
        this.locationPermissionStatus = 'granted';
      },
      (error) => {
        this.handleLocationError(error);
        this.locationPermissionStatus = 'denied';
      },
      { timeout: 10000 }
    );
  }

  // ================ TAB CHANGE METHOD ================
  
  changeTab(index: number): void {
    this.activeTabIndex = index;
    
    // If switching to location tab and we have location data, initialize/update the map
    if (index === 2 && this.userLocation) {
      setTimeout(() => {
        if (!this.isMapInitialized) {
          this.initializeMap();
        }
      }, 100);
    }
  }

  // ================ USER MANAGEMENT METHODS ================

  toggleUserStatus(): void {
    if (!this.user || !this.authService.isAdmin()) return;

    const action = this.user.enabled ? 'disable' : 'enable';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
        message: `Are you sure you want to ${action} ${this.user.firstName} ${this.user.lastName}?`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        cancelText: 'Cancel',
        type: action === 'disable' ? 'warn' : 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.user) {
        this.performStatusToggle();
      }
    });
  }

  private performStatusToggle(): void {
    if (!this.user) return;

    const serviceCall = this.user.enabled 
      ? this.userService.disableUser(this.user.id!) 
      : this.userService.enableUser(this.user.id!);

    serviceCall.subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        const action = updatedUser.enabled ? 'enabled' : 'disabled';
        this.showSnackbar(`User ${action} successfully`, 'success');
      },
      error: (err) => {
        console.error('Error toggling user status:', err);
        const action = this.user!.enabled ? 'disable' : 'enable';
        this.showSnackbar(`Failed to ${action} user`, 'error');
      }
    });
  }

  approveUser(): void {
    if (!this.user || !this.authService.isAdmin()) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Approve User',
        message: `Are you sure you want to approve ${this.user.firstName} ${this.user.lastName}?`,
        confirmText: 'Approve',
        cancelText: 'Cancel',
        type: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.user) {
        this.userService.approveUser(this.user.id!).subscribe({
          next: (updatedUser) => {
            this.user = updatedUser;
            this.showSnackbar('User approved successfully', 'success');
          },
          error: (err) => {
            console.error('Error approving user:', err);
            this.showSnackbar('Failed to approve user', 'error');
          }
        });
      }
    });
  }

  rejectUser(): void {
    if (!this.user || !this.authService.isAdmin()) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Reject User',
        message: `Are you sure you want to reject ${this.user.firstName} ${this.user.lastName}? This action cannot be undone.`,
        confirmText: 'Reject',
        cancelText: 'Cancel',
        type: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.user) {
        this.userService.rejectUser(this.user.id!).subscribe({
          next: () => {
            this.showSnackbar('User rejected successfully', 'success');
            this.router.navigate(['/admin/users']);
          },
          error: (err) => {
            console.error('Error rejecting user:', err);
            this.showSnackbar('Failed to reject user', 'error');
          }
        });
      }
    });
  }

  editUser(): void {
    if (!this.user || !this.canEdit) return;
    
    const route = this.authService.isAdmin() 
      ? `/admin/users/edit/${this.user.id}`
      : '/profile/edit';
    
    this.router.navigate([route]);
  }

  // ================ HELPER METHODS ================

  getUserStatus(): string {
    if (!this.user) return 'unknown';
    if (this.user.rejected) return 'rejected';
    if (!this.user.approved && !this.user.enabled) return 'pending';
    if (this.user.approved && !this.user.enabled) return 'disabled';
    if (this.user.approved && this.user.enabled) return 'active';
    return 'unknown';
  }

getUserTypeDisplay(): string {
  if (!this.user?.userType) return 'Unknown';
  
  const typeMap: Record<string, string> = {
    'individual': 'Individual Client',
    'enterprise': 'Enterprise Client', 
    'temporary': 'Temporary Driver',
    'professional': 'Professional Driver',
    'admin': 'Administrator',
    // Handle potential backend variations
    'role_individual': 'Individual Client',
    'role_enterprise': 'Enterprise Client',
    'role_temporary': 'Temporary Driver',
    'role_professional': 'Professional Driver',
    'role_admin': 'Administrator'
  };
  
  const displayType = typeMap[this.user.userType.toLowerCase()];
  return displayType || this.user.userType;
}


  getUserStatusColor(): string {
    const statusColorMap: Record<string, string> = {
      'active': 'primary',
      'pending': 'accent', 
      'disabled': 'warn',
      'rejected': 'warn'
    };
    return statusColorMap[this.getUserStatus()] || '';
  }

  getUserStatusIcon(): string {
    const statusIconMap: Record<string, string> = {
      'active': 'check_circle',
      'pending': 'schedule',
      'disabled': 'block',
      'rejected': 'cancel'
    };
    return statusIconMap[this.getUserStatus()] || 'help';
  }

  isDriverType(): boolean {
    return this.user?.userType === USER_TYPES.PROFESSIONAL || 
           this.user?.userType === USER_TYPES.TEMPORARY;
  }

  isEnterpriseType(): boolean {
    return this.user?.userType === USER_TYPES.ENTERPRISE;
  }

  getFormattedDate(date: Date | string | undefined): string {
    if (!date) return 'Not provided';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  getCompletionRate(): number {
    if (!this.user?.totalDeliveries || this.user.totalDeliveries === 0) return 0;
    return Math.round((this.user.completedDeliveries || 0) / this.user.totalDeliveries * 100);
  }

  showSnackbar(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }

  goBack(): void {
    if (this.authService.isAdmin()) {
      this.router.navigate(['/admin/users']);
    } else {
      this.router.navigate(['/profile']);
    }
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  getCurrentUser() {
    return this.authService.getCurrentUser();
  }
}