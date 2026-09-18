import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { UserMonthlyTimesheetResponse } from '../../core/services/attendance.service';

@Component({
  selector: 'app-user-timesheet-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTableModule],
  template: `
    <div class="dialog-header">
      <div class="dialog-title-wrap">
        <mat-icon class="title-icon">schedule</mat-icon>
        <div>
          <h2 mat-dialog-title>{{ data.employee.employee_name }} — Monthly Timesheet</h2>
          <span class="dialog-subtitle">
            Biometric ID: <strong>{{ data.employee.user_id }}</strong> • 
            Dept: <strong>{{ data.employee.department }}</strong> • 
            Shift: <strong>{{ data.employee.shift_name }}</strong> • 
            Period: <strong>{{ data.periodLabel }}</strong>
          </span>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content-body">
      <!-- Totals Summary Grid -->
      <div class="stats-grid">
        <div class="stat-box">
          <span class="stat-label">Present Days</span>
          <span class="stat-val text-green">{{ data.totals.daysPresent }} / {{ data.totals.scheduledWorkDays }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Absent Days</span>
          <span class="stat-val text-red">{{ data.totals.daysAbsent }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Total Hours</span>
          <span class="stat-val text-blue">{{ data.totals.totalWorkedFormatted }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Overtime</span>
          <span class="stat-val text-purple">{{ data.totals.totalOtHours }}h</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Grace / Short Leave</span>
          <span class="stat-val text-amber">{{ data.totals.graceUsed }} / {{ data.totals.shortLeaveUsed }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Attendance Rate</span>
          <span class="stat-val font-bold">{{ data.totals.attendance_pct }}</span>
        </div>
      </div>

      <!-- Timesheet Table -->
      <div class="table-wrap">
        <table mat-table [dataSource]="data.timesheet" class="mat-elevation-z1 timesheet-table">
          <!-- Date Column -->
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef> Date </th>
            <td mat-cell *matCellDef="let row">
              <div class="date-cell">
                <span class="d-val">{{ row.date }}</span>
                <span class="d-name" [class.weekend]="row.day_type !== 'WEEKDAY'">{{ row.day_name }}</span>
              </div>
            </td>
          </ng-container>

          <!-- Check In Column -->
          <ng-container matColumnDef="check_in">
            <th mat-header-cell *matHeaderCellDef> Check In </th>
            <td mat-cell *matCellDef="let row">
              <div class="punch-badge" [ngClass]="getPunchClass(row.check_in_badge)">
                {{ row.check_in_time || '-' }}
              </div>
            </td>
          </ng-container>

          <!-- Check Out Column -->
          <ng-container matColumnDef="check_out">
            <th mat-header-cell *matHeaderCellDef> Check Out </th>
            <td mat-cell *matCellDef="let row">
              <div class="punch-badge" [ngClass]="getPunchClass(row.check_out_badge)">
                {{ row.check_out_time || '-' }}
              </div>
            </td>
          </ng-container>

          <!-- Worked Time Column -->
          <ng-container matColumnDef="worked">
            <th mat-header-cell *matHeaderCellDef> Worked Time </th>
            <td mat-cell *matCellDef="let row">
              <span class="font-mono">{{ row.worked_formatted }}</span>
            </td>
          </ng-container>

          <!-- Overtime Column -->
          <ng-container matColumnDef="ot">
            <th mat-header-cell *matHeaderCellDef> Overtime </th>
            <td mat-cell *matCellDef="let row">
              <span *ngIf="row.ot_hours > 0" class="ot-chip">+{{ row.ot_hours }}h</span>
              <span *ngIf="!row.ot_hours || row.ot_hours === 0" class="text-gray">-</span>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef> Status </th>
            <td mat-cell *matCellDef="let row">
              <span class="status-pill" [ngClass]="getStatusClass(row.daily_status)">
                {{ row.daily_status }}
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" [class.weekend-row]="row.day_type !== 'WEEKDAY'"></tr>
        </table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px 8px;
      border-bottom: 1px solid #e2e8f0;
      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
      }
      .dialog-subtitle {
        font-size: 13px;
        color: #64748b;
      }
    }
    .dialog-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      .title-icon {
        color: #2563eb;
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }
    .dialog-content-body {
      padding: 16px 24px;
      max-height: 75vh;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-bottom: 18px;
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .stat-box {
      display: flex;
      flex-direction: column;
      .stat-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
      }
      .stat-val {
        font-size: 16px;
        font-weight: 700;
        margin-top: 2px;
      }
    }
    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    .text-blue { color: #2563eb; }
    .text-purple { color: #9333ea; }
    .text-amber { color: #d97706; }
    .text-gray { color: #94a3b8; }

    .table-wrap {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .timesheet-table {
      width: 100%;
      th {
        background: #f1f5f9;
        font-weight: 700;
        font-size: 12px;
        color: #475569;
      }
    }
    .date-cell {
      display: flex;
      flex-direction: column;
      .d-val { font-size: 13px; font-weight: 500; }
      .d-name { font-size: 11px; color: #64748b; }
      .weekend { color: #d97706; font-weight: 600; }
    }
    .weekend-row {
      background-color: #fafaf9;
    }
    .punch-badge {
      font-size: 12px;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      &.on-time { background: #dcfce7; color: #15803d; }
      &.late { background: #fee2e2; color: #b91c1c; }
      &.grace { background: #fef3c7; color: #b45309; }
      &.short-leave { background: #f3e8ff; color: #7e22ce; }
      &.neutral { background: #f1f5f9; color: #475569; }
    }
    .ot-chip {
      font-size: 11px;
      font-weight: 700;
      color: #7e22ce;
      background: #f3e8ff;
      padding: 2px 6px;
      border-radius: 999px;
    }
    .status-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      display: inline-block;
      &.present { background: #dcfce7; color: #15803d; }
      &.absent { background: #fee2e2; color: #b91c1c; }
      &.holiday { background: #e0e7ff; color: #4338ca; }
      &.weekend { background: #f1f5f9; color: #64748b; }
      &.other { background: #fef3c7; color: #92400e; }
    }
  `]
})
export class UserTimesheetDialogComponent {
  displayedColumns = ['date', 'check_in', 'check_out', 'worked', 'ot', 'status'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UserMonthlyTimesheetResponse,
    public dialogRef: MatDialogRef<UserTimesheetDialogComponent>
  ) {}

  getPunchClass(badge?: string): string {
    if (!badge) return 'neutral';
    if (badge.includes('on-time') || badge.includes('success')) return 'on-time';
    if (badge.includes('late') || badge.includes('danger')) return 'late';
    if (badge.includes('grace') || badge.includes('warning')) return 'grace';
    if (badge.includes('short-leave') || badge.includes('purple')) return 'short-leave';
    return 'neutral';
  }

  getStatusClass(status?: string): string {
    if (!status) return 'other';
    const s = status.toLowerCase();
    if (s === 'present' || s.includes('on time') || s.includes('grace')) return 'present';
    if (s === 'absent') return 'absent';
    if (s.includes('holiday')) return 'holiday';
    if (s.includes('saturday') || s.includes('sunday') || s.includes('weekend')) return 'weekend';
    return 'other';
  }
}
