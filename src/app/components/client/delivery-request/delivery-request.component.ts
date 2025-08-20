import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DeliveryService, ImageAnalysisResponse } from '../../../services/delivery-service.service';
import { VehicleService } from '../../../services/vehicle-service.service';
import { AuthService } from '../../../services/auth.service';
import { Vehicle } from '../../../models/Vehicle.model';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MapService, PlaceResult } from '../../../services/google-maps-service.service';

declare var bootstrap: any;
declare var L: any; // For Leaflet

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


      // Add this new property
  imageQuality: string | null = null;
  
  // Existing properties
  analysisResult: ImageAnalysisResponse | null = null;
  weightFromImage: number | null = null;

  packageTypeFromImage: string | null = null;
  phoneNumberFromImage: string | null = null;
  isAnalyzingImage = false;
  
  @ViewChild('pickupAddressInput') pickupAddressInput!: ElementRef;
  @ViewChild('deliveryAddressInput') deliveryAddressInput!: ElementRef;
  @ViewChild('imageInput') imageInput!: ElementRef;
  
  deliveryForm: FormGroup;
  packageTypes = [
    { value: 'SMALL', label: 'Small Package' },
    { value: 'MEDIUM', label: 'Medium Package' },
    { value: 'LARGE', label: 'Large Package' },
    { value: 'FRAGILE', label: 'Fragile Package' },
    { value: 'HEAVY', label: 'Heavy Package' }
  ];
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
  
  // Image handling properties
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  imageError: string = '';
  maxImageSize = 5 * 1024 * 1024; // 5MB
  allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
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
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    this.deliveryForm = this.fb.group({
      pickupAddress: ['', Validators.required],
      deliveryAddress: ['', Validators.required],
      packageDescription: ['', Validators.required],
      packageWeight: [null, [Validators.required, Validators.min(0.1)]],
      vehicleId: [''], // Optional
      scheduledDate: ['', Validators.required],
      additionalInstructions: [''],
      packageType: ['', Validators.required],
      // Optional recipient information
      recipientName: [''],
      recipientPhone: [''],
      specialInstructions: [''],
      priority: ['NORMAL'] // Default priority
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

    // Listen for vehicle selection (optional)
    const vehicleSub = this.vehicleService.selectedVehicle$.subscribe(vehicle => {
      if (vehicle && vehicle.id) {
        this.selectedVehicleMaxLoad = vehicle.maxLoad;
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
      if (vehicleId) {
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
      }
    });
    if (vehicleIdSub) this.subscriptions.push(vehicleIdSub);
    
    // Subscribe to map service for address selection
    this.subscriptions.push(
      this.mapService.selectedAddress$.subscribe(result => {
        if (this.activeAddressType && result) {
          this.updateAddress(this.activeAddressType, result);
        }
      })
    );
  }

  ngAfterViewInit(): void {
    this.initializeAddressInputs();
  }

  ngOnDestroy(): void {
    if (this.funMessageInterval) {
      clearInterval(this.funMessageInterval);
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeAddressInputs(): void {
    this.setupAddressInput('pickup');
    this.setupAddressInput('delivery');
  }

  private setupAddressInput(type: 'pickup' | 'delivery'): void {
    const input = this[`${type}AddressInput`]?.nativeElement;
    if (!input) return;
    
    input.addEventListener('input', (e: Event) => {
      const query = (e.target as HTMLInputElement).value;
      if (query.length > 2) {
        this.mapService.searchAddress(query).subscribe({
          next: (results) => {
            this.searchResults = results;
            this.activeAddressType = type;
          },
          error: (err) => {
            console.error('Address search error:', err);
            this.searchResults = [];
          }
        });
      } else {
        this.searchResults = [];
      }
    });
  }

  // Image handling methods
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.validateAndSetImage(file);
    }
  }

  private validateAndSetImage(file: File): void {
    this.imageError = '';
    
    // Check file type
    if (!this.allowedImageTypes.includes(file.type)) {
      this.imageError = 'Please select a valid image file (JPEG, PNG, GIF, or WebP)';
      this.clearImageSelection();
      return;
    }
    
    // Check file size
    if (file.size > this.maxImageSize) {
      this.imageError = 'Image size must be less than 5MB';
      this.clearImageSelection();
      return;
    }
    
    this.selectedImage = file;
    this.createImagePreview(file);
    this.analyzeImage(file);
  }

  private createImagePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.clearImageSelection();
    if (this.imageInput) {
      this.imageInput.nativeElement.value = '';
    }
    // Reset analysis results
    this.analysisResult = null;
    this.weightFromImage = null;
    this.packageTypeFromImage = null;
    this.phoneNumberFromImage = null;
  }

  private clearImageSelection(): void {
    this.selectedImage = null;
    this.imagePreview = null;
    this.imageError = '';
  }

private analyzeImage(file: File): void {
  this.isAnalyzingImage = true;
  this.imageError = '';
  
  this.deliveryService.extractTextFromImage(file).subscribe({
    next: (response) => {
      console.log('Full analysis response:', response);
      this.analysisResult = response;
      
      // Use camelCase property names
  this.imageQuality = response.delivery_relevant_info?.image_quality ?? 
                   response.image_quality ?? 
                   null;

      this.applyAnalysisToForm(response);
      this.isAnalyzingImage = false;
    },
    error: (err) => {
      console.error('Image analysis error:', err);
      this.imageError = 'Failed to analyze image. Please try again.';
      this.isAnalyzingImage = false;
    }
  });
}

private applyAnalysisToForm(response: ImageAnalysisResponse): void {
  // Use camelCase properties instead of snake_case
   const fullText = response?.analysis?.text_extraction?.full_text || 
                  response?.extracted_text || 
                  '';

  if (fullText) {
    this.detectWeightFromText(fullText);
    this.detectPackageTypeFromText(fullText);
    this.detectPhoneNumberFromText(fullText);
  }
}

  private detectWeightFromText(text: string): void {
    const weightRegex = /(\d+[\.,]?\d*)\s*(?:kg|KG|كجم|kilogram)/gi;
    const matches = text.match(weightRegex);
    
    if (matches && matches.length > 0) {
      const weightStr = matches[0].replace(/[^\d\.,]/g, '').replace(',', '.');
      const weightNum = parseFloat(weightStr);
      
      if (!isNaN(weightNum) && weightNum > 0) {
        this.weightFromImage = weightNum;
        this.deliveryForm.get('packageWeight')?.setValue(weightNum);
      }
    }
  }

  private detectPackageTypeFromText(text: string): void {
    const fragileKeywords = ['fragile', 'هش', 'fragile box', 'delicate', 'حساس', 'breakable', 'زجاج', 'glass'];
    const lowerText = text.toLowerCase();
    
    for (const keyword of fragileKeywords) {
      if (lowerText.includes(keyword)) {
        this.packageTypeFromImage = 'FRAGILE';
        this.deliveryForm.get('packageType')?.setValue('FRAGILE');
        return;
      }
    }
  }

  private detectPhoneNumberFromText(text: string): void {
    // Multiple phone number patterns
    const phonePatterns = [
      /(\+?966\d{9})/g,        // Saudi Arabia
      /(\+?971\d{9})/g,        // UAE
      /(\+?216\d{8})/g,        // Tunisia
      /(05\d{8})/g,            // Local Saudi format
      /(\d{3}[-\.\s]?\d{3}[-\.\s]?\d{4})/g, // General format
      /(\(\d{3}\)\s*\d{3}[-\.\s]?\d{4})/g   // Format with parentheses
    ];
    
    for (const pattern of phonePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        this.phoneNumberFromImage = matches[0];
        this.deliveryForm.get('recipientPhone')?.setValue(matches[0]);
        return;
      }
    }
  }

  // Apply detected values to form
  applyDetections(): void {
    if (this.weightFromImage) {
      this.deliveryForm.get('packageWeight')?.setValue(this.weightFromImage);
    }
    if (this.phoneNumberFromImage) {
      this.deliveryForm.get('recipientPhone')?.setValue(this.phoneNumberFromImage);
    }
    if (this.packageTypeFromImage) {
      this.deliveryForm.get('packageType')?.setValue(this.packageTypeFromImage);
    }
  }

  // Map handling methods
  openMapModal(type: 'pickup' | 'delivery'): void {
    this.activeAddressType = type;
    const modalId = `${type}MapModal`;
    const modalElement = document.getElementById(modalId);
    
    if (modalElement) {
      this.currentMapModal = new bootstrap.Modal(modalElement);
      
      modalElement.addEventListener('shown.bs.modal', () => {
        const mapContainer = modalElement.querySelector('.map-container') as HTMLElement;
        if (mapContainer) {
          const currentCoords = this[`${type}Coordinates`];
          const coords = currentCoords ? 
            [currentCoords.lat, currentCoords.lng] as [number, number] : 
            undefined;
          
          this.mapService.initializeMap(mapContainer, coords);
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
    this.estimatedDuration = `${Math.round(distance * 3)} min`; // Approx 3 min per km
  }

  // Form submission methods
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
    
    // Create delivery request object
    const deliveryRequest = { 
      ...formValue, 
      clientId,
      status: 'PENDING'
    };
    
    // Add coordinates if available
    if (this.pickupCoordinates) {
      deliveryRequest.pickupLatitude = this.pickupCoordinates.lat;
      deliveryRequest.pickupLongitude = this.pickupCoordinates.lng;
    }
    
    if (this.deliveryCoordinates) {
      deliveryRequest.deliveryLatitude = this.deliveryCoordinates.lat;
      deliveryRequest.deliveryLongitude = this.deliveryCoordinates.lng;
    }
    
    // Handle recipient information
    if (formValue.recipientName || formValue.recipientPhone) {
      deliveryRequest.recipient = {
        firstName: formValue.recipientName || '',
        lastName: '',
        phone: formValue.recipientPhone || ''
      };
    }
    
    // Choose submission method based on whether image is selected
    if (this.selectedImage) {
      this.submitWithImage(deliveryRequest);
    } else {
      this.submitWithoutImage(deliveryRequest);
    }
  }

  private submitWithImage(deliveryRequest: any): void {
    console.log('Submitting delivery request with image:', deliveryRequest);
    
    this.deliveryService.createDeliveryRequestWithImage(deliveryRequest, this.selectedImage!).subscribe({
      next: (response) => {
        console.log('Delivery request with image created successfully:', response);
        this.handleSubmissionSuccess();
      },
      error: (err) => {
        console.error('Delivery request with image failed:', err);
        this.handleSubmissionError(err.message || 'Failed to create delivery request with image');
      }
    });
  }

  private submitWithoutImage(deliveryRequest: any): void {
    console.log('Submitting delivery request without image:', deliveryRequest);
    
    this.deliveryService.createDeliveryRequest(deliveryRequest).subscribe({
      next: (response) => {
        console.log('Delivery request created successfully:', response);
        this.handleSubmissionSuccess();
      },
      error: (err) => {
        console.error('Delivery request failed:', err);
        this.handleSubmissionError(err.message || 'Failed to create delivery request');
      }
    });
  }

  private addDistanceInfoToInstructions(formValue: any): void {
    if (this.estimatedDistance && this.estimatedDuration) {
      const distanceInfo = `\n\nEstimated distance: ${this.estimatedDistance}, duration: ${this.estimatedDuration}`;
      formValue.additionalInstructions = formValue.additionalInstructions 
        ? formValue.additionalInstructions + distanceInfo 
        : distanceInfo;
    }
  }

  private handleSubmissionSuccess(): void {
    this.successMessage = 'Delivery request created successfully!';
    this.errorMessage = '';
    this.isSubmitting = false;
    
    // Reset form and image
    this.deliveryForm.reset();
    this.clearImageSelection();
    if (this.imageInput) {
      this.imageInput.nativeElement.value = '';
    }
    
    // Reset analysis results
    this.analysisResult = null;
    this.weightFromImage = null;
    this.packageTypeFromImage = null;
    this.phoneNumberFromImage = null;
    
    // Reset coordinates
    this.pickupCoordinates = null;
    this.deliveryCoordinates = null;
    this.estimatedDistance = '';
    this.estimatedDuration = '';
    
    // Reload vehicles
    this.loadAvailableVehicles();
    
    // Navigate to orders page after delay
    setTimeout(() => {
      this.router.navigate(['/client/orders']);
    }, 2000);
  }

  private handleSubmissionError(error: string): void {
    this.errorMessage = error;
    this.successMessage = '';
    this.isSubmitting = false;
  }

  // Helper methods
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
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
    
    const currentVehicleId = this.deliveryForm.get('vehicleId')?.value;
    if (currentVehicleId && !vehicles.some(v => v.id === currentVehicleId)) {
      this.deliveryForm.get('vehicleId')?.reset();
    }
  }

  private handleVehicleError(err: any): void {
    console.error('Error loading vehicles:', err);
    this.errorMessage = 'Failed to load available vehicles. Please try again later.';
    this.isLoadingVehicles = false;
  }

  // Utility methods for template
  getImageSizeInMB(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(2);
  }

  isImageTooLarge(file: File): boolean {
    return file.size > this.maxImageSize;
  }

  isValidImageType(file: File): boolean {
    return this.allowedImageTypes.includes(file.type);
  }

  // Getters for template
  get hasAnalysisResults(): boolean {
    return this.weightFromImage !== null || this.phoneNumberFromImage !== null || this.packageTypeFromImage !== null;
  }

  get isFormValid(): boolean {
    return this.deliveryForm.valid;
  }

  get canSubmit(): boolean {
    return this.isFormValid && !this.isSubmitting && !this.isAnalyzingImage;
  }
}