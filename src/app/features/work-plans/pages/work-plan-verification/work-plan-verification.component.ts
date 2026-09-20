import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { WorkPlan, WorkPlanService, WorkPlanVerifier, PRIORITY_WEIGHTS, getPlanDepartment, isUserAssignedToVerifier, canUserApproveStage, canUserApproveNextStage, resetPlanVerifiers, resetStageVerification } from '../../services/work-plan.service';
import { WorkPlanDetailDialogComponent } from '../../components/work-plan-detail-dialog/work-plan-detail-dialog.component';
import { WorkPlanRevisionDialogComponent } from '../../components/work-plan-revision-dialog/work-plan-revision-dialog.component';
import { WorkPlanReassignDialogComponent } from '../../components/work-plan-reassign-dialog/work-plan-reassign-dialog.component';
import { SettingsService, Department } from '../../../settings/settings.service';
import { EventLogService } from '../../../../core/services/event-log.service';
import { RbacService } from '../../../../auth/rbac.service';
import { AuthService } from '../../../../auth/auth.service';

@Component({
  selector: 'app-work-plan-verification',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    WorkPlanReassignDialogComponent
  ],
  template: `
    <div class="work-plan-verification-page">

      <!-- Hero Header -->
      <div class="hero-banner">
        <div class="hero-content">
          <div class="hero-tag-row">
            <span class="status-pill emerald">
              <mat-icon class="pill-icon">verified</mat-icon> Quality Assurance & Audit
            </span>
            <span class="sync-indicator">Milestone Sign-Off & Compliance Verification</span>
          </div>
          <h1 class="hero-title">Directive Verification Hub</h1>
          <p class="hero-subtitle">
            Formal audit reviews, quality verification, and completion sign-offs for department work plan deliverables.
          </p>
        </div>
      </div>

      <!-- Sub-Category Tab Navigation Bar -->
      <div class="sub-category-tabs">
        <a routerLink="/work-plans/dashboard" routerLinkActive="active" class="sub-tab-btn">
          <mat-icon>insights</mat-icon>
          <span>Dashboard</span>
        </a>
        <a *ngIf="canAccessVerification()" routerLink="/work-plans/verification" routerLinkActive="active" class="sub-tab-btn">
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

      <!-- Verification Content (Accessible only to permitted roles) -->
      <ng-container *ngIf="canAccessVerification()">

        <!-- Verification KPI Cards -->
        <div class="verification-kpi-grid">
          <mat-card class="kpi-card">
            <div class="kpi-inner">
              <div class="kpi-top">
                <span class="kpi-label">Awaiting Verification</span>
                <div class="kpi-icon-box amber"><mat-icon>pending_actions</mat-icon></div>
              </div>
              <div class="kpi-value-row">
                <span class="kpi-number">{{ reviewPlans().length }}</span>
                <span class="kpi-badge amber">Queue</span>
              </div>
              <div class="kpi-footer">Submitted across all departments</div>
            </div>
          </mat-card>

          <mat-card class="kpi-card urgent-highlight-card">
            <div class="kpi-inner">
              <div class="kpi-top">
                <span class="kpi-label">Urgent Directives</span>
                <div class="kpi-icon-box coral"><mat-icon>priority_high</mat-icon></div>
              </div>
              <div class="kpi-value-row">
                <span class="kpi-number">{{ urgentReviewCount() }}</span>
                <span class="kpi-badge coral" [class.pulsing]="urgentReviewCount() > 0">Urgent Attention</span>
              </div>
              <div class="kpi-footer">Priority compliance deadlines</div>
            </div>
          </mat-card>

          <mat-card class="kpi-card">
            <div class="kpi-inner">
              <div class="kpi-top">
                <span class="kpi-label">Verified & Approved</span>
                <div class="kpi-icon-box emerald"><mat-icon>verified</mat-icon></div>
              </div>
              <div class="kpi-value-row">
                <span class="kpi-number">{{ verifiedPlans().length }}</span>
                <span class="kpi-badge emerald">100% Signed</span>
              </div>
              <div class="kpi-footer">Formally archived directives</div>
            </div>
          </mat-card>

          <mat-card class="kpi-card">
            <div class="kpi-inner">
              <div class="kpi-top">
                <span class="kpi-label">Audit Compliance Rate</span>
                <div class="kpi-icon-box indigo"><mat-icon>speed</mat-icon></div>
              </div>
              <div class="kpi-value-row">
                <span class="kpi-number">{{ complianceRate() }}%</span>
                <span class="kpi-badge indigo">Audited</span>
              </div>
              <div class="kpi-footer">Deliverable completion integrity</div>
            </div>
          </mat-card>
        </div>

        <!-- Sticky / Floating Batch Verification Action Bar -->
        <div class="batch-action-bar" *ngIf="selectedPlanIds().size > 0">
          <div class="batch-info">
            <mat-icon class="batch-icon">checklist</mat-icon>
            <span class="batch-count">{{ selectedPlanIds().size }}</span>
            <span class="batch-label">directive(s) selected for audit sign-off</span>
          </div>
          <div class="batch-buttons">
            <button mat-flat-button class="batch-approve-btn" (click)="approveSelectedPlans()">
              <mat-icon>done_all</mat-icon> Approve Selected ({{ selectedPlanIds().size }})
            </button>
            <button mat-stroked-button class="batch-revision-btn" (click)="requestRevisionSelectedPlans()">
              <mat-icon>replay</mat-icon> Request Revision ({{ selectedPlanIds().size }})
            </button>
            <button mat-button class="batch-clear-btn" (click)="clearSelection()">
              <mat-icon>clear</mat-icon> Deselect All
            </button>
          </div>
        </div>

        <!-- Verification Queue Card -->
        <mat-card class="verification-card">

          <!-- Card Header with Title and Queue Stats -->
          <div class="card-header">
            <div class="header-left">
              <div class="header-icon-box"><mat-icon>fact_check</mat-icon></div>
              <div>
                <h3>Deliverables Awaiting Audit Sign-Off</h3>
                <p>Prioritize by urgency, filter and group by department, and conduct rapid single or batch verifications</p>
              </div>
            </div>
            <div class="header-right">
              <span class="queue-tag" *ngIf="reviewPlans().length > 0">
                <span class="live-dot"></span> {{ reviewPlans().length }} Total Directives Pending Audit
              </span>
            </div>
          </div>

          <!-- Comprehensive Audit Toolbar: Search, Department, Priority, Sort & Grouping -->
          <div class="verification-controls-toolbar">
            <!-- Search Input -->
            <div class="search-wrap">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
                     placeholder="Search directives, lead officer, department, milestone..." class="search-input">
              <button *ngIf="searchQuery()" mat-icon-button class="clear-search-btn" (click)="searchQuery.set('')" matTooltip="Clear search">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Department Dropdown / Selector -->
            <div class="filter-group">
              <span class="control-label"><mat-icon class="label-icon">corporate_fare</mat-icon> Department:</span>
              <mat-select [ngModel]="selectedDepartment()" (selectionChange)="selectedDepartment.set($event.value)" class="control-select">
                <mat-option value="ALL">All Departments ({{ reviewPlans().length }})</mat-option>
                <mat-option *ngFor="let dept of departmentOptions()" [value]="dept.name">
                  {{ dept.name }} ({{ dept.count }})
                </mat-option>
              </mat-select>
            </div>

            <!-- Sort By Selector -->
            <div class="filter-group">
              <span class="control-label"><mat-icon class="label-icon">sort</mat-icon> Sort:</span>
              <mat-select [ngModel]="sortBy()" (selectionChange)="sortBy.set($event.value)" class="control-select sort-select">
                <mat-option value="priority">Priority (Urgent First)</mat-option>
                <mat-option value="deadline">Target Deadline (Earliest)</mat-option>
                <mat-option value="dept">Department (A - Z)</mat-option>
                <mat-option value="progress">Progress (% High to Low)</mat-option>
              </mat-select>
            </div>

            <!-- Group by Department Toggle Switch -->
            <button mat-stroked-button class="group-toggle-btn" [class.active]="groupByDepartment()" (click)="groupByDepartment.set(!groupByDepartment())"
                    matTooltip="Toggle categorized department view">
              <mat-icon>{{ groupByDepartment() ? 'view_agenda' : 'folder_open' }}</mat-icon>
              <span>{{ groupByDepartment() ? 'Grouped by Dept' : 'Group by Dept' }}</span>
            </button>
          </div>

          <!-- Priority Filter Chips Row -->
          <div class="priority-chips-row">
            <span class="chips-label">Priority Filter:</span>
            <button class="filter-chip" [class.active]="selectedPriority() === 'ALL'" (click)="selectedPriority.set('ALL')">
              All Priorities ({{ reviewPlans().length }})
            </button>
            <button class="filter-chip urgent-chip" [class.active]="selectedPriority() === 'Urgent'" (click)="selectedPriority.set('Urgent')">
              <span class="chip-dot coral"></span>
              Urgent ({{ urgentReviewCount() }})
            </button>
            <button class="filter-chip high-chip" [class.active]="selectedPriority() === 'High'" (click)="selectedPriority.set('High')">
              <span class="chip-dot amber"></span>
              High ({{ highReviewCount() }})
            </button>
            <button class="filter-chip medium-chip" [class.active]="selectedPriority() === 'Medium'" (click)="selectedPriority.set('Medium')">
              <span class="chip-dot indigo"></span>
              Medium ({{ mediumReviewCount() }})
            </button>
            <button class="filter-chip low-chip" [class.active]="selectedPriority() === 'Low'" (click)="selectedPriority.set('Low')">
              <span class="chip-dot slate"></span>
              Low ({{ lowReviewCount() }})
            </button>

            <!-- Multi-Select All Checkbox in Toolbar -->
            <div class="select-all-wrap" *ngIf="filteredReviewPlans().length > 0">
              <mat-checkbox [checked]="isAllSelected()" [indeterminate]="isPartiallySelected()" (change)="toggleSelectAll()" class="select-all-check">
                <span class="select-all-label">Select All ({{ filteredReviewPlans().length }})</span>
              </mat-checkbox>
            </div>
          </div>

          <!-- Grouped by Department View -->
          <ng-container *ngIf="groupByDepartment() && filteredReviewPlans().length > 0">
            <div class="department-group-section" *ngFor="let group of groupedByDepartmentPlans()">
              <div class="dept-group-header">
                <div class="dept-title-box">
                  <div class="dept-icon-box"><mat-icon>corporate_fare</mat-icon></div>
                  <div>
                    <h4 class="dept-group-name">{{ group.department }}</h4>
                    <span class="dept-count-sub">{{ group.plans.length }} Directive(s) Awaiting Audit Sign-Off</span>
                  </div>
                </div>

                <!-- 1-Click Fast Department Verification -->
                <button mat-stroked-button class="dept-approve-all-btn" (click)="approveDepartmentPlans(group.department, group.plans)">
                  <mat-icon>done_all</mat-icon> Approve All for {{ group.department }} ({{ group.plans.length }})
                </button>
              </div>

              <!-- List for this Department -->
              <div class="queue-list">
                <div class="queue-item" *ngFor="let plan of group.plans" [class.urgent-card]="plan.priority === 'Urgent'" [class.high-card]="plan.priority === 'High'" [class.selected]="isSelected(plan.id)">
                  <!-- Card Selection Checkbox -->
                  <div class="item-select-col">
                    <mat-checkbox [checked]="isSelected(plan.id)" (change)="toggleSelection(plan.id)"></mat-checkbox>
                  </div>

                  <div class="item-main">
                    <div class="item-title-row">
                      <h4 class="plan-title" (click)="openDetail(plan)">{{ plan.title }}</h4>

                      <!-- Priority Badge with Pulse on Urgent -->
                      <span class="badge priority" [ngClass]="{
                        'coral': plan.priority === 'Urgent',
                        'amber': plan.priority === 'High',
                        'indigo': plan.priority === 'Medium',
                        'slate': plan.priority === 'Low'
                      }">
                        <span class="priority-dot" *ngIf="plan.priority === 'Urgent'"></span>
                        {{ plan.priority }} Priority
                      </span>

                      <!-- Department Badge -->
                      <span class="badge department">
                        <mat-icon class="badge-icon">corporate_fare</mat-icon>
                        {{ getDepartmentName(plan) }}
                      </span>

                      <!-- Division Badge -->
                      <span class="badge division">
                        <mat-icon class="badge-icon">location_city</mat-icon>
                        {{ plan.division }}
                      </span>

                      <!-- Pillar Badge -->
                      <span class="badge pillar">{{ plan.category }}</span>
                    </div>

                    <p class="item-desc">{{ plan.description }}</p>

                    <!-- Milestone Deliverables Checklist Preview -->
                    <div class="milestones-preview" *ngIf="plan.milestones && plan.milestones.length > 0">
                      <div class="checklist-header">
                        <span class="checklist-title">Checklist Deliverables:</span>
                        <span class="milestone-ratio" [class.all-done]="areAllMilestonesComplete(plan)">
                          <mat-icon class="ratio-icon">{{ areAllMilestonesComplete(plan) ? 'check_circle' : 'pending' }}</mat-icon>
                          {{ getCompletedMilestonesCount(plan) }}/{{ plan.milestones.length }} Completed
                        </span>
                      </div>
                      <div class="tasks-chips">
                        <span class="task-chip" *ngFor="let m of plan.milestones" [class.done]="m.completed">
                          <mat-icon class="check-icon">{{ m.completed ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                          {{ m.title }}
                        </span>
                      </div>
                    </div>

                    <!-- Verifier Stages Pipeline Preview -->
                    <div class="verifiers-chain-preview" *ngIf="getPlanVerifiersList(plan).length > 0">
                      <div class="chain-header">
                        <span class="chain-title">Verification Pipeline:</span>
                        <span class="chain-status" [class.all-done]="areAllPlanVerifiersApproved(plan)">
                          {{ getApprovedVerifiersCount(plan) }}/{{ getPlanVerifiersList(plan).length }} Stages Approved
                        </span>
                      </div>
                      <div class="verifier-chips-row">
                        <span class="v-stage-chip" *ngFor="let v of getPlanVerifiersList(plan)" 
                              [class.signed]="v.verified"
                              [class.user-stage]="isAssignedToCurrentUser(v)"
                              [class.active-pending]="!v.verified && isStageNext(plan, v)">
                          <mat-icon class="v-chip-icon">{{ v.verified ? 'check_circle' : (isStageNext(plan, v) ? (isAssignedToCurrentUser(v) ? 'how_to_reg' : 'lock') : 'lock_clock') }}</mat-icon>
                          Stage {{ v.order }}: {{ v.name }}
                          <span class="v-your-turn-badge" *ngIf="!v.verified && isStageNext(plan, v) && isAssignedToCurrentUser(v)">Your Turn</span>
                          <span class="v-comment-hint" *ngIf="v.reviewComment" [matTooltip]="v.reviewComment">💬</span>
                          <button type="button" 
                                  class="chip-reset-btn" 
                                  *ngIf="v.verified && canResetStageApproval(plan, v)" 
                                  (click)="$event.stopPropagation(); resetStageApproval(plan, v)" 
                                  matTooltip="Reset Stage {{ v.order }} Approval">
                            <mat-icon>restart_alt</mat-icon>
                          </button>
                        </span>
                      </div>
                    </div>

                    <!-- Rollback Revision Guidance Alert -->
                    <div class="revision-notice-banner" *ngIf="plan.revisionNotes">
                      <mat-icon class="rev-icon">replay</mat-icon>
                      <div class="rev-content">
                        <strong>Returned for Revision:</strong>
                        <span>{{ plan.revisionNotes }}</span>
                        <span class="rev-meta" *ngIf="plan.rollbackByEmail"> &bull; by {{ plan.rollbackByEmail }}</span>
                      </div>
                    </div>

                    <!-- Verifier Audit & Approval Comment Area -->
                    <div class="approval-comment-section" *ngIf="canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)">
                      <div class="comment-section-header">
                        <mat-icon class="comment-icon">rate_review</mat-icon>
                        <span class="comment-label">Approval Remarks & Audit Findings for Stage {{ getNextStageNumber(plan) }}:</span>
                      </div>
                      <textarea [(ngModel)]="approvalComments[plan.id!]"
                                rows="2"
                                class="stage-approval-textarea"
                                placeholder="Enter verification observations, compliance checks, or approval remarks before sign-off..."></textarea>
                    </div>

                    <div class="item-footer">
                      <span class="lead-text">
                        <mat-icon class="lead-icon">person</mat-icon>
                        Performer: <strong>{{ plan.ownerName || plan.createdByName || plan.leadName }}</strong>
                      </span>
                      <span class="lead-text verifier-progress-pill" [class.all-done]="areAllPlanVerifiersApproved(plan)">
                        <mat-icon class="lead-icon">{{ areAllPlanVerifiersApproved(plan) ? 'verified' : 'how_to_reg' }}</mat-icon>
                        Verifiers: <strong>{{ getApprovedVerifiersCount(plan) }}/{{ getPlanVerifiersList(plan).length }} Signed</strong>
                      </span>
                      <span class="lead-text">
                        <mat-icon class="lead-icon">payments</mat-icon>
                        Budget: <strong>{{ plan.budget ? 'LKR ' + (plan.budget | number) : 'Not allocated' }}</strong>
                      </span>
                      <span class="lead-text" [class.overdue]="isOverdue(plan.targetDate)">
                        <mat-icon class="lead-icon">event</mat-icon>
                        Target Due: <strong>{{ plan.targetDate | date:'mediumDate' }}</strong>
                        <span class="due-warning" *ngIf="isOverdue(plan.targetDate)">Overdue</span>
                      </span>
                      <span class="lead-text">
                        <mat-icon class="lead-icon">trending_up</mat-icon>
                        Progress: <strong>{{ plan.progress }}%</strong>
                      </span>
                    </div>
                  </div>

                  <!-- Quick 1-Click Verification Actions -->
                  <div class="item-actions">
                    <button mat-flat-button class="approve-btn" (click)="approvePlan(plan)" 
                            [class.user-turn-btn]="canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)"
                            [class.locked-btn]="!canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)"
                            [matTooltip]="getApproveButtonTooltip(plan)">
                      <mat-icon>{{ getApproveButtonIcon(plan) }}</mat-icon> 
                      {{ getApproveButtonLabel(plan) }}
                    </button>
                    <button mat-stroked-button class="reset-approval-btn" 
                            *ngIf="getApprovedVerifiersCount(plan) > 0 && canResetPlanApproval(plan)"
                            (click)="resetPlanApproval(plan)" 
                            matTooltip="Revoke and reset verification approvals back to pending">
                      <mat-icon>restart_alt</mat-icon> Reset Approval
                    </button>
                    <button mat-stroked-button class="revision-btn" (click)="requestRevision(plan)" matTooltip="Return directive to In Progress for corrections">
                      <mat-icon>replay</mat-icon> Request Revisions
                    </button>
                    <button mat-stroked-button class="reassign-btn" 
                            *ngIf="canReassignOfficer() && !canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)"
                            (click)="reassignNextStage(plan)"
                            matTooltip="Administrative override: Reassign absent or unavailable officer">
                      <mat-icon>manage_accounts</mat-icon> Reassign
                    </button>
                    <button mat-stroked-button class="inspect-btn" (click)="openDetail(plan)" matTooltip="Inspect full brief and milestones">
                      <mat-icon>visibility</mat-icon> Inspect Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- Flat Sorted List View (Default) -->
          <ng-container *ngIf="!groupByDepartment() && filteredReviewPlans().length > 0">
            <div class="queue-list">
              <div class="queue-item" *ngFor="let plan of filteredReviewPlans()" [class.urgent-card]="plan.priority === 'Urgent'" [class.high-card]="plan.priority === 'High'" [class.selected]="isSelected(plan.id)">
                <!-- Card Selection Checkbox -->
                <div class="item-select-col">
                  <mat-checkbox [checked]="isSelected(plan.id)" (change)="toggleSelection(plan.id)"></mat-checkbox>
                </div>

                <div class="item-main">
                  <div class="item-title-row">
                    <h4 class="plan-title" (click)="openDetail(plan)">{{ plan.title }}</h4>

                    <!-- Priority Badge with Pulse on Urgent -->
                    <span class="badge priority" [ngClass]="{
                      'coral': plan.priority === 'Urgent',
                      'amber': plan.priority === 'High',
                      'indigo': plan.priority === 'Medium',
                      'slate': plan.priority === 'Low'
                    }">
                      <span class="priority-dot" *ngIf="plan.priority === 'Urgent'"></span>
                      {{ plan.priority }} Priority
                    </span>

                    <!-- Department Badge -->
                    <span class="badge department">
                      <mat-icon class="badge-icon">corporate_fare</mat-icon>
                      {{ getDepartmentName(plan) }}
                    </span>

                    <!-- Division Badge -->
                    <span class="badge division">
                      <mat-icon class="badge-icon">location_city</mat-icon>
                      {{ plan.division }}
                    </span>

                    <!-- Pillar Badge -->
                    <span class="badge pillar">{{ plan.category }}</span>
                  </div>

                  <p class="item-desc">{{ plan.description }}</p>

                  <!-- Milestone Deliverables Checklist Preview -->
                  <div class="milestones-preview" *ngIf="plan.milestones && plan.milestones.length > 0">
                    <div class="checklist-header">
                      <span class="checklist-title">Checklist Deliverables:</span>
                      <span class="milestone-ratio" [class.all-done]="areAllMilestonesComplete(plan)">
                        <mat-icon class="ratio-icon">{{ areAllMilestonesComplete(plan) ? 'check_circle' : 'pending' }}</mat-icon>
                        {{ getCompletedMilestonesCount(plan) }}/{{ plan.milestones.length }} Completed
                      </span>
                    </div>
                    <div class="tasks-chips">
                      <span class="task-chip" *ngFor="let m of plan.milestones" [class.done]="m.completed">
                        <mat-icon class="check-icon">{{ m.completed ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        {{ m.title }}
                      </span>
                    </div>
                  </div>

                  <!-- Verifier Stages Pipeline Preview -->
                    <div class="verifiers-chain-preview" *ngIf="getPlanVerifiersList(plan).length > 0">
                      <div class="chain-header">
                        <span class="chain-title">Verification Pipeline:</span>
                        <span class="chain-status" [class.all-done]="areAllPlanVerifiersApproved(plan)">
                          {{ getApprovedVerifiersCount(plan) }}/{{ getPlanVerifiersList(plan).length }} Stages Approved
                        </span>
                      </div>
                      <div class="verifier-chips-row">
                        <span class="v-stage-chip" *ngFor="let v of getPlanVerifiersList(plan)" 
                              [class.signed]="v.verified"
                              [class.user-stage]="isAssignedToCurrentUser(v)"
                              [class.active-pending]="!v.verified && isStageNext(plan, v)">
                          <mat-icon class="v-chip-icon">{{ v.verified ? 'check_circle' : (isStageNext(plan, v) ? (isAssignedToCurrentUser(v) ? 'how_to_reg' : 'lock') : 'lock_clock') }}</mat-icon>
                          Stage {{ v.order }}: {{ v.name }}
                          <span class="v-your-turn-badge" *ngIf="!v.verified && isStageNext(plan, v) && isAssignedToCurrentUser(v)">Your Turn</span>
                          <span class="v-comment-hint" *ngIf="v.reviewComment" [matTooltip]="v.reviewComment">💬</span>
                          <button type="button" 
                                  class="chip-reset-btn" 
                                  *ngIf="v.verified && canResetStageApproval(plan, v)" 
                                  (click)="$event.stopPropagation(); resetStageApproval(plan, v)" 
                                  matTooltip="Reset Stage {{ v.order }} Approval">
                            <mat-icon>restart_alt</mat-icon>
                          </button>
                        </span>
                      </div>
                    </div>

                    <!-- Rollback Revision Guidance Alert -->
                    <div class="revision-notice-banner" *ngIf="plan.revisionNotes">
                      <mat-icon class="rev-icon">replay</mat-icon>
                      <div class="rev-content">
                        <strong>Returned for Revision:</strong>
                        <span>{{ plan.revisionNotes }}</span>
                        <span class="rev-meta" *ngIf="plan.rollbackByEmail"> &bull; by {{ plan.rollbackByEmail }}</span>
                      </div>
                    </div>

                    <!-- Verifier Audit & Approval Comment Area -->
                    <div class="approval-comment-section" *ngIf="canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)">
                      <div class="comment-section-header">
                        <mat-icon class="comment-icon">rate_review</mat-icon>
                        <span class="comment-label">Approval Remarks & Audit Findings for Stage {{ getNextStageNumber(plan) }}:</span>
                      </div>
                      <textarea [(ngModel)]="approvalComments[plan.id!]"
                                rows="2"
                                class="stage-approval-textarea"
                                placeholder="Enter verification observations, compliance checks, or approval remarks before sign-off..."></textarea>
                    </div>

                    <div class="item-footer">
                      <span class="lead-text">
                        <mat-icon class="lead-icon">person</mat-icon>
                        Performer: <strong>{{ plan.ownerName || plan.createdByName || plan.leadName }}</strong>
                      </span>
                      <span class="lead-text verifier-progress-pill" [class.all-done]="areAllPlanVerifiersApproved(plan)">
                        <mat-icon class="lead-icon">{{ areAllPlanVerifiersApproved(plan) ? 'verified' : 'how_to_reg' }}</mat-icon>
                        Verifiers: <strong>{{ getApprovedVerifiersCount(plan) }}/{{ getPlanVerifiersList(plan).length }} Signed</strong>
                      </span>
                      <span class="lead-text">
                        <mat-icon class="lead-icon">payments</mat-icon>
                        Budget: <strong>{{ plan.budget ? 'LKR ' + (plan.budget | number) : 'Not allocated' }}</strong>
                      </span>
                      <span class="lead-text" [class.overdue]="isOverdue(plan.targetDate)">
                        <mat-icon class="lead-icon">event</mat-icon>
                        Target Due: <strong>{{ plan.targetDate | date:'mediumDate' }}</strong>
                        <span class="due-warning" *ngIf="isOverdue(plan.targetDate)">Overdue</span>
                      </span>
                      <span class="lead-text">
                        <mat-icon class="lead-icon">trending_up</mat-icon>
                        Progress: <strong>{{ plan.progress }}%</strong>
                      </span>
                    </div>
                  </div>

                  <!-- Quick 1-Click Verification Actions -->
                  <div class="item-actions">
                    <button mat-flat-button class="approve-btn" (click)="approvePlan(plan)" 
                            [class.user-turn-btn]="canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)"
                            [class.locked-btn]="!canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)"
                            [matTooltip]="getApproveButtonTooltip(plan)">
                      <mat-icon>{{ getApproveButtonIcon(plan) }}</mat-icon> 
                      {{ getApproveButtonLabel(plan) }}
                    </button>
                    <button mat-stroked-button class="reset-approval-btn" 
                            *ngIf="getApprovedVerifiersCount(plan) > 0 && canResetPlanApproval(plan)"
                            (click)="resetPlanApproval(plan)" 
                            matTooltip="Revoke and reset verification approvals back to pending">
                      <mat-icon>restart_alt</mat-icon> Reset Approval
                    </button>
                    <button mat-stroked-button class="revision-btn" (click)="requestRevision(plan)" matTooltip="Return directive to In Progress for corrections">
                      <mat-icon>replay</mat-icon> Request Revisions
                    </button>
                    <button mat-stroked-button class="reassign-btn" 
                            *ngIf="canReassignOfficer() && !canUserApproveNextStage(plan) && !areAllPlanVerifiersApproved(plan)"
                            (click)="reassignNextStage(plan)"
                            matTooltip="Administrative override: Reassign absent or unavailable officer">
                      <mat-icon>manage_accounts</mat-icon> Reassign
                    </button>
                    <button mat-stroked-button class="inspect-btn" (click)="openDetail(plan)" matTooltip="Inspect full brief and milestones">
                      <mat-icon>visibility</mat-icon> Inspect Details
                    </button>
                  </div>
              </div>
            </div>
          </ng-container>

          <!-- Empty State when no items match filters -->
          <div class="empty-state" *ngIf="filteredReviewPlans().length === 0 && reviewPlans().length > 0">
            <mat-icon class="empty-icon">filter_alt_off</mat-icon>
            <h4>No Directives Match Filter</h4>
            <p>No deliverables match the selected department, priority, or search query.</p>
            <button mat-stroked-button color="primary" class="reset-filter-btn" (click)="resetFilters()">
              <mat-icon>restart_alt</mat-icon> Reset Filters
            </button>
          </div>

          <!-- Empty State when entire queue is clear -->
          <div class="empty-state" *ngIf="reviewPlans().length === 0">
            <mat-icon class="empty-icon-clear">task_alt</mat-icon>
            <h4>All Verification Queues Clear</h4>
            <p>No department work plans are currently awaiting audit sign-off.</p>
          </div>

        </mat-card>
      </ng-container>

      <!-- Restricted Access Card (When user lacks verification role) -->
      <div class="restricted-verification-card" *ngIf="!canAccessVerification()">
        <div class="restricted-inner">
          <div class="lock-circle"><mat-icon>lock</mat-icon></div>
          <h3>Verification Hub Access Restricted</h3>
          <p>
            Directive verification and audit sign-off authority is restricted to designated oversight roles.
            Access permissions can be configured by administrators in <a routerLink="/work-plans/settings" class="settings-link">Work Plan Settings</a>.
          </p>
          <div class="action-buttons">
            <a mat-stroked-button routerLink="/work-plans/tasks">
              <mat-icon>view_kanban</mat-icon> Go to Task List
            </a>
            <a mat-flat-button color="primary" routerLink="/work-plans/dashboard">
              <mat-icon>insights</mat-icon> Go to Dashboard
            </a>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .work-plan-verification-page {
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

    .verification-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 640px) { grid-template-columns: 1fr; }

      .kpi-card {
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-container);
        box-shadow: var(--card-shadow);
        padding: 18px 20px !important;
        background: #ffffff;

        &.urgent-highlight-card {
          border-color: #fecaca;
          background: linear-gradient(180deg, #fffafa 0%, #ffffff 100%);
        }

        .kpi-inner {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .kpi-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            .kpi-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
            .kpi-icon-box {
              width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
              mat-icon { font-size: 18px; width: 18px; height: 18px; }
              &.amber { background: var(--accent-amber-tint); color: var(--accent-amber); }
              &.coral { background: #fee2e2; color: #ef4444; }
              &.emerald { background: var(--accent-emerald-tint); color: var(--accent-emerald); }
              &.indigo { background: var(--brand-tint); color: var(--brand-accent); }
            }
          }

          .kpi-value-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            .kpi-number { font-size: 26px; font-weight: 700; color: var(--text-primary); }
            .kpi-badge {
              font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-pill);
              &.amber { background: var(--accent-amber-tint); color: #92400e; }
              &.coral { background: #fee2e2; color: #b91c1c; }
              &.emerald { background: var(--accent-emerald-tint); color: var(--accent-emerald); }
              &.indigo { background: var(--brand-tint); color: var(--brand-indigo); }

              &.pulsing {
                animation: urgentPulse 1.8s infinite;
              }
            }
          }

          .kpi-footer { font-size: 11.5px; color: var(--text-muted); }
        }
      }
    }

    @keyframes urgentPulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    /* Sticky / Floating Batch Verification Bar */
    .batch-action-bar {
      position: sticky;
      top: 16px;
      z-index: 100;
      background: #1e293b;
      color: #ffffff;
      border-radius: var(--radius-container);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.35);
      border: 1px solid #334155;
      animation: slideInDown 0.2s ease-out;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
      }

      .batch-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13.5px;

        .batch-icon { color: var(--accent-emerald); font-size: 20px; width: 20px; height: 20px; }
        .batch-count {
          background-color: var(--accent-emerald);
          color: #ffffff;
          font-weight: 700;
          font-size: 12px;
          padding: 1px 7px;
          border-radius: 10px;
        }
        .batch-label { font-weight: 500; color: #cbd5e1; }
      }

      .batch-buttons {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .batch-approve-btn {
          background-color: var(--accent-emerald);
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 600;
          height: 36px;
          border-radius: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
          &:hover { background-color: #047857; }
        }

        .batch-revision-btn {
          color: #f59e0b;
          border-color: #f59e0b;
          font-size: 12.5px;
          font-weight: 600;
          height: 36px;
          border-radius: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
          &:hover { background-color: rgba(245, 158, 11, 0.1); }
        }

        .batch-clear-btn {
          color: #94a3b8;
          font-size: 12px;
          height: 36px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 2px; }
          &:hover { color: #ffffff; }
        }
      }
    }

    @keyframes slideInDown {
      from { transform: translateY(-12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .verification-card {
      background-color: #ffffff;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-container);
      box-shadow: var(--card-shadow);
      padding: 24px !important;

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 12px;

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;

          .header-icon-box {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background-color: var(--brand-tint);
            color: var(--brand-indigo);
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 22px; width: 22px; height: 22px; }
          }

          h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--text-primary); }
          p { margin: 2px 0 0 0; font-size: 12.5px; color: var(--text-muted); }
        }

        .header-right {
          .queue-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 600;
            background: #f1f5f9;
            color: #334155;
            padding: 4px 12px;
            border-radius: var(--radius-pill);

            .live-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background-color: #f59e0b;
              display: inline-block;
            }
          }
        }
      }

      /* Controls Toolbar */
      .verification-controls-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background-color: #f8fafc;
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        margin-bottom: 14px;
        flex-wrap: wrap;

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 4px 10px;
          flex: 1;
          min-width: 240px;

          .search-icon { color: var(--text-subtle); font-size: 18px; width: 18px; height: 18px; }
          .search-input {
            border: none;
            outline: none;
            width: 100%;
            font-size: 13px;
            color: var(--text-primary);
            background: transparent;
          }
          .clear-search-btn {
            width: 20px;
            height: 20px;
            padding: 0;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 2px 10px;

          .control-label {
            font-size: 11.5px;
            font-weight: 600;
            color: var(--text-muted);
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 4px;

            .label-icon { font-size: 15px; width: 15px; height: 15px; }
          }

          .control-select {
            font-size: 12.5px;
            font-weight: 600;
            min-width: 160px;
            border: none;
          }

          .sort-select {
            min-width: 180px;
          }
        }

        .group-toggle-btn {
          height: 36px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-secondary);
          border-color: var(--border-subtle);
          background: #ffffff;
          mat-icon { font-size: 17px; width: 17px; height: 17px; margin-right: 4px; }

          &:hover { background: var(--canvas-bg); }

          &.active {
            background-color: var(--brand-tint);
            border-color: var(--brand-indigo);
            color: var(--brand-indigo);
          }
        }
      }

      /* Priority Chips Row */
      .priority-chips-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 20px;
        flex-wrap: wrap;

        .chips-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          margin-right: 4px;
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid var(--border-subtle);
          background: #ffffff;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;

          .chip-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            &.coral { background: #ef4444; }
            &.amber { background: #f59e0b; }
            &.indigo { background: #6366f1; }
            &.slate { background: #94a3b8; }
          }

          &:hover {
            background: #f1f5f9;
            color: var(--text-primary);
          }

          &.active {
            background: #1e293b;
            color: #ffffff;
            border-color: #1e293b;
          }

          &.urgent-chip.active {
            background: #ef4444;
            border-color: #ef4444;
            color: #ffffff;
          }

          &.high-chip.active {
            background: #d97706;
            border-color: #d97706;
            color: #ffffff;
          }
        }

        .select-all-wrap {
          margin-left: auto;
          display: flex;
          align-items: center;

          .select-all-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
          }
        }
      }

      /* Department Group Header */
      .department-group-section {
        margin-bottom: 24px;

        .dept-group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: #f1f5f9;
          border-radius: 8px;
          border-left: 4px solid var(--brand-indigo);
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 10px;

          .dept-title-box {
            display: flex;
            align-items: center;
            gap: 10px;

            .dept-icon-box {
              width: 32px;
              height: 32px;
              border-radius: 6px;
              background: #ffffff;
              color: var(--brand-indigo);
              display: flex;
              align-items: center;
              justify-content: center;
              mat-icon { font-size: 18px; width: 18px; height: 18px; }
            }

            .dept-group-name {
              margin: 0;
              font-size: 14.5px;
              font-weight: 700;
              color: var(--text-primary);
            }

            .dept-count-sub {
              font-size: 11.5px;
              color: var(--text-muted);
            }
          }

          .dept-approve-all-btn {
            font-size: 12px;
            font-weight: 600;
            color: var(--accent-emerald);
            border-color: var(--accent-emerald);
            height: 32px;
            border-radius: 6px;
            mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
            &:hover { background: var(--accent-emerald-tint); }
          }
        }
      }

      /* Queue List */
      .queue-list {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .queue-item {
          background-color: #fafbfc;
          border: 1px solid var(--border-subtle);
          border-left: 4px solid #cbd5e1;
          border-radius: 10px;
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          transition: all 0.15s ease;

          @media (max-width: 960px) {
            flex-direction: column;
            align-items: stretch;
          }

          &:hover {
            border-color: var(--brand-accent);
            background-color: #ffffff;
            box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.06);
          }

          &.selected {
            background-color: #f0fdf4;
            border-color: #86efac;
          }

          &.urgent-card {
            border-left-color: #ef4444;
            background-color: #fffdfd;
            &:hover { background-color: #ffffff; }
          }

          &.high-card {
            border-left-color: #f59e0b;
          }

          .item-select-col {
            padding-top: 2px;
          }

          .item-main {
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;

            .item-title-row {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;

              .plan-title {
                margin: 0;
                font-size: 15px;
                font-weight: 700;
                color: var(--text-primary);
                cursor: pointer;
                transition: color 0.15s ease;

                &:hover {
                  color: var(--brand-indigo);
                  text-decoration: underline;
                }
              }

              .badge {
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 4px;
                display: inline-flex;
                align-items: center;
                gap: 4px;

                .badge-icon { font-size: 13px; width: 13px; height: 13px; }

                &.priority {
                  font-weight: 700;
                  &.coral {
                    background: #fee2e2;
                    color: #b91c1c;
                    .priority-dot {
                      width: 6px;
                      height: 6px;
                      border-radius: 50%;
                      background: #ef4444;
                      display: inline-block;
                      animation: urgentPulse 1.5s infinite;
                    }
                  }
                  &.amber { background: #fef3c7; color: #92400e; }
                  &.indigo { background: #e0e7ff; color: #3730a3; }
                  &.slate { background: #f1f5f9; color: #475569; }
                }

                &.department {
                  background: var(--brand-tint);
                  color: var(--brand-indigo);
                  border: 1px solid rgba(79, 70, 229, 0.15);
                  font-weight: 600;
                }

                &.division {
                  background: #f1f5f9;
                  color: #475569;
                  border: 1px solid #e2e8f0;
                }

                &.pillar {
                  background: #ffffff;
                  border: 1px solid var(--border-subtle);
                  color: var(--text-secondary);
                }
              }
            }

            .item-desc {
              margin: 0;
              font-size: 13px;
              color: var(--text-secondary);
              line-height: 1.45;
            }

            /* Milestones Deliverables Preview */
            .milestones-preview {
              background: #ffffff;
              border: 1px solid var(--border-subtle);
              border-radius: 8px;
              padding: 8px 12px;
              margin-top: 4px;

              .checklist-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;

                .checklist-title {
                  font-size: 11px;
                  font-weight: 700;
                  color: var(--text-subtle);
                  text-transform: uppercase;
                  letter-spacing: 0.03em;
                }

                .milestone-ratio {
                  font-size: 11px;
                  font-weight: 600;
                  color: #d97706;
                  display: inline-flex;
                  align-items: center;
                  gap: 3px;

                  .ratio-icon { font-size: 13px; width: 13px; height: 13px; }

                  &.all-done {
                    color: var(--accent-emerald);
                  }
                }
              }

              .tasks-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;

                .task-chip {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 11.5px;
                  background: #f8fafc;
                  border: 1px solid var(--border-subtle);
                  padding: 2px 7px;
                  border-radius: 5px;
                  color: var(--text-secondary);

                  .check-icon { font-size: 13px; width: 13px; height: 13px; color: var(--text-muted); }

                  &.done {
                    background: #f0fdf4;
                    color: #15803d;
                    border-color: #bbf7d0;
                    font-weight: 600;
                    .check-icon { color: #16a34a; }
                  }
                }
              }
            }

            .verifiers-chain-preview {
              background: #f8fafc;
              border: 1px solid var(--border-subtle);
              border-radius: 6px;
              padding: 8px 12px;
              display: flex;
              flex-direction: column;
              gap: 6px;

              .chain-header {
                display: flex;
                justify-content: space-between;
                align-items: center;

                .chain-title {
                  font-size: 11px;
                  font-weight: 700;
                  color: var(--text-subtle);
                  text-transform: uppercase;
                  letter-spacing: 0.03em;
                }

                .chain-status {
                  font-size: 11px;
                  font-weight: 600;
                  color: #0284c7;

                  &.all-done {
                    color: var(--accent-emerald);
                  }
                }
              }

              .verifier-chips-row {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;

                .v-stage-chip {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 11.5px;
                  background: #ffffff;
                  border: 1px solid var(--border-subtle);
                  padding: 2px 8px;
                  border-radius: 6px;
                  color: var(--text-secondary);

                  .v-chip-icon {
                    font-size: 13px;
                    width: 13px;
                    height: 13px;
                    color: var(--text-muted);
                  }

                  &.signed {
                    background: #f0fdf4;
                    color: #15803d;
                    border-color: #bbf7d0;
                    font-weight: 600;
                    .v-chip-icon { color: #16a34a; }
                  }

                  &.active-pending {
                    background: #fffbeb;
                    color: #b45309;
                    border-color: #fde68a;
                    font-weight: 600;
                    .v-chip-icon { color: #d97706; }

                    &.user-stage {
                      background: #eff6ff;
                      color: #1d4ed8;
                      border-color: #bfdbfe;
                      .v-chip-icon { color: #2563eb; }
                    }
                  }

                  &.user-stage {
                    font-weight: 600;
                  }

                  .v-your-turn-badge {
                    background: #2563eb;
                    color: #ffffff;
                    font-size: 9.5px;
                    font-weight: 700;
                    padding: 1px 6px;
                    border-radius: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    line-height: 1.2;
                  }

                  .v-comment-hint {
                    font-size: 11px;
                    cursor: pointer;
                    margin-left: 2px;
                  }

                  .chip-reset-btn {
                    border: none;
                    background: transparent;
                    color: #dc2626;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1px;
                    margin-left: 3px;
                    border-radius: 4px;
                    line-height: 1;
                    mat-icon { font-size: 13px; width: 13px; height: 13px; }
                    &:hover { background: #fee2e2; }
                  }
                }
              }
            }

            .revision-notice-banner {
              display: flex;
              align-items: flex-start;
              gap: 8px;
              background: #fffbeb;
              border: 1px solid #fde68a;
              border-radius: 6px;
              padding: 6px 10px;
              font-size: 12px;
              color: #92400e;

              .rev-icon {
                font-size: 16px;
                width: 16px;
                height: 16px;
                color: #d97706;
                margin-top: 1px;
                flex-shrink: 0;
              }

              .rev-content {
                line-height: 1.4;
                strong { font-weight: 600; margin-right: 4px; }
                .rev-meta { font-size: 11px; color: #b45309; }
              }
            }

            .approval-comment-section {
              display: flex;
              flex-direction: column;
              gap: 4px;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 6px;
              padding: 8px 10px;

              .comment-section-header {
                display: flex;
                align-items: center;
                gap: 5px;

                .comment-icon {
                  font-size: 14px;
                  width: 14px;
                  height: 14px;
                  color: #16a34a;
                }

                .comment-label {
                  font-size: 11px;
                  font-weight: 700;
                  color: #15803d;
                  text-transform: uppercase;
                  letter-spacing: 0.02em;
                }
              }

              .stage-approval-textarea {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid #86efac;
                border-radius: 5px;
                padding: 6px 8px;
                font-size: 12px;
                font-family: inherit;
                background: #ffffff;
                color: #1e293b;
                resize: vertical;
                outline: none;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;

                &:focus {
                  border-color: #16a34a;
                  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.18);
                }

                &::placeholder {
                  color: #94a3b8;
                  font-style: italic;
                }
              }
            }

            .item-footer {
              display: flex;
              align-items: center;
              gap: 16px;
              font-size: 12px;
              color: var(--text-muted);
              margin-top: 4px;
              flex-wrap: wrap;

              .lead-text {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                .lead-icon { font-size: 15px; width: 15px; height: 15px; }
                .lead-email { color: var(--text-subtle); font-size: 11px; }

                &.verifier-progress-pill {
                  background: #e0f2fe;
                  color: #0369a1;
                  padding: 2px 8px;
                  border-radius: 12px;
                  font-weight: 500;
                  &.all-done {
                    background: #f0fdf4;
                    color: #15803d;
                  }
                }

                &.overdue {
                  color: #dc2626;
                  font-weight: 600;
                  .due-warning {
                    background: #fee2e2;
                    color: #b91c1c;
                    padding: 1px 5px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                  }
                }
              }
            }
          }

          /* 1-Click Verification Action Buttons */
          .item-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 195px;
            justify-content: center;

            @media (max-width: 960px) {
              flex-direction: row;
              flex-wrap: wrap;
              min-width: auto;
            }

            .approve-btn {
              height: 36px;
              font-size: 12.5px;
              font-weight: 600;
              background-color: var(--accent-emerald);
              color: #ffffff;
              border-radius: 6px;
              mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
              &:hover { background-color: #047857; }

              &.user-turn-btn {
                background-color: #15803d;
                box-shadow: 0 2px 6px rgba(21, 128, 61, 0.35);
                &:hover { background-color: #166534; }
              }

              &.locked-btn {
                background-color: #f1f5f9;
                color: #64748b;
                border: 1px solid #cbd5e1;
                cursor: not-allowed;
                opacity: 0.9;
                mat-icon { color: #94a3b8; }
                &:hover { background-color: #e2e8f0; color: #475569; }
              }
            }

            .reset-approval-btn {
              height: 36px;
              font-size: 12.5px;
              font-weight: 600;
              color: #dc2626;
              border-color: #fca5a5;
              background: #fef2f2;
              border-radius: 6px;
              mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
              &:hover { background: #fee2e2; border-color: #f87171; }
            }

            .revision-btn {
              height: 36px;
              font-size: 12.5px;
              font-weight: 600;
              color: #d97706;
              border-color: #fcd34d;
              background: #fffbeb;
              border-radius: 6px;
              mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
              &:hover { background: #fef3c7; }
            }

            .reassign-btn {
              height: 36px;
              font-size: 12.5px;
              font-weight: 600;
              color: #4338ca;
              border-color: #c7d2fe;
              background: #eef2ff;
              border-radius: 6px;
              mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
              &:hover { background: #e0e7ff; border-color: #a5b4fc; }
            }

            .inspect-btn {
              height: 36px;
              font-size: 12.5px;
              font-weight: 600;
              color: var(--text-secondary);
              border-radius: 6px;
              mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
              &:hover { background: var(--canvas-bg); }
            }
          }
        }
      }

      .empty-state {
        text-align: center;
        padding: 40px 24px;
        color: var(--text-muted);

        .empty-icon { font-size: 40px; width: 40px; height: 40px; color: var(--text-subtle); margin-bottom: 8px; }
        .empty-icon-clear { font-size: 44px; width: 44px; height: 44px; color: var(--accent-emerald); margin-bottom: 8px; }
        h4 { margin: 0 0 4px 0; font-size: 16px; color: var(--text-primary); }
        p { margin: 0 0 12px 0; font-size: 13px; }

        .reset-filter-btn {
          font-size: 12.5px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }

      .restricted-verification-card {
        background-color: #ffffff;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-container);
        padding: 48px 24px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: var(--card-shadow);

        .restricted-inner {
          max-width: 520px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;

          .lock-circle {
            width: 54px;
            height: 54px;
            border-radius: 50%;
            background-color: #fef2f2;
            border: 1px solid #fee2e2;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ef4444;

            mat-icon {
              font-size: 26px;
              width: 26px;
              height: 26px;
            }
          }

          h3 {
            margin: 0;
            font-size: 19px;
            font-weight: 700;
            color: var(--text-primary);
          }

          p {
            margin: 0;
            font-size: 13.5px;
            color: var(--text-secondary);
            line-height: 1.5;

            .settings-link {
              color: var(--brand-indigo);
              font-weight: 600;
              text-decoration: underline;
            }
          }

          .action-buttons {
            display: flex;
            gap: 12px;
            margin-top: 10px;
          }
        }
      }
    }
  `]
})
export class WorkPlanVerificationComponent implements OnInit {
  private router = inject(Router);
  private workPlanService = inject(WorkPlanService);
  private settingsService = inject(SettingsService);
  private rbacService = inject(RbacService);
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // Authorization check
  canAccessVerification = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    const roles = this.workPlanService.settings().rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rbacService.hasAnyRole(roles);
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

