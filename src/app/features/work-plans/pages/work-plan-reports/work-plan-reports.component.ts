import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  WorkPlan,
  WorkPlanVerifier,
  WorkPlanMilestone,
  WorkPlanService,
  getWorkPlanMonth,
  formatMonthDisplay,
  getPlanVerifiers,
  getCompletedVerifiersCount,
  areAllVerifiersApproved,
  getPlanDepartment,
  isWorkPlanOwner
} from '../../services/work-plan.service';
import { SettingsService, Division, Department } from '../../../settings/settings.service';
import { AuthService } from '../../../../auth/auth.service';
import { RbacService } from '../../../../auth/rbac.service';

export type ReportType = 'pending' | 'completed' | 'master' | 'individual' | 'department' | 'verification';

export interface ReportColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  required?: boolean;
}

export const REPORT_COLUMNS: Record<ReportType, ReportColumnDef[]> = {
  pending: [
    { id: 'num', label: '# (Row Number)', defaultVisible: true },
    { id: 'refId', label: 'Ref ID', defaultVisible: true },
    { id: 'title', label: 'Task Title & Objective', defaultVisible: true, required: true },
    { id: 'officer', label: 'Assigned Officer', defaultVisible: true },
    { id: 'department', label: 'Department', defaultVisible: true },
    { id: 'priority', label: 'Priority', defaultVisible: true },
    { id: 'targetDate', label: 'Target Date', defaultVisible: true },
    { id: 'remaining', label: 'Remaining / Due', defaultVisible: true },
    { id: 'progress', label: 'Progress %', defaultVisible: true },
    { id: 'status', label: 'Status', defaultVisible: true }
  ],
  completed: [
    { id: 'num', label: '# (Row Number)', defaultVisible: true },
    { id: 'refId', label: 'Ref ID', defaultVisible: true },
    { id: 'title', label: 'Task Title', defaultVisible: true, required: true },
    { id: 'officer', label: 'Assigned Officer', defaultVisible: true },
    { id: 'department', label: 'Department', defaultVisible: true },
    { id: 'targetDate', label: 'Target Date', defaultVisible: true },
    { id: 'completionDate', label: 'Completion Date', defaultVisible: true },
    { id: 'verifications', label: 'Verification Sign-Offs', defaultVisible: true },
    { id: 'remarks', label: 'Review Remarks', defaultVisible: true }
  ],
  master: [
    { id: 'num', label: '# (Row Number)', defaultVisible: true },
    { id: 'refId', label: 'Ref ID', defaultVisible: true },
    { id: 'title', label: 'Task Title', defaultVisible: true, required: true },
    { id: 'officer', label: 'Officer / Lead', defaultVisible: true },
    { id: 'department', label: 'Department', defaultVisible: true },
    { id: 'status', label: 'Status', defaultVisible: true },
    { id: 'priority', label: 'Priority', defaultVisible: true },
    { id: 'progress', label: 'Progress %', defaultVisible: true },
    { id: 'targetDate', label: 'Target Date', defaultVisible: true },
    { id: 'budget', label: 'Budget (LKR)', defaultVisible: true }
  ],
  individual: [
    { id: 'num', label: '# (Row Number)', defaultVisible: true },
    { id: 'refId', label: 'Ref ID', defaultVisible: true },
    { id: 'title', label: 'Directive Title & Scope', defaultVisible: true, required: true },
    { id: 'priority', label: 'Priority', defaultVisible: true },
    { id: 'startDate', label: 'Start Date', defaultVisible: true },
    { id: 'targetDate', label: 'Target Date', defaultVisible: true },
    { id: 'progress', label: 'Progress %', defaultVisible: true },
    { id: 'status', label: 'Status', defaultVisible: true },
    { id: 'verification', label: 'Verification State', defaultVisible: true }
  ],
  department: [
    { id: 'num', label: '# (Row Number)', defaultVisible: true },
    { id: 'deptName', label: 'Department Name', defaultVisible: true, required: true },
    { id: 'division', label: 'Division', defaultVisible: true },
    { id: 'totalTasks', label: 'Total Tasks', defaultVisible: true },
    { id: 'completed', label: 'Completed', defaultVisible: true },
    { id: 'inProgress', label: 'In Progress', defaultVisible: true },
    { id: 'delayed', label: 'Delayed', defaultVisible: true },
    { id: 'completionRate', label: 'Completion %', defaultVisible: true },
    { id: 'avgProgress', label: 'Avg Progress', defaultVisible: true },
    { id: 'budget', label: 'Budget (LKR)', defaultVisible: true }
  ],
  verification: [
    { id: 'num', label: '# (Row Number)', defaultVisible: true },
    { id: 'title', label: 'Directive Title', defaultVisible: true, required: true },
    { id: 'department', label: 'Department', defaultVisible: true },
    { id: 'milestones', label: 'Deliverable Milestones', defaultVisible: true },
    { id: 'stage', label: 'Stage', defaultVisible: true },
    { id: 'officer', label: 'Assigned Officer', defaultVisible: true },
    { id: 'signStatus', label: 'Sign Status', defaultVisible: true },
    { id: 'signedAt', label: 'Signed At', defaultVisible: true },
    { id: 'signerEmail', label: 'Signer Email', defaultVisible: true },
    { id: 'remarks', label: 'Remarks / Audit Notes', defaultVisible: true }
  ]
};

