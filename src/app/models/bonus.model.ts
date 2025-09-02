// bonus.model.ts

export interface Bonus {
  id: string;
  deliveryPersonId: string;
  amount: number;
  deliveryCount: number;
  startDate: Date;
  endDate: Date;
  status: BonusStatus;
  // Add these new properties
  description?: string;
  criteria?: string;
  type?: string; // or use bonusType if you prefer
  // Audit fields
  createdAt?: Date;
  updatedAt?: Date; // Add this for tracking updates
  paidAt?: Date;
  rejectedAt?: Date; // Add this for tracking rejection time
  
  // Additional tracking fields
  paidBy?: string; // Add this to track who processed payment
  rejectedBy?: string; // Add this to track who rejected
  rejectionReason?: string;
  
  // Optional fields that might come from API
  reason?: string; // Description/reason for the bonus
  deliveryId?: string; // Link to specific delivery if applicable
  bonusType?: string; // Type of bonus (performance, milestone, etc.)
  
  // Delivery person info (might be populated in some API responses)
  deliveryPersonName?: string;
  deliveryPersonEmail?: string;
  
  // Additional metadata
  notes?: string; // Any additional notes
  isActive?: boolean; // To track if bonus is still active
}

export enum BonusStatus {
  CREATED = 'CREATED',    // Bonus created by admin, ready for payment
  PAID = 'PAID',          // Bonus has been paid to delivery person
  REJECTED = 'REJECTED'   // Bonus has been rejected/cancelled
}

// Additional interfaces for bonus operations
export interface CreateBonusRequest {
  deliveryPersonId: string;
  amount: number;
  reason: string;
  deliveryCount?: number;
  startDate?: string | Date | undefined;  // Allow undefined
  endDate?: string | Date | undefined;    // Allow undefined
  deliveryId?: string;
  bonusType?: string;
  type?: string;
  notes?: string;
  description?: string;
  criteria?: string;
}

export interface UpdateBonusRequest {
  amount?: number;
  reason?: string;
  deliveryCount?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  notes?: string;
}

export interface BonusFilter {
  status?: BonusStatus;
  deliveryPersonId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  minAmount?: number;
  maxAmount?: number;
  bonusType?: string;
}

// bonus.model.ts
export interface BonusSummary {
  totalBonuses: number;
  totalAmount: number;
  createdCount: number;    // Changed from pendingCount
  paidCount: number;       // Changed from approvedCount
  rejectedCount: number;
  // Update these amount properties if needed
  createdAmount?: number;  // Changed from pendingAmount
  paidAmount?: number;     // Changed from approvedAmount
  rejectedAmount?: number;
}
// Utility functions for bonus operations
export class BonusUtils {
  
  /**
   * Check if bonus can be paid
   */
  static canPay(bonus: Bonus): boolean {
    return bonus.status === BonusStatus.CREATED;
  }
  
  /**
   * Check if bonus can be rejected
   */
  static canReject(bonus: Bonus): boolean {
    return bonus.status === BonusStatus.CREATED;
  }
  
  /**
   * Check if bonus can be cancelled
   */
  static canCancel(bonus: Bonus): boolean {
    return bonus.status !== BonusStatus.PAID;
  }
  
  /**
   * Get bonus status display text
   */
  static getStatusText(status: BonusStatus): string {
    switch (status) {
      case BonusStatus.CREATED:
        return 'مُنشأ / Created';
      case BonusStatus.PAID:
        return 'مدفوع / Paid';
      case BonusStatus.REJECTED:
        return 'مرفوض / Rejected';
      default:
        return 'غير معروف / Unknown';
    }
  }
  
  /**
   * Get bonus status color class for UI
   */
  static getStatusColorClass(status: BonusStatus): string {
    switch (status) {
      case BonusStatus.CREATED:
        return 'text-warning bg-warning-light';
      case BonusStatus.PAID:
        return 'text-success bg-success-light';
      case BonusStatus.REJECTED:
        return 'text-danger bg-danger-light';
      default:
        return 'text-muted bg-light';
    }
  }
  
  /**
   * Format bonus amount for display
   */
  static formatAmount(amount: number, currency: string = 'TND'): string {
    return new Intl.NumberFormat('ar-TN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }
  
  /**
   * Calculate days since bonus creation
   */
  static getDaysSinceCreation(bonus: Bonus): number {
    if (!bonus.createdAt) return 0;
    const now = new Date();
    const created = new Date(bonus.createdAt);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Check if bonus is overdue (created for more than X days)
   */
  static isOverdue(bonus: Bonus, maxDays: number = 7): boolean {
    if (bonus.status !== BonusStatus.CREATED) return false;
    return this.getDaysSinceCreation(bonus) > maxDays;
  }
}

// Constants
export const BONUS_CONSTANTS = {
  MAX_AMOUNT: 1000,
  MIN_AMOUNT: 1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PENDING_DAYS: 7,
  BULK_OPERATION_LIMIT: 50
} as const;