// discount.model.ts
export interface Discount {
    id: string;
    code: string;
    clientId: string;
    percentage: number;
    value?: number; // Alias for percentage for backward compatibility
    name?: string;  // Alias for description
    description: string;
    validFrom: Date;
    validUntil: Date;
    type: DiscountType;
    used: boolean;
    usedAt?: Date;
    usedForOrderId?: string;
    createdAt: Date;
  }
    export enum DiscountType {
      LOYALTY = 'LOYALTY',
      PROMOTIONAL = 'PROMOTIONAL',
      SPECIAL_EVENT = 'SPECIAL_EVENT',
      WELCOME = 'WELCOME',
      REFERRAL = 'REFERRAL'
    }