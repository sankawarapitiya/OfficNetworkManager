import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LetterService } from '../../services/letter.service';
import { Letter } from '../../models/letter.model';
import { LetterStatusDialogComponent } from '../../components/letter-status-dialog/letter-status-dialog.component';
import { LetterDetailDialogComponent } from '../../components/letter-detail-dialog/letter-detail-dialog.component';
import { AuthService } from '../../../../auth/auth.service';
import { RbacService } from '../../../../auth/rbac.service';

@Component({
  selector: 'app-letter-actions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container max-w-7xl mx-auto p-4 md:p-6">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Directives & Pending Actions</h1>
          <p class="page-desc">Track and resolve actionable correspondence assigned to you or your department.</p>
        </div>
      </div>

      <!-- Segment Filter Toggle -->
      <div class="toolbar-row">
        <mat-button-toggle-group [(ngModel)]="activeSegment" aria-label="Action Segment" class="segment-toggle">
          <mat-button-toggle value="MINE">
            <mat-icon>person</mat-icon> Assigned to Me ({{ myActions().length }})
          </mat-button-toggle>
          <mat-button-toggle value="DEPT">
            <mat-icon>domain</mat-icon> My Department ({{ deptActions().length }})
          </mat-button-toggle>
          <mat-button-toggle value="ALL_OPEN">
            <mat-icon>pending_actions</mat-icon> All Open Actions ({{ allOpenActions().length }})
          </mat-button-toggle>
          <mat-button-toggle value="URGENT">
            <mat-icon>warning</mat-icon> Urgent Only ({{ urgentActions().length }})
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <!-- Actions Grid -->
      <div class="actions-grid" *ngIf="displayedLetters().length > 0; else noActions">
        <mat-card *ngFor="let letter of displayedLetters()" class="action-card" [class.urgent-card]="letter.priority !== 'Normal'">
          <div class="card-top-row">
            <span class="ref-badge">{{ letter.ref_number }}</span>
            <div class="pills-group">
              <span class="priority-pill" [ngClass]="letter.priority.toLowerCase()">{{ letter.priority }}</span>
              <span class="status-pill" [ngClass]="getStatusClass(letter.status)">{{ letter.status }}</span>
            </div>
          </div>

          <h3 class="letter-title" (click)="openDetail(letter)">{{ letter.title }}</h3>

          <div class="meta-details">
            <div class="m-item">
              <mat-icon class="m-icon">person_pin</mat-icon>
              <span>From: <strong>{{ letter.received_from }}</strong></span>
            </div>
            <div class="m-item">
              <mat-icon class="m-icon">calendar_today</mat-icon>
              <span>Received: {{ letter.received_date }}</span>
            </div>
            <div class="m-item" *ngIf="letter.send_to?.length">
              <mat-icon class="m-icon">domain</mat-icon>
              <span>Dept: {{ letter.send_to.join(', ') }}</span>
            </div>
            <div class="m-item" *ngIf="letter.link_ref">
              <mat-icon class="m-icon">link</mat-icon>
              <span>Linked Ref: <strong>{{ letter.link_ref }}</strong></span>
            </div>
          </div>

          <p class="description-preview" *ngIf="letter.description">
            {{ letter.description }}
          </p>

          <div class="last-action" *ngIf="getLastLog(letter) as lastLog">
            <mat-icon class="log-icon">history</mat-icon>
            <span class="log-text">
              Last note by <strong>{{ lastLog.officer_name }}</strong>: "{{ lastLog.remarks }}"
            </span>
          </div>

          <div class="card-footer">
            <div class="assigned-names">
              <span class="lbl">Assigned:</span>
              <span class="usr-tag" *ngFor="let u of letter.assigned_user_names || letter.assigned_to">{{ u }}</span>
              <span *ngIf="!letter.assigned_to?.length" class="text-muted">Unassigned</span>
            </div>

            <div class="card-buttons">
              <button mat-stroked-button color="primary" (click)="openDetail(letter)">
                <mat-icon>visibility</mat-icon> Dossier
              </button>
              <button mat-flat-button color="primary" (click)="openUpdateStatus(letter)">
                <mat-icon>update</mat-icon> Update Status
              </button>
            </div>
          </div>
        </mat-card>
      </div>

      <ng-template #noActions>
        <mat-card class="empty-card">
          <mat-icon class="empty-icon">task_alt</mat-icon>
          <h3>No Pending Action Directives Found</h3>
          <p>All official letters in this category have been addressed or resolved.</p>
        </mat-card>
      </ng-template>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 12px; }
    .page-header {
      .page-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
      .page-desc { font-size: 12.5px; color: #64748b; margin: 2px 0 0 0; }
    }
    .toolbar-row { margin-bottom: 4px; }
    .segment-toggle {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      height: 32px;
      font-size: 11.5px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 3px; }
    }
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 12px;
    }
    .action-card {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      &.urgent-card {
        border-left: 3px solid #ef4444;
      }
    }
    .card-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .ref-badge {
      font-family: monospace;
      font-weight: 700;
      background: #eff6ff;
      color: #1e40af;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 11px;
    }
    .pills-group { display: flex; gap: 4px; }
    .priority-pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 999px;
      text-transform: uppercase;
      &.normal { background: #f1f5f9; color: #475569; }
      &.urgent { background: #fef3c7; color: #b45309; }
      &.immediate { background: #fee2e2; color: #b91c1c; }
    }
    .status-pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 999px;
      &.received { background: #e0f2fe; color: #0369a1; }
      &.in-review { background: #fef3c7; color: #b45309; }
      &.action-required { background: #fee2e2; color: #b91c1c; }
      &.in-progress { background: #f3e8ff; color: #7e22ce; }
      &.completed { background: #dcfce7; color: #15803d; }
      &.dispatched { background: #e0e7ff; color: #4338ca; }
    }
    .letter-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      cursor: pointer;
      line-height: 1.35;
      &:hover { color: #2563eb; }
    }
    .meta-details {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 11.5px;
      color: #475569;
      .m-item {
        display: flex;
        align-items: center;
        gap: 5px;
        .m-icon { font-size: 13px; width: 13px; height: 13px; color: #64748b; }
      }
    }
    .description-preview {
      font-size: 11.5px;
      color: #64748b;
      margin: 0;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      background: #f8fafc;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .last-action {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 4px 6px;
      font-size: 10.5px;
      color: #1e40af;
      .log-icon { font-size: 13px; width: 13px; height: 13px; margin-top: 1px; }
      .log-text { line-height: 1.25; }
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      flex-wrap: wrap;
      gap: 6px;
    }
    .assigned-names {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 10.5px;
      .lbl { color: #64748b; font-weight: 600; }
      .usr-tag {
        background: #f3e8ff;
        color: #7e22ce;
        padding: 1px 5px;
        border-radius: 3px;
        font-weight: 600;
      }
    }
    .card-buttons { display: flex; gap: 6px; button { height: 30px; font-size: 11.5px; mat-icon { font-size: 15px; width: 15px; height: 15px; } } }
    .empty-card {
      text-align: center;
      padding: 36px;
      display: flex;
      flex-direction: column;
      align-items: center;
      .empty-icon { font-size: 38px; width: 38px; height: 38px; color: #16a34a; margin-bottom: 8px; }
      h3 { margin: 0; font-size: 16px; color: #0f172a; }
      p { margin: 4px 0 0 0; color: #64748b; font-size: 12.5px; }
    }
  `]
})
export class LetterActionsComponent implements OnInit {
  private letterService = inject(LetterService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private dialog = inject(MatDialog);

  allLetters = signal<Letter[]>([]);
  activeSegment: 'MINE' | 'DEPT' | 'ALL_OPEN' | 'URGENT' = 'ALL_OPEN';

  currentUser = computed(() => this.authService.currentUser());
  userDept = computed(() => this.rbacService.userDepartment());

  allOpenActions = computed(() => {
    return this.allLetters().filter(l => 
      l.status === 'Received' || 
      l.status === 'In Review' || 
      l.status === 'Action Required' || 
      l.status === 'In Progress'
    );
  });

  myActions = computed(() => {
    const u = this.currentUser();
    if (!u) return [];
    const uid = u.uid;
    const email = u.email;
    return this.allOpenActions().filter(l => 
      l.assigned_to?.includes(uid) || (email && l.assigned_to?.includes(email))
    );
  });

  deptActions = computed(() => {
    const dept = this.userDept();
    if (!dept) return [];
    return this.allOpenActions().filter(l => l.send_to?.includes(dept));
  });

  urgentActions = computed(() => {
    return this.allOpenActions().filter(l => l.priority === 'Urgent' || l.priority === 'Immediate');
  });

  displayedLetters = computed(() => {
    switch (this.activeSegment) {
      case 'MINE': return this.myActions();
      case 'DEPT': return this.deptActions();
      case 'URGENT': return this.urgentActions();
      case 'ALL_OPEN':
      default:
        return this.allOpenActions();
    }
  });

  ngOnInit() {
    this.letterService.getLetters().subscribe(letters => {
      this.allLetters.set(letters);
    });
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  getLastLog(letter: Letter) {
    if (!letter.action_logs?.length) return null;
    return letter.action_logs[letter.action_logs.length - 1];
  }

  openDetail(letter: Letter) {
    this.dialog.open(LetterDetailDialogComponent, {
      width: '800px',
      maxWidth: '96vw',
      data: { letter }
    });
  }

  openUpdateStatus(letter: Letter) {
    this.dialog.open(LetterStatusDialogComponent, {
      width: '520px',
      data: { letter }
    });
  }
}
