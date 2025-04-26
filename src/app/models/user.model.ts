// user.model.ts
export interface User {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  dateOfRegistration?: Date;
  roles?: string[];
  vehicleType?: string | null;
  assignedVehicleId?: string | null;
  status?: string;
}

export interface AuthResponse {
  token: string;
  userType: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: string;
  phone?: string;
  address?: string;
  vehicleType?: string;
  assignedVehicleId?: string; // Add this property
}