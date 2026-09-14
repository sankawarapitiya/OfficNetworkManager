import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { WorkPlan } from '../../services/work-plan.service';

export interface WorkPlanRevisionDialogData {
  plan: WorkPlan;
}

export interface WorkPlanRevisionDialogResult {
  confirmed: boolean;
  reason: string;
}

@Component({
  selector: 'app-work-plan-revision-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="revision-dialog-container">
      <div class="dialog-header">
        <div class="icon-circle">
          <mat-icon>replay</mat-icon>
        </div>
        <div class="header-text">
          <h2 mat-dialog-title class="dialog-title">Rollback Directive for Revision</h2>
          <p class="dialog-subtitle">{{ data.plan.title }}</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Warning Notice Alert -->
        <div class="rollback-warning-box">
          <mat-icon class="warning-icon">warning_amber</mat-icon>
          <div class="warning-text">
            <strong>All Verification Approvals Will Be Reset</strong>
            <p>
              Returning this directive to <em>In Progress</em> will revoke all signed stages (Stages 1 through {{ totalStages() }}).
              The assigned verification officers will need to re-audit and sign off sequentially once revisions are completed.
            </p>
          </div>
        </div>

        <!-- Revision Instructions Comment Area -->
        <div class="input-section">
          <label class="input-label" for="revision-remarks">
            <mat-icon class="label-icon">edit_note</mat-icon>
            Revision Instructions & Correction Requirements:
          </label>
          <textarea id="revision-remarks"
                    [(ngModel)]="revisionReason"
                    class="revision-textarea"
                    rows="3"
                    placeholder="Describe the required changes, corrections, or missing deliverables that the performer must address..."></textarea>
          <span class="input-hint">These instructions will be shown on the directive as revision guidance for the assigned performer.</span>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-stroked-button (click)="onCancel()" class="cancel-btn">
          Cancel
        </button>
        <button mat-flat-button class="confirm-rollback-btn" (click)="onConfirm()">
          <mat-icon>restart_alt</mat-icon> Reset Approvals & Rollback
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .revision-dialog-container {
      padding: 6px 4px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px 12px;

      .icon-circle {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: #fef2f2;
        color: #dc2626;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-text {
        .dialog-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.25;
        }
        .dialog-subtitle {
          margin: 2px 0 0;
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 420px;
        }
      }
    }

    .dialog-content {
      padding: 12px 20px 16px !important;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .rollback-warning-box {
      display: flex;
      gap: 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 14px;
      color: #92400e;

      .warning-icon {
        color: #d97706;
        font-size: 22px;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .warning-text {
        strong {
          display: block;
          font-size: 13px;
          color: #78350f;
          margin-bottom: 2px;
        }
        p {
          margin: 0;
          font-size: 12px;
          line-height: 1.45;
          color: #92400e;
        }
      }
    }

    .input-section {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .input-label {
        font-size: 12.5px;
        font-weight: 600;
        color: #334155;
        display: flex;
        align-items: center;
        gap: 6px;

        .label-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #0284c7;
        }
      }

      .revision-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 13px;
        font-family: inherit;
        color: #1e293b;
        background: #ffffff;
        resize: vertical;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
        }
      }

      .input-hint {
        font-size: 11.5px;
        color: #64748b;
      }
    }

    .dialog-actions {
      padding: 12px 20px 16px;
      gap: 10px;

      .cancel-btn {
        font-size: 13px;
        color: #475569;
      }

      .confirm-rollback-btn {
        background-color: #dc2626;
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        border-radius: 6px;
        mat-icon { font-size: 17px; width: 17px; height: 17px; margin-right: 4px; }
        &:hover { background-color: #b91c1c; }
      }
    }
  `]
})
export class WorkPlanRevisionDialogComponent {
  private dialogRef = inject(MatDialogRef<WorkPlanRevisionDialogComponent>);
  data: WorkPlanRevisionDialogData = inject(MAT_DIALOG_DATA);

  revisionReason = '';

  totalStages(): number {
    return this.data.plan.verifiers?.length || 1;
  }

  onCancel() {
    this.dialogRef.close({ confirmed: false, reason: '' });
  }

  onConfirm() {
    this.dialogRef.close({
      confirmed: true,
      reason: this.revisionReason.trim()
    });
  }
}
