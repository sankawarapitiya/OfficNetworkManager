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
import { Letter, LetterStatus, ALL_LETTER_STATUSES, LetterPriority, DEFAULT_LETTER_SETTINGS, LetterSettings } from '../../models/letter.model';
import { SettingsService, Department } from '../../../settings/settings.service';

export type TimeframeMode = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportViewType = 
  | 'daily-register'      // Daily Inward Letters Register & Dispatch Sheet (Optimized for daily volume)
  | 'status-matrix'       // Department Workflow Distribution Matrix & Status Analytics
  | 'urgent-directives'   // Urgent Directives & Action Required Audit
  | 'category-report'     // Classification & Subject Category Breakdown
  | 'dept-workload'       // Department Workload & Performance Summary
  | 'ledger'              // Master Correspondence Ledger Register
  | 'executive-combined'; // Executive Master Brief (Combined Full Report)

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

interface CategorySummaryRow {
  category: string;
  total: number;
  percent: number;
  urgent: number;
  pending: number;
  completed: number;
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
    <div class="page-container w-full" [class.compact-density]="densityMode() === 'compact'">

      <!-- ============================================================== -->
      <!-- TOP HEADER & EXPORT / PRINT ACTIONS (No Print) -->
      <!-- ============================================================== -->
      <div class="page-header no-print">
        <div class="header-titles">
          <div class="icon-avatar">
            <mat-icon>assessment</mat-icon>
          </div>
          <div class="title-text-wrap">
            <div class="breadcrumb-text">Official Correspondence & Inward Workflow</div>
            <h1 class="page-title">Reports & Correspondence Analytics</h1>
            <p class="page-desc">Generate official daily inward logs, department distribution matrices, priority directives audits, and executive registers.</p>
          </div>
        </div>

        <div class="actions-group">
          <!-- Density Toggle -->
          <div class="density-pill-group" matTooltip="Toggle row density for high-volume scanning (40+ letters/day)">
            <button type="button" 
                    class="density-btn" 
                    [class.active]="densityMode() === 'standard'" 
                    (click)="densityMode.set('standard')">
              <mat-icon>view_headline</mat-icon> Standard
            </button>
            <button type="button" 
                    class="density-btn" 
                    [class.active]="densityMode() === 'compact'" 
                    (click)="densityMode.set('compact')">
              <mat-icon>density_small</mat-icon> Compact (40+)
            </button>
          </div>

          <!-- Paper Size Pill Selector -->
          <div class="paper-size-pill-group">
            <span class="paper-label">Paper:</span>
            <button type="button" 
                    class="paper-btn" 
                    [class.active]="paperSize() === 'A4'" 
                    (click)="setPaperSize('A4')"
                    matTooltip="A4 Horizontal Landscape (297 × 210 mm)">
              <mat-icon>aspect_ratio</mat-icon> A4 Landscape
            </button>
            <button type="button" 
                    class="paper-btn" 
                    [class.active]="paperSize() === 'legal'" 
                    (click)="setPaperSize('legal')"
                    matTooltip="Legal Horizontal Landscape (356 × 216 mm)">
              <mat-icon>view_compact_alt</mat-icon> Legal Landscape
            </button>
          </div>

          <!-- Print Action with Format Dropdown -->
          <button mat-stroked-button [matMenuTriggerFor]="printMenu" class="action-btn">
            <mat-icon>print</mat-icon> Print Report ({{ paperSize() === 'A4' ? 'A4' : 'Legal' }}) <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #printMenu="matMenu">
            <button mat-menu-item (click)="printReport('A4')">
              <mat-icon>description</mat-icon> Print A4 Horizontal Landscape (297 × 210 mm)
            </button>
            <button mat-menu-item (click)="printReport('legal')">
              <mat-icon>article</mat-icon> Print Legal Horizontal Landscape (356 × 216 mm)
            </button>
          </mat-menu>

          <!-- Export Action Dropdown -->
          <button mat-flat-button color="primary" [matMenuTriggerFor]="exportMenu" class="action-btn">
            <mat-icon>download</mat-icon> Export Data <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #exportMenu="matMenu">
            <button mat-menu-item (click)="exportDailyInwardCSV()">
              <mat-icon>today</mat-icon> Export Daily Inward Register (CSV)
            </button>
            <button mat-menu-item (click)="exportLettersCSV()">
              <mat-icon>table_chart</mat-icon> Export Filtered Correspondence (CSV)
            </button>
            <button mat-menu-item (click)="exportStatusMatrixCSV()">
              <mat-icon>view_list</mat-icon> Export Department Status Matrix (CSV)
            </button>
            <button mat-menu-item (click)="exportCategorySummaryCSV()">
              <mat-icon>category</mat-icon> Export Classification Summary (CSV)
            </button>
          </mat-menu>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- DEDICATED DAILY INWARD QUICK SHORTCUT BANNER (No Print) -->
      <!-- ============================================================== -->
      <div class="daily-inward-quick-banner no-print">
        <div class="banner-left">
          <div class="daily-badge-icon">
            <mat-icon>mark_email_unread</mat-icon>
          </div>
          <div class="banner-text">
            <div class="banner-title">
              <strong>Daily Inward Correspondence Optimization</strong>
              <span class="daily-count-chip">{{ todayInwardCount() }} Registered Today</span>
            </div>
            <div class="banner-sub">One-click quick filters for official daily inward registers and delivery handover sheets.</div>
          </div>
        </div>

        <div class="banner-shortcuts">
          <button type="button" 
                  class="quick-daily-btn"
                  [class.active]="timeframeMode() === 'daily' && isTodayDaily() && activeReportType() === 'daily-register'"
                  (click)="switchToTodayDailyRegister()">
            <mat-icon>today</mat-icon>
            <span>Today's Daily Register</span>
          </button>

          <button type="button" 
                  class="quick-daily-btn"
                  [class.active]="timeframeMode() === 'daily' && isYesterdayDaily() && activeReportType() === 'daily-register'"
                  (click)="switchToYesterdayDailyRegister()">
            <mat-icon>history</mat-icon>
            <span>Yesterday's Inward Log</span>
          </button>

          <button type="button" 
                  class="quick-daily-btn highlight"
                  [class.active]="activeReportType() === 'daily-register'"
                  (click)="activeReportType.set('daily-register')">
            <mat-icon>assignment</mat-icon>
            <span>Daily Dispatch & Handover Sheet</span>
          </button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- REPORT TYPE SELECTOR CARDS (No Print) -->
      <!-- ============================================================== -->
      <div class="report-types-ribbon no-print">
        <div class="ribbon-label">Select Report Type:</div>
        <div class="report-type-cards">
          <!-- 1. Daily Inward Register -->
          <div class="rtype-card" 
               [class.active]="activeReportType() === 'daily-register'"
               (click)="selectReportType('daily-register')">
            <div class="rtype-icon-wrap emerald">
              <mat-icon>today</mat-icon>
            </div>
            <div class="rtype-info">
              <span class="rtype-title">Daily Inward Register</span>
              <span class="rtype-sub">Daily mail log with handover signatures</span>
            </div>
            <span *ngIf="timeframeMode() === 'daily'" class="rtype-badge">{{ filteredLetters().length }} Letters</span>
          </div>

          <!-- 2. Status & Department Matrix -->
          <div class="rtype-card" 
               [class.active]="activeReportType() === 'status-matrix'"
               (click)="selectReportType('status-matrix')">
            <div class="rtype-icon-wrap blue">
              <mat-icon>grid_on</mat-icon>
            </div>
            <div class="rtype-info">
              <span class="rtype-title">Status Matrix & Audit</span>
              <span class="rtype-sub">Cross-tabulation of departments vs workflow</span>
            </div>
            <span class="rtype-badge">{{ departmentMatrix().length }} Depts</span>
          </div>

          <!-- 3. Urgent Directives -->
          <div class="rtype-card" 
               [class.active]="activeReportType() === 'urgent-directives'"
               (click)="selectReportType('urgent-directives')">
            <div class="rtype-icon-wrap rose">
              <mat-icon>notification_important</mat-icon>
            </div>
            <div class="rtype-info">
              <span class="rtype-title">Urgent Directives</span>
              <span class="rtype-sub">Immediate / Urgent pending action items</span>
            </div>
            <span class="rtype-badge red-badge">{{ urgentDirectivesCount() }} Items</span>
          </div>

          <!-- 4. Category Breakdown -->
          <div class="rtype-card" 
               [class.active]="activeReportType() === 'category-report'"
               (click)="selectReportType('category-report')">
            <div class="rtype-icon-wrap amber">
              <mat-icon>category</mat-icon>
            </div>
            <div class="rtype-info">
              <span class="rtype-title">Category Breakdown</span>
              <span class="rtype-sub">Financial, Legal, Circulars, Petitions</span>
            </div>
            <span class="rtype-badge">{{ categorySummary().length }} Types</span>
          </div>

