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

import { LandService } from '../../services/land.service';
import { LandAuditRecord } from '../../models/land.model';

@Component({
  selector: 'app-land-audit',
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
    <div class="page-container w-full">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Land Cadastral Audit Log & Chain of Custody</h1>
          <p class="page-desc">Chronological tamper-evident audit trail of land task registrations, document submissions, and surveyor verifications.</p>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <mat-card class="filter-card">
        <div class="filter-row">
          <mat-form-field appearance="outline" class="search-field compact-field" subscriptSizing="dynamic">
            <mat-label>Search Reference, Officer, or Action Details...</mat-label>
            <input matInput [ngModel]="searchKeyword()" (ngModelChange)="searchKeyword.set($event)" placeholder="e.g. LND-2026, Gunasekara, Survey">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="action-field compact-field" subscriptSizing="dynamic">
            <mat-label>Event Type</mat-label>
            <mat-select [ngModel]="selectedAction()" (ngModelChange)="selectedAction.set($event)">
              <mat-option value="ALL">All Events</mat-option>
              <mat-option value="CREATED">Registration (Created)</mat-option>
              <mat-option value="STAGE_TRANSITION">Stage Transition</mat-option>
              <mat-option value="DOC_SUBMITTED">Document Uploaded</mat-option>
              <mat-option value="VERIFICATION_UPDATED">Verification Sign-off</mat-option>
              <mat-option value="COMPLETED">Task Completed</mat-option>
              <mat-option value="UPDATED">Record Updated</mat-option>
              <mat-option value="DELETED">Record Deleted</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Date From -->
          <mat-form-field appearance="outline" class="date-field compact-field" subscriptSizing="dynamic">
            <mat-label>Date From</mat-label>
            <input matInput [matDatepicker]="auditFromPicker" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" (click)="auditFromPicker.open()" placeholder="Select date">
            <mat-datepicker-toggle matIconSuffix [for]="auditFromPicker"></mat-datepicker-toggle>
            <mat-datepicker #auditFromPicker></mat-datepicker>
          </mat-form-field>

          <!-- Date To -->
          <mat-form-field appearance="outline" class="date-field compact-field" subscriptSizing="dynamic">
            <mat-label>Date To</mat-label>
            <input matInput [matDatepicker]="auditToPicker" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" (click)="auditToPicker.open()" placeholder="Select date">
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
        <div *ngIf="filteredRecords().length === 0" class="empty-feed">
          <mat-icon>history_toggle_off</mat-icon>
          <p>No audit events match your search filters.</p>
        </div>

        <div *ngFor="let record of filteredRecords()" class="audit-item">
          <div class="audit-icon-wrap" [ngClass]="record.actionType.toLowerCase()">
            <mat-icon>{{ getActionIcon(record.actionType) }}</mat-icon>
          </div>

          <mat-card class="audit-card">
            <div class="audit-hdr">
              <div class="ref-title-wrap">
                <span class="ref-mono">{{ record.jobRef }}</span>
                <span class="job-type-text">{{ record.jobTypeName }}</span>
              </div>
              <span class="timestamp">{{ record.timestamp | date:'medium' }}</span>
            </div>

            <div class="officer-row">
              <span class="officer-name">
                <mat-icon class="sm-icon">person</mat-icon> {{ record.officerName }}
              </span>
              <span class="event-type-tag" [ngClass]="record.actionType.toLowerCase()">
                {{ record.actionType }}
              </span>
              <span *ngIf="record.toStage" class="stage-transition-pill">
                <span *ngIf="record.fromStage">{{ record.fromStage }} <mat-icon class="arrow-icon">arrow_forward</mat-icon></span>
                {{ record.toStage }}
              </span>
            </div>

            <div class="details-body">
              <p>{{ record.details }}</p>
            </div>
          </mat-card>
        </div>
      </div>
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
      .page-title { font-size: 1.5rem; font-weight: 800; margin: 0; color: #0f172a; }
      .page-desc { margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem; }
    }

    .filter-card {
      padding: 14px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;

      .filter-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;

        .search-field { flex: 1; min-width: 260px; }
        .compact-field { min-width: 170px; }
        .reset-btn { color: #64748b; }
      }
    }

    .timeline-container {
      position: relative;
      padding-left: 30px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      &::before {
        content: '';
        position: absolute;
        top: 10px;
        bottom: 10px;
        left: 17px;
        width: 2px;
        background: #e2e8f0;
      }
    }

    .empty-feed {
      text-align: center;
      padding: 60px 20px;
      color: #94a3b8;
      mat-icon { font-size: 48px; width: 48px; height: 48px; }
    }

    .audit-item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 16px;

      .audit-icon-wrap {
        position: relative;
        z-index: 2;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #475569;
        margin-left: -32px;
        flex-shrink: 0;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }

        &.created { border-color: #0284c7; color: #0284c7; background: #f0f9ff; }
        &.stage_transition { border-color: #8b5cf6; color: #8b5cf6; background: #f5f3ff; }
        &.doc_submitted { border-color: #f59e0b; color: #f59e0b; background: #fffbeb; }
        &.verification_updated { border-color: #a21caf; color: #a21caf; background: #fae8ff; }
        &.completed { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }
        &.deleted { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
      }

      .audit-card {
        flex: 1;
        padding: 16px 20px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
    }

    .audit-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .ref-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;

        .ref-mono { font-family: monospace; font-weight: 800; font-size: 0.95rem; color: #0f172a; }
        .job-type-text { font-size: 0.85rem; color: #64748b; }
      }

      .timestamp { font-size: 0.775rem; color: #94a3b8; }
    }

    .officer-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.8rem;
      margin-bottom: 10px;

      .officer-name {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;
        color: #334155;
        .sm-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
      }

      .event-type-tag {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 4px;
        background: #f1f5f9;
        color: #475569;

        &.created { background: #e0f2fe; color: #0369a1; }
        &.stage_transition { background: #f3e8ff; color: #7e22ce; }
        &.completed { background: #dcfce7; color: #15803d; }
        &.deleted { background: #fee2e2; color: #b91c1c; }
      }

      .stage-transition-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 2px 8px;
        font-size: 0.725rem;
        color: #0f172a;
        font-weight: 600;

        .arrow-icon { font-size: 12px; width: 12px; height: 12px; color: #64748b; }
      }
    }

    .details-body {
      p {
        margin: 0;
        font-size: 0.875rem;
        color: #1e293b;
        line-height: 1.4;
      }
    }
  `]
})
export class LandAuditComponent implements OnInit {
  private landService = inject(LandService);

  auditRecords = signal<LandAuditRecord[]>([]);

  searchKeyword = signal<string>('');
  selectedAction = signal<string>('ALL');
  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);

  filteredRecords = computed(() => {
    let list = this.auditRecords();
    const kw = this.searchKeyword().toLowerCase().trim();
    const action = this.selectedAction();
    const from = this.dateFrom();
    const to = this.dateTo();

    if (action !== 'ALL') {
      list = list.filter(r => r.actionType === action);
    }
    if (from) {
      const fromMs = new Date(from).setHours(0, 0, 0, 0);
      list = list.filter(r => r.timestamp >= fromMs);
    }
    if (to) {
      const toMs = new Date(to).setHours(23, 59, 59, 999);
      list = list.filter(r => r.timestamp <= toMs);
    }
    if (kw) {
      list = list.filter(r => 
        (r.jobRef && r.jobRef.toLowerCase().includes(kw)) ||
        (r.officerName && r.officerName.toLowerCase().includes(kw)) ||
        (r.details && r.details.toLowerCase().includes(kw)) ||
        (r.jobTypeName && r.jobTypeName.toLowerCase().includes(kw))
      );
    }

    return list;
  });

  ngOnInit() {
    this.landService.getAuditLogs().subscribe({
      next: (logs) => this.auditRecords.set(logs || [])
    });
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'CREATED': return 'add_circle';
      case 'STAGE_TRANSITION': return 'trending_flat';
      case 'DOC_SUBMITTED': return 'upload_file';
      case 'VERIFICATION_UPDATED': return 'fact_check';
      case 'COMPLETED': return 'verified';
      case 'DELETED': return 'delete';
      default: return 'history';
    }
  }

  resetFilters() {
    this.searchKeyword.set('');
    this.selectedAction.set('ALL');
    this.dateFrom.set(null);
    this.dateTo.set(null);
  }
}
