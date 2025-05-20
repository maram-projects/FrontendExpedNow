import { Vehicle } from "./Vehicle.model";

export interface User {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  phone: string;
  address: string;
  dateOfRegistration?: Date;
  
  // Enterprise fields
  companyName?: string;
  businessType?: string;
  vatNumber?: string;
  businessPhone?: string;
  businessAddress?: string;
  deliveryRadius?: number;
  
  // Vehicle fields
  vehicleType?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehiclePlateNumber?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  vehicleCapacityKg?: number;
  vehicleVolumeM3?: number;
  vehicleHasFridge?: boolean;
  vehiclePhotoUrl?: string;
  vehicleInsuranceExpiry?: Date;
  vehicleInspectionExpiry?: Date;
  
  // Professional fields
  driverLicenseNumber?: string;
  driverLicenseCategory?: string;
  driverLicenseIssueDate?: Date;
  driverLicenseExpiryDate?: Date;
  identityPhotoUrl?: string;
  criminalRecordDocumentUrl?: string;
  medicalCertificateUrl?: string;
  preferredZones?: string;
  availabilitySchedule?: string;
  hasCompanyAffiliation?: boolean;
  
  // Account status
  verified?: boolean;
  approved?: boolean;
  enabled?: boolean;
  available?: boolean;
  
  // Performance metrics
  rating?: number;
  completedDeliveries?: number;
  lastActive?: Date;
  successScore?: number;
  totalDeliveries?: number;
  averageDeliveryTime?: number;

  assignedVehicleId?: string;
  assignedVehicle?: Vehicle;
  
  // Roles
  roles?: string[];
  userType?: string;
}

export interface AuthResponse {
  token: string;
  userType: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  companyName?: string;
  vehicleType?: string;
  assignedVehicleId?: string;
  approved?: boolean;
  enabled?: boolean;
}

export const USER_TYPES = {
  INDIVIDUAL: 'individual',
  ENTERPRISE: 'enterprise',
  TEMPORARY: 'temporary',
  PROFESSIONAL: 'professional',
  ADMIN: 'admin'
};

export const USER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  REJECTED: 'rejected'
};

export const VEHICLE_TYPES = [
  { value: 'MOTORCYCLE', display: 'Moto' },
  { value: 'CAR', display: 'Voiture' },
  { value: 'TRUCK', display: 'Camion' },
  { value: 'VAN', display: 'Camionnette' },
  { value: 'BICYCLE', display: 'Vélo' }
];

export const BUSINESS_TYPES = [
  { value: 'restaurant', display: 'Restaurant' },
  { value: 'retail', display: 'Commerce de détail' },
  { value: 'service', display: 'Service' },
  { value: 'manufacturing', display: 'Fabrication' },
  { value: 'other', display: 'Autre' }
];