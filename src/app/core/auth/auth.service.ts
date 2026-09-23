import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import * as firebase from 'firebase/app';
import 'firebase/auth';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';

export const OWNER_EMAIL = 'jersneme6@gmail.com';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user$: Observable<firebase.User | null> = this.angularFireAuth.authState;
  readonly isAuthorized$: Observable<boolean> = this.user$.pipe(
    map(user => this.isOwner(user)),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(private angularFireAuth: AngularFireAuth) {}

  async signInWithGoogle(): Promise<void> {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      login_hint: OWNER_EMAIL,
      prompt: 'select_account'
    });

    const credential = await this.angularFireAuth.signInWithPopup(provider);
    if (!this.isOwner(credential.user)) {
      await this.signOut();
      throw new Error('Esta cuenta no está autorizada para usar Lingarten.');
    }
  }

  signOut(): Promise<void> {
    return this.angularFireAuth.signOut();
  }

  private isOwner(user: firebase.User | null): boolean {
    return Boolean(
      user
      && user.emailVerified
      && user.email
      && user.email.toLowerCase() === OWNER_EMAIL
    );
  }
}
