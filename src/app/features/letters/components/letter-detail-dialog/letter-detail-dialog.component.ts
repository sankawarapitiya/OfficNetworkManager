import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Letter } from '../../models/letter.model';
import { LetterStatusDialogComponent } from '../letter-status-dialog/letter-status-dialog.component';

@Component({
  selector: 'app-letter-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-header">
      <div class="hdr-left">
        <span class="ref-badge">{{ data.letter.ref_number }}</span>
        <span class="priority-pill" [ngClass]="data.letter.priority.toLowerCase()">
          {{ data.letter.priority }}
        </span>
        <span class="status-pill" [ngClass]="getStatusClass(data.letter.status)">
          {{ data.letter.status }}
        </span>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content class="dialog-body">
      <h2 class="letter-title">{{ data.letter.title }}</h2>

      <!-- Metadata Grid -->
      <div class="meta-grid">
        <div class="meta-item">
          <span class="label">Received From</span>
          <span class="val font-semibold">{{ data.letter.received_from }}</span>
        </div>
        <div class="meta-item">
          <span class="label">Received Date</span>
          <span class="val">{{ data.letter.received_date }}</span>
        </div>
        <div class="meta-item">
          <span class="label">Category</span>
          <span class="val">{{ data.letter.category || 'General Inward' }}</span>
        </div>
        <div class="meta-item">
          <span class="label">Linked Reference</span>
          <span class="val">
            <span *ngIf="data.letter.link_ref" class="link-badge">
              <mat-icon class="mini-icon">link</mat-icon> {{ data.letter.link_ref }}
            </span>
            <span *ngIf="!data.letter.link_ref" class="text-muted">None</span>
          </span>
        </div>
      </div>

      <!-- Routing & Assignment -->
      <div class="routing-section">
        <div class="route-col">
          <span class="section-sub-title">Send To > Departments</span>
          <div class="chips-wrap">
            <span *ngFor="let d of data.letter.send_to" class="dept-chip">
              <mat-icon class="mini-icon">domain</mat-icon> {{ d }}
            </span>
            <span *ngIf="!data.letter.send_to?.length" class="text-muted">No specific department</span>
          </div>
        </div>

        <div class="route-col">
          <span class="section-sub-title">Assigned Officers</span>
          <div class="chips-wrap">
            <span *ngFor="let u of data.letter.assigned_user_names || data.letter.assigned_to" class="user-chip">
              <mat-icon class="mini-icon">person</mat-icon> {{ u }}
            </span>
            <span *ngIf="!data.letter.assigned_to?.length" class="text-muted">Unassigned</span>
          </div>
        </div>
      </div>

      <!-- Content / Description -->
      <div class="content-box">
        <span class="section-sub-title">Letter Description & Directives</span>
        <p class="desc-text">{{ data.letter.description || 'No detailed remarks recorded.' }}</p>
      </div>

      <!-- Attachments Section -->
      <div class="attachments-section" *ngIf="data.letter.attachments?.length">
        <span class="section-sub-title">Attached Files ({{ data.letter.attachments?.length }})</span>
        <div class="att-grid">
          <div *ngFor="let att of data.letter.attachments" class="att-card">
            <mat-icon class="att-type-icon" [ngClass]="att.storage_destination">
              {{ att.storage_destination === 'firebase' ? 'cloud_download' : 'folder_shared' }}
            </mat-icon>
            <div class="att-meta">
              <span class="att-name">{{ att.name }}</span>
              <span class="att-dest">
                {{ att.storage_destination === 'firebase' ? 'Firebase Cloud' : ('Network: ' + att.network_path) }} • {{ (att.size / 1024).toFixed(1) }} KB
              </span>
            </div>
            <a *ngIf="att.storage_url" [href]="att.storage_url" target="_blank" mat-stroked-button color="primary" class="view-btn">
              <mat-icon>open_in_new</mat-icon> View
            </a>
          </div>
        </div>
      </div>

      <!-- Action Timeline -->
      <div class="timeline-section" *ngIf="data.letter.action_logs?.length">
        <span class="section-sub-title">Action & Status History</span>
        <div class="timeline-list">
          <div *ngFor="let log of data.letter.action_logs" class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="tl-header">
                <strong>{{ log.officer_name }}</strong>
                <span class="tl-status-change" *ngIf="log.from_status !== 'None'">
                  {{ log.from_status }} → <span class="to-st">{{ log.to_status }}</span>
                </span>
                <span class="tl-time">{{ log.timestamp | date:'medium' }}</span>
              </div>
              <p class="tl-remarks">{{ log.remarks }}</p>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-flat-button color="primary" (click)="openUpdateStatus()">
        <mat-icon>update</mat-icon> Update Status
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px 8px;
      border-bottom: 1px solid #e2e8f0;
      .hdr-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .close-btn { width: 30px; height: 30px; line-height: 30px; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    }
    .ref-badge {
      font-family: monospace;
      font-weight: 700;
      font-size: 11.5px;
      background: #eff6ff;
      color: #1e40af;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
    }
    .priority-pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 999px;
      text-transform: uppercase;
      &.normal { background: #f1f5f9; color: #475569; }
      &.urgent { background: #fef3c7; color: #b45309; }
      &.immediate { background: #fee2e2; color: #b91c1c; }
    }
    .status-pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 999px;
      &.received { background: #e0f2fe; color: #0369a1; }
      &.in-review { background: #fef3c7; color: #b45309; }
      &.action-required { background: #fee2e2; color: #b91c1c; }
      &.in-progress { background: #f3e8ff; color: #7e22ce; }
      &.completed { background: #dcfce7; color: #15803d; }
      &.dispatched { background: #e0e7ff; color: #4338ca; }
      &.archived { background: #f1f5f9; color: #64748b; }
    }
    .dialog-body { padding: 14px 20px; max-height: 80vh; }
    .letter-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px 0;
      line-height: 1.35;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-bottom: 12px;
      .meta-item {
        display: flex;
        flex-direction: column;
        .label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; }
        .val { font-size: 12px; color: #1e293b; margin-top: 1px; }
      }
    }
    .link-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #eef2ff;
      color: #4338ca;
      font-weight: 600;
      font-size: 11px;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .mini-icon { font-size: 13px; width: 13px; height: 13px; }
    .section-sub-title {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .routing-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }
    .chips-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
    .dept-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 10.5px;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .user-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f3e8ff;
      color: #6b21a8;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .content-box {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
      .desc-text { margin: 0; font-size: 14px; color: #334155; line-height: 1.5; white-space: pre-wrap; }
    }
    .attachments-section { margin-bottom: 16px; }
    .att-grid { display: flex; flex-direction: column; gap: 8px; }
    .att-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      .att-type-icon {
        &.firebase { color: #0284c7; }
        &.network { color: #d97706; }
      }
      .att-meta {
        display: flex;
        flex-direction: column;
        flex: 1;
        .att-name { font-size: 13px; font-weight: 600; color: #1e293b; }
        .att-dest { font-size: 11px; color: #64748b; }
      }
    }
    .timeline-section { margin-top: 16px; }
    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-left: 2px solid #e2e8f0;
      margin-left: 8px;
      padding-left: 16px;
    }
    .timeline-item {
      position: relative;
      .timeline-dot {
        position: absolute;
        left: -21px;
        top: 4px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #3b82f6;
        border: 2px solid white;
      }
      .tl-header {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 13px;
        color: #1e293b;
        .to-st { color: #2563eb; font-weight: 700; }
        .tl-time { font-size: 11px; color: #94a3b8; }
      }
      .tl-remarks { margin: 2px 0 0 0; font-size: 13px; color: #475569; }
    }
    .text-muted { color: #94a3b8; font-size: 13px; }
    .dialog-actions { padding: 12px 24px 16px; border-top: 1px solid #e2e8f0; }
  `]
})
export class LetterDetailDialogComponent {
  private dialog = inject(MatDialog);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { letter: Letter },
    public dialogRef: MatDialogRef<LetterDetailDialogComponent>
  ) {}

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  openUpdateStatus() {
    const ref = this.dialog.open(LetterStatusDialogComponent, {
      width: '520px',
      data: { letter: this.data.letter }
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.dialogRef.close(true);
      }
    });
  }
}
