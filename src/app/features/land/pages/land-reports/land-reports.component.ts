import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LandService } from '../../services/land.service';
import { LandJob, LandSettings, DEFAULT_LAND_SETTINGS } from '../../models/land.model';
import { SettingsService, Division } from '../../../settings/settings.service';

@Component({
  selector: 'app-land-reports',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container w-full">
      <!-- Header -->
      <div class="page-header no-print">
        <div>
          <h1 class="page-title">Land Operations & Throughput Reports</h1>
          <p class="page-desc">Generate statistical reports, divisional workloads, and export cadastral filings.</p>
        </div>
        <div class="actions-group">
          <button mat-stroked-button (click)="exportToCsv()">
            <mat-icon>file_download</mat-icon> Export CSV
          </button>
          <button mat-flat-button color="primary" (click)="printReport()">
            <mat-icon>print</mat-icon> Print Report
          </button>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <mat-card class="filter-card no-print">
        <div class="filter-grid">
          <!-- Date From -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Date From</mat-label>
            <input matInput [matDatepicker]="pickerFrom" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" (click)="pickerFrom.open()" placeholder="Select date">
            <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
            <mat-datepicker #pickerFrom></mat-datepicker>
          </mat-form-field>

          <!-- Date To -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Date To</mat-label>
            <input matInput [matDatepicker]="pickerTo" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" (click)="pickerTo.open()" placeholder="Select date">
            <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
            <mat-datepicker #pickerTo></mat-datepicker>
          </mat-form-field>

          <!-- Division Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>DS Division</mat-label>
            <mat-select multiple placeholder="All DS Divisions" [ngModel]="selectedDivisions()" (ngModelChange)="selectedDivisions.set($event)">
              <mat-option *ngFor="let div of uniqueAdminDivisions()" [value]="div">
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

          <!-- Stage Filter -->
          <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
            <mat-label>Stage Status</mat-label>
            <mat-select [ngModel]="selectedStage()" (ngModelChange)="selectedStage.set($event)">
              <mat-option value="ALL">All Stages</mat-option>
              <mat-option value="Initial">Stage 1: Initial</mat-option>
              <mat-option value="Documentation">Stage 2: Documentation</mat-option>
              <mat-option value="Verification">Stage 3: Verification</mat-option>
              <mat-option value="Completed">Stage 4: Completed</mat-option>
              <mat-option value="On Hold">On Hold</mat-option>
              <mat-option value="Rejected">Rejected</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Reset Filter -->
          <button mat-icon-button (click)="resetFilters()" matTooltip="Reset Filters" class="reset-btn">
            <mat-icon>restart_alt</mat-icon>
          </button>
        </div>
      </mat-card>

      <!-- KPI Summary Row -->
      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <span class="kpi-label">Filtered Land Tasks</span>
          <span class="kpi-value">{{ filteredJobs().length }}</span>
          <span class="kpi-sub">Matching selected criteria</span>
        </mat-card>
        <mat-card class="kpi-card">
          <span class="kpi-label">Completed & Endorsed</span>
          <span class="kpi-value text-green">{{ completedCount() }}</span>
          <span class="kpi-sub">Completion rate: {{ completionRate() }}%</span>
        </mat-card>
        <mat-card class="kpi-card">
          <span class="kpi-label">Active / In Progress</span>
          <span class="kpi-value text-amber">{{ inProgressCount() }}</span>
          <span class="kpi-sub">In documentation or survey</span>
        </mat-card>
        <mat-card class="kpi-card">
          <span class="kpi-label">Divisions Represented</span>
          <span class="kpi-value text-indigo">{{ activeDivisionsCount() }}</span>
          <span class="kpi-sub">Across jurisdictional branches</span>
        </mat-card>
      </div>

      <!-- Printable Report View -->
      <mat-card class="report-table-card">
        <div class="report-header">
          <div class="gov-seal">
            <mat-icon>account_balance</mat-icon>
            <div>
              <h2 class="gov-title">DIVISIONAL SECRETARIAT - LAND REGISTRY BRANCH</h2>
              <p class="gov-sub">Official Cadastral Management Dossier Report • Generated: {{ todayStr }}</p>
            </div>
          </div>
        </div>

        <div class="table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Job Reference</th>
                <th>Customer / Landowner</th>
                <th>NIC Number</th>
                <th>Parcel (Lot / Plan / Deed)</th>
                <th>Division</th>
                <th>Job Type</th>
                <th>Stage Status</th>
                <th>Registered Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="filteredJobs().length === 0">
                <td colspan="9" class="empty-state-cell">
                  No records match the selected reporting criteria.
                </td>
              </tr>
              <tr *ngFor="let job of filteredJobs(); let idx = index">
                <td>{{ idx + 1 }}</td>
                <td class="font-mono font-bold">{{ job.jobRef }}</td>
                <td>{{ job.customerName }}</td>
                <td class="font-mono">{{ job.customerNic }}</td>
                <td>Lot {{ job.lotNumber }}, Plan {{ job.planNumber }} ({{ job.deedNumber }})</td>
                <td>{{ job.division }}</td>
                <td>{{ job.jobTypeName }}</td>
                <td>
                  <span class="stage-tag" [ngClass]="job.status.toLowerCase()">{{ job.status }}</span>
                </td>
                <td>{{ job.createdAt | date:'yyyy-MM-dd' }}</td>
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

      .page-title { font-size: 1.5rem; font-weight: 800; margin: 0; color: #0f172a; }
      .page-desc { margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem; }
      .actions-group { display: flex; gap: 10px; }
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

        .compact-field { min-width: 170px; }
        .reset-btn { color: #64748b; }
      }
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 900px) {
        grid-template-columns: repeat(2, 1fr);
      }

      .kpi-card {
        padding: 16px 20px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        display: flex;
        flex-direction: column;

        .kpi-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; }
        .kpi-value { font-size: 1.6rem; font-weight: 800; color: #0f172a; margin: 4px 0; }
        .kpi-sub { font-size: 0.75rem; color: #94a3b8; }
      }
    }

    .report-table-card {
      padding: 24px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }

    .report-header {
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;

      .gov-seal {
        display: flex;
        align-items: center;
        gap: 12px;

        mat-icon { font-size: 36px; width: 36px; height: 36px; color: #0e7490; }
        .gov-title { font-size: 1.15rem; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: 0.05em; }
        .gov-sub { font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0; }
      }
    }

    .table-container {
      overflow-x: auto;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      text-align: left;

      th {
        background: #f8fafc;
        padding: 10px 12px;
        font-weight: 700;
        border-bottom: 2px solid #cbd5e1;
        color: #334155;
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: middle;
      }

      .empty-state-cell {
        text-align: center;
        padding: 30px;
        color: #94a3b8;
      }
    }

    .stage-tag {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.725rem;
      font-weight: 700;
      display: inline-block;

      &.initial { background: #e0f2fe; color: #0284c7; }
      &.documentation { background: #fef3c7; color: #d97706; }
      &.verification { background: #fae8ff; color: #a21caf; }
      &.completed { background: #dcfce7; color: #16a34a; }
      &.rejected { background: #fee2e2; color: #dc2626; }
    }

    .text-green { color: #16a34a; }
    .text-amber { color: #d97706; }
    .text-indigo { color: #4f46e5; }

    @media print {
      .no-print { display: none !important; }
      .page-container { padding: 0 !important; }
      .report-table-card { border: none !important; box-shadow: none !important; padding: 0 !important; }
    }
  `]
})
export class LandReportsComponent implements OnInit {
  private landService = inject(LandService);
  private settingsService = inject(SettingsService);

  jobs = signal<LandJob[]>([]);
  settings = signal<LandSettings>(DEFAULT_LAND_SETTINGS);
  allDivisions = signal<Division[]>([]);

  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);
  selectedDivisions = signal<string[]>([]);
  selectedJobType = signal<string>('ALL');
  selectedStage = signal<string>('ALL');

  todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  uniqueAdminDivisions = computed(() => {
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
    return Array.from(set).sort();
  });

  filteredJobs = computed(() => {
    let list = this.jobs();
    const from = this.dateFrom();
    const to = this.dateTo();
    const divs = this.selectedDivisions();
    const jt = this.selectedJobType();
    const st = this.selectedStage();

    if (from) {
      const fromMs = new Date(from).setHours(0, 0, 0, 0);
      list = list.filter(j => j.createdAt >= fromMs);
    }
    if (to) {
      const toMs = new Date(to).setHours(23, 59, 59, 999);
      list = list.filter(j => j.createdAt <= toMs);
    }
    if (divs && divs.length > 0) {
      list = list.filter(j => divs.includes(j.division));
    }
    if (jt !== 'ALL') {
      list = list.filter(j => j.jobTypeId === jt);
    }
    if (st !== 'ALL') {
      list = list.filter(j => j.status === st);
    }

    return list;
  });

  completedCount = computed(() => this.filteredJobs().filter(j => j.status === 'Completed').length);
  inProgressCount = computed(() => this.filteredJobs().filter(j => j.status !== 'Completed' && j.status !== 'Rejected').length);
  completionRate = computed(() => {
    const total = this.filteredJobs().length;
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });
  activeDivisionsCount = computed(() => {
    const set = new Set(this.filteredJobs().map(j => j.division));
    return set.size;
  });

  ngOnInit() {
    this.landService.getSettings().subscribe({
      next: (s) => this.settings.set(s)
    });
    this.landService.getLandJobs().subscribe({
      next: (data) => this.jobs.set(data || [])
    });
    this.settingsService.getDivisions().subscribe({
      next: (data) => this.allDivisions.set(data || [])
    });
  }

  resetFilters() {
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.selectedDivisions.set([]);
    this.selectedJobType.set('ALL');
    this.selectedStage.set('ALL');
  }

  printReport() {
    window.print();
  }

  exportToCsv() {
    const data = this.filteredJobs();
    if (data.length === 0) return;

    const headers = ['Job Ref', 'Customer Name', 'Customer NIC', 'Phone', 'Deed No', 'Plan No', 'Lot No', 'Division', 'Job Type', 'Stage', 'Registered Date'];
    const rows = data.map(j => [
      `"${j.jobRef}"`,
      `"${j.customerName}"`,
      `"${j.customerNic}"`,
      `"${j.customerPhone}"`,
      `"${j.deedNumber}"`,
      `"${j.planNumber}"`,
      `"${j.lotNumber}"`,
      `"${j.division}"`,
      `"${j.jobTypeName}"`,
      `"${j.status}"`,
      `"${new Date(j.createdAt).toLocaleDateString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Land_Registry_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
