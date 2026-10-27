import { Component, Inject, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';
import { Customer, CustomerService } from './services/customer.service';
import { LandJob, LandJobStatus } from '../land/models/land.model';
import { LandService } from '../land/services/land.service';
import { WorkPlan, WorkPlanService } from '../work-plans/services/work-plan.service';
import { Division } from '../settings/settings.service';
import { LandJobDetailDialogComponent } from '../land/components/land-job-detail-dialog/land-job-detail-dialog.component';
import { LandJobDialogComponent } from '../land/components/land-job-dialog/land-job-dialog.component';
import { WorkPlanDetailDialogComponent } from '../work-plans/components/work-plan-detail-dialog/work-plan-detail-dialog.component';
import { LinkTaskDialogComponent } from './link-task-dialog.component';
import { SendSmsDialogComponent } from '../land/components/send-sms-dialog/send-sms-dialog.component';
import { CustomerDialogComponent } from './customer-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { EventLogService } from '../../core/services/event-log.service';

@Component({
  selector: 'app-customer-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatTabsModule,
    SendSmsDialogComponent
  ],
  template: `
    <div class="dossier-container">
      <!-- Header Bar -->
      <div class="dossier-header">
        <div class="profile-hero">
          <div class="profile-avatar">
            {{ customer().name.charAt(0) | uppercase }}
          </div>
          <div class="profile-meta">
            <div class="name-status-row">
              <h1 class="customer-name">{{ customer().name }}</h1>
              <span class="status-pill" [ngClass]="customer().status">
                <span class="status-dot"></span>
                {{ customer().status | titlecase }}
              </span>
            </div>
            <div class="submeta-row">
              <span class="nic-badge" (click)="copyNic(customer().nic)" matTooltip="Click to copy NIC">
                <mat-icon class="nic-icon">badge</mat-icon>
                NIC: {{ customer().nic }}
                <mat-icon class="copy-icon">content_copy</mat-icon>
              </span>
              <span class="meta-separator">•</span>
              <span class="division-text">
                <mat-icon class="mini-icon">domain</mat-icon>
                {{ customer().division }}
                <span *ngIf="customer().gnDivision">({{ customer().gnDivision }})</span>
              </span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button color="primary" class="action-btn" (click)="openEditModal()" matTooltip="Edit Customer Details">
            <mat-icon>edit</mat-icon> Edit Details
          </button>
          <button mat-icon-button (click)="close()" class="close-btn" matTooltip="Close Dossier">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Main Body -->
      <div class="dossier-body">
        <!-- Citizen Information Grid -->
        <div class="info-grid">
          <div class="info-card">
            <div class="info-icon phone-icon">
              <mat-icon>phone</mat-icon>
            </div>
            <div class="info-text">
              <span class="info-label">Contact Telephone</span>
              <span class="info-value">{{ customer().tpno || 'Not provided' }}</span>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon email-icon">
              <mat-icon>email</mat-icon>
            </div>
            <div class="info-text">
              <span class="info-label">Email Address</span>
              <span class="info-value">{{ customer().email || 'Not provided' }}</span>
            </div>
          </div>

          <div class="info-card span-2">
            <div class="info-icon address-icon">
              <mat-icon>place</mat-icon>
            </div>
            <div class="info-text">
              <span class="info-label">Postal / Residential Address</span>
              <span class="info-value address-value">{{ customer().address || 'Not provided' }}</span>
            </div>
          </div>
        </div>

        <!-- Metric Summary Strip -->
        <div class="metrics-strip">
          <div class="metric-block">
            <span class="metric-num">{{ totalTasks() }}</span>
            <span class="metric-desc">Total Linked Tasks</span>
          </div>
          <div class="metric-separator"></div>
          <div class="metric-block wp-block">
            <span class="metric-num">{{ linkedWorkPlans().length }}</span>
            <span class="metric-desc">Work Plans</span>
          </div>
          <div class="metric-separator"></div>
          <div class="metric-block active-block">
            <span class="metric-num">{{ linkedJobs().length }}</span>
            <span class="metric-desc">Land Tasks</span>
          </div>
        </div>

        <!-- Section: Linked Tasks & Operations -->
        <div class="section-container">
          <div class="section-header">
            <div class="section-title-wrap">
              <div class="section-icon-box">
                <mat-icon>assignment_turned_in</mat-icon>
              </div>
              <div>
                <h3 class="section-title">Linked Tasks & Operations</h3>
                <p class="section-desc">Active operational directives and cadastral land records associated with this citizen.</p>
              </div>
            </div>
            <div class="section-header-actions">
              <span class="tasks-count-pill">{{ totalTasks() }} Tasks Linked</span>
              <button mat-flat-button color="primary" class="link-task-head-btn" (click)="openLinkTaskModal()">
                <mat-icon>add_task</mat-icon> Link Task
              </button>
            </div>
          </div>

          <!-- Empty State when 0 linked tasks -->
          <div *ngIf="totalTasks() === 0" class="empty-tasks-card">
            <div class="empty-icon-wrap">
              <mat-icon>assignment_late</mat-icon>
            </div>
            <h4 class="empty-title">No Tasks Currently Linked</h4>
            <p class="empty-desc">This citizen does not have any operational directives or cadastral land jobs linked yet. You can attach an existing task or author a new one directly.</p>
            <button mat-flat-button color="primary" class="empty-action-btn" (click)="openLinkTaskModal()">
              <mat-icon>add_task</mat-icon> Link First Task
            </button>
          </div>

          <!-- Tabs for Work Plans and Land Management -->
          <mat-tab-group *ngIf="totalTasks() > 0" class="tasks-tab-group" mat-stretch-tabs="false">
            
            <!-- TAB 1: Work Plans Directives -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon">assignment</mat-icon>
                <span>Work Plans ({{ linkedWorkPlans().length }})</span>
              </ng-template>

              <div class="tab-content-pad">
                <div *ngIf="linkedWorkPlans().length === 0" class="empty-sub-tab">
                  <mat-icon class="sub-empty-icon">info</mat-icon>
                  <p>No operational work plan directives linked yet.</p>
                  <button mat-stroked-button color="primary" (click)="openLinkTaskModal()">
                    <mat-icon>add_task</mat-icon> Link Work Plan
                  </button>
                </div>

                <div *ngIf="linkedWorkPlans().length > 0" class="tasks-list">
                  <div *ngFor="let plan of linkedWorkPlans()" class="task-card work-plan-card">
                    <div class="task-header-row">
                      <div class="ref-type-group">
                        <span class="job-ref-tag wp-tag" (click)="openWorkPlanDetail(plan)" matTooltip="Inspect Directive Dossier">
                          <mat-icon class="ref-icon">assignment</mat-icon>
                          {{ plan.title }}
                        </span>
                        <span class="job-type-name" *ngIf="plan.department">{{ plan.department }}</span>
                      </div>

                      <div class="stage-priority-group">
                        <span class="priority-pill" [ngClass]="(plan.priority || 'medium').toLowerCase()">
                          {{ plan.priority || 'Normal' }}
                        </span>
                        <span class="stage-pill wp-status-pill" [ngClass]="(plan.status || 'in-progress').toLowerCase().replace(' ', '-')">
                          <mat-icon class="stage-icon">pending_actions</mat-icon>
                          {{ plan.status }}
                        </span>
                      </div>
                    </div>

                    <div class="cadastral-grid">
                      <div class="cadastral-item">
                        <span class="c-label">Category</span>
                        <span class="c-val">{{ plan.category || 'Operations' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Division</span>
                        <span class="c-val">{{ plan.division || 'General' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Target Date</span>
                        <span class="c-val font-mono">{{ plan.targetDate || 'Open' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Lead Officer</span>
                        <span class="c-val">{{ plan.leadName || 'Unassigned' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Progress</span>
                        <span class="c-val">{{ plan.progress || 0 }}%</span>
                      </div>
                    </div>

                    <div class="task-footer-row">
                      <div class="officer-time-info">
                        <mat-icon class="time-icon">schedule</mat-icon>
                        <span>Month: {{ plan.assignedMonth || 'Current' }}</span>
                        <span class="bullet" *ngIf="plan.milestones">•</span>
                        <span *ngIf="plan.milestones">{{ plan.milestones.length }} Milestones</span>
                      </div>

                      <div class="task-actions">
                        <button mat-stroked-button class="view-task-btn" (click)="openWorkPlanDetail(plan)">
                          <mat-icon>visibility</mat-icon> View Directive
                        </button>
                        <button mat-stroked-button class="unlink-task-btn" (click)="unlinkWorkPlan(plan)" matTooltip="Remove link with this citizen">
                          <mat-icon>link_off</mat-icon> Unlink
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- TAB 2: Land Management Tasks -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="tab-label-icon">terrain</mat-icon>
                <span>Land Management ({{ linkedJobs().length }})</span>
              </ng-template>

              <div class="tab-content-pad">
                <div *ngIf="linkedJobs().length === 0" class="empty-sub-tab">
                  <mat-icon class="sub-empty-icon">info</mat-icon>
                  <p>No land management cadastral tasks linked yet.</p>
                  <button mat-stroked-button color="primary" (click)="openLinkTaskModal()">
                    <mat-icon>add_task</mat-icon> Link Land Task
                  </button>
                </div>

                <div *ngIf="linkedJobs().length > 0" class="tasks-list">
                  <div *ngFor="let job of linkedJobs()" class="task-card">
                    <!-- Top Row: Ref, Job Type, Stage, Priority -->
                    <div class="task-header-row">
                      <div class="ref-type-group">
                        <span class="job-ref-tag" (click)="openJobDetail(job)" matTooltip="Click to inspect task dossier">
                          <mat-icon class="ref-icon">description</mat-icon>
                          {{ job.jobRef }}
                        </span>
                        <span class="job-type-name">{{ job.jobTypeName }}</span>
                      </div>

                      <div class="stage-priority-group">
                        <span class="priority-pill" [ngClass]="job.priority.toLowerCase()">
                          {{ job.priority }}
                        </span>
                        <span class="stage-pill" [ngClass]="job.status.toLowerCase()">
                          <mat-icon class="stage-icon">{{ getStageIcon(job.status) }}</mat-icon>
                          {{ job.status }}
                        </span>
                      </div>
                    </div>

                    <!-- Cadastral Details Grid -->
                    <div class="cadastral-grid">
                      <div class="cadastral-item">
                        <span class="c-label">Deed No</span>
                        <span class="c-val font-mono">{{ job.deedNumber || 'N/A' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Plan No</span>
                        <span class="c-val font-mono">{{ job.planNumber || 'N/A' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Lot No</span>
                        <span class="c-val font-mono">{{ job.lotNumber || 'N/A' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Land Name</span>
                        <span class="c-val">{{ job.landName || '-' }}</span>
                      </div>
                      <div class="cadastral-item">
                        <span class="c-label">Division / GN</span>
                        <span class="c-val">
                          {{ job.division }}
                          <span class="gn-sub" *ngIf="job.gramaNiladhariDivision">({{ job.gramaNiladhariDivision }})</span>
                        </span>
                      </div>
                    </div>

                    <!-- Footer Row: Dates & Dossier Actions -->
                    <div class="task-footer-row">
                      <div class="officer-time-info">
                        <mat-icon class="time-icon">schedule</mat-icon>
                        <span>Registered {{ job.createdAt | date:'mediumDate' }}</span>
                        <span class="bullet" *ngIf="job.createdBy">•</span>
                        <span *ngIf="job.createdBy">Officer: {{ job.createdBy }}</span>
                      </div>

                      <div class="task-actions">
                        <button mat-icon-button class="sms-task-btn" (click)="openSendSmsDialog(job)" [matTooltip]="job.customerPhone ? 'Send SMS to citizen (' + job.customerPhone + ')' : 'Send SMS to citizen'">
                          <mat-icon>sms</mat-icon>
                        </button>
                        <button mat-stroked-button class="view-task-btn" (click)="openJobDetail(job)">
                          <mat-icon>visibility</mat-icon> View Task Dossier
                        </button>
                        <button mat-icon-button class="wizard-btn" (click)="openJobInWizard(job)" matTooltip="Open in Land Task Wizard">
                          <mat-icon>edit_document</mat-icon>
                        </button>
                        <button mat-stroked-button class="unlink-task-btn" (click)="unlinkLandJob(job)" matTooltip="Remove link with this citizen">
                          <mat-icon>link_off</mat-icon> Unlink
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

          </mat-tab-group>
        </div>
      </div>

      <!-- Dialog Footer -->
      <div class="dossier-footer">
        <span class="footer-hint">
          <mat-icon class="hint-icon">verified_user</mat-icon>
          Customer and task directives are synchronized with central operational registries.
        </span>
        <button mat-flat-button color="primary" (click)="close()">Close Dossier</button>
      </div>
    </div>
  `,
  styles: [`
    .dossier-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
    }

    .dossier-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 22px 28px;
      border-bottom: 1px solid var(--border-subtle, #e2e8f0);
      background: #ffffff;

      .profile-hero {
        display: flex;
        align-items: center;
        gap: 16px;

        .profile-avatar {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: #eef2ff;
          color: #4f46e5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 22px;
          border: 1px solid #c7d2fe;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.08);
        }

        .profile-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;

          .name-status-row {
            display: flex;
            align-items: center;
            gap: 12px;

            .customer-name {
              margin: 0;
              font-size: 20px;
              font-weight: 700;
              color: var(--text-primary, #0f172a);
              letter-spacing: -0.01em;
            }

            .status-pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 2px 10px;
              border-radius: 20px;
              font-size: 11.5px;
              font-weight: 600;

              .status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
              }

              &.active {
                background: #ecfdf5;
                color: #059669;
                border: 1px solid #a7f3d0;
                .status-dot { background: #10b981; }
              }

              &.inactive {
                background: #f1f5f9;
                color: #64748b;
                border: 1px solid #cbd5e1;
                .status-dot { background: #94a3b8; }
              }
            }
          }

          .submeta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--text-muted, #64748b);

            .nic-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              cursor: pointer;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 2px 8px;
              border-radius: 6px;
              font-family: monospace;
              font-weight: 600;
              color: #334155;
              transition: all 0.15s ease;

              .nic-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
              .copy-icon { font-size: 12px; width: 12px; height: 12px; opacity: 0.6; }

              &:hover {
                background: #e2e8f0;
                color: #0f172a;
                .copy-icon { opacity: 1; }
              }
            }

            .meta-separator { color: #cbd5e1; }

            .division-text {
              display: inline-flex;
              align-items: center;
              gap: 4px;

              .mini-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
            }
          }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .action-btn {
          height: 36px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 13px;
        }

        .close-btn {
          color: #64748b;
        }
      }
    }

    .dossier-body {
      padding: 24px 28px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
      background: #f8fafc;
    }

    /* Citizen Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;

      @media (max-width: 800px) {
        grid-template-columns: 1fr 1fr;
      }
      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }

      .info-card {
        background: #ffffff;
        border: 1px solid var(--border-subtle, #e2e8f0);
        border-radius: 10px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 14px;

        &.span-2 {
          grid-column: span 2;
          @media (max-width: 800px) {
            grid-column: span 2;
          }
          @media (max-width: 500px) {
            grid-column: span 1;
          }
        }

        .info-icon {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }

          &.phone-icon { background: #e0f2fe; color: #0284c7; }
          &.email-icon { background: #f3e8ff; color: #9333ea; }
          &.address-icon { background: #fef3c7; color: #d97706; }
        }

        .info-text {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .info-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted, #64748b);
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }

          .info-value {
            font-size: 13.5px;
            font-weight: 600;
            color: var(--text-primary, #0f172a);

            &.address-value {
              font-weight: 500;
              line-height: 1.3;
            }
          }
        }
      }
    }

    /* Metric Summary Strip */
    .metrics-strip {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid var(--border-subtle, #e2e8f0);
      border-radius: 10px;
      padding: 12px 24px;
      gap: 16px;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .metric-block {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .metric-num {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
        }

        .metric-desc {
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        &.wp-block .metric-num { color: #4f46e5; }
        &.active-block .metric-num { color: #0284c7; }
        &.voucher-metric-block .metric-num { color: #059669; }
      }

      .metric-separator {
        width: 1px;
        height: 36px;
        background: #e2e8f0;

        @media (max-width: 768px) {
          display: none;
        }
      }
    }

    /* Section: Linked Tasks */
    .section-container {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;

        .section-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;

          .section-icon-box {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            background: #ecfdf5;
            color: #059669;
            display: flex;
            align-items: center;
            justify-content: center;

            mat-icon { font-size: 20px; width: 20px; height: 20px; }
          }

          .section-title {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
          }

          .section-desc {
            margin: 2px 0 0 0;
            font-size: 12px;
            color: #64748b;
          }
        }

        .section-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;

          .tasks-count-pill {
            font-size: 11.5px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 20px;
            background: #eef2ff;
            color: #4f46e5;
            border: 1px solid #c7d2fe;
          }

          .link-task-head-btn {
            height: 34px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12.5px;
            font-weight: 600;
            background: #4f46e5;
            color: #ffffff;
          }
        }
      }

      .empty-tasks-card {
        background: #ffffff;
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        padding: 40px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;

        .empty-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #f1f5f9;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;

          mat-icon { font-size: 30px; width: 30px; height: 30px; }
        }

        .empty-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }

        .empty-desc {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          max-width: 440px;
        }

        .empty-action-btn {
          margin-top: 10px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #4f46e5;
          color: #ffffff;
        }
      }

      .tasks-tab-group {
        background: transparent;

        .tab-content-pad {
          padding-top: 14px;
        }

        .tab-label-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          margin-right: 6px;
        }

        .empty-sub-tab {
          background: #ffffff;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: #64748b;
          font-size: 13px;

          .sub-empty-icon {
            font-size: 32px;
            width: 32px;
            height: 32px;
            color: #94a3b8;
          }
        }
      }

      .tasks-list {
        display: flex;
        flex-direction: column;
        gap: 14px;

        .task-card {
          background: #ffffff;
          border: 1px solid var(--border-subtle, #e2e8f0);
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;

          &.work-plan-card {
            border-left: 4px solid #4f46e5;
            .wp-tag {
              background: #eef2ff;
              border-color: #c7d2fe;
              color: #4338ca;
            }
          }

          &.voucher-task-card {
            border-left: 4px solid #059669;
            .voucher-tag {
              background: #ecfdf5;
              border-color: #a7f3d0;
              color: #065f46;
            }
          }

          &:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border-color: #cbd5e1;
          }

          .task-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;

            .ref-type-group {
              display: flex;
              align-items: center;
              gap: 10px;

              .job-ref-tag {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: #f1f5f9;
                color: #0f172a;
                font-family: monospace;
                font-weight: 700;
                font-size: 13px;
                padding: 4px 10px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
                cursor: pointer;
                transition: all 0.15s ease;

                &:hover {
                  background: #e2e8f0;
                  color: #4f46e5;
                }

                .ref-icon { font-size: 15px; width: 15px; height: 15px; color: #4f46e5; }
              }

              .job-type-name {
                font-size: 14.5px;
                font-weight: 600;
                color: #1e293b;
              }
            }

            .stage-priority-group {
              display: flex;
              align-items: center;
              gap: 8px;

              .priority-pill {
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;

                &.normal, &.low, &.cash { background: #f1f5f9; color: #475569; }
                &.medium, &.cheque { background: #e0e7ff; color: #4338ca; }
                &.urgent, &.high, &.bank-transfer { background: #fef3c7; color: #b45309; }
                &.immediate { background: #fee2e2; color: #b91c1c; }
              }

              .stage-pill {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;

                .stage-icon { font-size: 15px; width: 15px; height: 15px; }

                &.initial { background: #e0f2fe; color: #0284c7; }
                &.documentation { background: #fef3c7; color: #b45309; }
                &.verification { background: #f3e8ff; color: #7e22ce; }
                &.completed, &.paid { background: #dcfce7; color: #15803d; }
                &.approved { background: #eff6ff; color: #1d4ed8; }
                &.rejected, &.cancelled { background: #fee2e2; color: #b91c1c; }
                &.on\\ hold { background: #f1f5f9; color: #475569; }
                &.in-progress, &.pending-approval { background: #e0e7ff; color: #4338ca; }
              }
            }
          }

          .cadastral-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;

            @media (max-width: 768px) {
              grid-template-columns: repeat(2, 1fr);
            }

            .cadastral-item {
              display: flex;
              flex-direction: column;
              gap: 2px;

              .c-label {
                font-size: 10.5px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #94a3b8;
              }

              .c-val {
                font-size: 12.5px;
                font-weight: 600;
                color: #1e293b;

                &.font-mono { font-family: monospace; }

                .gn-sub {
                  font-weight: 400;
                  color: #64748b;
                  font-size: 11px;
                }
              }
            }
          }

          .task-footer-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            padding-top: 10px;
            border-top: 1px solid #f1f5f9;

            .officer-time-info {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              color: #64748b;

              .time-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
              .bullet { color: #cbd5e1; }
            }

            .task-actions {
              display: flex;
              align-items: center;
              gap: 8px;

              .sms-task-btn {
                color: #0284c7;
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                width: 32px;
                height: 32px;
                line-height: 32px;
                mat-icon { font-size: 16px; width: 16px; height: 16px; }
              }

              .view-task-btn {
                height: 32px;
                font-size: 12px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                color: #1e293b;
                border-color: #cbd5e1;
                mat-icon { font-size: 15px; width: 15px; height: 15px; }
              }

              .wizard-btn {
                width: 32px;
                height: 32px;
                line-height: 32px;
                color: #4f46e5;
                mat-icon { font-size: 18px; width: 18px; height: 18px; }
              }

              .unlink-task-btn {
                height: 32px;
                font-size: 12px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #dc2626 !important;
                border-color: #fecaca !important;
                background: #fef2f2 !important;
                transition: all 0.15s ease;

                mat-icon {
                  font-size: 15px;
                  width: 15px;
                  height: 15px;
                  color: #dc2626;
                }

                &:hover {
                  background: #fee2e2 !important;
                  border-color: #f87171 !important;
                  color: #b91c1c !important;
                  box-shadow: 0 1px 4px rgba(220, 38, 38, 0.15);
                }
              }
            }
          }
        }
      }
    }

    .dossier-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 28px;
      border-top: 1px solid var(--border-subtle, #e2e8f0);
      background: #ffffff;

      .footer-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #64748b;

        .hint-icon { font-size: 16px; width: 16px; height: 16px; color: #10b981; }
      }
    }
  `]
})
export class CustomerDetailDialogComponent {
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<CustomerDetailDialogComponent>);
  private customerService = inject(CustomerService);
  private workPlanService = inject(WorkPlanService);
  private landService = inject(LandService);
  private notif = inject(NotificationService);
  private eventLog = inject(EventLogService);

  public data: {
    customer: Customer;
    linkedJobs: LandJob[];
    linkedWorkPlans?: WorkPlan[];
    divisions: Division[];
  } = inject(MAT_DIALOG_DATA);

  customer = signal<Customer>(this.data.customer);
  linkedJobs = signal<LandJob[]>(this.data.linkedJobs || []);
  linkedWorkPlans = signal<WorkPlan[]>(this.data.linkedWorkPlans || []);
  divisions = signal<Division[]>(this.data.divisions || []);

  totalTasks = computed(() => this.linkedJobs().length + this.linkedWorkPlans().length);
  inProgressTasks = computed(() => {
    const jobs = this.linkedJobs().filter(j => j.status !== 'Completed' && j.status !== 'Rejected').length;
    const plans = this.linkedWorkPlans().filter(p => p.status !== 'Completed').length;
    return jobs + plans;
  });
  completedTasks = computed(() => {
    const jobs = this.linkedJobs().filter(j => j.status === 'Completed').length;
    const plans = this.linkedWorkPlans().filter(p => p.status === 'Completed').length;
    return jobs + plans;
  });

  copyNic(nic: string) {
    if (!nic) return;
    navigator.clipboard.writeText(nic).then(() => {
      this.notif.info(`NIC ${nic} copied to clipboard`);
    });
  }

  getStageIcon(status: LandJobStatus | string): string {
    switch (status) {
      case 'Initial': return 'app_registration';
      case 'Documentation': return 'attach_file';
      case 'Verification': return 'fact_check';
      case 'Completed': return 'check_circle';
      case 'Rejected': return 'cancel';
      case 'On Hold': return 'pause_circle';
      default: return 'folder';
    }
  }

  openEditModal() {
    const editRef = this.dialog.open(CustomerDialogComponent, {
      width: '540px',
      data: {
        customer: this.customer(),
        divisions: this.divisions()
      }
    });

    editRef.afterClosed().subscribe(result => {
      if (result && this.customer().id) {
        const id = this.customer().id!;
        const updated: Partial<Customer> = {
          name: result.name,
          nic: result.nic,
          address: result.address,
          tpno: result.tpno,
          email: result.email || '',
          division: result.division,
          gnDivision: result.gnDivision || '',
          status: result.status || 'active'
        };

        this.customerService.updateCustomer(id, updated).then(() => {
          this.customer.update(c => ({ ...c, ...updated }));
          this.eventLog.logAction('UPDATED', 'Customers', `Updated customer details for ${result.name} (${result.nic})`);
          this.notif.success('Customer details updated successfully');
        }).catch(err => {
          console.error('Error updating customer', err);
          this.notif.error('Failed to update customer details');
        });
      }
    });
  }

  openWorkPlanDetail(plan: WorkPlan) {
    this.dialog.open(WorkPlanDetailDialogComponent, {
      width: '900px',
      maxWidth: '96vw',
      data: { plan }
    });
  }

  openJobDetail(job: LandJob) {
    this.dialog.open(LandJobDetailDialogComponent, {
      width: '900px',
      maxWidth: '96vw',
      data: { job }
    });
  }

  openJobInWizard(job: LandJob) {
    this.dialog.open(LandJobDialogComponent, {
      width: '850px',
      maxWidth: '95vw',
      data: { existingJob: job }
    });
  }

  openSendSmsDialog(job: LandJob) {
    this.dialog.open(SendSmsDialogComponent, {
      width: '700px',
      maxWidth: '96vw',
      data: { job }
    });
  }

  openLinkTaskModal() {
    const ref = this.dialog.open(LinkTaskDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      data: { customer: this.customer() }
    });

    ref.afterClosed().subscribe(res => {
      if (res?.linked || res?.created || res?.unlinked) {
        this.refreshLinkedTasks();
      }
    });
  }

  async unlinkWorkPlan(plan: WorkPlan) {
    if (!plan?.id) return;

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Unlink Task Directive',
        message: `Are you sure you want to remove the link between "${plan.title}" and ${this.customer().name}? The directive will remain in the system, but will no longer be associated with this citizen.`,
        confirmText: 'Unlink Task'
      }
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const updates: Partial<WorkPlan> = { customerId: '' };
      if (plan.ownerUid === this.customer().id) {
        updates.ownerUid = '';
        updates.ownerName = '';
      }
      await this.workPlanService.updateWorkPlan(plan.id, updates);
      this.linkedWorkPlans.update(plans => plans.filter(p => p.id !== plan.id));
      this.eventLog.logAction('UPDATED', 'Customers', `Unlinked directive "${plan.title}" from citizen ${this.customer().name}`);
      this.notif.success(`Task directive "${plan.title}" unlinked successfully`);
    } catch (err: any) {
      console.error('Error unlinking work plan directive', err);
      this.notif.error(err?.message || 'Failed to unlink directive');
    }
  }

  async unlinkLandJob(job: LandJob) {
    if (!job?.id) return;

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Unlink Land Task',
        message: `Are you sure you want to remove the link between Land Task "${job.jobRef}" and ${this.customer().name}? The task will remain in the cadastral registry, but will no longer be associated with this citizen.`,
        confirmText: 'Unlink Task'
      }
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.landService.updateLandJob(job.id, {
        customerId: '',
        customerNic: '',
        customerName: 'Unassigned',
        customerPhone: '',
        customerAddress: '',
        customerEmail: ''
      }, `Unlinked citizen ${this.customer().name} (NIC: ${this.customer().nic}) from job`);

      this.linkedJobs.update(jobs => jobs.filter(j => j.id !== job.id));
      this.eventLog.logAction('UPDATED', 'Customers', `Unlinked task ${job.jobRef} from citizen ${this.customer().name}`);
      this.notif.success(`Land task "${job.jobRef}" unlinked successfully`);
    } catch (err: any) {
      console.error('Error unlinking land task', err);
      this.notif.error(err?.message || 'Failed to unlink land task');
    }
  }

  refreshLinkedTasks() {
    const cId = this.customer().id;
    const cNic = this.customer().nic?.trim().toLowerCase();

    if (cId) {
      this.workPlanService.getWorkPlans().subscribe(plans => {
        this.linkedWorkPlans.set((plans || []).filter(p => p.customerId === cId));
      });
    }
    this.landService.getLandJobs().subscribe(jobs => {
      this.linkedJobs.set((jobs || []).filter(j => {
        if (cId && j.customerId === cId) return true;
        if (cNic && j.customerNic && j.customerNic.trim().toLowerCase() === cNic) return true;
        return false;
      }));
    });
  }

  close() {
    this.dialogRef.close();
  }
}
