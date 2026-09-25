import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Letter, LetterStatus, ALL_LETTER_STATUSES } from '../../models/letter.model';
import { LetterService } from '../../services/letter.service';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { AppUser } from '../../../profile/profile.component';

@Component({
  selector: 'app-letter-status-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-header">
      <div class="hdr-title-wrap">
        <div class="status-icon-box">
          <mat-icon class="status-icon">update</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title class="dialog-title">Update Letter Status</h2>
          <span class="sub-label">Ref: <strong>{{ data.letter.ref_number }}</strong></span>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn" matTooltip="Close dialog"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content class="dialog-body">
      <div class="summary-box">
        <div class="title">{{ data.letter.title }}</div>
        <div class="meta">
          <span>Current: <strong class="curr-badge">{{ data.letter.status }}</strong></span>
          <span>From: {{ data.letter.received_from }}</span>
        </div>
      </div>

      <form [formGroup]="form" class="form-layout">
        <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
          <mat-label>New Workflow Status</mat-label>
          <mat-select formControlName="status" required>
            <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
          </mat-select>
          <mat-icon matSuffix>flag</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
          <mat-label>Re-assign Officer(s) (Optional)</mat-label>
          <mat-select formControlName="assigned_to" multiple>
            <mat-select-trigger>
              <span *ngIf="form.get('assigned_to')?.value?.length" class="multi-trigger-text">
                {{ getUserName(form.get('assigned_to')?.value[0]) }}
                <span *ngIf="(form.get('assigned_to')?.value?.length || 0) > 1" class="more-count-badge">
                  +{{ (form.get('assigned_to')?.value?.length || 0) - 1 }}
                </span>
              </span>
            </mat-select-trigger>
            <mat-option *ngFor="let u of systemUsers()" [value]="u.id || u.email">
              {{ u.displayName || u.email }} <span *ngIf="u.department" class="text-muted">[{{ u.department }}]</span>
            </mat-option>
          </mat-select>
          <mat-icon matSuffix>person_add</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full field-textarea" subscriptSizing="dynamic">
          <mat-label>Action Remarks / Directive Notes</mat-label>
          <textarea matInput formControlName="remarks" rows="2" placeholder="Provide notes on action taken or reason for status update..." required></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close class="cancel-btn">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || isSaving()" (click)="save()" class="submit-btn">
        <mat-icon *ngIf="!isSaving()">check</mat-icon>
        <mat-icon *ngIf="isSaving()" class="spin-icon">sync</mat-icon>
        <span>{{ isSaving() ? 'Updating...' : 'Update Status' }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      .hdr-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        .status-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          .status-icon { font-size: 18px; width: 18px; height: 18px; }
        }
        .dialog-title { margin: 0 !important; padding: 0 !important; font-size: 14.5px; font-weight: 700; color: #0f172a; line-height: 1.2; }
        .sub-label { font-size: 11px; color: #64748b; }
      }
      .close-btn { width: 30px; height: 30px; line-height: 30px; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    }
    .dialog-body { padding: 14px 20px; }
    .summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 10px;
      .title { font-size: 12.5px; font-weight: 600; color: #1e293b; margin-bottom: 2px; }
      .meta {
        font-size: 11px;
        color: #64748b;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        .curr-badge { color: #2563eb; font-weight: 700; }
      }
    }
    .form-layout { display: flex; flex-direction: column; gap: 8px; }
    .w-full { width: 100%; }
    .field-textarea textarea { font-size: 12px !important; line-height: 1.4; }
    
    .multi-trigger-text {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #1e293b;
    }
    .more-count-badge {
      background: #e2e8f0;
      color: #334155;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 10px;
    }
    .text-muted { color: #94a3b8; font-size: 11px; }

    .dialog-actions {
      padding: 10px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      gap: 8px;
      .cancel-btn { height: 34px; font-size: 12px; }
      .submit-btn {
        height: 34px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }
    .spin-icon { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class LetterStatusDialogComponent {
  private fb = inject(FormBuilder);
  private letterService = inject(LetterService);
  private firestoreService = inject(FirestoreService);

  form: FormGroup;
  statuses = ALL_LETTER_STATUSES;
  systemUsers = signal<AppUser[]>([]);
  isSaving = signal<boolean>(false);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { letter: Letter },
    public dialogRef: MatDialogRef<LetterStatusDialogComponent>
  ) {
    this.form = this.fb.group({
      status: [data.letter.status, Validators.required],
      assigned_to: [data.letter.assigned_to || []],
      remarks: ['', Validators.required]
    });

    this.firestoreService.getCollection<AppUser>('users').subscribe(users => {
      this.systemUsers.set(users);
    });
  }

  getUserName(idOrEmail: string): string {
    if (!idOrEmail) return '';
    const u = this.systemUsers().find(x => x.id === idOrEmail || x.email === idOrEmail);
    return u ? (u.displayName || u.email) : idOrEmail;
  }

  async save() {
    if (this.form.invalid) return;
    this.isSaving.set(true);

    const newStatus = this.form.value.status as LetterStatus;
    const remarks = this.form.value.remarks;
    const assignedTo = this.form.value.assigned_to;

    try {
      await this.letterService.updateLetterStatus(this.data.letter, newStatus, remarks, assignedTo);
      this.dialogRef.close(true);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      this.isSaving.set(false);
    }
  }
}
