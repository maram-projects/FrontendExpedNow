import { User } from "./user.model";

export interface DashboardStats {
    totalUsers: number;
    usersByRole: {
      [key: string]: number;
    };
    recentRegistrations: User[];
  }