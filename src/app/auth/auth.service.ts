import { Injectable, inject, signal } from '@angular/core';
import { Auth, user, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import type { User } from '@firebase/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  // Expose the current user as a signal
  currentUser = signal<User | null | undefined>(undefined);

  constructor() {
    // Subscribe to auth state changes using the observable from @angular/fire
    user(this.auth).subscribe((user: User | null) => {
      this.currentUser.set(user);
    });
  }

  async login(email: string, pass: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Login error', error);
      throw error;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}
