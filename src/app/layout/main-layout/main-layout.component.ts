import { Component, inject, OnInit, OnDestroy, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router, NavigationEnd, ChildrenOutletContexts } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter, Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { fadeAnimation } from '../../core/animations/route.animations';
import { LicenseService } from '../../core/services/license.service';
import { RbacService } from '../../auth/rbac.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    RouterOutlet, 
    SidebarComponent, 
    HeaderComponent, 
    MatSidenavModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatCardModule
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  animations: [fadeAnimation]
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav?: MatSidenav;

  private contexts = inject(ChildrenOutletContexts);
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  licenseService = inject(LicenseService);
  rbacService = inject(RbacService);
  authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  isMobile = signal<boolean>(false);
  private sub = new Subscription();

  // Unlock state
  lockKeyInput = signal<string>('');
  selectedKeyFileName = signal<string>('');
  isUnlocking = signal<boolean>(false);
  unlockError = signal<string>('');

  isSuperAdmin = computed(() => this.rbacService.isSuperAdmin());
  allowSettingsBypass = signal<boolean>(false);

  isAppLocked = computed(() => {
    if (!this.licenseService.isLocked()) return false;
    // Allow Super Admin to access /settings even if locked to manage keys
    if (this.allowSettingsBypass() && this.isSuperAdmin() && this.router.url.startsWith('/settings')) {
      return false;
    }
    return true;
  });

  ngOnInit() {
    // Observe screen size changes (under 960px is mobile/tablet drawer mode)
    this.sub.add(
      this.breakpointObserver.observe(['(max-width: 960px)']).subscribe(result => {
        this.isMobile.set(result.matches);
      })
    );

    // Auto-close drawer on route change when on mobile screens
    this.sub.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        if (this.isMobile() && this.sidenav) {
          this.sidenav.close();
        }
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.routeConfig?.path || 'none';
  }

  goToSettingsAsSuperAdmin() {
    this.allowSettingsBypass.set(true);
    this.router.navigate(['/settings']);
  }

  onKeyFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (!file) return;

    this.selectedKeyFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        this.lockKeyInput.set(content);
        this.unlockError.set('');
      }
    };
    reader.readAsText(file);
  }

  async applyUnlockKey() {
    const input = this.lockKeyInput().trim();
    if (!input) {
      this.unlockError.set('Please upload a valid .key file or paste an activation code.');
      return;
    }

    this.isUnlocking.set(true);
    this.unlockError.set('');

    try {
      const verification = await this.licenseService.verifyKeyStringOrFile(input);
      if (!verification.valid || !verification.keyFile) {
        this.unlockError.set(verification.error || 'Invalid or expired activation key.');
        return;
      }

      const user = this.authService.currentUser();
      await this.licenseService.applyLicense(
        verification.keyFile,
        user?.email || user?.displayName || 'Administrator'
      );

      this.snackBar.open('Application unlocked successfully!', 'Dismiss', { duration: 4000 });
      this.lockKeyInput.set('');
      this.selectedKeyFileName.set('');
    } catch (e: any) {
      this.unlockError.set('Activation failed: ' + (e?.message || 'Error'));
    } finally {
      this.isUnlocking.set(false);
    }
  }

  async superAdminQuickUnlock() {
    if (!this.isSuperAdmin()) return;

    this.isUnlocking.set(true);
    this.unlockError.set('');

    try {
      const user = this.authService.currentUser();
      const oneYearMs = Date.now() + 365 * 24 * 60 * 60 * 1000;
      const result = await this.licenseService.generateActivationKey({
        issuedTo: 'Divisional Secretariat Platform',
        licenseType: 'Government Platform Edition',
        expiresAt: oneYearMs,
        notes: 'Emergency quick-unlock generated by Super Administrator',
        issuerEmail: user?.email || 'superadmin@officnetwork.gov.lk',
        issuerName: user?.displayName || 'Super Administrator'
      });

      await this.licenseService.applyLicense(result.keyFile, user?.email || 'Super Administrator');
      this.snackBar.open('Application successfully unlocked for 1 Year!', 'Dismiss', { duration: 4000 });
    } catch (e: any) {
      this.unlockError.set('Quick unlock failed: ' + (e?.message || 'Error'));
    } finally {
      this.isUnlocking.set(false);
    }
  }

  logout() {
    this.authService.logout();
  }
}
