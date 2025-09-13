// Updated mission.model.ts
export interface Mission {
  deliveryPersonId: string;
  assignedAt: any;
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startTime: string | number[];
  endTime?: string | number[];
  deliveryRequest: {
    id: string;
    clientId: string; // Make sure this exists
    packageDescription: any;
    pickupAddress: string;
    deliveryAddress: string;
    status: string;
    // Add client information
    client?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  };
  deliveryPerson: {
    name: any;
    id: string;
    firstName: string;
    lastName: string;
  };
  notes?: string;
  // Add client info directly at mission level for easier access
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

export interface MissionViewModel extends Mission {
  parsedStartTime?: Date | null;
  parsedEndTime?: Date | null;
}