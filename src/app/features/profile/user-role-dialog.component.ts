import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';

import { 
  SYSTEM_MODULE_PERMISSIONS, 
  DEFAULT_ROLE_PERMISSIONS, 
  ALL_SYSTEM_PERMISSION_IDS, 
  ModulePermissionDefinition 
} from '../../core/models/permission.model';

@Component({
  selector: 'app-user-role-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.user ? 'Manage Access & Permissions: ' + data.user.displayName : 'Create New System User' }}</h2>
    <mat-dialog-content>
      <div *ngIf="errorMsg" class="error-banner mb-4">
        {{ errorMsg }}
      </div>

      <form [formGroup]="userForm" class="dialog-form pt-2">
        <ng-container *ngIf="!data.user">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Display Name</mat-label>
            <input matInput formControlName="displayName" required>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" required>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" required>
            <mat-hint>Must be at least 6 characters.</mat-hint>
          </mat-form-field>
        </ng-container>

        <!-- Department Assignment Section -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Assigned Department</mat-label>
          <mat-select formControlName="department">
            <mat-option value="">-- No Department Assigned --</mat-option>
            <mat-option *ngFor="let dept of data.availableDepartments" [value]="dept.name">
              {{ dept.name }} <span *ngIf="dept.code">({{ dept.code }})</span>
            </mat-option>
          </mat-select>
          <mat-icon matSuffix>domain</mat-icon>
          <mat-hint>Departments can be managed in General Settings</mat-hint>
        </mat-form-field>

        <!-- Assigned Roles Section -->
        <div class="policy-section">
          <div class="policy-title-row">
            <h4>Assigned Roles</h4>
            <span class="multi-tag">Multiple Allowed</span>
          </div>
          <p class="policy-hint">Users can be assigned multiple roles simultaneously (e.g. Department Head + Divisional Admin).</p>
          <div class="checkbox-group roles-grid">
            <mat-checkbox *ngFor="let role of data.availableRoles" 
                          [checked]="isChecked('roles', role)"
                          (change)="toggleRole(role)"
                          color="primary" class="role-checkbox">
              <span class="role-item-wrap">
                <span class="role-title">{{ role }}</span>
                <span class="role-desc">{{ getRoleDesc(role) }}</span>
              </span>
            </mat-checkbox>
          </div>
        </div>

        <!-- Granular Permissions & Part Management Section -->
        <div class="policy-section permissions-section">
          <div class="policy-title-row">
            <div class="perm-title-group">
              <mat-icon class="perm-section-icon">verified_user</mat-icon>
              <h4>Granular Module & Part Permissions</h4>
            </div>
            <div class="perm-header-actions">
              <span class="perm-tally-pill">{{ currentPermsCount }} / {{ totalSystemPerms }} Granted</span>
              <button mat-stroked-button type="button" class="sync-role-btn" (click)="autoApplyFromRoles()" matTooltip="Apply default permissions from selected roles">
                <mat-icon>sync</mat-icon> Sync from Roles
              </button>
            </div>
          </div>
          <p class="policy-hint">
            Customize specific part capabilities for this user. Roles automatically populate defaults, or you can tailor individual permissions below.
          </p>

          <!-- Module Permissions Accordion -->
          <mat-accordion multi="true" class="user-perms-accordion">
            <mat-expansion-panel *ngFor="let mod of moduleDefinitions" class="user-mod-panel" [expanded]="isModuleExpanded(mod)">
              <mat-expansion-panel-header>
                <mat-panel-title class="user-mod-title">
                  <mat-icon class="mod-hdr-icon">{{ mod.icon }}</mat-icon>
                  <span class="mod-hdr-name">{{ mod.moduleName }}</span>
                </mat-panel-title>
                <mat-panel-description class="user-mod-desc">
                  <span class="mod-active-count">{{ getModuleActivePermCount(mod) }} / {{ mod.parts.length }} parts</span>
                  <button mat-button type="button" class="mini-toggle-btn" (click)="$event.stopPropagation(); toggleAllModulePerms(mod)">
                    {{ isModuleAllChecked(mod) ? 'Clear' : 'Select All' }}
                  </button>
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="mod-parts-list">
                <div *ngFor="let part of mod.parts" 
                     class="user-part-row" 
                     [class.active]="isPermChecked(part.id)"
                     (click)="togglePerm(part.id)">
                  <mat-checkbox [checked]="isPermChecked(part.id)" 
                                (click)="$event.stopPropagation()"
                                (change)="togglePerm(part.id)"
                                color="primary">
                  </mat-checkbox>
                  <div class="user-part-info">
                    <div class="part-name-badge">
                      <span class="p-name">{{ part.name }}</span>
                      <code class="p-key">{{ part.id }}</code>
                    </div>
                    <span class="p-desc">{{ part.description }}</span>
                  </div>
                </div>
              </div>
            </mat-expansion-panel>
          </mat-accordion>
        </div>

        <!-- Locations -->
        <div class="policy-section">
          <h4>Assigned Regional Locations</h4>
          <div class="checkbox-group">
            <mat-checkbox *ngFor="let loc of data.availableLocations" 
                          [checked]="isChecked('locations', loc)"
                          (change)="toggle('locations', loc)"
                          color="primary">
              {{ loc }}
            </mat-checkbox>
          </div>
        </div>

        <!-- Modules Global Access -->
        <div class="policy-section">
          <h4>Accessible Module Routes</h4>
          <p class="policy-hint">Controls top-level navigation access in the sidebar menu.</p>
          <div class="checkbox-group">
            <mat-checkbox *ngFor="let mod of data.availableModules" 
                          [checked]="isChecked('accessible_modules', mod)"
                          (change)="toggle('accessible_modules', mod)"
                          color="primary">
              {{ mod | titlecase }}
            </mat-checkbox>
          </div>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="userForm.invalid || isSaving" (click)="onSave()">
        {{ data.user ? 'Save Access & Permissions' : 'Create User' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .full-width {
      width: 100%;
    }
    .policy-section {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;

      .policy-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        flex-wrap: wrap;
        gap: 8px;

        h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }

        .multi-tag {
          font-size: 11px;
          font-weight: 600;
          color: #4f46e5;
          background: #eef2ff;
          padding: 2px 8px;
          border-radius: 999px;
        }
      }

      .policy-hint {
        margin: 0 0 10px 0;
        font-size: 12px;
        color: #64748b;
        line-height: 1.4;
      }
    }

    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;

      &.roles-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;

        @media (max-width: 600px) {
          grid-template-columns: 1fr;
        }

        .role-checkbox {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 10px;
          background: #f8fafc;
          transition: all 0.15s ease;

          &:hover {
            border-color: #6366f1;
            background: #ffffff;
          }

          .role-item-wrap {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-left: 4px;

            .role-title {
              font-size: 13px;
              font-weight: 600;
              color: #0f172a;
            }

            .role-desc {
              font-size: 11px;
              color: #64748b;
              line-height: 1.25;
            }
          }
        }
      }
    }

    /* Granular Permissions Section */
    .permissions-section {
      background-color: #fafbfc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin-top: 14px;

      .perm-title-group {
        display: flex;
        align-items: center;
        gap: 8px;

        .perm-section-icon {
          color: #4f46e5;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      .perm-header-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .perm-tally-pill {
          font-size: 11px;
          font-weight: 700;
          color: #1e40af;
          background: #dbeafe;
          padding: 3px 8px;
          border-radius: 12px;
        }

        .sync-role-btn {
          font-size: 11.5px;
          height: 28px;
          line-height: 28px;
          padding: 0 8px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
        }
      }

      .user-perms-accordion {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;

        .user-mod-panel {
          border: 1px solid #e2e8f0;
          border-radius: 8px !important;
          box-shadow: none !important;

          .user-mod-title {
            display: flex;
            align-items: center;
            gap: 8px;

            .mod-hdr-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
              color: #6366f1;
            }

            .mod-hdr-name {
              font-size: 13.5px;
              font-weight: 700;
              color: #1e293b;
            }
          }

          .user-mod-desc {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;

            .mod-active-count {
              font-size: 11px;
              font-weight: 600;
              color: #475569;
            }

            .mini-toggle-btn {
              font-size: 11px;
              height: 24px;
              line-height: 24px;
              padding: 0 6px;
              color: #4f46e5;
            }
          }

          .mod-parts-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px 0;

            .user-part-row {
              display: flex;
              align-items: flex-start;
              gap: 8px;
              padding: 6px 10px;
              border: 1px solid #f1f5f9;
              border-radius: 6px;
              background: #ffffff;
              cursor: pointer;
              transition: all 0.12s ease;

              &:hover {
                background: #f8fafc;
                border-color: #cbd5e1;
              }

              &.active {
                background: #f0fdf4;
                border-color: #bbf7d0;

                .p-name { color: #166534; font-weight: 600; }
                .p-key { background: #dcfce7; color: #15803d; }
              }

              .user-part-info {
                display: flex;
                flex-direction: column;
                gap: 1px;

                .part-name-badge {
                  display: flex;
                  align-items: center;
                  gap: 6px;

                  .p-name {
                    font-size: 12.5px;
                    color: #1e293b;
                  }

                  .p-key {
                    font-size: 10px;
                    font-family: monospace;
                    background: #f1f5f9;
                    color: #64748b;
                    padding: 0 4px;
                    border-radius: 3px;
                  }
                }

                .p-desc {
                  font-size: 11px;
                  color: #64748b;
                }
              }
            }
          }
        }
      }
    }

    .error-banner {
      padding: 12px;
      background-color: #ffebee;
      color: #c62828;
      border-radius: 4px;
    }
  `]
})
export class UserRoleDialogComponent {
  private fb = inject(FormBuilder);
  
  readonly moduleDefinitions = SYSTEM_MODULE_PERMISSIONS;
  readonly totalSystemPerms = ALL_SYSTEM_PERMISSION_IDS.length;

  userForm: FormGroup;
  isSaving = false;
  errorMsg = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { 
      user?: any, 
      availableRoles: string[], 
      availableLocations: string[], 
      availableModules: string[],
      availableDepartments?: { name: string, code?: string }[],
      rolePermissionsMapping?: Record<string, string[]>
    },
    public dialogRef: MatDialogRef<UserRoleDialogComponent>
  ) {
    const existingPerms = data.user?.permissions;
    let initialPerms: string[] = [];

    if (existingPerms && Array.isArray(existingPerms) && existingPerms.length > 0) {
      initialPerms = [...existingPerms];
    } else if (data.user?.roles && Array.isArray(data.user.roles)) {
      // Auto-populate from user's current roles if creating or if no custom permissions yet
      initialPerms = this.resolvePermsFromRoles(data.user.roles);
    } else if (!data.user) {
      // New user default: Staff permissions
      initialPerms = this.resolvePermsFromRoles(['Staff']);
    }

    this.userForm = this.fb.group({
      displayName: [data.user?.displayName || '', data.user ? [] : [Validators.required]],
      email: [data.user?.email || '', data.user ? [] : [Validators.required, Validators.email]],
      password: ['', data.user ? [] : [Validators.required, Validators.minLength(6)]],
      department: [data.user?.department || ''],
      roles: [data.user?.roles || (!data.user ? ['Staff'] : [])],
      locations: [data.user?.locations || []],
      accessible_modules: [data.user?.accessible_modules || []],
      permissions: [initialPerms]
    });
  }

  get currentPermsCount(): number {
    return (this.userForm.get('permissions')?.value || []).length;
  }

  resolvePermsFromRoles(roles: string[]): string[] {
    const mapping = this.data.rolePermissionsMapping || DEFAULT_ROLE_PERMISSIONS;
    const resolved = new Set<string>();

    for (const r of roles) {
      const perms = mapping[r] || DEFAULT_ROLE_PERMISSIONS[r] || [];
      for (const p of perms) {
        resolved.add(p);
      }
    }

    return Array.from(resolved);
  }

  autoApplyFromRoles() {
    const roles = (this.userForm.get('roles')?.value as string[]) || [];
    const derived = this.resolvePermsFromRoles(roles);
    this.userForm.get('permissions')?.setValue(derived);
  }

  toggleRole(role: string) {
    this.toggle('roles', role);
    // When roles change, if user has no explicit custom perms, auto-suggest the new role set
    const currentRoles = (this.userForm.get('roles')?.value as string[]) || [];
    const currentPerms = (this.userForm.get('permissions')?.value as string[]) || [];
    
    // Auto-merge new role permissions so user immediately has them
    const mapping = this.data.rolePermissionsMapping || DEFAULT_ROLE_PERMISSIONS;
    const combined = new Set<string>(currentPerms);
    for (const r of currentRoles) {
      const roleDefaults = mapping[r] || DEFAULT_ROLE_PERMISSIONS[r] || [];
      for (const p of roleDefaults) {
        combined.add(p);
      }
    }
    this.userForm.get('permissions')?.setValue(Array.from(combined));
  }

  isPermChecked(permId: string): boolean {
    const perms = (this.userForm.get('permissions')?.value as string[]) || [];
    return perms.includes(permId);
  }

  togglePerm(permId: string) {
    const perms = [...((this.userForm.get('permissions')?.value as string[]) || [])];
    const idx = perms.indexOf(permId);
    if (idx > -1) {
      perms.splice(idx, 1);
    } else {
      perms.push(permId);
    }
    this.userForm.get('permissions')?.setValue(perms);
  }

  getModuleActivePermCount(mod: ModulePermissionDefinition): number {
    const perms = (this.userForm.get('permissions')?.value as string[]) || [];
    return mod.parts.filter(p => perms.includes(p.id)).length;
  }

  isModuleAllChecked(mod: ModulePermissionDefinition): boolean {
    const perms = (this.userForm.get('permissions')?.value as string[]) || [];
    return mod.parts.every(p => perms.includes(p.id));
  }

  isModuleExpanded(mod: ModulePermissionDefinition): boolean {
    return this.getModuleActivePermCount(mod) > 0;
  }

  toggleAllModulePerms(mod: ModulePermissionDefinition) {
    let perms = [...((this.userForm.get('permissions')?.value as string[]) || [])];
    const isAll = this.isModuleAllChecked(mod);

    if (isAll) {
      const partIds = new Set(mod.parts.map(p => p.id));
      perms = perms.filter(id => !partIds.has(id));
    } else {
      for (const p of mod.parts) {
        if (!perms.includes(p.id)) {
          perms.push(p.id);
        }
      }
    }

    this.userForm.get('permissions')?.setValue(perms);
  }

  isChecked(arrayName: string, item: string): boolean {
    const arr = (this.userForm.get(arrayName)?.value as string[]) || [];
    const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
    const target = norm(item);
    return arr.some(r => norm(r) === target);
  }

  toggle(arrayName: string, item: string) {
    const arr = [...((this.userForm.get(arrayName)?.value as string[]) || [])];
    const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
    const target = norm(item);
    const idx = arr.findIndex(r => norm(r) === target);
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(item);
    }
    this.userForm.get(arrayName)?.setValue(arr);
  }

  getRoleDesc(role: string): string {
    switch (role) {
      case 'Super Admin': return 'Full system control, users & security root';
      case 'Divisional Admin': return 'Regional division governance & oversight';
      case 'Department Head': return 'Pillar leadership, directive approvals';
      case 'Staff': return 'Execution of tasks & operational records';
      case 'HR': return 'Employee records & personnel administration';
      case 'Field Agent': return 'Mobile field ops & regional reporting';
      default: return 'Custom operational privilege';
    }
  }

  onSave() {
    if (this.userForm.valid) {
      this.dialogRef.close(this.userForm.value);
    }
  }
}
