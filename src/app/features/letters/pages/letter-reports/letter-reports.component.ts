import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { LetterService } from '../../services/letter.service';
import { Letter, LetterStatus, ALL_LETTER_STATUSES } from '../../models/letter.model';
import { SettingsService, Department } from '../../../settings/settings.service';

export type TimeframeMode = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportViewTab = 'status-report' | 'ledger' | 'combined';

interface StatusItem {
  status: LetterStatus;
  count: number;
  percent: number;
  icon: string;
  cssClass: string;
}

interface DeptMatrixRow {
  department: string;
  code?: string;
  received: number;
  inReview: number;
  actionRequired: number;
  inProgress: number;
  completed: number;
  dispatched: number;
  archived: number;
  total: number;
  turnaroundRate: string;
}

@Component({
  selector: 'app-letter-reports',
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
    MatTooltipModule,
    MatProgressBarModule,
    MatMenuModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="page-container max-w-7xl mx-auto p-4 md:p-6">

      <!-- Header & Export / Print Actions -->
      <div class="page-header no-print">
        <div class="header-titles">
          <div class="title-row">
            <mat-icon class="title-icon">analytics</mat-icon>
            <h1 class="page-title">Correspondence Reports & Status Register</h1>
          </div>
          <p class="page-desc">Generate periodic status audits, department cross-tabulation, and official dispatch registers.</p>
        </div>
        <div class="actions-group">
          <!-- Paper Size Pill Selector -->
          <div class="paper-size-pill-group">
            <span class="paper-label">Paper:</span>
            <button type="button" 
                    class="paper-btn" 
                    [class.active]="paperSize() === 'A4'" 
                    (click)="setPaperSize('A4')"
                    matTooltip="A4 Horizontal Landscape (297 × 210 mm)">
              <mat-icon>aspect_ratio</mat-icon> A4 Horizontal
            </button>
            <button type="button" 
                    class="paper-btn" 
                    [class.active]="paperSize() === 'legal'" 
                    (click)="setPaperSize('legal')"
                    matTooltip="Legal Horizontal Landscape (356 × 216 mm)">
              <mat-icon>view_compact_alt</mat-icon> Legal Horizontal
            </button>
          </div>

          <!-- Print Action with Format Dropdown -->
          <button mat-stroked-button [matMenuTriggerFor]="printMenu" class="action-btn">
            <mat-icon>print</mat-icon> Print Horizontal ({{ paperSize() === 'A4' ? 'A4' : 'Legal' }}) <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #printMenu="matMenu">
            <button mat-menu-item (click)="printReport('A4')">
              <mat-icon>description</mat-icon> Print A4 Horizontal (297 × 210 mm)
            </button>
            <button mat-menu-item (click)="printReport('legal')">
              <mat-icon>article</mat-icon> Print Legal Horizontal (356 × 216 mm)
            </button>
          </mat-menu>

          <button mat-flat-button color="primary" [matMenuTriggerFor]="exportMenu" class="action-btn">
            <mat-icon>download</mat-icon> Export Data <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #exportMenu="matMenu">
            <button mat-menu-item (click)="exportLettersCSV()">
              <mat-icon>table_chart</mat-icon> Export Letters Register (CSV)
            </button>
            <button mat-menu-item (click)="exportStatusMatrixCSV()">
              <mat-icon>view_list</mat-icon> Export Status Matrix (CSV)
            </button>
          </mat-menu>
        </div>
      </div>

      <!-- TIMEFRAME PRESETS & DATE RANGE PICKER (No Print) -->
      <mat-card class="filter-card no-print">
        <div class="timeframe-header-row">
          <!-- Preset Mode Segmented Control -->
          <div class="timeframe-segmented">
            <span class="ctrl-label">Period Mode:</span>
            <div class="pill-group">
              <button type="button" 
                      class="pill-btn" 
                      [class.active]="timeframeMode() === 'daily'" 
                      (click)="setTimeframeMode('daily')">
                <mat-icon>today</mat-icon> Daily
              </button>
              <button type="button" 
                      class="pill-btn" 
                      [class.active]="timeframeMode() === 'weekly'" 
                      (click)="setTimeframeMode('weekly')">
                <mat-icon>calendar_view_week</mat-icon> Weekly
              </button>
              <button type="button" 
                      class="pill-btn" 
                      [class.active]="timeframeMode() === 'monthly'" 
                      (click)="setTimeframeMode('monthly')">
                <mat-icon>calendar_month</mat-icon> Monthly
              </button>
              <button type="button" 
                      class="pill-btn" 
                      [class.active]="timeframeMode() === 'custom'" 
                      (click)="setTimeframeMode('custom')">
                <mat-icon>date_range</mat-icon> Date Range
              </button>
            </div>
          </div>

          <!-- Department & Status Dropdown Filters -->
          <div class="dropdown-filters">
            <mat-form-field appearance="outline" class="compact-field filter-select" subscriptSizing="dynamic">
              <mat-label>Department Filter</mat-label>
              <mat-select [(ngModel)]="selectedDept">
                <mat-option value="ALL">All Departments</mat-option>
                <mat-option *ngFor="let d of departments()" [value]="d.name">{{ d.name }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="compact-field filter-select" subscriptSizing="dynamic">
              <mat-label>Status Filter</mat-label>
              <mat-select [(ngModel)]="selectedStatus">
                <mat-option value="ALL">All Statuses</mat-option>
                <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-icon-button (click)="resetFilters()" matTooltip="Reset All Filters" class="reset-btn sm-btn">
              <mat-icon>restart_alt</mat-icon>
            </button>
          </div>
        </div>

        <!-- Dynamic Date Controls based on Active Mode -->
        <div class="timeframe-subcontrols">
          <!-- DAILY CONTROLS -->
          <div *ngIf="timeframeMode() === 'daily'" class="subcontrol-row">
            <div class="nav-cluster">
              <button mat-icon-button (click)="prevDay()" matTooltip="Previous Day" class="nav-arr-btn">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button mat-stroked-button (click)="setToday()" class="preset-btn">Today</button>
              <button mat-icon-button (click)="nextDay()" matTooltip="Next Day" class="nav-arr-btn">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
            <div class="date-input-wrap">
              <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
                <mat-label>Selected Date</mat-label>
                <input matInput [matDatepicker]="dailyPicker" [ngModel]="dailyDateObj()" (ngModelChange)="onDailyDatePicked($event)" (click)="dailyPicker.open()" placeholder="Select date">
                <mat-datepicker-toggle matIconSuffix [for]="dailyPicker"></mat-datepicker-toggle>
                <mat-datepicker #dailyPicker></mat-datepicker>
              </mat-form-field>
            </div>
            <span class="active-badge daily">
              <mat-icon>event</mat-icon> {{ reportPeriodLabel() }}
            </span>
          </div>

          <!-- WEEKLY CONTROLS -->
          <div *ngIf="timeframeMode() === 'weekly'" class="subcontrol-row">
            <div class="nav-cluster">
              <button mat-icon-button (click)="prevWeek()" matTooltip="Previous Week" class="nav-arr-btn">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button mat-stroked-button (click)="setThisWeek()" class="preset-btn">This Week</button>
              <button mat-icon-button (click)="nextWeek()" matTooltip="Next Week" class="nav-arr-btn">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
            <span class="active-badge weekly">
              <mat-icon>date_range</mat-icon> {{ reportPeriodLabel() }}
            </span>
          </div>

          <!-- MONTHLY CONTROLS -->
          <div *ngIf="timeframeMode() === 'monthly'" class="subcontrol-row">
            <div class="nav-cluster">
              <button mat-icon-button (click)="prevMonth()" matTooltip="Previous Month" class="nav-arr-btn">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button mat-stroked-button (click)="setThisMonth()" class="preset-btn">This Month</button>
              <button mat-icon-button (click)="nextMonth()" matTooltip="Next Month" class="nav-arr-btn">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
            <div class="date-input-wrap">
              <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
                <mat-label>Select Month</mat-label>
                <input matInput type="month" [(ngModel)]="monthlyMonth" (change)="onMonthlyChange()">
              </mat-form-field>
            </div>
            <span class="active-badge monthly">
              <mat-icon>calendar_month</mat-icon> {{ reportPeriodLabel() }}
            </span>
          </div>

          <!-- CUSTOM DATE RANGE CONTROLS -->
          <div *ngIf="timeframeMode() === 'custom'" class="subcontrol-row custom-range-row">
            <div class="range-inputs">
              <mat-form-field appearance="outline" class="compact-field date-field" subscriptSizing="dynamic">
                <mat-label>Date From</mat-label>
                <input matInput [matDatepicker]="customFromPicker" [ngModel]="customFromObj()" (ngModelChange)="onCustomFromPicked($event)" (click)="customFromPicker.open()" placeholder="Select date">
                <mat-datepicker-toggle matIconSuffix [for]="customFromPicker"></mat-datepicker-toggle>
                <mat-datepicker #customFromPicker></mat-datepicker>
              </mat-form-field>
              <span class="range-sep">to</span>
              <mat-form-field appearance="outline" class="compact-field date-field" subscriptSizing="dynamic">
                <mat-label>Date To</mat-label>
                <input matInput [matDatepicker]="customToPicker" [ngModel]="customToObj()" (ngModelChange)="onCustomToPicked($event)" (click)="customToPicker.open()" placeholder="Select date">
                <mat-datepicker-toggle matIconSuffix [for]="customToPicker"></mat-datepicker-toggle>
                <mat-datepicker #customToPicker></mat-datepicker>
              </mat-form-field>
            </div>
            <div class="quick-chips">
              <button type="button" class="quick-chip" (click)="setCustomPreset('7d')">Last 7 Days</button>
              <button type="button" class="quick-chip" (click)="setCustomPreset('30d')">Last 30 Days</button>
              <button type="button" class="quick-chip" (click)="setCustomPreset('quarter')">This Quarter</button>
              <button type="button" class="quick-chip" (click)="setCustomPreset('year')">This Year</button>
              <button type="button" class="quick-chip" (click)="setCustomPreset('all')">All Time</button>
            </div>
            <span class="active-badge custom">
              <mat-icon>filter_alt</mat-icon> {{ reportPeriodLabel() }}
            </span>
          </div>
        </div>
      </mat-card>

      <!-- EXECUTIVE KPI CARDS -->
      <div class="kpi-grid no-print">
        <mat-card class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Inward Volume</span>
            <mat-icon class="stat-icon blue">mark_email_read</mat-icon>
          </div>
          <span class="stat-val">{{ filteredLetters().length }}</span>
          <span class="stat-sub">Letters in {{ timeframeMode() }} period</span>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Action Pending</span>
            <mat-icon class="stat-icon red">pending_actions</mat-icon>
          </div>
          <span class="stat-val text-red">{{ pendingCount() }}</span>
          <span class="stat-sub">Received / Review / Action</span>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Resolved / Dispatched</span>
            <mat-icon class="stat-icon green">task_alt</mat-icon>
          </div>
          <span class="stat-val text-green">{{ resolvedCount() }}</span>
          <span class="stat-sub">Completed or dispatched</span>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Resolution Turnaround</span>
            <mat-icon class="stat-icon purple">published_with_changes</mat-icon>
          </div>
          <span class="stat-val text-purple">{{ resolutionRate() }}</span>
          <span class="stat-sub">Efficiency index</span>
        </mat-card>
      </div>

      <!-- REPORT VIEW SWITCHER TABS (No Print) -->
      <div class="view-switcher-bar no-print">
        <div class="tab-pill-group">
          <button type="button" 
                  class="view-tab-btn" 
                  [class.active]="activeTab() === 'status-report'" 
                  (click)="activeTab.set('status-report')">
            <mat-icon>pie_chart</mat-icon> Status Analytics & Department Matrix
          </button>
          <button type="button" 
                  class="view-tab-btn" 
                  [class.active]="activeTab() === 'ledger'" 
                  (click)="activeTab.set('ledger')">
            <mat-icon>format_list_bulleted</mat-icon> Official Correspondence Ledger
          </button>
          <button type="button" 
                  class="view-tab-btn" 
                  [class.active]="activeTab() === 'combined'" 
                  (click)="activeTab.set('combined')">
            <mat-icon>auto_stories</mat-icon> Full Comprehensive Report (Both)
          </button>
        </div>

        <div class="priority-pills">
          <span class="p-pill normal">Normal: <strong>{{ priorityCounts().normal }}</strong></span>
          <span class="p-pill urgent">Urgent: <strong>{{ priorityCounts().urgent }}</strong></span>
          <span class="p-pill immediate">Immediate: <strong>{{ priorityCounts().immediate }}</strong></span>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- SECTION 1: STATUS REPORT & MATRIX (Visible in status-report & combined) -->
      <!-- ============================================================== -->
      <div *ngIf="activeTab() === 'status-report' || activeTab() === 'combined'" class="report-section print-area">
        
        <!-- Official Print Header (Only shown during print or at top of print-area) -->
        <div class="official-print-header">
          <h2 class="office-name">OFFICIAL CORRESPONDENCE WORKFLOW & STATUS REPORT</h2>
          <div class="meta-row">
            <span><strong>Reporting Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Department Scope:</strong> {{ selectedDept === 'ALL' ? 'All Departments' : selectedDept }}</span>
            <span><strong>Status Filter:</strong> {{ selectedStatus === 'ALL' ? 'All Statuses' : selectedStatus }}</span>
            <span><strong>Paper Format:</strong> {{ paperSize() === 'A4' ? 'A4 Horizontal Landscape (297×210 mm)' : 'Legal Horizontal Landscape (356×216 mm)' }}</span>
            <span><strong>Generated Date:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <!-- STATUS BREAKDOWN GRID -->
        <div class="section-heading-bar">
          <mat-icon class="sec-icon">bar_chart</mat-icon>
          <h3>Status Breakdown & Distribution (Click card to filter ledger)</h3>
        </div>

        <div class="status-cards-grid">
          <div *ngFor="let s of statusBreakdown()" 
               class="status-summary-card" 
               [ngClass]="[s.cssClass, selectedStatus === s.status ? 'selected-card' : '']"
               (click)="toggleStatusFilter(s.status)"
               [matTooltip]="'Click to filter by ' + s.status">
            <div class="sc-top">
              <span class="sc-status-name">{{ s.status }}</span>
              <mat-icon class="sc-icon">{{ s.icon }}</mat-icon>
            </div>
            <div class="sc-val-row">
              <span class="sc-count">{{ s.count }}</span>
              <span class="sc-pct">{{ s.percent }}%</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="s.percent" class="sc-progress"></mat-progress-bar>
          </div>
        </div>

        <!-- DEPARTMENT STATUS CROSS-TABULATION MATRIX -->
        <div class="section-heading-bar mt-6">
          <mat-icon class="sec-icon">grid_on</mat-icon>
          <h3>Department Workflow Distribution Matrix</h3>
          <span class="heading-sub">Cross-tabulation of active correspondence by assigned department</span>
        </div>

        <div class="matrix-card">
          <table class="report-table matrix-table">
            <thead>
              <tr>
                <th class="dept-col">Department</th>
                <th class="stat-col text-center">Received</th>
                <th class="stat-col text-center">In Review</th>
                <th class="stat-col text-center">Action Req.</th>
                <th class="stat-col text-center">In Progress</th>
                <th class="stat-col text-center">Completed</th>
                <th class="stat-col text-center">Dispatched</th>
                <th class="stat-col text-center">Archived</th>
                <th class="stat-col text-center total-header">Total</th>
                <th class="stat-col text-center turnaround-header">Resolution Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of departmentMatrix()" class="matrix-row">
                <td class="dept-cell">
                  <strong>{{ r.department }}</strong>
                  <span *ngIf="r.code" class="dept-code">({{ r.code }})</span>
                </td>
                <td class="text-center" [class.highlight-cell]="r.received > 0">{{ r.received }}</td>
                <td class="text-center" [class.highlight-cell]="r.inReview > 0">{{ r.inReview }}</td>
                <td class="text-center" [class.action-req-cell]="r.actionRequired > 0">{{ r.actionRequired }}</td>
                <td class="text-center" [class.highlight-cell]="r.inProgress > 0">{{ r.inProgress }}</td>
                <td class="text-center text-green" [class.highlight-cell]="r.completed > 0">{{ r.completed }}</td>
                <td class="text-center text-indigo" [class.highlight-cell]="r.dispatched > 0">{{ r.dispatched }}</td>
                <td class="text-center text-muted" [class.highlight-cell]="r.archived > 0">{{ r.archived }}</td>
                <td class="text-center total-cell"><strong>{{ r.total }}</strong></td>
                <td class="text-center">
                  <span class="rate-badge" [ngClass]="getRateClass(r.turnaroundRate)">{{ r.turnaroundRate }}</span>
                </td>
              </tr>
              <tr *ngIf="departmentMatrix().length === 0">
                <td colspan="10" class="text-center p-6 text-gray-500">
                  No records registered in the selected timeframe.
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="matrix-footer-row" *ngIf="departmentMatrix().length > 0">
                <td><strong>Summary Total</strong></td>
                <td class="text-center">{{ matrixTotals().received }}</td>
                <td class="text-center">{{ matrixTotals().inReview }}</td>
                <td class="text-center text-red">{{ matrixTotals().actionRequired }}</td>
                <td class="text-center">{{ matrixTotals().inProgress }}</td>
                <td class="text-center text-green">{{ matrixTotals().completed }}</td>
                <td class="text-center text-indigo">{{ matrixTotals().dispatched }}</td>
                <td class="text-center text-muted">{{ matrixTotals().archived }}</td>
                <td class="text-center total-cell"><strong>{{ matrixTotals().total }}</strong></td>
                <td class="text-center">
                  <span class="rate-badge" [ngClass]="getRateClass(matrixTotals().turnaroundRate)">
                    {{ matrixTotals().turnaroundRate }}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- SECTION 2: OFFICIAL CORRESPONDENCE LEDGER (Visible in ledger & combined) -->
      <!-- ============================================================== -->
      <div *ngIf="activeTab() === 'ledger' || activeTab() === 'combined'" class="report-section print-area mt-4">
        
        <div class="official-print-header" *ngIf="activeTab() === 'ledger'">
          <h2 class="office-name">OFFICIAL INWARD CORRESPONDENCE REGISTER</h2>
          <div class="meta-row">
            <span><strong>Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Department:</strong> {{ selectedDept === 'ALL' ? 'All Departments' : selectedDept }}</span>
            <span><strong>Paper Format:</strong> {{ paperSize() === 'A4' ? 'A4 Horizontal Landscape (297×210 mm)' : 'Legal Horizontal Landscape (356×216 mm)' }}</span>
            <span><strong>Generated:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <div class="section-heading-bar">
          <mat-icon class="sec-icon">receipt_long</mat-icon>
          <h3>Official Correspondence Ledger Register</h3>
          <span class="heading-sub">Total: {{ filteredLetters().length }} registered letters in timeframe</span>
        </div>

        <div class="ledger-container">
          <table class="report-table ledger-table">
            <thead>
              <tr>
                <th style="width: 40px;" class="text-center">#</th>
                <th style="width: 140px;">Reference No.</th>
                <th style="width: 95px;">Date Rec'd</th>
                <th>Letter Title & Subject</th>
                <th style="width: 160px;">Received From</th>
                <th style="width: 130px;">Send To (Dept)</th>
                <th style="width: 130px;">Assigned Officer</th>
                <th style="width: 85px;" class="text-center">Priority</th>
                <th style="width: 110px;" class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of filteredLetters(); let i = index">
                <td class="text-center">{{ i + 1 }}</td>
                <td><span class="ref-mono">{{ l.ref_number }}</span></td>
                <td>{{ l.received_date }}</td>
                <td>
                  <strong>{{ l.title }}</strong>
                  <div *ngIf="l.link_ref" class="sub-link-meta">Ref: {{ l.link_ref }}</div>
                </td>
                <td>{{ l.received_from }}</td>
                <td>{{ l.send_to.join(', ') || '-' }}</td>
                <td>{{ l.assigned_user_names?.join(', ') || l.assigned_to.join(', ') || '-' }}</td>
                <td class="text-center">
                  <span class="priority-tag" [ngClass]="(l.priority || 'Normal').toLowerCase()">
                    {{ l.priority || 'Normal' }}
                  </span>
                </td>
                <td class="text-center">
                  <span class="status-tag" [ngClass]="getStatusClass(l.status)">{{ l.status }}</span>
                </td>
              </tr>
              <tr *ngIf="filteredLetters().length === 0">
                <td colspan="9" class="text-center p-6 text-gray-500">
                  No letters registered matching the selected criteria.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- OFFICIAL PRINT SIGNATURE FOOTER (Print only, 4 Horizontal Columns) -->
      <div class="print-signatures-block">
        <div class="sig-box">
          <div class="sig-line"></div>
          <span class="sig-title">Prepared By (Registry Officer)</span>
          <span class="sig-meta">Date: ........................................</span>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <span class="sig-title">Checked By (Records Supervisor)</span>
          <span class="sig-meta">Date: ........................................</span>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <span class="sig-title">Verified By (Chief Admin Officer)</span>
          <span class="sig-meta">Date: ........................................</span>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <span class="sig-title">Approved By (Head of Department)</span>
          <span class="sig-meta">Date: ........................................</span>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 14px; }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
      .header-titles {
        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          .title-icon { color: #0284c7; font-size: 24px; width: 24px; height: 24px; }
          .page-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
        }
        .page-desc { font-size: 12.5px; color: #64748b; margin: 3px 0 0 0; }
      }
      .actions-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        .action-btn { height: 36px; font-size: 12.5px; }
      }

      .paper-size-pill-group {
        display: inline-flex;
        align-items: center;
        background: #f1f5f9;
        padding: 3px;
        border-radius: 8px;
        gap: 3px;
        border: 1px solid #cbd5e1;
        .paper-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          padding: 0 4px 0 6px;
        }
        .paper-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          color: #475569;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          mat-icon { font-size: 15px; width: 15px; height: 15px; }
          &:hover { color: #0f172a; background: rgba(255,255,255,0.7); }
          &.active {
            background: #ffffff;
            color: #0f172a;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            font-weight: 700;
          }
        }
      }
    }

    /* TIMEFRAME PRESETS & CONTROLS */
    .filter-card {
      padding: 12px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .timeframe-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .timeframe-segmented {
      display: flex;
      align-items: center;
      gap: 10px;
      .ctrl-label { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.03em; }
    }

    .pill-group {
      display: inline-flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 3px;
      border: 1px solid #e2e8f0;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { color: #0f172a; background: rgba(255,255,255,0.6); }
      &.active {
        background: #ffffff;
        color: #0284c7;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
    }

    .dropdown-filters {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      .filter-select { width: 170px; }
      .sm-btn {
        width: 34px;
        height: 34px;
        line-height: 34px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .timeframe-subcontrols {
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
    }

    .subcontrol-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .nav-cluster {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      .nav-arr-btn {
        width: 32px;
        height: 32px;
        line-height: 32px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .preset-btn { height: 32px; font-size: 12px; font-weight: 600; }
    }

    .date-input-wrap {
      width: 170px;
    }

    .custom-range-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .range-inputs {
      display: flex;
      align-items: center;
      gap: 8px;
      .date-field { width: 155px; }
      .range-sep { font-size: 12px; color: #64748b; font-weight: 500; }
    }

    .quick-chips {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      .quick-chip {
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        font-size: 11.5px;
        font-weight: 500;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover { background: #e2e8f0; color: #0f172a; border-color: #94a3b8; }
      }
    }

    .active-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      margin-left: auto;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.daily { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
      &.weekly { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      &.monthly { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
      &.custom { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    }

    /* KPI CARDS */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .stat-card {
      padding: 12px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      .stat-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .stat-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #64748b; }
        .stat-icon {
          font-size: 18px; width: 18px; height: 18px;
          &.blue { color: #0284c7; }
          &.red { color: #dc2626; }
          &.green { color: #16a34a; }
          &.purple { color: #7c3aed; }
        }
      }
      .stat-val { font-size: 24px; font-weight: 800; color: #0f172a; margin: 3px 0; }
      .stat-sub { font-size: 11px; color: #94a3b8; }
      .text-green { color: #16a34a; }
      .text-red { color: #dc2626; }
      .text-purple { color: #7c3aed; }
    }

    /* VIEW SWITCHER BAR */
    .view-switcher-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: white;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .tab-pill-group {
      display: inline-flex;
      background: #f8fafc;
      padding: 3px;
      border-radius: 8px;
      gap: 4px;
      border: 1px solid #e2e8f0;
    }

    .view-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { color: #0f172a; background: rgba(0,0,0,0.03); }
      &.active {
        background: #0284c7;
        color: white;
        box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3);
      }
    }

    .priority-pills {
      display: flex;
      gap: 6px;
      .p-pill {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 500;
        &.normal { background: #f1f5f9; color: #475569; }
        &.urgent { background: #fef3c7; color: #92400e; }
        &.immediate { background: #fee2e2; color: #991b1b; }
      }
    }

    /* SECTION HEADINGS */
    .section-heading-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      .sec-icon { font-size: 20px; width: 20px; height: 20px; color: #0284c7; }
      h3 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
      .heading-sub { font-size: 11.5px; color: #64748b; margin-left: 6px; }
    }

    /* STATUS CARDS GRID */
    .status-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
    }

    .status-summary-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 6px;
      &:hover { transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
      &.selected-card {
        border-color: #0284c7;
        box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
        background: #f0f9ff;
      }
      .sc-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .sc-status-name { font-size: 11px; font-weight: 700; color: #475569; }
        .sc-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      .sc-val-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        .sc-count { font-size: 20px; font-weight: 800; color: #0f172a; }
        .sc-pct { font-size: 11px; font-weight: 600; color: #64748b; }
      }
      .sc-progress { height: 4px; border-radius: 2px; }

      &.st-received { .sc-icon { color: #0284c7; } .sc-progress ::ng-deep .mdc-linear-progress__bar-inner { border-color: #0284c7 !important; } }
      &.st-in-review { .sc-icon { color: #d97706; } .sc-progress ::ng-deep .mdc-linear-progress__bar-inner { border-color: #d97706 !important; } }
      &.st-action-required { .sc-icon { color: #dc2626; } .sc-progress ::ng-deep .mdc-linear-progress__bar-inner { border-color: #dc2626 !important; } }
      &.st-in-progress { .sc-icon { color: #7c3aed; } .sc-progress ::ng-deep .mdc-linear-progress__bar-inner { border-color: #7c3aed !important; } }
      &.st-completed { .sc-icon { color: #16a34a; } .sc-progress ::ng-deep .mdc-linear-progress__bar-inner { border-color: #16a34a !important; } }
      &.st-dispatched { .sc-icon { color: #4338ca; } .sc-progress ::ng-deep .mdc-linear-progress__bar-inner { border-color: #4338ca !important; } }
      &.st-archived { .sc-icon { color: #64748b; } .sc-progress ::ng-deep .mdc-linear-progress__bar-inner { border-color: #64748b !important; } }
    }

    /* MATRIX & REPORT TABLES */
    .matrix-card, .ledger-container {
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow-x: auto;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      th {
        background: #f8fafc;
        color: #334155;
        font-weight: 700;
        text-align: left;
        padding: 8px 10px;
        border: 1px solid #e2e8f0;
        white-space: nowrap;
      }
      td {
        padding: 7px 10px;
        border: 1px solid #e2e8f0;
        color: #334155;
      }
    }

    .matrix-table {
      .dept-col { min-width: 180px; }
      .dept-cell {
        font-size: 12px;
        .dept-code { color: #64748b; font-size: 11px; margin-left: 4px; }
      }
      .stat-col { width: 85px; }
      .total-header, .total-cell { background: #f1f5f9; }
      .turnaround-header { width: 120px; }
      .highlight-cell { font-weight: 700; }
      .action-req-cell { font-weight: 700; color: #dc2626; background: #fff1f2; }
      .text-green { color: #16a34a; font-weight: 700; }
      .text-indigo { color: #4338ca; font-weight: 700; }
      .text-muted { color: #94a3b8; }
      .matrix-footer-row td {
        background: #e2e8f0;
        font-weight: 700;
        border-top: 2px solid #94a3b8;
      }
      .rate-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 4px;
        &.high { background: #dcfce7; color: #15803d; }
        &.mid { background: #fef3c7; color: #b45309; }
        &.low { background: #fee2e2; color: #b91c1c; }
      }
    }

    /* LEDGER SPECIFIC STYLING */
    .ledger-table {
      .ref-mono { font-family: monospace; font-weight: 700; color: #1e40af; }
      .sub-link-meta { font-size: 10px; color: #64748b; margin-top: 1px; }
      .priority-tag {
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        &.normal { background: #f1f5f9; color: #475569; }
        &.urgent { background: #fef3c7; color: #b45309; }
        &.immediate { background: #fee2e2; color: #b91c1c; }
      }
      .status-tag {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
        &.received { background: #e0f2fe; color: #0369a1; }
        &.in-review { background: #fef3c7; color: #b45309; }
        &.action-required { background: #fee2e2; color: #b91c1c; }
        &.in-progress { background: #f3e8ff; color: #7e22ce; }
        &.completed { background: #dcfce7; color: #15803d; }
        &.dispatched { background: #e0e7ff; color: #4338ca; }
        &.archived { background: #f1f5f9; color: #64748b; }
      }
    }

    .text-center { text-align: center; }
    .mt-4 { margin-top: 16px; }
    .mt-6 { margin-top: 24px; }

    /* OFFICIAL PRINT HEADER & SIGNATURES */
    .official-print-header {
      display: none; /* Only visible in print */
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0f172a;
      .office-name { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
      .meta-row {
        display: flex;
        justify-content: center;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 11px;
        color: #475569;
        margin-top: 4px;
      }
    }

    @media print {
      @page {
        size: landscape;
        margin: 7mm 10mm 7mm 10mm;
      }

      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .no-print { display: none !important; }
      .page-container {
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .official-print-header {
        display: block !important;
        margin-bottom: 10px !important;
        padding-bottom: 6px !important;
        border-bottom: 2px solid #0f172a !important;
        .office-name {
          font-size: 14pt !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          text-align: center !important;
          letter-spacing: 0.5px !important;
          margin: 0 0 4px 0 !important;
        }
        .meta-row {
          display: flex !important;
          justify-content: center !important;
          gap: 16px !important;
          flex-wrap: wrap !important;
          font-size: 8.5pt !important;
          color: #334155 !important;
        }
      }

      .section-heading-bar {
        page-break-after: avoid !important;
        break-after: avoid !important;
        margin-top: 10px !important;
        margin-bottom: 6px !important;
        h3 { font-size: 10.5pt !important; font-weight: 700 !important; color: #000 !important; }
        .sec-icon { display: none !important; }
      }

      /* 7 Status Cards horizontally aligned across the landscape width */
      .status-cards-grid {
        display: grid !important;
        grid-template-columns: repeat(7, 1fr) !important;
        gap: 6px !important;
        margin-bottom: 12px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .status-summary-card {
        border: 1px solid #64748b !important;
        background: #ffffff !important;
        padding: 6px 8px !important;
        box-shadow: none !important;
        border-radius: 4px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        .sc-status-name { font-size: 7.5pt !important; color: #1e293b !important; }
        .sc-icon { display: none !important; }
        .sc-count { font-size: 13pt !important; font-weight: 800 !important; color: #000 !important; }
        .sc-pct { font-size: 8pt !important; font-weight: 700 !important; color: #334155 !important; }
        .sc-progress { height: 3px !important; }
      }

      /* Tables formatted for Horizontal Landscape */
      .matrix-card, .ledger-container {
        border: 1px solid #334155 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        overflow: visible !important;
        width: 100% !important;
        margin-bottom: 12px !important;
      }

      .report-table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 8.5pt !important;

        thead {
          display: table-header-group !important;
        }
        tfoot {
          display: table-footer-group !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        th {
          background: #f1f5f9 !important;
          color: #000000 !important;
          border: 1px solid #475569 !important;
          padding: 4px 6px !important;
          font-weight: 700 !important;
          font-size: 8pt !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        td {
          border: 1px solid #64748b !important;
          color: #000000 !important;
          padding: 4px 6px !important;
          font-size: 8pt !important;
        }
      }

      .matrix-table {
        .matrix-footer-row td {
          background: #e2e8f0 !important;
          font-weight: 800 !important;
          border-top: 2px solid #000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }

      .ledger-table {
        .ref-mono { font-family: monospace !important; font-weight: 700 !important; color: #000 !important; }
        .priority-tag, .status-tag {
          border: 1px solid #64748b !important;
          background: transparent !important;
          color: #000 !important;
          padding: 1px 4px !important;
          font-size: 7.5pt !important;
        }
      }

      /* 4 Signature columns spread evenly across horizontal landscape width */
      .print-signatures-block {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-end !important;
        margin-top: 25px !important;
        padding-top: 15px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        width: 100% !important;

        .sig-box {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 3px !important;
          width: 22% !important;

          .sig-line {
            width: 100% !important;
            border-bottom: 1px solid #000 !important;
            height: 25px !important;
            margin-bottom: 4px !important;
          }
          .sig-title {
            font-size: 8pt !important;
            font-weight: 700 !important;
            color: #000 !important;
            text-align: center !important;
          }
          .sig-meta {
            font-size: 7.5pt !important;
            color: #475569 !important;
            text-align: center !important;
          }
        }
      }
    }
  `]
})
export class LetterReportsComponent implements OnInit {
  private letterService = inject(LetterService);
  private settingsService = inject(SettingsService);

  allLetters = signal<Letter[]>([]);
  departments = signal<Department[]>([]);
  statuses = ALL_LETTER_STATUSES;
  today = new Date();

  // Active Timeframe Mode: daily | weekly | monthly | custom
  timeframeMode = signal<TimeframeMode>('daily');
  activeTab = signal<ReportViewTab>('status-report');

  // Paper Format for Horizontal Printing: 'A4' or 'legal'
  paperSize = signal<'A4' | 'legal'>('A4');

  // Dates for different modes
  dailyDate: string = this.formatDate(new Date());
  weeklyAnchor: Date = new Date();
  monthlyMonth: string = this.formatMonth(new Date());
  dateFrom: string = this.formatDate(new Date());
  dateTo: string = this.formatDate(new Date());

  dailyDateObj = computed(() => this.dailyDate ? new Date(this.dailyDate + 'T00:00:00') : null);
  customFromObj = computed(() => this.dateFrom ? new Date(this.dateFrom + 'T00:00:00') : null);
  customToObj = computed(() => this.dateTo ? new Date(this.dateTo + 'T00:00:00') : null);

  // Dropdown filters
  selectedDept: string = 'ALL';
  selectedStatus: string = 'ALL';

  ngOnInit() {
    this.applyPageStyle(this.paperSize());

    this.letterService.getLetters().subscribe(letters => {
      this.allLetters.set(letters);
    });

    this.settingsService.getDepartments().subscribe(depts => {
      this.departments.set(depts);
    });

    // Initialize with today for daily
    this.setToday();
  }

  // --- PAPER SIZE & PRINT ORIENTATION ---

  setPaperSize(size: 'A4' | 'legal') {
    this.paperSize.set(size);
    this.applyPageStyle(size);
  }

  applyPageStyle(size: 'A4' | 'legal') {
    if (typeof document === 'undefined') return;
    let styleEl = document.getElementById('print-page-orientation-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'print-page-orientation-style';
      document.head.appendChild(styleEl);
    }
    const pageRule = size === 'legal' ? 'legal landscape' : 'A4 landscape';
    styleEl.innerHTML = `@page { size: ${pageRule}; margin: 7mm 10mm 7mm 10mm; }`;
  }

  // --- TIMEFRAME CONTROLS ---

  setTimeframeMode(mode: TimeframeMode) {
    this.timeframeMode.set(mode);
    if (mode === 'daily') {
      this.onDailyDateChange();
    } else if (mode === 'weekly') {
      this.updateWeeklyDates();
    } else if (mode === 'monthly') {
      this.onMonthlyChange();
    } else if (mode === 'custom') {
      this.onCustomRangeChange();
    }
  }

  // Daily Mode Handlers
  setToday() {
    this.dailyDate = this.formatDate(new Date());
    this.onDailyDateChange();
  }

  prevDay() {
    const d = this.parseDate(this.dailyDate);
    d.setDate(d.getDate() - 1);
    this.dailyDate = this.formatDate(d);
    this.onDailyDateChange();
  }

  nextDay() {
    const d = this.parseDate(this.dailyDate);
    d.setDate(d.getDate() + 1);
    this.dailyDate = this.formatDate(d);
    this.onDailyDateChange();
  }

  onDailyDateChange() {
    this.dateFrom = this.dailyDate;
    this.dateTo = this.dailyDate;
  }

  // Weekly Mode Handlers
  setThisWeek() {
    this.weeklyAnchor = new Date();
    this.updateWeeklyDates();
  }

  prevWeek() {
    this.weeklyAnchor.setDate(this.weeklyAnchor.getDate() - 7);
    this.updateWeeklyDates();
  }

  nextWeek() {
    this.weeklyAnchor.setDate(this.weeklyAnchor.getDate() + 7);
    this.updateWeeklyDates();
  }

  private updateWeeklyDates() {
    const curr = new Date(this.weeklyAnchor);
    const day = curr.getDay(); // 0 = Sun, 1 = Mon...
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(curr);
    mon.setDate(curr.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    this.dateFrom = this.formatDate(mon);
    this.dateTo = this.formatDate(sun);
  }

  // Monthly Mode Handlers
  setThisMonth() {
    this.monthlyMonth = this.formatMonth(new Date());
    this.onMonthlyChange();
  }

  prevMonth() {
    const [year, month] = this.monthlyMonth.split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    this.monthlyMonth = this.formatMonth(prev);
    this.onMonthlyChange();
  }

  nextMonth() {
    const [year, month] = this.monthlyMonth.split('-').map(Number);
    const next = new Date(year, month, 1);
    this.monthlyMonth = this.formatMonth(next);
    this.onMonthlyChange();
  }

  onMonthlyChange() {
    const [year, month] = this.monthlyMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    this.dateFrom = this.formatDate(firstDay);
    this.dateTo = this.formatDate(lastDay);
  }

  // Custom Range Handlers
  onCustomRangeChange() {
    // Already binds to dateFrom & dateTo
  }

  onDailyDatePicked(d: Date | null) {
    if (d) {
      this.dailyDate = this.formatDate(d);
      this.onDailyDateChange();
    }
  }

  onCustomFromPicked(d: Date | null) {
    this.dateFrom = d ? this.formatDate(d) : '';
    this.onCustomRangeChange();
  }

  onCustomToPicked(d: Date | null) {
    this.dateTo = d ? this.formatDate(d) : '';
    this.onCustomRangeChange();
  }

  setCustomPreset(preset: '7d' | '30d' | 'quarter' | 'year' | 'all') {
    const today = new Date();
    this.dateTo = this.formatDate(today);

    if (preset === '7d') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      this.dateFrom = this.formatDate(past);
    } else if (preset === '30d') {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      this.dateFrom = this.formatDate(past);
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const startQuarter = new Date(today.getFullYear(), currentQuarter * 3, 1);
      this.dateFrom = this.formatDate(startQuarter);
    } else if (preset === 'year') {
      const startYear = new Date(today.getFullYear(), 0, 1);
      this.dateFrom = this.formatDate(startYear);
    } else if (preset === 'all') {
      this.dateFrom = '';
      this.dateTo = '';
    }
  }

  resetFilters() {
    this.selectedDept = 'ALL';
    this.selectedStatus = 'ALL';
    this.setTimeframeMode('daily');
    this.setToday();
  }

  toggleStatusFilter(status: LetterStatus) {
    if (this.selectedStatus === status) {
      this.selectedStatus = 'ALL';
    } else {
      this.selectedStatus = status;
    }
  }

  // --- COMPUTED PROPERTIES ---

  // Letters filtered strictly by the date timeframe (before dept / status filters)
  timeframeLetters = computed(() => {
    let list = this.allLetters();
    if (this.dateFrom) {
      list = list.filter(l => l.received_date >= this.dateFrom);
    }
    if (this.dateTo) {
      list = list.filter(l => l.received_date <= this.dateTo);
    }
    return list;
  });

  // Letters filtered by timeframe AND department AND status
  filteredLetters = computed(() => {
    let list = this.timeframeLetters();

    if (this.selectedDept !== 'ALL') {
      list = list.filter(l => l.send_to?.includes(this.selectedDept));
    }
    if (this.selectedStatus !== 'ALL') {
      list = list.filter(l => l.status === this.selectedStatus);
    }

    return list;
  });

  // Status breakdown array for cards
  statusBreakdown = computed<StatusItem[]>(() => {
    let letters = this.timeframeLetters();
    if (this.selectedDept !== 'ALL') {
      letters = letters.filter(l => l.send_to?.includes(this.selectedDept));
    }
    const total = letters.length;

    const icons: Record<LetterStatus, string> = {
      'Received': 'mark_email_read',
      'In Review': 'find_in_page',
      'Action Required': 'pending_actions',
      'In Progress': 'hourglass_top',
      'Completed': 'task_alt',
      'Dispatched': 'send',
      'Archived': 'archive'
    };

    const classes: Record<LetterStatus, string> = {
      'Received': 'st-received',
      'In Review': 'st-in-review',
      'Action Required': 'st-action-required',
      'In Progress': 'st-in-progress',
      'Completed': 'st-completed',
      'Dispatched': 'st-dispatched',
      'Archived': 'st-archived'
    };

    return this.statuses.map(st => {
      const count = letters.filter(l => l.status === st).length;
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        status: st,
        count,
        percent,
        icon: icons[st] || 'flag',
        cssClass: classes[st] || ''
      };
    });
  });

  // Department-wise Status Matrix cross-tabulation
  departmentMatrix = computed<DeptMatrixRow[]>(() => {
    const letters = this.timeframeLetters();
    const depts = this.departments();

    const rows: DeptMatrixRow[] = depts.map(d => {
      const deptLetters = letters.filter(l => l.send_to?.includes(d.name));
      const received = deptLetters.filter(l => l.status === 'Received').length;
      const inReview = deptLetters.filter(l => l.status === 'In Review').length;
      const actionRequired = deptLetters.filter(l => l.status === 'Action Required').length;
      const inProgress = deptLetters.filter(l => l.status === 'In Progress').length;
      const completed = deptLetters.filter(l => l.status === 'Completed').length;
      const dispatched = deptLetters.filter(l => l.status === 'Dispatched').length;
      const archived = deptLetters.filter(l => l.status === 'Archived').length;
      const total = deptLetters.length;
      const resolved = completed + dispatched;
      const turnaroundRate = total > 0 ? Math.round((resolved / total) * 100) + '%' : '0%';

      return {
        department: d.name,
        code: d.code,
        received,
        inReview,
        actionRequired,
        inProgress,
        completed,
        dispatched,
        archived,
        total,
        turnaroundRate
      };
    });

    // Check for unassigned / general letters (no departments matching)
    const unassignedLetters = letters.filter(l => !l.send_to?.length);
    if (unassignedLetters.length > 0) {
      const received = unassignedLetters.filter(l => l.status === 'Received').length;
      const inReview = unassignedLetters.filter(l => l.status === 'In Review').length;
      const actionRequired = unassignedLetters.filter(l => l.status === 'Action Required').length;
      const inProgress = unassignedLetters.filter(l => l.status === 'In Progress').length;
      const completed = unassignedLetters.filter(l => l.status === 'Completed').length;
      const dispatched = unassignedLetters.filter(l => l.status === 'Dispatched').length;
      const archived = unassignedLetters.filter(l => l.status === 'Archived').length;
      const total = unassignedLetters.length;
      const resolved = completed + dispatched;
      const turnaroundRate = total > 0 ? Math.round((resolved / total) * 100) + '%' : '0%';

      rows.push({
        department: 'General / Unassigned',
        code: 'GEN',
        received,
        inReview,
        actionRequired,
        inProgress,
        completed,
        dispatched,
        archived,
        total,
        turnaroundRate
      });
    }

    return rows;
  });

  // Totals row for the Department Matrix
  matrixTotals = computed(() => {
    const rows = this.departmentMatrix();
    const sum = (key: keyof DeptMatrixRow) => rows.reduce((acc, r) => acc + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);

    const received = sum('received');
    const inReview = sum('inReview');
    const actionRequired = sum('actionRequired');
    const inProgress = sum('inProgress');
    const completed = sum('completed');
    const dispatched = sum('dispatched');
    const archived = sum('archived');
    const total = sum('total');
    const turnaroundRate = total > 0 ? Math.round(((completed + dispatched) / total) * 100) + '%' : '0%';

    return {
      received,
      inReview,
      actionRequired,
      inProgress,
      completed,
      dispatched,
      archived,
      total,
      turnaroundRate
    };
  });

  // Priority counts
  priorityCounts = computed(() => {
    const list = this.filteredLetters();
    return {
      normal: list.filter(l => !l.priority || l.priority === 'Normal').length,
      urgent: list.filter(l => l.priority === 'Urgent').length,
      immediate: list.filter(l => l.priority === 'Immediate').length
    };
  });

  // Resolved count (Completed or Dispatched)
  resolvedCount = computed(() => {
    return this.filteredLetters().filter(l => l.status === 'Completed' || l.status === 'Dispatched').length;
  });

  // Pending count (awaiting final action)
  pendingCount = computed(() => {
    return this.filteredLetters().length - this.resolvedCount();
  });

  // Overall Resolution Rate %
  resolutionRate = computed(() => {
    const total = this.filteredLetters().length;
    if (total === 0) return '0%';
    return Math.round((this.resolvedCount() / total) * 100) + '%';
  });

  // User-facing Label for current reporting timeframe
  reportPeriodLabel = computed(() => {
    const mode = this.timeframeMode();
    if (mode === 'daily') {
      if (!this.dailyDate) return 'Today';
      const d = this.parseDate(this.dailyDate);
      return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (mode === 'weekly') {
      if (!this.dateFrom || !this.dateTo) return 'This Week';
      const from = this.parseDate(this.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const to = this.parseDate(this.dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${from} – ${to} (Weekly)`;
    }
    if (mode === 'monthly') {
      if (!this.monthlyMonth) return 'This Month';
      const [year, month] = this.monthlyMonth.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    // Custom
    if (!this.dateFrom && !this.dateTo) return 'All Recorded Time';
    return `${this.dateFrom || 'Start'} to ${this.dateTo || 'Present'}`;
  });

  // --- HELPERS ---

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatMonth(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private parseDate(str: string): Date {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  getRateClass(rate: string): string {
    const val = parseInt(rate, 10) || 0;
    if (val >= 70) return 'high';
    if (val >= 40) return 'mid';
    return 'low';
  }

  printReport(size?: 'A4' | 'legal') {
    const chosenSize = size || this.paperSize();
    this.paperSize.set(chosenSize);
    this.applyPageStyle(chosenSize);
    setTimeout(() => {
      window.print();
    }, 80);
  }

  exportLettersCSV() {
    const rows = this.filteredLetters();
    if (rows.length === 0) {
      alert('No letters to export for the selected period.');
      return;
    }

    const headers = [
      'Ref Number',
      'Title',
      'Received Date',
      'Link Ref',
      'Received From',
      'Departments',
      'Assigned Officers',
      'Category',
      'Priority',
      'Status',
      'Description'
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.ref_number || ''}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${r.received_date || ''}"`,
        `"${(r.link_ref || '').replace(/"/g, '""')}"`,
        `"${(r.received_from || '').replace(/"/g, '""')}"`,
        `"${(r.send_to || []).join('; ')}"`,
        `"${(r.assigned_user_names || r.assigned_to || []).join('; ')}"`,
        `"${r.category || ''}"`,
        `"${r.priority || ''}"`,
        `"${r.status || ''}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    this.downloadCSV(csvContent, `official_letters_${this.timeframeMode()}_${this.formatDate(new Date())}.csv`);
  }

  exportStatusMatrixCSV() {
    const matrix = this.departmentMatrix();
    if (matrix.length === 0) {
      alert('No matrix data to export for the selected period.');
      return;
    }

    const headers = [
      'Department',
      'Code',
      'Received',
      'In Review',
      'Action Required',
      'In Progress',
      'Completed',
      'Dispatched',
      'Archived',
      'Total Letters',
      'Resolution Rate'
    ];

    const csvContent = [
      headers.join(','),
      ...matrix.map(r => [
        `"${r.department}"`,
        `"${r.code || ''}"`,
        r.received,
        r.inReview,
        r.actionRequired,
        r.inProgress,
        r.completed,
        r.dispatched,
        r.archived,
        r.total,
        `"${r.turnaroundRate}"`
      ].join(',')),
      // Totals Row
      [
        '"SUMMARY TOTAL"',
        '""',
        this.matrixTotals().received,
        this.matrixTotals().inReview,
        this.matrixTotals().actionRequired,
        this.matrixTotals().inProgress,
        this.matrixTotals().completed,
        this.matrixTotals().dispatched,
        this.matrixTotals().archived,
        this.matrixTotals().total,
        `"${this.matrixTotals().turnaroundRate}"`
      ].join(',')
    ].join('\n');

    this.downloadCSV(csvContent, `status_report_matrix_${this.timeframeMode()}_${this.formatDate(new Date())}.csv`);
  }

  private downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