  canReassignOfficer = computed(() => {
    return this.rbacService.isSuperAdmin() || 
           this.rbacService.isAdmin() || 
           this.rbacService.hasRole('Super Admin') || 
           this.rbacService.hasRole('Divisional Admin') ||
           this.rbacService.hasRole('Department Head');
  });

  // State Signals
  workPlans = signal<WorkPlan[]>([]);
  departments = signal<Department[]>([]);

  // Batch Multi-Select Set
  selectedPlanIds = signal<Set<string>>(new Set());

  // Filter & Search Controls
  searchQuery = signal<string>('');
  selectedDepartment = signal<string>('ALL');
  selectedPriority = signal<string>('ALL');
  sortBy = signal<'priority' | 'deadline' | 'dept' | 'progress'>('priority');
  groupByDepartment = signal<boolean>(false);

  // Approval comments map (keyed by plan.id)
  approvalComments: Record<string, string> = {};

  ngOnInit() {
    if (!this.canAccessVerification()) {
      this.snackBar.open('Access Denied: You do not have permission to access Work Plan Verification.', 'Dismiss', { duration: 3500 });
      this.router.navigate(['/work-plans/tasks']);
      return;
    }

    // If user is a Department Head (and not Super Admin), scope default department filter to their department
    if (this.rbacService.isDepartmentHead() && !this.rbacService.isSuperAdmin()) {
      const userDept = this.rbacService.userDepartment();
      if (userDept) {
        this.selectedDepartment.set(userDept);
      }
    }

    this.workPlanService.getWorkPlans().subscribe(plans => {
      this.workPlans.set(plans);
    });

    this.settingsService.getDepartments().subscribe(depts => {
      if (depts) this.departments.set(depts);
    });
  }

