import { Component, Inject, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkPlan, WorkPlanService, WorkPlanMilestone, WorkPlanVerifier, resetPlanVerifiers, isUserAssignedToVerifier, isWorkPlanOwner } from '../../services/work-plan.service';
import { WorkPlanRevisionDialogComponent } from '../work-plan-revision-dialog/work-plan-revision-dialog.component';
import { WorkPlanReassignDialogComponent } from '../work-plan-reassign-dialog/work-plan-reassign-dialog.component';
import { RbacService } from '../../../../auth/rbac.service';
import { AuthService } from '../../../../auth/auth.service';

@Component({
  selector: 'app-work-plan-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatDividerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    WorkPlanReassignDialogComponent
  ],
  template: `
    <div class="detail-header">
      <div class="header-left">
        <div class="pill-row">
          <span class="status-pill" [ngClass]="{
            'coral': currentPlan().priority === 'Urgent',
            'amber': currentPlan().priority === 'High',
            'indigo': currentPlan().priority === 'Medium',
            'slate': currentPlan().priority === 'Low'
          }">{{ currentPlan().priority }} Priority</span>
          <span class="category-pill">{{ currentPlan().category }}</span>
          <span class="division-pill">{{ currentPlan().division }}</span>
          <span class="dept-pill" *ngIf="currentPlan().department">
            <mat-icon class="dept-pill-icon">corporate_fare</mat-icon>
            {{ currentPlan().department }}
          </span>
        </div>
        <h2 mat-dialog-title class="plan-title">{{ currentPlan().title }}</h2>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content class="detail-body">
      
      <!-- Rollback Revision Guidance Alert -->
      <div class="dialog-revision-banner" *ngIf="currentPlan().revisionNotes">
        <mat-icon class="rev-icon">replay</mat-icon>
        <div class="rev-text">
          <strong>Directive Returned for Revision</strong>
          <p>{{ currentPlan().revisionNotes }}</p>
          <span class="rev-author" *ngIf="currentPlan().rollbackByEmail">Requested by {{ currentPlan().rollbackByEmail }}</span>
        </div>
      </div>

      <!-- Progress Bar & Status Row -->
      <div class="status-action-box">
        <div class="progress-section">
          <div class="progress-labels">
            <span class="progress-title">Overall Execution Progress</span>
            <span class="progress-pct">{{ currentPlan().progress }}%</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="currentPlan().progress" class="modern-progress"></mat-progress-bar>
        </div>

        <div class="status-dropdown-wrap">
          <label>Update Status</label>
          <mat-select [(ngModel)]="currentPlan().status" (selectionChange)="onStatusChange($event.value)" class="status-select" [disabled]="!canChangeStatus()">
            <mat-option value="Draft">Draft & Planning</mat-option>
            <mat-option value="In Progress">In Progress</mat-option>
            <mat-option value="Under Review">Under Review (Pending Verification)</mat-option>
            <mat-option value="Completed" *ngIf="canAccessVerification() || currentPlan().status === 'Completed'">Completed (Audit Approved)</mat-option>
            <mat-option value="Delayed">Delayed / Blocked</mat-option>
          </mat-select>
        </div>
      </div>

      <!-- Description Brief -->
      <div class="meta-section">
        <h3>Operational Directive Scope</h3>
        <p class="desc-text">{{ currentPlan().description }}</p>
      </div>

      <!-- Details Grid -->
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Task Owner (Performer)</span>
          <div class="lead-val">
            <div class="lead-avatar">{{ getInitials(currentPlan().ownerName || currentPlan().leadName) }}</div>
            <div>
              <strong>{{ currentPlan().ownerName || currentPlan().createdByName || currentPlan().leadName }}</strong>
              <small *ngIf="currentPlan().ownerEmail || currentPlan().createdByEmail">{{ currentPlan().ownerEmail || currentPlan().createdByEmail }}</small>
            </div>
          </div>
        </div>

        <div class="meta-item">
          <span class="meta-label">Regional Lead (Verification Officer)</span>
          <div class="lead-val">
            <div class="lead-avatar">{{ getInitials(currentPlan().leadName) }}</div>
            <div>
              <strong>{{ currentPlan().leadName }}</strong>
              <small *ngIf="currentPlan().leadEmail">{{ currentPlan().leadEmail }}</small>
            </div>
          </div>
        </div>

        <div class="meta-item">
          <span class="meta-label">Allocated Budget</span>
          <span class="budget-val">{{ currentPlan().budget ? 'LKR ' + (currentPlan().budget | number) : 'Not allocated' }}</span>
        </div>

        <div class="meta-item">
          <span class="meta-label">Timeline Schedule</span>
          <div class="date-range">
            <mat-icon class="date-icon">event</mat-icon>
            <span>{{ currentPlan().startDate }} &rarr; {{ currentPlan().targetDate }}</span>
          </div>
        </div>

        <div class="meta-item">
          <span class="meta-label">Last Synchronized</span>
          <span class="meta-val">{{ currentPlan().updatedAt | date:'medium' }}</span>
        </div>
      </div>

      <mat-divider class="my-4"></mat-divider>

      <!-- Interactive Milestones Checklist -->
      <div class="milestones-box">
        <div class="milestone-title-row">
          <h3>Deliverable Milestones ({{ completedMilestonesCount() }} / {{ currentPlan().milestones.length }})</h3>
          <span class="milestone-hint" *ngIf="completedMilestonesCount() < currentPlan().milestones.length">
            Check items to update overall completion progress
          </span>
          <span class="milestone-hint verified-hint" *ngIf="completedMilestonesCount() === currentPlan().milestones.length && currentPlan().milestones.length > 0">
            <mat-icon class="hint-icon">verified</mat-icon> Milestones 100% complete &mdash; Routed to Regional Lead for verification
          </span>
        </div>

        <!-- Verification Notice Banner when all milestones completed / Under Review -->
        <div class="milestones-verification-banner" *ngIf="currentPlan().status === 'Under Review'">
          <mat-icon class="banner-icon">shield</mat-icon>
          <div class="banner-text">
            <strong>Deliverables In Multi-Officer Verification Pipeline</strong>
            <span>All deliverable milestones are completed. This directive requires sign-off across all {{ planVerifiers().length }} stage(s) before completion.</span>
          </div>
        </div>

        <div class="milestone-list" *ngIf="currentPlan().milestones.length > 0; else noMilestones">
          <div class="milestone-card" *ngFor="let m of currentPlan().milestones; let i = index" 
               [class.completed]="m.completed" (click)="toggleMilestone(i)">
            <mat-icon class="check-icon">{{ m.completed ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <span class="milestone-label">{{ m.title }}</span>
            <span class="badge-status">{{ m.completed ? 'Done' : 'Pending' }}</span>
          </div>
        </div>

        <ng-template #noMilestones>
          <div class="empty-milestones">No specific milestones defined for this work plan.</div>
        </ng-template>
      </div>

      <mat-divider class="my-4"></mat-divider>

      <!-- Multi-Officer Verification Pipeline & Comments -->
      <div class="verification-pipeline-card">
        <div class="pipeline-header">
          <div class="header-left">
            <div class="pipeline-icon-box">
              <mat-icon>how_to_reg</mat-icon>
            </div>
            <div class="pipeline-title-wrap">
              <h3>Verification & Audit Sign-Off Pipeline</h3>
              <p>Each stage officer must review deliverables, submit audit remarks, and sign off before completion.</p>
            </div>
          </div>
          <div class="pipeline-progress-badge" [class.all-done]="areAllSignedOff()">
            <mat-icon class="badge-icon">{{ areAllSignedOff() ? 'verified' : 'pending_actions' }}</mat-icon>
            <span>{{ signedOffCount() }} / {{ planVerifiers().length }} Signed Off</span>
          </div>
        </div>

        <div class="pipeline-stages">
          <div class="pipeline-stage-item" *ngFor="let stage of planVerifiers(); let i = index"
               [class.approved]="stage.verified"
               [class.active]="!stage.verified && isNextInLine(stage)">
            <div class="stage-left-rail">
              <div class="stage-node-circle" [class.done]="stage.verified" [class.current]="!stage.verified && isNextInLine(stage)">
                <mat-icon>{{ stage.verified ? 'check' : (i + 1) }}</mat-icon>
              </div>
              <div class="stage-line" *ngIf="i < planVerifiers().length - 1"></div>
            </div>

            <div class="stage-content-box">
              <div class="stage-top-bar">
                <div class="stage-info">
                  <span class="stage-badge" [class.approved]="stage.verified">Stage {{ stage.order }}</span>
                  <span class="stage-officer-name">{{ stage.name }}</span>
                  <span class="stage-officer-email" *ngIf="stage.email">({{ stage.email }})</span>
                  <span class="stage-dept-pill" *ngIf="stage.department">{{ stage.department }}</span>
                </div>
                <span class="stage-status-tag" [class.approved]="stage.verified">
                  <mat-icon class="tag-icon">{{ stage.verified ? 'verified' : (isNextInLine(stage) ? 'pending' : 'lock_clock') }}</mat-icon>
                  {{ stage.verified ? 'Signed Off' : (isNextInLine(stage) ? 'Pending Sign-Off' : 'Queued') }}
                </span>
              </div>

              <!-- Signed Off Metadata & Review Comment -->
              <div class="stage-audit-details" *ngIf="stage.verified">
                <div class="audit-meta-line">
                  <span class="audit-date">Approved: {{ stage.verifiedAt | date:'medium' }}</span>
                  <span class="audit-by" *ngIf="stage.verifiedByEmail">&bull; by {{ stage.verifiedByEmail }}</span>
                </div>
                <div class="review-quote" *ngIf="stage.reviewComment">
                  <mat-icon class="quote-icon">rate_review</mat-icon>
                  <p class="quote-text">"{{ stage.reviewComment }}"</p>
                </div>
                <!-- Reset Approval Button for verified stage -->
                <div class="stage-reset-action-row" *ngIf="canResetStageApproval(stage)">
                  <button mat-stroked-button class="stage-reset-btn" (click)="resetStageApproval(stage)" matTooltip="Reset and revoke approval for Stage {{ stage.order }}">
                    <mat-icon>restart_alt</mat-icon> Reset Approval
                  </button>
                </div>
              </div>

              <!-- Pending Sign-off Box with Review Comment -->
              <div class="stage-signoff-action" *ngIf="!stage.verified && isNextInLine(stage) && canSignOffStage(stage)">
                <div class="signoff-prompt-header">
                  <mat-icon class="prompt-icon">edit_note</mat-icon>
                  <span>Submit Audit Review & Sign Off Stage {{ stage.order }} ({{ stage.name }})</span>
                </div>
                <div class="comment-input-wrap">
                  <textarea [(ngModel)]="currentStageComment" 
                            placeholder="Add your review comments, verification findings, or audit approval remarks..." 
                            rows="2" 
                            class="stage-comment-textarea"></textarea>
                </div>
                <div class="signoff-action-row">
                  <button mat-flat-button class="stage-signoff-btn" (click)="signOffStage(stage)">
                    <mat-icon>verified</mat-icon> Approve & Sign Off Stage {{ stage.order }}
                  </button>
                </div>
              </div>

              <!-- Locked Notice when assigned to another officer -->
              <div class="stage-locked-box" *ngIf="!stage.verified && isNextInLine(stage) && !canSignOffStage(stage)">
                <div class="stage-locked-row">
                  <mat-icon class="locked-icon">lock</mat-icon>
                  <div class="locked-text-wrap">
                    <strong>Awaiting Stage {{ stage.order }} Officer Sign-Off</strong>
                    <p class="locked-desc">Assigned to <strong>{{ stage.name }}</strong><span *ngIf="stage.email"> ({{ stage.email }})</span>. Only the assigned officer can approve this stage.</p>
                  </div>
                  <button mat-stroked-button 
                          class="stage-reassign-btn" 
                          *ngIf="canReassignOfficer()" 
                          (click)="openReassign(stage)" 
                          matTooltip="Administrative override: Reassign absent, transferred, or unavailable officer">
                    <mat-icon>manage_accounts</mat-icon> Reassign Officer
                  </button>
                </div>
              </div>

              <!-- Queued Notice when previous stage is not yet completed -->
              <div class="stage-queued-box" *ngIf="!stage.verified && !isNextInLine(stage)">
                <mat-icon class="queued-icon">lock_clock</mat-icon>
                <span>Stage {{ stage.order }} is queued. Prior verification stages must be signed off first.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </mat-dialog-content>

    <mat-dialog-actions align="end" class="detail-footer">
      <button mat-stroked-button *ngIf="canEditAndAssign()" (click)="openEdit()">
        <mat-icon>edit</mat-icon> Edit Full Plan
      </button>
      <div class="footer-right-actions">
        <button mat-stroked-button class="dialog-rollback-btn"
                *ngIf="canAccessVerification() && currentPlan().status === 'Under Review'"
                (click)="requestRevision()">
          <mat-icon>replay</mat-icon> Rollback for Revision
        </button>
        <button mat-flat-button class="verify-signoff-btn" 
                *ngIf="canSignOffNextStage() && currentPlan().status === 'Under Review' && !areAllSignedOff()"
                (click)="quickSignOffNextStage()">
          <mat-icon>verified</mat-icon> Sign Off Stage {{ getNextStageOrder() }} (Assigned to You)
        </button>
        <button mat-flat-button color="primary" mat-dialog-close>
          Done
        </button>
      </div>
    </mat-dialog-actions>
  `,
  styles: [`
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 22px 24px 14px 24px;
      border-bottom: 1px solid var(--border-subtle);
      background-color: #fafbfc;

      .pill-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 6px;

        .category-pill {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          background-color: #ffffff;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--border-subtle);
        }

        .division-pill {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
        }

        .dept-pill {
          font-size: 11px;
          font-weight: 600;
          color: var(--brand-indigo);
          background-color: var(--brand-tint);
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          display: inline-flex;
          align-items: center;
          gap: 4px;

          .dept-pill-icon {
            font-size: 13px;
            width: 13px;
            height: 13px;
          }
        }
      }

      .plan-title {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        line-height: 1.3;
      }

      .close-btn {
        color: var(--text-subtle);
      }
    }

    .detail-body {
      max-height: 72vh;
      overflow-y: auto;
      padding: 20px 24px !important;
      display: flex;
      flex-direction: column;
      gap: 20px;

      .dialog-revision-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 8px;
        padding: 10px 14px;
        color: #92400e;

        .rev-icon {
          color: #d97706;
          font-size: 20px;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .rev-text {
          strong {
            display: block;
            font-size: 13px;
            color: #78350f;
            margin-bottom: 2px;
          }
          p {
            margin: 0;
            font-size: 12.5px;
            line-height: 1.45;
            color: #92400e;
          }
          .rev-author {
            display: block;
            margin-top: 4px;
            font-size: 11px;
            color: #b45309;
          }
        }
      }
    }

    .status-action-box {
      background-color: var(--canvas-bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-button);
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;

      .progress-section {
        flex: 1;
        min-width: 240px;

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12.5px;
          margin-bottom: 6px;
          .progress-title {
            font-weight: 600;
            color: var(--text-secondary);
          }
          .progress-pct {
            font-weight: 700;
            color: var(--brand-indigo);
          }
        }

        .modern-progress {
          height: 8px;
          border-radius: 4px;
        }
      }

      .status-dropdown-wrap {
        display: flex;
        flex-direction: column;
        gap: 4px;

        label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-subtle);
          text-transform: uppercase;
        }

        .status-select {
          background-color: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-button);
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          min-width: 150px;
        }
      }
    }

    .meta-section {
      h3 {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-subtle);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 0 0 6px 0;
      }
      .desc-text {
        font-size: 14px;
        color: var(--text-secondary);
        line-height: 1.55;
        margin: 0;
      }
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }

      .meta-item {
        background-color: #fafbfc;
        border: 1px solid var(--border-light);
        border-radius: var(--radius-button);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;

        .meta-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .meta-val {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .budget-val {
          font-size: 16px;
          font-weight: 700;
          color: var(--brand-primary);
        }

        .lead-val {
          display: flex;
          align-items: center;
          gap: 10px;

          .lead-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background-color: var(--brand-tint);
            color: var(--brand-indigo);
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--brand-border);
          }

          strong {
            font-size: 13.5px;
            color: var(--text-primary);
          }
          small {
            display: block;
            font-size: 11px;
            color: var(--text-muted);
          }
        }

        .date-range {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: var(--text-primary);
          font-weight: 500;

          .date-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: var(--text-subtle);
          }
        }
      }
    }

    .milestones-box {
      .milestone-title-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 12px;
        flex-wrap: wrap;

        h3 {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .milestone-hint {
          font-size: 11.5px;
          color: var(--text-muted);

          &.verified-hint {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: var(--accent-amber);
            font-weight: 600;

            .hint-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
              color: var(--accent-amber);
            }
          }
        }
      }

      .milestones-verification-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        background-color: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: var(--radius-button);
        padding: 10px 14px;
        margin-bottom: 12px;

        .banner-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
          color: #d97706;
          flex-shrink: 0;
        }

        .banner-text {
          display: flex;
          flex-direction: column;
          gap: 2px;

          strong {
            font-size: 12.5px;
            font-weight: 700;
            color: #92400e;
          }

          span {
            font-size: 11.5px;
            color: #b45309;
            line-height: 1.4;
          }
        }
      }

      .milestone-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .milestone-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background-color: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-button);
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            border-color: var(--brand-accent);
            background-color: var(--canvas-bg);
          }

          &.completed {
            background-color: var(--accent-emerald-tint);
            border-color: var(--accent-emerald-border);

            .check-icon {
              color: var(--accent-emerald);
            }

            .milestone-label {
              text-decoration: line-through;
              color: var(--text-muted);
            }

            .badge-status {
              background-color: var(--accent-emerald);
              color: #ffffff;
            }
          }

          .check-icon {
            color: var(--text-subtle);
            font-size: 20px;
            width: 20px;
            height: 20px;
          }

          .milestone-label {
            flex: 1;
            font-size: 13.5px;
            color: var(--text-primary);
            font-weight: 500;
          }

          .badge-status {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: var(--radius-pill);
            background-color: var(--border-subtle);
            color: var(--text-secondary);
          }
        }
      }

      .empty-milestones {
        padding: 24px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        background-color: var(--canvas-bg);
        border-radius: var(--radius-button);
      }
    }

    /* Verification Pipeline Card */
    .verification-pipeline-card {
      background-color: #ffffff;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-container);
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      .pipeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;

          .pipeline-icon-box {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background-color: #ecfeff;
            color: #0891b2;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;

            mat-icon { font-size: 20px; width: 20px; height: 20px; }
          }

          .pipeline-title-wrap {
            h3 {
              margin: 0;
              font-size: 15px;
              font-weight: 700;
              color: var(--text-primary);
            }
            p {
              margin: 2px 0 0 0;
              font-size: 12px;
              color: var(--text-muted);
            }
          }
        }

        .pipeline-progress-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 600;
          background-color: #fff7ed;
          border: 1px solid #fed7aa;
          color: #c2410c;

          .badge-icon { font-size: 14px; width: 14px; height: 14px; }

          &.all-done {
            background-color: #f0fdf4;
            border-color: #bbf7d0;
            color: #166534;
          }
        }
      }

      .pipeline-stages {
        display: flex;
        flex-direction: column;
        gap: 0;

        .pipeline-stage-item {
          display: flex;
          gap: 14px;

          .stage-left-rail {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 28px;
            flex-shrink: 0;

            .stage-node-circle {
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background-color: #f1f5f9;
              border: 2px solid #cbd5e1;
              color: #64748b;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 700;

              mat-icon { font-size: 14px; width: 14px; height: 14px; }

              &.done {
                background-color: #10b981;
                border-color: #059669;
                color: #ffffff;
              }

              &.current {
                background-color: #0284c7;
                border-color: #0369a1;
                color: #ffffff;
                box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
              }
            }

            .stage-line {
              width: 2px;
              flex: 1;
              background-color: #e2e8f0;
              margin: 4px 0;
              min-height: 24px;
            }
          }

          .stage-content-box {
            flex: 1;
            padding-bottom: 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;

            .stage-top-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 8px;

              .stage-info {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;

                .stage-badge {
                  font-size: 10.5px;
                  font-weight: 700;
                  padding: 1px 6px;
                  border-radius: 4px;
                  background-color: #e2e8f0;
                  color: #334155;

                  &.approved {
                    background-color: var(--accent-emerald-tint);
                    color: var(--accent-emerald);
                  }
                }

                .stage-officer-name {
                  font-size: 13px;
                  font-weight: 600;
                  color: var(--text-primary);
                }

                .stage-officer-email {
                  font-size: 11.5px;
                  color: var(--text-muted);
                }

                .stage-dept-pill {
                  font-size: 10.5px;
                  background-color: #f1f5f9;
                  border: 1px solid #e2e8f0;
                  padding: 1px 6px;
                  border-radius: 4px;
                  color: #475569;
                }
              }

              .stage-status-tag {
                font-size: 11px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #64748b;

                .tag-icon { font-size: 13px; width: 13px; height: 13px; }

                &.approved {
                  color: #10b981;
                }
              }
            }

            .stage-audit-details {
              display: flex;
              flex-direction: column;
              gap: 4px;
              margin-top: 2px;

              .audit-meta-line {
                font-size: 11.5px;
                color: var(--text-muted);
                display: flex;
                gap: 6px;
              }

              .review-quote {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                background-color: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 6px;
                padding: 6px 10px;
                margin-top: 4px;

                .quote-icon {
                  font-size: 14px;
                  width: 14px;
                  height: 14px;
                  color: #16a34a;
                  margin-top: 2px;
                }

                .quote-text {
                  margin: 0;
                  font-size: 12px;
                  color: #14532d;
                  font-style: italic;
                  line-height: 1.4;
                }
              }

              .stage-reset-action-row {
                margin-top: 6px;
                display: flex;
                justify-content: flex-start;

                .stage-reset-btn {
                  height: 30px;
                  font-size: 11.5px;
                  font-weight: 600;
                  color: #dc2626;
                  border-color: #fca5a5;
                  background-color: #fef2f2;
                  border-radius: 6px;
                  line-height: 1;
                  mat-icon {
                    font-size: 15px;
                    width: 15px;
                    height: 15px;
                    margin-right: 4px;
                  }
                  &:hover {
                    background-color: #fee2e2;
                    border-color: #f87171;
                  }
                }
              }
            }

            .stage-signoff-action {
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px 12px;
              display: flex;
              flex-direction: column;
              gap: 8px;
              margin-top: 4px;

              .signoff-prompt-header {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
                color: var(--brand-indigo);

                .prompt-icon { font-size: 15px; width: 15px; height: 15px; }
              }

              .comment-input-wrap {
                .stage-comment-textarea {
                  width: 100%;
                  box-sizing: border-box;
                  border: 1px solid var(--border-subtle);
                  border-radius: 6px;
                  padding: 8px 10px;
                  font-size: 12.5px;
                  font-family: inherit;
                  outline: none;
                  resize: vertical;

                  &:focus {
                    border-color: var(--brand-accent);
                  }
                }
              }

              .signoff-action-row {
                display: flex;
                justify-content: flex-end;

                .stage-signoff-btn {
                  background-color: var(--accent-emerald);
                  color: #ffffff;
                  font-size: 12px;
                  font-weight: 600;
                  height: 32px;
                  line-height: 32px;
                  padding: 0 12px;

                  mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }

                  &:hover { background-color: #047857; }
                }
              }
            }

            .stage-locked-box {
              background-color: #fffbeb;
              border: 1px dashed #f59e0b;
              border-radius: 8px;
              padding: 10px 12px;
              margin-top: 4px;

              .stage-locked-row {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                color: #92400e;

                .locked-icon {
                  font-size: 18px;
                  width: 18px;
                  height: 18px;
                  color: #d97706;
                  margin-top: 1px;
                  flex-shrink: 0;
                }

                .locked-text-wrap {
                  flex: 1;
                  min-width: 0;
                }

                strong {
                  font-size: 12.5px;
                  display: block;
                }

                .locked-desc {
                  margin: 2px 0 0;
                  font-size: 11.5px;
                  color: #b45309;
                }

                .stage-reassign-btn {
                  font-size: 11px;
                  font-weight: 600;
                  color: #4338ca;
                  border-color: #c7d2fe;
                  background: #ffffff;
                  height: 28px;
                  line-height: 28px;
                  padding: 0 8px;
                  margin-left: auto;
                  flex-shrink: 0;

                  mat-icon {
                    font-size: 14px;
                    width: 14px;
                    height: 14px;
                    margin-right: 4px;
                  }

                  &:hover {
                    background: #e0e7ff;
                  }
                }
              }
            }

            .stage-queued-box {
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 6px 10px;
              background-color: #f1f5f9;
              border-radius: 6px;
              font-size: 11.5px;
              color: #64748b;
              margin-top: 4px;

              .queued-icon {
                font-size: 15px;
                width: 15px;
                height: 15px;
              }
            }
          }
        }
      }
    }

    .detail-footer {
      padding: 14px 24px;
      border-top: 1px solid var(--border-subtle);
      background-color: #fafbfc;
      display: flex;
      justify-content: space-between;

      .footer-right-actions {
        display: flex;
        align-items: center;
        .dialog-rollback-btn {
          color: #dc2626;
          border-color: #fca5a5;
          background-color: #fef2f2;
          font-weight: 600;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            margin-right: 4px;
          }

          &:hover {
            background-color: #fee2e2;
            border-color: #f87171;
          }
        }

        .verify-signoff-btn {
          background-color: var(--accent-emerald);
          color: #ffffff;
          font-weight: 600;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            margin-right: 4px;
          }

          &:hover {
            background-color: #047857;
          }
        }
      }
    }
  `]
})
export class WorkPlanDetailDialogComponent {
  private workPlanService = inject(WorkPlanService);
  private rbacService = inject(RbacService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  canEditAndAssign = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin() || this.rbacService.isDepartmentHead()) {
      return true;
    }
    const roles = this.workPlanService.settings().rolesPermittedForEditAndAssign || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:edit_plan') || this.rbacService.hasAnyRole(roles);
  });

  canAccessVerification = computed(() => {
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canReassignOfficer = computed(() => {
    return this.rbacService.isSuperAdmin() || 
           this.rbacService.isAdmin() || 
           this.rbacService.hasRole('Super Admin') || 
           this.rbacService.hasRole('Divisional Admin') ||
           this.rbacService.hasRole('Department Head');
  });

  isPlanOwner = computed(() => {
    const u = this.authService.currentUser();
    return u ? isWorkPlanOwner(this.currentPlan(), u.email, u.displayName, u.uid) : false;
  });

  canChangeStatus = computed(() => {
    return this.isPlanOwner() || this.canEditAndAssign() || this.canAccessVerification();
  });

  currentPlan: WritableSignal<WorkPlan>;
  currentStageComment = '';

  planVerifiers = computed(() => {
    return this.workPlanService.getPlanVerifiers(this.currentPlan());
  });

  signedOffCount = computed(() => {
    return this.workPlanService.getCompletedVerifiersCount(this.currentPlan());
  });

  areAllSignedOff = computed(() => {
    return this.workPlanService.areAllVerifiersApproved(this.currentPlan());
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { plan: WorkPlan },
    public dialogRef: MatDialogRef<WorkPlanDetailDialogComponent>
  ) {
    this.currentPlan = signal<WorkPlan>(data.plan);
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  completedMilestonesCount(): number {
    return this.currentPlan().milestones.filter(m => m.completed).length;
  }

  isNextInLine(stage: WorkPlanVerifier): boolean {
    const next = this.workPlanService.getNextPendingVerifier(this.currentPlan());
    return next ? (next.id === stage.id || next.order === stage.order) : false;
  }

  canSignOffStage(stage: WorkPlanVerifier): boolean {
    if (!stage || stage.verified) return false;
    if (!this.isNextInLine(stage)) return false;
    const curUser = this.authService.currentUser();
    return this.workPlanService.isUserAssignedToVerifier(
      stage,
      curUser?.email,
      curUser?.displayName,
      curUser?.uid
    );
  }

  canSignOffNextStage(): boolean {
    const next = this.workPlanService.getNextPendingVerifier(this.currentPlan());
    return next ? this.canSignOffStage(next) : false;
  }

  getNextStageOrder(): number {
    const next = this.workPlanService.getNextPendingVerifier(this.currentPlan());
    return next ? next.order : 1;
  }

  openReassign(stage: WorkPlanVerifier) {
    const ref = this.dialog.open(WorkPlanReassignDialogComponent, {
      width: '540px',
      data: {
        plan: this.currentPlan(),
        stage: stage
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res && res.reassigned) {
        this.workPlanService.getWorkPlans().subscribe(plans => {
          const found = (plans || []).find(p => p.id === this.currentPlan().id);
          if (found) {
            this.currentPlan.set(found);
          }
        });
      }
    });
  }

  async signOffStage(stage: WorkPlanVerifier) {
    if (!this.canSignOffStage(stage)) {
      this.snackBar.open(
        `Access Denied: Only assigned officer (${stage.name || 'Assigned Officer'}) can sign off Stage ${stage.order}. Other officers cannot approve this stage.`,
        'Dismiss',
        { duration: 4000 }
      );
      return;
    }

    const curUser = this.authService.currentUser();
    const plan = this.currentPlan();
    const verifiers = this.workPlanService.getPlanVerifiers(plan);
    const updatedVerifiers = verifiers.map(v => {
      if (v.id === stage.id || v.order === stage.order) {
        return {
          ...v,
          verified: true,
          verifiedAt: new Date().toISOString(),
          verifiedByEmail: curUser?.email || curUser?.displayName || 'Verification Officer',
          reviewComment: this.currentStageComment.trim()
        };
      }
      return v;
    });

    this.currentStageComment = '';

    const allApproved = updatedVerifiers.every(v => v.verified);
    const newStatus: WorkPlan['status'] = allApproved ? 'Completed' : 'Under Review';
    const newProgress = allApproved ? 100 : plan.progress;

    const updatedPlan: WorkPlan = {
      ...plan,
      verifiers: updatedVerifiers,
      status: newStatus,
      progress: newProgress
    };

    this.currentPlan.set(updatedPlan);

    if (plan.id) {
      await this.workPlanService.updateWorkPlan(plan.id, {
        verifiers: updatedVerifiers,
        status: newStatus,
        progress: newProgress
      });
    }

    this.snackBar.open(
      `Stage ${stage.order} verified successfully${allApproved ? ' - All stages approved, work plan Completed!' : ''}`,
      'Dismiss',
      { duration: 3000 }
    );
  }

  async quickSignOffNextStage() {
    const next = this.workPlanService.getNextPendingVerifier(this.currentPlan());
    if (next) {
      await this.signOffStage(next);
    }
  }

  canResetStageApproval(stage: WorkPlanVerifier): boolean {
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

  async resetStageApproval(stage: WorkPlanVerifier) {
    const plan = this.currentPlan();
    if (!plan.id) return;

    if (!confirm(`Are you sure you want to reset approval for Stage ${stage.order} (${stage.name})? This will return this verification stage back to pending.`)) {
      return;
    }

    const currentVerifiers = this.planVerifiers();
    const updatedVerifiers = currentVerifiers.map(v => {
      if (v.order >= stage.order) {
        return {
          ...v,
          verified: false,
          verifiedAt: undefined,
          verifiedByEmail: undefined,
          reviewComment: undefined
        };
      }
      return v;
    });

    const newStatus: WorkPlan['status'] = plan.status === 'Completed' ? 'Under Review' : plan.status;
    const newProgress = plan.progress === 100 ? 95 : plan.progress;
    const rollbackNotes = `Stage ${stage.order} approval was reset by ${this.authService.currentUser()?.displayName || this.authService.currentUser()?.email || 'verifier'}`;

    const updatedPlan: WorkPlan = {
      ...plan,
      verifiers: updatedVerifiers,
      status: newStatus,
      progress: newProgress,
      revisionNotes: rollbackNotes,
      rollbackAt: new Date().toISOString()
    };

    this.currentPlan.set(updatedPlan);

    try {
      await this.workPlanService.updateWorkPlan(plan.id, {
        verifiers: updatedVerifiers,
        status: newStatus,
        progress: newProgress,
        revisionNotes: rollbackNotes,
        rollbackAt: new Date().toISOString()
      });
      this.snackBar.open(`Stage ${stage.order} approval reset to pending.`, 'Dismiss', { duration: 3500 });
    } catch {
      this.snackBar.open('Saved to local queue', 'Dismiss', { duration: 3000 });
    }
  }

  async requestRevision() {
    const plan = this.currentPlan();
    if (!plan.id) return;

    const revDialog = this.dialog.open(WorkPlanRevisionDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { plan }
    });

    revDialog.afterClosed().subscribe(async (result) => {
      if (!result?.confirmed || !plan.id) return;

      try {
        await this.workPlanService.rollbackWorkPlan(plan.id, result.reason, plan);
        const resetVerifs = this.workPlanService.resetPlanVerifiers(plan);
        this.currentPlan.update(p => ({
          ...p,
          status: 'In Progress',
          verifiers: resetVerifs,
          revisionNotes: result.reason,
          rollbackAt: new Date().toISOString()
        }));
        this.snackBar.open('Directive returned to In Progress for revisions. All verification approvals have been reset.', 'Dismiss', { duration: 4000 });
      } catch {
        this.snackBar.open('Saved to local offline queue', 'Dismiss', { duration: 3000 });
      }
    });
  }

  async toggleMilestone(index: number) {
    const plan = this.currentPlan();
    const updatedMilestones = [...plan.milestones];
    updatedMilestones[index] = {
      ...updatedMilestones[index],
      completed: !updatedMilestones[index].completed
    };

    const completedCount = updatedMilestones.filter(m => m.completed).length;
    const computedProgress = Math.round((completedCount / updatedMilestones.length) * 100);

    // CRITICAL: When deliverable milestones are completed, it ONLY goes to verify ('Under Review'), NOT directly to complete ('Completed').
    let newStatus: WorkPlan['status'] = plan.status;
    let updatedVerifiers = plan.verifiers;
    if (computedProgress === 100) {
      // Directives with all milestones completed route to 'Under Review' awaiting audit verification
      if (plan.status !== 'Completed') {
        newStatus = 'Under Review';
      }
    } else {
      // If milestones are uncompleted (< 100%) and was previously in Under Review or Completed, revert to In Progress and RESET APPROVALS
      if (plan.status === 'Under Review' || plan.status === 'Completed') {
        newStatus = 'In Progress';
        updatedVerifiers = this.workPlanService.resetPlanVerifiers(plan);
        this.snackBar.open('Deliverable uncompleted: Directive returned to In Progress and verification approvals reset.', 'Dismiss', { duration: 3500 });
      }
    }

    const updatedPlan: WorkPlan = {
      ...plan,
      milestones: updatedMilestones,
      progress: computedProgress,
      status: newStatus,
      verifiers: updatedVerifiers
    };

    this.currentPlan.set(updatedPlan);

    if (plan.id) {
      await this.workPlanService.updateWorkPlan(plan.id, {
        milestones: updatedMilestones,
        progress: computedProgress,
        status: newStatus,
        verifiers: updatedVerifiers
      });
    }
  }

  async onStatusChange(newStatus: WorkPlan['status']) {
    const plan = this.currentPlan();
    if (!this.canChangeStatus()) {
      this.snackBar.open('Access Denied: You do not have permission to transition this directive state.', 'Dismiss', { duration: 3000 });
      this.currentPlan.update(p => ({ ...p, status: plan.status }));
      return;
    }

    // Guard against unauthorized completion or incomplete verifiers
    if (newStatus === 'Completed') {
      if (!this.canAccessVerification()) {
        this.snackBar.open('You do not have permission to verify directives', 'Dismiss', { duration: 3000 });
        this.currentPlan.update(p => ({ ...p, status: plan.status }));
        return;
      }
      if (!this.areAllSignedOff()) {
        this.snackBar.open(`Cannot complete: All ${this.planVerifiers().length} verification officer stages must be signed off`, 'Dismiss', { duration: 3500 });
        this.currentPlan.update(p => ({ ...p, status: 'Under Review' }));
        return;
      }
    }

    let updatedVerifiers = plan.verifiers;
    if ((newStatus === 'In Progress' || newStatus === 'Draft') && (plan.status === 'Under Review' || plan.status === 'Completed')) {
      updatedVerifiers = this.workPlanService.resetPlanVerifiers(plan);
      this.snackBar.open('Status changed to ' + newStatus + '. All verification stage approvals have been reset.', 'Dismiss', { duration: 3500 });
    }

    const progress = newStatus === 'Completed' ? 100 : (newStatus === 'Draft' ? 0 : plan.progress);
    this.currentPlan.set({ ...plan, status: newStatus, progress, verifiers: updatedVerifiers });
    if (plan.id) {
      await this.workPlanService.updateWorkPlan(plan.id, { status: newStatus, progress, verifiers: updatedVerifiers });
    }
  }

  openEdit() {
    this.dialogRef.close({ action: 'edit', plan: this.currentPlan() });
  }
}
