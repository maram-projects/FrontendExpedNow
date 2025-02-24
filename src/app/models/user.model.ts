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
  
  export interface AuthResponse {
    token: string;
    userType: string;
    email: string;
    message?: string;
    error?: string;
  }