  // Raw Review Plans (Queue)
  reviewPlans = computed(() =>
    this.workPlans().filter(p => p.status === 'Under Review')
  );

  // Verified Plans
  verifiedPlans = computed(() =>
    this.workPlans().filter(p => p.status === 'Completed')
  );

  // Priority Counters
  urgentReviewCount = computed(() => this.reviewPlans().filter(p => p.priority === 'Urgent').length);
  highReviewCount = computed(() => this.reviewPlans().filter(p => p.priority === 'High').length);
  mediumReviewCount = computed(() => this.reviewPlans().filter(p => p.priority === 'Medium').length);
  lowReviewCount = computed(() => this.reviewPlans().filter(p => p.priority === 'Low').length);

  // Compliance Rate KPI
  complianceRate = computed(() => {
    const total = this.workPlans().length;
    if (total === 0) return 0;
    return Math.round((this.verifiedPlans().length / total) * 100);
  });

  // Department Filter Options with counts
  departmentOptions = computed(() => {
    const counts = new Map<string, number>();
    
    // Add known departments from settings
    this.departments().forEach(d => {
      if (d.name) counts.set(d.name, 0);
    });

    // Count pending plans under review per department
    for (const plan of this.reviewPlans()) {
      const deptName = getPlanDepartment(plan);
      counts.set(deptName, (counts.get(deptName) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  // Filtered & Prioritized Review Plans
  filteredReviewPlans = computed(() => {
    let list = this.reviewPlans();

    // 1. Department Filter
    const dept = this.selectedDepartment();
    if (dept !== 'ALL') {
      list = list.filter(p => getPlanDepartment(p) === dept);
    }

    // 2. Priority Filter
    const prio = this.selectedPriority();
    if (prio !== 'ALL') {
      list = list.filter(p => p.priority === prio);
    }

    // 3. Search Query Filter
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.leadName && p.leadName.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q)) ||
        (p.division && p.division.toLowerCase().includes(q)) ||
        (p.milestones && p.milestones.some(m => m.title.toLowerCase().includes(q)))
      );
    }

    // 4. Intelligent Sorting (Priority hierarchy as default)
    const sortMode = this.sortBy();
    return [...list].sort((a, b) => {
      if (sortMode === 'priority') {
        const weightA = PRIORITY_WEIGHTS[a.priority] || 0;
        const weightB = PRIORITY_WEIGHTS[b.priority] || 0;
        if (weightB !== weightA) return weightB - weightA; // Urgent first (4 > 3 > 2 > 1)
        // Secondary: earliest deadline first
        return (a.targetDate || '').localeCompare(b.targetDate || '');
      } else if (sortMode === 'deadline') {
        return (a.targetDate || '').localeCompare(b.targetDate || '');
      } else if (sortMode === 'dept') {
        const deptA = getPlanDepartment(a);
        const deptB = getPlanDepartment(b);
        const deptCmp = deptA.localeCompare(deptB);
        if (deptCmp !== 0) return deptCmp;
        return (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
      } else if (sortMode === 'progress') {
        return (b.progress || 0) - (a.progress || 0);
      }
      return 0;
    });
  });

  // Grouped by Department Plans
  groupedByDepartmentPlans = computed(() => {
    const map = new Map<string, WorkPlan[]>();
    for (const plan of this.filteredReviewPlans()) {
      const dept = getPlanDepartment(plan);
      if (!map.has(dept)) {
        map.set(dept, []);
      }
      map.get(dept)!.push(plan);
    }
    return Array.from(map.entries()).map(([department, plans]) => ({
      department,
      plans
    }));
  });

  // Department name resolver
  getDepartmentName(plan: WorkPlan): string {
    return getPlanDepartment(plan);
  }

  // Milestone helpers
  getCompletedMilestonesCount(plan: WorkPlan): number {
    return (plan.milestones || []).filter(m => m.completed).length;
  }

  areAllMilestonesComplete(plan: WorkPlan): boolean {
    if (!plan.milestones || plan.milestones.length === 0) return false;
    return plan.milestones.every(m => m.completed);
  }

  isOverdue(targetDate?: string): boolean {
    if (!targetDate) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return targetDate < todayStr;
  }

  // Multi-Select Batch Actions
  isSelected(id?: string): boolean {
    return id ? this.selectedPlanIds().has(id) : false;
  }

  toggleSelection(id?: string) {
    if (!id) return;
    const set = new Set(this.selectedPlanIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedPlanIds.set(set);
  }

  isAllSelected = computed(() => {
    const list = this.filteredReviewPlans();
    if (list.length === 0) return false;
    return list.every(p => p.id && this.selectedPlanIds().has(p.id));
  });

  isPartiallySelected = computed(() => {
    const list = this.filteredReviewPlans();
    const selectedCount = list.filter(p => p.id && this.selectedPlanIds().has(p.id)).length;
    return selectedCount > 0 && selectedCount < list.length;
  });

  toggleSelectAll() {
    const list = this.filteredReviewPlans();
    if (this.isAllSelected()) {
      this.selectedPlanIds.set(new Set());
    } else {
      const set = new Set<string>();
      list.forEach(p => { if (p.id) set.add(p.id); });
      this.selectedPlanIds.set(set);
    }
  }

  clearSelection() {
    this.selectedPlanIds.set(new Set());
  }

  resetFilters() {
    this.searchQuery.set('');
    this.selectedDepartment.set('ALL');
    this.selectedPriority.set('ALL');
  }

  // Verifier Stage Helpers
  getPlanVerifiersList(plan: WorkPlan): WorkPlanVerifier[] {
    return this.workPlanService.getPlanVerifiers(plan);
  }

  getApprovedVerifiersCount(plan: WorkPlan): number {
    return this.workPlanService.getCompletedVerifiersCount(plan);
  }

  areAllPlanVerifiersApproved(plan: WorkPlan): boolean {
    return this.workPlanService.areAllVerifiersApproved(plan);
  }

  getNextStageNumber(plan: WorkPlan): number {
    const pending = this.workPlanService.getNextPendingVerifier(plan);
    return pending ? pending.order : 1;
  }

  isAssignedToCurrentUser(verifier: WorkPlanVerifier): boolean {
    const user = this.authService.currentUser();
    return this.workPlanService.isUserAssignedToVerifier(
      verifier,
      user?.email,
      user?.displayName || (user as any)?.name,
      user?.uid
    );
  }

  isStageNext(plan: WorkPlan, verifier: WorkPlanVerifier): boolean {
    const nextPending = this.workPlanService.getNextPendingVerifier(plan);
    return nextPending?.id === verifier.id;
  }

  canUserApproveNextStage(plan: WorkPlan): boolean {
    if (!this.canAccessVerification()) return false;
    const user = this.authService.currentUser();
    return this.workPlanService.canUserApproveNextStage(
      plan,
      user?.email,
      user?.displayName || (user as any)?.name,
      user?.uid
    );
  }

  getApproveButtonLabel(plan: WorkPlan): string {
    if (this.areAllPlanVerifiersApproved(plan)) {
      return 'All Stages Approved';
    }
    const pending = this.workPlanService.getNextPendingVerifier(plan);
    if (!pending) return 'All Stages Approved';

    if (this.canUserApproveNextStage(plan)) {
      return `Approve Stage ${pending.order}`;
    }
    return `Stage ${pending.order}: ${pending.name || 'Assigned Officer'}`;
  }

  getApproveButtonTooltip(plan: WorkPlan): string {
    if (this.areAllPlanVerifiersApproved(plan)) {
      return 'All verification stages have been approved';
    }
    const pending = this.workPlanService.getNextPendingVerifier(plan);
    if (!pending) return 'All stages approved';

    if (this.canUserApproveNextStage(plan)) {
      return `It is your turn to sign off Stage ${pending.order} (${pending.name || 'Your Assignment'})`;
    }
    const officerInfo = pending.name ? `${pending.name}${pending.email ? ' (' + pending.email + ')' : ''}` : 'another officer';
    return `Locked: Stage ${pending.order} is assigned to ${officerInfo}. Only this officer can approve this stage.`;
  }

  getApproveButtonIcon(plan: WorkPlan): string {
    if (this.areAllPlanVerifiersApproved(plan)) {
      return 'verified';
    }
    if (this.canUserApproveNextStage(plan)) {
      return 'check_circle';
    }
    return 'lock';
  }

  reassignNextStage(plan: WorkPlan) {
    const nextStage = this.workPlanService.getNextPendingVerifier(plan);
    if (!nextStage) return;

    this.dialog.open(WorkPlanReassignDialogComponent, {
      width: '540px',
      data: {
        plan,
        stage: nextStage
      }
    });
  }

  // Single Action: 1-Click Approve (Stage-aware & Officer-assigned)
  async approvePlan(plan: WorkPlan) {
    if (!this.canAccessVerification()) {
      this.snackBar.open('Verification and sign-off authority is restricted to authorized roles', 'Dismiss', { duration: 3000 });
      return;
    }
    if (!plan.id) return;

    const currentUser = this.authService.currentUser();
    const verifiers = this.workPlanService.getPlanVerifiers(plan);
    const nextVerifier = this.workPlanService.getNextPendingVerifier(plan);

    if (!nextVerifier) {
      this.snackBar.open('All verification stages have already been completed for this directive.', 'Dismiss', { duration: 3000 });
      return;
    }

    // Strict assigned officer enforcement
    if (!this.workPlanService.canUserApproveStage(plan, nextVerifier, currentUser?.email, currentUser?.displayName || (currentUser as any)?.name, currentUser?.uid)) {
      const officerName = nextVerifier.name || 'another designated officer';
      this.snackBar.open(`Access Denied: Stage ${nextVerifier.order} is assigned to ${officerName}. Only this officer can sign off.`, 'Dismiss', { duration: 4500 });
      return;
    }

    try {
      const verifierEmail = currentUser?.email || nextVerifier.email || 'verifier@system.gov.lk';
      const enteredComment = plan.id ? (this.approvalComments[plan.id]?.trim() || '') : '';

      const updatedVerifiers: WorkPlanVerifier[] = verifiers.map(v => {
        if (v.id === nextVerifier.id) {
          return {
            ...v,
            verified: true,
            verifiedAt: new Date().toISOString(),
            verifiedByEmail: verifierEmail,
            reviewComment: enteredComment || v.reviewComment || ('Verified & approved Stage ' + nextVerifier.order + ' via Verification Hub')
          };
        }
        return v;
      });

      if (plan.id) {
        delete this.approvalComments[plan.id];
      }

      const allApproved = updatedVerifiers.every(v => v.verified);
      const updatedMilestones = allApproved && plan.milestones && plan.milestones.length > 0
        ? plan.milestones.map(m => ({ ...m, completed: true }))
        : plan.milestones;

      const updates: Partial<WorkPlan> = {
        verifiers: updatedVerifiers,
        ...(allApproved ? {
          status: 'Completed',
          progress: 100,
          ...(updatedMilestones ? { milestones: updatedMilestones } : {})
        } : {
          status: 'Under Review'
        })
      };

      await this.workPlanService.updateWorkPlan(plan.id, updates);

      if (allApproved) {
        this.eventLogService.logAction('UPDATED', 'WorkPlans', `All verification stages signed off for "${plan.title}" (${getPlanDepartment(plan)}) - Marked Completed`);
        this.snackBar.open(`All verification stages approved. Directive "${plan.title}" marked Completed!`, 'Dismiss', { duration: 3500 });
        if (this.selectedPlanIds().has(plan.id)) {
          const next = new Set(this.selectedPlanIds());
          next.delete(plan.id);
          this.selectedPlanIds.set(next);
        }
      } else {
        const approvedCount = updatedVerifiers.filter(v => v.verified).length;
        this.eventLogService.logAction('UPDATED', 'WorkPlans', `Signed off Stage ${nextVerifier.order} for "${plan.title}"`);
        this.snackBar.open(`Stage ${nextVerifier.order} signed off (${approvedCount}/${updatedVerifiers.length} stages approved). Next stage unlocked.`, 'Dismiss', { duration: 3500 });
      }
    } catch {
      this.snackBar.open('Saved to local offline queue', 'Dismiss', { duration: 3000 });
    }
  }

  canResetStageApproval(plan: WorkPlan, stage: WorkPlanVerifier): boolean {
    if (!stage.verified) return false;
    const currentUser = this.authService.currentUser();
    const uEmail = (currentUser?.email || '').toLowerCase().trim();
    const uName = (currentUser?.displayName || (currentUser as any)?.name || '').toLowerCase().trim();
    const uUid = currentUser?.uid;

    if (this.rbacService.isSuperAdmin() || this.rbacService.isAdmin()) return true;
    if (this.canAccessVerification()) return true;
    if (isUserAssignedToVerifier(stage, uEmail, uName, uUid)) return true;
    if (stage.verifiedByEmail && uEmail && stage.verifiedByEmail.toLowerCase().trim() === uEmail) return true;
    return false;
  }

  canResetPlanApproval(plan: WorkPlan): boolean {
    if (this.getApprovedVerifiersCount(plan) === 0) return false;
    if (this.rbacService.isSuperAdmin() || this.rbacService.isAdmin()) return true;
    if (this.canAccessVerification()) return true;
    const currentUser = this.authService.currentUser();
    const uEmail = (currentUser?.email || '').toLowerCase().trim();
    const uName = (currentUser?.displayName || (currentUser as any)?.name || '').toLowerCase().trim();
    const uUid = currentUser?.uid;
    const verifiers = this.getPlanVerifiersList(plan);
    return verifiers.some(v => v.verified && (
      isUserAssignedToVerifier(v, uEmail, uName, uUid) ||
      (v.verifiedByEmail && v.verifiedByEmail.toLowerCase().trim() === uEmail)
    ));
  }

  async resetStageApproval(plan: WorkPlan, stage: WorkPlanVerifier) {
    if (!plan.id) return;
    if (!this.canResetStageApproval(plan, stage)) {
      this.snackBar.open('You do not have permission to reset this verification stage approval', 'Dismiss', { duration: 3500 });
      return;
    }

    if (!confirm(`Are you sure you want to reset approval for Stage ${stage.order} (${stage.name}) on "${plan.title}"? This will return this verification stage back to pending.`)) {
      return;
    }

    try {
      const currentVerifiers = this.getPlanVerifiersList(plan);
      const updatedVerifiers = resetStageVerification(currentVerifiers, stage.order);
      const newStatus: WorkPlan['status'] = plan.status === 'Completed' ? 'Under Review' : plan.status;
      const currentUser = this.authService.currentUser();
      const rollbackNotes = `Stage ${stage.order} approval was reset by ${currentUser?.displayName || currentUser?.email || 'verification officer'}`;

      await this.workPlanService.updateWorkPlan(plan.id, {
        verifiers: updatedVerifiers,
        status: newStatus,
        revisionNotes: rollbackNotes,
        rollbackAt: new Date().toISOString(),
        ...(plan.progress === 100 ? { progress: 95 } : {})
      });

      this.eventLogService.logAction('UPDATED', 'WorkPlans', `Reset Stage ${stage.order} approval for "${plan.title}"`);
      this.snackBar.open(`Stage ${stage.order} approval reset to pending successfully.`, 'Dismiss', { duration: 3500 });
    } catch {
      this.snackBar.open('Saved to local offline queue', 'Dismiss', { duration: 3000 });
    }
  }

  async resetPlanApproval(plan: WorkPlan) {
    if (!plan.id) return;
    if (!this.canResetPlanApproval(plan)) {
      this.snackBar.open('You do not have permission to reset verification approvals', 'Dismiss', { duration: 3500 });
      return;
    }

    const approvedStages = (this.getPlanVerifiersList(plan) || []).filter(v => v.verified);
    if (approvedStages.length === 0) return;

    const latestApproved = approvedStages.sort((a, b) => b.order - a.order)[0];

    if (!confirm(`Reset approval for Stage ${latestApproved.order} (${latestApproved.name}) on "${plan.title}"?`)) {
      return;
    }

    await this.resetStageApproval(plan, latestApproved);
  }

  // Single Action: Request Revisions (Rollback directive and reset all verifier approvals)
  async requestRevision(plan: WorkPlan) {
    if (!this.canAccessVerification()) {
      this.snackBar.open('Verification and sign-off authority is restricted to authorized roles', 'Dismiss', { duration: 3000 });
      return;
    }
    if (!plan.id) return;

    const dialogRef = this.dialog.open(WorkPlanRevisionDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { plan }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result?.confirmed || !plan.id) return;

      try {
        await this.workPlanService.rollbackWorkPlan(plan.id, result.reason, plan);
        this.eventLogService.logAction(
          'UPDATED',
          'WorkPlans',
          `Rolled back directive "${plan.title}" for revisions. Reset all verification approvals.${result.reason ? ' Notes: ' + result.reason : ''}`
        );
        this.snackBar.open(
          `Directive returned to In Progress for revision. All verification approvals have been reset.`,
          'Dismiss',
          { duration: 4000 }
        );
        if (this.selectedPlanIds().has(plan.id)) {
          const next = new Set(this.selectedPlanIds());
          next.delete(plan.id);
          this.selectedPlanIds.set(next);
        }
      } catch {
        this.snackBar.open('Saved to local offline queue', 'Dismiss', { duration: 3000 });
      }
    });
  }

  // Batch Action: Approve Selected Plans (Approves assigned stage for selected directives)
  async approveSelectedPlans() {
    if (!this.canAccessVerification()) {
      this.snackBar.open('Verification and sign-off authority is restricted to authorized roles', 'Dismiss', { duration: 3000 });
      return;
    }
    const ids = Array.from(this.selectedPlanIds());
    if (ids.length === 0) return;

    try {
      const currentUser = this.authService.currentUser();
      const verifierEmail = currentUser?.email || 'verifier@system.gov.lk';
      let approvedCount = 0;
      let skippedCount = 0;

      for (const id of ids) {
        const plan = this.workPlans().find(p => p.id === id);
        if (!plan) continue;

        const nextVerifier = this.workPlanService.getNextPendingVerifier(plan);
        if (!nextVerifier) {
          skippedCount++;
          continue;
        }

        // Check if current user is assigned to sign off nextVerifier
        if (!this.workPlanService.canUserApproveStage(plan, nextVerifier, currentUser?.email, currentUser?.displayName || (currentUser as any)?.name, currentUser?.uid)) {
          skippedCount++;
          continue;
        }

        const enteredComment = plan.id ? (this.approvalComments[plan.id]?.trim() || '') : '';
        const verifiers = this.workPlanService.getPlanVerifiers(plan).map(v => {
          if (v.id === nextVerifier.id) {
            return {
              ...v,
              verified: true,
              verifiedAt: new Date().toISOString(),
              verifiedByEmail: verifierEmail,
              reviewComment: enteredComment || v.reviewComment || 'Batch approved via Verification Hub'
            };
          }
          return v;
        });

        if (plan.id) {
          delete this.approvalComments[plan.id];
        }

        const allApproved = verifiers.every(v => v.verified);
        const updatedMilestones = allApproved && plan.milestones && plan.milestones.length > 0
          ? plan.milestones.map(m => ({ ...m, completed: true }))
          : plan.milestones;

        await this.workPlanService.updateWorkPlan(id, {
          status: allApproved ? 'Completed' : 'Under Review',
          ...(allApproved ? { progress: 100 } : {}),
          verifiers,
          ...(updatedMilestones ? { milestones: updatedMilestones } : {})
        });
        approvedCount++;
        this.eventLogService.logAction('UPDATED', 'WorkPlans', `Batch audit sign-off Stage ${nextVerifier.order} for directive "${plan.title}"`);
      }

      if (approvedCount > 0 && skippedCount === 0) {
        this.snackBar.open(`Successfully signed off assigned stages for ${approvedCount} selected directives`, 'Dismiss', { duration: 4000 });
      } else if (approvedCount > 0 && skippedCount > 0) {
        this.snackBar.open(`Signed off ${approvedCount} directives. Skipped ${skippedCount} directives (assigned to other officers or completed).`, 'Dismiss', { duration: 5000 });
      } else {
        this.snackBar.open(`None of the selected directives are currently assigned to you for sign-off (${skippedCount} skipped).`, 'Dismiss', { duration: 4000 });
      }

      this.selectedPlanIds.set(new Set());
    } catch {
      this.snackBar.open('Saved batch changes to local queue', 'Dismiss', { duration: 3000 });
    }
  }

  // Batch Action: Request Revisions on Selected Plans (Rolls back and resets all verification approvals)
  async requestRevisionSelectedPlans() {
    if (!this.canAccessVerification()) {
      this.snackBar.open('Verification and sign-off authority is restricted to authorized roles', 'Dismiss', { duration: 3000 });
      return;
    }
    const ids = Array.from(this.selectedPlanIds());
    if (ids.length === 0) return;

    try {
      for (const id of ids) {
        const plan = this.workPlans().find(p => p.id === id);
        await this.workPlanService.rollbackWorkPlan(id, 'Batch rolled back for revisions via Verification Hub', plan);
        this.eventLogService.logAction('UPDATED', 'WorkPlans', `Batch rolled back directive ID ${id} - Reset all verification approvals`);
      }
      this.snackBar.open(`Revisions requested for ${ids.length} directives. All verification approvals have been reset to In Progress.`, 'Dismiss', { duration: 4000 });
      this.selectedPlanIds.set(new Set());
    } catch {
      this.snackBar.open('Saved batch changes to local queue', 'Dismiss', { duration: 3000 });
    }
  }

  // Fast Department Verification: Approve all plans for a department (assigned stages only)
  async approveDepartmentPlans(deptName: string, plans: WorkPlan[]) {
    if (!this.canAccessVerification()) {
      this.snackBar.open('Verification authority restricted to authorized roles', 'Dismiss', { duration: 3000 });
      return;
    }
    if (!plans || plans.length === 0) return;

    try {
      const currentUser = this.authService.currentUser();
      const verifierEmail = currentUser?.email || 'verifier@system.gov.lk';
      let approvedCount = 0;
      let skippedCount = 0;

      for (const p of plans) {
        if (!p.id) continue;

        const nextVerifier = this.workPlanService.getNextPendingVerifier(p);
        if (!nextVerifier) {
          skippedCount++;
          continue;
        }

        if (!this.workPlanService.canUserApproveStage(p, nextVerifier, currentUser?.email, currentUser?.displayName || (currentUser as any)?.name, currentUser?.uid)) {
          skippedCount++;
          continue;
        }

        const verifiers = this.workPlanService.getPlanVerifiers(p).map(v => {
          if (v.id === nextVerifier.id) {
            return {
              ...v,
              verified: true,
              verifiedAt: new Date().toISOString(),
              verifiedByEmail: verifierEmail,
              reviewComment: v.reviewComment || `Department batch approved for ${deptName}`
            };
          }
          return v;
        });

        const allApproved = verifiers.every(v => v.verified);
        const updatedMilestones = allApproved && p.milestones && p.milestones.length > 0
          ? p.milestones.map(m => ({ ...m, completed: true }))
          : p.milestones;

        await this.workPlanService.updateWorkPlan(p.id, {
          status: allApproved ? 'Completed' : 'Under Review',
          ...(allApproved ? { progress: 100 } : {}),
          verifiers,
          ...(updatedMilestones ? { milestones: updatedMilestones } : {})
        });
        approvedCount++;
        this.eventLogService.logAction('UPDATED', 'WorkPlans', `Department batch approved Stage ${nextVerifier.order} for "${p.title}" (${deptName})`);
      }

      if (approvedCount > 0 && skippedCount === 0) {
        this.snackBar.open(`All ${approvedCount} deliverables in "${deptName}" verified & approved!`, 'Dismiss', { duration: 4000 });
      } else if (approvedCount > 0 && skippedCount > 0) {
        this.snackBar.open(`Approved ${approvedCount} deliverables in "${deptName}". Skipped ${skippedCount} assigned to other officers.`, 'Dismiss', { duration: 5000 });
      } else {
        this.snackBar.open(`None of the deliverables in "${deptName}" are currently assigned to you for verification (${skippedCount} skipped).`, 'Dismiss', { duration: 4000 });
      }

      this.selectedPlanIds.set(new Set());
    } catch {
      this.snackBar.open('Saved to local offline queue', 'Dismiss', { duration: 3000 });
    }
  }

  // Inspect Modal
  openDetail(plan: WorkPlan) {
    this.dialog.open(WorkPlanDetailDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { plan }
    });
  }
}
