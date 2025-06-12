// Vehicle.model.ts
export enum VehicleType {
  CAR = 'CAR',
  TRUCK = 'TRUCK',
  MOTORCYCLE = 'MOTORCYCLE'
}

export interface Vehicle {
  id?: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vehicleType: VehicleType;
  available: boolean;
  photoPath?: string;
  maxLoad: number;
}

export interface VehicleStatistics {
  totalTrips: number;
  totalDistance: number;
  lastUsed: Date | null;
  utilizationRate: number;
}

// This helps with mapping between backend DTO fields and frontend model
export interface VehicleDTO {
 id?: string;
  vehicleType: VehicleType;
  vehicleBrand: string;       // maps to 'make'
  vehicleModel: string;       // maps to 'model'
  vehiclePlateNumber: string; // maps to 'licensePlate'
  vehicleYear: number;
  vehicleCapacityKg: number;
  available: boolean;
  vehicleColor?: string;
  vehicleVolumeM3?: number;
  vehicleHasFridge?: boolean;
  vehiclePhotoUrl?: string;
  vehicleInsuranceExpiry?: Date;
  vehicleInspectionExpiry?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  color?: string;
}
// Functions to convert between DTO and frontend model
// In Vehicle.model.ts
export function convertDtoToVehicle(dto: VehicleDTO | null | undefined): Vehicle | null {
  if (!dto) return null;
  
  return {
    id: dto.id,
    make: dto.vehicleBrand || 'Unknown', // Handle potential undefined
    model: dto.vehicleModel || 'Unknown',
    year: dto.vehicleYear,
    licensePlate: dto.vehiclePlateNumber || 'N/A',
    vehicleType: dto.vehicleType,
    available: dto.available !== false, // Default to true if not specified
    photoPath: dto.vehiclePhotoUrl,
    maxLoad: dto.vehicleCapacityKg || 0
  };
}
export function convertVehicleToDto(vehicle: Vehicle): VehicleDTO {
  if (!vehicle) {
    throw new Error('Vehicle cannot be null or undefined');
  }

  return {
    id: vehicle.id,
    vehicleBrand: vehicle.make,
    vehicleModel: vehicle.model,
    vehicleYear: vehicle.year,
    vehiclePlateNumber: vehicle.licensePlate,
    vehicleType: vehicle.vehicleType,
    vehicleCapacityKg: vehicle.maxLoad,
    available: vehicle.available,
    vehiclePhotoUrl: vehicle.photoPath
  };
}

// Utility function to validate vehicle data
export function isValidVehicle(vehicle: Partial<Vehicle>): vehicle is Vehicle {
  return !!(
    vehicle.make &&
    vehicle.model &&
    vehicle.year &&
    vehicle.year > 1900 &&
    vehicle.year <= new Date().getFullYear() + 2 &&
    vehicle.licensePlate &&
    vehicle.vehicleType &&
    Object.values(VehicleType).includes(vehicle.vehicleType) &&
    typeof vehicle.available === 'boolean' &&
    typeof vehicle.maxLoad === 'number' &&
    vehicle.maxLoad >= 0
  );
}

// Helper function to create a new vehicle with default values
export function createDefaultVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    make: 'Unknown',
    model: 'Unknown',
    year: new Date().getFullYear(),
    licensePlate: 'N/A',
    vehicleType: VehicleType.CAR,
    available: true,
    maxLoad: 0,
    ...overrides
  };
}