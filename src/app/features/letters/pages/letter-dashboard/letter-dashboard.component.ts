import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LetterService } from '../../services/letter.service';
import { Letter, LetterStatus } from '../../models/letter.model';
import { LetterDialogComponent } from '../../components/letter-dialog/letter-dialog.component';
import { LetterDetailDialogComponent } from '../../components/letter-detail-dialog/letter-detail-dialog.component';

@Component({
  selector: 'app-letter-dashboard',
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
    <div class="page-container max-w-7xl mx-auto p-4 md:p-6">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Letter Management Dashboard</h1>
          <p class="page-desc">Overview of government correspondence, directive turnaround, and departmental load.</p>
        </div>
        <div class="actions-group">
          <button mat-flat-button color="primary" (click)="openAddLetterDialog()">
            <mat-icon>add</mat-icon> Register Inward Letter
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap blue">
            <mat-icon>mark_email_read</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Total Inward Letters</span>
            <span class="kpi-value">{{ totalCount() }}</span>
            <span class="kpi-sub">Total recorded in registry</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap red">
            <mat-icon>pending_actions</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Action Required</span>
            <span class="kpi-value text-red">{{ actionRequiredCount() }}</span>
            <span class="kpi-sub">Pending officer review</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap purple">
            <mat-icon>hourglass_top</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">In Progress</span>
            <span class="kpi-value">{{ inProgressCount() }}</span>
            <span class="kpi-sub">Under active execution</span>
          </div>
        </mat-card>

        <mat-card class="kpi-card">
          <div class="kpi-icon-wrap green">
            <mat-icon>task_alt</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Resolved / Completed</span>
            <span class="kpi-value">{{ completedCount() }}</span>
            <span class="kpi-sub">{{ completionRate() }} resolution rate</span>
          </div>
        </mat-card>
      </div>

      <!-- Priority Alerts Banner if urgent letters exist -->
      <div *ngIf="urgentCount() > 0" class="urgent-banner">
        <mat-icon class="urgent-icon">warning</mat-icon>
        <div class="urgent-content">
          <strong>Attention: {{ urgentCount() }} High-Priority / Immediate Directive(s) Require Urgent Response!</strong>
          <span>Inspect and dispatch actionable responses to meet official deadlines.</span>
        </div>
        <a mat-stroked-button color="warn" routerLink="/letters/actions">
          View Urgent Actions
        </a>
      </div>

      <!-- Two-column Layout: Department Load & Priority Breakdown -->
      <div class="dash-grid-2">
        <!-- Department Load Breakdown -->
        <mat-card class="section-card">
          <div class="section-header">
            <div class="sec-title-wrap">
              <mat-icon class="sec-icon">domain</mat-icon>
              <h3>Department Routing Load</h3>
            </div>
            <span class="sec-hint">Active inward letters per department</span>
          </div>

          <div class="dept-load-list">
            <div *ngFor="let item of departmentBreakdown()" class="dept-row">
              <div class="dept-meta">
                <span class="dept-name">{{ item.department }}</span>
                <span class="dept-count"><strong>{{ item.count }}</strong> letters</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="item.percent" color="primary"></mat-progress-bar>
            </div>
            <div *ngIf="departmentBreakdown().length === 0" class="empty-state">
              No departmental correspondence recorded yet.
            </div>
          </div>
        </mat-card>

        <!-- Status & Priority Breakdown -->
        <mat-card class="section-card">
          <div class="section-header">
            <div class="sec-title-wrap">
              <mat-icon class="sec-icon">pie_chart</mat-icon>
              <h3>Registry Status Breakdown</h3>
            </div>
            <span class="sec-hint">Workflow lifecycle distribution</span>
          </div>

          <div class="status-summary-grid">
            <div class="status-box received">
              <span class="st-num">{{ receivedCount() }}</span>
              <span class="st-lbl">Received</span>
            </div>
            <div class="status-box in-review">
              <span class="st-num">{{ inReviewCount() }}</span>
              <span class="st-lbl">In Review</span>
            </div>
            <div class="status-box action-required">
              <span class="st-num">{{ actionRequiredCount() }}</span>
              <span class="st-lbl">Action Required</span>
            </div>
            <div class="status-box in-progress">
              <span class="st-num">{{ inProgressCount() }}</span>
              <span class="st-lbl">In Progress</span>
            </div>
            <div class="status-box completed">
              <span class="st-num">{{ completedCount() }}</span>
              <span class="st-lbl">Completed</span>
            </div>
            <div class="status-box dispatched">
              <span class="st-num">{{ dispatchedCount() }}</span>
              <span class="st-lbl">Dispatched</span>
            </div>
          </div>

          <div class="priority-pills-row">
            <span class="pri-label">Priority Distribution:</span>
            <span class="pri-pill normal">{{ normalCount() }} Normal</span>
            <span class="pri-pill urgent">{{ urgentCount() }} Urgent</span>
            <span class="pri-pill immediate">{{ immediateCount() }} Immediate</span>
          </div>
        </mat-card>
      </div>

      <!-- Recent Letters Table / Feed -->
      <mat-card class="section-card mt-6">
        <div class="section-header">
          <div class="sec-title-wrap">
            <mat-icon class="sec-icon">inbox</mat-icon>
            <h3>Recent Inward Correspondence</h3>
          </div>
          <a mat-button color="primary" routerLink="/letters/inbox">
            View All in Inbox <mat-icon>arrow_forward</mat-icon>
          </a>
        </div>

        <div class="table-wrap">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title / Subject</th>
                <th>Received From</th>
                <th>Date</th>
                <th>Department(s)</th>
                <th>Status</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of recentLetters()" (click)="openDetail(l)" class="clickable-row">
                <td><span class="ref-badge">{{ l.ref_number }}</span></td>
                <td>
                  <div class="title-cell">
                    <strong>{{ l.title }}</strong>
                    <span *ngIf="l.link_ref" class="link-meta">Ref: {{ l.link_ref }}</span>
                  </div>
                </td>
                <td>{{ l.received_from }}</td>
                <td>{{ l.received_date }}</td>
                <td>
                  <span *ngFor="let d of l.send_to" class="mini-chip">{{ d }}</span>
                </td>
                <td>
                  <span class="status-chip" [ngClass]="getStatusClass(l.status)">{{ l.status }}</span>
                </td>
                <td class="text-right">
                  <button mat-icon-button (click)="$event.stopPropagation(); openDetail(l)">
                    <mat-icon>visibility</mat-icon>
                  </button>
                </td>
              </tr>
              <tr *ngIf="recentLetters().length === 0">
                <td colspan="7" class="empty-state">No letters registered yet. Click 'Register Inward Letter' to add your first letter.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 20px; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    .page-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .page-desc { font-size: 12.5px; color: #64748b; margin: 2px 0 0 0; }
    .actions-group button { height: 34px; font-size: 12.5px; }
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;
  }
  .kpi-card {
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .kpi-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    &.blue { background: #dbeafe; color: #1d4ed8; }
    &.red { background: #fee2e2; color: #b91c1c; }
    &.purple { background: #f3e8ff; color: #7e22ce; }
    &.green { background: #dcfce7; color: #15803d; }
    mat-icon { font-size: 22px; width: 22px; height: 22px; }
  }
  .kpi-info {
    display: flex;
    flex-direction: column;
    .kpi-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .kpi-value { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.2; }
    .kpi-sub { font-size: 10.5px; color: #94a3b8; }
    .text-red { color: #dc2626; }
  }
  .urgent-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    .urgent-icon { color: #dc2626; font-size: 22px; width: 22px; height: 22px; }
    .urgent-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      strong { color: #991b1b; font-size: 12px; }
      span { color: #7f1d1d; font-size: 11px; }
    }
    button, a { height: 30px; font-size: 11.5px; }
  }
  .dash-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    @media (max-width: 900px) { grid-template-columns: 1fr; }
  }
  .section-card {
    padding: 14px 18px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 6px;
    .sec-title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      .sec-icon { color: #2563eb; font-size: 20px; width: 20px; height: 20px; }
      h3 { margin: 0; font-size: 14px; font-weight: 700; color: #1e293b; }
    }
    .sec-hint { font-size: 11px; color: #64748b; }
  }
  .dept-load-list { display: flex; flex-direction: column; gap: 8px; }
  .dept-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    .dept-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      .dept-name { font-weight: 600; color: #334155; }
      .dept-count { color: #64748b; }
    }
  }
  .status-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .status-box {
    padding: 8px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    .st-num { font-size: 16px; font-weight: 800; }
    .st-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; }
    &.received { background: #e0f2fe; color: #0369a1; }
    &.in-review { background: #fef3c7; color: #b45309; }
    &.action-required { background: #fee2e2; color: #b91c1c; }
    &.in-progress { background: #f3e8ff; color: #7e22ce; }
    &.completed { background: #dcfce7; color: #15803d; }
    &.dispatched { background: #e0e7ff; color: #4338ca; }
  }
  .priority-pills-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      flex-wrap: wrap;
      .pri-label { font-weight: 600; color: #64748b; }
      .pri-pill {
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 700;
        &.normal { background: #f1f5f9; color: #475569; }
        &.urgent { background: #fef3c7; color: #b45309; }
        &.immediate { background: #fee2e2; color: #b91c1c; }
      }
    }
    .mt-6 { margin-top: 24px; }
    .table-wrap { overflow-x: auto; }
    .recent-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      th {
        text-align: left;
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
      }
      td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
      }
      .clickable-row {
        cursor: pointer;
        &:hover { background: #f8fafc; }
      }
    }
    .ref-badge {
      font-family: monospace;
      font-weight: 700;
      background: #eff6ff;
      color: #1e40af;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
    }
    .title-cell {
      display: flex;
      flex-direction: column;
      strong { color: #0f172a; }
      .link-meta { font-size: 11px; color: #64748b; }
    }
    .mini-chip {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 4px;
    }
    .status-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      &.received { background: #e0f2fe; color: #0369a1; }
      &.in-review { background: #fef3c7; color: #b45309; }
      &.action-required { background: #fee2e2; color: #b91c1c; }
      &.in-progress { background: #f3e8ff; color: #7e22ce; }
      &.completed { background: #dcfce7; color: #15803d; }
      &.dispatched { background: #e0e7ff; color: #4338ca; }
      &.archived { background: #f1f5f9; color: #64748b; }
    }
    .empty-state {
      text-align: center;
      color: #94a3b8;
      padding: 24px;
      font-size: 13px;
    }
    .text-right { text-align: right; }
  `]
})
export class LetterDashboardComponent implements OnInit {
  private letterService = inject(LetterService);
  private dialog = inject(MatDialog);

  letters = signal<Letter[]>([]);

  totalCount = computed(() => this.letters().length);
  receivedCount = computed(() => this.letters().filter(l => l.status === 'Received').length);
  inReviewCount = computed(() => this.letters().filter(l => l.status === 'In Review').length);
  actionRequiredCount = computed(() => this.letters().filter(l => l.status === 'Action Required').length);
  inProgressCount = computed(() => this.letters().filter(l => l.status === 'In Progress').length);
  completedCount = computed(() => this.letters().filter(l => l.status === 'Completed').length);
  dispatchedCount = computed(() => this.letters().filter(l => l.status === 'Dispatched' || l.status === 'Archived').length);

  normalCount = computed(() => this.letters().filter(l => l.priority === 'Normal').length);
  urgentCount = computed(() => this.letters().filter(l => l.priority === 'Urgent').length);
  immediateCount = computed(() => this.letters().filter(l => l.priority === 'Immediate').length);

  completionRate = computed(() => {
    const total = this.totalCount();
    if (total === 0) return '0%';
    const done = this.completedCount() + this.dispatchedCount();
    return Math.round((done / total) * 100) + '%';
  });

  departmentBreakdown = computed(() => {
    const counts: Record<string, number> = {};
    for (const l of this.letters()) {
      const depts = l.send_to?.length ? l.send_to : ['General Administration'];
      for (const d of depts) {
        counts[d] = (counts[d] || 0) + 1;
      }
    }
    const total = this.totalCount() || 1;
    return Object.entries(counts)
      .map(([department, count]) => ({
        department,
        count,
        percent: Math.min(100, Math.round((count / total) * 100))
      }))
      .sort((a, b) => b.count - a.count);
  });

  recentLetters = computed(() => this.letters().slice(0, 8));

  ngOnInit() {
    this.letterService.getLetters().subscribe(letters => {
      this.letters.set(letters);
    });
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  openAddLetterDialog() {
    this.dialog.open(LetterDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      data: {}
    });
  }

  openDetail(letter: Letter) {
    this.dialog.open(LetterDetailDialogComponent, {
      width: '800px',
      maxWidth: '96vw',
      data: { letter }
    });
  }
}
