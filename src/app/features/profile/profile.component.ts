import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../auth/auth.service';
import { RbacService } from '../../auth/rbac.service';
import { updateProfile } from '@angular/fire/auth';
import { FirestoreService } from '../../core/services/firestore.service';
import { SettingsService, Department } from '../settings/settings.service';
import { UserRoleDialogComponent } from './user-role-dialog.component';
import { DEFAULT_ROLE_PERMISSIONS, ALL_SYSTEM_PERMISSION_IDS } from '../../core/models/permission.model';

export interface AppUser {
  id?: string;
  email: string;
  displayName: string;
  department?: string;
  user_finger_id?: string;
  roles: string[];
  locations: string[];
  accessible_modules: string[];
  permissions?: string[];
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, MatCardModule, 
    MatTabsModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatTableModule, MatDialogModule, MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  rbacService = inject(RbacService);
  private firestoreService = inject(FirestoreService);
  private settingsService = inject(SettingsService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  profileForm: FormGroup;
  isSaving = signal(false);
  successMessage = signal('');
  
  // Departments from Settings
  departments = signal<Department[]>([]);
  rolePermissions = signal<Record<string, string[]>>({ ...DEFAULT_ROLE_PERMISSIONS });

  // Admin User Management
  allUsers = signal<AppUser[]>([]);
  isLoadingUsers = signal(false);
  displayedColumns: string[] = ['user', 'user_finger_id', 'department', 'roles', 'permissions', 'locations', 'actions'];

  // Available roles for assignment
  availableRoles = [
    'Super Admin',
    'Divisional Admin',
    'Department Head',
    'Staff',
    'HR',
    'Field Agent'
  ];
  availableModules = ['dashboard', 'customers', 'hr', 'land', 'work-plans', 'letters'];
  availableLocations = ['North', 'South', 'East', 'West', 'Central'];

  getRoleChipClass(role: string): string {
    const norm = role.toLowerCase().replace(/[\s_-]+/g, '');
    switch (norm) {
      case 'superadmin': return 'role-super-admin';
      case 'divisionaladmin': return 'role-div-admin';
      case 'departmenthead': return 'role-dept-head';
      case 'hr': return 'role-hr';
      case 'fieldagent': return 'role-field-agent';
      case 'staff': return 'role-staff';
      default: return 'role-default';
    }
  }

  constructor() {
    this.profileForm = this.fb.group({
      displayName: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      department: [''],
      user_finger_id: ['']
    });

    effect(() => {
      const user = this.authService.currentUser();
      const userRoles = this.rbacService.userRoles();
      if (user) {
        this.profileForm.patchValue({
          displayName: user.displayName || '',
          email: user.email || '',
          department: userRoles?.department || '',
          user_finger_id: userRoles?.user_finger_id || ''
        });
      }
    });
  }

  ngOnInit() {
    this.loadDepartments();
    this.loadRolePermissions();
    if (this.rbacService.hasRole('admin')) {
      this.loadAllUsers();
    }
  }

  loadDepartments() {
    this.settingsService.getDepartments().subscribe({
      next: (depts) => this.departments.set(depts),
      error: (err) => console.error('Error loading departments in profile', err)
    });
  }

  loadRolePermissions() {
    this.settingsService.getRolePermissions().subscribe({
      next: (doc) => {
        if (doc && doc.mapping) {
          this.rolePermissions.set({ ...DEFAULT_ROLE_PERMISSIONS, ...doc.mapping });
        }
      },
      error: (err) => console.error('Error loading role permissions in profile', err)
    });
  }

  onTabChange(event: any) {
    if (event.index === 1 && this.allUsers().length === 0) {
      this.loadAllUsers();
    }
  }

  getUserPermCount(user: AppUser): number {
    if (user.roles?.includes('Super Admin')) {
      return ALL_SYSTEM_PERMISSION_IDS.length;
    }
    if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
      return user.permissions.length;
    }
    const mapping = this.rolePermissions();
    const set = new Set<string>();
    for (const r of (user.roles || [])) {
      const perms = mapping[r] || DEFAULT_ROLE_PERMISSIONS[r] || [];
      for (const p of perms) {
        set.add(p);
      }
    }
    return set.size;
  }

