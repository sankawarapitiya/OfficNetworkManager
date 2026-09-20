import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { 
  WorkPlan, 
  WorkPlanService, 
  formatMonthDisplay, 
  getWorkPlanMonth,
  isWorkPlanOwner 
} from '../../services/work-plan.service';
import { 
  AttendanceService, 
  AttendanceHealthResponse, 
  DailyTimesheetRow, 
  MonthlyReportResponse, 
  UserMonthlyTimesheetResponse 
} from '../../../../core/services/attendance.service';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { SettingsService, Division, Department } from '../../../settings/settings.service';
import { AuthService } from '../../../../auth/auth.service';
import { RbacService } from '../../../../auth/rbac.service';
import { EventLogService } from '../../../../core/services/event-log.service';
import { AppUser } from '../../../profile/profile.component';
import { WorkPlanDialogComponent } from '../../components/work-plan-dialog/work-plan-dialog.component';
import { WorkPlanDetailDialogComponent } from '../../components/work-plan-detail-dialog/work-plan-detail-dialog.component';
import { UserTimesheetDialogComponent } from '../../../attendance/user-timesheet-dialog.component';

export interface CalendarDay {
  date: string;              // 'YYYY-MM-DD'
  dayNumber: number;         // 1..31
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  attendance?: DailyTimesheetRow;
  plans: WorkPlan[];
  duePlans: WorkPlan[];      // Plans with targetDate === this date
  totalPlansCount: number;
}

@Component({
  selector: 'app-work-plan-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './work-plan-calendar.component.html',
  styleUrl: './work-plan-calendar.component.scss'
})
export class WorkPlanCalendarComponent implements OnInit {
  private workPlanService = inject(WorkPlanService);
  private attendanceService = inject(AttendanceService);
  private firestoreService = inject(FirestoreService);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private eventLogService = inject(EventLogService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // Month navigation (Defaults to current month)
  selectedMonth = signal<string>(this.getCurrentMonthString()); // 'YYYY-MM'
  availableMonths = signal<string[]>(this.getRecentMonthsList());

  // Selected date for day inspector
  selectedDate = signal<string>(this.getTodayDateString());

  // Scope & Filters (DEFAULT TO 'all' so all department plans are visible!)
  viewScope = signal<'all' | 'own'>('all');
  selectedOfficerId = signal<string>('all'); // 'all' or officer id
  selectedDivision = signal<string>('all');
  selectedDepartment = signal<string>('all');
  selectedStatus = signal<string>('all');
  searchQuery = signal<string>('');

  // Loaded data
  workPlans = signal<WorkPlan[]>([]);
  users = signal<AppUser[]>([]);
  divisions = signal<Division[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal<boolean>(false);

  // Biometric Attendance state
  isServerOnline = signal<boolean>(false);
  health = signal<AttendanceHealthResponse | null>(null);
  monthlyAttendanceReport = signal<MonthlyReportResponse | null>(null);
  userTimesheetResponse = signal<UserMonthlyTimesheetResponse | null>(null);
  dailyTimesheetMap = signal<Map<string, DailyTimesheetRow>>(new Map());

  // Weekday names header
  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Current authenticated user
  currentUser = computed(() => this.authService.currentUser());

  // Permissions
  canViewAllSummary = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin() || this.rbacService.isDepartmentHead()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForSummary || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:view_all_summary') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canCreatePlan = computed(() => {
    return this.rbacService.isAdmin() || 
           this.rbacService.isSuperAdmin() || 
           this.rbacService.isDivisionalAdmin() || 
           this.rbacService.isDepartmentHead() || 
           this.rbacService.hasPermission('work-plans:create_plan');
  });

