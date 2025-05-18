// dashboard.model.ts
import { User } from "./user.model";

export interface DashboardStats {
  totalUsers: number;
  usersByRole: {
    [key: string]: number;
  };
  recentRegistrations: User[];
  totalOrders?: number;
  pendingOrders?: number;
  completedOrders?: number;
  // Add any other stats you want to display
  activeToday?: number;
  deliveryPersons?: number;
  pendingApprovals?: number;
}