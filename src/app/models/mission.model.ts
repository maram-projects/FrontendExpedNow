// src/app/models/mission.model.ts
export interface Mission {
    id: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    startTime: Date;
    endTime?: Date;
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