  // --- Profile Logic ---
  async saveProfile() {
    if (this.profileForm.invalid) return;
    this.isSaving.set(true);
    this.successMessage.set('');
    
    try {
      const user = this.authService.currentUser();
      if (user) {
        await updateProfile(user, {
          displayName: this.profileForm.value.displayName
        });
        
        const appUser: Partial<AppUser> = {
          displayName: this.profileForm.value.displayName,
          department: this.profileForm.value.department || '',
          user_finger_id: this.profileForm.value.user_finger_id || ''
        };
        await this.firestoreService.updateDocument('users', user.uid, appUser).catch(() => {
          this.firestoreService.setDocument('users', user.uid, {
            email: user.email,
            displayName: this.profileForm.value.displayName,
            department: this.profileForm.value.department || '',
            user_finger_id: this.profileForm.value.user_finger_id || '',
            roles: [],
            locations: [],
            accessible_modules: [],
            permissions: []
          });
        });

        this.successMessage.set('Profile and department updated successfully!');
        setTimeout(() => this.successMessage.set(''), 3000);
      }
    } catch (err) {
      console.error('Error updating profile', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  // --- Admin User Management Logic ---
  loadAllUsers() {
    this.isLoadingUsers.set(true);
    this.firestoreService.getCollection<AppUser>('users').subscribe({
      next: (users) => {
        this.allUsers.set(users);
        this.isLoadingUsers.set(false);
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.isLoadingUsers.set(false);
      }
    });
  }

  openRoleModal(user?: AppUser) {
    const dialogRef = this.dialog.open(UserRoleDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { 
        user,
        availableRoles: this.availableRoles,
        availableLocations: this.availableLocations,
        availableModules: this.availableModules,
        availableDepartments: this.departments(),
        rolePermissionsMapping: this.rolePermissions()
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (user) {
          this.saveUserRoles(user.id!, result);
        } else {
          this.createNewUser(result);
        }
      }
    });
  }

  async createNewUser(formValue: any) {
    try {
      // Create a secondary Firebase App to avoid logging out the admin
      const { initializeApp, deleteApp } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { environment } = await import('../../../environments/environment');

      const secondaryApp = initializeApp(environment.firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);

      // Create user
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formValue.email, formValue.password);
      
      // Update display name
      await updateProfile(userCredential.user, { displayName: formValue.displayName });

      // Save to Firestore 'users' collection using the PRIMARY app's firestoreService
      await this.firestoreService.setDocument('users', userCredential.user.uid, {
        email: formValue.email,
        displayName: formValue.displayName,
        department: formValue.department || '',
        user_finger_id: formValue.user_finger_id || '',
        roles: formValue.roles || [],
        locations: formValue.locations || [],
        accessible_modules: formValue.accessible_modules || [],
        permissions: formValue.permissions || []
      });

      // Cleanup secondary app so it doesn't linger
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);
      
      this.successMessage.set('User created with roles and permissions successfully!');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err: any) {
      console.error('Error creating user:', err);
      alert(err.message || 'Failed to create user. Please try again.');
    }
  }

  async saveUserRoles(userId: string, formValue: any) {
    try {
      const updatePayload: any = {
        department: formValue.department || '',
        user_finger_id: formValue.user_finger_id || '',
        roles: formValue.roles,
        locations: formValue.locations,
        accessible_modules: formValue.accessible_modules,
        permissions: formValue.permissions || []
      };
      if (formValue.displayName) {
        updatePayload.displayName = formValue.displayName;
      }

      await this.firestoreService.updateDocument('users', userId, updatePayload);
      this.successMessage.set('User access, roles & permissions updated successfully!');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err) {
      console.error('Error saving user roles', err);
    }
  }
}
