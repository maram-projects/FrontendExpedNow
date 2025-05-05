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
  vehicleColor?: string;
  vehicleYear: number;        // maps to 'year'
  vehicleCapacityKg: number;  // maps to 'maxLoad'
  vehicleVolumeM3?: number;
  vehicleHasFridge?: boolean;
  vehiclePhotoUrl?: string;   // maps to 'photoPath'
  vehicleInsuranceExpiry?: Date;
  vehicleInspectionExpiry?: Date;
  available: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Functions to convert between DTO and frontend model
export function convertDtoToVehicle(dto: VehicleDTO): Vehicle {
  return {
    id: dto.id,
    make: dto.vehicleBrand,
    model: dto.vehicleModel,
    year: dto.vehicleYear,
    licensePlate: dto.vehiclePlateNumber,
    vehicleType: dto.vehicleType,
    available: dto.available,
    photoPath: dto.vehiclePhotoUrl,
    maxLoad: dto.vehicleCapacityKg
  };
}

export function convertVehicleToDto(vehicle: Vehicle): VehicleDTO {
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