          <!-- 5. Department Workload -->
          <div class="rtype-card" 
               [class.active]="activeReportType() === 'dept-workload'"
               (click)="selectReportType('dept-workload')">
            <div class="rtype-icon-wrap indigo">
              <mat-icon>business</mat-icon>
            </div>
            <div class="rtype-info">
              <span class="rtype-title">Department Workload</span>
              <span class="rtype-sub">Throughput, turnaround and backlog</span>
            </div>
            <span class="rtype-badge">{{ resolutionRate() }} Rate</span>
          </div>

          <!-- 6. Master Ledger -->
          <div class="rtype-card" 
               [class.active]="activeReportType() === 'ledger'"
               (click)="selectReportType('ledger')">
            <div class="rtype-icon-wrap slate">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <div class="rtype-info">
              <span class="rtype-title">Master Ledger</span>
              <span class="rtype-sub">Complete chronological tracking register</span>
            </div>
            <span class="rtype-badge">{{ filteredLetters().length }} Records</span>
          </div>

          <!-- 7. Executive Master Brief -->
          <div class="rtype-card" 
               [class.active]="activeReportType() === 'executive-combined'"
               (click)="selectReportType('executive-combined')">
            <div class="rtype-icon-wrap purple">
              <mat-icon>auto_stories</mat-icon>
            </div>
            <div class="rtype-info">
              <span class="rtype-title">Executive Master Brief</span>
              <span class="rtype-sub">All-in-one comprehensive dossier</span>
            </div>
            <span class="rtype-badge purple-badge">Full Brief</span>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- TIMEFRAME PRESETS & MULTI-FILTER BAR (No Print) -->
      <!-- ============================================================== -->
      <mat-card class="filter-card no-print">
        <!-- Row 1: Timeframe Segmented Control + Search Box + Reset -->
        <div class="filter-top-row">
          <div class="timeframe-segmented">
            <span class="ctrl-label">Timeframe:</span>
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
                <mat-icon>date_range</mat-icon> Custom Range
              </button>
            </div>
          </div>

          <!-- Instant Search Box for 40+ letters -->
          <div class="search-box-wrap">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" 
                   [ngModel]="searchQuery()" 
                   (ngModelChange)="searchQuery.set($event)"
                   placeholder="Search Ref, Title, Sender, or Officer..." 
                   class="search-input">
            <button *ngIf="searchQuery()" mat-icon-button (click)="searchQuery.set('')" class="clear-search-btn">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <button mat-stroked-button (click)="resetFilters()" matTooltip="Reset All Filters" class="reset-filter-btn">
            <mat-icon>restart_alt</mat-icon> Reset Filters
          </button>
        </div>

        <!-- Row 2: 4 Dropdown Filters in Equal Alignment Grid -->
        <div class="filters-grid-row">
          <!-- Department Filter -->
          <mat-form-field appearance="outline" class="compact-field filter-field" subscriptSizing="dynamic">
            <mat-label>Department Filter</mat-label>
            <mat-select [ngModel]="selectedDept()" (ngModelChange)="selectedDept.set($event)">
              <mat-option value="ALL">All Departments</mat-option>
              <mat-option *ngFor="let d of departments()" [value]="d.name">{{ d.name }}</mat-option>
            </mat-select>
            <mat-icon matSuffix>business</mat-icon>
          </mat-form-field>

          <!-- Category Filter -->
          <mat-form-field appearance="outline" class="compact-field filter-field" subscriptSizing="dynamic">
            <mat-label>Classification / Category</mat-label>
            <mat-select [ngModel]="selectedCategory()" (ngModelChange)="selectedCategory.set($event)">
              <mat-option value="ALL">All Categories</mat-option>
              <mat-option *ngFor="let cat of availableCategories()" [value]="cat">{{ cat }}</mat-option>
            </mat-select>
            <mat-icon matSuffix>category</mat-icon>
          </mat-form-field>

          <!-- Priority Filter -->
          <mat-form-field appearance="outline" class="compact-field filter-field" subscriptSizing="dynamic">
            <mat-label>Priority Level</mat-label>
            <mat-select [ngModel]="selectedPriority()" (ngModelChange)="selectedPriority.set($event)">
              <mat-option value="ALL">All Priorities</mat-option>
              <mat-option value="Normal">Normal</mat-option>
              <mat-option value="Urgent">Urgent</mat-option>
              <mat-option value="Immediate">Immediate</mat-option>
            </mat-select>
            <mat-icon matSuffix>flag</mat-icon>
          </mat-form-field>

          <!-- Status Filter -->
          <mat-form-field appearance="outline" class="compact-field filter-field" subscriptSizing="dynamic">
            <mat-label>Workflow Status</mat-label>
            <mat-select [ngModel]="selectedStatus()" (ngModelChange)="selectedStatus.set($event)">
              <mat-option value="ALL">All Statuses</mat-option>
              <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
            </mat-select>
            <mat-icon matSuffix>filter_list</mat-icon>
          </mat-form-field>
        </div>

        <!-- Row 3: Dynamic Date Subcontrols based on Active Mode -->
        <div class="timeframe-subcontrols">
          <!-- DAILY CONTROLS -->
          <div *ngIf="timeframeMode() === 'daily'" class="subcontrol-row">
            <div class="nav-cluster">
              <button mat-icon-button (click)="prevDay()" matTooltip="Previous Day" class="nav-arr-btn">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button mat-stroked-button (click)="setToday()" class="preset-btn" [class.active-preset]="isTodayDaily()">Today</button>
              <button mat-stroked-button (click)="setYesterday()" class="preset-btn" [class.active-preset]="isYesterdayDaily()">Yesterday</button>
              <button mat-icon-button (click)="nextDay()" matTooltip="Next Day" class="nav-arr-btn">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>

            <div class="date-input-wrap">
              <mat-form-field appearance="outline" class="compact-field date-picker-field" subscriptSizing="dynamic">
                <mat-label>Selected Inward Date</mat-label>
                <input matInput [matDatepicker]="dailyPicker" [ngModel]="dailyDateObj()" (ngModelChange)="onDailyDatePicked($event)" (click)="dailyPicker.open()" placeholder="Select date">
                <mat-datepicker-toggle matIconSuffix [for]="dailyPicker"></mat-datepicker-toggle>
                <mat-datepicker #dailyPicker></mat-datepicker>
              </mat-form-field>
            </div>

            <span class="active-badge daily">
              <mat-icon>event</mat-icon> {{ reportPeriodLabel() }}
            </span>

            <div class="daily-batch-pills">
              <span class="batch-chip total"><strong>{{ filteredLetters().length }}</strong> Inward Letters</span>
              <span class="batch-chip urgent" *ngIf="priorityCounts().urgent + priorityCounts().immediate > 0">
                <strong>{{ priorityCounts().urgent + priorityCounts().immediate }}</strong> Urgent Directives
              </span>
              <span class="batch-chip pending"><strong>{{ pendingCount() }}</strong> Pending Action</span>
              <span class="batch-chip resolved"><strong>{{ resolvedCount() }}</strong> Resolved / Dispatched</span>
            </div>
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
              <mat-form-field appearance="outline" class="compact-field date-picker-field" subscriptSizing="dynamic">
                <mat-label>Select Month</mat-label>
                <input matInput type="month" [ngModel]="monthlyMonth()" (ngModelChange)="onMonthlyChange($event)">
              </mat-form-field>
            </div>
            <span class="active-badge monthly">
              <mat-icon>calendar_month</mat-icon> {{ reportPeriodLabel() }}
            </span>
          </div>

          <!-- CUSTOM RANGE CONTROLS -->
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

      <!-- ============================================================== -->
      <!-- EXECUTIVE KPI SUMMARY CARDS (No Print) -->
      <!-- ============================================================== -->
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
            <span class="stat-label">Urgent Directives</span>
            <mat-icon class="stat-icon rose">notification_important</mat-icon>
          </div>
          <span class="stat-val text-red">{{ priorityCounts().urgent + priorityCounts().immediate }}</span>
          <span class="stat-sub">{{ priorityCounts().immediate }} Immediate • {{ priorityCounts().urgent }} Urgent</span>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-top">
            <span class="stat-label">Action Pending</span>
            <mat-icon class="stat-icon orange">pending_actions</mat-icon>
          </div>
          <span class="stat-val text-orange">{{ pendingCount() }}</span>
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

