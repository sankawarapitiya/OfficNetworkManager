import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, Observable, of } from 'rxjs';
import { FirestoreService } from '../core/services/firestore.service';
import { DEFAULT_ROLE_PERMISSIONS, ALL_SYSTEM_PERMISSION_IDS } from '../core/models/permission.model';

export interface UserRoles {
  roles: string[];
  locations: string[];
  accessible_modules: string[];
  department?: string;
  permissions?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class RbacService {
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);

  // Global role-permission mapping from settings
  rolePermissions = toSignal(
    this.firestoreService.getDocument<{ mapping?: Record<string, string[]> }>('settings/role_permissions')
  );

  // Derive the user's roles from Firestore 'users' collection
  userRoles = toSignal(
    toObservable(this.authService.currentUser).pipe(
      switchMap(user => {
        if (!user) return of(null);
        // Fetch the user's document from Firestore where we save the roles
        return this.firestoreService.getDocument<UserRoles>(`users/${user.uid}`);
      })
    ),
    { initialValue: null }
  );

  userDepartment = computed(() => {
    return this.userRoles()?.department || '';
  });

  userEffectivePermissions = computed(() => {
    if (this.isSuperAdmin() || this.isAdmin()) {
      return [...ALL_SYSTEM_PERMISSION_IDS];
    }

    const explicit = this.userRoles()?.permissions || [];
    const uData = this.userRoles();
    const userRoleList = uData?.roles || ((uData as any)?.role ? [(uData as any).role] : []);
    const mapping = this.rolePermissions()?.mapping || DEFAULT_ROLE_PERMISSIONS;

    const combined = new Set<string>(explicit);
    for (const role of userRoleList) {
      const rolePerms = mapping[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
      for (const p of rolePerms) {
        combined.add(p);
      }
    }

    return Array.from(combined);
  });

  hasRole(role: string): boolean {
    const uData = this.userRoles();
    const roles: string[] = uData?.roles || ((uData as any)?.role ? [(uData as any).role] : []);
    
    // Auto-grant admin/Super Admin ONLY if user document has loaded from DB and has no roles configured
    if (uData !== null && uData !== undefined && roles.length === 0 && (role === 'admin' || role === 'Super Admin')) {
      return true;
    }

    const norm = (str: string) => str.toLowerCase().replace(/[\s_-]+/g, '');
    const targetNorm = norm(role);

    // If checking generic admin access, both Super Admin and Divisional Admin qualify
    if (targetNorm === 'admin') {
      return roles.some(r => {
        const rNorm = norm(r);
        return rNorm === 'admin' || rNorm === 'superadmin' || rNorm === 'divisionaladmin';
      });
    }
    
    return roles.some(r => norm(r) === targetNorm);
  }

  hasAnyRole(targetRoles: string[]): boolean {
    return targetRoles.some(r => this.hasRole(r));
  }

  isSuperAdmin(): boolean {
    return this.hasRole('Super Admin');
  }

  isDivisionalAdmin(): boolean {
    return this.hasRole('Divisional Admin');
  }

  isDepartmentHead(): boolean {
    return this.hasRole('Department Head');
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  canAccessModule(moduleName: string): boolean {
    const rolesData = this.userRoles();
    if (!rolesData) return false;

    // Admins always have access to all modules
    if (this.hasRole('admin')) return true;

    const modules = rolesData.accessible_modules || [];
    
    // If no specific modules are assigned, we default to full access 
    // (as indicated in the profile UI logic).
    if (modules.length === 0) return true;

    return modules.includes(moduleName);
  }

  hasPermission(permissionId: string): boolean {
    if (this.isSuperAdmin() || this.isAdmin()) {
      return true;
    }

    const explicit = this.userRoles()?.permissions || [];
    if (explicit.includes(permissionId)) {
      return true;
    }

    const userRoleList = this.userRoles()?.roles || [];
    const mapping = this.rolePermissions()?.mapping || DEFAULT_ROLE_PERMISSIONS;

    for (const role of userRoleList) {
      const rolePerms = mapping[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
      if (rolePerms.includes(permissionId)) {
        return true;
      }
    }

    return false;
  }

  hasModulePermission(moduleId: string, partKey: string): boolean {
    return this.hasPermission(`${moduleId}:${partKey}`);
  }
}
