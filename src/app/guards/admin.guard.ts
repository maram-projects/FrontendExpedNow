import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  
  const user = authService.getCurrentUser();
  if (user && user.userType === 'admin') {
    return true;
  }
  
  router.navigate(['/dashboard']);
  return false;
};