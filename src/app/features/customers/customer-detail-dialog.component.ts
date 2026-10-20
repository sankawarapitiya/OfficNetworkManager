import { Component, Inject, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Customer, CustomerService } from './services/customer.service';
import { LandJob, LandJobStatus } from '../land/models/land.model';
import { Division } from '../settings/settings.service';
import { LandJobDetailDialogComponent } from '../land/components/land-job-detail-dialog/land-job-detail-dialog.component';
import { LandJobDialogComponent } from '../land/components/land-job-dialog/land-job-dialog.component';
import { SendSmsDialogComponent } from '../land/components/send-sms-dialog/send-sms-dialog.component';
import { CustomerDialogComponent } from './customer-dialog.component';
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
            <span class="metric-desc">Total Land Tasks</span>
          </div>
          <div class="metric-separator"></div>
          <div class="metric-block active-block">
            <span class="metric-num">{{ inProgressTasks() }}</span>
            <span class="metric-desc">In Progress / Review</span>
          </div>
          <div class="metric-separator"></div>
          <div class="metric-block completed-block">
            <span class="metric-num">{{ completedTasks() }}</span>
            <span class="metric-desc">Completed & Certified</span>
          </div>
        </div>

        <!-- Section: Linked Land Management Tasks -->
        <div class="section-container">
          <div class="section-header">
            <div class="section-title-wrap">
              <div class="section-icon-box">
                <mat-icon>terrain</mat-icon>
              </div>
              <div>
                <h3 class="section-title">Linked Land Management Tasks</h3>
                <p class="section-desc">Cadastral filings, boundary survey jobs, and title verifications registered for this citizen.</p>
              </div>
            </div>
            <span class="tasks-count-pill">{{ linkedJobs().length }} Tasks Found</span>
          </div>

          <!-- Empty State when 0 linked jobs -->
          <div *ngIf="linkedJobs().length === 0" class="empty-tasks-card">
            <div class="empty-icon-wrap">
              <mat-icon>landscape</mat-icon>
            </div>
            <h4 class="empty-title">No Land Tasks Currently Linked</h4>
            <p class="empty-desc">This citizen does not have any active or historical cadastral tasks in the Land Management registry. Tasks can be registered and managed under the Land Management module.</p>
          </div>

          <!-- List of Linked Jobs -->
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialog Footer -->
      <div class="dossier-footer">
        <span class="footer-hint">
          <mat-icon class="hint-icon">verified_user</mat-icon>
          Customer and cadastral links are synchronized with the central Land Management registry.
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
      flex-wrap: wrap;
      gap: 16px;

      .profile-hero {
        display: flex;
        align-items: center;
        gap: 18px;

        .profile-avatar {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);
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
              font-size: 22px;
              font-weight: 700;
              color: var(--text-primary, #0f172a);
              margin: 0;
              letter-spacing: -0.02em;
            }

            .status-pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11.5px;
              font-weight: 600;

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

              .status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
              }
            }
          }

          .submeta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12.5px;
            color: var(--text-muted, #64748b);

            .nic-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 2px 8px;
              border-radius: 6px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              font-family: monospace;
              cursor: pointer;
              transition: all 0.15s ease;

              &:hover {
                background: #e2e8f0;
                color: #0f172a;
              }

              .nic-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
              .copy-icon { font-size: 12px; width: 12px; height: 12px; opacity: 0.7; }
            }

            .meta-separator { color: #cbd5e1; }

            .division-text {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              .mini-icon { font-size: 15px; width: 15px; height: 15px; color: #64748b; }
            }
          }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .action-btn {
          height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 13px;
        }

        .new-task-btn {
          background: #4f46e5;
          color: #ffffff;
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
          overflow: hidden;

          .info-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text-subtle, #94a3b8);
          }

          .info-value {
            font-size: 13.5px;
            font-weight: 600;
            color: var(--text-primary, #0f172a);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .address-value {
            white-space: normal;
            line-height: 1.35;
          }
        }
      }
    }

    /* Metrics Strip */
    .metrics-strip {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid var(--border-subtle, #e2e8f0);
      border-radius: 12px;
      padding: 14px 24px;

      .metric-block {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;

        .metric-num {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
        }

        .metric-desc {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
        }

        &.active-block .metric-num { color: #4f46e5; }
        &.completed-block .metric-num { color: #059669; }
      }

      .metric-separator {
        width: 1px;
        height: 38px;
        background: #e2e8f0;
      }
    }

    /* Tasks Section */
    .section-container {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

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

        .tasks-count-pill {
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid #c7d2fe;
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

                &.normal { background: #f1f5f9; color: #475569; }
                &.urgent { background: #fef3c7; color: #b45309; }
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
                &.completed { background: #dcfce7; color: #15803d; }
                &.rejected { background: #fee2e2; color: #b91c1c; }
                &.on\\ hold { background: #f1f5f9; color: #475569; }
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
                color: #0f172a;
              }

              .font-mono { font-family: monospace; }
              .gn-sub { color: #64748b; font-size: 11px; }
            }
          }

          .task-footer-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;

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
              .sms-task-btn {
                width: 32px;
                height: 32px;
                line-height: 32px;
                color: #0284c7;
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                mat-icon { font-size: 16px; width: 16px; height: 16px; }
                &:hover { background: #e0f2fe; }
              }

              .view-task-btn {
                height: 32px;
                font-size: 12px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                border-color: #cbd5e1;
              }

              .wizard-btn {
                width: 32px;
                height: 32px;
                line-height: 32px;
                color: #4f46e5;
                mat-icon { font-size: 18px; width: 18px; height: 18px; }
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
  private notif = inject(NotificationService);
  private eventLog = inject(EventLogService);

  public data: {
    customer: Customer;
    linkedJobs: LandJob[];
    divisions: Division[];
  } = inject(MAT_DIALOG_DATA);

  customer = signal<Customer>(this.data.customer);
  linkedJobs = signal<LandJob[]>(this.data.linkedJobs || []);
  divisions = signal<Division[]>(this.data.divisions || []);

  totalTasks = computed(() => this.linkedJobs().length);
  inProgressTasks = computed(() => this.linkedJobs().filter(j => j.status !== 'Completed' && j.status !== 'Rejected').length);
  completedTasks = computed(() => this.linkedJobs().filter(j => j.status === 'Completed').length);

  constructor() {}

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

  close() {
    this.dialogRef.close();
  }
}
