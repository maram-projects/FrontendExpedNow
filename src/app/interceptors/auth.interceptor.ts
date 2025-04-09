// auth.interceptor.ts
import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from "@angular/common/http";
import { catchError, EMPTY, Observable, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";
import { inject } from "@angular/core";
import { Router } from "@angular/router";

export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Skip authentication for login and register endpoints
  if (request.url.includes('/api/auth/login') || request.url.includes('/api/auth/register')) {
    return next(request);
  }
  
  // For all other requests, add the token if available
  const token = authService.getToken();
  if (token) {
    request = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  } else {
    // If token is needed but not available, redirect to login
    if (request.url.includes('/api/admin')) {
      console.warn('Protected admin route accessed without token');
      router.navigate(['/login']);
      return EMPTY;
    }
  }
  
  return next(request).pipe(
    catchError(error => {
      // If we get HTML instead of JSON (which causes parsing error)
      if (error.error instanceof SyntaxError && error.error.message.includes('Unexpected token')) {
        console.error('Authentication error - received HTML instead of JSON');
        authService.logout(); // Clear invalid token
        router.navigate(['/login']);
        return EMPTY;
      }
      return throwError(() => error);
    })
  );
};