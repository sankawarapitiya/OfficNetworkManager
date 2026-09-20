import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkPlanService } from '../../services/work-plan.service';
import { EventLogService } from '../../../../core/services/event-log.service';
import { RbacService } from '../../../../auth/rbac.service';
import { SettingsService, Department } from '../../../settings/settings.service';

@Component({
  selector: 'app-work-plan-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="work-plan-settings-page">

      <!-- Hero Header -->
      <div class="hero-banner">
        <div class="hero-content">
          <div class="hero-tag-row">
            <span class="status-pill indigo">
              <mat-icon class="pill-icon">tune</mat-icon> Policy & Access Rules
            </span>
            <span class="sync-indicator">Operational Governance & Role Permissions</span>
          </div>
          <h1 class="hero-title">Work Plan Settings</h1>
          <p class="hero-subtitle">
            Configure role permissions for All Users Summary, Verification Hub access, task editing and officer assignments.
          </p>
        </div>
      </div>

      <!-- Sub-Category Tab Navigation Bar -->
      <div class="sub-category-tabs">
        <a routerLink="/work-plans/dashboard" routerLinkActive="active" class="sub-tab-btn">
          <mat-icon>insights</mat-icon>
          <span>Dashboard</span>
        </a>
        <a *ngIf="canAccessVerificationNav()" routerLink="/work-plans/verification" routerLinkActive="active" class="sub-tab-btn">
          <mat-icon>fact_check</mat-icon>
          <span>Verification</span>
        </a>
        <a routerLink="/work-plans/tasks" routerLinkActive="active" class="sub-tab-btn">
          <mat-icon>view_kanban</mat-icon>
          <span>Task List</span>
        </a>
        <a routerLink="/work-plans/calendar" routerLinkActive="active" class="sub-tab-btn">
          <mat-icon>calendar_month</mat-icon>
          <span>Calendar</span>
        </a>
        <a *ngIf="canAccessReports()" routerLink="/work-plans/reports" routerLinkActive="active" class="sub-tab-btn">
          <mat-icon>summarize</mat-icon>
          <span>Reports</span>
        </a>
        <a *ngIf="canManageSettings()" routerLink="/work-plans/settings" routerLinkActive="active" class="sub-tab-btn">
          <mat-icon>tune</mat-icon>
          <span>Settings</span>
        </a>
      </div>

      <ng-container *ngIf="canManageSettings(); else unauthorizedSettingsBlock">
      <div class="settings-grid">

        <!-- Card 1: All Users Summary Visibility Permissions -->
        <mat-card class="settings-card highlight-border">
          <div class="card-header">
            <div class="header-icon-box indigo"><mat-icon>shield</mat-icon></div>
            <div>
              <h3>All Users Summary Visibility Permissions</h3>
              <p>Designate which roles are permitted to view the consolidated team summary and other officers' work plans. By default, unselected roles only see their own Work Plan.</p>
            </div>
          </div>

          <div class="settings-body">
            <div class="roles-selection-grid">
              <div class="role-checkbox-card" *ngFor="let role of availableRoles" [class.selected]="isRolePermitted(role)" (click)="toggleRolePermitted(role)">
                <div class="role-card-left">
                  <mat-checkbox [checked]="isRolePermitted(role)" (change)="$event ? toggleRolePermitted(role) : null" (click)="$event.stopPropagation()" color="primary">
                  </mat-checkbox>
                  <div class="role-text-col">
                    <span class="role-name">{{ role }}</span>
                    <span class="role-desc">{{ getRoleDescription(role) }}</span>
                  </div>
                </div>
                <span class="role-badge" [class.allowed]="isRolePermitted(role)" [class.restricted]="!isRolePermitted(role)">
                  <mat-icon class="badge-icon">{{ isRolePermitted(role) ? 'visibility' : 'lock' }}</mat-icon>
                  {{ isRolePermitted(role) ? 'Can View All' : 'Own Workplan Only' }}
                </span>
              </div>
            </div>

            <div class="info-alert-strip">
              <mat-icon class="alert-icon">info</mat-icon>
              <span>
                <strong>Default Access Policy:</strong> Users not belonging to any of the checked roles above will strictly see only their own assigned Work Plan directives across the Dashboard and Task List.
              </span>
            </div>
          </div>
        </mat-card>

        <!-- Card 2: Verification Access & Audit Sign-off Permissions -->
        <mat-card class="settings-card highlight-border-emerald">
          <div class="card-header">
            <div class="header-icon-box emerald"><mat-icon>fact_check</mat-icon></div>
            <div>
              <h3>Directive Verification & Audit Sign-off Permissions</h3>
              <p>Specify which roles can enter the Directive Verification Hub, audit deliverables, and approve tasks to "Completed".</p>
            </div>
          </div>

          <div class="settings-body">
            <div class="roles-selection-grid">
              <div class="role-checkbox-card" *ngFor="let role of availableRoles" [class.selected]="isVerificationRolePermitted(role)" (click)="toggleVerificationRolePermitted(role)">
                <div class="role-card-left">
                  <mat-checkbox [checked]="isVerificationRolePermitted(role)" (change)="$event ? toggleVerificationRolePermitted(role) : null" (click)="$event.stopPropagation()" color="primary">
                  </mat-checkbox>
                  <div class="role-text-col">
                    <span class="role-name">{{ role }}</span>
                    <span class="role-desc">{{ getRoleDescription(role) }}</span>
                  </div>
                </div>
                <span class="role-badge" [class.allowed]="isVerificationRolePermitted(role)" [class.restricted]="!isVerificationRolePermitted(role)">
                  <mat-icon class="badge-icon">{{ isVerificationRolePermitted(role) ? 'verified' : 'block' }}</mat-icon>
                  {{ isVerificationRolePermitted(role) ? 'Can Verify & Approve' : 'Access Restricted' }}
                </span>
              </div>
            </div>

            <div class="info-alert-strip emerald">
              <mat-icon class="alert-icon">check_circle</mat-icon>
              <span>
                <strong>Quality Assurance Rule:</strong> Only roles selected above will see the Verification link and possess sign-off authority for deliverables under review.
              </span>
            </div>
          </div>
        </mat-card>

        <!-- Card 3: Department Verification Thresholds & Multi-Officer Sign-Off Rules -->
        <mat-card class="settings-card highlight-border-cyan">
          <div class="card-header">
            <div class="header-icon-box cyan"><mat-icon>how_to_reg</mat-icon></div>
            <div>
              <h3>Department Verification Thresholds & Multi-Officer Sign-Off Rules</h3>
              <p>Configure the required number of verification officers per department (e.g. Stage 1, Stage 2, etc.). When a department requires multiple verifiers, all officers must review, comment, and approve before the work plan can reach Completed.</p>
            </div>
          </div>

          <div class="settings-body">
            <!-- Global Default Counter -->
            <div class="global-quota-row">
              <div class="quota-info">
                <span class="quota-title">Global Fallback Verification Requirement</span>
                <span class="quota-desc">Default number of verification officers required when a department is unassigned or not customized below.</span>
              </div>
              <div class="stepper-box">
                <button type="button" class="stepper-btn" (click)="updateDefaultVerifierCount(-1)" [disabled]="defaultRequiredVerifiersCount() <= 1">
                  <mat-icon>remove</mat-icon>
                </button>
                <span class="stepper-value">{{ defaultRequiredVerifiersCount() }} {{ defaultRequiredVerifiersCount() === 1 ? 'Officer' : 'Officers' }}</span>
                <button type="button" class="stepper-btn" (click)="updateDefaultVerifierCount(1)" [disabled]="defaultRequiredVerifiersCount() >= 5">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
            </div>

            <!-- Per Department Settings Grid -->
            <div class="dept-quotas-header">
              <span class="section-subheading">Department Specific Verification Quotas</span>
              <span class="section-subtext">Set required verification stages per department. Directives in these departments enforce sign-offs by each officer.</span>
            </div>

            <div class="dept-quotas-grid">
              <div class="dept-quota-card" *ngFor="let dept of departmentList()">
                <div class="dept-card-left">
                  <div class="dept-icon-circle" [class.multi]="getDeptVerifierCount(dept) > 1">
                    <mat-icon>{{ getDeptVerifierCount(dept) > 1 ? 'verified_user' : 'person' }}</mat-icon>
                  </div>
                  <div class="dept-meta">
                    <span class="dept-name">{{ dept }}</span>
                    <span class="dept-badge" [class.multi]="getDeptVerifierCount(dept) > 1">
                      <mat-icon class="badge-mini-icon">{{ getDeptVerifierCount(dept) > 1 ? 'rule' : 'check' }}</mat-icon>
                      {{ getDeptVerifierCount(dept) > 1 ? (getDeptVerifierCount(dept) + ' Officers Required (Stages 1..' + getDeptVerifierCount(dept) + ')') : 'Single Officer (Stage 1 Only)' }}
                    </span>
                  </div>
                </div>
                <div class="stepper-box compact">
                  <button type="button" class="stepper-btn" (click)="updateDeptVerifierCount(dept, -1)" [disabled]="getDeptVerifierCount(dept) <= 1">
                    <mat-icon>remove</mat-icon>
                  </button>
                  <span class="stepper-value">{{ getDeptVerifierCount(dept) }}</span>
                  <button type="button" class="stepper-btn" (click)="updateDeptVerifierCount(dept, 1)" [disabled]="getDeptVerifierCount(dept) >= 5">
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
              </div>
            </div>

            <div class="info-alert-strip cyan">
              <mat-icon class="alert-icon">fact_check</mat-icon>
              <span>
                <strong>Multi-Verifier Workflow:</strong> When creating a work plan for a department requiring multiple officers, the creator must specify all required verification officers. In the Verification Hub and Directive Details, each stage officer can submit review feedback and sign off sequentially. All stages must be approved to mark the task Completed.
              </span>
            </div>
          </div>
        </mat-card>

        <!-- Card 4: Task Editing & Assignment Permissions -->
        <mat-card class="settings-card highlight-border-amber">
          <div class="card-header">
            <div class="header-icon-box amber"><mat-icon>edit_calendar</mat-icon></div>
            <div>
              <h3>Directive Editing & Officer Assignment Permissions</h3>
              <p>Designate which roles can edit created work plans, update budgets/dates, and assign or re-assign directives to officers.</p>
            </div>
          </div>

          <div class="settings-body">
            <div class="roles-selection-grid">
              <div class="role-checkbox-card" *ngFor="let role of availableRoles" [class.selected]="isEditAssignRolePermitted(role)" (click)="toggleEditAssignRolePermitted(role)">
                <div class="role-card-left">
                  <mat-checkbox [checked]="isEditAssignRolePermitted(role)" (change)="$event ? toggleEditAssignRolePermitted(role) : null" (click)="$event.stopPropagation()" color="primary">
                  </mat-checkbox>
                  <div class="role-text-col">
                    <span class="role-name">{{ role }}</span>
                    <span class="role-desc">{{ getRoleDescription(role) }}</span>
                  </div>
                </div>
                <span class="role-badge" [class.allowed]="isEditAssignRolePermitted(role)" [class.restricted]="!isEditAssignRolePermitted(role)">
                  <mat-icon class="badge-icon">{{ isEditAssignRolePermitted(role) ? 'assignment_ind' : 'lock' }}</mat-icon>
                  {{ isEditAssignRolePermitted(role) ? 'Can Edit & Assign' : 'Read-Only Tasks' }}
                </span>
              </div>
            </div>

            <div class="info-alert-strip amber">
              <mat-icon class="alert-icon">tune</mat-icon>
              <span>
                <strong>Task Governance:</strong> Users without these roles will only be able to view their tasks and check off milestone progress, but cannot edit directive budgets, schedules, or change officer assignment.
              </span>
            </div>
          </div>
        </mat-card>

        <!-- Card 4: On-Behalf Task Creation & Assignment Delegation Roles -->
        <mat-card class="settings-card highlight-border-purple">
          <div class="card-header">
            <div class="header-icon-box purple"><mat-icon>supervisor_account</mat-icon></div>
            <div>
              <h3>On-Behalf Task Creation & Assignment Delegation Roles</h3>
              <p>Designate which special roles can create tasks on behalf of another selected user and designate the Regional Lead for verification. Standard users can only create tasks that belong to themselves.</p>
            </div>
          </div>

          <div class="settings-body">
            <div class="roles-selection-grid">
              <div class="role-checkbox-card" *ngFor="let role of availableRoles" [class.selected]="isCreateOnBehalfRolePermitted(role)" (click)="toggleCreateOnBehalfRolePermitted(role)">
                <div class="role-card-left">
                  <mat-checkbox [checked]="isCreateOnBehalfRolePermitted(role)" (change)="$event ? toggleCreateOnBehalfRolePermitted(role) : null" (click)="$event.stopPropagation()" color="primary">
                  </mat-checkbox>
                  <div class="role-text-col">
                    <span class="role-name">{{ role }}</span>
                    <span class="role-desc">{{ getRoleDescription(role) }}</span>
                  </div>
                </div>
                <span class="role-badge" [class.allowed]="isCreateOnBehalfRolePermitted(role)" [class.restricted]="!isCreateOnBehalfRolePermitted(role)">
                  <mat-icon class="badge-icon">{{ isCreateOnBehalfRolePermitted(role) ? 'how_to_reg' : 'person' }}</mat-icon>
                  {{ isCreateOnBehalfRolePermitted(role) ? 'Can Delegate / Create On-Behalf' : 'Creates Own Tasks Only' }}
                </span>
              </div>
            </div>

            <div class="info-alert-strip purple">
              <mat-icon class="alert-icon">group_add</mat-icon>
              <span>
                <strong>Task Ownership & Verification Rule:</strong> When an authorized role creates a task on behalf of another user, the directive strictly belongs to that user and appears in their personal "My directives only" list. The Regional Lead indicates the supervisor/lead officer where the task goes for verification purpose.
              </span>
            </div>
          </div>
        </mat-card>

        <!-- Card: Report Options & Role Visibility Permissions -->
        <mat-card class="settings-card highlight-border-blue">
          <div class="card-header">
            <div class="header-icon-box blue"><mat-icon>summarize</mat-icon></div>
            <div>
              <h3>Report Options & Role Visibility Permissions</h3>
              <p>Configure role permissions individually for each of the 6 report options (Pending, Completed, Master Register, Individual Dossier, Department Matrix, Verification Audit). Select which roles are permitted to view and print each specific report type.</p>
            </div>
          </div>

          <div class="settings-body">
            <!-- 6 Report Options Switcher Tabs -->
            <div class="report-options-nav">
              <button type="button" class="report-option-tab" 
                *ngFor="let opt of reportOptionsConfig" 
                [class.active]="selectedReportOption() === opt.id"
                (click)="selectedReportOption.set(opt.id)">
                <mat-icon class="opt-icon">{{ opt.icon }}</mat-icon>
                <div class="opt-label-box">
                  <span class="opt-title">{{ opt.title }}</span>
                  <span class="opt-count">{{ getRolesForReport(opt.id).length }} roles allowed</span>
                </div>
              </button>
            </div>

            <!-- Active Report Option Role Configuration Pane -->
            <div class="report-option-pane" *ngIf="getActiveReportOption() as activeOpt">
              <div class="pane-header-row">
                <div class="pane-title-group">
                  <div class="pane-badge" [class]="activeOpt.badgeClass">
                    <mat-icon>{{ activeOpt.icon }}</mat-icon>
                  </div>
                  <div>
                    <h4 class="pane-title">{{ activeOpt.title }}</h4>
                    <p class="pane-desc">{{ activeOpt.description }}</p>
                  </div>
                </div>
                <div class="pane-quick-actions">
                  <button type="button" class="quick-btn" (click)="setAllRolesForReport(activeOpt.id)">
                    <mat-icon>done_all</mat-icon> All Roles
                  </button>
                  <button type="button" class="quick-btn" (click)="setAdminsOnlyForReport(activeOpt.id)">
                    <mat-icon>admin_panel_settings</mat-icon> Admins Only
                  </button>
                  <button type="button" class="quick-btn text-muted" (click)="clearRolesForReport(activeOpt.id)">
                    <mat-icon>clear_all</mat-icon> Clear
                  </button>
                </div>
              </div>

              <!-- Roles Selection Grid for Active Report Option -->
              <div class="roles-selection-grid">
                <div class="role-checkbox-card" *ngFor="let role of availableRoles" 
                     [class.selected]="isRolePermittedForReport(activeOpt.id, role)" 
                     (click)="toggleRoleForReport(activeOpt.id, role)">
                  <div class="role-card-left">
                    <mat-checkbox [checked]="isRolePermittedForReport(activeOpt.id, role)" 
                                  (change)="$event ? toggleRoleForReport(activeOpt.id, role) : null" 
                                  (click)="$event.stopPropagation()" color="primary">
                    </mat-checkbox>
                    <div class="role-text-col">
                      <span class="role-name">{{ role }}</span>
                      <span class="role-desc">{{ getRoleDescription(role) }}</span>
                    </div>
                  </div>
                  <span class="role-badge" [class.allowed]="isRolePermittedForReport(activeOpt.id, role)" [class.restricted]="!isRolePermittedForReport(activeOpt.id, role)">
                    <mat-icon class="badge-icon">{{ isRolePermittedForReport(activeOpt.id, role) ? 'visibility' : 'lock' }}</mat-icon>
                    {{ isRolePermittedForReport(activeOpt.id, role) ? 'Can View' : 'Restricted' }}
                  </span>
                </div>
              </div>

              <div class="info-alert-strip" [class]="activeOpt.badgeClass">
                <mat-icon class="alert-icon">{{ activeOpt.icon }}</mat-icon>
                <span>
                  <strong>Visibility Rule:</strong> {{ activeOpt.ruleNote }}
                </span>
              </div>
            </div>

            <!-- Consolidated Report Options Matrix Table -->
            <div class="report-matrix-summary">
              <div class="matrix-header">
                <mat-icon>table_chart</mat-icon>
                <span>Consolidated Report Access Matrix (All 6 Reports & Roles)</span>
              </div>
              <div class="matrix-table-scroll">
                <table class="matrix-table">
                  <thead>
                    <tr>
                      <th style="width: 32%;">Report Option</th>
                      <th *ngFor="let role of availableRoles" class="text-center">{{ role }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let opt of reportOptionsConfig">
                      <td class="report-name-cell">
                        <mat-icon class="tbl-icon">{{ opt.icon }}</mat-icon>
                        <strong>{{ opt.title }}</strong>
                      </td>
                      <td *ngFor="let role of availableRoles" class="text-center" (click)="toggleRoleForReport(opt.id, role)" style="cursor: pointer;" [matTooltip]="'Click to toggle ' + role + ' access for ' + opt.title">
                        <span class="matrix-check" [class.checked]="isRolePermittedForReport(opt.id, role)">
                          <mat-icon>{{ isRolePermittedForReport(opt.id, role) ? 'check_circle' : 'cancel' }}</mat-icon>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </mat-card>

        <!-- Card 5: Monthly Rollover Engine -->
        <mat-card class="settings-card">
          <div class="card-header">
            <div class="header-icon-box slate"><mat-icon>history_toggle_off</mat-icon></div>
            <div>
              <h3>Monthly Incomplete Rollover Engine</h3>
              <p>Automated transfer of unfinished tasks across monthly calendar cycles.</p>
            </div>
          </div>

          <div class="settings-body">
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">Auto-Rollover Incomplete Directives</span>
                <span class="toggle-desc">Automatically transfer all non-completed directives from prior months into the active running month.</span>
              </div>
              <mat-slide-toggle [(ngModel)]="autoRollover" color="primary"></mat-slide-toggle>
            </div>

            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">Preserve Original Cycle In Archives</span>
                <span class="toggle-desc">Keep historical records in their originating month while tracking active backlog in current cycle.</span>
              </div>
              <mat-slide-toggle [(ngModel)]="archiveOriginalMonth" color="primary"></mat-slide-toggle>
            </div>

            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">Highlight Rollover Tasks With Priority Amber Badge</span>
                <span class="toggle-desc">Display visual rollover indicator pill on Kanban cards and data tables.</span>
              </div>
              <mat-slide-toggle [(ngModel)]="highlightRolloverBadge" color="primary"></mat-slide-toggle>
            </div>
          </div>
        </mat-card>

        <!-- Card 5: Strategic Pillars & Deliverable Categories -->
        <mat-card class="settings-card">
          <div class="card-header">
            <div class="header-icon-box slate"><mat-icon>category</mat-icon></div>
            <div>
              <h3>Operational Pillars</h3>
              <p>Active organizational categories for multi-division task grouping.</p>
            </div>
          </div>

          <div class="settings-body">
            <div class="pillars-list">
              <div class="pillar-item" *ngFor="let p of pillars()">
                <div class="pillar-left">
                  <mat-icon class="pillar-bullet">label</mat-icon>
                  <span class="pillar-name">{{ p }}</span>
                </div>
                <span class="pillar-status">Active Pillar</span>
              </div>
            </div>

            <div class="add-pillar-box">
              <input type="text" [(ngModel)]="newPillarName" placeholder="New operational category..." class="pillar-input">
              <button mat-flat-button color="primary" (click)="addPillar()" [disabled]="!newPillarName.trim()">
                + Add Category
              </button>
            </div>
          </div>
        </mat-card>

        <!-- Card 6: Quality Assurance & Milestone Verification Rules -->
        <mat-card class="settings-card">
          <div class="card-header">
            <div class="header-icon-box emerald"><mat-icon>verified</mat-icon></div>
            <div>
              <h3>Verification & Audit Standards</h3>
              <p>Quality assurance policies for marking work plans complete.</p>
            </div>
          </div>

          <div class="settings-body">
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">Require 100% Milestones Checked For Completion</span>
                <span class="toggle-desc">Prevent directives from moving to Completed until all checklist deliverables are verified.</span>
              </div>
              <mat-slide-toggle [(ngModel)]="requireAllMilestones" color="primary"></mat-slide-toggle>
            </div>

            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-title">Audit Log Tracking on Status Transitions</span>
                <span class="toggle-desc">Record every status shift and milestone toggle to system audit log.</span>
              </div>
              <mat-slide-toggle [(ngModel)]="auditLogTransitions" color="primary"></mat-slide-toggle>
            </div>
          </div>
        </mat-card>

      </div>

      <div class="save-bar">
        <button mat-flat-button color="primary" class="save-btn" (click)="saveSettings()">
          <mat-icon>save</mat-icon> Save Work Plan Configurations
        </button>
      </div>
      </ng-container>

      <ng-template #unauthorizedSettingsBlock>
        <mat-card class="settings-card" style="padding: 48px 24px; text-align: center; border: 1px dashed #cbd5e1;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 480px; margin: 0 auto;">
            <mat-icon style="font-size: 48px; width: 48px; height: 48px; color: #ef4444;">lock</mat-icon>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Access Denied</h3>
            <p style="margin: 0; font-size: 13.5px; color: #64748b; line-height: 1.5;">
              Work Plan Policy Settings are restricted to authorized administrators (Super Admin, Divisional Admin, or users with the <code>work-plans:manage_policies</code> permission).
            </p>
            <a routerLink="/work-plans/tasks" mat-flat-button color="primary" style="margin-top: 8px;">
              Return to Task List
            </a>
          </div>
        </mat-card>
      </ng-template>

    </div>
  `,
  styles: [`
    .work-plan-settings-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .hero-banner {
      background-color: var(--surface-white);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-container);
      padding: 24px 28px;
      box-shadow: var(--card-shadow);

      .hero-content {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .hero-tag-row {
          display: flex;
          align-items: center;
          gap: 10px;
          .pill-icon { font-size: 14px; width: 14px; height: 14px; }
          .sync-indicator { font-size: 11.5px; color: var(--text-muted); font-weight: 500; }
        }

        .hero-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }
        .hero-subtitle { margin: 0; font-size: 13.5px; color: var(--text-secondary); max-width: 720px; line-height: 1.45; }
      }
    }

    .sub-category-tabs {
      display: flex;
      gap: 8px;
      background-color: #ffffff;
      padding: 6px;
      border-radius: var(--radius-container);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--card-shadow);
      overflow-x: auto;

      .sub-tab-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 8px;
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s ease;
        white-space: nowrap;

        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-muted); }

        &:hover { background-color: var(--canvas-bg); color: var(--text-primary); }

        &.active {
          background-color: var(--brand-tint);
          color: var(--brand-indigo);
          font-weight: 600;
          mat-icon { color: var(--brand-accent); }
        }
      }
    }

    .settings-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .settings-card {
      background-color: #ffffff;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-container);
      box-shadow: var(--card-shadow);
      padding: 22px !important;

      &.highlight-border {
        border-color: #c7d2fe;
      }
      &.highlight-border-emerald {
        border-color: #a7f3d0;
      }
      &.highlight-border-amber {
        border-color: #fde68a;
      }
      &.highlight-border-purple {
        border-color: #d8b4fe;
      }
      &.highlight-border-cyan {
        border-color: #a5f3fc;
      }
      &.highlight-border-blue {
        border-color: #93c5fd;
      }
      &.highlight-border-teal {
        border-color: #99f6e4;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 14px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-light);

        .header-icon-box {
          width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
          &.amber { background: var(--accent-amber-tint); color: var(--accent-amber); }
          &.slate { background: #f1f5f9; color: #475569; }
          &.emerald { background: var(--accent-emerald-tint); color: var(--accent-emerald); }
          &.indigo { background: var(--brand-tint); color: var(--brand-accent); }
          &.purple { background: #f3e8ff; color: #7e22ce; }
          &.cyan { background: #cffafe; color: #0891b2; }
          &.blue { background: #eff6ff; color: #2563eb; }
          &.teal { background: #f0fdfa; color: #0d9488; }
        }

        h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary); }
        p { margin: 2px 0 0 0; font-size: 12.5px; color: var(--text-muted); line-height: 1.4; }
      }

      .settings-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;

        .roles-selection-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;

          @media (max-width: 768px) {
            grid-template-columns: 1fr;
          }

          .role-checkbox-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #fafbfc;
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            padding: 10px 14px;
            cursor: pointer;
            transition: all 0.15s ease;

            &:hover {
              border-color: var(--brand-accent);
              background-color: #ffffff;
            }

            &.selected {
              background-color: var(--brand-tint);
              border-color: #818cf8;
            }

            .role-card-left {
              display: flex;
              align-items: center;
              gap: 10px;

              .role-text-col {
                display: flex;
                flex-direction: column;
                gap: 2px;

                .role-name {
                  font-size: 13.5px;
                  font-weight: 600;
                  color: var(--text-primary);
                }

                .role-desc {
                  font-size: 11px;
                  color: var(--text-muted);
                }
              }
            }

            .role-badge {
              font-size: 11px;
              font-weight: 600;
              padding: 3px 8px;
              border-radius: 6px;
              display: inline-flex;
              align-items: center;
              gap: 4px;

              .badge-icon {
                font-size: 13px;
                width: 13px;
                height: 13px;
              }

              &.allowed {
                background-color: var(--accent-emerald-tint);
                color: var(--accent-emerald);
              }

              &.restricted {
                background-color: #f1f5f9;
                color: #64748b;
              }
            }
          }
        }

        .info-alert-strip {
          display: flex;
          align-items: center;
          gap: 10px;
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12.5px;
          color: #1e40af;

          &.emerald {
            background-color: #f0fdf4;
            border-color: #bbf7d0;
            color: #166534;
            .alert-icon { color: #16a34a; }
          }

          &.amber {
            background-color: #fffbeb;
            border-color: #fde68a;
            color: #92400e;
            .alert-icon { color: #d97706; }
          }

          &.purple {
            background-color: #faf5ff;
            border-color: #e9d5ff;
            color: #6b21a8;
            .alert-icon { color: #9333ea; }
          }

          &.cyan {
            background-color: #ecfeff;
            border-color: #a5f3fc;
            color: #0e7490;
            .alert-icon { color: #0891b2; }
          }

          &.blue {
            background-color: #eff6ff;
            border-color: #bfdbfe;
            color: #1e40af;
            .alert-icon { color: #2563eb; }
          }

          &.teal {
            background-color: #f0fdfa;
            border-color: #99f6e4;
            color: #115e59;
            .alert-icon { color: #0d9488; }
          }

          .alert-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #3b82f6;
            flex-shrink: 0;
          }
        }

        /* Report Options Selection & Matrix Styles */
        .report-options-nav {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 4px;

          .report-option-tab {
            display: flex;
            align-items: center;
            gap: 10px;
            background: #f8fafc;
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            padding: 10px 12px;
            cursor: pointer;
            text-align: left;
            transition: all 0.15s ease;

            .opt-icon {
              color: #64748b;
              font-size: 20px;
              width: 20px;
              height: 20px;
              flex-shrink: 0;
            }

            .opt-label-box {
              display: flex;
              flex-direction: column;
              gap: 2px;
              min-width: 0;

              .opt-title {
                font-size: 12.5px;
                font-weight: 600;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .opt-count {
                font-size: 11px;
                color: var(--text-muted);
              }
            }

            &:hover {
              background: #f1f5f9;
              border-color: #cbd5e1;
            }

            &.active {
              background: #eff6ff;
              border-color: #3b82f6;
              box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);

              .opt-icon {
                color: #2563eb;
              }

              .opt-title {
                color: #1d4ed8;
                font-weight: 700;
              }

              .opt-count {
                color: #2563eb;
                font-weight: 600;
              }
            }
          }
        }

        .report-option-pane {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);

          .pane-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #f1f5f9;

            .pane-title-group {
              display: flex;
              align-items: center;
              gap: 12px;

              .pane-badge {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;

                mat-icon { font-size: 20px; width: 20px; height: 20px; }

                &.amber { background: #fffbeb; color: #d97706; }
                &.green { background: #f0fdf4; color: #16a34a; }
                &.blue { background: #eff6ff; color: #2563eb; }
                &.indigo { background: #eef2ff; color: #4f46e5; }
                &.red { background: #fef2f2; color: #dc2626; }
              }

              .pane-title {
                margin: 0;
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
              }

              .pane-desc {
                margin: 2px 0 0 0;
                font-size: 12px;
                color: #64748b;
              }
            }

            .pane-quick-actions {
              display: flex;
              align-items: center;
              gap: 6px;

              .quick-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 11.5px;
                font-weight: 500;
                color: #334155;
                cursor: pointer;
                transition: all 0.15s ease;

                mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }

                &:hover {
                  background: #f1f5f9;
                  border-color: #cbd5e1;
                }

                &.text-muted {
                  color: #64748b;
                  mat-icon { color: #94a3b8; }
                }
              }
            }
          }
        }

        .report-matrix-summary {
          margin-top: 8px;
          background: #fafbfc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;

          .matrix-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 10px;

            mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
          }

          .matrix-table-scroll {
            overflow-x: auto;
          }

          .matrix-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;

            th {
              background: #f1f5f9;
              color: #475569;
              font-weight: 700;
              padding: 8px 10px;
              border: 1px solid #e2e8f0;
              text-align: left;
              white-space: nowrap;

              &.text-center { text-align: center; }
            }

            td {
              padding: 8px 10px;
              border: 1px solid #e2e8f0;
              color: #1e293b;
              vertical-align: middle;

              &.text-center { text-align: center; }

              &.report-name-cell {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;

                .tbl-icon {
                  font-size: 16px;
                  width: 16px;
                  height: 16px;
                  color: #2563eb;
                  flex-shrink: 0;
                }
              }
            }

            tr:hover td {
              background-color: #f8fafc;
            }

            .matrix-check {
              display: inline-flex;
              align-items: center;
              justify-content: center;

              mat-icon {
                font-size: 18px;
                width: 18px;
                height: 18px;
                color: #cbd5e1;
                transition: transform 0.15s ease;
              }

              &.checked mat-icon {
                color: #16a34a;
              }

              &:hover mat-icon {
                transform: scale(1.2);
              }
            }
          }
        }

        .global-quota-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #f8fafc;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 12px 16px;
          gap: 16px;

          .quota-info {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .quota-title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
            .quota-desc { font-size: 12px; color: var(--text-muted); line-height: 1.4; }
          }
        }

        .stepper-box {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 4px 8px;
          flex-shrink: 0;

          .stepper-btn {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            border: 1px solid var(--border-subtle);
            background: #f8fafc;
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;

            mat-icon { font-size: 16px; width: 16px; height: 16px; }

            &:hover:not(:disabled) {
              background: var(--brand-tint);
              border-color: var(--brand-accent);
              color: var(--brand-indigo);
            }

            &:disabled {
              opacity: 0.35;
              cursor: not-allowed;
            }
          }

          .stepper-value {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-primary);
            min-width: 68px;
            text-align: center;
          }

          &.compact {
            padding: 3px 6px;
            .stepper-value {
              min-width: 24px;
              font-size: 13px;
            }
          }
        }

        .dept-quotas-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 4px;

          .section-subheading {
            font-size: 13.5px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .section-subtext {
            font-size: 12px;
            color: var(--text-muted);
          }
        }

        .dept-quotas-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;

          @media (max-width: 768px) {
            grid-template-columns: 1fr;
          }

          .dept-quota-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #ffffff;
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            padding: 10px 14px;
            gap: 12px;
            transition: all 0.15s ease;

            &:hover {
              border-color: #94a3b8;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }

            .dept-card-left {
              display: flex;
              align-items: center;
              gap: 10px;
              min-width: 0;

              .dept-icon-circle {
                width: 34px;
                height: 34px;
                border-radius: 8px;
                background-color: #f1f5f9;
                color: #475569;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;

                mat-icon { font-size: 18px; width: 18px; height: 18px; }

                &.multi {
                  background-color: #cffafe;
                  color: #0891b2;
                }
              }

              .dept-meta {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;

                .dept-name {
                  font-size: 13px;
                  font-weight: 600;
                  color: var(--text-primary);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }

                .dept-badge {
                  font-size: 11px;
                  font-weight: 500;
                  color: #64748b;
                  display: inline-flex;
                  align-items: center;
                  gap: 3px;

                  .badge-mini-icon {
                    font-size: 12px;
                    width: 12px;
                    height: 12px;
                  }

                  &.multi {
                    color: #0284c7;
                    font-weight: 600;
                  }
                }
              }
            }
          }
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;

          .toggle-info {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .toggle-title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
            .toggle-desc { font-size: 12px; color: var(--text-muted); line-height: 1.4; }
          }
        }

        .pillars-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;

          @media (max-width: 600px) { grid-template-columns: 1fr; }

          .pillar-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f8fafc;
            border: 1px solid var(--border-subtle);
            border-radius: 8px;

            .pillar-left {
              display: flex;
              align-items: center;
              gap: 8px;
              .pillar-bullet { font-size: 16px; width: 16px; height: 16px; color: var(--brand-accent); }
              .pillar-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
            }

            .pillar-status { font-size: 11px; font-weight: 500; color: var(--accent-emerald); }
          }
        }

        .add-pillar-box {
          display: flex;
          gap: 10px;
          margin-top: 8px;

          .pillar-input {
            flex: 1;
            height: 38px;
            border: 1px solid var(--border-subtle);
            border-radius: 6px;
            padding: 0 12px;
            font-size: 13px;
            outline: none;
            &:focus { border-color: var(--brand-accent); }
          }
        }
      }
    }

    .save-bar {
      display: flex;
      justify-content: flex-end;

      .save-btn {
        height: 42px;
        border-radius: var(--radius-button);
        font-weight: 600;
        font-size: 13px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; }
      }
    }
  `]
})
export class WorkPlanSettingsComponent implements OnInit {
  private router = inject(Router);
  private workPlanService = inject(WorkPlanService);
  private settingsService = inject(SettingsService);
  private eventLogService = inject(EventLogService);
  private snackBar = inject(MatSnackBar);
  private rbacService = inject(RbacService);

  canAccessVerificationNav = computed(() => {
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rolesPermittedForVerification().length > 0;
  });

  canManageSettings = computed(() => {
    return this.rbacService.hasPermission('work-plans:manage_policies') || this.rbacService.isSuperAdmin() || this.rbacService.isAdmin();
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

  availableRoles = ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];

  autoRollover = true;
  archiveOriginalMonth = true;
  highlightRolloverBadge = true;
  requireAllMilestones = true;
  auditLogTransitions = true;

  departmentList = signal<string[]>([]);
  departmentVerifierPolicies = signal<Record<string, number>>({});
  defaultRequiredVerifiersCount = signal<number>(1);
  loadedDepartments = signal<Department[]>([]);

  rolesPermittedForSummary = signal<string[]>([
    'Super Admin',
    'Divisional Admin',
    'Department Head'
  ]);

  rolesPermittedForVerification = signal<string[]>([
    'Super Admin',
    'Divisional Admin',
    'Department Head'
  ]);

  rolesPermittedForEditAndAssign = signal<string[]>([
    'Super Admin',
    'Divisional Admin',
    'Department Head'
  ]);

  rolesPermittedToCreateOnBehalf = signal<string[]>([
    'Super Admin',
    'Divisional Admin',
    'Department Head'
  ]);

  rolesPermittedForAllReports = signal<string[]>([
    'Super Admin',
    'Divisional Admin',
    'Department Head'
  ]);

  rolesPermittedForIndividualReports = signal<string[]>([
    'Super Admin',
    'Divisional Admin',
    'Department Head',
    'Staff',
    'HR',
    'Field Agent'
  ]);

  reportOptionsConfig = [
    {
      id: 'pending',
      title: 'Whole Month Pending',
      icon: 'pending_actions',
      badgeClass: 'amber',
      description: 'Track all directives that are actively in progress, under review, or pending completion across departments.',
      ruleNote: 'Users with selected roles can view all unfinished directives and inspect monthly pending backlogs.'
    },
    {
      id: 'completed',
      title: 'Completed with Status',
      icon: 'task_alt',
      badgeClass: 'green',
      description: 'Detailed register of approved and finished directives including lead officer verification comments and sign-offs.',
      ruleNote: 'Permits designated roles to review deliverables, completion dates, and official review remarks.'
    },
    {
      id: 'master',
      title: 'Monthly Master Register',
      icon: 'menu_book',
      badgeClass: 'indigo',
      description: 'Comprehensive cross-departmental register of all directives regardless of status, pillar, or assignment.',
      ruleNote: 'Executive-level institutional overview. Restricting this keeps high-level operational registers confidential.'
    },
    {
      id: 'individual',
      title: 'Individual Officer Dossier',
      icon: 'badge',
      badgeClass: 'blue',
      description: 'Single-officer performance breakdown, total assigned vs. completed deliverables, and individual workload metrics.',
      ruleNote: 'Roles selected here can view individual dossier breakdowns. Standard staff usually only see their own dossier.'
    },
    {
      id: 'department',
      title: 'Department Summary Matrix',
      icon: 'domain',
      badgeClass: 'cyan',
      description: 'Consolidated matrix showing monthly task volume, completion rates, and active backlog broken down by department.',
      ruleNote: 'Allows department heads and managers to compare divisional output and milestone completion.'
    },
    {
      id: 'verification',
      title: 'Verification Audit Log',
      icon: 'fact_check',
      badgeClass: 'red',
      description: 'Quality assurance and compliance audit log showing stage verifiers, sign-off timestamps, and review remarks.',
      ruleNote: 'Restricted audit trail. Recommended for QA leads, Compliance Officers, and Administrators.'
    }
  ];

  selectedReportOption = signal<string>('pending');

  rolesPermittedByReportType = signal<Record<string, string[]>>({
    pending: ['Super Admin', 'Divisional Admin', 'Department Head'],
    completed: ['Super Admin', 'Divisional Admin', 'Department Head'],
    master: ['Super Admin', 'Divisional Admin', 'Department Head'],
    individual: ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'],
    department: ['Super Admin', 'Divisional Admin', 'Department Head'],
    verification: ['Super Admin', 'Divisional Admin', 'Department Head']
  });

  pillars = signal<string[]>([
    'Infrastructure',
    'Land Deeds',
    'Client Services',
    'Operations',
    'Compliance'
  ]);

  newPillarName = '';

  ngOnInit() {
    if (!this.canManageSettings()) {
      this.snackBar.open('Access Denied: You do not have permission to access Work Plan Settings.', 'Dismiss', { duration: 3500 });
      this.router.navigate(['/work-plans/tasks']);
      return;
    }

    const s = this.workPlanService.settings();
    this.autoRollover = s.autoRollover;
    this.archiveOriginalMonth = s.archiveOriginalMonth;
    this.highlightRolloverBadge = s.highlightRolloverBadge;
    this.requireAllMilestones = s.requireAllMilestones;
    this.auditLogTransitions = s.auditLogTransitions;
    this.defaultRequiredVerifiersCount.set(s.defaultRequiredVerifiersCount || 1);

    if (s.departmentVerifierPolicies) {
      this.departmentVerifierPolicies.set({ ...s.departmentVerifierPolicies });
    }
    if (s.rolesPermittedForSummary) {
      this.rolesPermittedForSummary.set([...s.rolesPermittedForSummary]);
    }
    if (s.rolesPermittedForVerification) {
      this.rolesPermittedForVerification.set([...s.rolesPermittedForVerification]);
    }
    if (s.rolesPermittedForEditAndAssign) {
      this.rolesPermittedForEditAndAssign.set([...s.rolesPermittedForEditAndAssign]);
    }
    if (s.rolesPermittedToCreateOnBehalf) {
      this.rolesPermittedToCreateOnBehalf.set([...s.rolesPermittedToCreateOnBehalf]);
    }
    if (s.rolesPermittedForAllReports) {
      this.rolesPermittedForAllReports.set([...s.rolesPermittedForAllReports]);
    }
    if (s.rolesPermittedForIndividualReports) {
      this.rolesPermittedForIndividualReports.set([...s.rolesPermittedForIndividualReports]);
    }

    if (s.rolesPermittedByReportType) {
      this.rolesPermittedByReportType.set({
        pending: s.rolesPermittedByReportType.pending ? [...s.rolesPermittedByReportType.pending] : ['Super Admin', 'Divisional Admin', 'Department Head'],
        completed: s.rolesPermittedByReportType.completed ? [...s.rolesPermittedByReportType.completed] : ['Super Admin', 'Divisional Admin', 'Department Head'],
        master: s.rolesPermittedByReportType.master ? [...s.rolesPermittedByReportType.master] : ['Super Admin', 'Divisional Admin', 'Department Head'],
        individual: s.rolesPermittedByReportType.individual ? [...s.rolesPermittedByReportType.individual] : (s.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent']),
        department: s.rolesPermittedByReportType.department ? [...s.rolesPermittedByReportType.department] : ['Super Admin', 'Divisional Admin', 'Department Head'],
        verification: s.rolesPermittedByReportType.verification ? [...s.rolesPermittedByReportType.verification] : ['Super Admin', 'Divisional Admin', 'Department Head']
      });
    } else {
      const allReports = s.rolesPermittedForAllReports || ['Super Admin', 'Divisional Admin', 'Department Head'];
      const indReports = s.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];
      this.rolesPermittedByReportType.set({
        pending: [...allReports],
        completed: [...allReports],
        master: [...allReports],
        individual: [...indReports],
        department: [...allReports],
        verification: [...allReports]
      });
    }

    if (s.pillars) {
      this.pillars.set([...s.pillars]);
    }

    this.loadDepartments();
  }

  private loadDepartments() {
    this.settingsService.getDepartments().subscribe({
      next: async (depts) => {
        let departments = depts || [];
        if (departments.length === 0) {
          await this.settingsService.seedDefaultDepartmentsIfEmpty(0);
          departments = this.settingsService.getDefaultSeedDepartments();
        }
        this.loadedDepartments.set(departments);

        const set = new Set<string>();
        departments.forEach(d => {
          if (d.name && d.name.trim()) {
            set.add(d.name.trim());
          }
        });

        // Merge any quotas stored directly on department docs in database into departmentVerifierPolicies
        this.departmentVerifierPolicies.update(policies => {
          const updated = { ...policies };
          departments.forEach(d => {
            if (d.name && d.verificationQuota !== undefined && d.verificationQuota > 0) {
              if (updated[d.name.trim()] === undefined) {
                updated[d.name.trim()] = d.verificationQuota;
              }
            }
          });
          return updated;
        });

        // Also include any department that has a policy configured
        Object.keys(this.departmentVerifierPolicies()).forEach(d => set.add(d));
        this.departmentList.set(Array.from(set).sort());
      },
      error: () => {
        const set = new Set<string>();
        Object.keys(this.departmentVerifierPolicies()).forEach(d => set.add(d));
        this.departmentList.set(Array.from(set).sort());
      }
    });
  }

  getDeptVerifierCount(dept: string): number {
    const policies = this.departmentVerifierPolicies();
    if (policies[dept] !== undefined && policies[dept] !== null) {
      return policies[dept];
    }
    return this.defaultRequiredVerifiersCount();
  }

  updateDeptVerifierCount(dept: string, delta: number) {
    const current = this.getDeptVerifierCount(dept);
    const next = Math.max(1, Math.min(5, current + delta));
    this.departmentVerifierPolicies.update(policies => ({
      ...policies,
      [dept]: next
    }));
  }

  updateDefaultVerifierCount(delta: number) {
    const current = this.defaultRequiredVerifiersCount();
    const next = Math.max(1, Math.min(5, current + delta));
    this.defaultRequiredVerifiersCount.set(next);
  }

  isRolePermitted(role: string): boolean {
    return this.rolesPermittedForSummary().includes(role);
  }

  toggleRolePermitted(role: string) {
    const current = this.rolesPermittedForSummary();
    if (current.includes(role)) {
      this.rolesPermittedForSummary.set(current.filter(r => r !== role));
    } else {
      this.rolesPermittedForSummary.set([...current, role]);
    }
  }

  isVerificationRolePermitted(role: string): boolean {
    return this.rolesPermittedForVerification().includes(role);
  }

  toggleVerificationRolePermitted(role: string) {
    const current = this.rolesPermittedForVerification();
    if (current.includes(role)) {
      this.rolesPermittedForVerification.set(current.filter(r => r !== role));
    } else {
      this.rolesPermittedForVerification.set([...current, role]);
    }
  }

  isEditAssignRolePermitted(role: string): boolean {
    return this.rolesPermittedForEditAndAssign().includes(role);
  }

  toggleEditAssignRolePermitted(role: string) {
    const current = this.rolesPermittedForEditAndAssign();
    if (current.includes(role)) {
      this.rolesPermittedForEditAndAssign.set(current.filter(r => r !== role));
    } else {
      this.rolesPermittedForEditAndAssign.set([...current, role]);
    }
  }

  isCreateOnBehalfRolePermitted(role: string): boolean {
    return this.rolesPermittedToCreateOnBehalf().includes(role);
  }

  toggleCreateOnBehalfRolePermitted(role: string) {
    const current = this.rolesPermittedToCreateOnBehalf();
    if (current.includes(role)) {
      this.rolesPermittedToCreateOnBehalf.set(current.filter(r => r !== role));
    } else {
      this.rolesPermittedToCreateOnBehalf.set([...current, role]);
    }
  }

  isAllReportsRolePermitted(role: string): boolean {
    return this.rolesPermittedForAllReports().includes(role);
  }

  toggleAllReportsRolePermitted(role: string) {
    const current = this.rolesPermittedForAllReports();
    if (current.includes(role)) {
      this.rolesPermittedForAllReports.set(current.filter(r => r !== role));
    } else {
      this.rolesPermittedForAllReports.set([...current, role]);
    }
  }

  isIndividualReportsRolePermitted(role: string): boolean {
    return this.rolesPermittedForIndividualReports().includes(role);
  }

  toggleIndividualReportsRolePermitted(role: string) {
    const current = this.rolesPermittedForIndividualReports();
    if (current.includes(role)) {
      this.rolesPermittedForIndividualReports.set(current.filter(r => r !== role));
    } else {
      this.rolesPermittedForIndividualReports.set([...current, role]);
    }
  }

  getActiveReportOption() {
    return this.reportOptionsConfig.find(o => o.id === this.selectedReportOption()) || this.reportOptionsConfig[0];
  }

  getRolesForReport(reportId: string): string[] {
    const map = this.rolesPermittedByReportType();
    return map[reportId] || [];
  }

  isRolePermittedForReport(reportId: string, role: string): boolean {
    const roles = this.getRolesForReport(reportId);
    return roles.includes(role);
  }

  toggleRoleForReport(reportId: string, role: string) {
    this.rolesPermittedByReportType.update(map => {
      const currentRoles = map[reportId] ? [...map[reportId]] : [];
      const updatedRoles = currentRoles.includes(role)
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role];
      return {
        ...map,
        [reportId]: updatedRoles
      };
    });
  }

  setAllRolesForReport(reportId: string) {
    this.rolesPermittedByReportType.update(map => ({
      ...map,
      [reportId]: [...this.availableRoles]
    }));
  }

  setAdminsOnlyForReport(reportId: string) {
    this.rolesPermittedByReportType.update(map => ({
      ...map,
      [reportId]: ['Super Admin', 'Divisional Admin']
    }));
  }

  clearRolesForReport(reportId: string) {
    this.rolesPermittedByReportType.update(map => ({
      ...map,
      [reportId]: []
    }));
  }

  getRoleDescription(role: string): string {
    switch (role) {
      case 'Super Admin': return 'Global system administrator with root access';
      case 'Divisional Admin': return 'Regional division manager overseeing district branches';
      case 'Department Head': return 'Pillar lead overseeing department deliverables & milestones';
      case 'Staff': return 'General operations officer executing standard directives';
      case 'HR': return 'Human resources & personnel administration';
      case 'Field Agent': return 'Frontline branch agent executing customer service tasks';
      default: return 'System user';
    }
  }

  addPillar() {
    if (!this.newPillarName.trim()) return;
    this.pillars.update(list => [...list, this.newPillarName.trim()]);
    this.newPillarName = '';
  }

  async saveSettings() {
    const policies = this.departmentVerifierPolicies();
    const repTypeRoles = this.rolesPermittedByReportType();
    
    // Synchronize legacy rolesPermittedForAllReports and rolesPermittedForIndividualReports
    const legacyAllReports = Array.from(new Set([
      ...(repTypeRoles['pending'] || []),
      ...(repTypeRoles['completed'] || []),
      ...(repTypeRoles['master'] || []),
      ...(repTypeRoles['department'] || []),
      ...(repTypeRoles['verification'] || [])
    ]));
    const legacyIndReports = repTypeRoles['individual'] || [];

    await this.workPlanService.updateSettings({
      autoRollover: this.autoRollover,
      archiveOriginalMonth: this.archiveOriginalMonth,
      highlightRolloverBadge: this.highlightRolloverBadge,
      requireAllMilestones: this.requireAllMilestones,
      auditLogTransitions: this.auditLogTransitions,
      rolesPermittedForSummary: this.rolesPermittedForSummary(),
      rolesPermittedForVerification: this.rolesPermittedForVerification(),
      rolesPermittedForEditAndAssign: this.rolesPermittedForEditAndAssign(),
      rolesPermittedToCreateOnBehalf: this.rolesPermittedToCreateOnBehalf(),
      rolesPermittedForAllReports: legacyAllReports,
      rolesPermittedForIndividualReports: legacyIndReports,
      rolesPermittedByReportType: repTypeRoles,
      pillars: this.pillars(),
      departmentVerifierPolicies: policies,
      defaultRequiredVerifiersCount: this.defaultRequiredVerifiersCount()
    });

    // Synchronize verification quotas into each department document in settings_departments collection in database
    const depts = this.loadedDepartments();
    for (const dept of depts) {
      if (dept.name && policies[dept.name] !== undefined) {
        const quota = policies[dept.name];
        if (dept.id && dept.verificationQuota !== quota) {
          try {
            await this.settingsService.updateDepartment(dept.id, { verificationQuota: quota });
          } catch (e) {
            console.warn('Failed to update department verification quota for', dept.name, e);
          }
        }
      }
    }

    this.eventLogService.logAction('UPDATED', 'WorkPlans', 'Updated Work Plan operational, verification quotas, and report role policies');
    this.snackBar.open('Work plan operational & report visibility policies saved successfully', 'Dismiss', { duration: 3000 });
  }
}
