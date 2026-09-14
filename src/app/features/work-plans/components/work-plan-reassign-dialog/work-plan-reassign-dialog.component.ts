import { Component, Inject, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { WorkPlan, WorkPlanVerifier, WorkPlanService } from '../../services/work-plan.service';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { AuthService } from '../../../../auth/auth.service';
import { EventLogService } from '../../../../core/services/event-log.service';

export interface WorkPlanReassignDialogData {
  plan: WorkPlan;
  stage: WorkPlanVerifier;
}

interface UserOption {
  id?: string;
  displayName: string;
  email: string;
  department?: string;
  roles?: string[];
}

@Component({
  selector: 'app-work-plan-reassign-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dialog-header">
      <div class="header-icon-box">
        <mat-icon>manage_accounts</mat-icon>
      </div>
      <div class="header-text">
        <h2 mat-dialog-title>Reassign Verification Officer</h2>
        <span class="header-sub">
          Directive: <strong>{{ data.plan.title }}</strong> &bull; Stage {{ data.stage.order }}
        </span>
      </div>
    </div>

    <mat-dialog-content class="dialog-content">
      <!-- Current Assignment Context Banner -->
      <div class="current-officer-card">
        <div class="card-left">
          <span class="stage-tag">Current Stage {{ data.stage.order }} Assignee</span>
          <div class="officer-name-row">
            <mat-icon class="officer-icon">person</mat-icon>
            <span class="officer-name">{{ data.stage.name || 'Unassigned' }}</span>
            <span class="officer-email" *ngIf="data.stage.email">({{ data.stage.email }})</span>
          </div>
          <span class="dept-sub" *ngIf="data.stage.department">Department: {{ data.stage.department }}</span>
        </div>
        <div class="card-badge">
          <mat-icon>lock</mat-icon>
          <span>Awaiting Sign-Off</span>
        </div>
      </div>

      <!-- Info Alert -->
      <div class="info-alert">
        <mat-icon class="alert-icon">info</mat-icon>
        <span>
          Reassignment transfers stage sign-off authority to another authorized officer (e.g. due to leave, transfer, or emergency absence). An audit entry will be permanently logged.
        </span>
      </div>

      <!-- Reassignment Form -->
      <div class="reassign-form">
        <!-- New Officer Name Input with Autocomplete -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>New Verification Officer</mat-label>
          <input matInput
                 [(ngModel)]="officerName"
                 [matAutocomplete]="autoUser"
                 (input)="onNameInput($event)"
                 (focus)="onNameFocus()"
                 placeholder="Search officer name or email..."
                 autocomplete="off"
                 required>
          <mat-icon matSuffix>search</mat-icon>

          <mat-autocomplete #autoUser="matAutocomplete"
                            [displayWith]="displayUserFn"
                            (optionSelected)="onUserSelected($event.option.value)">
            <mat-option *ngFor="let user of filteredUsers()" [value]="user">
              <div class="user-autocomplete-item">
                <div class="user-avatar-sm">
                  {{ getUserInitial(user) }}
                </div>
                <div class="user-text-wrap">
                  <div class="user-primary-name">
                    {{ user.displayName || user.email }}
                  </div>
                  <div class="user-sub-details">
                    <span class="user-email-text">{{ user.email }}</span>
                    <span class="user-dept-badge" *ngIf="user.department">
                      {{ user.department }}
                    </span>
                  </div>
                </div>
              </div>
            </mat-option>
            <mat-option *ngIf="filteredUsers().length === 0" disabled>
              <span class="no-users-hint">No matching officers found</span>
            </mat-option>
          </mat-autocomplete>
        </mat-form-field>

        <!-- New Officer Email Input -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Official Email Address</mat-label>
          <input matInput
                 type="email"
                 [(ngModel)]="officerEmail"
                 placeholder="officer@network.gov"
                 required>
          <mat-icon matSuffix>mail</mat-icon>
          <mat-hint>Must be a valid official email address</mat-hint>
        </mat-form-field>

        <!-- Reason / Justification Note Textarea -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Administrative Justification / Reason</mat-label>
          <textarea matInput
                    [(ngModel)]="reason"
                    rows="3"
                    placeholder="Specify administrative reason (e.g., Original officer on medical leave / inter-departmental delegation)..."
                    required></textarea>
          <mat-hint>Mandatory audit justification (minimum 5 characters)</mat-hint>
        </mat-form-field>

        <!-- Maker-Checker Self-Verification Conflict Alert -->
        <div class="conflict-alert" *ngIf="hasSelfVerificationConflict()">
          <mat-icon class="conflict-icon">gavel</mat-icon>
          <span>
            <strong>Maker-Checker Policy Violation:</strong> The task owner ({{ data.plan.ownerName || data.plan.ownerEmail }}) cannot be assigned as a verification officer for their own work plan.
          </span>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-footer">
      <button mat-stroked-button mat-dialog-close [disabled]="isSubmitting()">
        Cancel
      </button>
      <button mat-flat-button
              color="primary"
              [disabled]="!isValid() || isSubmitting()"
              [matTooltip]="getValidationTooltip()"
              (click)="onConfirmReassignment()">
        <mat-icon>{{ isSubmitting() ? 'hourglass_empty' : 'how_to_reg' }}</mat-icon>
        Confirm Reassignment
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 14px 24px;
      border-bottom: 1px solid var(--border-subtle, #e2e8f0);
      background-color: #fafbfc;

      .header-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #e0e7ff;
        color: #4338ca;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;

        h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          padding: 0;
        }

        .header-sub {
          font-size: 12px;
          color: #64748b;
        }
      }
    }

    .dialog-content {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 480px;
      max-width: 560px;

      @media (max-width: 600px) {
        min-width: 100%;
      }
    }

    .current-officer-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;

      .card-left {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .stage-tag {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #6366f1;
        }

        .officer-name-row {
          display: flex;
          align-items: center;
          gap: 6px;

          .officer-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #64748b;
          }

          .officer-name {
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
          }

          .officer-email {
            font-size: 12px;
            color: #64748b;
          }
        }

        .dept-sub {
          font-size: 11.5px;
          color: #64748b;
        }
      }

      .card-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #fef3c7;
        border: 1px solid #fde68a;
        color: #92400e;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;

        mat-icon {
          font-size: 13px;
          width: 13px;
          height: 13px;
        }
      }
    }

    .info-alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      color: #0369a1;
      line-height: 1.4;

      .alert-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #0284c7;
        flex-shrink: 0;
        margin-top: 1px;
      }
    }

    .reassign-form {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .w-full {
        width: 100%;
      }
    }

    .conflict-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
      color: #991b1b;

      .conflict-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #dc2626;
        flex-shrink: 0;
      }
    }

    .user-autocomplete-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;

      .user-avatar-sm {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #3730a3;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .user-text-wrap {
        display: flex;
        flex-direction: column;
        gap: 1px;

        .user-primary-name {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }

        .user-sub-details {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #64748b;

          .user-dept-badge {
            background: #f1f5f9;
            padding: 1px 4px;
            border-radius: 4px;
            font-size: 10px;
          }
        }
      }
    }

    .dialog-footer {
      padding: 14px 24px;
      border-top: 1px solid var(--border-subtle, #e2e8f0);
      background-color: #fafbfc;
      display: flex;
      gap: 10px;
    }
  `]
})
export class WorkPlanReassignDialogComponent {
  private workPlanService = inject(WorkPlanService);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);
  private snackBar = inject(MatSnackBar);

  officerName = '';
  officerEmail = '';
  officerRole = '';
  officerDepartment = '';
  reason = '';
  isSubmitting = signal<boolean>(false);

  systemUsers = signal<UserOption[]>([]);
  searchQuery = signal<string>('');

  filteredUsers = computed(() => {
    const q = (this.searchQuery() || '').toLowerCase().trim();
    const users = this.systemUsers();
    if (!q) return users;
    return users.filter(u => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const dept = (u.department || '').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: WorkPlanReassignDialogData,
    public dialogRef: MatDialogRef<WorkPlanReassignDialogComponent>
  ) {
    this.loadSystemUsers();
  }

  loadSystemUsers() {
    const userMap = new Map<string, UserOption>();

    const addUser = (u: UserOption) => {
      const key = (u.email || u.displayName || '').toLowerCase().trim();
      if (!key) return;
      if (!userMap.has(key)) {
        userMap.set(key, u);
      }
    };

    // Prepopulate known system officers
    const DEFAULT_SYSTEM_OFFICERS: UserOption[] = [
      { displayName: 'Chief Surveyor', email: 'chief.surveyor@lands.gov.lk', department: 'Survey & Cadastral Mapping', roles: ['Department Head', 'Verification Officer'] },
      { displayName: 'Registrar of Titles', email: 'registrar.titles@lands.gov.lk', department: 'Land Administration & Titles', roles: ['Department Head', 'Verification Officer'] },
      { displayName: 'Director of Planning', email: 'director.planning@gov.lk', department: 'Planning & Urban Development', roles: ['Department Head', 'Verification Officer'] },
      { displayName: 'Senior Legal Counsel', email: 'legal.counsel@gov.lk', department: 'Legal & Regulatory Affairs', roles: ['Department Head', 'Verification Officer'] },
      { displayName: 'Financial Controller', email: 'financial.controller@gov.lk', department: 'Finance & Asset Management', roles: ['Department Head', 'Verification Officer'] },
      { displayName: 'Senior Audit Officer', email: 'audit.officer@audit.gov.lk', department: 'Compliance', roles: ['Department Head', 'Verification Officer'] },
      { displayName: 'Director General', email: 'dg@central.gov.lk', department: 'Central Operations', roles: ['Super Admin', 'Divisional Admin'] },
      { displayName: 'Divisional Secretary', email: 'divisional.sec@central.gov.lk', department: 'Central Operations', roles: ['Divisional Admin', 'Department Head'] },
      { displayName: 'Operations Lead Officer', email: 'ops.lead@gov.lk', department: 'Operations', roles: ['Regional Lead', 'Verification Officer'] },
      { displayName: 'Senior Land Registrar', email: 'registrar.land@lands.gov.lk', department: 'Land Deeds', roles: ['Verification Officer'] }
    ];
    DEFAULT_SYSTEM_OFFICERS.forEach(addUser);

    // Harvest from Firestore users
    this.firestoreService.getCollection<UserOption>('users').subscribe({
      next: (users) => {
        (users || []).forEach(u => {
          if (u.email || u.displayName) {
            addUser({
              id: u.id,
              displayName: u.displayName || u.email,
              email: u.email,
              department: u.department || '',
              roles: u.roles || []
            });
          }
        });
        this.systemUsers.set(Array.from(userMap.values()));
      },
      error: () => {
        this.systemUsers.set(Array.from(userMap.values()));
      }
    });

    this.systemUsers.set(Array.from(userMap.values()));
  }

  onNameInput(event: Event) {
    const val = (event.target as HTMLInputElement).value || '';
    this.searchQuery.set(val);
    const match = this.systemUsers().find(u =>
      (u.displayName && u.displayName.toLowerCase() === val.toLowerCase()) ||
      (u.email && u.email.toLowerCase() === val.toLowerCase())
    );
    if (match && match.email) {
      this.officerEmail = match.email;
      this.officerRole = match.roles?.[0] || 'Verification Officer';
      this.officerDepartment = match.department || '';
    }
  }

  onNameFocus() {
    this.searchQuery.set('');
  }

  onUserSelected(selected: UserOption | string) {
    if (typeof selected === 'object' && selected) {
      this.officerName = selected.displayName || selected.email;
      this.officerEmail = selected.email || '';
      this.officerRole = selected.roles?.[0] || 'Verification Officer';
      this.officerDepartment = selected.department || '';
      this.searchQuery.set(this.officerName);
    } else if (typeof selected === 'string') {
      this.officerName = selected;
      this.searchQuery.set(selected);
    }
  }

  displayUserFn = (user: any): string => {
    if (!user) return '';
    if (typeof user === 'string') return user;
    return user.displayName || user.email || '';
  };

  getUserInitial(user: UserOption): string {
    if (user?.displayName && user.displayName.length > 0) {
      return user.displayName.charAt(0).toUpperCase();
    }
    if (user?.email && user.email.length > 0) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'O';
  }

  hasSelfVerificationConflict(): boolean {
    const plan = this.data.plan;
    const targetEmail = (this.officerEmail || '').toLowerCase().trim();
    const targetName = (this.officerName || '').toLowerCase().trim();

    if (!targetEmail && !targetName) return false;

    const ownerEmail = (plan.ownerEmail || plan.createdByEmail || '').toLowerCase().trim();
    const ownerName = (plan.ownerName || plan.createdByName || '').toLowerCase().trim();

    if (targetEmail && ownerEmail) {
      if (targetEmail === ownerEmail) return true;
      const tPrefix = targetEmail.split('@')[0];
      const oPrefix = ownerEmail.split('@')[0];
      if (tPrefix && oPrefix && tPrefix === oPrefix) return true;
    }

    if (targetName && ownerName) {
      const normT = targetName.replace(/\s+/g, ' ');
      const normO = ownerName.replace(/\s+/g, ' ');
      if (normT === normO) return true;
    }

    return false;
  }

  isValid(): boolean {
    const hasName = !!this.officerName && this.officerName.trim().length > 0;
    const hasEmail = !!this.officerEmail && this.officerEmail.trim().includes('@');
    const hasReason = !!this.reason && this.reason.trim().length >= 5;
    const noConflict = !this.hasSelfVerificationConflict();
    return hasName && hasEmail && hasReason && noConflict;
  }

  getValidationTooltip(): string {
    if (!this.officerName?.trim()) {
      return 'Please enter or select a new verification officer';
    }
    if (!this.officerEmail?.trim() || !this.officerEmail.includes('@')) {
      return 'Please specify a valid official email address';
    }
    if (!this.reason?.trim() || this.reason.trim().length < 5) {
      return 'Please enter a justification reason of at least 5 characters';
    }
    if (this.hasSelfVerificationConflict()) {
      return 'Maker-Checker policy: Task owner cannot verify their own work plan';
    }
    return '';
  }

  async onConfirmReassignment() {
    if (!this.isValid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    const curUser = this.authService.currentUser();
    const plan = this.data.plan;
    const stage = this.data.stage;

    try {
      await this.workPlanService.reassignStageVerifier(
        plan.id!,
        stage.order,
        {
          name: this.officerName.trim(),
          email: this.officerEmail.trim(),
          role: this.officerRole || 'Verification Officer',
          department: this.officerDepartment || plan.department || plan.division || ''
        },
        this.reason.trim(),
        {
          name: curUser?.displayName || '',
          email: curUser?.email || ''
        }
      );

      // Audit Log
      try {
        this.eventLogService.logAction(
          'UPDATED',
          'WorkPlan',
          `Reassigned Stage ${stage.order} verifier on directive "${plan.title}" from "${stage.name}" to "${this.officerName.trim()}" (${this.officerEmail.trim()}). Reason: ${this.reason.trim()}`
        );
      } catch {}

      this.snackBar.open(
        `Stage ${stage.order} verification officer successfully reassigned to ${this.officerName.trim()}`,
        'Close',
        { duration: 4000 }
      );

      this.dialogRef.close({ reassigned: true });
    } catch (e) {
      console.error('Failed to reassign officer:', e);
      this.snackBar.open('Error reassigning officer. Please try again.', 'Close', { duration: 4000 });
      this.isSubmitting.set(false);
    }
  }
}
