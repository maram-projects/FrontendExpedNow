// src/app/models/discount.model.ts
export interface Discount {
  id?: string;
  code?: string;
  clientId?: string;
  description?: string;
  type?: DiscountType;
  
  // For percentage discounts
  percentage?: number;
  
  // For fixed amount discounts
  fixedAmount?: number;
  
  // Validity period
  validFrom?: Date;
  validUntil?: Date;
  
  // Usage tracking
  used?: boolean;
  usedAt?: Date;
  usedForOrderId?: string;
  
  // Audit fields
  createdAt?: Date;
  updatedAt?: Date;
}

// src/app/models/discount-type.enum.ts
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  LOYALTY = 'LOYALTY',
  PROMOTIONAL = 'PROMOTIONAL'
}

// src/app/models/discount-request.dto.ts
export interface CreateDiscountRequest {
  code?: string;
  clientId?: string;
  description?: string;
  type: DiscountType;
  percentage?: number;
  fixedAmount?: number;
  validFrom?: Date;
  validUntil?: Date;
}

export interface ValidateDiscountRequest {
  code: string;
  clientId: string;
}

export interface UseDiscountRequest {
  code: string;
  clientId: string;
  orderId: string;
}