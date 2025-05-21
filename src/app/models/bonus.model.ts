// bonus.model.ts
export interface Bonus {
    id: string;
    deliveryPersonId: string;
    amount: number;
    deliveryCount: number;
    startDate: Date;
    endDate: Date;
    status: BonusStatus;
    createdAt?: Date;  // Add this
    paidAt?: Date;
    approvedAt?: Date;
    approvedBy?: string;
    rejectionReason?: string;  // Add this
  }
    
    export enum BonusStatus {
      PENDING = 'PENDING',
      APPROVED = 'APPROVED',
      PAID = 'PAID',
      REJECTED = 'REJECTED'
    }