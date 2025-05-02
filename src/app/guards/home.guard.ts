import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { inject } from "@angular/core";

export const homeGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
  
    if (authService.isLoggedIn()) {
      const user = authService.getCurrentUser();
      
      if (user?.userType) {
        authService.redirectBasedOnUserType(user.userType);
        return false;
      }
      
      // If user exists but has no type, log out
      authService.logout();
      router.navigate(['/login']);
      return false;
    }
    
    return true;
  };
  