      <!-- ============================================================== -->
      <!-- REPORT TYPE 1: DAILY INWARD REGISTER & DISPATCH SHEET -->
      <!-- ============================================================== -->
      <div *ngIf="activeReportType() === 'daily-register' || activeReportType() === 'executive-combined'" class="report-section print-area">
        
        <!-- Official Printable Header -->
        <div class="official-print-header">
          <div class="ministry-title">GOVERNMENT / CORPORATE OFFICIAL CORRESPONDENCE SYSTEM</div>
          <h2 class="office-name">DAILY INWARD CORRESPONDENCE REGISTER & DISPATCH SHEET</h2>
          <div class="meta-row">
            <span><strong>Inward Date / Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Department Scope:</strong> {{ selectedDept() === 'ALL' ? 'All Departments' : selectedDept() }}</span>
            <span><strong>Classification:</strong> {{ selectedCategory() === 'ALL' ? 'All Categories' : selectedCategory() }}</span>
            <span><strong>Total Inward Letters:</strong> {{ filteredLetters().length }}</span>
            <span><strong>Urgent Items:</strong> {{ priorityCounts().urgent + priorityCounts().immediate }}</span>
            <span><strong>Paper Format:</strong> {{ paperSize() === 'A4' ? 'A4 Landscape' : 'Legal Landscape' }}</span>
            <span><strong>Printed At:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <div class="section-heading-bar no-print">
          <div class="sh-left">
            <mat-icon class="sec-icon emerald-icon">today</mat-icon>
            <div>
              <h3>Daily Inward Correspondence Register & Dispatch Sheet</h3>
              <span class="heading-sub">Official daily mail receipt log with departmental handover and acknowledgement signature columns</span>
            </div>
          </div>
          <div class="sh-right">
            <span class="count-pill">{{ filteredLetters().length }} letters in this daily batch</span>
            <button mat-stroked-button class="sm-btn" (click)="exportDailyInwardCSV()">
              <mat-icon>download</mat-icon> Export Daily Sheet
            </button>
          </div>
        </div>

        <!-- High Volume Daily Inward Table -->
        <div class="table-outer-card">
          <table class="report-table daily-register-table">
            <thead>
              <tr>
                <th style="width: 36px;" class="text-center">#</th>
                <th style="width: 140px;">Reference No.</th>
                <th style="width: 90px;">Inward Date</th>
                <th>Letter Title & Subject</th>
                <th style="width: 150px;">Received From (Sender)</th>
                <th style="width: 110px;">Category</th>
                <th style="width: 130px;">Send To (Dept)</th>
                <th style="width: 130px;">Assigned Officer</th>
                <th style="width: 80px;" class="text-center">Priority</th>
                <th style="width: 100px;" class="text-center">Status</th>
                <th style="width: 170px;" class="ack-header">Receiving Acknowledgement / Sign</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of filteredLetters(); let i = index" class="data-row" [class.urgent-row]="l.priority === 'Immediate' || l.priority === 'Urgent'">
                <td class="text-center row-num">{{ i + 1 }}</td>
                <td>
                  <span class="ref-mono">{{ l.ref_number }}</span>
                  <div *ngIf="l.link_ref" class="link-ref-sub">Link: {{ l.link_ref }}</div>
                </td>
                <td class="date-cell">{{ l.received_date }}</td>
                <td class="subject-cell">
                  <div class="letter-title-text">{{ l.title }}</div>
                  <div *ngIf="l.description" class="letter-desc-snippet">{{ l.description }}</div>
                </td>
                <td class="sender-cell">{{ l.received_from }}</td>
                <td>
                  <span class="cat-chip">{{ l.category || 'General' }}</span>
                </td>
                <td class="dept-cell">
                  <span class="dept-name">{{ (l.send_to && l.send_to.length) ? l.send_to.join(', ') : 'Unassigned' }}</span>
                </td>
                <td class="officer-cell">
                  {{ l.assigned_user_names?.join(', ') || l.assigned_to.join(', ') || 'Pending' }}
                </td>
                <td class="text-center">
                  <span class="priority-tag" [ngClass]="(l.priority || 'Normal').toLowerCase()">
                    {{ l.priority || 'Normal' }}
                  </span>
                </td>
                <td class="text-center">
                  <span class="status-tag" [ngClass]="getStatusClass(l.status)">{{ l.status }}</span>
                </td>
                <!-- Physical Acknowledgement / Delivery Column -->
                <td class="ack-cell">
                  <div class="ack-sign-line">
                    <span class="ack-sub">Sign: ........................</span>
                    <span class="ack-sub">Date: ........................</span>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredLetters().length === 0">
                <td colspan="11" class="text-center p-8 text-gray-500">
                  <div class="empty-wrap">
                    <mat-icon class="empty-icon">mail_outline</mat-icon>
                    <p class="empty-title">No inward letters found for {{ reportPeriodLabel() }}</p>
                    <p class="empty-sub">Adjust the date picker or reset filters to view registered letters.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- REPORT TYPE 2: STATUS & DEPARTMENT DISTRIBUTION MATRIX -->
      <!-- ============================================================== -->
      <div *ngIf="activeReportType() === 'status-matrix' || activeReportType() === 'executive-combined'" class="report-section print-area mt-4">
        
        <div class="official-print-header" *ngIf="activeReportType() === 'status-matrix'">
          <div class="ministry-title">OFFICIAL CORRESPONDENCE WORKFLOW MANAGEMENT</div>
          <h2 class="office-name">DEPARTMENT WORKFLOW & STATUS CROSS-TABULATION MATRIX</h2>
          <div class="meta-row">
            <span><strong>Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Department Scope:</strong> {{ selectedDept() === 'ALL' ? 'All Departments' : selectedDept() }}</span>
            <span><strong>Status Filter:</strong> {{ selectedStatus() === 'ALL' ? 'All Statuses' : selectedStatus() }}</span>
            <span><strong>Paper Format:</strong> {{ paperSize() === 'A4' ? 'A4 Landscape' : 'Legal Landscape' }}</span>
            <span><strong>Generated:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <div class="section-heading-bar no-print">
          <div class="sh-left">
            <mat-icon class="sec-icon blue-icon">grid_on</mat-icon>
            <div>
              <h3>Workflow Status Distribution & Department Cross-Tabulation Matrix</h3>
              <span class="heading-sub">Cross-tabulation of active correspondence by assigned department and resolution rate</span>
            </div>
          </div>
          <button mat-stroked-button class="sm-btn" (click)="exportStatusMatrixCSV()">
            <mat-icon>download</mat-icon> Export Matrix CSV
          </button>
        </div>

        <!-- 7 Interactive Status Cards (Click to filter) -->
        <div class="status-cards-grid no-print">
          <div *ngFor="let s of statusBreakdown()" 
               class="status-summary-card" 
               [ngClass]="[s.cssClass, selectedStatus() === s.status ? 'selected-card' : '']"
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

        <!-- Cross-Tabulation Matrix Table -->
        <div class="table-outer-card">
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
                <th class="stat-col text-center total-header">Total Letters</th>
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
                <td><strong>SUMMARY TOTAL</strong></td>
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
      <!-- REPORT TYPE 3: URGENT DIRECTIVES & PENDING ACTIONS AUDIT -->
      <!-- ============================================================== -->
      <div *ngIf="activeReportType() === 'urgent-directives' || activeReportType() === 'executive-combined'" class="report-section print-area mt-4">
        
        <div class="official-print-header" *ngIf="activeReportType() === 'urgent-directives'">
          <div class="ministry-title">PRIORITY AUDIT & EXECUTIVE MONITORING</div>
          <h2 class="office-name">URGENT DIRECTIVES & PENDING ACTIONS REGISTER</h2>
          <div class="meta-row">
            <span><strong>Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Scope:</strong> Immediate & Urgent Correspondence / Action Required</span>
            <span><strong>Total Items:</strong> {{ urgentDirectivesLetters().length }}</span>
            <span><strong>Generated:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <div class="section-heading-bar no-print">
          <div class="sh-left">
            <mat-icon class="sec-icon rose-icon">notification_important</mat-icon>
            <div>
              <h3>Urgent Directives & Pending Action Items</h3>
              <span class="heading-sub">High-priority correspondence requiring prompt official decision, directive reply, or immediate action</span>
            </div>
          </div>
          <div class="sh-right">
            <span class="count-pill red-pill">{{ urgentDirectivesLetters().length }} items requiring attention</span>
          </div>
        </div>

