import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { 
  AttendanceService, 
  AttendanceHealthResponse, 
  MonthlyReportResponse, 
  MonthlyReportSummaryItem 
} from '../../core/services/attendance.service';
import { FirestoreService } from '../../core/services/firestore.service';
import { AppUser } from '../profile/profile.component';
import { UserTimesheetDialogComponent } from './user-timesheet-dialog.component';
import { LinkFingerprintDialogComponent } from './link-fingerprint-dialog.component';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss'
})
export class AttendanceComponent implements OnInit {
  private attendanceService = inject(AttendanceService);
  private firestoreService = inject(FirestoreService);
  private dialog = inject(MatDialog);

  // Month selection
  selectedMonth = signal<string>(this.getCurrentMonthString());
  availableMonths = signal<string[]>(this.getRecentMonthsList());

  // Connection & Server state
  health = signal<AttendanceHealthResponse | null>(null);
  isServerOnline = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  successMsg = signal<string>('');
  errorMsg = signal<string>('');

  // Data
  users = signal<AppUser[]>([]);
  monthlyReport = signal<MonthlyReportResponse | null>(null);
  terminalEmployees = signal<MonthlyReportSummaryItem[]>([]);
  terminalSearch = signal<string>('');

  // Table columns
  userDisplayedColumns: string[] = [
    'user',
    'department',
    'fingerprint',
    'present',
    'absent',
    'worked_time',
    'ot',
    'attendance_pct',
    'actions'
  ];

  terminalDisplayedColumns: string[] = [
    'user_id',
    'employee_name',
    'department',
    'shift_name',
    'days_present',
    'days_absent',
    'total_worked',
    'total_ot',
    'attendance_pct',
    'actions'
  ];

  // Map of fingerprint ID -> MonthlyReportSummaryItem
  attendanceMap = computed(() => {
    const map = new Map<string, MonthlyReportSummaryItem>();
    const report = this.monthlyReport();
    if (report && report.records) {
      for (const rec of report.records) {
        map.set(String(rec.user_id), rec);
      }
    }
    return map;
  });

  // Metrics
  totalUsersCount = computed(() => this.users().length);
  
  linkedUsersCount = computed(() => {
    return this.users().filter(u => !!u.user_finger_id && u.user_finger_id.trim() !== '').length;
  });

  activeAttendeesCount = computed(() => {
    let count = 0;
    const map = this.attendanceMap();
    for (const u of this.users()) {
      if (u.user_finger_id && map.has(String(u.user_finger_id))) {
        const rec = map.get(String(u.user_finger_id))!;
        if (rec.days_present > 0) count++;
      }
    }
    return count;
  });

  totalWorkedHours = computed(() => {
    let totalMins = 0;
    const map = this.attendanceMap();
    for (const u of this.users()) {
      if (u.user_finger_id && map.has(String(u.user_finger_id))) {
        totalMins += map.get(String(u.user_finger_id))!.total_worked_mins || 0;
      }
    }
    return (totalMins / 60).toFixed(1);
  });

  filteredTerminalEmployees = computed(() => {
    const search = this.terminalSearch().toLowerCase().trim();
    const list = this.terminalEmployees();
    if (!search) return list;
    return list.filter(e => 
      e.user_id.toLowerCase().includes(search) ||
      e.employee_name.toLowerCase().includes(search) ||
      (e.department && e.department.toLowerCase().includes(search))
    );
  });

  ngOnInit() {
    this.refreshAll();
  }

  getCurrentMonthString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  getRecentMonthsList(): string[] {
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      list.push(`${y}-${m}`);
    }
    return list;
  }

  refreshAll() {
    this.checkServerHealth();
    this.loadUsers();
    this.loadMonthlyReport();
  }

  checkServerHealth() {
    this.attendanceService.checkHealth().subscribe({
      next: (h) => {
        if (h) {
          this.health.set(h);
          this.isServerOnline.set(true);
        } else {
          this.health.set(null);
          this.isServerOnline.set(false);
        }
      },
      error: () => {
        this.health.set(null);
        this.isServerOnline.set(false);
      }
    });
  }

  loadUsers() {
    this.firestoreService.getCollection<AppUser>('users').subscribe({
      next: (usersList) => {
        this.users.set(usersList);
      },
      error: (err) => {
        console.error('Failed to load users from Firestore:', err);
      }
    });
  }

  loadMonthlyReport() {
    this.isLoading.set(true);
    const month = this.selectedMonth();
    this.attendanceService.getMonthlyReport(month).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.records) {
          this.monthlyReport.set(res);
          this.terminalEmployees.set(res.records);
          this.isServerOnline.set(true);
        } else {
          this.monthlyReport.set(null);
          this.terminalEmployees.set([]);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error loading monthly attendance:', err);
        this.monthlyReport.set(null);
        this.terminalEmployees.set([]);
      }
    });
  }

  onMonthSelect(month: string) {
    this.selectedMonth.set(month);
    this.loadMonthlyReport();
  }

  getUserAttendance(fingerId?: string): MonthlyReportSummaryItem | undefined {
    if (!fingerId) return undefined;
    return this.attendanceMap().get(String(fingerId));
  }

  openLinkDialog(user: AppUser) {
    const dialogRef = this.dialog.open(LinkFingerprintDialogComponent, {
      width: '520px',
      data: {
        user,
        enrolledEmployees: this.terminalEmployees()
      }
    });

    dialogRef.afterClosed().subscribe(async (resultFingerId: string | undefined) => {
      if (resultFingerId !== undefined && user.id) {
        try {
          await this.firestoreService.updateDocument('users', user.id, {
            user_finger_id: resultFingerId.trim()
          });
          this.notifySuccess('Linked ' + (user.displayName || 'User') + ' with Fingerprint ID: ' + (resultFingerId || 'None'));
        } catch (err: any) {
          console.error('Failed to update user_finger_id:', err);
          this.notifyError('Failed to save biometric link.');
        }
      }
    });
  }

  viewTimesheetForUser(user: AppUser) {
    if (!user.user_finger_id) {
      this.notifyError('No fingerprint ID linked to this user profile.');
      return;
    }

    this.isLoading.set(true);
    this.attendanceService.getUserMonthlyTimesheet(this.selectedMonth(), user.user_finger_id).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.success) {
          this.dialog.open(UserTimesheetDialogComponent, {
            width: '840px',
            maxWidth: '96vw',
            data: res
          });
        } else {
          this.notifyError('No attendance timesheet found for Fingerprint ID ' + user.user_finger_id);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching timesheet:', err);
        this.notifyError('Failed to retrieve timesheet data.');
      }
    });
  }

  viewTimesheetForTerminalEmployee(emp: MonthlyReportSummaryItem) {
    this.isLoading.set(true);
    this.attendanceService.getUserMonthlyTimesheet(this.selectedMonth(), emp.user_id).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.success) {
          this.dialog.open(UserTimesheetDialogComponent, {
            width: '840px',
            maxWidth: '96vw',
            data: res
          });
        } else {
          this.notifyError('No attendance timesheet found for ID ' + emp.user_id);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching timesheet:', err);
        this.notifyError('Failed to retrieve timesheet data.');
      }
    });
  }

  exportExcel() {
    const url = this.attendanceService.getExportExcelUrl(this.selectedMonth());
    window.open(url, '_blank');
  }

  private notifySuccess(msg: string) {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 4000);
  }

  private notifyError(msg: string) {
    this.errorMsg.set(msg);
    setTimeout(() => this.errorMsg.set(''), 4000);
  }
}
