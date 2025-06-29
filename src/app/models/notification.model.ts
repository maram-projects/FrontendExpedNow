// src/app/models/notification.model.ts
export interface AppNotification {
  id: number;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  type?: string;
  payload?: any;
}