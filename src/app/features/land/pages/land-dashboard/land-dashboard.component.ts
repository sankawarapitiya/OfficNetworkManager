import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LandService } from '../../services/land.service';
import { LandJob, LandJobStatus } from '../../models/land.model';
import { LandJobDialogComponent } from '../../components/land-job-dialog/land-job-dialog.component';
import { LandJobDetailDialogComponent } from '../../components/land-job-detail-dialog/land-job-detail-dialog.component';

@Component({
  selector: 'app-land-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container w-full">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Land Administration Dashboard</h1>
          <p class="page-desc">Cadastral parcel tracking, 4-stage job workflows, and divisional land statistics.</p>
        </div>
        <div class="actions-group">
          <button mat-flat-button color="primary" class="primary-btn" (click)="openCreateJobDialog()">
            <mat-icon>add</mat-icon> Register New Land Task
          </button>
        </div>
      </div>

      <!-- KPI 4-Stage Grid -->
      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap blue">
            <mat-icon>terrain</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Total Land Tasks</span>
            <span class="kpi-value">{{ totalCount() }}</span>
            <span class="kpi-sub">All active & completed filings</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap cyan">
            <mat-icon>flag</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Stage 1: Initial</span>
            <span class="kpi-value text-cyan">{{ initialCount() }}</span>
            <span class="kpi-sub">Customer & parcel setup</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap amber">
            <mat-icon>description</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Stage 2: Documentation</span>
            <span class="kpi-value text-amber">{{ docCount() }}</span>
            <span class="kpi-sub">Document checks & folios</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap purple">
            <mat-icon>fact_check</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Stage 3: Verification</span>
            <span class="kpi-value text-purple">{{ verifCount() }}</span>
            <span class="kpi-sub">Field inspection & survey</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap green">
            <mat-icon>task_alt</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Stage 4: Completed</span>
            <span class="kpi-value text-green">{{ completedCount() }}</span>
            <span class="kpi-sub">Endorsed & registered</span>
          </div>
        </mat-card>
      </div>

      <!-- Divisional & Job Type Breakdown Grids -->
      <div class="analytics-row">
        <!-- Division Load -->
        <mat-card class="analytics-card">
          <div class="card-header">
            <mat-icon class="sec-icon text-indigo">holiday_village</mat-icon>
            <div>
              <h3 class="card-title">Tasks by Administrative Division</h3>
              <p class="card-subtitle">Active distribution across jurisdictional boundaries</p>
            </div>
          </div>

          <div class="division-stats-list">
            <div *ngFor="let div of divisionStats()" class="division-stat-item">
              <div class="div-info-line">
                <span class="div-name">{{ div.name }}</span>
                <span class="div-badge">{{ div.count }} jobs</span>
              </div>
              <div class="stat-progress-bar">
                <div class="progress-fill" [style.width.%]="div.percentage"></div>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- Job Type Distribution -->
        <mat-card class="analytics-card">
          <div class="card-header">
            <mat-icon class="sec-icon text-teal">category</mat-icon>
            <div>
              <h3 class="card-title">Tasks by Job Type</h3>
              <p class="card-subtitle">Breakdown by cadastral service category</p>
            </div>
          </div>

          <div class="job-type-stats-list">
            <div *ngFor="let jt of jobTypeStats()" class="jt-stat-item">
              <div class="jt-stat-left">
                <span class="jt-bullet"></span>
                <span class="jt-title">{{ jt.name }}</span>
              </div>
              <span class="jt-count-tag">{{ jt.count }}</span>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Recent Land Tasks Table -->
      <mat-card class="recent-tasks-card">
        <div class="card-header flex-between">
          <div class="flex-align">
            <mat-icon class="sec-icon">history</mat-icon>
            <div>
              <h3 class="card-title">Recent Land Registrations & Filings</h3>
              <p class="card-subtitle">Most recently logged tasks across all 4 workflow stages</p>
            </div>
          </div>
          <a mat-button color="primary" routerLink="/land/jobs">
            View All Jobs <mat-icon>arrow_forward</mat-icon>
          </a>
        </div>

        <div class="table-container">
          <table class="modern-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer / Landowner</th>
                <th>Cadastral Parcel</th>
                <th>Division</th>
                <th>Job Type</th>
                <th>Current Stage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="jobs().length === 0">
                <td colspan="7" class="empty-state-cell">
                  <mat-icon>terrain</mat-icon>
                  <p>No land tasks registered yet. Click "Register New Land Task" to start.</p>
                </td>
              </tr>
              <tr *ngFor="let job of recentJobs()" (click)="openDetailDialog(job)" class="clickable-row">
                <td class="font-mono font-bold text-slate-800">{{ job.jobRef }}</td>
                <td>
                  <div class="cust-info">
                    <span class="font-semibold">{{ job.customerName }}</span>
                    <span class="text-xs text-gray-500">NIC: {{ job.customerNic }}</span>
                  </div>
                </td>
                <td>
                  <div class="parcel-info">
                    <span class="font-semibold">Lot {{ job.lotNumber }}</span>
                    <span class="text-xs text-gray-500">Deed: {{ job.deedNumber }}</span>
                  </div>
                </td>
                <td>
                  <span class="division-pill">{{ job.division }}</span>
                </td>
                <td>
                  <span class="jt-tag">{{ job.jobTypeName }}</span>
                </td>
                <td>
                  <span class="stage-pill" [ngClass]="job.status.toLowerCase()">
                    {{ job.status }}
                  </span>
                </td>
                <td>
                  <button mat-icon-button color="primary" (click)="$event.stopPropagation(); openDetailDialog(job)" matTooltip="Inspect Job">
                    <mat-icon>visibility</mat-icon>
                  </button>
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
      gap: 20px;
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

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }

      .kpi-card {
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }

      .kpi-icon-wrap {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon { font-size: 26px; width: 26px; height: 26px; }

        &.blue { background: #e0f2fe; color: #0284c7; }
        &.cyan { background: #cffafe; color: #0891b2; }
        &.amber { background: #fef3c7; color: #d97706; }
        &.purple { background: #fae8ff; color: #a21caf; }
        &.green { background: #dcfce7; color: #16a34a; }
      }

      .kpi-info {
        display: flex;
        flex-direction: column;

        .kpi-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; }
        .kpi-value { font-size: 1.5rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
        .kpi-sub { font-size: 0.75rem; color: #94a3b8; }
      }
    }

    .analytics-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .analytics-card {
      padding: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;

      .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;

        .card-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a; }
        .card-subtitle { margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b; }
      }
    }

    .division-stats-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .division-stat-item {
        .div-info-line {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          margin-bottom: 4px;
          .div-name { font-weight: 600; color: #1e293b; }
          .div-badge { color: #64748b; font-size: 0.8rem; }
        }
        .stat-progress-bar {
          height: 6px;
          background: #f1f5f9;
          border-radius: 3px;
          overflow: hidden;

          .progress-fill {
            height: 100%;
            background: #4f46e5;
            border-radius: 3px;
          }
        }
      }
    }

    .job-type-stats-list {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .jt-stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        border-radius: 8px;

        .jt-stat-left {
          display: flex;
          align-items: center;
          gap: 8px;

          .jt-bullet {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #0d9488;
          }
          .jt-title { font-size: 0.875rem; font-weight: 600; color: #1e293b; }
        }

        .jt-count-tag {
          background: #e2e8f0;
          color: #0f172a;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
        }
      }
    }

    .recent-tasks-card {
      padding: 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;

      .flex-between { display: flex; justify-content: space-between; align-items: center; }
      .flex-align { display: flex; align-items: center; gap: 10px; }
      .card-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a; }
      .card-subtitle { margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b; }
    }

    .table-container {
      overflow-x: auto;
      margin-top: 14px;
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
        padding: 10px 14px;
        border-bottom: 2px solid #e2e8f0;
        background: #f8fafc;
      }

      td {
        padding: 12px 14px;
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
        padding: 40px;
        color: #94a3b8;
        mat-icon { font-size: 40px; width: 40px; height: 40px; }
      }
    }

    .cust-info, .parcel-info {
      display: flex;
      flex-direction: column;
    }

    .division-pill {
      background: #f1f5f9;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
    }

    .jt-tag {
      font-size: 0.8rem;
      color: #475569;
    }

    .stage-pill {
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

    .text-cyan { color: #0891b2; }
    .text-amber { color: #d97706; }
    .text-purple { color: #a21caf; }
    .text-green { color: #16a34a; }
    .text-indigo { color: #4f46e5; }
    .text-teal { color: #0d9488; }
  `]
})
export class LandDashboardComponent implements OnInit {
  private landService = inject(LandService);
  private dialog = inject(MatDialog);

  jobs = signal<LandJob[]>([]);

  totalCount = computed(() => this.jobs().length);
  initialCount = computed(() => this.jobs().filter(j => j.status === 'Initial').length);
  docCount = computed(() => this.jobs().filter(j => j.status === 'Documentation').length);
  verifCount = computed(() => this.jobs().filter(j => j.status === 'Verification').length);
  completedCount = computed(() => this.jobs().filter(j => j.status === 'Completed').length);

  recentJobs = computed(() => this.jobs().slice(0, 8));

  divisionStats = computed(() => {
    const map = new Map<string, number>();
    for (const j of this.jobs()) {
      const d = j.division || 'Unknown';
      map.set(d, (map.get(d) || 0) + 1);
    }
    const total = this.totalCount() || 1;
    return Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: Math.min(100, Math.round((count / total) * 100))
    }));
  });

  jobTypeStats = computed(() => {
    const map = new Map<string, number>();
    for (const j of this.jobs()) {
      const t = j.jobTypeName || 'General';
      map.set(t, (map.get(t) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  });

  ngOnInit() {
    this.loadJobs();
  }

  loadJobs() {
    this.landService.getLandJobs().subscribe({
      next: (data) => this.jobs.set(data || []),
      error: (e) => console.error('Error fetching land jobs:', e)
    });
  }

  openCreateJobDialog() {
    const ref = this.dialog.open(LandJobDialogComponent, {
      width: '950px',
      disableClose: true
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.success) {
        this.loadJobs();
      }
    });
  }

  openDetailDialog(job: LandJob) {
    const ref = this.dialog.open(LandJobDetailDialogComponent, {
      width: '850px',
      data: { job }
    });
    ref.afterClosed().subscribe(() => {
      this.loadJobs();
    });
  }
}