        <div class="table-outer-card">
          <table class="report-table urgent-table">
            <thead>
              <tr>
                <th style="width: 36px;" class="text-center">#</th>
                <th style="width: 140px;">Reference No.</th>
                <th style="width: 90px;">Date Rec'd</th>
                <th>Directive Title & Subject</th>
                <th style="width: 150px;">Received From</th>
                <th style="width: 120px;">Category</th>
                <th style="width: 130px;">Target Department</th>
                <th style="width: 130px;">Assigned Officer</th>
                <th style="width: 90px;" class="text-center">Priority</th>
                <th style="width: 110px;" class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of urgentDirectivesLetters(); let i = index" class="urgent-item-row">
                <td class="text-center font-bold">{{ i + 1 }}</td>
                <td>
                  <span class="ref-mono font-bold">{{ l.ref_number }}</span>
                  <div *ngIf="l.link_ref" class="link-ref-sub">Link: {{ l.link_ref }}</div>
                </td>
                <td>{{ l.received_date }}</td>
                <td>
                  <strong class="text-rose-900">{{ l.title }}</strong>
                  <div *ngIf="l.description" class="sub-link-meta italic mt-1">{{ l.description }}</div>
                </td>
                <td>{{ l.received_from }}</td>
                <td><span class="cat-chip">{{ l.category }}</span></td>
                <td><strong>{{ (l.send_to && l.send_to.length) ? l.send_to.join(', ') : 'Unassigned' }}</strong></td>
                <td>{{ l.assigned_user_names?.join(', ') || l.assigned_to.join(', ') || 'Unassigned' }}</td>
                <td class="text-center">
                  <span class="priority-tag" [ngClass]="(l.priority || 'Normal').toLowerCase()">
                    {{ l.priority }}
                  </span>
                </td>
                <td class="text-center">
                  <span class="status-tag" [ngClass]="getStatusClass(l.status)">{{ l.status }}</span>
                </td>
              </tr>
              <tr *ngIf="urgentDirectivesLetters().length === 0">
                <td colspan="10" class="text-center p-8 text-green-700 bg-green-50">
                  <div class="empty-wrap">
                    <mat-icon class="text-green-600" style="font-size: 32px; width: 32px; height: 32px;">verified</mat-icon>
                    <p class="font-bold mt-2">Zero Urgent Directives Pending</p>
                    <p class="text-xs text-gray-500">All high-priority correspondence in this timeframe has been cleared or resolved.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- REPORT TYPE 4: CLASSIFICATION & SUBJECT CATEGORY REPORT -->
      <!-- ============================================================== -->
      <div *ngIf="activeReportType() === 'category-report' || activeReportType() === 'executive-combined'" class="report-section print-area mt-4">
        
        <div class="official-print-header" *ngIf="activeReportType() === 'category-report'">
          <div class="ministry-title">CLASSIFICATION & ARCHIVAL REGISTRY</div>
          <h2 class="office-name">CORRESPONDENCE CLASSIFICATION & CATEGORY AUDIT</h2>
          <div class="meta-row">
            <span><strong>Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Categories:</strong> {{ categorySummary().length }} active classifications</span>
            <span><strong>Total Volume:</strong> {{ filteredLetters().length }} letters</span>
            <span><strong>Generated:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <div class="section-heading-bar no-print">
          <div class="sh-left">
            <mat-icon class="sec-icon amber-icon">category</mat-icon>
            <div>
              <h3>Correspondence Classification & Category Breakdown</h3>
              <span class="heading-sub">Analysis of correspondence volume, urgency, and resolution rate by official classification</span>
            </div>
          </div>
          <button mat-stroked-button class="sm-btn" (click)="exportCategorySummaryCSV()">
            <mat-icon>download</mat-icon> Export Category CSV
          </button>
        </div>

        <!-- Category Metric Cards -->
        <div class="category-cards-grid no-print">
          <div *ngFor="let cat of categorySummary()" 
               class="cat-summary-card" 
               [class.selected-cat]="selectedCategory() === cat.category"
               (click)="toggleCategoryFilter(cat.category)">
            <div class="cat-card-top">
              <span class="cat-name">{{ cat.category }}</span>
              <span class="cat-count-badge">{{ cat.total }}</span>
            </div>
            <div class="cat-progress-wrap">
              <mat-progress-bar mode="determinate" [value]="cat.percent" class="cat-progress"></mat-progress-bar>
              <span class="cat-pct-label">{{ cat.percent }}% of volume</span>
            </div>
            <div class="cat-meta-footer">
              <span class="cat-urgent-text" *ngIf="cat.urgent > 0">⚡ {{ cat.urgent }} Urgent</span>
              <span class="cat-rate-text">Rate: {{ cat.turnaroundRate }}</span>
            </div>
          </div>
        </div>

        <!-- Category Summary Table -->
        <div class="table-outer-card">
          <table class="report-table category-table">
            <thead>
              <tr>
                <th style="width: 40px;" class="text-center">#</th>
                <th>Classification / Subject Category</th>
                <th style="width: 120px;" class="text-center">Total Letters</th>
                <th style="width: 120px;" class="text-center">Volume Share</th>
                <th style="width: 120px;" class="text-center">Urgent Items</th>
                <th style="width: 130px;" class="text-center">Action Pending</th>
                <th style="width: 130px;" class="text-center">Resolved / Done</th>
                <th style="width: 130px;" class="text-center">Turnaround Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of categorySummary(); let i = index">
                <td class="text-center">{{ i + 1 }}</td>
                <td><strong>{{ c.category }}</strong></td>
                <td class="text-center font-bold">{{ c.total }}</td>
                <td class="text-center">{{ c.percent }}%</td>
                <td class="text-center" [class.text-red]="c.urgent > 0">{{ c.urgent }}</td>
                <td class="text-center" [class.text-orange]="c.pending > 0">{{ c.pending }}</td>
                <td class="text-center text-green font-bold">{{ c.completed }}</td>
                <td class="text-center">
                  <span class="rate-badge" [ngClass]="getRateClass(c.turnaroundRate)">{{ c.turnaroundRate }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- REPORT TYPE 5: DEPARTMENT WORKLOAD & PERFORMANCE SUMMARY -->
      <!-- ============================================================== -->
      <div *ngIf="activeReportType() === 'dept-workload' || activeReportType() === 'executive-combined'" class="report-section print-area mt-4">
        
        <div class="official-print-header" *ngIf="activeReportType() === 'dept-workload'">
          <div class="ministry-title">DEPARTMENTAL EFFICIENCY & WORKLOAD AUDIT</div>
          <h2 class="office-name">DEPARTMENTAL WORKLOAD & PERFORMANCE SUMMARY</h2>
          <div class="meta-row">
            <span><strong>Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Total Departments:</strong> {{ departmentMatrix().length }}</span>
            <span><strong>Generated:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <div class="section-heading-bar no-print">
          <div class="sh-left">
            <mat-icon class="sec-icon indigo-icon">business</mat-icon>
            <div>
              <h3>Department Workload & Performance Summary</h3>
              <span class="heading-sub">Workload volume, action backlog, and resolution efficiency per department</span>
            </div>
          </div>
        </div>

        <div class="table-outer-card">
          <table class="report-table workload-table">
            <thead>
              <tr>
                <th style="width: 40px;" class="text-center">#</th>
                <th>Department Name</th>
                <th style="width: 80px;" class="text-center">Code</th>
                <th style="width: 120px;" class="text-center">Total Assigned</th>
                <th style="width: 120px;" class="text-center">Active Backlog</th>
                <th style="width: 120px;" class="text-center">Resolved / Done</th>
                <th style="width: 180px;">Efficiency Progress</th>
                <th style="width: 120px;" class="text-center">Resolution Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let d of departmentMatrix(); let i = index">
                <td class="text-center">{{ i + 1 }}</td>
                <td><strong>{{ d.department }}</strong></td>
                <td class="text-center">{{ d.code || '-' }}</td>
                <td class="text-center font-bold">{{ d.total }}</td>
                <td class="text-center" [class.text-red]="(d.received + d.inReview + d.actionRequired + d.inProgress) > 0">
                  {{ d.received + d.inReview + d.actionRequired + d.inProgress }}
                </td>
                <td class="text-center text-green font-bold">{{ d.completed + d.dispatched }}</td>
                <td>
                  <mat-progress-bar mode="determinate" [value]="parseIntRate(d.turnaroundRate)" class="workload-progress"></mat-progress-bar>
                </td>
                <td class="text-center">
                  <span class="rate-badge" [ngClass]="getRateClass(d.turnaroundRate)">{{ d.turnaroundRate }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- REPORT TYPE 6: MASTER CORRESPONDENCE LEDGER REGISTER -->
      <!-- ============================================================== -->
      <div *ngIf="activeReportType() === 'ledger' || activeReportType() === 'executive-combined'" class="report-section print-area mt-4">
        
        <div class="official-print-header" *ngIf="activeReportType() === 'ledger'">
          <div class="ministry-title">CENTRAL REGISTRY ARCHIVAL LOG</div>
          <h2 class="office-name">OFFICIAL INWARD CORRESPONDENCE MASTER LEDGER</h2>
          <div class="meta-row">
            <span><strong>Period:</strong> {{ reportPeriodLabel() }}</span>
            <span><strong>Department:</strong> {{ selectedDept() === 'ALL' ? 'All Departments' : selectedDept() }}</span>
            <span><strong>Category:</strong> {{ selectedCategory() === 'ALL' ? 'All Categories' : selectedCategory() }}</span>
            <span><strong>Total Records:</strong> {{ filteredLetters().length }}</span>
            <span><strong>Generated:</strong> {{ today | date:'medium' }}</span>
          </div>
        </div>

        <div class="section-heading-bar no-print">
          <div class="sh-left">
            <mat-icon class="sec-icon slate-icon">receipt_long</mat-icon>
            <div>
              <h3>Master Correspondence Ledger Register</h3>
              <span class="heading-sub">Total: {{ filteredLetters().length }} registered letters in timeframe</span>
            </div>
          </div>
          <button mat-stroked-button class="sm-btn" (click)="exportLettersCSV()">
            <mat-icon>download</mat-icon> Export Ledger CSV
          </button>
        </div>

        <div class="table-outer-card">
          <table class="report-table ledger-table">
            <thead>
              <tr>
                <th style="width: 36px;" class="text-center">#</th>
                <th style="width: 140px;">Reference No.</th>
                <th style="width: 90px;">Date Rec'd</th>
                <th>Letter Title & Subject</th>
                <th style="width: 150px;">Received From</th>
                <th style="width: 110px;">Category</th>
                <th style="width: 130px;">Send To (Dept)</th>
                <th style="width: 130px;">Assigned Officer</th>
                <th style="width: 80px;" class="text-center">Priority</th>
                <th style="width: 100px;" class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of filteredLetters(); let i = index" class="data-row">
                <td class="text-center">{{ i + 1 }}</td>
                <td>
                  <span class="ref-mono">{{ l.ref_number }}</span>
                  <div *ngIf="l.link_ref" class="link-ref-sub">Ref: {{ l.link_ref }}</div>
                </td>
                <td>{{ l.received_date }}</td>
                <td>
                  <strong>{{ l.title }}</strong>
                  <div *ngIf="l.description" class="sub-link-meta">{{ l.description }}</div>
                </td>
                <td>{{ l.received_from }}</td>
                <td><span class="cat-chip">{{ l.category || 'General' }}</span></td>
                <td>{{ (l.send_to && l.send_to.length) ? l.send_to.join(', ') : '-' }}</td>
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
                <td colspan="10" class="text-center p-8 text-gray-500">
                  No letters registered matching the selected criteria.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- OFFICIAL PRINT SIGNATURE FOOTER (Print only, 4 Horizontal Columns) -->
      <!-- ============================================================== -->
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
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;

      .header-titles {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        min-width: 0;

        .icon-avatar {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #e0f2fe;
          color: #0284c7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          mat-icon { font-size: 26px; width: 26px; height: 26px; }
        }

        .title-text-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;

          .breadcrumb-text {
            font-size: 11px;
            font-weight: 700;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .page-title {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin: 0;
            line-height: 1.2;
          }

          .page-desc {
            font-size: 12.5px;
            color: #64748b;
            margin: 2px 0 0 0;
            line-height: 1.4;
          }
        }
      }

      .actions-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-left: auto;
        .action-btn { height: 36px; font-size: 12.5px; }
      }
    }

