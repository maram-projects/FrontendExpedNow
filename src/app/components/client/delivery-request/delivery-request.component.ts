import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DeliveryService } from '../../../services/delivery-service.service';
import { VehicleService } from '../../../services/vehicle-service.service';
import { AuthService } from '../../../services/auth.service';
import { Vehicle } from '../../../models/Vehicle.model';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MapService, PlaceResult } from '../../../services/google-maps-service.service';

declare var bootstrap: any;

@Component({
  selector: 'app-delivery-request',
  templateUrl: './delivery-request.component.html',
  styleUrls: ['./delivery-request.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
  ]
})
export class DeliveryRequestComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pickupAddressInput') pickupAddressInput!: ElementRef;
  @ViewChild('deliveryAddressInput') deliveryAddressInput!: ElementRef;
  
  deliveryForm: FormGroup;
  vehicles: Vehicle[] = [];
  today: Date = new Date();
  minDate: string;
  isSubmitting = false;
  isLoadingVehicles = false;
  successMessage = '';
  errorMessage = '';
  currentFunMessage = '';
  selectedVehicleMaxLoad: number = 0;
  funMessageAnimationState = 'in';
  mapsError = false;
  searchResults: PlaceResult[] = [];
  activeAddressType: 'pickup' | 'delivery' | null = null;
  currentMapModal: any = null;
  
  // Coordinates for distance calculation
  pickupCoordinates: { lat: number, lng: number } | null = null;
  deliveryCoordinates: { lat: number, lng: number } | null = null;
  
  // Distance information
  estimatedDistance: string = '';
  estimatedDuration: string = '';

  // Subscriptions
  private subscriptions: Subscription[] = [];

  readonly funMessages = [
    "Your package deserves a VIP ride! 🚚💨",
    "Fasten your seatbelt, we're going express! 🚀",
    "Delivery in style! ✨",
    "Your package's first-class ticket awaits! 🎫",
    "Zoom zoom! Your delivery is on its way! 🏎️",
    "Hold tight, we're speeding up! ⚡",
    "Your package is in good hands! 🤲",
    "We deliver smiles along with packages! 😊",
    "Your delivery is our mission! 🎯",
    "Let's make your package fly! ✈️"
  ];

  private funMessageInterval: any;

  constructor(
    private fb: FormBuilder,
    private deliveryService: DeliveryService,
    private vehicleService: VehicleService,
    private authService: AuthService,
    private mapService: MapService,
    private router: Router
  ) {
    this.minDate = this.today.toISOString().split('T')[0];
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
    
    this.deliveryForm = this.fb.group({
      pickupAddress: ['', Validators.required],
      deliveryAddress: ['', Validators.required],
      packageDescription: ['', Validators.required],
      packageWeight: [null, [Validators.required, Validators.min(0.1)]],
      vehicleId: [{value: '', disabled: true}, Validators.required],
      scheduledDate: [tomorrowFormatted, Validators.required],
      additionalInstructions: ['']
    });
    
    this.currentFunMessage = this.funMessages[Math.floor(Math.random() * this.funMessages.length)];
  }

  ngOnInit(): void {
    this.loadAvailableVehicles();
    
    // Change fun message every 5 seconds
    this.funMessageInterval = setInterval(() => {
      this.funMessageAnimationState = 'out';
      setTimeout(() => {
        this.currentFunMessage = this.funMessages[Math.floor(Math.random() * this.funMessages.length)];
        this.funMessageAnimationState = 'in';
      }, 500);
    }, 5000);

    // Listen for vehicle selection
    const vehicleSub = this.vehicleService.selectedVehicle$.subscribe(vehicle => {
      if (vehicle && vehicle.id) {
        this.selectedVehicleMaxLoad = vehicle.maxLoad;
        this.deliveryForm.get('vehicleId')?.enable();
        this.deliveryForm.get('vehicleId')?.setValue(vehicle.id);
        
        // Update weight validators
        const packageWeightControl = this.deliveryForm.get('packageWeight');
        packageWeightControl?.setValidators([
          Validators.required,
          Validators.min(0.1),
          Validators.max(vehicle.maxLoad)
        ]);
        packageWeightControl?.updateValueAndValidity();
      }
    });
    this.subscriptions.push(vehicleSub);
    
    // Weight validation when vehicle changes
    const vehicleIdSub = this.deliveryForm.get('vehicleId')?.valueChanges.subscribe(vehicleId => {
      const selectedVehicle = this.vehicles.find(v => v.id === vehicleId);
      if (selectedVehicle) {
        this.selectedVehicleMaxLoad = selectedVehicle.maxLoad;
        const packageWeightControl = this.deliveryForm.get('packageWeight');
        packageWeightControl?.setValidators([
          Validators.required,
          Validators.min(0.1),
          Validators.max(selectedVehicle.maxLoad)
        ]);
        packageWeightControl?.updateValueAndValidity();
      }
    });
    if (vehicleIdSub) this.subscriptions.push(vehicleIdSub);
    
    this.subscriptions.push(
      this.mapService.selectedAddress$.subscribe(result => {
        if (this.activeAddressType && result) {
          this.updateAddress(this.activeAddressType, result);
        }
      })
    );
  }

  ngAfterViewInit() {
    this.initializeAddressInputs();
  }

  private initializeAddressInputs(): void {
    this.setupAddressInput('pickup');
    this.setupAddressInput('delivery');
  }

  private setupAddressInput(type: 'pickup' | 'delivery'): void {
    const input = this[`${type}AddressInput`].nativeElement;
    
    input.addEventListener('input', (e: Event) => {
      const query = (e.target as HTMLInputElement).value;
      if (query.length > 2) {
        this.mapService.searchAddress(query).subscribe(results => {
          this.searchResults = results;
          this.activeAddressType = type;
        });
      }
    });
  }

  openMapModal(type: 'pickup' | 'delivery'): void {
    this.activeAddressType = type;
    const modalId = `${type}MapModal`;
    const modalElement = document.getElementById(modalId);
    
    if (modalElement) {
      this.currentMapModal = new bootstrap.Modal(modalElement);
      
      modalElement.addEventListener('shown.bs.modal', () => {
        const mapContainer = modalElement.querySelector('.map-container');
        if (mapContainer) {
          const currentCoords = this[`${type}Coordinates`];
          const coords = currentCoords ? 
            [currentCoords.lat, currentCoords.lng] as L.LatLngExpression : 
            undefined;
          
            const mapContainer = modalElement.querySelector('.map-container') as HTMLElement;
            if (mapContainer) {
              this.mapService.initializeMap(mapContainer, coords);
            }
                      this.mapService.setupMapInteraction(type);
        }
      });

      modalElement.addEventListener('hidden.bs.modal', () => {
        this.mapService.cleanupMap();
      });

      this.currentMapModal.show();
    }
  }

  selectSearchResult(result: PlaceResult): void {
    if (!this.activeAddressType) return;
    
    this.updateAddress(this.activeAddressType, result);
    this.searchResults = [];
    
    if (this.currentMapModal) {
      this.currentMapModal.hide();
    }
  }

  private updateAddress(type: 'pickup' | 'delivery', result: PlaceResult): void {
    const control = this.deliveryForm.get(`${type}Address`);
    if (control) {
      control.setValue(result.address);
      control.markAsTouched();
    }

    this[`${type}Coordinates`] = { 
      lat: result.latitude, 
      lng: result.longitude 
    };

    this.calculateDistance();
  }

  private calculateDistance(): void {
    if (!this.pickupCoordinates || !this.deliveryCoordinates) return;

    const pickup: [number, number] = [this.pickupCoordinates.lat, this.pickupCoordinates.lng];
    const delivery: [number, number] = [this.deliveryCoordinates.lat, this.deliveryCoordinates.lng];
    
    const distance = this.mapService.calculateDistance(pickup, delivery);
    this.estimatedDistance = `${distance.toFixed(1)} km`;
    this.estimatedDuration = `${Math.round(distance * 15)} min`; // 15min par km
  }

  ngOnDestroy() {
    if (this.funMessageInterval) {
      clearInterval(this.funMessageInterval);
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Form Submission
  onSubmit(): void {
    if (this.deliveryForm.invalid) {
      this.markFormGroupTouched(this.deliveryForm);
      return;
    }

    this.isSubmitting = true;
    const formValue = {...this.deliveryForm.getRawValue()};
    const clientId = this.authService.getCurrentUser()?.userId;

    if (!clientId) {
      this.handleSubmissionError('User not authenticated');
      return;
    }

    this.addDistanceInfoToInstructions(formValue);
    
    const deliveryRequest = { ...formValue, clientId };
    this.submitDeliveryRequest(deliveryRequest);
  }

  private addDistanceInfoToInstructions(formValue: any): void {
    if (this.estimatedDistance && this.estimatedDuration) {
      const distanceInfo = `\n\nEstimated distance: ${this.estimatedDistance}, duration: ${this.estimatedDuration}`;
      formValue.additionalInstructions = formValue.additionalInstructions 
        ? formValue.additionalInstructions + distanceInfo 
        : distanceInfo;
    }
  }

  private submitDeliveryRequest(deliveryRequest: any): void {
    this.deliveryService.createDeliveryRequest(deliveryRequest).subscribe({
      next: () => this.handleSubmissionSuccess(),
      error: (err) => this.handleSubmissionError(err.error?.message || 'Failed to create delivery request')
    });
  }

  private handleSubmissionSuccess(): void {
    this.successMessage = 'Delivery request created successfully!';
    this.loadAvailableVehicles();
    setTimeout(() => this.router.navigate(['/client/orders']), 2000);
  }

  private handleSubmissionError(error: string): void {
    this.errorMessage = error;
    this.isSubmitting = false;
  }

  // Helper Methods
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  private loadAvailableVehicles(): void {
    this.isLoadingVehicles = true;
    this.vehicleService.getAvailableVehicles().subscribe({
      next: (vehicles) => this.handleVehicleResponse(vehicles),
      error: (err) => this.handleVehicleError(err)
    });
  }

  private handleVehicleResponse(vehicles: Vehicle[]): void {
    this.vehicles = vehicles;
    this.isLoadingVehicles = false;
    this.deliveryForm.get('vehicleId')?.[vehicles.length ? 'enable' : 'disable']();
    
    const currentVehicleId = this.deliveryForm.get('vehicleId')?.value;
    if (currentVehicleId && !vehicles.some(v => v.id === currentVehicleId)) {
      this.deliveryForm.get('vehicleId')?.reset();
    }
  }

  private handleVehicleError(err: any): void {
    console.error('Error loading vehicles:', err);
    this.errorMessage = 'Failed to load available vehicles. Please try again later.';
    this.isLoadingVehicles = false;
    this.deliveryForm.get('vehicleId')?.disable();
  }
}