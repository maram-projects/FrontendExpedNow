import { BonusStatus } from "./bonus.model";
import { PaymentStatus } from "./Payment.model";
import { User } from "./user.model";

// models/dashboard.model.ts
export interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  deliveryPersons: number;
  pendingApprovals: number;
  usersByRole: { [role: string]: number };
  discountTypeBreakdown: { [type: string]: number };
  recentRegistrations: User[];
 
  totalPayments?: number;
  totalRevenue?: number;
  paymentStatusBreakdown?: { [status in PaymentStatus]: number };
  
  totalDiscounts?: number;
  activeDiscounts?: number;
  discountUsage?: { [type: string]: number };
  
  totalBonuses?: number;
  bonusStatusBreakdown?: { [status in BonusStatus]: number };
  bonusAmountPaid?: number;
}