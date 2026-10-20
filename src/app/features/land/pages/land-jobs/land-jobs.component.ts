import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { LandService } from '../../services/land.service';
import { LandJob, LandJobStatus, LandSettings, DEFAULT_LAND_SETTINGS } from '../../models/land.model';
import { LandJobDialogComponent } from '../../components/land-job-dialog/land-job-dialog.component';
import { LandJobDetailDialogComponent } from '../../components/land-job-detail-dialog/land-job-detail-dialog.component';
import { SendSmsDialogComponent } from '../../components/send-sms-dialog/send-sms-dialog.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { RbacService } from '../../../../auth/rbac.service';
import { AuthService } from '../../../../auth/auth.service';
import { SettingsService, Division } from '../../../settings/settings.service';

@Component({
  selector: 'app-land-jobs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatTooltipModule,
    MatTabsModule,
    MatPaginatorModule
  ],
  template: `
    <div class="page-container w-full">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Land Tasks & Cadastral Registry</h1>
          <p class="page-desc">Comprehensive directory of land parcel filings, status stages, and field verifications.</p>
        </div>
        <div class="actions-group">
          <button mat-flat-button color="primary" class="primary-btn" (click)="openCreateJobDialog()">
            <mat-icon>add</mat-icon> Register New Land Task
          </button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <mat-card class="filter-card">
        <div class="filter-grid">
          <!-- Keyword Search -->
          <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
            <mat-label>Search Reference, Customer, NIC, Deed or Lot...</mat-label>
            <input matInput [ngModel]="searchQuery()" (ngModelChange)="onSearchQueryChange($event)" placeholder="e.g. LND-2026, Gunasekara, DEED-4829, Lot 12">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <!-- Division Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Division</mat-label>
            <mat-select [ngModel]="selectedDivision()" (ngModelChange)="onDivisionChange($event)">
              <mat-option value="ALL">All Divisions</mat-option>
              <mat-option *ngFor="let div of availableDivisions()" [value]="div">
                {{ div }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- GN Division Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>GN Division</mat-label>
            <mat-select [ngModel]="selectedGNDivision()" (ngModelChange)="onGNDivisionChange($event)">
              <mat-option value="ALL">All GN Divisions</mat-option>
              <mat-option *ngFor="let gn of availableGNDivisions()" [value]="gn">
                {{ gn }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Job Type Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Job Type</mat-label>
            <mat-select [ngModel]="selectedJobType()" (ngModelChange)="onJobTypeChange($event)">
              <mat-option value="ALL">All Job Types</mat-option>
              <mat-option *ngFor="let jt of settings().jobTypes" [value]="jt.id">
                {{ jt.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Priority Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Priority</mat-label>
            <mat-select [ngModel]="selectedPriority()" (ngModelChange)="onPriorityChange($event)">
              <mat-option value="ALL">All Priorities</mat-option>
              <mat-option value="Normal">Normal</mat-option>
              <mat-option value="Urgent">Urgent</mat-option>
              <mat-option value="Immediate">Immediate</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Reset Filter -->
          <button mat-icon-button (click)="resetFilters()" matTooltip="Reset Filters" class="reset-btn">
            <mat-icon>restart_alt</mat-icon>
          </button>
        </div>
      </mat-card>

      <!-- Stage Tabs & Quick Filters -->
      <div class="tabs-toolbar">
        <div class="tabs-container">
          <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'ALL'" (click)="setStageTab('ALL')">
            All Tasks <span class="badge">{{ totalJobsCount() }}</span>
          </button>
          <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Initial'" (click)="setStageTab('Initial')">
            Stage 1: Initial <span class="badge">{{ stageCount('Initial') }}</span>
          </button>
          <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Documentation'" (click)="setStageTab('Documentation')">
            Stage 2: Documentation <span class="badge">{{ stageCount('Documentation') }}</span>
          </button>
          <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Verification'" (click)="setStageTab('Verification')">
            Stage 3: Verification <span class="badge">{{ stageCount('Verification') }}</span>
          </button>
          <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Completed'" (click)="setStageTab('Completed')">
            Stage 4: Completed <span class="badge">{{ stageCount('Completed') }}</span>
          </button>
        </div>

        <div class="my-tasks-wrapper">
          <button class="my-tasks-toggle-btn" [class.active]="onlyMyTasks()" (click)="toggleMyTasks()"
                  [matTooltip]="onlyMyTasks() ? 'Showing tasks created by you (Click to view all tasks)' : 'Filter to show only tasks created by you'">
            <mat-icon class="my-tasks-icon">{{ onlyMyTasks() ? 'check_circle' : 'account_circle' }}</mat-icon>
            <span class="my-tasks-label">My Tasks</span>
            <span class="badge" [class.badge-active]="onlyMyTasks()">{{ myTasksCount() }}</span>
          </button>
        </div>
      </div>

      <!-- Main Data Table -->
      <mat-card class="table-card">
        <div class="table-container">
          <table class="modern-table">
            <thead>
              <tr>
                <th>Job Reference</th>
                <th>Customer / Landowner</th>
                <th>Cadastral Parcel</th>
                <th>Division</th>
                <th>Job Type</th>
                <th>Stage & Progress</th>
                <th>Priority</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="filteredJobs().length === 0">
                <td colspan="8" class="empty-state-cell">
                  <mat-icon>search_off</mat-icon>
                  <p *ngIf="!onlyMyTasks()">No matching land tasks found. Adjust your search keywords or filters.</p>
                  <div *ngIf="onlyMyTasks()" class="empty-my-tasks-hint">
                    <p>No land tasks created by you were found matching current filters.</p>
                    <button mat-stroked-button color="primary" (click)="toggleMyTasks()">Show All Officers' Tasks</button>
                  </div>
                </td>
              </tr>
              <tr *ngFor="let job of paginatedJobs()" (click)="openDetailDialog(job)" 
                  class="clickable-row"
                  [class.row-urgent]="isUrgent(job)">
                <td>
                  <div class="job-ref-wrapper">
                    <span class="font-mono font-bold text-slate-800">{{ job.jobRef }}</span>
                    <span *ngIf="isUrgent(job)" class="urgent-ref-tag" matTooltip="Urgent Attention Required">
                      <mat-icon class="flag-icon">flag</mat-icon> URGENT
                    </span>
                  </div>
                  <div *ngIf="job.fileNumber" class="file-num-pill-small" [matTooltip]="'File / Dossier No: ' + job.fileNumber">
                    <mat-icon>folder</mat-icon> {{ job.fileNumber }}
                  </div>
                  <span class="block text-xs text-gray-500 mt-0.5">
                    {{ job.createdAt | date:'shortDate' }}
                    <span *ngIf="isMyJob(job)" class="my-job-badge" matTooltip="Registered by you">• Mine</span>
                  </span>
                </td>
                <td>
                  <div class="cell-customer">
                    <span class="font-semibold text-slate-900">{{ job.customerName }}</span>
                    <span class="text-xs text-gray-500">NIC: {{ job.customerNic }}</span>
                    <span class="text-xs text-gray-500">{{ job.customerPhone }}</span>
                  </div>
                </td>
                <td>
                  <div class="cell-parcel">
                    <span class="font-semibold text-slate-800">Lot {{ job.lotNumber }}</span>
                    <span class="text-xs text-gray-600">Plan: {{ job.planNumber }}</span>
                    <span class="text-xs text-gray-500">Deed: {{ job.deedNumber }}</span>
                  </div>
                </td>
                <td>
                  <span class="division-badge">{{ job.division }}</span>
                  <div *ngIf="job.gramaNiladhariDivision" class="gn-division-text" [matTooltip]="'GN Division: ' + job.gramaNiladhariDivision">
                    GN: {{ job.gramaNiladhariDivision }}
                  </div>
                </td>
                <td>
                  <span class="jt-pill">{{ job.jobTypeName }}</span>
                </td>
                <td>
                  <div class="stage-flow-col">
                    <span class="stage-pill" [ngClass]="job.status.toLowerCase()">
                      {{ job.status }}
                    </span>
                    <div class="docs-count-wrap mt-1" [matTooltip]="getDocCountTooltip(job)">
                      <span class="docs-badge" 
                            [class.done]="getJobTotalDocCount(job) > 0 && getJobReceivedDocCount(job) >= getJobTotalDocCount(job)"
                            [class.partial]="getJobTotalDocCount(job) > 0 && getJobReceivedDocCount(job) > 0 && getJobReceivedDocCount(job) < getJobTotalDocCount(job)"
                            [class.none]="getJobTotalDocCount(job) > 0 && getJobReceivedDocCount(job) === 0"
                            [class.zero]="getJobTotalDocCount(job) === 0">
                        <mat-icon class="docs-badge-icon">
                          {{ getJobTotalDocCount(job) === 0 ? 'article' : (getJobReceivedDocCount(job) >= getJobTotalDocCount(job) ? 'task_alt' : (getJobReceivedDocCount(job) > 0 ? 'hourglass_top' : 'pending_actions')) }}
                        </mat-icon>
                        <span *ngIf="getJobTotalDocCount(job) > 0">Docs: {{ getJobReceivedDocCount(job) }}/{{ getJobTotalDocCount(job) }}</span>
                        <span *ngIf="getJobTotalDocCount(job) === 0">No docs req.</span>
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="priority-pill" [ngClass]="job.priority.toLowerCase()">
                    <mat-icon *ngIf="isUrgent(job)" class="priority-flag-icon">flag</mat-icon>
                    {{ job.priority }}
                  </span>
                </td>
                <td>
                  <div class="action-cell" (click)="$event.stopPropagation()">
                    <button mat-icon-button color="primary" (click)="openDetailDialog(job)" matTooltip="Inspect Dossier & Quick Actions">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button *ngIf="canEditJob(job)" mat-icon-button (click)="openEditJobDialog(job)" matTooltip="Edit & Continue in 4-Stage Wizard">
                      <mat-icon>edit_document</mat-icon>
                    </button>
                    <button *ngIf="!canEditJob(job)" mat-icon-button disabled class="locked-icon-btn" [matTooltip]="'Edit locked: Only an Administrator or ' + (job.createdBy || 'the creator') + ' can edit this job'">
                      <mat-icon>lock</mat-icon>
                    </button>
                    <button mat-icon-button class="sms-icon-btn" (click)="openSendSmsDialog(job)" [matTooltip]="job.customerPhone ? 'Send SMS to Citizen (' + job.customerPhone + ')' : 'Send SMS to Citizen'">
                      <mat-icon>sms</mat-icon>
                    </button>
                    <button *ngIf="canDelete()" mat-icon-button color="warn" (click)="deleteJob(job)" matTooltip="Delete Job">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <mat-paginator 
          [length]="filteredJobs().length" 
          [pageSize]="pageSize()" 
          [pageIndex]="pageIndex()"
          [pageSizeOptions]="[5, 10, 25, 50, 100]" 
          showFirstLastButtons
          aria-label="Select page of land tasks" 
          (page)="onPageChange($event)">
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .page-title {
        font-size: 1.5rem;
        font-weight: 800;
        margin: 0;
        color: #0f172a;
      }
      .page-desc {
        margin: 4px 0 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }
      .primary-btn {
        background: #0e7490 !important;
        color: #ffffff !important;
        font-weight: 600;
      }
    }

    .filter-card {
      padding: 14px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;

      .filter-grid {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;

        .search-field {
          flex: 1;
          min-width: 260px;
        }

        .compact-field {
          min-width: 170px;
        }

        .reset-btn {
          color: #64748b;
        }
      }
    }

    .tabs-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .tabs-container {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;

      .stage-tab-btn {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 6px 16px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.15s ease;

        &:hover { background: #f8fafc; }
        &.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;

          .badge {
            background: #ffffff;
            color: #0f172a;
          }
        }

        .badge {
          background: #f1f5f9;
          color: #475569;
          font-size: 0.725rem;
          padding: 2px 7px;
          border-radius: 10px;
          font-weight: 700;
        }
      }
    }

    .my-tasks-wrapper {
      display: flex;
      align-items: center;

      .my-tasks-toggle-btn {
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

        .my-tasks-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #0e7490;
        }

        &:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        &.active {
          background: #0e7490;
          color: #ffffff;
          border-color: #0e7490;
          box-shadow: 0 2px 4px rgba(14, 116, 144, 0.3);

          .my-tasks-icon {
            color: #ffffff;
          }

          .badge {
            background: #ffffff;
            color: #0e7490;
          }
        }

        .badge {
          background: #f1f5f9;
          color: #334155;
          font-size: 0.725rem;
          padding: 2px 7px;
          border-radius: 10px;
          font-weight: 700;
        }
      }
    }

    .table-card {
      padding: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }

    .table-container {
      overflow-x: auto;
    }

    .modern-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      th {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        padding: 12px 16px;
        border-bottom: 2px solid #e2e8f0;
        background: #f8fafc;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.875rem;
        vertical-align: middle;
      }

      .clickable-row {
        cursor: pointer;
        transition: background 0.15s ease;
        &:hover { background: #f8fafc; }

        &.row-urgent {
          background: #fff8f8;
          border-left: 4px solid #ef4444;

          &:hover {
            background: #fee2e2 !important;
          }
        }
      }

      .empty-state-cell {
        text-align: center;
        padding: 50px;
        color: #94a3b8;
        mat-icon { font-size: 44px; width: 44px; height: 44px; }

        .empty-my-tasks-hint {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
      }
    }

    .job-ref-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .urgent-ref-tag {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      letter-spacing: 0.04em;

      .flag-icon {
        font-size: 11px;
        width: 11px;
        height: 11px;
        color: #dc2626;
      }
    }

    .my-job-badge {
      display: inline-block;
      color: #0284c7;
      font-weight: 600;
      margin-left: 4px;
    }

    .cell-customer, .cell-parcel {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .division-badge {
      background: #f1f5f9;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      display: inline-block;
    }

    .file-num-pill-small {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.72rem;
      font-family: monospace;
      font-weight: 600;
      color: #0f766e;
      background: #f0fdfa;
      border: 1px solid #ccfbf1;
      padding: 1px 6px;
      border-radius: 4px;
      margin-top: 3px;
      width: fit-content;

      mat-icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
        color: #0d9488;
      }
    }

    .gn-division-text {
      font-size: 0.725rem;
      color: #64748b;
      margin-top: 3px;
      font-weight: 500;
    }

    .jt-pill {
      font-size: 0.8rem;
      color: #334155;
    }

    .stage-flow-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .docs-count-wrap {
      display: inline-flex;
      align-items: center;
    }

    .docs-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 10px;
      line-height: 1.35;
      cursor: default;

      .docs-badge-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }

      &.done {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #bbf7d0;
      }

      &.partial {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
      }

      &.none {
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }

      &.zero {
        background: #f8fafc;
        color: #94a3b8;
        border: 1px dashed #cbd5e1;
        font-weight: 500;
      }
    }

    .stage-pill {
      display: inline-block;
      width: fit-content;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;

      &.initial { background: #e0f2fe; color: #0284c7; }
      &.documentation { background: #fef3c7; color: #d97706; }
      &.verification { background: #fae8ff; color: #a21caf; }
      &.completed { background: #dcfce7; color: #16a34a; }
      &.rejected { background: #fee2e2; color: #dc2626; }
      &.on_hold { background: #f1f5f9; color: #64748b; }
    }

    .priority-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.725rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;

      &.normal {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
      }

      &.urgent {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #f87171;

        .priority-flag-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          color: #dc2626;
        }
      }

      &.immediate {
        background: #450a0a;
        color: #fecaca;
        border: 1px solid #991b1b;

        .priority-flag-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          color: #ef4444;
        }
      }
    }

    .action-cell {
      display: flex;
      align-items: center;
      gap: 4px;

      .locked-icon-btn {
        opacity: 0.45;
        cursor: not-allowed;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #94a3b8;
        }
      }

      .sms-icon-btn {
        color: #0284c7;
        &:hover {
          background: #e0f2fe;
        }
      }
    }

    mat-paginator {
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }
  `]
})
export class LandJobsComponent implements OnInit {
  private landService = inject(LandService);
  private rbacService = inject(RbacService);
  private authService = inject(AuthService);
  private notif = inject(NotificationService);
  private dialog = inject(MatDialog);
  private settingsService = inject(SettingsService);

