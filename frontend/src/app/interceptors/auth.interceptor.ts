import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned).pipe(
      catchError((err: HttpErrorResponse) => {
        // A 401 on an auth call means wrong credentials — the login form must
        // show its own message. Any other 401 means the stored token is stale
        // (expired / signed with a different secret): clear the session so the
        // user is sent back to login instead of seeing "Invalid or expired
        // token" on the page.
        const isAuthCall =
          req.url.endsWith('/api/auth/login') || req.url.endsWith('/api/auth/register');
        if (err.status === 401 && !isAuthCall && auth.isAuthenticated()) {
          auth.logout();
          if (router.url !== '/login') {
            router.navigate(['/login']);
          }
        }
        return throwError(() => err);
      })
    );
  }
  return next(req);
};
