import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { inject } from "@angular/core";

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRole = route.data['role'];
  
  const currentUser = authService.getCurrentUser();
  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  const userType = currentUser.userType.toLowerCase();
  const isAllowed = checkRoleAccess(userType, requiredRole);

  if (!isAllowed) {
    authService.redirectBasedOnUserType(userType);
    return false;
  }
  
  return true;
};

function checkRoleAccess(userType: string, requiredRole: string): boolean {
  const roleMap: { [key: string]: string[] } = {
    client: ['individual', 'enterprise'],
    delivery: ['temporary', 'professional'],
    admin: ['admin']
  };

  return roleMap[requiredRole]?.includes(userType) || false;
}