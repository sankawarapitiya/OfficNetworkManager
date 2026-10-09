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

import { LandService } from '../../services/land.service';
import { LandJob, LandJobStatus, LandSettings, DEFAULT_LAND_SETTINGS } from '../../models/land.model';
import { LandJobDialogComponent } from '../../components/land-job-dialog/land-job-dialog.component';
import { LandJobDetailDialogComponent } from '../../components/land-job-detail-dialog/land-job-detail-dialog.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { RbacService } from '../../../../auth/rbac.service';
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
    MatTabsModule
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
            <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="e.g. LND-2026, Gunasekara, DEED-4829, Lot 12">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <!-- Division Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Division</mat-label>
            <mat-select [ngModel]="selectedDivision()" (ngModelChange)="selectedDivision.set($event)">
              <mat-option value="ALL">All Divisions</mat-option>
              <mat-option *ngFor="let div of availableDivisions()" [value]="div">
                {{ div }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Job Type Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Job Type</mat-label>
            <mat-select [ngModel]="selectedJobType()" (ngModelChange)="selectedJobType.set($event)">
              <mat-option value="ALL">All Job Types</mat-option>
              <mat-option *ngFor="let jt of settings().jobTypes" [value]="jt.id">
                {{ jt.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Priority Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Priority</mat-label>
            <mat-select [ngModel]="selectedPriority()" (ngModelChange)="selectedPriority.set($event)">
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

      <!-- Stage Tabs -->
      <div class="tabs-container">
        <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'ALL'" (click)="selectedStageTab.set('ALL')">
          All Tasks <span class="badge">{{ totalJobsCount() }}</span>
        </button>
        <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Initial'" (click)="selectedStageTab.set('Initial')">
          Stage 1: Initial <span class="badge">{{ stageCount('Initial') }}</span>
        </button>
        <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Documentation'" (click)="selectedStageTab.set('Documentation')">
          Stage 2: Documentation <span class="badge">{{ stageCount('Documentation') }}</span>
        </button>
        <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Verification'" (click)="selectedStageTab.set('Verification')">
          Stage 3: Verification <span class="badge">{{ stageCount('Verification') }}</span>
        </button>
        <button class="stage-tab-btn" [class.active]="selectedStageTab() === 'Completed'" (click)="selectedStageTab.set('Completed')">
          Stage 4: Completed <span class="badge">{{ stageCount('Completed') }}</span>
        </button>
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
                  <p>No matching land tasks found. Adjust your search keywords or filters.</p>
                </td>
              </tr>
              <tr *ngFor="let job of filteredJobs()" (click)="openDetailDialog(job)" class="clickable-row">
                <td>
                  <span class="font-mono font-bold text-slate-800">{{ job.jobRef }}</span>
                  <span class="block text-xs text-gray-500">{{ job.createdAt | date:'shortDate' }}</span>
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
                </td>
                <td>
                  <span class="jt-pill">{{ job.jobTypeName }}</span>
                </td>
                <td>
                  <div class="stage-flow-col">
                    <span class="stage-pill" [ngClass]="job.status.toLowerCase()">
                      {{ job.status }}
                    </span>
                    <span *ngIf="job.documents" class="text-xs text-gray-500 mt-1">
                      Docs: {{ getUploadedDocCount(job) }}/{{ job.documents.length }}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="priority-pill" [ngClass]="job.priority.toLowerCase()">
                    {{ job.priority }}
                  </span>
                </td>
                <td>
                  <div class="action-cell" (click)="$event.stopPropagation()">
                    <button mat-icon-button color="primary" (click)="openDetailDialog(job)" matTooltip="Inspect Dossier & Quick Actions">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button mat-icon-button (click)="openEditJobDialog(job)" matTooltip="Edit & Continue in 4-Stage Wizard">
                      <mat-icon>edit_document</mat-icon>
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
      }

      .empty-state-cell {
        text-align: center;
        padding: 50px;
        color: #94a3b8;
        mat-icon { font-size: 44px; width: 44px; height: 44px; }
      }
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
    }

    .jt-pill {
      font-size: 0.8rem;
      color: #334155;
    }

    .stage-flow-col {
      display: flex;
      flex-direction: column;
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
      font-size: 0.725rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      &.normal { background: #f1f5f9; color: #475569; }
      &.urgent { background: #ffedd5; color: #c2410c; }
      &.immediate { background: #fee2e2; color: #b91c1c; }
    }

    .action-cell {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `]
})
export class LandJobsComponent implements OnInit {
  private landService = inject(LandService);
  private rbacService = inject(RbacService);
  private notif = inject(NotificationService);
  private dialog = inject(MatDialog);
  private settingsService = inject(SettingsService);

  jobs = signal<LandJob[]>([]);
  settings = signal<LandSettings>(DEFAULT_LAND_SETTINGS);
  allDivisions = signal<Division[]>([]);

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

  searchQuery = signal<string>('');
  selectedDivision = signal<string>('ALL');
  selectedJobType = signal<string>('ALL');
  selectedPriority = signal<string>('ALL');
  selectedStageTab = signal<string>('ALL');

  totalJobsCount = computed(() => this.jobs().length);
  canDelete = computed(() => this.rbacService.isAdmin() || this.rbacService.isSuperAdmin());

  stageCount(stage: LandJobStatus): number {
    return this.jobs().filter(j => j.status === stage).length;
  }

  getUploadedDocCount(job: LandJob): number {
    return (job.documents || []).filter(d => d.status === 'Uploaded').length;
  }

  filteredJobs = computed(() => {
    let list = this.jobs();
    const query = this.searchQuery().toLowerCase().trim();
    const div = this.selectedDivision();
    const jt = this.selectedJobType();
    const prio = this.selectedPriority();
    const tab = this.selectedStageTab();

    if (tab !== 'ALL') {
      list = list.filter(j => j.status === tab);
    }
    if (div !== 'ALL') {
      list = list.filter(j => j.division === div);
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
        (j.customerName && j.customerName.toLowerCase().includes(query)) ||
        (j.customerNic && j.customerNic.toLowerCase().includes(query)) ||
        (j.deedNumber && j.deedNumber.toLowerCase().includes(query)) ||
        (j.planNumber && j.planNumber.toLowerCase().includes(query)) ||
        (j.lotNumber && j.lotNumber.toLowerCase().includes(query)) ||
        (j.division && j.division.toLowerCase().includes(query))
      );
    }

    return list;
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
    this.selectedJobType.set('ALL');
    this.selectedPriority.set('ALL');
    this.selectedStageTab.set('ALL');
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

  openEditJobDialog(job: LandJob) {
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
