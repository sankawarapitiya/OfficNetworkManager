import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from './auth/auth.guard';
import { rbacGuard } from './auth/rbac.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [rbacGuard],
        data: { module: 'dashboard', permission: 'dashboard:view_overview' }
      },
      {
        path: 'customers',
        loadComponent: () => import('./features/customers/customers.component').then(m => m.CustomersComponent),
        canActivate: [rbacGuard],
        data: { module: 'customers', permission: 'customers:view' }
      },
      {
        path: 'hr',
        loadComponent: () => import('./features/hr/hr.component').then(m => m.HrComponent),
        canActivate: [rbacGuard],
        data: { module: 'hr', permission: 'hr:view_directory' }
      },
      {
        path: 'land',
        loadComponent: () => import('./features/land/land.component').then(m => m.LandComponent),
        canActivate: [rbacGuard],
        data: { module: 'land', permission: 'land:view_parcels' }
      },
      {
        path: 'work-plans',
        children: [
          {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full'
          },
          {
            path: 'dashboard',
            loadComponent: () => import('./features/work-plans/pages/work-plan-dashboard/work-plan-dashboard.component').then(m => m.WorkPlanDashboardComponent),
            canActivate: [rbacGuard],
            data: { module: 'work-plans', workPlanSubState: 'dashboard' }
          },
          {
            path: 'tasks',
            loadComponent: () => import('./features/work-plans/work-plans.component').then(m => m.WorkPlansComponent),
            canActivate: [rbacGuard],
            data: { module: 'work-plans', workPlanSubState: 'tasks' }
          },
          {
            path: 'verification',
            loadComponent: () => import('./features/work-plans/pages/work-plan-verification/work-plan-verification.component').then(m => m.WorkPlanVerificationComponent),
            canActivate: [rbacGuard],
            data: { module: 'work-plans', workPlanSubState: 'verification' }
          },
          {
            path: 'reports',
            loadComponent: () => import('./features/work-plans/pages/work-plan-reports/work-plan-reports.component').then(m => m.WorkPlanReportsComponent),
            canActivate: [rbacGuard],
            data: { module: 'work-plans', workPlanSubState: 'reports' }
          },
          {
            path: 'settings',
            loadComponent: () => import('./features/work-plans/pages/work-plan-settings/work-plan-settings.component').then(m => m.WorkPlanSettingsComponent),
            canActivate: [rbacGuard],
            data: { module: 'work-plans', workPlanSubState: 'settings' }
          }
        ]
      },
      {
        path: 'letters',
        loadComponent: () => import('./features/letters/letters.component').then(m => m.LettersComponent),
        canActivate: [rbacGuard],
        data: { module: 'letters', permission: 'letters:view_inward' }
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [rbacGuard],
        data: { requireRole: 'admin' }
      },
      {
        path: 'system-log',
        loadComponent: () => import('./features/system-log/system-log.component').then(m => m.SystemLogComponent),
        canActivate: [rbacGuard],
        data: { requireRole: 'admin' }
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'attendance',
        loadComponent: () => import('./features/attendance/attendance.component').then(m => m.AttendanceComponent),
        canActivate: [rbacGuard],
        data: { requireRole: 'admin' }
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