  jobs = signal<LandJob[]>([]);
  settings = signal<LandSettings>(DEFAULT_LAND_SETTINGS);
  allDivisions = signal<Division[]>([]);

  onlyMyTasks = signal<boolean>(false);
  pageIndex = signal<number>(0);
  pageSize = signal<number>(10);

  availableDivisions = computed(() => {
    const divs = this.allDivisions();
    const set = new Set<string>();
    const enOnly = (s?: string) => {
      if (!s) return '';
      return s.replace(/[^\x20-\x7E]/g, '')
              .replace(/\//g, '')
              .replace(/(^[\s-]+|[\s-]+$)/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
    };

    for (const d of divs) {
      const ds = enOnly(d.divisionalSecretariat);
      if (ds) set.add(ds);
    }

    // Also include any divisions already present on existing jobs
    for (const j of this.jobs()) {
      if (j.division) set.add(j.division);
    }

    return Array.from(set).sort();
  });

  availableGNDivisions = computed(() => {
    const divs = this.allDivisions();
    const selectedDiv = this.selectedDivision();
    const set = new Set<string>();

    const enOnly = (s?: string) => {
      if (!s) return '';
      return s.replace(/[^\x20-\x7E]/g, '')
              .replace(/\//g, '')
              .replace(/(^[\s-]+|[\s-]+$)/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
    };

    // Gather from master divisions (filtered by selected DS division if one is chosen)
    for (const d of divs) {
      const ds = enOnly(d.divisionalSecretariat);
      if (selectedDiv === 'ALL' || ds === selectedDiv) {
        const val = d.gnCode ? `${d.gnCode} - ${d.name}` : d.name;
        if (val && val.trim()) {
          set.add(val.trim());
        }
      }
    }

    // Also include any GN divisions already present on existing jobs
    for (const j of this.jobs()) {
      if (j.gramaNiladhariDivision && j.gramaNiladhariDivision.trim()) {
        if (selectedDiv === 'ALL' || j.division === selectedDiv) {
          set.add(j.gramaNiladhariDivision.trim());
        }
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  searchQuery = signal<string>('');
  selectedDivision = signal<string>('ALL');
  selectedGNDivision = signal<string>('ALL');
  selectedJobType = signal<string>('ALL');
  selectedPriority = signal<string>('ALL');
  selectedStageTab = signal<string>('ALL');

  onSearchQueryChange(val: string) {
    this.searchQuery.set(val);
    this.pageIndex.set(0);
  }

  onDivisionChange(div: string) {
    this.selectedDivision.set(div);
    this.selectedGNDivision.set('ALL');
    this.pageIndex.set(0);
  }

  onGNDivisionChange(val: string) {
    this.selectedGNDivision.set(val);
    this.pageIndex.set(0);
  }

  onJobTypeChange(val: string) {
    this.selectedJobType.set(val);
    this.pageIndex.set(0);
  }

  onPriorityChange(val: string) {
    this.selectedPriority.set(val);
    this.pageIndex.set(0);
  }

  setStageTab(tab: string) {
    this.selectedStageTab.set(tab);
    this.pageIndex.set(0);
  }

  toggleMyTasks() {
    this.onlyMyTasks.update(v => !v);
    this.pageIndex.set(0);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  isUrgent(job: LandJob): boolean {
    const p = (job?.priority || '').toLowerCase();
    return p === 'urgent' || p === 'immediate';
  }

  isMyJob(job: LandJob): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;

    const curUid = (user.uid || '').trim().toLowerCase();
    const curEmail = (user.email || '').trim().toLowerCase();
    const curDisplayName = (user.displayName || '').trim().toLowerCase();
    const curEmailPrefix = curEmail ? curEmail.split('@')[0] : '';

    // 1. Check createdById (Firebase UID)
    if (job.createdById && curUid && job.createdById.trim().toLowerCase() === curUid) {
      return true;
    }
    // 2. Check createdByEmail
    if (job.createdByEmail && curEmail && job.createdByEmail.trim().toLowerCase() === curEmail) {
      return true;
    }
    // 3. Check createdBy string (may contain displayName, email, UID, or username prefix)
    if (job.createdBy) {
      const cb = job.createdBy.trim().toLowerCase();
      if (curUid && cb === curUid) return true;
      if (curEmail && cb === curEmail) return true;
      if (curDisplayName && cb === curDisplayName) return true;
      if (curEmailPrefix && (cb === curEmailPrefix || cb.includes(curEmailPrefix))) return true;
    }
    // 4. Check assignedOfficer
    if (job.assignedOfficer) {
      const ao = job.assignedOfficer.trim().toLowerCase();
      if (curDisplayName && (ao === curDisplayName || ao.includes(curDisplayName))) return true;
      if (curEmail && (ao === curEmail || ao.includes(curEmail))) return true;
      if (curEmailPrefix && (ao === curEmailPrefix || ao.includes(curEmailPrefix))) return true;
    }
    return false;
  }

  myTasksCount = computed(() => {
    return this.jobs().filter(j => this.isMyJob(j)).length;
  });

  totalJobsCount = computed(() => this.jobs().length);
  canDelete = computed(() => this.rbacService.isAdmin() || this.rbacService.isSuperAdmin());

  stageCount(stage: LandJobStatus): number {
    return this.jobs().filter(j => j.status === stage).length;
  }

  isDocCompleted(doc: any): boolean {
    if (!doc) return false;
    return !!(
      doc.received === true ||
      doc.status === 'Uploaded' ||
      doc.status === 'Verified' ||
      doc.status === 'Exempted' ||
      doc.fileName ||
      doc.fileUrl
    );
  }

  getJobTotalDocCount(job: LandJob): number {
    if (job.documents && job.documents.length > 0) {
      return job.documents.length;
    }
    // Fallback if documents array was not initialized at creation: check configured job type
    const jtId = job.jobTypeId;
    const jtName = job.jobTypeName;
    const allJt = this.settings()?.jobTypes || [];
    const matched = allJt.find(j => (jtId && j.id === jtId) || (jtName && j.name === jtName));
    if (matched && matched.requiredDocumentTypes) {
      return matched.requiredDocumentTypes.length;
    }
    return 0;
  }

  getJobReceivedDocCount(job: LandJob): number {
    const total = this.getJobTotalDocCount(job);
    if (total === 0) return 0;

    // Completed jobs have their documentation finalized
    if (job.status === 'Completed') {
      return total;
    }

    if (!job.documents || job.documents.length === 0) {
      return 0;
    }

    return job.documents.filter(d => this.isDocCompleted(d)).length;
  }

  getDocCountTooltip(job: LandJob): string {
    const total = this.getJobTotalDocCount(job);
    const received = this.getJobReceivedDocCount(job);
    if (total === 0) return 'No mandatory documents required for this job type';
    if (received >= total) return `All ${total} documents verified & received`;
    return `${received} of ${total} documents received/verified`;
  }

  getUploadedDocCount(job: LandJob): number {
    return this.getJobReceivedDocCount(job);
  }

  filteredJobs = computed(() => {
    let list = this.jobs();
    const query = this.searchQuery().toLowerCase().trim();
    const div = this.selectedDivision();
    const gn = this.selectedGNDivision();
    const jt = this.selectedJobType();
    const prio = this.selectedPriority();
    const tab = this.selectedStageTab();
    const myOnly = this.onlyMyTasks();

    if (myOnly) {
      list = list.filter(j => this.isMyJob(j));
    }
    if (tab !== 'ALL') {
      list = list.filter(j => j.status === tab);
    }
    if (div !== 'ALL') {
      list = list.filter(j => j.division === div);
    }
    if (gn !== 'ALL') {
      list = list.filter(j => {
        if (!j.gramaNiladhariDivision) return false;
        const jGn = j.gramaNiladhariDivision.toLowerCase().trim();
        const filterGn = gn.toLowerCase().trim();
        return jGn === filterGn || jGn.includes(filterGn) || filterGn.includes(jGn);
      });
    }
    if (jt !== 'ALL') {
      list = list.filter(j => j.jobTypeId === jt);
    }
    if (prio !== 'ALL') {
      list = list.filter(j => j.priority === prio);
    }
    if (query) {
      list = list.filter(j => 
        (j.jobRef && j.jobRef.toLowerCase().includes(query)) ||
        (j.fileNumber && j.fileNumber.toLowerCase().includes(query)) ||
        (j.customerName && j.customerName.toLowerCase().includes(query)) ||
        (j.customerNic && j.customerNic.toLowerCase().includes(query)) ||
        (j.deedNumber && j.deedNumber.toLowerCase().includes(query)) ||
        (j.planNumber && j.planNumber.toLowerCase().includes(query)) ||
        (j.lotNumber && j.lotNumber.toLowerCase().includes(query)) ||
        (j.division && j.division.toLowerCase().includes(query)) ||
        (j.gramaNiladhariDivision && j.gramaNiladhariDivision.toLowerCase().includes(query))
      );
    }

    return list;
  });

  paginatedJobs = computed(() => {
    const total = this.filteredJobs().length;
    let idx = this.pageIndex();
    const size = this.pageSize();
    if (idx * size >= total && total > 0) {
      idx = Math.floor((total - 1) / size);
    }
    const start = idx * size;
    return this.filteredJobs().slice(start, start + size);
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.landService.getSettings().subscribe({
      next: (s) => this.settings.set(s)
    });

    this.landService.getLandJobs().subscribe({
      next: (data) => this.jobs.set(data || [])
    });

    this.settingsService.getDivisions().subscribe({
      next: (divs) => this.allDivisions.set(divs || [])
    });
  }

  resetFilters() {
    this.searchQuery.set('');
    this.selectedDivision.set('ALL');
    this.selectedGNDivision.set('ALL');
    this.selectedJobType.set('ALL');
    this.selectedPriority.set('ALL');
    this.selectedStageTab.set('ALL');
    this.onlyMyTasks.set(false);
    this.pageIndex.set(0);
  }

  openCreateJobDialog() {
    const ref = this.dialog.open(LandJobDialogComponent, {
      width: '950px',
      disableClose: true
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.success) {
        this.loadData();
      }
    });
  }

  openDetailDialog(job: LandJob) {
    const ref = this.dialog.open(LandJobDetailDialogComponent, {
      width: '850px',
      data: { job }
    });
    ref.afterClosed().subscribe(() => {
      this.loadData();
    });
  }

  openSendSmsDialog(job: LandJob) {
    this.dialog.open(SendSmsDialogComponent, {
      width: '700px',
      maxWidth: '96vw',
      data: { job }
    });
  }

  canEditJob(job: LandJob): boolean {
    return this.landService.canEditJob(job);
  }

  openEditJobDialog(job: LandJob) {
    if (!this.canEditJob(job)) {
      this.notif.warning(`Permission denied: Only an Administrator or the officer who registered this task (${job.createdBy || 'the creator'}) can edit this job.`);
      return;
    }
    const ref = this.dialog.open(LandJobDialogComponent, {
      width: '960px',
      disableClose: true,
      data: { existingJob: job }
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.success) {
        this.loadData();
      }
    });
  }

  async deleteJob(job: LandJob) {
    if (!confirm(`Are you sure you want to delete land job ${job.jobRef} (${job.customerName})? This action will be audited.`)) {
      return;
    }

    try {
      await this.landService.deleteLandJob(job);
      this.notif.success(`Land job ${job.jobRef} deleted successfully`);
      this.loadData();
    } catch (e: any) {
      this.notif.error('Failed to delete land job: ' + (e?.message || 'Server error'));
    }
  }
}
