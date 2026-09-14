import { Component, Inject, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkPlan, WorkPlanMilestone, WorkPlanService, WorkPlanVerifier } from '../../services/work-plan.service';
import { Division, Department, SettingsService } from '../../../settings/settings.service';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { AuthService } from '../../../../auth/auth.service';
import { RbacService } from '../../../../auth/rbac.service';

export interface SystemUserOption {
  id?: string;
  displayName: string;
  email: string;
  roles?: string[];
  department?: string;
}

@Component({
  selector: 'app-work-plan-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-header">
      <div class="header-title-wrap">
        <mat-icon class="dialog-icon">{{ data.plan ? 'edit_note' : 'post_add' }}</mat-icon>
        <div>
          <h2 mat-dialog-title>{{ data.plan ? 'Edit Work Plan Directive' : 'Create New Work Plan' }}</h2>
          <p class="dialog-sub">Multi-division strategic directive & regional task tracking</p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content class="dialog-scroll-body">
      <form [formGroup]="planForm" class="dialog-form">

        <!-- Directive Title -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Directive / Project Title</mat-label>
          <input matInput formControlName="title" placeholder="e.g., Regional Cadastral Boundary Survey" required>
        </mat-form-field>

        <!-- Description / Brief -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Operational Description & Objectives</mat-label>
          <textarea matInput formControlName="description" rows="3" placeholder="Provide detailed scope, objectives, and deliverables..." required></textarea>
        </mat-form-field>

        <!-- Four Fields: Division, Department, Category & Target Month -->
        <div class="form-grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Office Division</mat-label>
            <mat-select formControlName="division" required>
              <mat-option *ngFor="let div of (data.divisions || [])" [value]="div.name">{{ div.name }}</mat-option>
              <mat-option *ngIf="!data.divisions || data.divisions.length === 0" value="Central Operations">Central Operations</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Department</mat-label>
            <mat-select formControlName="department">
              <mat-option value="">-- None / Default --</mat-option>
              <mat-option *ngFor="let dept of departments()" [value]="dept.name">{{ dept.name }}</mat-option>
            </mat-select>
            <mat-hint *ngIf="isDepartmentLocked()" class="dept-locked-hint">
              <mat-icon class="lock-icon-sm">lock</mat-icon> Locked: Verifications already commenced
            </mat-hint>
          </mat-form-field>
        </div>

        <div class="form-grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Operational Pillar</mat-label>
            <mat-select formControlName="category" required>
              <mat-option value="Infrastructure">Infrastructure & Nodes</mat-option>
              <mat-option value="Land Deeds">Land Deeds & Registry</mat-option>
              <mat-option value="Client Services">Client Services & KYC</mat-option>
              <mat-option value="Operations">Operations & Dispatch</mat-option>
              <mat-option value="Compliance">Auditing & Compliance</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Execution Month Cycle</mat-label>
            <input matInput [matDatepicker]="monthPicker" formControlName="assignedMonthDate" placeholder="Pick month" (click)="monthPicker.open()" readonly required>
            <mat-datepicker-toggle matIconSuffix [for]="monthPicker"></mat-datepicker-toggle>
            <mat-datepicker #monthPicker startView="multi-year" (monthSelected)="setMonthAndYear($event, monthPicker)"></mat-datepicker>
          </mat-form-field>
        </div>

        <!-- Assignment Lock Indicator (if non-permitted role) -->
        <div class="field-restriction-banner" *ngIf="isAssignmentLocked">
          <mat-icon class="lock-icon">lock</mat-icon>
          <span>Officer assignment and scope specs are locked to oversight roles (configured in Work Plan Settings).</span>
        </div>

        <!-- On-Behalf Task Creation (Permitted Roles): Select Owner and Verification Lead -->
        <ng-container *ngIf="canCreateOnBehalf()">
          <div class="field-section-banner">
            <div class="section-badge">
              <mat-icon class="section-icon">supervisor_account</mat-icon>
              <span>On-Behalf Task Assignment & Verification Routing</span>
            </div>
            <span class="section-desc">You have permission to create this task on behalf of another officer. The task will belong to the designated assignee.</span>
          </div>

          <!-- Task Belongs To (Assignee / Performer) & Performer Email -->
          <div class="form-grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Task Belongs To (Assignee / Performer)</mat-label>
              <input matInput 
                     formControlName="ownerName" 
                     [matAutocomplete]="autoOwner" 
                     (input)="onOwnerInput($event)"
                     (focus)="onOwnerFocus()"
                     placeholder="Search officer task belongs to..." 
                     autocomplete="off"
                     required>
              <mat-icon matSuffix>badge</mat-icon>
              
              <mat-autocomplete #autoOwner="matAutocomplete" 
                                [displayWith]="displayLeadFn"
                                (optionSelected)="onOwnerSelected($event.option.value)">
                <mat-option *ngFor="let user of filteredOwnerUsers()" [value]="user">
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
                        <span class="user-role-badge" *ngIf="user.roles && user.roles.length > 0">
                          {{ user.roles[0] }}
                        </span>
                      </div>
                    </div>
                  </div>
                </mat-option>
                <mat-option *ngIf="filteredOwnerUsers().length === 0" disabled>
                  <span class="no-users-hint">No matching system users found</span>
                </mat-option>
              </mat-autocomplete>
              <mat-hint>Whom the task belongs to (shown in their "My directives" list)</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Assignee Email Address</mat-label>
              <input matInput type="email" formControlName="ownerEmail" placeholder="officer@network.gov">
              <mat-icon matSuffix>email</mat-icon>
              <mat-hint class="auto-hint" *ngIf="isOwnerEmailAutoFilled()">
                <mat-icon class="hint-icon">auto_awesome</mat-icon> Auto-linked to performer
              </mat-hint>
            </mat-form-field>
          </div>
        </ng-container>

        <!-- Standard User: Task Belongs to Self -->
        <ng-container *ngIf="!canCreateOnBehalf()">
          <div class="self-owner-strip">
            <div class="owner-pill">
              <mat-icon class="owner-icon">person</mat-icon>
              <span>Task Owner: <strong>{{ planForm.get('ownerName')?.value || 'You' }}</strong> (Task Belongs to You)</span>
            </div>
            <span class="owner-desc">This task will appear under your personal directives in "My directives only".</span>
          </div>
        </ng-container>

        <!-- Verification Pipeline & Multi-Officer Quota Section -->
        <div class="verifiers-section-container">
          <div class="field-section-banner verifiers-banner">
            <div class="section-left">
              <div class="section-badge">
                <mat-icon class="section-icon">verified_user</mat-icon>
                <span>Verification Officers Pipeline</span>
              </div>
              <span class="section-desc">
                Designate the verification officers where the task goes for review & sign-off.
                All assigned officers must review and approve before the task can be marked Complete.
              </span>
            </div>
            <div class="dept-policy-badge" [class.multi]="requiredVerifiersCount() > 1">
              <mat-icon class="policy-icon">{{ requiredVerifiersCount() > 1 ? 'groups' : 'verified' }}</mat-icon>
              <span>{{ planForm.get('department')?.value || 'Department' }}: {{ requiredVerifiersCount() }} Required</span>
            </div>
          </div>

          <!-- Verifier Stages List -->
          <div class="verifier-stages-list">
            <div class="verifier-stage-card" *ngFor="let verifier of verifiers(); let i = index; trackBy: trackByVerifierId">
              <div class="stage-card-header">
                <div class="stage-tag-group">
                  <span class="stage-number-pill" [class.approved]="verifier.verified">
                    Stage {{ i + 1 }}
                  </span>
                  <span class="stage-label-text">
                    {{ i === 0 ? 'Primary Verification Officer (Lead)' : ('Stage ' + (i + 1) + ' Secondary Sign-Off Officer') }}
                  </span>
                  <span class="stage-status-badge" *ngIf="verifier.verified">
                    <mat-icon class="status-badge-icon">check_circle</mat-icon> Signed Off
                  </span>
                </div>

                <button mat-icon-button type="button" class="remove-stage-btn" 
                        *ngIf="verifiers().length > requiredVerifiersCount() && !verifier.verified && !isAssignmentLocked"
                        (click)="removeVerifierStage(i)"
                        matTooltip="Remove optional stage">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>

              <!-- Verifier Inputs -->
              <div class="form-grid-2">
                <mat-form-field appearance="outline">
                  <mat-label>{{ i === 0 ? 'Primary Verification Officer' : ('Stage ' + (i + 1) + ' Verification Officer') }}</mat-label>
                  <input matInput 
                         [(ngModel)]="verifier.name"
                         [ngModelOptions]="{standalone: true}"
                         [matAutocomplete]="autoV"
                         (input)="onVerifierInput(i, $event)"
                         (focus)="onVerifierFocus(i)"
                         (blur)="onVerifierBlur(i)"
                         placeholder="Search or enter verification officer..."
                         autocomplete="off"
                         [disabled]="isAssignmentLocked || verifier.verified"
                         required>
                  <mat-icon matSuffix>verified_user</mat-icon>

                  <mat-autocomplete #autoV="matAutocomplete"
                                    [displayWith]="displayLeadFn"
                                    (optionSelected)="onVerifierSelected(i, $event.option.value)">
                    <mat-option *ngFor="let u of getFilteredUsersForStage(i)" [value]="u">
                      <div class="user-autocomplete-item">
                        <div class="user-avatar-sm">{{ getUserInitial(u) }}</div>
                        <div class="user-text-wrap">
                          <div class="user-primary-name">{{ u.displayName || u.email }}</div>
                          <div class="user-sub-details">
                            <span class="user-email-text">{{ u.email }}</span>
                            <span class="user-dept-badge" *ngIf="u.department">{{ u.department }}</span>
                            <span class="user-role-badge" *ngIf="u.roles && u.roles.length > 0">{{ u.roles[0] }}</span>
                          </div>
                        </div>
                      </div>
                    </mat-option>
                    <mat-option *ngIf="getFilteredUsersForStage(i).length === 0" disabled>
                      <span class="no-users-hint">No matching system users found</span>
                    </mat-option>
                  </mat-autocomplete>
                  <mat-hint>Audits & verifies Stage {{ i + 1 }}</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Officer Email Address</mat-label>
                  <input matInput type="email" 
                         [(ngModel)]="verifier.email"
                         [ngModelOptions]="{standalone: true}"
                         (input)="onVerifierEmailInput(i, $event)"
                         placeholder="officer@network.gov"
                         [disabled]="isAssignmentLocked || verifier.verified">
                  <mat-icon matSuffix>email</mat-icon>
                  <mat-hint class="auto-hint" *ngIf="verifier.email">
                    <mat-icon class="hint-icon">auto_awesome</mat-icon> Auto-linked
                  </mat-hint>
                </mat-form-field>
              </div>

              <!-- Prior Review Comment if already reviewed -->
              <div class="verifier-comment-preview" *ngIf="verifier.reviewComment">
                <mat-icon class="comment-icon">rate_review</mat-icon>
                <div class="comment-text">
                  <span class="comment-author">Audit Comment from {{ verifier.name }} ({{ verifier.verifiedAt | date:'mediumDate' }}):</span>
                  <p class="comment-body">"{{ verifier.reviewComment }}"</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Add extra verifier stage button -->
          <div class="add-stage-bar" *ngIf="!isAssignmentLocked && verifiers().length < 5">
            <button mat-stroked-button type="button" class="add-stage-btn" (click)="addVerifierStage()">
              <mat-icon>person_add</mat-icon> + Add Another Verification Officer (Stage {{ verifiers().length + 1 }})
            </button>
          </div>

          <!-- Alert if incomplete verifiers or missing emails -->
          <div class="verifier-warning-alert" *ngIf="!areVerifiersValid() && !hasSelfVerificationConflict()">
            <mat-icon class="warn-icon">warning_amber</mat-icon>
            <span>
              <strong>Verification Officers Required:</strong> Please specify all {{ requiredVerifiersCount() }} required verification officer(s) with valid official email addresses.
            </span>
          </div>

          <!-- Maker-Checker Self-Verification Conflict Alert -->
          <div class="verifier-warning-alert conflict" *ngIf="hasSelfVerificationConflict()">
            <mat-icon class="warn-icon">gavel</mat-icon>
            <span>
              <strong>Maker-Checker Policy Violation:</strong> The task owner ({{ planForm.get('ownerName')?.value || 'Assignee' }}) cannot verify their own work plan. Please assign an independent verification officer.
            </span>
          </div>
        </div>

        <!-- Two Column: Priority & Status -->
        <div class="form-grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Priority Level</mat-label>
            <mat-select formControlName="priority" required>
              <mat-option value="Urgent">Urgent Priority</mat-option>
              <mat-option value="High">High Priority</mat-option>
              <mat-option value="Medium">Medium Priority</mat-option>
              <mat-option value="Low">Low Priority</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Execution Status</mat-label>
            <mat-select formControlName="status" required>
              <mat-option value="Draft">Draft & Planning</mat-option>
              <mat-option value="In Progress">In Progress</mat-option>
              <mat-option value="Under Review">Under Review (Pending Verification)</mat-option>
              <mat-option value="Completed" *ngIf="canAccessVerification() || planForm.get('status')?.value === 'Completed'">Completed (Audit Approved)</mat-option>
              <mat-option value="Delayed">Delayed / Blocked</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Two Column: Start Date & Target Due Date with Material Calendar -->
        <div class="form-grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Start Date</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="startDate" placeholder="Select start date" (click)="startPicker.open()" required>
            <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
            <mat-datepicker #startPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Target Due Date</mat-label>
            <input matInput [matDatepicker]="targetPicker" formControlName="targetDate" placeholder="Select target due date" (click)="targetPicker.open()" required>
            <mat-datepicker-toggle matIconSuffix [for]="targetPicker"></mat-datepicker-toggle>
            <mat-datepicker #targetPicker></mat-datepicker>
          </mat-form-field>
        </div>

        <!-- Date Chronology Error Alert -->
        <div class="date-order-alert" *ngIf="planForm.errors?.['targetBeforeStart'] && (planForm.get('targetDate')?.touched || submitted())">
          <mat-icon class="date-alert-icon">event_busy</mat-icon>
          <span>Target completion date cannot be earlier than start date ({{ formatDateString(planForm.get('startDate')?.value) }}).</span>
        </div>

        <!-- Two Column: Budget Allocation & Completion Slider -->
        <div class="form-grid-2">
          <mat-form-field appearance="outline">
            <mat-label>Allocated Budget (LKR)</mat-label>
            <input matInput type="number" formControlName="budget" min="0" placeholder="e.g. 500000">
            <span matPrefix>LKR&nbsp;</span>
            <mat-hint>Optional</mat-hint>
          </mat-form-field>

          <div class="slider-field">
            <div class="slider-header">
              <span class="slider-label">Progress: <strong>{{ planForm.get('progress')?.value }}%</strong></span>
            </div>
            <mat-slider min="0" max="100" step="5" discrete>
              <input matSliderThumb formControlName="progress">
            </mat-slider>
          </div>
        </div>

        <mat-divider class="my-3"></mat-divider>

        <!-- Dynamic Milestones Checklist -->
        <div class="milestones-section" [class.has-error]="submitted() && milestones().length === 0">
          <div class="milestones-header">
            <div>
              <h3>Milestones & Deliverables <span class="required-star">*</span></h3>
              <p class="section-sub">At least one milestone deliverable is required to publish this directive</p>
            </div>
            <span class="milestone-counter" [class.empty]="milestones().length === 0">
              {{ milestones().length }} Added {{ milestones().length === 0 ? '(Required)' : '' }}
            </span>
          </div>

          <!-- Add milestone input row -->
          <div class="add-milestone-bar">
            <input type="text" [(ngModel)]="newMilestoneTitle" [ngModelOptions]="{standalone: true}" 
                   placeholder="Add a key milestone or deliverable..." (keyup.enter)="addMilestone()" class="milestone-input">
            <button mat-flat-button color="primary" type="button" (click)="addMilestone()" [disabled]="!newMilestoneTitle.trim()">
              <mat-icon>add</mat-icon> Add
            </button>
          </div>

          <!-- Alert banner when no milestones exist -->
          <div class="milestone-required-alert" *ngIf="milestones().length === 0">
            <mat-icon class="alert-icon">info</mat-icon>
            <span>Please add at least one deliverable milestone before publishing this work plan.</span>
          </div>

          <!-- Milestones List -->
          <div class="milestone-items" *ngIf="milestones().length > 0">
            <div class="milestone-row" *ngFor="let m of milestones(); let i = index">
              <button mat-icon-button type="button" (click)="toggleMilestone(i)" class="check-toggle-btn"
                      [class.checked]="m.completed">
                <mat-icon>{{ m.completed ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              </button>
              <span class="milestone-text" [class.done]="m.completed">{{ m.title }}</span>
              <button mat-icon-button type="button" (click)="removeMilestone(i)" class="del-btn" matTooltip="Remove">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-footer">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" 
              [disabled]="planForm.invalid || milestones().length === 0 || !areVerifiersValid()" 
              [matTooltip]="getSaveTooltip()"
              (click)="onSave()">
        <mat-icon>save</mat-icon> {{ data.plan ? 'Save Changes' : 'Publish Work Plan' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px 12px 24px;
      border-bottom: 1px solid var(--border-subtle);
      background-color: #fafbfc;

      .header-title-wrap {
        display: flex;
        align-items: center;
        gap: 12px;

        .dialog-icon {
          color: var(--brand-indigo);
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .dialog-sub {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: var(--text-muted);
        }
      }

      .close-btn {
        color: var(--text-subtle);
      }
    }

    .dialog-scroll-body {
      max-height: 72vh;
      overflow-y: auto;
      padding: 20px 24px !important;
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .field-restriction-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: #fefce8;
      border: 1px solid #fef08a;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: #854d0e;

      .lock-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #ca8a04;
        flex-shrink: 0;
      }
    }

    .field-section-banner {
      display: flex;
      flex-direction: column;
      gap: 3px;
      background-color: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 8px;
      padding: 10px 14px;

      .section-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #7e22ce;

        .section-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .section-desc {
        font-size: 11.5px;
        color: #6b21a8;
        line-height: 1.35;
      }
    }

    .self-owner-strip {
      display: flex;
      flex-direction: column;
      gap: 3px;
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 14px;

      .owner-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: #166534;

        .owner-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #16a34a;
        }
      }

      .owner-desc {
        font-size: 11.5px;
        color: #15803d;
        line-height: 1.35;
      }
    }

    .w-full {
      width: 100%;
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }

    .form-grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }

    .slider-field {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 4px;

      .slider-header {
        display: flex;
        justify-content: space-between;
        font-size: 12.5px;
        color: var(--text-secondary);
        margin-bottom: 2px;
        strong {
          color: var(--brand-indigo);
        }
      }
    }

    .milestones-section {
      background-color: var(--canvas-bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-button);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .milestones-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;

        h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);

          .required-star {
            color: #ef4444;
            font-weight: 700;
            margin-left: 3px;
          }
        }

        .section-sub {
          margin: 2px 0 0 0;
          font-size: 11.5px;
          color: var(--text-muted);
        }

        .milestone-counter {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          background-color: var(--border-subtle);
          color: var(--text-secondary);
          font-weight: 600;

          &.empty {
            background-color: #fee2e2;
            color: #b91c1c;
            border: 1px solid #fca5a5;
          }
        }
      }

      &.has-error {
        border-color: #f87171;
        background-color: #fffaf0;
      }

      .milestone-required-alert {
        display: flex;
        align-items: center;
        gap: 8px;
        background-color: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        color: #c2410c;
        font-weight: 500;

        .alert-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #ea580c;
        }
      }

      .add-milestone-bar {
        display: flex;
        gap: 8px;

        .milestone-input {
          flex: 1;
          height: 38px;
          border-radius: var(--radius-button);
          border: 1px solid var(--border-subtle);
          padding: 0 12px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          background: #ffffff;
          outline: none;

          &:focus {
            border-color: var(--brand-accent);
          }
        }

        button {
          height: 38px;
        }
      }

      .milestone-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 180px;
        overflow-y: auto;

        .milestone-row {
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          padding: 2px 8px;
          gap: 8px;

          .check-toggle-btn {
            color: var(--text-subtle);
            width: 28px;
            height: 28px;
            line-height: 28px;

            &.checked {
              color: var(--accent-emerald);
            }

            mat-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
            }
          }

          .milestone-text {
            flex: 1;
            font-size: 13px;
            color: var(--text-primary);

            &.done {
              text-decoration: line-through;
              color: var(--text-subtle);
            }
          }

          .del-btn {
            color: var(--text-subtle);
            width: 28px;
            height: 28px;
            line-height: 28px;

            &:hover {
              color: var(--accent-coral);
            }

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
            }
          }
        }
      }
    }

    /* User Autocomplete Typeahead */
    .user-autocomplete-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 0;

      .user-avatar-sm {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background-color: var(--brand-tint);
        color: var(--brand-indigo);
        font-size: 11.5px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .user-text-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;

        .user-primary-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .user-sub-details {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-muted);

          .user-email-text {
            color: var(--text-secondary);
          }

          .user-dept-badge {
            background-color: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 1px 5px;
            font-size: 10px;
            color: #334155;
            font-weight: 500;
          }

          .user-role-badge {
            background-color: #e0e7ff;
            border: 1px solid #c7d2fe;
            border-radius: 4px;
            padding: 1px 5px;
            font-size: 10px;
            color: #3730a3;
            font-weight: 600;
          }
        }
      }
    }

    .no-users-hint {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }

    .auto-hint {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--brand-indigo) !important;
      font-weight: 600;
      font-size: 11px !important;

      .hint-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }
    }

    /* Verifiers Pipeline Section */
    .verifiers-section-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 4px;
      background: #f8fafc;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-container);
      padding: 14px 16px;

      .verifiers-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: transparent;
        border: none;
        padding: 0;
        margin-bottom: 2px;

        .section-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dept-policy-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 600;
          white-space: nowrap;

          .policy-icon { font-size: 14px; width: 14px; height: 14px; }

          &.multi {
            background: #e0f2fe;
            border-color: #7dd3fc;
            color: #0369a1;
          }
        }
      }

      .verifier-stages-list {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .verifier-stage-card {
          background: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;

          .stage-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .stage-tag-group {
              display: flex;
              align-items: center;
              gap: 8px;

              .stage-number-pill {
                background: var(--brand-tint);
                color: var(--brand-indigo);
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 4px;

                &.approved {
                  background: var(--accent-emerald-tint);
                  color: var(--accent-emerald);
                }
              }

              .stage-label-text {
                font-size: 12.5px;
                font-weight: 600;
                color: var(--text-primary);
              }

              .stage-status-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 600;
                color: var(--accent-emerald);

                .status-badge-icon { font-size: 13px; width: 13px; height: 13px; }
              }
            }

            .remove-stage-btn {
              color: var(--text-muted);
              width: 28px;
              height: 28px;
              line-height: 28px;
              &:hover { color: var(--accent-coral); }
              mat-icon { font-size: 16px; width: 16px; height: 16px; }
            }
          }

          .verifier-comment-preview {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 6px;
            padding: 8px 10px;

            .comment-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #16a34a;
              margin-top: 2px;
            }

            .comment-text {
              display: flex;
              flex-direction: column;
              gap: 2px;

              .comment-author {
                font-size: 11px;
                font-weight: 600;
                color: #166534;
              }

              .comment-body {
                margin: 0;
                font-size: 12px;
                color: #14532d;
                font-style: italic;
              }
            }
          }
        }
      }

      .add-stage-bar {
        display: flex;

        .add-stage-btn {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--brand-indigo);
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }

      .verifier-warning-alert {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        color: #92400e;

        &.conflict {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
          .warn-icon { color: #dc2626; }
        }

        .warn-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #d97706;
          flex-shrink: 0;
        }
      }
    }

    .date-order-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: #991b1b;
      margin-top: -6px;

      .date-alert-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #dc2626;
        flex-shrink: 0;
      }
    }

    .dept-locked-hint {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #b45309 !important;
      font-weight: 500;
      font-size: 11px !important;

      .lock-icon-sm {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }
    }

    .dialog-footer {
      padding: 14px 24px;
      border-top: 1px solid var(--border-subtle);
      background-color: #fafbfc;
      display: flex;
      gap: 12px;
    }
  `]
})
export class WorkPlanDialogComponent {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private workPlanService = inject(WorkPlanService);

  planForm: FormGroup;
  departments = signal<Department[]>([]);
  milestones = signal<WorkPlanMilestone[]>([]);
  submitted = signal<boolean>(false);
  newMilestoneTitle = '';

  isAssignmentLocked = false;
  isDepartmentLocked = signal<boolean>(false);

  canCreateOnBehalf = computed(() => {
    const permitted = this.workPlanService.settings().rolesPermittedToCreateOnBehalf || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasAnyRole(permitted) || this.rbacService.isSuperAdmin() || this.rbacService.isAdmin();
  });

  canAccessVerification = computed(() => {
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rbacService.hasAnyRole(permittedRoles);
  });

  // Multi-stage verification pipeline
  selectedDepartment = signal<string>('');
  verifiers = signal<WorkPlanVerifier[]>([]);
  verifierQueries = signal<Record<number, string>>({});

  requiredVerifiersCount = computed(() => {
    const dept = this.selectedDepartment();
    const settings = this.workPlanService.settings();
    return this.workPlanService.getRequiredVerifiersCountForDepartment(settings, dept);
  });

  // System Users for typeahead autocomplete
  systemUsers = signal<SystemUserOption[]>([]);
  leadSearch = signal<string>('');
  isEmailAutoFilled = signal<boolean>(false);

  ownerSearch = signal<string>('');
  isOwnerEmailAutoFilled = signal<boolean>(false);

  filteredSystemUsers = computed(() => {
    const query = (this.leadSearch() || '').toLowerCase().trim();
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

  filteredOwnerUsers = computed(() => {
    const query = (this.ownerSearch() || '').toLowerCase().trim();
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

  dateChronologyValidator = (control: AbstractControl): ValidationErrors | null => {
    const start = control.get('startDate')?.value;
    const target = control.get('targetDate')?.value;
    if (!start || !target) return null;
    const sDate = start instanceof Date ? start : new Date(start);
    const tDate = target instanceof Date ? target : new Date(target);
    if (isNaN(sDate.getTime()) || isNaN(tDate.getTime())) return null;
    const sDay = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate()).getTime();
    const tDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate()).getTime();
    return tDay >= sDay ? null : { targetBeforeStart: true };
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      plan?: WorkPlan,
      divisions?: Division[],
      departments?: Department[],
      defaultMonth?: string,
      prefillLead?: { displayName?: string, email?: string },
      canEditAndAssign?: boolean
    },
    public dialogRef: MatDialogRef<WorkPlanDialogComponent>
  ) {
    const plan = data?.plan;
    const divisions = data?.divisions || [];
    const defaultM = plan?.assignedMonth || data?.defaultMonth || (plan?.startDate ? plan.startDate.substring(0, 7) : new Date().toISOString().substring(0, 7));
    const defaultMDate = this.parseDate(defaultM) || new Date();

    if (data?.departments && data.departments.length > 0) {
      this.departments.set(data.departments);
    } else {
      this.settingsService.getDepartments().subscribe(depts => {
        if (depts && depts.length > 0) {
          this.departments.set(depts);
        }
      });
    }

    const curUser = this.authService.currentUser();
    const userDept = this.rbacService.userDepartment();

    // Owner (whom the task belongs to)
    const initialOwnerName = plan?.ownerName || (plan ? (plan.createdByName || plan.leadName) : (curUser?.displayName || (curUser?.email ? curUser.email.split('@')[0] : '') || 'Staff Officer'));
    const initialOwnerEmail = plan?.ownerEmail || (plan ? (plan.createdByEmail || plan.leadEmail) : (curUser?.email || ''));
    const initialOwnerUid = plan?.ownerUid || (plan ? (plan.createdBy || '') : (curUser?.uid || ''));

    // Regional Lead (Verifier)
    const prefillLeadName = plan?.leadName || data?.prefillLead?.displayName || (data?.prefillLead?.email ? data.prefillLead.email.split('@')[0] : '') || curUser?.displayName || (curUser?.email ? curUser.email.split('@')[0] : '') || '';
    const prefillLeadEmail = plan?.leadEmail || data?.prefillLead?.email || curUser?.email || '';
    const prefillDept = plan?.department || userDept || '';
    this.selectedDepartment.set(prefillDept);

    const isLocked = !!plan && data?.canEditAndAssign === false;
    this.isAssignmentLocked = isLocked;

    const hasSignedStages = !!plan?.verifiers && plan.verifiers.some(v => v.verified);
    this.isDepartmentLocked.set(hasSignedStages);

    this.planForm = this.fb.group({
      title: [plan?.title || '', Validators.required],
      description: [plan?.description || '', Validators.required],
      division: [{ value: plan?.division || (divisions[0]?.name || 'Central Operations'), disabled: isLocked }, Validators.required],
      department: [{ value: prefillDept, disabled: isLocked || hasSignedStages }],
      category: [plan?.category || 'Operations', Validators.required],
      ownerName: [{ value: initialOwnerName, disabled: isLocked }, Validators.required],
      ownerEmail: [{ value: initialOwnerEmail, disabled: isLocked }],
      ownerUid: [{ value: initialOwnerUid, disabled: isLocked }],
      leadName: [{ value: prefillLeadName, disabled: isLocked }],
      leadEmail: [{ value: prefillLeadEmail, disabled: isLocked }],
      status: [plan?.status || 'Draft', Validators.required],
      priority: [plan?.priority || 'Medium', Validators.required],
      budget: [{ value: plan?.budget ?? null, disabled: isLocked }, [Validators.min(0)]],
      progress: [plan?.progress || 0, [Validators.min(0), Validators.max(100)]],
      startDate: [this.parseDate(plan?.startDate) || new Date(), Validators.required],
      targetDate: [this.parseDate(plan?.targetDate) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), Validators.required],
      assignedMonth: [defaultM, Validators.required],
      assignedMonthDate: [defaultMDate, Validators.required]
    }, { validators: [this.dateChronologyValidator] });

    // Multi-verifier pipeline setup
    const settings = this.workPlanService.settings();
    const reqCount = this.workPlanService.getRequiredVerifiersCountForDepartment(settings, prefillDept);

    let initVerifiers: WorkPlanVerifier[] = [];
    if (plan?.verifiers && plan.verifiers.length > 0) {
      initVerifiers = plan.verifiers.map((v, i) => ({
        ...v,
        order: v.order || (i + 1)
      }));
    } else if (prefillLeadName) {
      initVerifiers = [{
        id: 'v_1',
        order: 1,
        name: prefillLeadName,
        email: prefillLeadEmail,
        verified: plan?.status === 'Completed',
        verifiedAt: plan?.status === 'Completed' ? plan.updatedAt : undefined
      }];
    }

    while (initVerifiers.length < reqCount) {
      const order = initVerifiers.length + 1;
      initVerifiers.push({
        id: 'v_' + order + '_' + Date.now(),
        order,
        name: '',
        email: '',
        verified: false
      });
    }

    this.verifiers.set(initVerifiers);

    if (initVerifiers.length > 0 && initVerifiers[0].name) {
      this.planForm.patchValue({
        leadName: initVerifiers[0].name,
        leadEmail: initVerifiers[0].email
      });
    }

    this.planForm.get('department')?.valueChanges.subscribe(deptName => {
      this.selectedDepartment.set(deptName || '');
      this.syncVerifiersForDepartment(deptName || '');
    });

    if (plan?.milestones && plan.milestones.length > 0) {
      this.milestones.set([...plan.milestones]);
    }

    this.loadSystemUsers();

    if (prefillLeadEmail) {
      this.isEmailAutoFilled.set(true);
    }
    this.leadSearch.set(prefillLeadName);

    if (initialOwnerEmail) {
      this.isOwnerEmailAutoFilled.set(true);
    }
    this.ownerSearch.set(initialOwnerName);
  }

  loadSystemUsers() {
    const userMap = new Map<string, SystemUserOption>();

    const addUser = (u: SystemUserOption) => {
      const key = (u.email || u.displayName || '').toLowerCase().trim();
      if (!key) return;
      if (userMap.has(key)) {
        const existing = userMap.get(key)!;
        userMap.set(key, {
          ...existing,
          displayName: u.displayName || existing.displayName,
          email: u.email || existing.email,
          department: u.department || existing.department,
          roles: (u.roles && u.roles.length > 0) ? u.roles : existing.roles
        });
      } else {
        userMap.set(key, u);
      }
    };

    // 1. Known government verification officers & department leads
    const DEFAULT_SYSTEM_OFFICERS: SystemUserOption[] = [
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

    // 2. Current User
    const curUser = this.authService.currentUser();
    const userDept = this.rbacService.userDepartment();
    const userRoles = this.rbacService.userRoles()?.roles || [];
    if (curUser && curUser.email) {
      addUser({
        displayName: curUser.displayName || curUser.email.split('@')[0],
        email: curUser.email,
        department: userDept,
        roles: userRoles
      });
    }

    // 3. Harvest officers from existing work plans
    this.workPlanService.getWorkPlans().subscribe({
      next: (plans) => {
        (plans || []).forEach(p => {
          if (p.leadName) {
            addUser({
              displayName: p.leadName,
              email: p.leadEmail || `${p.leadName.toLowerCase().replace(/\s+/g, '.')}@gov.lk`,
              department: p.department || p.division || '',
              roles: ['Verification Officer']
            });
          }
          if (p.ownerName) {
            addUser({
              displayName: p.ownerName,
              email: p.ownerEmail || `${p.ownerName.toLowerCase().replace(/\s+/g, '.')}@gov.lk`,
              department: p.department || p.division || '',
              roles: ['Staff']
            });
          }
          if (p.verifiers) {
            p.verifiers.forEach(v => {
              if (v.name) {
                addUser({
                  displayName: v.name,
                  email: v.email || `${v.name.toLowerCase().replace(/\s+/g, '.')}@gov.lk`,
                  department: v.department || '',
                  roles: v.role ? [v.role] : ['Verification Officer']
                });
              }
            });
          }
        });
        this.systemUsers.set(Array.from(userMap.values()));
      },
      error: () => {}
    });

    // 4. Query Firestore 'users' collection
    this.firestoreService.getCollection<SystemUserOption>('users').subscribe({
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

  onLeadInput(event: Event) {
    const val = (event.target as HTMLInputElement).value || '';
    this.leadSearch.set(val);
    this.planForm.patchValue({ leadName: val });

    const match = this.systemUsers().find(u => 
      (u.displayName && u.displayName.toLowerCase() === val.toLowerCase()) || 
      (u.email && u.email.toLowerCase() === val.toLowerCase())
    );
    if (match && match.email) {
      this.planForm.patchValue({ leadEmail: match.email });
      this.isEmailAutoFilled.set(true);
      const currentDept = this.planForm.get('department')?.value;
      if (!currentDept && match.department) {
        this.planForm.patchValue({ department: match.department });
      }
    }
  }

  onLeadFocus() {
    this.leadSearch.set('');
  }

  onLeadSelected(selected: SystemUserOption | string) {
    if (typeof selected === 'object' && selected) {
      const name = selected.displayName || selected.email;
      const email = selected.email || '';
      this.planForm.patchValue({
        leadName: name,
        leadEmail: email
      });
      this.leadSearch.set(name);
      this.isEmailAutoFilled.set(true);

      const currentDept = this.planForm.get('department')?.value;
      if (!currentDept && selected.department) {
        this.planForm.patchValue({ department: selected.department });
      }
    } else if (typeof selected === 'string') {
      this.planForm.patchValue({ leadName: selected });
      this.leadSearch.set(selected);
    }
  }

  onOwnerInput(event: Event) {
    const val = (event.target as HTMLInputElement).value || '';
    this.ownerSearch.set(val);
    this.planForm.patchValue({ ownerName: val });

    const curUser = this.authService.currentUser();
    const curName = (curUser?.displayName || '').trim().toLowerCase();
    const curEmail = (curUser?.email || '').trim().toLowerCase();
    const curPrefix = curEmail ? curEmail.split('@')[0] : '';
    const valLower = val.trim().toLowerCase();

    if (valLower && (valLower === curName || valLower === curPrefix)) {
      this.planForm.patchValue({ 
        ownerEmail: curUser?.email || '',
        ownerUid: curUser?.uid || ''
      });
      this.isOwnerEmailAutoFilled.set(true);
      return;
    }

    const match = this.systemUsers().find(u => 
      (u.displayName && u.displayName.toLowerCase() === valLower) || 
      (u.email && u.email.toLowerCase() === valLower)
    );
    if (match && match.email) {
      this.planForm.patchValue({ 
        ownerEmail: match.email,
        ownerUid: match.id || ''
      });
      this.isOwnerEmailAutoFilled.set(true);
      const currentDept = this.planForm.get('department')?.value;
      if (!currentDept && match.department) {
        this.planForm.patchValue({ department: match.department });
      }
    } else {
      this.planForm.patchValue({
        ownerEmail: val.trim() ? `${val.trim().toLowerCase().replace(/\s+/g, '.')}@gov.lk` : '',
        ownerUid: ''
      });
      this.isOwnerEmailAutoFilled.set(false);
    }
  }

  onOwnerFocus() {
    this.ownerSearch.set('');
  }

  onOwnerSelected(selected: SystemUserOption | string) {
    if (typeof selected === 'object' && selected) {
      const name = selected.displayName || selected.email;
      const email = selected.email || '';
      this.planForm.patchValue({
        ownerName: name,
        ownerEmail: email,
        ownerUid: selected.id || ''
      });
      this.ownerSearch.set(name);
      this.isOwnerEmailAutoFilled.set(true);

      const currentDept = this.planForm.get('department')?.value;
      if (!currentDept && selected.department) {
        this.planForm.patchValue({ department: selected.department });
      }
    } else if (typeof selected === 'string') {
      this.planForm.patchValue({ ownerName: selected });
      this.ownerSearch.set(selected);
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

  syncVerifiersForDepartment(deptName: string) {
    const settings = this.workPlanService.settings();
    const req = this.workPlanService.getRequiredVerifiersCountForDepartment(settings, deptName);
    const current = this.verifiers();
    if (current.length < req) {
      const copy = [...current];
      while (copy.length < req) {
        const order = copy.length + 1;
        copy.push({
          id: 'v_' + order + '_' + Date.now(),
          order,
          name: '',
          email: '',
          verified: false
        });
      }
      this.verifiers.set(copy);
    }
  }

  trackByVerifierId(index: number, verifier: WorkPlanVerifier): string {
    return verifier.id || `verifier_stage_${index}`;
  }

  onVerifierFocus(index: number) {
    this.verifierQueries.update(m => ({ ...m, [index]: '' }));
  }

  getFilteredUsersForStage(stageIndex: number): SystemUserOption[] {
    const rawQuery = this.verifierQueries()[stageIndex];
    const q = (rawQuery !== undefined ? rawQuery : '').toLowerCase().trim();
    const users = this.systemUsers();
    if (!q) {
      const currentDept = (this.planForm?.get('department')?.value || this.selectedDepartment() || '').toLowerCase();
      if (currentDept) {
        return [...users].sort((a, b) => {
          const aMatch = (a.department || '').toLowerCase() === currentDept ? -1 : 0;
          const bMatch = (b.department || '').toLowerCase() === currentDept ? -1 : 0;
          return aMatch - bMatch;
        });
      }
      return users;
    }
    return users.filter(u => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const dept = (u.department || '').toLowerCase();
      const role = (u.roles || []).join(' ').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q) || role.includes(q);
    });
  }

  onVerifierInput(index: number, event: Event) {
    const val = (event.target as HTMLInputElement).value || '';
    this.verifierQueries.update(m => ({ ...m, [index]: val }));
    
    const list = this.verifiers();
    if (list[index]) {
      list[index].name = val;
      const match = this.systemUsers().find(u =>
        (u.displayName && u.displayName.toLowerCase() === val.toLowerCase()) ||
        (u.email && u.email.toLowerCase() === val.toLowerCase())
      );
      if (match && match.email) {
        list[index].email = match.email;
        list[index].role = match.roles?.[0] || list[index].role || '';
        list[index].department = match.department || list[index].department || '';
      }
    }
    this.syncLeadWithPrimaryVerifier();
  }

  onVerifierBlur(index: number) {
    const list = this.verifiers();
    const v = list[index];
    if (v && v.name && !v.email) {
      const match = this.systemUsers().find(u =>
        (u.displayName && u.displayName.toLowerCase() === v.name.toLowerCase()) ||
        (u.email && u.email.toLowerCase() === v.name.toLowerCase())
      );
      if (match && match.email) {
        v.email = match.email;
        v.role = match.roles?.[0] || v.role || '';
        v.department = match.department || v.department || '';
      }
    }
    this.syncLeadWithPrimaryVerifier();
  }

  onVerifierEmailInput(index: number, event: Event) {
    const val = (event.target as HTMLInputElement).value || '';
    const list = this.verifiers();
    if (list[index]) {
      list[index].email = val;
    }
    this.syncLeadWithPrimaryVerifier();
  }

  onVerifierSelected(index: number, selected: SystemUserOption | string) {
    const list = this.verifiers();
    const verifier = list[index];
    if (!verifier) return;

    if (typeof selected === 'object' && selected) {
      const name = selected.displayName || selected.email;
      const email = selected.email || '';
      verifier.name = name;
      verifier.email = email;
      verifier.role = selected.roles?.[0] || '';
      verifier.department = selected.department || '';
      this.verifierQueries.update(m => ({ ...m, [index]: name }));
    } else if (typeof selected === 'string') {
      verifier.name = selected;
      this.verifierQueries.update(m => ({ ...m, [index]: selected }));
    }

    this.verifiers.set([...list]);
    this.syncLeadWithPrimaryVerifier();
  }

  private syncLeadWithPrimaryVerifier() {
    const first = this.verifiers()[0];
    if (first) {
      this.planForm.patchValue({
        leadName: first.name,
        leadEmail: first.email
      });
    }
  }

  addVerifierStage() {
    const current = this.verifiers();
    if (current.length >= 5) return;
    const nextOrder = current.length + 1;
    this.verifiers.update(list => [
      ...list,
      {
        id: 'v_' + nextOrder + '_' + Date.now(),
        order: nextOrder,
        name: '',
        email: '',
        verified: false
      }
    ]);
  }

  removeVerifierStage(index: number) {
    const current = this.verifiers();
    if (current.length <= this.requiredVerifiersCount()) return;
    if (current[index]?.verified) return;
    this.verifiers.update(list => {
      const filtered = list.filter((_, i) => i !== index);
      return filtered.map((v, idx) => ({ ...v, order: idx + 1 }));
    });
    this.syncLeadWithPrimaryVerifier();
  }

  hasSelfVerificationConflict(): boolean {
    const ownerEmail = (this.planForm?.get('ownerEmail')?.value || '').toLowerCase().trim();
    const ownerName = (this.planForm?.get('ownerName')?.value || '').toLowerCase().trim();
    if (!ownerEmail && !ownerName) return false;

    return this.verifiers().some(v => {
      const vEmail = (v.email || '').toLowerCase().trim();
      const vName = (v.name || '').toLowerCase().trim();
      if (ownerEmail && vEmail) {
        if (ownerEmail === vEmail) return true;
        const oPrefix = ownerEmail.split('@')[0];
        const vPrefix = vEmail.split('@')[0];
        if (oPrefix && vPrefix && oPrefix === vPrefix) return true;
      }
      if (ownerName && vName) {
        const normO = ownerName.replace(/\s+/g, ' ');
        const normV = vName.replace(/\s+/g, ' ');
        if (normO === normV) return true;
      }
      return false;
    });
  }

  areVerifiersValid(): boolean {
    const list = this.verifiers();
    const req = this.requiredVerifiersCount();
    if (list.length < req) return false;

    // Enforce Fix 2: Each verifier must have non-empty name AND valid email with @
    const allHaveValidEmail = list.every(v =>
      v.name && v.name.trim().length > 0 &&
      v.email && v.email.trim().length > 0 &&
      v.email.includes('@')
    );
    if (!allHaveValidEmail) return false;

    // Enforce Fix 1: Maker-Checker constraint (task owner cannot be their own verifier)
    if (this.hasSelfVerificationConflict()) return false;

    return true;
  }

  getSaveTooltip(): string {
    if (this.milestones().length === 0) {
      return 'At least one milestone deliverable is required to publish';
    }
    if (this.hasSelfVerificationConflict()) {
      return 'Maker-Checker violation: Task owner cannot be assigned as a verification officer for their own work plan';
    }
    const list = this.verifiers();
    if (list.length < this.requiredVerifiersCount() || list.some(v => !v.name || !v.name.trim())) {
      return `Please specify all ${this.requiredVerifiersCount()} required verification officers`;
    }
    if (list.some(v => !v.email || !v.email.trim() || !v.email.includes('@'))) {
      return 'Every verification officer must have a valid official email address';
    }
    if (this.planForm.errors?.['targetBeforeStart']) {
      return 'Target completion date cannot be earlier than start date';
    }
    if (this.planForm.invalid) {
      return 'Please complete all required fields';
    }
    return '';
  }

  parseDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
      if (val.length === 7) {
        const [y, m] = val.split('-').map(Number);
        return new Date(y, m - 1, 1);
      }
      const parts = val.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  formatDateString(d: any): string {
    if (!d) return '';
    if (typeof d === 'string' && d.length === 10) return d;
    if (d instanceof Date) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return String(d).substring(0, 10);
  }

  formatMonthString(d: any): string {
    if (!d) return '';
    if (typeof d === 'string' && d.length === 7) return d;
    if (d instanceof Date) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    return String(d).substring(0, 7);
  }

  setMonthAndYear(normalizedMonth: Date, datepicker: MatDatepicker<Date>) {
    const mStr = this.formatMonthString(normalizedMonth);
    this.planForm.patchValue({
      assignedMonth: mStr,
      assignedMonthDate: normalizedMonth
    });
    datepicker.close();
  }

  addMilestone() {
    if (!this.newMilestoneTitle.trim()) return;
    const newItem: WorkPlanMilestone = {
      id: 'm_' + Date.now(),
      title: this.newMilestoneTitle.trim(),
      completed: false
    };
    this.milestones.update(list => [...list, newItem]);
    this.newMilestoneTitle = '';

    const list = this.milestones();
    const completedCount = list.filter(m => m.completed).length;
    const computedProgress = Math.round((completedCount / list.length) * 100);
    this.planForm.patchValue({ progress: computedProgress });
  }

  toggleMilestone(index: number) {
    this.milestones.update(list => {
      const copy = [...list];
      copy[index] = { ...copy[index], completed: !copy[index].completed };
      
      // Auto-update progress percentage if milestones exist
      const completedCount = copy.filter(m => m.completed).length;
      const computedProgress = Math.round((completedCount / copy.length) * 100);
      this.planForm.patchValue({ progress: computedProgress });

      // CRITICAL: When deliverable milestones are completed, it ONLY goes to verify ('Under Review'), NOT directly to complete ('Completed')
      const currentStatus = this.planForm.get('status')?.value;
      if (computedProgress === 100) {
        if (currentStatus !== 'Completed') {
          this.planForm.patchValue({ status: 'Under Review' });
        }
      } else if (computedProgress < 100) {
        if (currentStatus === 'Under Review' || currentStatus === 'Completed') {
          this.planForm.patchValue({ status: 'In Progress' });
        }
      }

      return copy;
    });
  }

  removeMilestone(index: number) {
    this.milestones.update(list => list.filter((_, i) => i !== index));
    const list = this.milestones();
    if (list.length > 0) {
      const completedCount = list.filter(m => m.completed).length;
      const computedProgress = Math.round((completedCount / list.length) * 100);
      this.planForm.patchValue({ progress: computedProgress });
    } else {
      this.planForm.patchValue({ progress: 0 });
    }
  }

  onSave() {
    // If the user typed into the milestone input but forgot to click Add, auto-add it before saving
    if (this.newMilestoneTitle.trim()) {
      this.addMilestone();
    }

    this.submitted.set(true);

    // Hard validation: work plan cannot be published without at least one milestone and all required verifiers
    if (this.milestones().length === 0 || !this.areVerifiersValid()) {
      return;
    }

    this.syncLeadWithPrimaryVerifier();

    if (!this.planForm.valid) {
      this.planForm.markAllAsTouched();
      return;
    }

    const formVal = this.planForm.getRawValue();
    const startStr = this.formatDateString(formVal.startDate);
    const targetStr = this.formatDateString(formVal.targetDate);
    const mStr = formVal.assignedMonth || this.formatMonthString(formVal.assignedMonthDate) || startStr.substring(0, 7);

    const curUser = this.authService.currentUser();
    const plan = this.data?.plan;

    // Ensure that if deliverable milestones are completed, status goes to 'Under Review' (verify) unless authorized audit verifier
    let finalStatus = formVal.status;
    const currentMilestones = this.milestones();
    if (currentMilestones.length > 0 && currentMilestones.every(m => m.completed)) {
      if (finalStatus !== 'Completed' || !this.canAccessVerification()) {
        finalStatus = 'Under Review';
      }
    }

    const shouldResetApprovals = finalStatus === 'In Progress' || finalStatus === 'Draft';
    const activeVerifiers = this.verifiers().map((v, idx) => ({
      id: v.id || ('v_' + (idx + 1) + '_' + Date.now()),
      order: idx + 1,
      name: v.name || '',
      email: v.email || '',
      role: v.role || 'Verification Officer',
      department: v.department || formVal.department || formVal.division || '',
      verified: shouldResetApprovals ? false : !!v.verified,
      ...(!shouldResetApprovals && v.verifiedAt ? { verifiedAt: v.verifiedAt } : {}),
      ...(!shouldResetApprovals && v.verifiedByEmail ? { verifiedByEmail: v.verifiedByEmail } : {}),
      ...(!shouldResetApprovals && v.reviewComment ? { reviewComment: v.reviewComment } : {})
    }));

    const curName = (curUser?.displayName || '').trim().toLowerCase();
    const curEmail = (curUser?.email || '').trim().toLowerCase();
    const curPrefix = curEmail ? curEmail.split('@')[0] : '';
    const formOwnerName = (formVal.ownerName || '').trim();
    const formOwnerEmail = (formVal.ownerEmail || '').trim();
    const isSelf = (!formOwnerName || formOwnerName.toLowerCase() === curName || formOwnerName.toLowerCase() === curPrefix) &&
                   (!formOwnerEmail || formOwnerEmail.toLowerCase() === curEmail);

    const resolvedOwnerName = formVal.ownerName || (isSelf ? (curUser?.displayName || curPrefix || 'Staff Officer') : 'Unassigned Officer');
    const resolvedOwnerEmail = formVal.ownerEmail || (isSelf ? (curUser?.email || '') : (formVal.ownerName ? `${formVal.ownerName.toLowerCase().replace(/\s+/g, '.')}@gov.lk` : ''));
    const resolvedOwnerUid = formVal.ownerUid || (isSelf ? (curUser?.uid || '') : '');

    const result: Omit<WorkPlan, 'id' | 'createdAt' | 'updatedAt'> = {
      title: formVal.title,
      description: formVal.description,
      division: formVal.division,
      department: formVal.department || '',
      category: formVal.category,
      ownerName: resolvedOwnerName,
      ownerEmail: resolvedOwnerEmail,
      ownerUid: resolvedOwnerUid,
      leadName: activeVerifiers[0]?.name || formVal.leadName || '',
      leadEmail: activeVerifiers[0]?.email || formVal.leadEmail || '',
      verifiers: activeVerifiers,
      status: finalStatus,
      priority: formVal.priority,
      budget: formVal.budget !== null && formVal.budget !== undefined && formVal.budget !== '' ? Number(formVal.budget) : 0,
      progress: formVal.progress || 0,
      startDate: startStr,
      targetDate: targetStr,
      assignedMonth: mStr,
      milestones: this.milestones(),
      createdBy: plan?.createdBy || curUser?.uid || '',
      createdByEmail: plan?.createdByEmail || curUser?.email || '',
      createdByName: plan?.createdByName || curUser?.displayName || (curUser?.email ? curUser.email.split('@')[0] : 'Staff Officer')
    };
    this.dialogRef.close(result);
  }
}
