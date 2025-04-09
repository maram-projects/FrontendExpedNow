import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const requiredRole = route.data['role'];
  
  const currentUser = authService.getCurrentUser();
  console.log('Role guard check:', currentUser, 'Required role:', requiredRole);
  
  if (!currentUser) {
    console.log('No current user found');
    router.navigate(['/login']);
    return false;
  }
  
  const hasRole = checkUserRole(currentUser.userType, requiredRole);
  console.log('Has required role:', hasRole);
  
  if (!hasRole) {
    router.navigate(['/login']);
    return false;
  }
  
  return true;
};

function checkUserRole(userType: string, requiredRole: string): boolean {
  if (!userType) return false;
  
  const userTypeLower = userType.toLowerCase();
  switch (requiredRole) {
    case 'client':
      return ['individual', 'enterprise'].includes(userTypeLower);
    case 'delivery':
      return ['temporary', 'professional'].includes(userTypeLower);
    case 'admin':
      return userTypeLower === 'admin';
    default:
      return false;
  }
}