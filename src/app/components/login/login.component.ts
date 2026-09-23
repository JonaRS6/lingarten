import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loading = false;
  error = '';
  resetSent = false;
  password = '';

  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async signIn(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      await this.auth.signInWithPassword(this.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/table';
      await this.router.navigateByUrl(returnUrl);
    } catch (error) {
      this.error = error && error.message
        ? error.message
        : 'No fue posible iniciar sesión. Inténtalo de nuevo.';
    } finally {
      this.loading = false;
    }
  }

  async resetPassword(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.resetSent = false;

    try {
      await this.auth.sendPasswordReset();
      this.resetSent = true;
    } catch (error) {
      this.error = 'No fue posible enviar el correo de restablecimiento. Inténtalo de nuevo.';
    } finally {
      this.loading = false;
    }
  }
}
