import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, Division, Department, DynamicSchema, DynamicField } from './../settings.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';

import { EventLogService } from '../../../core/services/event-log.service';
import { FirestoreService } from '../../../core/services/firestore.service';
import { WorkPlanService } from '../../work-plans/services/work-plan.service';
import { 
  SYSTEM_MODULE_PERMISSIONS, 
  DEFAULT_ROLE_PERMISSIONS, 
  ALL_SYSTEM_PERMISSION_IDS, 
  ModulePermissionDefinition 
} from '../../../core/models/permission.model';

export interface SystemUserOption {
  id?: string;
  displayName: string;
  email: string;
  roles?: string[];
  department?: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatListModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatTabsModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatSelectModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private firestoreService = inject(FirestoreService);
  private eventLogService = inject(EventLogService);
  private snackBar = inject(MatSnackBar);
  private workPlanService = inject(WorkPlanService);

  // Work Plan On-Behalf Task Delegation Roles
  rolesPermittedToCreateOnBehalf = signal<string[]>(['Super Admin', 'Divisional Admin', 'Department Head']);
  isSavingDelegationRoles = signal<boolean>(false);

  // System module permission definitions
  readonly modules = SYSTEM_MODULE_PERMISSIONS;
  readonly totalSystemPermissions = ALL_SYSTEM_PERMISSION_IDS.length;

  // Available roles for permission mapping
  readonly availableRoles = [
    'Super Admin',
    'Divisional Admin',
    'Department Head',
    'Staff',
    'HR',
    'Field Agent'
  ];

  // Active role selected in Role & Permission tab
  selectedRole = signal<string>('Super Admin');

  // Role permissions mapping state: roleName -> permissionIds[]
  rolePermissions = signal<Record<string, string[]>>({ ...DEFAULT_ROLE_PERMISSIONS });
  isSavingPermissions = signal<boolean>(false);

  // Divisions state
  divisions = signal<Division[]>([]);
  newDivisionName = '';

  // Departments state
  departments = signal<Department[]>([]);
  isEditingDepartment = signal<boolean>(false);
  editingDeptId: string | null = null;

  // Department Form fields
  deptName = '';
  deptCode = '';
  deptDescription = '';
  deptLeadName = '';
  deptVerificationQuota = 1;

  // System Users for typeahead autocomplete
  systemUsers = signal<SystemUserOption[]>([]);
  deptLeadSearch = signal<string>('');

  // Schemas state
  availableSchemaModules = [
    { id: 'customers', name: 'Customers & Citizens' },
    { id: 'land', name: 'Land Administration' },
    { id: 'letters', name: 'Official Letters' },
    { id: 'hr', name: 'Human Resources' }
  ];
  selectedSchemaModule = signal<string>('customers');
  dynamicSchemas = signal<DynamicSchema[]>([]);
  newFieldName = '';
  newFieldLabel = '';
  newFieldType: 'text' | 'number' | 'dropdown' | 'date' = 'text';
  newFieldRequired = false;

