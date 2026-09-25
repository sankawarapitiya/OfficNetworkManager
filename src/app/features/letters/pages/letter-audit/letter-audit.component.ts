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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { LetterService, LetterAuditRecord } from '../../services/letter.service';

@Component({
  selector: 'app-letter-audit',
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
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="page-container max-w-7xl mx-auto p-4 md:p-6">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Letter Audit Log & Chain of Custody</h1>
          <p class="page-desc">Tamper-evident chronological timeline of letter registrations, status changes, and officer directives.</p>
        </div>
      </div>

      <!-- Filters -->
      <mat-card class="filter-card">
        <div class="filter-row">
          <mat-form-field appearance="outline" class="search-field compact-field" subscriptSizing="dynamic">
            <mat-label>Search Reference, Officer, or Directive Remarks...</mat-label>
            <input matInput [ngModel]="searchKeyword()" (ngModelChange)="searchKeyword.set($event)" placeholder="e.g. LET/2026, John, Received">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="action-field compact-field" subscriptSizing="dynamic">
            <mat-label>Event Type</mat-label>
            <mat-select [ngModel]="selectedAction()" (ngModelChange)="selectedAction.set($event)">
              <mat-option value="ALL">All Events</mat-option>
              <mat-option value="CREATED">Registration (Created)</mat-option>
              <mat-option value="STATUS_CHANGED">Status Transition</mat-option>
              <mat-option value="UPDATED">Record Updated</mat-option>
              <mat-option value="DELETED">Record Deleted</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Date From with Material Datepicker -->
          <mat-form-field appearance="outline" class="date-field compact-field" subscriptSizing="dynamic">
            <mat-label>Date From</mat-label>
            <input matInput [matDatepicker]="auditFromPicker" [ngModel]="dateFromObj()" (ngModelChange)="onDateFromChange($event)" (click)="auditFromPicker.open()" placeholder="Select date">
            <mat-datepicker-toggle matIconSuffix [for]="auditFromPicker"></mat-datepicker-toggle>
            <mat-datepicker #auditFromPicker></mat-datepicker>
          </mat-form-field>

          <!-- Date To with Material Datepicker -->
          <mat-form-field appearance="outline" class="date-field compact-field" subscriptSizing="dynamic">
            <mat-label>Date To</mat-label>
            <input matInput [matDatepicker]="auditToPicker" [ngModel]="dateToObj()" (ngModelChange)="onDateToChange($event)" (click)="auditToPicker.open()" placeholder="Select date">
            <mat-datepicker-toggle matIconSuffix [for]="auditToPicker"></mat-datepicker-toggle>
            <mat-datepicker #auditToPicker></mat-datepicker>
          </mat-form-field>

          <button mat-icon-button (click)="resetFilters()" matTooltip="Reset Filters" class="reset-btn sm-btn">
            <mat-icon>restart_alt</mat-icon>
          </button>
        </div>
      </mat-card>

      <!-- Audit Timeline Feed -->
      <div class="timeline-container">
        <div *ngFor="let record of filteredRecords()" class="audit-item">
          <div class="audit-icon-wrap" [ngClass]="record.action_type.toLowerCase()">
            <mat-icon>{{ getActionIcon(record.action_type) }}</mat-icon>
          </div>

          <mat-card class="audit-card">
            <div class="audit-hdr">
              <div class="ref-title-wrap">
                <span class="ref-mono">{{ record.letter_ref }}</span>
                <span class="letter-title">{{ record.letter_title }}</span>
              </div>
              <span class="timestamp">{{ record.timestamp | date:'medium' }}</span>
            </div>

            <div class="officer-row">
              <mat-icon class="sm-icon">person</mat-icon>
              <span>Officer: <strong>{{ record.officer_name }}</strong></span>
              <span class="action-badge" [ngClass]="record.action_type.toLowerCase()">{{ record.action_type }}</span>
            </div>

            <!-- If status changed, show transition -->
            <div *ngIf="record.from_status && record.to_status" class="transition-row">
              <span class="from-st">{{ record.from_status }}</span>
              <mat-icon class="arrow-icon">arrow_forward</mat-icon>
              <span class="to-st">{{ record.to_status }}</span>
            </div>

            <p class="details-text">{{ record.details }}</p>
          </mat-card>
        </div>

        <div *ngIf="filteredRecords().length === 0" class="empty-state">
          <mat-icon class="empty-icon">history_toggle_off</mat-icon>
          <p>No audit trail records found matching your filters.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 12px; }
    .page-header {
      .page-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
      .page-desc { font-size: 12.5px; color: #64748b; margin: 2px 0 0 0; }
    }
    .filter-card {
      padding: 8px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .filter-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      .search-field { flex: 1; min-width: 240px; }
      .action-field { width: 180px; }
      .date-field { width: 155px; }
      .sm-btn {
        width: 32px;
        height: 32px;
        line-height: 32px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }
    .timeline-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 4px;
    }
    .audit-item {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .audit-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 4px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.created { background: #dcfce7; color: #16a34a; }
      &.status_changed { background: #dbeafe; color: #2563eb; }
      &.updated { background: #fef3c7; color: #d97706; }
      &.deleted { background: #fee2e2; color: #dc2626; }
    }
    .audit-card {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .audit-hdr {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 4px;
      .ref-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        .ref-mono {
          font-family: monospace;
          font-weight: 700;
          color: #1e40af;
          background: #eff6ff;
          padding: 1px 6px;
          border-radius: 4px;
        }
        .letter-title { font-weight: 700; color: #0f172a; font-size: 12.5px; }
      }
      .timestamp { font-size: 10.5px; color: #94a3b8; }
    }
    .officer-row {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      color: #475569;
      margin-bottom: 4px;
      .sm-icon { font-size: 13px; width: 13px; height: 13px; color: #64748b; }
      .action-badge {
        font-size: 9.5px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        text-transform: uppercase;
        margin-left: 6px;
        &.created { background: #dcfce7; color: #166534; }
        &.status_changed { background: #dbeafe; color: #1e40af; }
        &.updated { background: #fef3c7; color: #92400e; }
        &.deleted { background: #fee2e2; color: #991b1b; }
      }
    }
    .transition-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
      font-size: 11px;
      .from-st { color: #64748b; }
      .arrow-icon { font-size: 13px; width: 13px; height: 13px; color: #94a3b8; }
      .to-st { font-weight: 700; color: #2563eb; }
    }
    .details-text {
      margin: 0;
      font-size: 12px;
      color: #334155;
      line-height: 1.35;
      background: #f8fafc;
      padding: 6px 10px;
      border-radius: 4px;
    }
    .empty-state {
      text-align: center;
      padding: 32px;
      color: #94a3b8;
      .empty-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 6px; }
      p { margin: 0; font-size: 12.5px; }
    }
  `]
})
export class LetterAuditComponent implements OnInit {
  private letterService = inject(LetterService);

  auditRecords = signal<LetterAuditRecord[]>([]);
  searchKeyword = signal<string>('');
  selectedAction = signal<string>('ALL');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');

  dateFromObj = computed(() => this.dateFrom() ? new Date(this.dateFrom() + 'T00:00:00') : null);
  dateToObj = computed(() => this.dateTo() ? new Date(this.dateTo() + 'T00:00:00') : null);

  filteredRecords = computed(() => {
    let list = this.auditRecords();
    const kw = this.searchKeyword().toLowerCase().trim();

    if (kw) {
      list = list.filter(r => 
        (r.letter_ref || '').toLowerCase().includes(kw) ||
        (r.letter_title || '').toLowerCase().includes(kw) ||
        (r.officer_name || '').toLowerCase().includes(kw) ||
        (r.details || '').toLowerCase().includes(kw)
      );
    }

    if (this.selectedAction() !== 'ALL') {
      list = list.filter(r => r.action_type === this.selectedAction());
    }

    const dFrom = this.dateFrom();
    if (dFrom) {
      const fromTs = new Date(dFrom + 'T00:00:00').getTime();
      list = list.filter(r => r.timestamp >= fromTs);
    }

    const dTo = this.dateTo();
    if (dTo) {
      const toTs = new Date(dTo + 'T23:59:59').getTime();
      list = list.filter(r => r.timestamp <= toTs);
    }

    return list;
  });

  ngOnInit() {
    this.letterService.getAuditLogs().subscribe(logs => {
      this.auditRecords.set(logs);
    });
  }

  formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onDateFromChange(d: Date | null) {
    this.dateFrom.set(d ? this.formatDate(d) : '');
  }

  onDateToChange(d: Date | null) {
    this.dateTo.set(d ? this.formatDate(d) : '');
  }

  resetFilters() {
    this.searchKeyword.set('');
    this.selectedAction.set('ALL');
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'CREATED': return 'add_circle';
      case 'STATUS_CHANGED': return 'update';
      case 'UPDATED': return 'edit';
      case 'DELETED': return 'delete';
      default: return 'history';
    }
  }
}
