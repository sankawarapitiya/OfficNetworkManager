import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppUser } from '../profile/profile.component';
import { MonthlyReportSummaryItem } from '../../core/services/attendance.service';

@Component({
  selector: 'app-link-fingerprint-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, 
    MatFormFieldModule, MatInputModule, MatSelectModule, 
    MatButtonModule, MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Link Biometric Fingerprint ID</h2>
    <mat-dialog-content>
      <div class="user-info-box">
        <strong>{{ data.user.displayName || 'Unnamed User' }}</strong>
        <span class="email-txt">{{ data.user.email }}</span>
        <span *ngIf="data.user.department" class="dept-txt">Department: {{ data.user.department }}</span>
      </div>

      <form [formGroup]="form" class="pt-3 flex-col gap-3">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Biometric Fingerprint ID (user_finger_id)</mat-label>
          <input matInput formControlName="user_finger_id" placeholder="e.g. 44 or 139">
          <mat-icon matSuffix>fingerprint</mat-icon>
          <mat-hint>Enter the exact User ID configured on the SpeedFace terminal</mat-hint>
        </mat-form-field>

        <!-- Quick Select from Terminal Employees if available -->
        <mat-form-field appearance="outline" class="w-full" *ngIf="data.enrolledEmployees?.length">
          <mat-label>Or select from terminal employee records</mat-label>
          <mat-select (selectionChange)="onSelectTerminalEmployee($event.value)">
            <mat-option value="">-- Choose terminal employee --</mat-option>
            <mat-option *ngFor="let emp of data.enrolledEmployees" [value]="emp.user_id">
              [ID: {{ emp.user_id }}] {{ emp.employee_name }} ({{ emp.department }})
            </mat-option>
          </mat-select>
          <mat-hint>Matches terminal punch records automatically</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="onSave()">
        Save Link
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .user-info-box {
      background: #f1f5f9;
      padding: 12px;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13px;
      strong { font-size: 14px; color: #0f172a; }
      .email-txt { color: #64748b; }
      .dept-txt { color: #2563eb; font-weight: 500; }
    }
    .flex-col {
      display: flex;
      flex-direction: column;
    }
    .gap-3 { gap: 12px; }
    .w-full { width: 100%; }
    .pt-3 { padding-top: 12px; }
  `]
})
export class LinkFingerprintDialogComponent {
  private fb = inject(FormBuilder);
  form: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      user: AppUser;
      enrolledEmployees: MonthlyReportSummaryItem[];
    },
    public dialogRef: MatDialogRef<LinkFingerprintDialogComponent>
  ) {
    this.form = this.fb.group({
      user_finger_id: [data.user.user_finger_id || '']
    });
  }

  onSelectTerminalEmployee(userId: string) {
    if (userId) {
      this.form.patchValue({ user_finger_id: userId });
    }
  }

  onSave() {
    this.dialogRef.close(this.form.value.user_finger_id);
  }
}
