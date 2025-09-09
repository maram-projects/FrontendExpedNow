// toast.service.ts - Updated to support action notifications

import { Injectable } from '@angular/core';

export interface NotificationAction {
  label: string;
  callback: () => void;
}

export interface CustomNotification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  action?: NotificationAction;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private notifications: CustomNotification[] = [];

  constructor() { }

  showSuccess(message: string, title: string = 'Succès'): void {
    this.showToast('success', title, message);
  }

  showError(message: string, title: string = 'Erreur'): void {
    this.showToast('error', title, message);
  }

  showWarning(message: string, title: string = 'Attention'): void {
    this.showToast('warning', title, message);
  }

  showInfo(message: string, title: string = 'Information'): void {
    this.showToast('info', title, message);
  }

  showNotification(notification: Omit<CustomNotification, 'id'>): void {
    const customNotification: CustomNotification = {
      ...notification,
      id: Date.now() + Math.random()
    };
    
    this.notifications.push(customNotification);
    
    // Auto-dismiss after duration (default 5 seconds)
    const duration = notification.duration || 5000;
    setTimeout(() => {
      this.dismissNotification(customNotification.id);
    }, duration);
  }

  private showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string): void {
    const notification: CustomNotification = {
      id: Date.now() + Math.random(),
      type,
      title,
      message
    };
    
    this.notifications.push(notification);
    
    // Auto-dismiss success and info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, 3000);
    }
    
    // Auto-dismiss warnings after 5 seconds
    if (type === 'warning') {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, 5000);
    }
    
    // Errors stay until manually dismissed
  }

  dismissNotification(id: number): void {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index > -1) {
      this.notifications.splice(index, 1);
    }
  }

  getNotifications(): CustomNotification[] {
    return this.notifications;
  }

  clearAll(): void {
    this.notifications = [];
  }
}