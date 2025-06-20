export interface Payment {
  id: string;
  deliveryId?: string;
  clientId: string;
  amount: number;
  finalAmountAfterDiscount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  paymentDate?: Date;
  receiptUrl?: string;
  cardLast4?: string;
  cardBrand?: string;
  bankName?: string;
  bankReference?: string;
  discountId?: string;
  discountAmount?: number;
  discountCode?: string;
  clientSecret?: string; // For Stripe payments
  createdAt?: Date;
  updatedAt?: Date;
    invoiceUrl?: string;  // Add this
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