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
    photoPath?: string | null;
    available: boolean;
    maxLoad: number; // Added maxLoad property
  }