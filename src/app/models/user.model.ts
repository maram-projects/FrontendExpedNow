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
  }
  
// user.model.ts
export interface AuthResponse {
  token: string;
  userType: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: string;  // Ensure this matches backend response
  phone?: string;
  address?: string;
}