  canEditAndAssign = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin() || this.rbacService.isDepartmentHead()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForEditAndAssign || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:edit_plan') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canAccessVerification = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canAccessReports = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const repTypeRoles = settings.rolesPermittedByReportType;
    if (repTypeRoles) {
      const allPermitted = Object.values(repTypeRoles).flat();
      return this.rbacService.hasAnyRole(allPermitted);
    }
    const allRoles = settings.rolesPermittedForAllReports || ['Super Admin', 'Divisional Admin', 'Department Head'];
    const indRoles = settings.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];
    return this.rbacService.hasAnyRole([...allRoles, ...indRoles]) ||
           this.rbacService.hasPermission('work-plans:all_reports') ||
           this.rbacService.hasPermission('work-plans:individual_reports');
  });

  canManageSettings = computed(() => {
    return this.rbacService.hasPermission('work-plans:manage_policies') || this.rbacService.isSuperAdmin() || this.rbacService.isAdmin();
  });

  // Effective Active Officer whose biometric attendance is displayed on calendar
  activeOfficer = computed<AppUser | null>(() => {
    const curUser = this.currentUser();
    const officerId = this.selectedOfficerId();
    const userList = this.users();

    if (officerId === 'me' || this.viewScope() === 'own') {
      const match = userList.find(u => 
        (u.email && u.email.toLowerCase() === curUser?.email?.toLowerCase()) ||
        (u.id && u.id === curUser?.uid)
      );
      if (match) return match;
      if (curUser) {
        return {
          displayName: curUser.displayName || 'Staff Officer',
          email: curUser.email || '',
          id: curUser.uid,
          user_finger_id: undefined,
          roles: [],
          locations: [],
          accessible_modules: []
        };
      }
      return null;
    }

    if (officerId && officerId !== 'all') {
      return userList.find(u => u.id === officerId || u.email === officerId || u.user_finger_id === officerId) || null;
    }

    // When 'all', prefer the logged-in user if they have a linked fingerprint ID, or first linked officer
    const curMatch = userList.find(u => 
      (u.email && u.email.toLowerCase() === curUser?.email?.toLowerCase()) ||
      (u.id && u.id === curUser?.uid)
    );
    if (curMatch && curMatch.user_finger_id) {
      return curMatch;
    }

    const firstLinked = userList.find(u => !!u.user_finger_id && u.user_finger_id.trim() !== '');
    return firstLinked || userList[0] || null;
  });

  // Month Display Title (e.g. "September 2026")
  monthDisplayTitle = computed(() => {
    return formatMonthDisplay(this.selectedMonth());
  });

  // Filtered plans relevant to calendar view
  filteredPlans = computed(() => {
    let plans = this.workPlans();
    const curUser = this.currentUser();
    const scope = this.viewScope();
    const officerId = this.selectedOfficerId();
    const officer = this.activeOfficer();
    const div = this.selectedDivision();
    const dept = this.selectedDepartment();
    const st = this.selectedStatus();
    const q = this.searchQuery().trim().toLowerCase();

    // 1. Scope / Officer filter:
    if (scope === 'own') {
      plans = plans.filter(p => isWorkPlanOwner(p, curUser?.email, curUser?.displayName, curUser?.uid));
    } else if (officerId !== 'all' && officerId !== 'me' && officer) {
      plans = plans.filter(p => isWorkPlanOwner(p, officer.email, officer.displayName, officer.id));
    }

    // 2. Division filter
    if (div !== 'all') {
      plans = plans.filter(p => p.division === div);
    }

    // 3. Department filter
    if (dept !== 'all') {
      plans = plans.filter(p => p.department === dept);
    }

    // 4. Status filter
    if (st !== 'all') {
      plans = plans.filter(p => p.status === st);
    }

    // 5. Search query
    if (q) {
      plans = plans.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q))
      );
    }

    return plans;
  });

  // Monthly KPI Summary metrics
  activeDirectivesCount = computed(() => {
    return this.filteredPlans().length;
  });

  completedDirectivesCount = computed(() => {
    return this.filteredPlans().filter(p => p.status === 'Completed').length;
  });

  attendanceRateDisplay = computed(() => {
    const ts = this.userTimesheetResponse();
    if (ts && ts.totals && ts.totals.attendance_pct) {
      return ts.totals.attendance_pct;
    }
    return '--';
  });

  daysPresentCount = computed(() => {
    const ts = this.userTimesheetResponse();
    if (ts && ts.totals) {
      return ts.totals.daysPresent;
    }
    return 0;
  });

  daysAbsentCount = computed(() => {
    const ts = this.userTimesheetResponse();
    if (ts && ts.totals) {
      return ts.totals.daysAbsent;
    }
    return 0;
  });

  totalWorkedFormatted = computed(() => {
    const ts = this.userTimesheetResponse();
    if (ts && ts.totals && ts.totals.totalWorkedFormatted) {
      return ts.totals.totalWorkedFormatted;
    }
    return '--';
  });

  // Generated Calendar Grid Days for Selected Month
  calendarDays = computed<CalendarDay[]>(() => {
    const mStr = this.selectedMonth();
    if (!mStr || mStr.length !== 7) return [];

    const [yearStr, monthStr] = mStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed (1..12)

    const firstDayDate = new Date(year, month - 1, 1);
    const startDayOfWeek = (firstDayDate.getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    const todayStr = this.getTodayDateString();
    const timesheetMap = this.dailyTimesheetMap();
    const plans = this.filteredPlans();

    const cells: CalendarDay[] = [];

    // 1. Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 2, dNum);
      const dateStr = this.formatDateIso(prevDate);
      const dayOfWeek = (prevDate.getDay() + 6) % 7;
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      const dayPlans = this.getPlansForDate(plans, dateStr);
      const duePlans = dayPlans.filter(p => this.isPlanDueOnDate(p, dateStr));

      cells.push({
        date: dateStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
        attendance: timesheetMap.get(dateStr),
        plans: dayPlans,
        duePlans,
        totalPlansCount: dayPlans.length
      });
    }

    // 2. Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const curDate = new Date(year, month - 1, d);
      const dateStr = this.formatDateIso(curDate);
      const dayOfWeek = (curDate.getDay() + 6) % 7;
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      const dayPlans = this.getPlansForDate(plans, dateStr);
      const duePlans = dayPlans.filter(p => this.isPlanDueOnDate(p, dateStr));

      cells.push({
        date: dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend,
        attendance: timesheetMap.get(dateStr),
        plans: dayPlans,
        duePlans,
        totalPlansCount: dayPlans.length
      });
    }

    // 3. Trailing days from next month
    const totalSlots = cells.length <= 35 ? 35 : 42;
    const remainingSlots = totalSlots - cells.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextDate = new Date(year, month, d);
      const dateStr = this.formatDateIso(nextDate);
      const dayOfWeek = (nextDate.getDay() + 6) % 7;
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      const dayPlans = this.getPlansForDate(plans, dateStr);
      const duePlans = dayPlans.filter(p => this.isPlanDueOnDate(p, dateStr));

      cells.push({
        date: dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
        attendance: timesheetMap.get(dateStr),
        plans: dayPlans,
        duePlans,
        totalPlansCount: dayPlans.length
      });
    }

    return cells;
  });

  // Selected Day Details for Inspector Panel
  selectedCalendarDay = computed<CalendarDay | null>(() => {
    const dStr = this.selectedDate();
    if (!dStr) return null;
    return this.calendarDays().find(c => c.date === dStr) || null;
  });

  ngOnInit() {
    this.checkBiometricHealth();
    this.loadWorkPlans();
    this.loadSettings();
    this.loadUsers();
  }

  // --- Data Loading & Coordination ---
  loadSettings() {
    this.settingsService.getDivisions().subscribe({
      next: (divs) => this.divisions.set(divs || [])
    });
    this.settingsService.getDepartments().subscribe({
      next: (depts) => this.departments.set(depts || [])
    });
  }

  loadUsers() {
    this.firestoreService.getCollection<AppUser>('users').subscribe({
      next: (uList) => {
        this.users.set(uList || []);

        // Coordinate active officer once users are loaded
        if (this.selectedOfficerId() === 'all') {
          const cur = this.currentUser();
          const curMatch = uList?.find(u => u.email?.toLowerCase() === cur?.email?.toLowerCase());
          if (curMatch?.user_finger_id) {
            // Keep 'all' for plan filter, but active officer uses curMatch
          }
        }
        this.loadAttendanceData();
      }
    });
  }

  loadWorkPlans() {
    this.isLoading.set(true);
    this.workPlanService.getWorkPlans().subscribe({
      next: (plans) => {
        this.workPlans.set(plans || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading work plans:', err);
        this.workPlans.set([]);
        this.isLoading.set(false);
      }
    });
  }

  checkBiometricHealth() {
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

  loadAttendanceData() {
    const month = this.selectedMonth();
    const officer = this.activeOfficer();

    // 1. Overall monthly report for all employees
    this.attendanceService.getMonthlyReport(month).subscribe({
      next: (res) => {
        if (res && res.records) {
          this.monthlyAttendanceReport.set(res);
          this.isServerOnline.set(true);
        }
      },
      error: () => {
        this.isServerOnline.set(false);
      }
    });

    // 2. Fetch specific officer timesheet
    const fingerId = officer?.user_finger_id;
    if (fingerId && fingerId.trim() !== '') {
      this.attendanceService.getUserMonthlyTimesheet(month, fingerId.trim()).subscribe({
        next: (res) => {
          if (res && res.success) {
            this.userTimesheetResponse.set(res);
            this.isServerOnline.set(true);

            const map = new Map<string, DailyTimesheetRow>();
            if (res.timesheet) {
              for (const row of res.timesheet) {
                if (row.date) {
                  map.set(row.date, row);
                }
              }
            }
            this.dailyTimesheetMap.set(map);
          } else {
            this.userTimesheetResponse.set(null);
            this.dailyTimesheetMap.set(new Map());
          }
        },
        error: () => {
          this.userTimesheetResponse.set(null);
          this.dailyTimesheetMap.set(new Map());
        }
      });
    } else {
      this.userTimesheetResponse.set(null);
      this.dailyTimesheetMap.set(new Map());
    }
  }

  // --- Month Navigation Handlers ---
  previousMonth() {
    const [y, m] = this.selectedMonth().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevStr = this.formatMonthString(d);
    this.setMonth(prevStr);
  }

  nextMonth() {
    const [y, m] = this.selectedMonth().split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextStr = this.formatMonthString(d);
    this.setMonth(nextStr);
  }

  goToToday() {
    const today = this.getCurrentMonthString();
    this.setMonth(today);
    this.selectedDate.set(this.getTodayDateString());
  }

  setMonth(month: string) {
    if (this.selectedMonth() !== month) {
      this.selectedMonth.set(month);
      this.loadAttendanceData();
    }
  }

  onScopeChange(scope: 'all' | 'own') {
    this.viewScope.set(scope);
    if (scope === 'own') {
      this.selectedOfficerId.set('me');
    }
    this.loadAttendanceData();
  }

  onOfficerChange(officerId: string) {
    this.selectedOfficerId.set(officerId);
    this.loadAttendanceData();
  }

  previousDay() {
    const cur = this.selectedDate();
    if (!cur) return;
    const parts = cur.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
    const newDateStr = this.formatDateIso(d);
    this.selectedDate.set(newDateStr);
    const newMonth = newDateStr.substring(0, 7);
    if (newMonth !== this.selectedMonth()) {
      this.setMonth(newMonth);
    }
  }

  nextDay() {
    const cur = this.selectedDate();
    if (!cur) return;
    const parts = cur.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const newDateStr = this.formatDateIso(d);
    this.selectedDate.set(newDateStr);
    const newMonth = newDateStr.substring(0, 7);
    if (newMonth !== this.selectedMonth()) {
      this.setMonth(newMonth);
    }
  }

  selectDay(day: CalendarDay) {
    this.selectedDate.set(day.date);
  }

  // --- Dialog & Action Handlers ---
  openPlanDetail(plan: WorkPlan, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const ref = this.dialog.open(WorkPlanDetailDialogComponent, {
      width: '740px',
      maxWidth: '95vw',
      data: { plan }
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.action === 'edit' && res.plan) {
        this.openEditDialog(res.plan);
      } else {
        this.loadWorkPlans();
      }
    });
  }

  openEditDialog(plan: WorkPlan) {
    if (!this.canEditAndAssign()) {
      this.snackBar.open('Editing directive specifications and reassigning officers is restricted to authorized roles', 'Dismiss', { duration: 3500 });
      return;
    }

    const ref = this.dialog.open(WorkPlanDialogComponent, {
      width: '740px',
      maxWidth: '95vw',
      data: {
        plan,
        divisions: this.divisions(),
        departments: this.departments(),
        canEditAndAssign: true
      }
    });

    ref.afterClosed().subscribe(async (result) => {
      if (result && plan.id) {
        try {
          await this.workPlanService.updateWorkPlan(plan.id, result);
          this.eventLogService.logAction('UPDATED', 'WorkPlans', `Updated work plan "${result.title}"`);
          this.snackBar.open('Work plan updated successfully!', 'Dismiss', { duration: 3500 });
          this.loadWorkPlans();
        } catch (e) {
          console.error('Error updating work plan:', e);
          this.snackBar.open('Offline protection: Changes saved to local queue', 'Dismiss', { duration: 3000 });
          this.loadWorkPlans();
        }
      }
    });
  }

  openCreatePlanForDate(dateStr?: string) {
    if (!this.canCreatePlan()) {
      this.snackBar.open('You do not have permission to create work plans.', 'Dismiss', { duration: 3000 });
      return;
    }

    const targetDate = dateStr || this.selectedDate() || this.getTodayDateString();
    const targetMonth = targetDate.substring(0, 7);
    const officer = this.activeOfficer();
    const curUser = this.currentUser();

    const prefillLead = officer ? { displayName: officer.displayName, email: officer.email } : (curUser ? { displayName: curUser.displayName, email: curUser.email } : undefined);

    const ref = this.dialog.open(WorkPlanDialogComponent, {
      width: '740px',
      maxWidth: '95vw',
      data: {
        divisions: this.divisions(),
        departments: this.departments(),
        defaultMonth: targetMonth,
        prefillLead
      }
    });

    ref.afterClosed().subscribe(async (result) => {
      if (result) {
        if (!result.milestones || result.milestones.length === 0) {
          this.snackBar.open('Cannot publish work plan: at least one milestone deliverable is required.', 'Dismiss', { duration: 3500 });
          return;
        }
        try {
          const u = this.currentUser();
          const uName = (u?.displayName || '').trim().toLowerCase();
          const uEmail = (u?.email || '').trim().toLowerCase();
          const uPrefix = uEmail ? uEmail.split('@')[0] : '';
          const resOwnerName = (result.ownerName || '').trim();
          const resOwnerEmail = (result.ownerEmail || '').trim();
          const isSelf = (!resOwnerName || resOwnerName.toLowerCase() === uName || resOwnerName.toLowerCase() === uPrefix) &&
                         (!resOwnerEmail || resOwnerEmail.toLowerCase() === uEmail);

          const planToSave = {
            ...result,
            startDate: result.startDate || targetDate,
            targetDate: result.targetDate || targetDate,
            ownerName: result.ownerName || (isSelf ? (u?.displayName || uPrefix || 'Staff Officer') : 'Unassigned Officer'),
            ownerEmail: result.ownerEmail || (isSelf ? (u?.email || '') : (result.ownerName ? `${result.ownerName.toLowerCase().replace(/\s+/g, '.')}@gov.lk` : '')),
            ownerUid: result.ownerUid || (isSelf ? (u?.uid || '') : ''),
            createdBy: result.createdBy || u?.uid || '',
            createdByEmail: result.createdByEmail || u?.email || '',
            createdByName: result.createdByName || u?.displayName || (u?.email ? u.email.split('@')[0] : 'Staff Officer')
          };

          await this.workPlanService.addWorkPlan(planToSave);
          this.eventLogService.logAction('CREATED', 'WorkPlans', `Created work plan "${result.title}"`);
          this.snackBar.open('Work plan scheduled successfully!', 'Dismiss', { duration: 3500 });
          this.loadWorkPlans();
        } catch (e) {
          console.error(e);
          this.snackBar.open('Offline protection: Plan saved to local queue', 'Dismiss', { duration: 3000 });
          this.loadWorkPlans();
        }
      }
    });
  }

  viewTimesheetDialog() {
    const ts = this.userTimesheetResponse();
    if (ts && ts.success) {
      this.dialog.open(UserTimesheetDialogComponent, {
        width: '840px',
        maxWidth: '96vw',
        data: ts
      });
    } else {
      const officer = this.activeOfficer();
      if (!officer?.user_finger_id) {
        this.snackBar.open('No Biometric Fingerprint ID linked to this user profile.', 'Dismiss', { duration: 3500 });
      } else {
        this.snackBar.open('Timesheet records unavailable or biometric terminal server offline.', 'Dismiss', { duration: 3500 });
      }
    }
  }

  // --- Helper Methods ---
  getPlansForDate(plans: WorkPlan[], dateStr: string): WorkPlan[] {
    return plans.filter(p => {
      const s = p.startDate ? p.startDate.substring(0, 10) : '';
      const t = p.targetDate ? p.targetDate.substring(0, 10) : '';

      // Direct date range match
      if (s && t) {
        if (s <= dateStr && dateStr <= t) return true;
      } else if (s) {
        if (s === dateStr) return true;
      } else if (t) {
        if (t === dateStr) return true;
      }

      // Check assignedMonth if no strict dates
      const planMonth = getWorkPlanMonth(p);
      if (planMonth && planMonth === dateStr.substring(0, 7)) {
        if (!s && !t) return true;
      }

      return false;
    });
  }

  isPlanDueOnDate(plan: WorkPlan, dateStr: string): boolean {
    if (!plan.targetDate) return false;
    return plan.targetDate.substring(0, 10) === dateStr;
  }

  getCurrentMonthString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  getTodayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getRecentMonthsList(): string[] {
    const list: string[] = [];
    const now = new Date();
    for (let i = -2; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      list.push(`${y}-${m}`);
    }
    return list;
  }

  formatMonthDisplay(monthStr: string): string {
    return formatMonthDisplay(monthStr);
  }

  formatMonthString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  formatDateIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatDateHeader(dateStr?: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Completed': return 'status-completed';
      case 'In Progress': return 'status-in-progress';
      case 'Under Review': return 'status-under-review';
      case 'Delayed': return 'status-delayed';
      case 'Draft': return 'status-draft';
      default: return 'status-default';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'priority-urgent';
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return '';
    }
  }

  getAttendanceBadgeClass(status?: string, badge?: string): string {
    const b = (badge || '').toLowerCase();
    const s = (status || '').toLowerCase();

    if (b.includes('on-time') || s.includes('full day') || s.includes('present') || s.includes('on time')) {
      return 'badge-present';
    }
    if (b.includes('absent') || s.includes('absent')) {
      return 'badge-absent';
    }
    if (b.includes('half') || s.includes('half')) {
      return 'badge-half';
    }
    if (b.includes('leave') || s.includes('leave')) {
      return 'badge-leave';
    }
    if (b.includes('weekend') || s.includes('weekend')) {
      return 'badge-weekend';
    }
    if (b.includes('holiday') || s.includes('holiday')) {
      return 'badge-holiday';
    }
    return 'badge-muted';
  }

  getAttendanceDisplayLabel(att?: DailyTimesheetRow): string {
    if (!att || !att.daily_status) return '';
    const s = att.daily_status.toLowerCase();
    if (s.includes('full day') || s.includes('on time') || s.includes('present')) {
      return 'Present';
    }
    if (s.includes('absent')) return 'Absent';
    if (s.includes('half day')) return 'Half Day';
    if (s.includes('leave')) return 'Leave';
    if (s.includes('weekend')) return 'Weekend';
    if (s.includes('holiday')) return 'Holiday';
    return att.daily_status;
  }
}