export interface OfficerDossier {
  officerName: string;
  officerEmail: string;
  department: string;
  division: string;
  totalPlans: number;
  completedPlans: number;
  pendingPlans: number;
  inProgressPlans: number;
  delayedPlans: number;
  totalBudget: number;
  avgProgress: number;
  milestonesTotal: number;
  milestonesCompleted: number;
  completionRate: number;
  plans: WorkPlan[];
}

export interface DepartmentReportSummary {
  department: string;
  division: string;
  totalPlans: number;
  completedPlans: number;
  inProgressPlans: number;
  pendingPlans: number;
  delayedPlans: number;
  totalBudget: number;
  avgProgress: number;
  completionRate: number;
}

export interface VerificationAuditItem {
  planId?: string;
  planTitle: string;
  department: string;
  division: string;
  stageOrder: number;
  stageName: string;
  assignedOfficerName: string;
  assignedOfficerEmail: string;
  verified: boolean;
  verifiedAt?: number | string;
  verifiedByEmail?: string;
  reviewComment?: string;
  planStatus: string;
  targetDate: string;
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesCompletionRate: number;
  milestones: WorkPlanMilestone[];
}

@Component({
  selector: 'app-work-plan-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatMenuModule,
    MatCheckboxModule
  ],
  templateUrl: './work-plan-reports.component.html',
  styleUrl: './work-plan-reports.component.scss'
})
export class WorkPlanReportsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private workPlanService = inject(WorkPlanService);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private snackBar = inject(MatSnackBar);

  // Core Data Signals
  workPlans = signal<WorkPlan[]>([]);
  divisions = signal<Division[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal<boolean>(true);

  // Month & Controls
  currentRunningMonth = signal<string>(new Date().toISOString().substring(0, 7)); // e.g. '2026-09'
  selectedMonth = signal<string>(new Date().toISOString().substring(0, 7));
  reportType = signal<ReportType>('pending');
  // View Mode: 'vertical' (Portrait A4: 210 × 297 mm) or 'horizontal' (Landscape A4: 297 × 210 mm)
  viewMode = signal<'vertical' | 'horizontal'>(
    (typeof localStorage !== 'undefined' && localStorage.getItem('work_plan_report_view_mode') === 'horizontal') ? 'horizontal' : 'vertical'
  );
  viewLayout = computed<'a4-preview' | 'responsive'>(() => 'a4-preview');

  // Visible columns map per report type: { pending: { num: true, refId: true, ... }, ... }
  visibleColumns = signal<Record<ReportType, Record<string, boolean>>>(this.loadVisibleColumns());

  private loadVisibleColumns(): Record<ReportType, Record<string, boolean>> {
    const defaults: Record<ReportType, Record<string, boolean>> = {
      pending: {},
      completed: {},
      master: {},
      individual: {},
      department: {},
      verification: {}
    };
    (Object.keys(REPORT_COLUMNS) as ReportType[]).forEach(type => {
      defaults[type] = {};
      REPORT_COLUMNS[type].forEach(col => {
        defaults[type][col.id] = col.defaultVisible;
      });
    });

    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('work_plan_report_visible_columns');
        if (saved) {
          const parsed = JSON.parse(saved);
          (Object.keys(defaults) as ReportType[]).forEach(type => {
            if (parsed[type]) {
              defaults[type] = { ...defaults[type], ...parsed[type] };
            }
          });
        }
      } catch (e) {
        console.warn('Failed to parse saved visible columns', e);
      }
    }
    return defaults;
  }

  private persistVisibleColumns() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('work_plan_report_visible_columns', JSON.stringify(this.visibleColumns()));
      } catch (e) {
        console.warn('Failed to save visible columns', e);
      }
    }
  }

  isColVisible(type: ReportType, colId: string): boolean {
    const reportMap = this.visibleColumns()[type];
    if (!reportMap) return true;
    return reportMap[colId] !== false;
  }

  toggleColumn(type: ReportType, colId: string, event?: any) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const current = this.visibleColumns();
    const reportMap = { ...(current[type] || {}) };
    const colDef = REPORT_COLUMNS[type]?.find(c => c.id === colId);
    if (colDef?.required) {
      return; // Cannot toggle off required column
    }
    reportMap[colId] = !this.isColVisible(type, colId);
    this.visibleColumns.set({
      ...current,
      [type]: reportMap
    });
    this.persistVisibleColumns();
  }

  selectAllColumns(type: ReportType, event?: any) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const current = this.visibleColumns();
    const reportMap = { ...(current[type] || {}) };
    (REPORT_COLUMNS[type] || []).forEach(col => {
      reportMap[col.id] = true;
    });
    this.visibleColumns.set({
      ...current,
      [type]: reportMap
    });
    this.persistVisibleColumns();
  }

  resetDefaultColumns(type: ReportType, event?: any) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const current = this.visibleColumns();
    const reportMap: Record<string, boolean> = {};
    (REPORT_COLUMNS[type] || []).forEach(col => {
      reportMap[col.id] = col.defaultVisible;
    });
    this.visibleColumns.set({
      ...current,
      [type]: reportMap
    });
    this.persistVisibleColumns();
  }

  getVisibleColCount(type: ReportType): number {
    const cols = REPORT_COLUMNS[type] || [];
    return cols.filter(c => this.isColVisible(type, c.id)).length;
  }

  getColumnsDef(type: ReportType): ReportColumnDef[] {
    return REPORT_COLUMNS[type] || [];
  }

  getReportTitle(type: ReportType): string {
    switch (type) {
      case 'pending': return 'Whole Month Pending Directives';
      case 'completed': return 'Completed Directives with Status';
      case 'master': return 'Monthly Master Register';
      case 'individual': return 'Individual Officer Dossier';
      case 'department': return 'Department Summary Matrix';
      case 'verification': return 'Verification Audit Log';
      default: return 'Report';
    }
  }

  // Filters
  selectedDivision = signal<string>('all');
  selectedDepartment = signal<string>('all');
  selectedOfficer = signal<string>('all');
  selectedPriority = signal<string>('all');
  searchQuery = signal<string>('');

  // Generation Metadata
  generatedAt = signal<Date>(new Date());

  constructor() {
    effect(() => {
      // Whenever settings, userRoles, or reportType changes, reactively ensure reportType is accessible
      this.workPlanService.settings();
      this.rbacService.userRoles();
      const current = this.reportType();

      if (!this.canAccessReport(current)) {
        const allTypes: ReportType[] = ['pending', 'completed', 'master', 'individual', 'department', 'verification'];
        const firstAllowed = allTypes.find(t => this.canAccessReport(t));
        if (firstAllowed) {
          this.reportType.set(firstAllowed);
        }
      }

      // If viewing individual dossier and user cannot view all officers, default to own dossier
      if (this.reportType() === 'individual' && !this.canViewAllOfficers()) {
        const u = this.currentUser();
        if (u) {
          const off = u.email || u.displayName || 'all';
          if (this.selectedOfficer() !== off) {
            this.selectedOfficer.set(off);
          }
        }
      }
    }, { allowSignalWrites: true });
  }

  // Role Permissions
  canAccessReport(type: ReportType): boolean {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }

    const settings = this.workPlanService.settings();
    const repTypeRoles = settings.rolesPermittedByReportType;
    if (repTypeRoles && repTypeRoles[type] !== undefined) {
      const allowed = repTypeRoles[type] || [];
      return this.rbacService.hasAnyRole(allowed);
    }

    // Fallback to legacy settings if rolesPermittedByReportType not populated
    if (type === 'individual') {
      const permittedRoles = settings.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];
      return this.rbacService.hasAnyRole(permittedRoles);
    } else {
      const permittedRoles = settings.rolesPermittedForAllReports || ['Super Admin', 'Divisional Admin', 'Department Head'];
      return this.rbacService.hasAnyRole(permittedRoles);
    }
  }

  canViewAllOfficers = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    return this.canAccessReport('master') || 
           this.canAccessReport('pending') || 
           this.canAccessReport('completed') || 
           this.canAccessReport('department') ||
           this.canAccessReport('verification');
  });

  canAccessAllReports = computed(() => {
    return this.canAccessReport('pending') &&
           this.canAccessReport('completed') &&
           this.canAccessReport('master') &&
           this.canAccessReport('department') &&
           this.canAccessReport('verification');
  });

  canAccessIndividualReports = computed(() => {
    return this.canAccessReport('individual');
  });

  hasAnyReportAccess = computed(() => {
    return this.canAccessReport('pending') ||
           this.canAccessReport('completed') ||
           this.canAccessReport('master') ||
           this.canAccessReport('individual') ||
           this.canAccessReport('department') ||
           this.canAccessReport('verification');
  });

  canAccessVerification = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canManageSettings = computed(() => {
    return this.rbacService.hasPermission('work-plans:manage_policies') || this.rbacService.isSuperAdmin() || this.rbacService.isAdmin();
  });

  currentUser = computed(() => this.authService.currentUser());
  currentUserName = computed(() => this.currentUser()?.displayName || this.currentUser()?.email || 'System Operator');

  // Available Month options (dynamically generated: past 12 months & next 6 months)
  availableMonths = computed(() => {
    const list: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = -12; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = d.toISOString().substring(0, 7);
      list.push({ key, label: formatMonthDisplay(key) });
    }
    return list;
  });

  // Filtered raw plans strictly matching selected Month, Division, Department, Priority & Search
  monthPlans = computed(() => {
    const month = this.selectedMonth();
    const plans = this.workPlans();

    return plans.filter(plan => {
      const pMonth = getWorkPlanMonth(plan);
      const isMonthMatch = (month === 'all' || pMonth === month);

      if (!isMonthMatch) return false;

      // Division filter
      if (this.selectedDivision() !== 'all' && plan.division !== this.selectedDivision()) {
        return false;
      }

      // Department filter
      if (this.selectedDepartment() !== 'all') {
        const dept = getPlanDepartment(plan);
        if (dept.toLowerCase() !== this.selectedDepartment().toLowerCase()) {
          return false;
        }
      }

      // Priority filter
      if (this.selectedPriority() !== 'all' && plan.priority !== this.selectedPriority()) {
        return false;
      }

      // Search Query
      if (this.searchQuery().trim()) {
        const q = this.searchQuery().toLowerCase().trim();
        const matchTitle = plan.title?.toLowerCase().includes(q);
        const matchDesc = plan.description?.toLowerCase().includes(q);
        const matchLead = plan.leadName?.toLowerCase().includes(q) || plan.ownerName?.toLowerCase().includes(q);
        const matchDept = (plan.department || plan.division || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLead && !matchDept) return false;
      }

      return true;
    });
  });

  // Unique Officers List for the Officer Dropdown
  availableOfficers = computed(() => {
    if (!this.canViewAllOfficers()) {
      const u = this.currentUser();
      return [{
        name: u?.displayName || 'Personal Dossier',
        email: u?.email || ''
      }];
    }
    const plans = this.workPlans();
    const map = new Map<string, { name: string; email: string }>();

    for (const p of plans) {
      const name = p.ownerName || p.leadName;
      const email = p.ownerEmail || p.leadEmail || '';
      if (name) {
        const key = email || name;
        if (!map.has(key)) {
          map.set(key, { name, email });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  });

  // 1. Whole Month Pending Tasks (Pending, In Progress, Delayed, Under Review)
  pendingPlans = computed(() => {
    const plans = this.monthPlans();
    const officer = this.selectedOfficer();

    return plans.filter(p => {
      const isPending = p.status === 'In Progress' || p.status === 'Delayed' || p.status === 'Draft' || p.status === 'Under Review';
      if (!isPending) return false;

      if (officer !== 'all') {
        const off = officer.toLowerCase().trim();
        const oEmail = (p.ownerEmail || '').toLowerCase().trim();
        const oName = (p.ownerName || '').toLowerCase().trim();
        const officerMatch = (oEmail || oName)
          ? (oEmail === off || oName === off)
          : ((p.leadEmail || '').toLowerCase().trim() === off || (p.leadName || '').toLowerCase().trim() === off);
        if (!officerMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.status === 'Delayed' && b.status !== 'Delayed') return -1;
      if (b.status === 'Delayed' && a.status !== 'Delayed') return 1;
      return a.targetDate.localeCompare(b.targetDate);
    });
  });

  // 2. Whole Month Completed Tasks with Status & Verification
  completedPlans = computed(() => {
    const plans = this.monthPlans();
    const officer = this.selectedOfficer();

    return plans.filter(p => {
      if (p.status !== 'Completed') return false;

      if (officer !== 'all') {
        const off = officer.toLowerCase().trim();
        const oEmail = (p.ownerEmail || '').toLowerCase().trim();
        const oName = (p.ownerName || '').toLowerCase().trim();
        const officerMatch = (oEmail || oName)
          ? (oEmail === off || oName === off)
          : ((p.leadEmail || '').toLowerCase().trim() === off || (p.leadName || '').toLowerCase().trim() === off);
        if (!officerMatch) return false;
      }

      return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  });

  // 3. Comprehensive Monthly Master Register (All plans for the month)
  masterPlans = computed(() => {
    const plans = this.monthPlans();
    const officer = this.selectedOfficer();

    if (officer === 'all') return plans;

    const off = officer.toLowerCase().trim();
    return plans.filter(p => {
      const oEmail = (p.ownerEmail || '').toLowerCase().trim();
      const oName = (p.ownerName || '').toLowerCase().trim();
      return (oEmail || oName)
        ? (oEmail === off || oName === off)
        : ((p.leadEmail || '').toLowerCase().trim() === off || (p.leadName || '').toLowerCase().trim() === off);
    });
  });

  // 4. Individual Officer Dossiers (A4 Dossier per officer)
  officerDossiers = computed<OfficerDossier[]>(() => {
    let plans = this.monthPlans();
    if (!this.canViewAllOfficers()) {
      const u = this.currentUser();
      plans = plans.filter(p => isWorkPlanOwner(p, u?.email, u?.displayName, u?.uid));
    }
    const selectedOff = this.selectedOfficer();
    const map = new Map<string, OfficerDossier>();

    for (const p of plans) {
      const officerName = p.ownerName || p.leadName || 'Unassigned Officer';
      const officerEmail = p.ownerEmail || p.leadEmail || '';
      const key = (officerEmail || officerName).toLowerCase().trim();

      if (selectedOff !== 'all' && key !== selectedOff.toLowerCase().trim() && officerName.toLowerCase().trim() !== selectedOff.toLowerCase().trim()) {
        continue;
      }

      if (!map.has(key)) {
        map.set(key, {
          officerName,
          officerEmail,
          department: getPlanDepartment(p),
          division: p.division,
          totalPlans: 0,
          completedPlans: 0,
          pendingPlans: 0,
          inProgressPlans: 0,
          delayedPlans: 0,
          totalBudget: 0,
          avgProgress: 0,
          milestonesTotal: 0,
          milestonesCompleted: 0,
          completionRate: 0,
          plans: []
        });
      }

      const dossier = map.get(key)!;
      dossier.totalPlans++;
      dossier.plans.push(p);
      dossier.totalBudget += (p.budget || 0);

      if (p.status === 'Completed') dossier.completedPlans++;
      else if (p.status === 'In Progress' || p.status === 'Under Review') dossier.inProgressPlans++;
      else if (p.status === 'Delayed') dossier.delayedPlans++;
      else dossier.pendingPlans++;

      const ms = p.milestones || [];
      dossier.milestonesTotal += ms.length;
      dossier.milestonesCompleted += ms.filter(m => m.completed).length;
    }

    const dossiers = Array.from(map.values());
    for (const d of dossiers) {
      const sumProgress = d.plans.reduce((sum, p) => sum + (p.progress || 0), 0);
      d.avgProgress = d.totalPlans > 0 ? Math.round(sumProgress / d.totalPlans) : 0;
      d.completionRate = d.totalPlans > 0 ? Math.round((d.completedPlans / d.totalPlans) * 100) : 0;
      d.plans.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    }

    return dossiers.sort((a, b) => a.officerName.localeCompare(b.officerName));
  });

  // 5. Department Summary Matrix
  departmentSummaries = computed<DepartmentReportSummary[]>(() => {
    const plans = this.monthPlans();
    const map = new Map<string, DepartmentReportSummary>();

    for (const p of plans) {
      const dept = getPlanDepartment(p);
      const div = p.division || 'Central';
      const key = `${dept}___${div}`;

      if (!map.has(key)) {
        map.set(key, {
          department: dept,
          division: div,
          totalPlans: 0,
          completedPlans: 0,
          inProgressPlans: 0,
          pendingPlans: 0,
          delayedPlans: 0,
          totalBudget: 0,
          avgProgress: 0,
          completionRate: 0
        });
      }

      const summary = map.get(key)!;
      summary.totalPlans++;
      summary.totalBudget += (p.budget || 0);

      if (p.status === 'Completed') summary.completedPlans++;
      else if (p.status === 'In Progress' || p.status === 'Under Review') summary.inProgressPlans++;
      else if (p.status === 'Delayed') summary.delayedPlans++;
      else summary.pendingPlans++;
    }

    const summaries = Array.from(map.values());
    for (const s of summaries) {
      const deptPlans = plans.filter(p => getPlanDepartment(p) === s.department && p.division === s.division);
      const totalProg = deptPlans.reduce((sum, p) => sum + (p.progress || 0), 0);
      s.avgProgress = s.totalPlans > 0 ? Math.round(totalProg / s.totalPlans) : 0;
      s.completionRate = s.totalPlans > 0 ? Math.round((s.completedPlans / s.totalPlans) * 100) : 0;
    }

    return summaries.sort((a, b) => a.department.localeCompare(b.department));
  });

  // 6. Verification Audit Trail Report
  verificationAuditTrail = computed<VerificationAuditItem[]>(() => {
    const plans = this.monthPlans();
    const items: VerificationAuditItem[] = [];

    for (const p of plans) {
      const verifiers = getPlanVerifiers(p);
      const ms = p.milestones || [];
      const mTotal = ms.length;
      const mCompleted = ms.filter(m => m.completed).length;
      const mRate = mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0;

      for (const v of verifiers) {
        items.push({
          planId: p.id,
          planTitle: p.title,
          department: getPlanDepartment(p),
          division: p.division,
          stageOrder: v.order,
          stageName: `Stage ${v.order}: ${v.role || 'Verifier'}`,
          assignedOfficerName: v.name,
          assignedOfficerEmail: v.email,
          verified: v.verified,
          verifiedAt: v.verifiedAt,
          verifiedByEmail: v.verifiedByEmail,
          reviewComment: v.reviewComment || (p.revisionNotes ? `Rollback: ${p.revisionNotes}` : undefined),
          planStatus: p.status,
          targetDate: p.targetDate,
          milestonesTotal: mTotal,
          milestonesCompleted: mCompleted,
          milestonesCompletionRate: mRate,
          milestones: ms
        });
      }
    }

    return items.sort((a, b) => {
      const cmp = a.planTitle.localeCompare(b.planTitle);
      if (cmp !== 0) return cmp;
      return a.stageOrder - b.stageOrder;
    });
  });

  // KPI Summary for Active Filtered Set
  reportKPIs = computed(() => {
    const plans = this.monthPlans();
    const total = plans.length;
    const completed = plans.filter(p => p.status === 'Completed').length;
    const inProgress = plans.filter(p => p.status === 'In Progress' || p.status === 'Under Review').length;
    const delayed = plans.filter(p => p.status === 'Delayed').length;
    const pending = plans.filter(p => p.status === 'Draft').length;
    const totalBudget = plans.reduce((sum, p) => sum + (p.budget || 0), 0);
    const avgProgress = total > 0 ? Math.round(plans.reduce((sum, p) => sum + (p.progress || 0), 0) / total) : 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let totalMilestones = 0;
    let completedMilestones = 0;
    for (const p of plans) {
      const ms = p.milestones || [];
      totalMilestones += ms.length;
      completedMilestones += ms.filter(m => m.completed).length;
    }

    return {
      total,
      completed,
      inProgress,
      delayed,
      pending,
      totalBudget,
      avgProgress,
      completionRate,
      totalMilestones,
      completedMilestones
    };
  });

  ngOnInit() {
    if (!this.hasAnyReportAccess()) {
      this.snackBar.open('Access Denied: You do not have permission to access Work Plan Reports.', 'Dismiss', { duration: 3500 });
      this.router.navigate(['/work-plans/tasks']);
      return;
    }

    const allTypes: ReportType[] = ['pending', 'completed', 'master', 'individual', 'department', 'verification'];
    if (!this.canAccessReport(this.reportType())) {
      const firstAllowed = allTypes.find(t => this.canAccessReport(t));
      if (firstAllowed) {
        this.reportType.set(firstAllowed);
      }
    }

    if (this.reportType() === 'individual' && !this.canAccessReport('master')) {
      const u = this.currentUser();
      if (u) {
        this.selectedOfficer.set(u.email || u.displayName || 'all');
      }
    }
    this.updatePrintOrientationStyle(this.viewMode());
    this.loadData();
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('work-plan-print-orientation-style');
      if (el) el.remove();
    }
  }

  setViewMode(mode: 'vertical' | 'horizontal') {
    this.viewMode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('work_plan_report_view_mode', mode);
    }
    this.updatePrintOrientationStyle(mode);
    this.snackBar.open(`View mode set to ${mode === 'horizontal' ? 'Horizontal (Landscape A4)' : 'Vertical (Portrait A4)'}`, 'Dismiss', { duration: 2500 });
  }

  updatePrintOrientationStyle(mode: 'vertical' | 'horizontal') {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('work-plan-print-orientation-style') as HTMLStyleElement;
    if (!el) {
      el = document.createElement('style');
      el.id = 'work-plan-print-orientation-style';
      document.head.appendChild(el);
    }
    const isHorizontal = mode === 'horizontal';
    el.textContent = `
      @media print {
        @page {
          size: A4 ${isHorizontal ? 'landscape' : 'portrait'} !important;
          margin: ${isHorizontal ? '6mm 8mm' : '8mm 10mm'} !important;
        }
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
          background: #ffffff !important;
        }
        .report-wrapper,
        .a4-page {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      }
    `;
  }

  selectReportType(type: ReportType) {
    if (!this.canAccessReport(type)) {
      this.snackBar.open('Your user role does not have permission to view this report option.', 'Dismiss', { duration: 3000 });
      return;
    }
    this.reportType.set(type);
  }

  loadData() {
    this.isLoading.set(true);
    this.workPlanService.getWorkPlans().subscribe({
      next: (plans) => {
        this.workPlans.set(plans || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.workPlans.set([]);
        this.isLoading.set(false);
      }
    });

    this.settingsService.getDivisions().subscribe({
      next: (divs) => this.divisions.set(divs || [])
    });

    this.settingsService.getDepartments().subscribe({
      next: (depts) => this.departments.set(depts || [])
    });
  }

  shiftMonth(delta: number) {
    const current = this.selectedMonth();
    const [yStr, mStr] = current.split('-');
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10) + delta;

    if (month < 1) {
      month = 12;
      year--;
    } else if (month > 12) {
      month = 1;
      year++;
    }

    const nextMonth = `${year}-${String(month).padStart(2, '0')}`;
    this.selectedMonth.set(nextMonth);
    this.generatedAt.set(new Date());
  }

  resetToCurrentMonth() {
    this.selectedMonth.set(this.currentRunningMonth());
    this.generatedAt.set(new Date());
  }

  getFormattedMonth(): string {
    return formatMonthDisplay(this.selectedMonth());
  }

  getDaysRemaining(targetDateStr: string): { text: string; isOverdue: boolean } {
    if (!targetDateStr) return { text: 'N/A', isOverdue: false };
    const target = new Date(targetDateStr);
    const now = new Date();
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false };
    } else {
      return { text: `${diffDays}d left`, isOverdue: false };
    }
  }

  getVerifiers(plan: WorkPlan): WorkPlanVerifier[] {
    return getPlanVerifiers(plan);
  }

  getLastReviewRemarks(plan: WorkPlan): string {
    const verifiers = getPlanVerifiers(plan);
    // Find the last verifier who provided reviewComment
    for (let i = verifiers.length - 1; i >= 0; i--) {
      const v = verifiers[i];
      if (v.reviewComment && v.reviewComment.trim()) {
        return `[Stage ${v.order}${v.name ? ' - ' + v.name : ''}]: ${v.reviewComment.trim()}`;
      }
    }
    // Check revisionNotes / rollback comment
    if (plan.revisionNotes && plan.revisionNotes.trim()) {
      return `[Revision]: ${plan.revisionNotes.trim()}`;
    }
    return 'Approved as per directive.';
  }

  triggerPrint(targetReportType?: ReportType) {
    const target = targetReportType || this.reportType();
    if (!this.canAccessReport(target)) {
      this.snackBar.open('Your user role does not have permission to print this report.', 'Dismiss', { duration: 3000 });
      return;
    }
    if (targetReportType) {
      this.reportType.set(targetReportType);
    }
    this.updatePrintOrientationStyle(this.viewMode());
    this.generatedAt.set(new Date());
    setTimeout(() => {
      window.print();
    }, 200);
  }

  printIndividualDossier(officerIdentifier: string) {
    if (!this.canAccessReport('individual')) {
      this.snackBar.open('Your user role does not have permission to print officer dossiers.', 'Dismiss', { duration: 3000 });
      return;
    }
    this.reportType.set('individual');
    this.updatePrintOrientationStyle(this.viewMode());
    this.selectedOfficer.set(officerIdentifier);
    this.generatedAt.set(new Date());
    setTimeout(() => {
      window.print();
    }, 200);
  }

  exportToCsv() {
    if (!this.hasAnyReportAccess()) {
      this.snackBar.open('You do not have permission to export reports.', 'Dismiss', { duration: 3000 });
      return;
    }
    const type = this.reportType();
    if (!this.canAccessReport(type)) {
      this.snackBar.open('Your user role does not have permission to export this report option.', 'Dismiss', { duration: 3000 });
      return;
    }
    const month = this.selectedMonth();
    let csvContent = '';
    let filename = `DONM_Report_${type}_${month}.csv`;

    if (type === 'pending') {
      csvContent = this.generatePendingCsv();
    } else if (type === 'completed') {
      csvContent = this.generateCompletedCsv();
    } else if (type === 'master') {
      csvContent = this.generateMasterCsv();
    } else if (type === 'individual') {
      csvContent = this.generateIndividualCsv();
    } else if (type === 'department') {
      csvContent = this.generateDepartmentCsv();
    } else if (type === 'verification') {
      csvContent = this.generateVerificationCsv();
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.snackBar.open(`Report exported: ${filename}`, 'Close', { duration: 3000 });
  }

  private escapeCsv(value: any): string {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  }

  private generatePendingCsv(): string {
    const rows = [
      ['Ref ID', 'Title', 'Assigned Officer', 'Department', 'Division', 'Priority', 'Status', 'Start Date', 'Target Date', 'Progress %', 'Overdue Info', 'Milestones Completed', 'Total Milestones', 'Budget']
    ];

    for (const p of this.pendingPlans()) {
      const ms = p.milestones || [];
      const msDone = ms.filter(m => m.completed).length;
      const overdue = this.getDaysRemaining(p.targetDate).text;

      rows.push([
        p.id || 'N/A',
        p.title,
        p.ownerName || p.leadName || 'Unassigned',
        getPlanDepartment(p),
        p.division,
        p.priority,
        p.status,
        p.startDate,
        p.targetDate,
        `${p.progress}%`,
        overdue,
        msDone.toString(),
        ms.length.toString(),
        (p.budget || 0).toString()
      ]);
    }

    return rows.map(r => r.map(c => this.escapeCsv(c)).join(',')).join('\r\n');
  }

  private generateCompletedCsv(): string {
    const rows = [
      ['Ref ID', 'Title', 'Assigned Officer', 'Department', 'Division', 'Priority', 'Target Date', 'Completed Date', 'Progress %', 'Verification Stages', 'Review Comments', 'Budget']
    ];

    for (const p of this.completedPlans()) {
      const verifiers = getPlanVerifiers(p);
      const vSummary = verifiers.map(v => `Stage ${v.order}: ${v.name} (${v.verified ? 'Verified' : 'Pending'})`).join('; ');
      const comments = verifiers.map(v => v.reviewComment ? `[Stg ${v.order}] ${v.reviewComment}` : '').filter(Boolean).join('; ');

      rows.push([
        p.id || 'N/A',
        p.title,
        p.ownerName || p.leadName || 'Unassigned',
        getPlanDepartment(p),
        p.division,
        p.priority,
        p.targetDate,
        p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : 'N/A',
        `${p.progress}%`,
        vSummary,
        this.getLastReviewRemarks(p),
        (p.budget || 0).toString()
      ]);
    }

    return rows.map(r => r.map(c => this.escapeCsv(c)).join(',')).join('\r\n');
  }

  private generateMasterCsv(): string {
    const rows = [
      ['Ref ID', 'Title', 'Officer', 'Department', 'Division', 'Status', 'Priority', 'Progress %', 'Start Date', 'Target Date', 'Budget', 'Verifiers Approved']
    ];

    for (const p of this.masterPlans()) {
      const verifiers = getPlanVerifiers(p);
      const approvedCount = verifiers.filter(v => v.verified).length;

      rows.push([
        p.id || 'N/A',
        p.title,
        p.ownerName || p.leadName || 'Unassigned',
        getPlanDepartment(p),
        p.division,
        p.status,
        p.priority,
        `${p.progress}%`,
        p.startDate,
        p.targetDate,
        (p.budget || 0).toString(),
        `${approvedCount}/${verifiers.length}`
      ]);
    }

    return rows.map(r => r.map(c => this.escapeCsv(c)).join(',')).join('\r\n');
  }

  private generateIndividualCsv(): string {
    const rows = [
      ['Officer Name', 'Email', 'Department', 'Division', 'Total Tasks', 'Completed', 'In Progress', 'Delayed', 'Pending', 'Completion Rate %', 'Avg Progress %', 'Milestones Met', 'Total Budget']
    ];

    for (const d of this.officerDossiers()) {
      rows.push([
        d.officerName,
        d.officerEmail,
        d.department,
        d.division,
        d.totalPlans.toString(),
        d.completedPlans.toString(),
        d.inProgressPlans.toString(),
        d.delayedPlans.toString(),
        d.pendingPlans.toString(),
        `${d.completionRate}%`,
        `${d.avgProgress}%`,
        `${d.milestonesCompleted}/${d.milestonesTotal}`,
        d.totalBudget.toString()
      ]);
    }

    return rows.map(r => r.map(c => this.escapeCsv(c)).join(',')).join('\r\n');
  }

  private generateDepartmentCsv(): string {
    const rows = [
      ['Department', 'Division', 'Total Tasks', 'Completed', 'In Progress', 'Delayed', 'Pending', 'Completion Rate %', 'Avg Progress %', 'Total Budget']
    ];

    for (const s of this.departmentSummaries()) {
      rows.push([
        s.department,
        s.division,
        s.totalPlans.toString(),
        s.completedPlans.toString(),
        s.inProgressPlans.toString(),
        s.delayedPlans.toString(),
        s.pendingPlans.toString(),
        `${s.completionRate}%`,
        `${s.avgProgress}%`,
        s.totalBudget.toString()
      ]);
    }

    return rows.map(r => r.map(c => this.escapeCsv(c)).join(',')).join('\r\n');
  }

  private generateVerificationCsv(): string {
    const rows = [
      ['Plan Ref', 'Plan Title', 'Department', 'Division', 'Deliverable Milestones', 'Milestones Completed', 'Total Milestones', 'Milestones Detail', 'Stage Order', 'Stage Role', 'Assigned Verifier', 'Email', 'Status', 'Verified At', 'Signed By', 'Review Remark', 'Target Date']
    ];

    for (const item of this.verificationAuditTrail()) {
      const msSummary = item.milestonesTotal > 0
        ? `${item.milestonesCompleted}/${item.milestonesTotal} (${item.milestonesCompletionRate}%)`
        : 'None';
      const msDetail = (item.milestones || []).map(m => `[${m.completed ? 'Delivered' : 'Pending'}] ${m.title}`).join('; ');

      rows.push([
        item.planId || 'N/A',
        item.planTitle,
        item.department,
        item.division,
        msSummary,
        item.milestonesCompleted.toString(),
        item.milestonesTotal.toString(),
        msDetail || 'None',
        item.stageOrder.toString(),
        item.stageName,
        item.assignedOfficerName,
        item.assignedOfficerEmail,
        item.verified ? 'Approved' : 'Pending Sign-off',
        item.verifiedAt ? new Date(item.verifiedAt).toLocaleString() : 'N/A',
        item.verifiedByEmail || 'N/A',
        item.reviewComment || 'N/A',
        item.targetDate
      ]);
    }

    return rows.map(r => r.map(c => this.escapeCsv(c)).join(',')).join('\r\n');
  }
}
