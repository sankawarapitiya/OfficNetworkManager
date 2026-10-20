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

export interface StageCounts {
  initial: number;
  documentation: number;
  verification: number;
  completed: number;
  rejected: number;
  onHold: number;
}

export interface GNDivisionStat {
  name: string;
  count: number;
  stages: StageCounts;
}

export interface DSDivisionStat {
  name: string;
  count: number;
  percentage: number;
  stages: StageCounts;
  gnDivisions: GNDivisionStat[];
}

export interface GNDivisionWithParentStat {
  name: string;
  dsName: string;
  count: number;
  stages: StageCounts;
}

export interface JobTypeStat {
  name: string;
  count: number;
  stages: StageCounts;
}

function initStageCounts(): StageCounts {
  return { initial: 0, documentation: 0, verification: 0, completed: 0, rejected: 0, onHold: 0 };
}

function incrementStage(counts: StageCounts, status: LandJobStatus | string | undefined) {
  switch (status) {
    case 'Initial':
      counts.initial++;
      break;
    case 'Documentation':
      counts.documentation++;
      break;
    case 'Verification':
      counts.verification++;
      break;
    case 'Completed':
      counts.completed++;
      break;
    case 'Rejected':
      counts.rejected++;
      break;
    case 'On Hold':
      counts.onHold++;
      break;
    default:
      counts.initial++;
      break;
  }
}

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
        <!-- Division Load (DS & GN Divisions with Stages) -->
        <mat-card class="analytics-card">
          <div class="card-header flex-between">
            <div class="flex-align">
              <mat-icon class="sec-icon text-indigo">holiday_village</mat-icon>
              <div>
                <h3 class="card-title">Tasks by Administrative Division</h3>
                <p class="card-subtitle">DS & GN Division distribution with stage progress</p>
              </div>
            </div>
            <div class="view-toggle-group">
              <button type="button" 
                class="view-toggle-btn" 
                [class.active]="divisionViewMode() === 'DS'" 
                (click)="setDivisionViewMode('DS')">
                DS Division
              </button>
              <button type="button" 
                class="view-toggle-btn" 
                [class.active]="divisionViewMode() === 'GN'" 
                (click)="setDivisionViewMode('GN')">
                All GN Divisions
              </button>
            </div>
          </div>

          <!-- By DS Division View with nested GN divisions -->
          <div class="division-stats-list" *ngIf="divisionViewMode() === 'DS'">
            <div *ngIf="dsDivisionStats().length === 0" class="empty-state-text">
              No division records logged yet.
            </div>

            <div *ngFor="let ds of dsDivisionStats()" class="ds-stat-card">
              <div class="ds-info-line" (click)="toggleDsExpand(ds.name)">
                <div class="ds-left">
                  <mat-icon class="ds-icon">apartment</mat-icon>
                  <span class="ds-name">{{ ds.name }}</span>
                  <span class="ds-badge">{{ ds.count }} {{ ds.count === 1 ? 'job' : 'jobs' }}</span>
                  <span class="ds-pct">({{ ds.percentage }}%)</span>
                </div>
                <div class="ds-right">
                  <span class="gn-count-tag" matTooltip="Click to expand/collapse GN Divisions">
                    {{ ds.gnDivisions.length }} GN {{ ds.gnDivisions.length === 1 ? 'Area' : 'Areas' }}
                    <mat-icon class="toggle-icon">{{ isDsExpanded(ds.name) ? 'expand_less' : 'expand_more' }}</mat-icon>
                  </span>
                </div>
              </div>

              <!-- DS Division Current Stage Breakdown -->
              <div class="stage-breakdown-row">
                <span class="mini-stage-chip initial" matTooltip="Stage 1: Initial">
                  <span class="chip-label">Init:</span>
                  <strong>{{ ds.stages.initial }}</strong>
                </span>
                <span class="mini-stage-chip documentation" matTooltip="Stage 2: Documentation">
                  <span class="chip-label">Doc:</span>
                  <strong>{{ ds.stages.documentation }}</strong>
                </span>
                <span class="mini-stage-chip verification" matTooltip="Stage 3: Verification">
                  <span class="chip-label">Verif:</span>
                  <strong>{{ ds.stages.verification }}</strong>
                </span>
                <span class="mini-stage-chip completed" matTooltip="Stage 4: Completed">
                  <span class="chip-label">Done:</span>
                  <strong>{{ ds.stages.completed }}</strong>
                </span>
                <span *ngIf="ds.stages.rejected > 0" class="mini-stage-chip rejected" matTooltip="Rejected">
                  <span class="chip-label">Rej:</span>
                  <strong>{{ ds.stages.rejected }}</strong>
                </span>
                <span *ngIf="ds.stages.onHold > 0" class="mini-stage-chip on_hold" matTooltip="On Hold">
                  <span class="chip-label">Hold:</span>
                  <strong>{{ ds.stages.onHold }}</strong>
                </span>
              </div>

              <!-- Multi-stage progress bar -->
              <div class="multi-progress-bar" *ngIf="ds.count > 0">
                <div class="bar-seg initial" [style.width.%]="(ds.stages.initial / ds.count) * 100" [matTooltip]="'Initial: ' + ds.stages.initial"></div>
                <div class="bar-seg documentation" [style.width.%]="(ds.stages.documentation / ds.count) * 100" [matTooltip]="'Documentation: ' + ds.stages.documentation"></div>
                <div class="bar-seg verification" [style.width.%]="(ds.stages.verification / ds.count) * 100" [matTooltip]="'Verification: ' + ds.stages.verification"></div>
                <div class="bar-seg completed" [style.width.%]="(ds.stages.completed / ds.count) * 100" [matTooltip]="'Completed: ' + ds.stages.completed"></div>
                <div class="bar-seg rejected" [style.width.%]="(ds.stages.rejected / ds.count) * 100" [matTooltip]="'Rejected: ' + ds.stages.rejected"></div>
                <div class="bar-seg on_hold" [style.width.%]="(ds.stages.onHold / ds.count) * 100" [matTooltip]="'On Hold: ' + ds.stages.onHold"></div>
              </div>

              <!-- Nested GN Divisions -->
              <div class="gn-sublist-container" *ngIf="isDsExpanded(ds.name)">
                <div *ngIf="ds.gnDivisions.length === 0" class="gn-empty-text">
                  No GN divisions recorded for {{ ds.name }}
                </div>
                <div *ngFor="let gn of ds.gnDivisions" class="gn-subitem-card">
                  <div class="gn-head-row">
                    <div class="gn-left">
                      <mat-icon class="gn-branch-icon">subdirectory_arrow_right</mat-icon>
                      <span class="gn-title">{{ gn.name }}</span>
                    </div>
                    <span class="gn-jobs-count">{{ gn.count }} {{ gn.count === 1 ? 'job' : 'jobs' }}</span>
                  </div>

                  <div class="stage-breakdown-row sub">
                    <span class="mini-stage-chip sm initial">Init: <strong>{{ gn.stages.initial }}</strong></span>
                    <span class="mini-stage-chip sm documentation">Doc: <strong>{{ gn.stages.documentation }}</strong></span>
                    <span class="mini-stage-chip sm verification">Verif: <strong>{{ gn.stages.verification }}</strong></span>
                    <span class="mini-stage-chip sm completed">Done: <strong>{{ gn.stages.completed }}</strong></span>
                    <span *ngIf="gn.stages.rejected > 0" class="mini-stage-chip sm rejected">Rej: <strong>{{ gn.stages.rejected }}</strong></span>
                    <span *ngIf="gn.stages.onHold > 0" class="mini-stage-chip sm on_hold">Hold: <strong>{{ gn.stages.onHold }}</strong></span>
                  </div>

                  <div class="multi-progress-bar sm" *ngIf="gn.count > 0">
                    <div class="bar-seg initial" [style.width.%]="(gn.stages.initial / gn.count) * 100"></div>
                    <div class="bar-seg documentation" [style.width.%]="(gn.stages.documentation / gn.count) * 100"></div>
                    <div class="bar-seg verification" [style.width.%]="(gn.stages.verification / gn.count) * 100"></div>
                    <div class="bar-seg completed" [style.width.%]="(gn.stages.completed / gn.count) * 100"></div>
                    <div class="bar-seg rejected" [style.width.%]="(gn.stages.rejected / gn.count) * 100"></div>
                    <div class="bar-seg on_hold" [style.width.%]="(gn.stages.onHold / gn.count) * 100"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- All GN Divisions Flat View -->
          <div class="all-gn-list" *ngIf="divisionViewMode() === 'GN'">
            <div *ngIf="allGNDivisionStats().length === 0" class="empty-state-text">
              No GN division records found.
            </div>
            <div *ngFor="let gn of allGNDivisionStats()" class="gn-flat-card">
              <div class="gn-head-row">
                <div class="gn-left">
                  <mat-icon class="gn-flat-icon">place</mat-icon>
                  <div>
                    <span class="gn-title">{{ gn.name }}</span>
                    <span class="gn-parent-tag">{{ gn.dsName }}</span>
                  </div>
                </div>
                <span class="gn-jobs-count">{{ gn.count }} {{ gn.count === 1 ? 'job' : 'jobs' }}</span>
              </div>

              <div class="stage-breakdown-row">
                <span class="mini-stage-chip initial">Init: <strong>{{ gn.stages.initial }}</strong></span>
                <span class="mini-stage-chip documentation">Doc: <strong>{{ gn.stages.documentation }}</strong></span>
                <span class="mini-stage-chip verification">Verif: <strong>{{ gn.stages.verification }}</strong></span>
                <span class="mini-stage-chip completed">Done: <strong>{{ gn.stages.completed }}</strong></span>
                <span *ngIf="gn.stages.rejected > 0" class="mini-stage-chip rejected">Rej: <strong>{{ gn.stages.rejected }}</strong></span>
                <span *ngIf="gn.stages.onHold > 0" class="mini-stage-chip on_hold">Hold: <strong>{{ gn.stages.onHold }}</strong></span>
              </div>

              <div class="multi-progress-bar" *ngIf="gn.count > 0">
                <div class="bar-seg initial" [style.width.%]="(gn.stages.initial / gn.count) * 100"></div>
                <div class="bar-seg documentation" [style.width.%]="(gn.stages.documentation / gn.count) * 100"></div>
                <div class="bar-seg verification" [style.width.%]="(gn.stages.verification / gn.count) * 100"></div>
                <div class="bar-seg completed" [style.width.%]="(gn.stages.completed / gn.count) * 100"></div>
                <div class="bar-seg rejected" [style.width.%]="(gn.stages.rejected / gn.count) * 100"></div>
                <div class="bar-seg on_hold" [style.width.%]="(gn.stages.onHold / gn.count) * 100"></div>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- Tasks by Job Type with Current Stage Counts -->
        <mat-card class="analytics-card">
          <div class="card-header">
            <mat-icon class="sec-icon text-teal">category</mat-icon>
            <div>
              <h3 class="card-title">Tasks by Job Type</h3>
              <p class="card-subtitle">Cadastral service categories with current stage breakdown</p>
            </div>
          </div>

          <div class="job-type-stats-list">
            <div *ngIf="jobTypeStats().length === 0" class="empty-state-text">
              No job types logged yet.
            </div>

            <div *ngFor="let jt of jobTypeStats()" class="jt-stat-card">
              <div class="jt-header-row">
                <div class="jt-stat-left">
                  <span class="jt-bullet"></span>
                  <span class="jt-title">{{ jt.name }}</span>
                </div>
                <span class="jt-count-tag">{{ jt.count }} {{ jt.count === 1 ? 'task' : 'tasks' }}</span>
              </div>

              <!-- Current stage count breakdown under job type -->
              <div class="stage-breakdown-row">
                <span class="mini-stage-chip initial" matTooltip="Stage 1: Initial">
                  <span class="chip-label">Init:</span>
                  <strong>{{ jt.stages.initial }}</strong>
                </span>
                <span class="mini-stage-chip documentation" matTooltip="Stage 2: Documentation">
                  <span class="chip-label">Doc:</span>
                  <strong>{{ jt.stages.documentation }}</strong>
                </span>
                <span class="mini-stage-chip verification" matTooltip="Stage 3: Verification">
                  <span class="chip-label">Verif:</span>
                  <strong>{{ jt.stages.verification }}</strong>
                </span>
                <span class="mini-stage-chip completed" matTooltip="Stage 4: Completed">
                  <span class="chip-label">Done:</span>
                  <strong>{{ jt.stages.completed }}</strong>
                </span>
                <span *ngIf="jt.stages.rejected > 0" class="mini-stage-chip rejected" matTooltip="Rejected">
                  <span class="chip-label">Rej:</span>
                  <strong>{{ jt.stages.rejected }}</strong>
                </span>
                <span *ngIf="jt.stages.onHold > 0" class="mini-stage-chip on_hold" matTooltip="On Hold">
                  <span class="chip-label">Hold:</span>
                  <strong>{{ jt.stages.onHold }}</strong>
                </span>
              </div>

              <!-- Multi-stage progress bar -->
              <div class="multi-progress-bar" *ngIf="jt.count > 0">
                <div class="bar-seg initial" [style.width.%]="(jt.stages.initial / jt.count) * 100" [matTooltip]="'Initial: ' + jt.stages.initial"></div>
                <div class="bar-seg documentation" [style.width.%]="(jt.stages.documentation / jt.count) * 100" [matTooltip]="'Documentation: ' + jt.stages.documentation"></div>
                <div class="bar-seg verification" [style.width.%]="(jt.stages.verification / jt.count) * 100" [matTooltip]="'Verification: ' + jt.stages.verification"></div>
                <div class="bar-seg completed" [style.width.%]="(jt.stages.completed / jt.count) * 100" [matTooltip]="'Completed: ' + jt.stages.completed"></div>
                <div class="bar-seg rejected" [style.width.%]="(jt.stages.rejected / jt.count) * 100" [matTooltip]="'Rejected: ' + jt.stages.rejected"></div>
                <div class="bar-seg on_hold" [style.width.%]="(jt.stages.onHold / jt.count) * 100" [matTooltip]="'On Hold: ' + jt.stages.onHold"></div>
              </div>
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
      align-items: start;

      @media (max-width: 1024px) {
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

        &.flex-between {
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .card-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a; }
        .card-subtitle { margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b; }
      }
    }

    .view-toggle-group {
      display: inline-flex;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 3px;
      border: 1px solid #e2e8f0;

      .view-toggle-btn {
        background: transparent;
        border: none;
        outline: none;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          color: #0f172a;
        }

        &.active {
          background: #ffffff;
          color: #0e7490;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }
      }
    }

    .empty-state-text {
      text-align: center;
      padding: 24px;
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .division-stats-list, .all-gn-list, .job-type-stats-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .ds-stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      transition: border-color 0.15s ease;

      &:hover {
        border-color: #cbd5e1;
      }

      .ds-info-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;

        .ds-left {
          display: flex;
          align-items: center;
          gap: 8px;

          .ds-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #4f46e5;
          }

          .ds-name {
            font-weight: 700;
            font-size: 0.9rem;
            color: #1e293b;
          }

          .ds-badge {
            background: #e0e7ff;
            color: #3730a3;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
          }

          .ds-pct {
            font-size: 0.75rem;
            color: #94a3b8;
          }
        }

        .ds-right {
          .gn-count-tag {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            font-size: 0.75rem;
            color: #0e7490;
            font-weight: 600;
            background: #e0f2fe;
            padding: 3px 8px;
            border-radius: 6px;

            .toggle-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
            }
          }
        }
      }
    }

    .gn-sublist-container {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .gn-empty-text {
        font-size: 0.75rem;
        color: #94a3b8;
        font-style: italic;
        padding-left: 24px;
      }

      .gn-subitem-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 10px;
        margin-left: 12px;

        .gn-head-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .gn-left {
            display: flex;
            align-items: center;
            gap: 4px;

            .gn-branch-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #94a3b8;
            }

            .gn-title {
              font-size: 0.8rem;
              font-weight: 600;
              color: #334155;
            }
          }

          .gn-jobs-count {
            font-size: 0.72rem;
            font-weight: 700;
            color: #475569;
            background: #f1f5f9;
            padding: 1px 6px;
            border-radius: 8px;
          }
        }
      }
    }

    .gn-flat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;

      .gn-head-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .gn-left {
          display: flex;
          align-items: center;
          gap: 8px;

          .gn-flat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #0e7490;
          }

          .gn-title {
            font-weight: 700;
            font-size: 0.875rem;
            color: #1e293b;
          }

          .gn-parent-tag {
            margin-left: 8px;
            font-size: 0.72rem;
            background: #e2e8f0;
            color: #475569;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 500;
          }
        }

        .gn-jobs-count {
          font-size: 0.75rem;
          font-weight: 700;
          color: #0f172a;
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 10px;
        }
      }
    }

    .jt-stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .jt-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

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
          .jt-title {
            font-size: 0.875rem;
            font-weight: 700;
            color: #1e293b;
          }
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

    .stage-breakdown-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;

      &.sub {
        margin-top: 6px;
        gap: 4px;
      }
    }

    .mini-stage-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      padding: 2px 7px;
      border-radius: 6px;
      border: 1px solid transparent;
      line-height: 1.2;

      .chip-label {
        font-weight: 500;
        opacity: 0.85;
      }

      strong {
        font-weight: 800;
      }

      &.sm {
        font-size: 0.68rem;
        padding: 1px 5px;
      }

      &.initial {
        background: #e0f2fe;
        color: #0369a1;
        border-color: #bae6fd;
      }
      &.documentation {
        background: #fef3c7;
        color: #b45309;
        border-color: #fde68a;
      }
      &.verification {
        background: #fae8ff;
        color: #86198f;
        border-color: #f5d0fe;
      }
      &.completed {
        background: #dcfce7;
        color: #15803d;
        border-color: #bbf7d0;
      }
      &.rejected {
        background: #fee2e2;
        color: #b91c1c;
        border-color: #fecaca;
      }
      &.on_hold {
        background: #f1f5f9;
        color: #475569;
        border-color: #e2e8f0;
      }
    }

    .multi-progress-bar {
      display: flex;
      height: 6px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
      width: 100%;

      &.sm {
        height: 4px;
        margin-top: 6px;
      }

      .bar-seg {
        height: 100%;
        transition: width 0.25s ease;

        &.initial { background: #06b6d4; }
        &.documentation { background: #f59e0b; }
        &.verification { background: #c026d3; }
        &.completed { background: #16a34a; }
        &.rejected { background: #dc2626; }
        &.on_hold { background: #94a3b8; }
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
  expandedDsMap = signal<Record<string, boolean>>({});
  divisionViewMode = signal<'DS' | 'GN'>('DS');

  totalCount = computed(() => this.jobs().length);
  initialCount = computed(() => this.jobs().filter(j => j.status === 'Initial').length);
  docCount = computed(() => this.jobs().filter(j => j.status === 'Documentation').length);
  verifCount = computed(() => this.jobs().filter(j => j.status === 'Verification').length);
  completedCount = computed(() => this.jobs().filter(j => j.status === 'Completed').length);

  recentJobs = computed(() => this.jobs().slice(0, 8));

  isDsExpanded(name: string): boolean {
    const map = this.expandedDsMap();
    return map[name] !== undefined ? map[name] : true;
  }

  toggleDsExpand(name: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const current = this.isDsExpanded(name);
    this.expandedDsMap.update(m => ({ ...m, [name]: !current }));
  }

  setDivisionViewMode(mode: 'DS' | 'GN') {
    this.divisionViewMode.set(mode);
  }

  dsDivisionStats = computed<DSDivisionStat[]>(() => {
    const total = this.totalCount() || 1;
    const dsMap = new Map<string, {
      name: string;
      count: number;
      stages: StageCounts;
      gnMap: Map<string, { name: string; count: number; stages: StageCounts }>;
    }>();

    for (const j of this.jobs()) {
      const dsName = j.division?.trim() || 'Unassigned DS';
      const gnName = j.gramaNiladhariDivision?.trim() || 'Unassigned GN';

      if (!dsMap.has(dsName)) {
        dsMap.set(dsName, {
          name: dsName,
          count: 0,
          stages: initStageCounts(),
          gnMap: new Map()
        });
      }

      const dsItem = dsMap.get(dsName)!;
      dsItem.count++;
      incrementStage(dsItem.stages, j.status);

      if (!dsItem.gnMap.has(gnName)) {
        dsItem.gnMap.set(gnName, {
          name: gnName,
          count: 0,
          stages: initStageCounts()
        });
      }
      const gnItem = dsItem.gnMap.get(gnName)!;
      gnItem.count++;
      incrementStage(gnItem.stages, j.status);
    }

    return Array.from(dsMap.values())
      .map(ds => ({
        name: ds.name,
        count: ds.count,
        percentage: Math.min(100, Math.round((ds.count / total) * 100)),
        stages: ds.stages,
        gnDivisions: Array.from(ds.gnMap.values()).sort((a, b) => b.count - a.count)
      }))
      .sort((a, b) => b.count - a.count);
  });

  // Alias for backward compatibility
  divisionStats = computed(() => this.dsDivisionStats());

  allGNDivisionStats = computed<GNDivisionWithParentStat[]>(() => {
    const map = new Map<string, { name: string; dsName: string; count: number; stages: StageCounts }>();
    for (const j of this.jobs()) {
      const dsName = j.division?.trim() || 'Unassigned DS';
      const gnName = j.gramaNiladhariDivision?.trim() || 'Unassigned GN';
      const key = `${dsName}:::${gnName}`;

      if (!map.has(key)) {
        map.set(key, { name: gnName, dsName, count: 0, stages: initStageCounts() });
      }
      const item = map.get(key)!;
      item.count++;
      incrementStage(item.stages, j.status);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  });

  jobTypeStats = computed<JobTypeStat[]>(() => {
    const map = new Map<string, { name: string; count: number; stages: StageCounts }>();
    for (const j of this.jobs()) {
      const t = j.jobTypeName?.trim() || 'General';
      if (!map.has(t)) {
        map.set(t, { name: t, count: 0, stages: initStageCounts() });
      }
      const item = map.get(t)!;
      item.count++;
      incrementStage(item.stages, j.status);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
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
