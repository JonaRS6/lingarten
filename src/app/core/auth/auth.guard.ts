import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const DEFAULT_AUTHENTICATED_URL = '/table';

// Only follow in-app paths; anything else (absolute URLs, the login page
// itself) falls back to the default screen.
export function safeReturnUrl(returnUrl: string | null): string {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//') || returnUrl.startsWith('/login')) {
    return DEFAULT_AUTHENTICATED_URL;
  }
  return returnUrl;
}

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.auth.isAuthorized$.pipe(
      take(1),
      map(authorized => authorized || this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url }
      }))
    );
  }

  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.canActivate(route, state);
  }
}

@Injectable({ providedIn: 'root' })
export class GuestGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    return this.auth.isAuthorized$.pipe(
      take(1),
      map(authorized => !authorized
        || this.router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl'))))
    );
  }
}
