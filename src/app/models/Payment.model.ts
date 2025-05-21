// payment.model.ts
export interface Payment {
    id: string;
    deliveryId: string;
    clientId: string;
    amount: number;
    finalAmountAfterDiscount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId?: string;
    paymentDate: Date;
    receiptUrl?: string;
    cardLast4?: string;
    cardBrand?: string;
    bankName?: string;
    bankReference?: string;
    discountId?: string;
    discountAmount?: number;
  }
  
  export enum PaymentStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
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