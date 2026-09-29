import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';

// Layout for every authenticated route. Guards only run on navigation, so the
// shell also leaves when the session ends in place (sign-out in another tab,
// revoked token).
@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html'
})
export class ShellComponent implements OnInit, OnDestroy {
  private sessionWatch: Subscription;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.sessionWatch = this.auth.isAuthorized$
      .pipe(filter(authorized => !authorized))
      .subscribe(() => this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      }));
  }

  ngOnDestroy(): void {
    this.sessionWatch.unsubscribe();
  }
}
