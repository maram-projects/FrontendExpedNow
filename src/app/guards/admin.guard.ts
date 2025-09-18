import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  

  const user = authService.getCurrentUser();
  console.log('Admin guard check:', user);

  if (!user) {
    console.log('Access denied: No user found');
    router.navigate(['/login']);
    return false;
  }

  if (user.userType?.toLowerCase() === 'admin') {
    return true;
  }

  console.log('Access denied: User is not admin');
  router.navigate(['/login']);
  return false;
};
