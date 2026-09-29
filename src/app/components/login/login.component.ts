import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { safeReturnUrl } from '../../core/auth/auth.guard';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loading = false;
  error = '';

  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async signIn(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      await this.auth.signInWithGoogle();
      const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
      await this.router.navigateByUrl(returnUrl);
    } catch (error) {
      this.error = error && error.message
        ? error.message
        : 'No fue posible iniciar sesión. Inténtalo de nuevo.';
    } finally {
      this.loading = false;
    }
  }

}
