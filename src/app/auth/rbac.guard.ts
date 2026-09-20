import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { RbacService } from './rbac.service';
import { WorkPlanService } from '../features/work-plans/services/work-plan.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { map, filter, take } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

export const rbacGuard: CanActivateFn = (route, state) => {
  const rbacService = inject(RbacService);
  const workPlanService = inject(WorkPlanService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const requiredModule = route.data?.['module'];
  const requiredRole = route.data?.['requireRole'];
  const requiredRoles = route.data?.['requireRoles'] as string[] | undefined;
  const requiredPermission = route.data?.['permission'] || route.data?.['requirePermission'];
  const requiredPermissions = (route.data?.['permissions'] || route.data?.['requirePermissions']) as string[] | undefined;
  const workPlanSubState = route.data?.['workPlanSubState'];

  return toObservable(rbacService.userRoles).pipe(
    filter(roles => roles !== null && roles !== undefined),
    take(1),
    map(() => {
      // 1. Single Required Role Check (e.g. 'admin')
      if (requiredRole && !rbacService.hasRole(requiredRole)) {
        console.warn(`[Access Guard] Access denied to state ${state.url}: missing required role ${requiredRole}`);
        snackBar.open('Access Denied: You do not have the required role to access this area.', 'Dismiss', { duration: 3500 });
        return router.parseUrl('/dashboard');
      }

      // 2. Multiple Required Roles Check (hasAnyRole)
      if (requiredRoles && requiredRoles.length > 0 && !rbacService.hasAnyRole(requiredRoles)) {
        console.warn(`[Access Guard] Access denied to state ${state.url}: missing required roles`);
        snackBar.open('Access Denied: Your assigned roles do not grant access to this area.', 'Dismiss', { duration: 3500 });
        return router.parseUrl('/dashboard');
      }

      // 3. Module Level Access Check
      if (requiredModule && !rbacService.canAccessModule(requiredModule)) {
        console.warn(`[Access Guard] Access denied to module: ${requiredModule}`);
        snackBar.open(`Access Denied: You do not have access to the ${requiredModule} module.`, 'Dismiss', { duration: 3500 });
        return router.parseUrl('/dashboard');
      }

      // 4. Specific Permission Check
      if (requiredPermission && !rbacService.hasPermission(requiredPermission)) {
        console.warn(`[Access Guard] Access denied to state ${state.url}: missing permission ${requiredPermission}`);
        snackBar.open('Access Denied: You lack the required permission to access this state.', 'Dismiss', { duration: 3500 });
        return router.parseUrl('/dashboard');
      }

      // 5. Multiple Permissions Check (requires at least one)
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAny = requiredPermissions.some(p => rbacService.hasPermission(p));
        if (!hasAny) {
          console.warn(`[Access Guard] Access denied to state ${state.url}: missing any of [${requiredPermissions.join(', ')}]`);
          snackBar.open('Access Denied: You lack the required permission to access this state.', 'Dismiss', { duration: 3500 });
          return router.parseUrl('/dashboard');
        }
      }

      // 6. Work Plan Sub-State Permission Check
      if (workPlanSubState) {
        const wpSettings = workPlanService.settings();
        const isAdminUser = rbacService.isAdmin() || rbacService.isSuperAdmin() || rbacService.isDivisionalAdmin();

        if (workPlanSubState === 'settings') {
          const canManage = isAdminUser || rbacService.hasPermission('work-plans:manage_policies');
          if (!canManage) {
            console.warn(`[Access Guard] Access denied to Work Plan Settings state`);
            snackBar.open('Access Denied: You do not have permission to manage Work Plan Settings.', 'Dismiss', { duration: 3500 });
            return router.parseUrl('/work-plans/tasks');
          }
        } else if (workPlanSubState === 'verification') {
          const verifRoles = wpSettings.rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
          const canVerify = isAdminUser || rbacService.hasPermission('work-plans:verify_signoff') || rbacService.hasAnyRole(verifRoles);
          if (!canVerify) {
            console.warn(`[Access Guard] Access denied to Work Plan Verification state`);
            snackBar.open('Access Denied: You do not have permission to access Work Plan Verification.', 'Dismiss', { duration: 3500 });
            return router.parseUrl('/work-plans/tasks');
          }
        } else if (workPlanSubState === 'reports') {
          const repTypeRoles = wpSettings.rolesPermittedByReportType;
          let canReport = false;
          if (repTypeRoles) {
            const allPermitted = Array.from(new Set(Object.values(repTypeRoles).flat()));
            canReport = isAdminUser || rbacService.hasAnyRole(allPermitted);
          } else {
            const allRoles = wpSettings.rolesPermittedForAllReports || ['Super Admin', 'Divisional Admin', 'Department Head'];
            const indRoles = wpSettings.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];
            canReport = isAdminUser || 
                        rbacService.hasPermission('work-plans:all_reports') || 
                        rbacService.hasPermission('work-plans:individual_reports') || 
                        rbacService.hasAnyRole([...allRoles, ...indRoles]);
          }
          if (!canReport) {
            console.warn(`[Access Guard] Access denied to Work Plan Reports state`);
            snackBar.open('Access Denied: You do not have permission to access Work Plan Reports.', 'Dismiss', { duration: 3500 });
            return router.parseUrl('/work-plans/tasks');
          }
        } else if (workPlanSubState === 'tasks') {
          const canViewTasks = isAdminUser || rbacService.hasPermission('work-plans:view_tasks') || rbacService.canAccessModule('work-plans');
          if (!canViewTasks) {
            console.warn(`[Access Guard] Access denied to Work Plan Tasks state`);
            snackBar.open('Access Denied: You do not have permission to view Work Plan Tasks.', 'Dismiss', { duration: 3500 });
            return router.parseUrl('/dashboard');
          }
        } else if (workPlanSubState === 'dashboard') {
          const canViewDash = isAdminUser || rbacService.hasPermission('work-plans:view_all_summary') || rbacService.hasPermission('work-plans:view_tasks') || rbacService.canAccessModule('work-plans');
          if (!canViewDash) {
            console.warn(`[Access Guard] Access denied to Work Plan Dashboard state`);
            snackBar.open('Access Denied: You do not have permission to view Work Plan Dashboard.', 'Dismiss', { duration: 3500 });
            return router.parseUrl('/dashboard');
          }
        } else if (workPlanSubState === 'calendar') {
          const canViewCal = isAdminUser || rbacService.hasPermission('work-plans:view_tasks') || rbacService.canAccessModule('work-plans');
          if (!canViewCal) {
            console.warn(`[Access Guard] Access denied to Work Plan Calendar state`);
            snackBar.open('Access Denied: You do not have permission to view Work Plan Calendar.', 'Dismiss', { duration: 3500 });
            return router.parseUrl('/dashboard');
          }
        }
      }

      return true;
    })
  );
};
