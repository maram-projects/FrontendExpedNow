import { User } from "./user.model";

export interface DashboardStats {
  totalUsers: number;
  usersByRole: {
    [key: string]: number;
  };
  recentRegistrations: User[];
  totalOrders?: number; // Optional
  pendingOrders?: number; // Optional
  completedOrders?: number; // Optional
}
  