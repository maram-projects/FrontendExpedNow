// toast.service.ts
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private snackBar: MatSnackBar) {}

  // FIXED: Better parameter usage with meaningful names and optional parameters
  showSuccess(
    message: string, 
    action: string = 'Close', 
    additionalClass: string = '', 
    duration: number = 3000
  ): void {
    const panelClasses = ['success-snackbar'];
    if (additionalClass) {
      panelClasses.push(additionalClass);
    }
    
    this.snackBar.open(message, action, {
      duration: duration,
      panelClass: panelClasses
    });
  }

  showError(message: string, action: string = 'Close', duration: number = 5000): void {
    this.snackBar.open(message, action, {
      duration: duration,
      panelClass: ['error-snackbar']
    });
  }

  showWarning(message: string, action: string = 'Close', duration: number = 4000): void {
    this.snackBar.open(message, action, {
      duration: duration,
      panelClass: ['warning-snackbar']
    });
  }

  showInfo(message: string, action: string = 'Close', duration: number = 3000): void {
    this.snackBar.open(message, action, {
      duration: duration,
      panelClass: ['info-snackbar']
    });
  }

  // ALTERNATIVE: If you want to support rich object format
  showSuccessRich(config: {
    title?: string;
    message: string;
    icon?: string;
    duration?: number;
    action?: string;
  }): void {
    const displayMessage = config.title ? `${config.title}: ${config.message}` : config.message;
    this.snackBar.open(displayMessage, config.action || 'Close', {
      duration: config.duration || 3000,
      panelClass: ['success-snackbar']
    });
  }
}