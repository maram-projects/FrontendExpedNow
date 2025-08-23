export interface Payment {
    id: string; 
  deliveryId?: string | null;
  clientId: string;
  amount: number;
  originalAmount?: number;
  finalAmountAfterDiscount: number;
  method: PaymentMethod | string;
  status: PaymentStatus | string;
  transactionId?: string;
  paymentDate?: Date | string;
  receiptUrl?: string;
  cardLast4?: string;
  cardBrand?: string;
  deliveryDate?: Date | string;
  customerTip?: number;
  bankName?: string;
  bankReference?: string;
  discountId?: string;
  discountAmount?: number;
  discountCode?: string;
  clientSecret?: string;
  createdAt?: Date;
   deliveryPersonPaidAt?: Date | string;
  updatedAt?: Date;
  invoiceUrl?: string;
  deliveryPersonId?: string | null;
  deliveryPersonPaid?: boolean ;
  deliveryPersonShare?: number;
  convertedAmount?: number;
  exchangeRate?: number;
  convertedCurrency?: string;
  currency?: string;
 deliveryPerson?: {
    id: string;
    fullName: string;
    phone?: string;
    email?: string;
    vehicle?: {
      type: string;
      licensePlate?: string;
    };
  } | null; 
}
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  PENDING_DELIVERY = 'PENDING_DELIVERY',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}
export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  WALLET = 'WALLET'
}

export interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  icon: string;
  description: string;
  available: boolean;
}