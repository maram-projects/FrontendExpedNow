export interface Mission {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startTime: string | number[]; // Remove Date and null from here
  endTime?: string | number[];  // Remove Date and null from here
  deliveryRequest: {
    pickupAddress: string;
    deliveryAddress: string;
    status: string;
  };
  deliveryPerson: {
    id: string;
    firstName: string;
    lastName: string;
  };
  notes?: string;
}

export interface MissionViewModel extends Mission {
  parsedStartTime?: Date | null;
  parsedEndTime?: Date | null;
}