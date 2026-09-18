import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface AttendanceHealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  database: string;
  records: number;
  employees: number;
  memory?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

export interface MonthlyReportSummaryItem {
  user_id: string;
  employee_name: string;
  department: string;
  shift_name: string;
  month_working_days: number;
  days_present: number;
  days_absent: number;
  half_days: number;
  grace_used: number;
  short_leave_used: number;
  total_worked_mins: number;
  total_ot_hours: number;
  total_worked_formatted: string;
  attendance_pct: string;
}

export interface DailyTimesheetRow {
  date: string;
  day_name?: string;
  day_type?: string;
  check_in_time: string;
  check_in_badge?: string;
  check_in_label?: string;
  check_out_time: string;
  check_out_badge?: string;
  check_out_label?: string;
  punch_count: number;
  worked_minutes: number;
  worked_formatted: string;
  ot_hours: number;
  daily_status: string;
  daily_badge?: string;
}

export interface UserMonthlyTimesheetResponse {
  success: boolean;
  type: string;
  scope: string;
  month: string;
  periodLabel: string;
  employee: {
    user_id: string;
    employee_name: string;
    department: string;
    shift_name: string;
  };
  totals: {
    monthDays: number;
    scheduledWorkDays: number;
    daysPresent: number;
    daysAbsent: number;
    halfDays: number;
    graceUsed: number;
    shortLeaveUsed: number;
    totalWorkedMins: number;
    totalWorkedFormatted: string;
    totalOtHours: number;
    attendance_pct: string;
  };
  timesheet: DailyTimesheetRow[];
}

export interface MonthlyReportResponse {
  success: boolean;
  type: string;
  periodLabel: string;
  month: string;
  totalEnrolled: number;
  records: MonthlyReportSummaryItem[];
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private http = inject(HttpClient);
  readonly apiUrl = 'http://localhost:8088/api';

  checkHealth(): Observable<AttendanceHealthResponse | null> {
    return this.http.get<AttendanceHealthResponse>(this.apiUrl + '/health').pipe(
      catchError(err => {
        console.warn('Biometric attendance server unavailable at', this.apiUrl, err);
        return of(null);
      })
    );
  }

  getMonthlyReport(month: string): Observable<MonthlyReportResponse | null> {
    return this.http.get<MonthlyReportResponse>(this.apiUrl + '/reports/data', {
      params: {
        type: 'monthly',
        month
      }
    }).pipe(
      catchError(err => {
        console.error('Failed to load monthly attendance report:', err);
        return of(null);
      })
    );
  }

  getUserMonthlyTimesheet(month: string, userId: string): Observable<UserMonthlyTimesheetResponse | null> {
    return this.http.get<UserMonthlyTimesheetResponse>(this.apiUrl + '/reports/data', {
      params: {
        type: 'monthly',
        month,
        scope: 'single',
        userId
      }
    }).pipe(
      catchError(err => {
        console.error('Failed to load timesheet for user ' + userId + ':', err);
        return of(null);
      })
    );
  }

  getExportExcelUrl(month: string): string {
    return this.apiUrl + '/reports/export?type=monthly&month=' + encodeURIComponent(month) + '&format=xlsx';
  }
}