  filteredSystemUsers = computed(() => {
    const query = (this.deptLeadSearch() || '').toLowerCase().trim();
    const users = this.systemUsers();
    if (!query) {
      return users;
    }
    return users.filter(u => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const dept = (u.department || '').toLowerCase();
      const role = (u.roles || []).join(' ').toLowerCase();
      return name.includes(query) || email.includes(query) || dept.includes(query) || role.includes(query);
    });
  });

  currentRolePermissionsCount = computed(() => {
    const perms = this.rolePermissions()[this.selectedRole()] || [];
    return perms.length;
  });

  currentSchema = computed(() => {
    const mod = this.selectedSchemaModule();
    return this.dynamicSchemas().find(s => s.target_module === mod) || null;
  });

  ngOnInit() {
    this.loadDivisions();
    this.loadDepartments();
    this.loadSystemUsers();
    this.loadRolePermissions();
    this.loadDynamicSchemas();
    this.loadWorkPlanDelegationRoles();
  }

  // --- Role & Permission Mapping Methods ---

  loadRolePermissions() {
    this.settingsService.getRolePermissions().subscribe({
      next: (doc) => {
        if (doc && doc.mapping && Object.keys(doc.mapping).length > 0) {
          this.rolePermissions.set({
            ...DEFAULT_ROLE_PERMISSIONS,
            ...doc.mapping
          });
        } else {
          // Initialize defaults
          this.rolePermissions.set({ ...DEFAULT_ROLE_PERMISSIONS });
        }
      },
      error: (err) => console.error('Error loading role permissions', err)
    });
  }

  selectRole(role: string) {
    this.selectedRole.set(role);
  }

  getRoleDesc(role: string): string {
    switch (role) {
      case 'Super Admin': return 'Global system governance, root security, users & unrestricted access';
      case 'Divisional Admin': return 'Regional division governance, operational directives & cross-team oversight';
      case 'Department Head': return 'Departmental pillar leadership, directive verification & sign-off authority';
      case 'Staff': return 'Daily administrative processing, customer registration & operational tasks';
      case 'HR': return 'Employee lifecycle, staff directory, attendance & payroll management';
      case 'Field Agent': return 'Mobile field inspections, parcel surveys & citizen front-line updates';
      default: return 'Custom system privileges';
    }
  }

  isPermissionEnabled(permId: string): boolean {
    const perms = this.rolePermissions()[this.selectedRole()] || [];
    return perms.includes(permId);
  }

  togglePermission(permId: string) {
    const role = this.selectedRole();
    const currentMap = { ...this.rolePermissions() };
    const perms = [...(currentMap[role] || [])];

    const idx = perms.indexOf(permId);
    if (idx > -1) {
      perms.splice(idx, 1);
    } else {
      perms.push(permId);
    }

    currentMap[role] = perms;
    this.rolePermissions.set(currentMap);
  }

  isModuleFullySelected(mod: ModulePermissionDefinition): boolean {
    const perms = this.rolePermissions()[this.selectedRole()] || [];
    return mod.parts.every(p => perms.includes(p.id));
  }

  isModulePartiallySelected(mod: ModulePermissionDefinition): boolean {
    const perms = this.rolePermissions()[this.selectedRole()] || [];
    const count = mod.parts.filter(p => perms.includes(p.id)).length;
    return count > 0 && count < mod.parts.length;
  }

  getModuleSelectedCount(mod: ModulePermissionDefinition): number {
    const perms = this.rolePermissions()[this.selectedRole()] || [];
    return mod.parts.filter(p => perms.includes(p.id)).length;
  }

  toggleAllInModule(mod: ModulePermissionDefinition) {
    const role = this.selectedRole();
    const currentMap = { ...this.rolePermissions() };
    let perms = [...(currentMap[role] || [])];
    const isAll = this.isModuleFullySelected(mod);

    if (isAll) {
      // Remove all parts of this module
      const partIds = new Set(mod.parts.map(p => p.id));
      perms = perms.filter(id => !partIds.has(id));
    } else {
      // Add all parts of this module
      for (const p of mod.parts) {
        if (!perms.includes(p.id)) {
          perms.push(p.id);
        }
      }
    }

    currentMap[role] = perms;
    this.rolePermissions.set(currentMap);
  }

  selectAllForRole() {
    const role = this.selectedRole();
    const currentMap = { ...this.rolePermissions() };
    currentMap[role] = [...ALL_SYSTEM_PERMISSION_IDS];
    this.rolePermissions.set(currentMap);
    this.snackBar.open(`All permissions granted to ${role}`, 'Dismiss', { duration: 2500 });
  }

  deselectAllForRole() {
    const role = this.selectedRole();
    const currentMap = { ...this.rolePermissions() };
    currentMap[role] = [];
    this.rolePermissions.set(currentMap);
    this.snackBar.open(`All permissions revoked for ${role}`, 'Dismiss', { duration: 2500 });
  }

  resetRoleToDefault() {
    const role = this.selectedRole();
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
    const currentMap = { ...this.rolePermissions() };
    currentMap[role] = [...defaults];
    this.rolePermissions.set(currentMap);
    this.snackBar.open(`Permissions for ${role} reset to system defaults`, 'Dismiss', { duration: 2500 });
  }

  async saveRolePermissions() {
    this.isSavingPermissions.set(true);
    try {
      await this.settingsService.saveRolePermissions(this.rolePermissions());
      this.eventLogService.logAction('UPDATED', 'Settings', 'Updated global Role and Permission mapping matrix');
      this.snackBar.open('Role and Permission mappings saved successfully!', 'Dismiss', { duration: 3500 });
    } catch (e) {
      console.error('Error saving role permissions', e);
      this.snackBar.open('Failed to save role permissions', 'Dismiss', { duration: 3000 });
    } finally {
      this.isSavingPermissions.set(false);
    }
  }

  // --- Dynamic Schemas Logic ---

  loadDynamicSchemas() {
    this.settingsService.getSchemas().subscribe({
      next: (schemas) => {
        this.dynamicSchemas.set(schemas || []);
      },
      error: (err) => console.error('Error loading schemas', err)
    });
  }

  selectSchemaModule(moduleId: string) {
    this.selectedSchemaModule.set(moduleId);
  }

  async addFieldToSchema() {
    if (!this.newFieldName.trim() || !this.newFieldLabel.trim()) {
      this.snackBar.open('Field Name and Field Label are required', 'Dismiss', { duration: 2500 });
      return;
    }

    const fieldKey = this.newFieldName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const newField: DynamicField = {
      name: fieldKey,
      label: this.newFieldLabel.trim(),
      type: this.newFieldType,
      required: this.newFieldRequired
    };

    const mod = this.selectedSchemaModule();
    const existing = this.currentSchema();

    let updatedFields: DynamicField[] = [];
    if (existing) {
      // Check if field already exists
      if (existing.fields.some(f => f.name === fieldKey)) {
        this.snackBar.open(`Field "${fieldKey}" already exists in schema`, 'Dismiss', { duration: 2500 });
        return;
      }
      updatedFields = [...existing.fields, newField];
    } else {
      updatedFields = [newField];
    }

    const schemaToSave: DynamicSchema = {
      id: existing?.id,
      schema_id: `schema_${mod}`,
      target_module: mod,
      fields: updatedFields
    };

    try {
      await this.settingsService.saveSchema(schemaToSave);
      this.snackBar.open(`Field "${newField.label}" added to ${mod} schema`, 'Dismiss', { duration: 3000 });
      this.eventLogService.logAction('CREATED', 'Settings', `Added custom field "${newField.name}" to ${mod} schema`);
      this.newFieldName = '';
      this.newFieldLabel = '';
      this.newFieldType = 'text';
      this.newFieldRequired = false;
    } catch (e) {
      console.error(e);
      this.snackBar.open('Error saving field to schema', 'Dismiss', { duration: 3000 });
    }
  }

  async removeFieldFromSchema(field: DynamicField) {
    const existing = this.currentSchema();
    if (!existing) return;

    if (confirm(`Remove custom field "${field.label}" (${field.name}) from ${existing.target_module} schema?`)) {
      const updatedFields = existing.fields.filter(f => f.name !== field.name);
      try {
        await this.settingsService.saveSchema({
          id: existing.id,
          schema_id: existing.schema_id,
          target_module: existing.target_module,
          fields: updatedFields
        });
        this.snackBar.open(`Field "${field.label}" removed`, 'Dismiss', { duration: 2500 });
        this.eventLogService.logAction('DELETED', 'Settings', `Removed field "${field.name}" from ${existing.target_module}`);
      } catch (e) {
        console.error(e);
        this.snackBar.open('Error removing field from schema', 'Dismiss', { duration: 3000 });
      }
    }
  }

  // --- Department & Division Operations ---

  loadDivisions() {
    this.settingsService.getDivisions().subscribe({
      next: (data) => this.divisions.set(data),
      error: (err) => console.error('Error loading divisions', err)
    });
  }

  loadDepartments() {
    this.settingsService.getDepartments().subscribe({
      next: async (data) => {
        if (!data || data.length === 0) {
          await this.settingsService.seedDefaultDepartmentsIfEmpty(0);
          this.departments.set(this.settingsService.getDefaultSeedDepartments());
        } else {
          this.departments.set(data);
        }
      },
      error: (err) => console.error('Error loading departments', err)
    });
  }

  loadSystemUsers() {
    this.firestoreService.getCollection<SystemUserOption>('users').subscribe({
      next: (users) => this.systemUsers.set(users || []),
      error: (err) => console.error('Error loading system users for typeahead', err)
    });
  }

  onDeptLeadInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.deptLeadName = val;
    this.deptLeadSearch.set(val);
  }

  onDeptLeadFocus() {
    this.deptLeadSearch.set(this.deptLeadName || '');
  }

  onLeadSelected(selected: SystemUserOption | string) {
    if (typeof selected === 'object' && selected) {
      this.deptLeadName = selected.displayName || selected.email;
      this.deptLeadSearch.set(this.deptLeadName);
    } else if (typeof selected === 'string') {
      this.deptLeadName = selected;
      this.deptLeadSearch.set(selected);
    }
  }

  displayLeadFn = (user: any): string => {
    if (!user) return '';
    if (typeof user === 'string') return user;
    return user.displayName || user.email || '';
  };

  getUserInitial(user: SystemUserOption): string {
    if (user?.displayName && user.displayName.length > 0) {
      return user.displayName.charAt(0).toUpperCase();
    }
    if (user?.email && user.email.length > 0) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  }

  getUserRolePreview(user: SystemUserOption): string {
    if (user?.department) return user.department;
    if (user?.roles && user.roles.length > 0) return user.roles[0];
    return 'Staff';
  }

  async addDivision() {
    if (!this.newDivisionName.trim()) return;

    try {
      await this.settingsService.addDivision({ name: this.newDivisionName.trim() });
      this.eventLogService.logAction('CREATED', 'Settings', `Added division "${this.newDivisionName}"`);
      this.snackBar.open(`Division "${this.newDivisionName}" created successfully`, 'Dismiss', { duration: 3000 });
      this.newDivisionName = '';
    } catch (e) {
      console.error(e);
      this.snackBar.open('Error saving division', 'Dismiss', { duration: 3000 });
    }
  }

  async deleteDivision(div: Division) {
    if (!div.id) return;
    if (confirm(`Are you sure you want to remove the division "${div.name}"?`)) {
      try {
        await this.settingsService.deleteDivision(div.id);
        this.eventLogService.logAction('DELETED', 'Settings', `Removed division "${div.name}"`);
        this.snackBar.open(`Division "${div.name}" removed`, 'Dismiss', { duration: 3000 });
      } catch (e) {
        console.error(e);
        this.snackBar.open('Error removing division', 'Dismiss', { duration: 3000 });
      }
    }
  }

  async saveDepartment() {
    if (!this.deptName.trim()) {
      this.snackBar.open('Department Name is required', 'Dismiss', { duration: 2500 });
      return;
    }

    const payload: Department = {
      name: this.deptName.trim(),
      code: this.deptCode.trim().toUpperCase() || this.deptName.trim().substring(0, 4).toUpperCase(),
      description: this.deptDescription.trim(),
      leadName: this.deptLeadName.trim() || 'Unassigned',
      verificationQuota: Number(this.deptVerificationQuota) || 1,
      createdAt: Date.now()
    };

    try {
      if (this.isEditingDepartment() && this.editingDeptId) {
        payload.id = this.editingDeptId;
        await this.settingsService.addDepartment(payload);
        this.eventLogService.logAction('UPDATED', 'Settings', `Updated department "${payload.name}"`);
        this.snackBar.open(`Department "${payload.name}" updated successfully`, 'Dismiss', { duration: 3000 });
      } else {
        await this.settingsService.addDepartment(payload);
        this.eventLogService.logAction('CREATED', 'Settings', `Created department "${payload.name}"`);
        this.snackBar.open(`Department "${payload.name}" created successfully`, 'Dismiss', { duration: 3000 });
      }
      this.resetDepartmentForm();
    } catch (e) {
      console.error(e);
      this.snackBar.open('Error saving department', 'Dismiss', { duration: 3000 });
    }
  }

  editDepartment(dept: Department) {
    this.isEditingDepartment.set(true);
    this.editingDeptId = dept.id || null;
    this.deptName = dept.name;
    this.deptCode = dept.code || '';
    this.deptDescription = dept.description || '';
    this.deptLeadName = dept.leadName || '';
    this.deptLeadSearch.set(dept.leadName || '');
    this.deptVerificationQuota = dept.verificationQuota || 1;
  }

  cancelEditDepartment() {
    this.resetDepartmentForm();
  }

  resetDepartmentForm() {
    this.isEditingDepartment.set(false);
    this.editingDeptId = null;
    this.deptName = '';
    this.deptCode = '';
    this.deptDescription = '';
    this.deptLeadName = '';
    this.deptLeadSearch.set('');
    this.deptVerificationQuota = 1;
  }

  async deleteDepartment(dept: Department) {
    if (!dept.id) return;
    if (confirm(`Are you sure you want to delete the department "${dept.name}"? Users assigned to this department should be reassigned.`)) {
      try {
        await this.settingsService.deleteDepartment(dept.id);
        this.eventLogService.logAction('DELETED', 'Settings', `Deleted department "${dept.name}"`);
        this.snackBar.open(`Department "${dept.name}" deleted`, 'Dismiss', { duration: 3000 });
        if (this.editingDeptId === dept.id) {
          this.resetDepartmentForm();
        }
      } catch (e) {
        console.error(e);
        this.snackBar.open('Error deleting department', 'Dismiss', { duration: 3000 });
      }
    }
  }

  async seedDefaultDepartments() {
    try {
      const defaults = this.settingsService.getDefaultSeedDepartments();
      for (const d of defaults) {
        await this.settingsService.addDepartment(d);
      }
      this.snackBar.open('Default government departments seeded successfully', 'Dismiss', { duration: 3000 });
    } catch (e) {
      console.error(e);
    }
  }

  // --- Work Plan Delegation & On-Behalf Roles ---

  loadWorkPlanDelegationRoles() {
    const s = this.workPlanService.settings();
    if (s.rolesPermittedToCreateOnBehalf && s.rolesPermittedToCreateOnBehalf.length > 0) {
      this.rolesPermittedToCreateOnBehalf.set([...s.rolesPermittedToCreateOnBehalf]);
    }
  }

  isDelegationRolePermitted(role: string): boolean {
    return this.rolesPermittedToCreateOnBehalf().includes(role);
  }

  toggleDelegationRole(role: string) {
    const current = this.rolesPermittedToCreateOnBehalf();
    if (current.includes(role)) {
      this.rolesPermittedToCreateOnBehalf.set(current.filter(r => r !== role));
    } else {
      this.rolesPermittedToCreateOnBehalf.set([...current, role]);
    }
  }

  async saveWorkPlanDelegationRoles() {
    this.isSavingDelegationRoles.set(true);
    try {
      await this.workPlanService.updateSettings({
        rolesPermittedToCreateOnBehalf: this.rolesPermittedToCreateOnBehalf()
      });
      this.eventLogService.logAction('UPDATED', 'Settings', 'Updated work plan on-behalf task delegation & creation roles');
      this.snackBar.open('Work plan delegation roles saved successfully!', 'Dismiss', { duration: 3000 });
    } catch (e) {
      console.error('Error saving delegation roles', e);
      this.snackBar.open('Error saving delegation roles', 'Dismiss', { duration: 3000 });
    } finally {
      this.isSavingDelegationRoles.set(false);
    }
  }
}