    /* Density Switcher */
    .density-pill-group {
      display: inline-flex;
      align-items: center;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 3px;
      border: 1px solid #cbd5e1;

      .density-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: all 0.15s ease;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
        &:hover { color: #0f172a; background: rgba(255,255,255,0.7); }
        &.active {
          background: #ffffff;
          color: #0284c7;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          font-weight: 700;
        }
      }
    }

    /* Paper Size Selector */
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

    /* Dedicated Daily Inward Quick Banner */
    .daily-inward-quick-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #a7f3d0;
      border-radius: 12px;
      padding: 12px 18px;
      width: 100%;
      box-sizing: border-box;

      .banner-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .daily-badge-icon {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: #10b981;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }

        .banner-text {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .banner-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13.5px;
            color: #065f46;

            .daily-count-chip {
              background: #047857;
              color: white;
              font-size: 10px;
              font-weight: 700;
              padding: 2px 7px;
              border-radius: 999px;
            }
          }

          .banner-sub {
            font-size: 11.5px;
            color: #047857;
          }
        }
      }

      .banner-shortcuts {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        .quick-daily-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #6ee7b7;
          background: #ffffff;
          color: #065f46;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &:hover {
            background: #d1fae5;
            border-color: #34d399;
          }

          &.active {
            background: #059669;
            color: #ffffff;
            border-color: #047857;
            box-shadow: 0 2px 4px rgba(5,150,105,0.25);
          }

          &.highlight {
            border-color: #10b981;
            font-weight: 700;
          }
        }
      }
    }

    /* Report Types Navigation Ribbon */
    .report-types-ribbon {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;

      .ribbon-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: #475569;
        letter-spacing: 0.04em;
      }

      .report-type-cards {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 10px;
        width: 100%;
        box-sizing: border-box;

        @media (max-width: 1400px) {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        @media (max-width: 900px) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 500px) {
          grid-template-columns: 1fr;
        }
      }

      .rtype-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        min-width: 0;

        &:hover {
          border-color: #94a3b8;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transform: translateY(-1px);
        }

        &.active {
          border-color: #0284c7;
          background: #f0f9ff;
          box-shadow: 0 4px 14px rgba(2,132,199,0.12);

          .rtype-title { color: #0369a1; }
        }

        .rtype-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }

          &.emerald { background: #ecfdf5; color: #059669; }
          &.blue { background: #eff6ff; color: #2563eb; }
          &.rose { background: #fff1f2; color: #e11d48; }
          &.amber { background: #fffbeb; color: #d97706; }
          &.indigo { background: #eef2ff; color: #4f46e5; }
          &.slate { background: #f1f5f9; color: #475569; }
          &.purple { background: #faf5ff; color: #9333ea; }
        }

        .rtype-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;

          .rtype-title {
            font-size: 12px;
            font-weight: 700;
            color: #1e293b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .rtype-sub {
            font-size: 10.5px;
            color: #64748b;
            line-height: 1.25;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        }

        .rtype-badge {
          align-self: flex-start;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          background: #f1f5f9;
          color: #475569;
          margin-top: 2px;

          &.red-badge { background: #fee2e2; color: #b91c1c; }
          &.purple-badge { background: #f3e8ff; color: #7e22ce; }
        }
      }
    }

    /* Filter Card */
    .filter-card {
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .filter-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      width: 100%;

      .reset-filter-btn {
        height: 36px;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
        margin-left: auto;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .timeframe-segmented {
      display: flex;
      align-items: center;
      gap: 8px;
      .ctrl-label { font-size: 11.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.03em; }
    }

    .pill-group {
      display: inline-flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 2px;
      border: 1px solid #e2e8f0;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      color: #64748b;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { color: #0f172a; background: rgba(255,255,255,0.6); }
      &.active {
        background: #ffffff;
        color: #0284c7;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
    }

    /* Search Box */
    .search-box-wrap {
      display: inline-flex;
      align-items: center;
      position: relative;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0 10px;
      height: 36px;
      min-width: 260px;
      flex: 0 1 320px;

      .search-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; margin-right: 6px; flex-shrink: 0; }
      .search-input {
        border: none;
        outline: none;
        background: transparent;
        font-size: 12px;
        color: #1e293b;
        width: 100%;
        &::placeholder { color: #94a3b8; }
      }
      .clear-search-btn {
        width: 24px;
        height: 24px;
        line-height: 24px;
        flex-shrink: 0;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
      }
    }

    /* Filters Grid Row (4 Aligned Equal Columns) */
    .filters-grid-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      width: 100%;
      box-sizing: border-box;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }

      .filter-field {
        width: 100%;
      }
    }

    .timeframe-subcontrols {
      padding-top: 14px;
      margin-top: 2px;
      border-top: 1px dashed #e2e8f0;
      width: 100%;
      box-sizing: border-box;
    }

    .subcontrol-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      width: 100%;
    }

    .nav-cluster {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      .nav-arr-btn {
        width: 32px;
        height: 32px;
        line-height: 32px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .preset-btn {
        height: 32px;
        font-size: 11.5px;
        font-weight: 600;
        &.active-preset { background: #e0f2fe; color: #0369a1; border-color: #38bdf8; }
      }
    }

    .date-input-wrap {
      width: 220px;
      min-width: 210px;
      flex-shrink: 0;

      .mat-mdc-form-field,
      mat-form-field,
      .date-picker-field {
        width: 100% !important;
        display: block !important;
      }

      .mat-mdc-icon-button {
        width: 32px !important;
        height: 32px !important;
        padding: 4px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        mat-icon {
          font-size: 18px !important;
          width: 18px !important;
          height: 18px !important;
        }
      }

      @media (max-width: 640px) {
        width: 100%;
        min-width: 100%;
      }
    }

    .active-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }

      &.daily { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
      &.weekly { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
      &.monthly { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
      &.custom { background: #fefce8; color: #a16207; border: 1px solid #fef08a; }
    }

    .daily-batch-pills {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
      flex-wrap: wrap;

      @media (max-width: 1100px) {
        margin-left: 0;
        width: 100%;
      }

      .batch-chip {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 500;
        border: 1px solid transparent;
        white-space: nowrap;

        &.total { background: #f1f5f9; color: #1e293b; border-color: #cbd5e1; }
        &.urgent { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        &.pending { background: #ffedd5; color: #9a3412; border-color: #fdba74; }
        &.resolved { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
      }
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
      flex-shrink: 0;
      flex-wrap: wrap;

      .date-field {
        width: 185px;
        min-width: 165px;
        display: block;
      }
      .range-sep { font-size: 12px; color: #64748b; font-weight: 500; }

      .mat-mdc-icon-button {
        width: 32px !important;
        height: 32px !important;
        padding: 4px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        mat-icon {
          font-size: 18px !important;
          width: 18px !important;
          height: 18px !important;
        }
      }

      @media (max-width: 640px) {
        width: 100%;
        .date-field {
          flex: 1;
          width: auto;
          min-width: 130px;
        }
      }
    }

    .quick-chips {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      .quick-chip {
        padding: 4px 9px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        font-size: 11px;
        font-weight: 500;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover { background: #e2e8f0; color: #0f172a; border-color: #94a3b8; }
      }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      width: 100%;
      box-sizing: border-box;

      @media (max-width: 1300px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      @media (max-width: 800px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      @media (max-width: 500px) { grid-template-columns: 1fr; }
    }

    .stat-card {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;

      .stat-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.03em; }
        .stat-icon {
          font-size: 18px; width: 18px; height: 18px;
          &.blue { color: #0284c7; }
          &.rose { color: #e11d48; }
          &.orange { color: #ea580c; }
          &.green { color: #059669; }
          &.purple { color: #9333ea; }
        }
      }

      .stat-val {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.2;
        margin: 2px 0;
      }
      .stat-sub { font-size: 10.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }

    .text-red { color: #dc2626 !important; }
    .text-orange { color: #ea580c !important; }
    .text-green { color: #059669 !important; }
    .text-purple { color: #9333ea !important; }
    .text-indigo { color: #4f46e5 !important; }
    .text-muted { color: #64748b !important; }

    /* Section Headings */
    .section-heading-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      width: 100%;
      box-sizing: border-box;

      .sh-left {
        display: flex;
        align-items: center;
        gap: 8px;
        .sec-icon {
          font-size: 20px; width: 20px; height: 20px;
          &.emerald-icon { color: #059669; }
          &.blue-icon { color: #2563eb; }
          &.rose-icon { color: #e11d48; }
          &.amber-icon { color: #d97706; }
          &.indigo-icon { color: #4f46e5; }
          &.slate-icon { color: #475569; }
        }
        h3 { margin: 0; font-size: 14.5px; font-weight: 700; color: #0f172a; }
        .heading-sub { font-size: 11px; color: #64748b; }
      }

      .sh-right {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
        .count-pill {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #475569;
          &.red-pill { background: #fee2e2; color: #991b1b; }
        }
        .sm-btn { height: 30px; font-size: 11.5px; }
      }
    }

    /* Status Summary Cards Grid */
    .status-cards-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 12px;
      width: 100%;
      box-sizing: border-box;

      @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
      @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); }
    }

    .status-summary-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover { border-color: #94a3b8; transform: translateY(-1px); }
      &.selected-card {
        border-color: #0284c7;
        background: #f0f9ff;
        box-shadow: 0 0 0 2px rgba(2,132,199,0.2);
      }

      .sc-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .sc-status-name { font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #475569; }
        .sc-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
      }

      .sc-val-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        .sc-count { font-size: 16px; font-weight: 800; color: #0f172a; }
        .sc-pct { font-size: 10.5px; font-weight: 600; color: #64748b; }
      }
      .sc-progress { height: 3px; border-radius: 2px; }
    }

    /* Category Cards Grid */
    .category-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
      width: 100%;
      box-sizing: border-box;

      .cat-summary-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover { border-color: #f59e0b; }
        &.selected-cat { border-color: #d97706; background: #fffbeb; }

        .cat-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          .cat-name { font-size: 11.5px; font-weight: 700; color: #1e293b; }
          .cat-count-badge { font-size: 11px; font-weight: 800; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; }
        }

        .cat-progress-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .cat-progress { height: 4px; border-radius: 2px; }
          .cat-pct-label { font-size: 9.5px; color: #64748b; }
        }

        .cat-meta-footer {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
          .cat-urgent-text { color: #dc2626; }
        }
      }
    }

    /* Table Container & Common Table Styles */
    .table-outer-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow-x: auto;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      width: 100%;
      box-sizing: border-box;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;

      thead {
        background: #f8fafc;
        border-bottom: 2px solid #e2e8f0;
        th {
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
      }

      tbody tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background-color 0.15s;
        &:hover { background-color: #f8fafc; }
        &.urgent-row { background-color: #fff1f2; }
      }

      td {
        padding: 8px 10px;
        color: #1e293b;
        vertical-align: middle;
      }
    }

    /* Compact Density Overrides for High Volume */
    .compact-density {
      .report-table {
        font-size: 11px;
        thead th { padding: 5px 8px; font-size: 10px; }
        td { padding: 5px 8px; }
      }
      .letter-desc-snippet { display: none !important; }
      .ack-cell { padding: 3px 6px !important; }
    }

    /* Badges & Pills */
    .ref-mono {
      font-family: monospace;
      font-weight: 700;
      font-size: 11px;
      color: #1e40af;
      background: #eff6ff;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .link-ref-sub {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 2px;
    }

    .cat-chip {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      white-space: nowrap;
    }

    .priority-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      white-space: nowrap;

      &.normal { background: #f1f5f9; color: #475569; }
      &.urgent { background: #fef3c7; color: #92400e; }
      &.immediate { background: #fee2e2; color: #991b1b; }
    }

    .status-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      white-space: nowrap;

      &.received { background: #e0f2fe; color: #0369a1; }
      &.in-review { background: #fef3c7; color: #b45309; }
      &.action-required { background: #fee2e2; color: #b91c1c; }
      &.in-progress { background: #f3e8ff; color: #7e22ce; }
      &.completed { background: #dcfce7; color: #15803d; }
      &.dispatched { background: #e0e7ff; color: #4338ca; }
      &.archived { background: #f1f5f9; color: #64748b; }
    }

    .rate-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      &.high { background: #dcfce7; color: #15803d; }
      &.mid { background: #fef3c7; color: #b45309; }
      &.low { background: #fee2e2; color: #b91c1c; }
    }

    /* Handover / Acknowledgement Column in Daily Register */
    .ack-header { text-align: left; }
    .ack-cell {
      .ack-sign-line {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border: 1px dashed #cbd5e1;
        padding: 4px 6px;
        border-radius: 4px;
        background: #fafafa;
        .ack-sub { font-size: 9.5px; color: #64748b; white-space: nowrap; }
      }
    }

    .letter-title-text {
      font-weight: 600;
      color: #0f172a;
      line-height: 1.3;
    }

    .letter-desc-snippet {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .empty-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      .empty-icon { font-size: 32px; width: 32px; height: 32px; color: #94a3b8; }
      .empty-title { margin: 0; font-size: 13px; font-weight: 700; color: #334155; }
      .empty-sub { margin: 0; font-size: 11.5px; color: #94a3b8; }
    }

    .matrix-table {
      tfoot {
        background: #f8fafc;
        border-top: 2px solid #cbd5e1;
        td { font-weight: 700; padding: 10px; }
      }
      .highlight-cell { font-weight: 700; color: #0284c7; }
      .action-req-cell { font-weight: 800; color: #dc2626; background: #fff1f2; }
      .total-cell { background: #f1f5f9; font-size: 12.5px; }
    }

    .workload-progress { height: 6px; border-radius: 3px; }

    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .mt-1 { margin-top: 4px; }
    .mt-4 { margin-top: 16px; }
    .mt-6 { margin-top: 24px; }

    /* ==============================================================
       OFFICIAL HORIZONTAL LANDSCAPE PRINT STYLES (A4 & Legal)
       ============================================================== */
    .official-print-header {
      display: none; /* Print only */
      text-align: center;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0f172a;

      .ministry-title {
        font-size: 10pt;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #475569;
        margin-bottom: 2px;
      }
      .office-name {
        margin: 0;
        font-size: 14pt;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 0.5px;
      }
      .meta-row {
        display: flex;
        justify-content: center;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 8.5pt;
        color: #334155;
        margin-top: 4px;
      }
    }

    .print-signatures-block {
      display: none; /* Print only */
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
      }

      .table-outer-card {
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
        font-size: 8pt !important;

        thead {
          display: table-header-group !important;
          th {
            background: #f1f5f9 !important;
            color: #000000 !important;
            border: 1px solid #475569 !important;
            padding: 3px 5px !important;
            font-size: 7.5pt !important;
            font-weight: 700 !important;
          }
        }

        tfoot { display: table-footer-group !important; }

        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        td {
          border: 1px solid #64748b !important;
          color: #000000 !important;
          padding: 3px 5px !important;
          font-size: 7.5pt !important;
        }
      }

      .ref-mono {
        font-family: monospace !important;
        font-weight: 700 !important;
        color: #000 !important;
        background: transparent !important;
        padding: 0 !important;
      }

      .priority-tag, .status-tag, .cat-chip {
        border: 1px solid #64748b !important;
        background: transparent !important;
        color: #000 !important;
        padding: 1px 3px !important;
        font-size: 7pt !important;
      }

      .ack-cell .ack-sign-line {
        border: 1px solid #475569 !important;
        background: transparent !important;
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
  letterSettings = signal<LetterSettings>(DEFAULT_LETTER_SETTINGS);
  statuses = ALL_LETTER_STATUSES;
  today = new Date();

  // Active Report View Type: daily-register | status-matrix | urgent-directives | category-report | dept-workload | ledger | executive-combined
  activeReportType = signal<ReportViewType>('daily-register');

  // Timeframe Mode: daily | weekly | monthly | custom
  timeframeMode = signal<TimeframeMode>('daily');

  // Density Mode: standard | compact
  densityMode = signal<'standard' | 'compact'>('compact');

  // Paper Format for Horizontal Printing: 'A4' or 'legal'
  paperSize = signal<'A4' | 'legal'>('A4');

  // Filter Signals (Fully reactive so computed() re-evaluates automatically)
  searchQuery = signal<string>('');
  selectedDept = signal<string>('ALL');
  selectedCategory = signal<string>('ALL');
  selectedPriority = signal<string>('ALL');
  selectedStatus = signal<string>('ALL');

  // Date Signals
  dailyDate = signal<string>(this.formatDate(new Date()));
  weeklyAnchor = signal<Date>(new Date());
  monthlyMonth = signal<string>(this.formatMonth(new Date()));
  dateFrom = signal<string>(this.formatDate(new Date()));
  dateTo = signal<string>(this.formatDate(new Date()));

  dailyDateObj = computed(() => this.dailyDate() ? new Date(this.dailyDate() + 'T00:00:00') : null);
  customFromObj = computed(() => this.dateFrom() ? new Date(this.dateFrom() + 'T00:00:00') : null);
  customToObj = computed(() => this.dateTo() ? new Date(this.dateTo() + 'T00:00:00') : null);

  isTodayDaily = computed(() => this.dailyDate() === this.formatDate(new Date()));
  isYesterdayDaily = computed(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    return this.dailyDate() === this.formatDate(yest);
  });

  ngOnInit() {
    this.applyPageStyle(this.paperSize());

    this.letterService.getLetters().subscribe(letters => {
      this.allLetters.set(letters);
    });

    this.settingsService.getDepartments().subscribe(depts => {
      this.departments.set(depts);
    });

    this.letterService.getSettings().subscribe(s => {
      if (s) {
        this.letterSettings.set({
          ...DEFAULT_LETTER_SETTINGS,
          ...s
        });
      }
    });

    // Default to today daily
    this.setToday();
  }

  // --- REPORT TYPE SELECTOR ---
  selectReportType(type: ReportViewType) {
    this.activeReportType.set(type);
    if (type === 'daily-register') {
      this.setTimeframeMode('daily');
    }
  }

  switchToTodayDailyRegister() {
    this.setTimeframeMode('daily');
    this.setToday();
    this.activeReportType.set('daily-register');
  }

  switchToYesterdayDailyRegister() {
    this.setTimeframeMode('daily');
    this.setYesterday();
    this.activeReportType.set('daily-register');
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

  // --- TIMEFRAME HANDLERS ---
  setTimeframeMode(mode: TimeframeMode) {
    this.timeframeMode.set(mode);
    if (mode === 'daily') {
      this.dateFrom.set(this.dailyDate());
      this.dateTo.set(this.dailyDate());
    } else if (mode === 'weekly') {
      this.updateWeeklyDates();
    } else if (mode === 'monthly') {
      this.updateMonthlyDates(this.monthlyMonth());
    }
  }

  setToday() {
    const todayStr = this.formatDate(new Date());
    this.dailyDate.set(todayStr);
    this.dateFrom.set(todayStr);
    this.dateTo.set(todayStr);
  }

  setYesterday() {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = this.formatDate(yest);
    this.dailyDate.set(yestStr);
    this.dateFrom.set(yestStr);
    this.dateTo.set(yestStr);
  }

  prevDay() {
    const d = this.parseDate(this.dailyDate());
    d.setDate(d.getDate() - 1);
    const dStr = this.formatDate(d);
    this.dailyDate.set(dStr);
    this.dateFrom.set(dStr);
    this.dateTo.set(dStr);
  }

  nextDay() {
    const d = this.parseDate(this.dailyDate());
    d.setDate(d.getDate() + 1);
    const dStr = this.formatDate(d);
    this.dailyDate.set(dStr);
    this.dateFrom.set(dStr);
    this.dateTo.set(dStr);
  }

  // Weekly Mode Handlers
  setThisWeek() {
    this.weeklyAnchor.set(new Date());
    this.updateWeeklyDates();
  }

  prevWeek() {
    const curr = new Date(this.weeklyAnchor());
    curr.setDate(curr.getDate() - 7);
    this.weeklyAnchor.set(curr);
    this.updateWeeklyDates();
  }

  nextWeek() {
    const curr = new Date(this.weeklyAnchor());
    curr.setDate(curr.getDate() + 7);
    this.weeklyAnchor.set(curr);
    this.updateWeeklyDates();
  }

  private updateWeeklyDates() {
    const curr = new Date(this.weeklyAnchor());
    const day = curr.getDay(); // 0 = Sun, 1 = Mon...
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(curr);
    mon.setDate(curr.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    this.dateFrom.set(this.formatDate(mon));
    this.dateTo.set(this.formatDate(sun));
  }

  // Monthly Mode Handlers
  setThisMonth() {
    const mStr = this.formatMonth(new Date());
    this.monthlyMonth.set(mStr);
    this.updateMonthlyDates(mStr);
  }

  prevMonth() {
    const [year, month] = this.monthlyMonth().split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    const mStr = this.formatMonth(prev);
    this.monthlyMonth.set(mStr);
    this.updateMonthlyDates(mStr);
  }

  nextMonth() {
    const [year, month] = this.monthlyMonth().split('-').map(Number);
    const next = new Date(year, month, 1);
    const mStr = this.formatMonth(next);
    this.monthlyMonth.set(mStr);
    this.updateMonthlyDates(mStr);
  }

  onMonthlyChange(monthVal?: string) {
    if (monthVal) {
      this.monthlyMonth.set(monthVal);
    }
    this.updateMonthlyDates(this.monthlyMonth());
  }

  private updateMonthlyDates(monthVal: string) {
    if (!monthVal) return;
    const [year, month] = monthVal.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    this.dateFrom.set(this.formatDate(firstDay));
    this.dateTo.set(this.formatDate(lastDay));
  }

  onDailyDatePicked(d: Date | null) {
    if (d) {
      const dStr = this.formatDate(d);
      this.dailyDate.set(dStr);
      this.dateFrom.set(dStr);
      this.dateTo.set(dStr);
    }
  }

  onCustomFromPicked(d: Date | null) {
    this.dateFrom.set(d ? this.formatDate(d) : '');
  }

  onCustomToPicked(d: Date | null) {
    this.dateTo.set(d ? this.formatDate(d) : '');
  }

  setCustomPreset(preset: '7d' | '30d' | 'quarter' | 'year' | 'all') {
    const today = new Date();
    this.dateTo.set(this.formatDate(today));

    if (preset === '7d') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      this.dateFrom.set(this.formatDate(past));
    } else if (preset === '30d') {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      this.dateFrom.set(this.formatDate(past));
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const startQuarter = new Date(today.getFullYear(), currentQuarter * 3, 1);
      this.dateFrom.set(this.formatDate(startQuarter));
    } else if (preset === 'year') {
      const startYear = new Date(today.getFullYear(), 0, 1);
      this.dateFrom.set(this.formatDate(startYear));
    } else if (preset === 'all') {
      this.dateFrom.set('');
      this.dateTo.set('');
    }
  }

  resetFilters() {
    this.searchQuery.set('');
    this.selectedDept.set('ALL');
    this.selectedCategory.set('ALL');
    this.selectedPriority.set('ALL');
    this.selectedStatus.set('ALL');
    this.setTimeframeMode('daily');
    this.setToday();
  }

  toggleStatusFilter(status: LetterStatus) {
    this.selectedStatus.update(curr => curr === status ? 'ALL' : status);
  }

  toggleCategoryFilter(cat: string) {
    this.selectedCategory.update(curr => curr === cat ? 'ALL' : cat);
  }

  // --- COMPUTED PROPERTIES ---

  availableCategories = computed(() => {
    const s = this.letterSettings();
    if (s.categories && s.categories.length > 0) return s.categories;
    const distinct = Array.from(new Set(this.allLetters().map(l => l.category).filter(Boolean)));
    return distinct.length > 0 ? distinct : DEFAULT_LETTER_SETTINGS.categories;
  });

  // Today's total registered inward count
  todayInwardCount = computed(() => {
    const todayStr = this.formatDate(new Date());
    return this.allLetters().filter(l => l.received_date === todayStr).length;
  });

  // Letters filtered strictly by the date timeframe (before dept / category / status / search)
  timeframeLetters = computed(() => {
    let list = this.allLetters();
    const from = this.dateFrom();
    const to = this.dateTo();
    if (from) {
      list = list.filter(l => l.received_date >= from);
    }
    if (to) {
      list = list.filter(l => l.received_date <= to);
    }
    return list;
  });

  // Letters filtered by timeframe AND department, category, priority, status, and search query
  filteredLetters = computed(() => {
    let list = this.timeframeLetters();
    const dept = this.selectedDept();
    const cat = this.selectedCategory();
    const priority = this.selectedPriority();
    const status = this.selectedStatus();
    const q = this.searchQuery().toLowerCase().trim();

    if (dept !== 'ALL') {
      list = list.filter(l => l.send_to?.includes(dept));
    }
    if (cat !== 'ALL') {
      list = list.filter(l => l.category === cat);
    }
    if (priority !== 'ALL') {
      list = list.filter(l => l.priority === priority);
    }
    if (status !== 'ALL') {
      list = list.filter(l => l.status === status);
    }

    if (q) {
      list = list.filter(l =>
        l.ref_number?.toLowerCase().includes(q) ||
        l.title?.toLowerCase().includes(q) ||
        l.received_from?.toLowerCase().includes(q) ||
        l.link_ref?.toLowerCase().includes(q) ||
        l.category?.toLowerCase().includes(q) ||
        l.send_to?.some(d => d.toLowerCase().includes(q)) ||
        l.assigned_user_names?.some(u => u.toLowerCase().includes(q)) ||
        l.assigned_to?.some(u => u.toLowerCase().includes(q))
      );
    }

    return list;
  });

  // Urgent Directives Letters (Priority Immediate / Urgent OR Status Action Required)
  urgentDirectivesLetters = computed(() => {
    return this.filteredLetters().filter(l => 
      l.priority === 'Immediate' || 
      l.priority === 'Urgent' || 
      l.status === 'Action Required'
    );
  });

  urgentDirectivesCount = computed(() => this.urgentDirectivesLetters().length);

  // Status breakdown array for cards
  statusBreakdown = computed<StatusItem[]>(() => {
    let letters = this.filteredLetters();
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
    const letters = this.filteredLetters();
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

    // Check for unassigned / general letters
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

  // Category summary array
  categorySummary = computed<CategorySummaryRow[]>(() => {
    const letters = this.filteredLetters();
    const totalAll = letters.length;
    const cats = this.availableCategories();
    const selected = this.selectedCategory();

    return cats.map(cat => {
      const catLetters = letters.filter(l => l.category === cat);
      const total = catLetters.length;
      const percent = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0;
      const urgent = catLetters.filter(l => l.priority === 'Urgent' || l.priority === 'Immediate').length;
      const completed = catLetters.filter(l => l.status === 'Completed' || l.status === 'Dispatched').length;
      const pending = total - completed;
      const turnaroundRate = total > 0 ? Math.round((completed / total) * 100) + '%' : '0%';

      return {
        category: cat,
        total,
        percent,
        urgent,
        pending,
        completed,
        turnaroundRate
      };
    }).filter(c => c.total > 0 || selected === c.category);
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

  // Pending count
  pendingCount = computed(() => {
    return this.filteredLetters().length - this.resolvedCount();
  });

  // Overall Resolution Rate %
  resolutionRate = computed(() => {
    const total = this.filteredLetters().length;
    if (total === 0) return '0%';
    return Math.round((this.resolvedCount() / total) * 100) + '%';
  });

  // Period Label for header
  reportPeriodLabel = computed(() => {
    const mode = this.timeframeMode();
    if (mode === 'daily') {
      const dVal = this.dailyDate();
      if (!dVal) return 'Today';
      const d = this.parseDate(dVal);
      return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (mode === 'weekly') {
      const from = this.dateFrom();
      const to = this.dateTo();
      if (!from || !to) return 'This Week';
      const fromStr = this.parseDate(from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const toStr = this.parseDate(to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${fromStr} – ${toStr} (Weekly)`;
    }
    if (mode === 'monthly') {
      const mVal = this.monthlyMonth();
      if (!mVal) return 'This Month';
      const [year, month] = mVal.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    const from = this.dateFrom();
    const to = this.dateTo();
    if (!from && !to) return 'All Recorded Time';
    return `${from || 'Start'} to ${to || 'Present'}`;
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

  parseIntRate(rate: string): number {
    return parseInt(rate, 10) || 0;
  }

  // --- PRINTING ---
  printReport(size?: 'A4' | 'legal') {
    const chosenSize = size || this.paperSize();
    this.paperSize.set(chosenSize);
    this.applyPageStyle(chosenSize);
    setTimeout(() => {
      window.print();
    }, 80);
  }

  // --- EXPORT HANDLERS ---
  exportDailyInwardCSV() {
    const rows = this.filteredLetters();
    if (rows.length === 0) {
      alert('No daily inward letters found to export.');
      return;
    }

    const headers = [
      '#',
      'Official Reference No.',
      'Inward Date',
      'Letter Title / Subject',
      'Linked Ref',
      'Received From',
      'Category',
      'Send To Departments',
      'Assigned Officers',
      'Priority',
      'Workflow Status',
      'Remarks / Directives'
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map((r, i) => [
        i + 1,
        `"${r.ref_number || ''}"`,
        `"${r.received_date || ''}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.link_ref || '').replace(/"/g, '""')}"`,
        `"${(r.received_from || '').replace(/"/g, '""')}"`,
        `"${r.category || ''}"`,
        `"${(r.send_to || []).join('; ')}"`,
        `"${(r.assigned_user_names || r.assigned_to || []).join('; ')}"`,
        `"${r.priority || ''}"`,
        `"${r.status || ''}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    this.downloadCSV(csvContent, `daily_inward_register_${this.dailyDate() || this.formatDate(new Date())}.csv`);
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

  exportCategorySummaryCSV() {
    const summary = this.categorySummary();
    if (summary.length === 0) {
      alert('No category data to export.');
      return;
    }

    const headers = [
      'Category',
      'Total Letters',
      'Volume Share (%)',
      'Urgent Items',
      'Action Pending',
      'Resolved / Completed',
      'Turnaround Rate'
    ];

    const csvContent = [
      headers.join(','),
      ...summary.map(c => [
        `"${c.category}"`,
        c.total,
        c.percent,
        c.urgent,
        c.pending,
        c.completed,
        `"${c.turnaroundRate}"`
      ].join(','))
    ].join('\n');

    this.downloadCSV(csvContent, `category_summary_${this.timeframeMode()}_${this.formatDate(new Date())}.csv`);
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
