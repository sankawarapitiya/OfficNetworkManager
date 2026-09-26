import { Component, inject, Output, EventEmitter, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { RbacService } from '../../auth/rbac.service';
import { WorkPlanService } from '../../features/work-plans/services/work-plan.service';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatListModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() toggleCollapse = new EventEmitter<void>();

  authService = inject(AuthService);
  rbacService = inject(RbacService);
  router = inject(Router);
  workPlanService = inject(WorkPlanService);

  workPlansExpanded = signal<boolean>(false);
  lettersExpanded = signal<boolean>(false);

  private routerSub?: Subscription;

  ngOnInit() {
    this.syncExpansionWithRoute(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event) => {
      this.syncExpansionWithRoute(event.urlAfterRedirects || event.url);
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  private syncExpansionWithRoute(url: string) {
    if (url.startsWith('/work-plans')) {
      this.workPlansExpanded.set(true);
      this.lettersExpanded.set(false);
    } else if (url.startsWith('/letters')) {
      this.lettersExpanded.set(true);
      this.workPlansExpanded.set(false);
    } else {
      // In the root (/dashboard) or other root sections, keep toggle submenus closed
      this.workPlansExpanded.set(false);
      this.lettersExpanded.set(false);
    }
  }

  canAccessVerification = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    const roles = this.workPlanService.settings().rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rbacService.hasAnyRole(roles);
  });

  canAccessReports = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const repTypeRoles = settings.rolesPermittedByReportType;
    if (repTypeRoles) {
      const allPermitted = Object.values(repTypeRoles).flat();
      return this.rbacService.hasAnyRole(allPermitted);
    }
    const allRoles = settings.rolesPermittedForAllReports || ['Super Admin', 'Divisional Admin', 'Department Head'];
    const indRoles = settings.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];
    return this.rbacService.hasAnyRole([...allRoles, ...indRoles]) ||
           this.rbacService.hasPermission('work-plans:all_reports') ||
           this.rbacService.hasPermission('work-plans:individual_reports');
  });

  canManageSettings = computed(() => {
    return this.rbacService.hasPermission('work-plans:manage_policies') || this.rbacService.isSuperAdmin() || this.rbacService.isAdmin();
  });

  toggleWorkPlans(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.workPlansExpanded.update(v => !v);
  }

  isWorkPlansActive(): boolean {
    return this.router.url.startsWith('/work-plans');
  }

  toggleLetters(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.lettersExpanded.update(v => !v);
  }

  isLettersActive(): boolean {
    return this.router.url.startsWith('/letters');
  }
}
