import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { WorkPlan, WorkPlanService, getWorkPlanMonth, formatMonthDisplay, isWorkPlanOwner } from '../../services/work-plan.service';
import { WorkPlanDialogComponent } from '../../components/work-plan-dialog/work-plan-dialog.component';
import { WorkPlanDetailDialogComponent } from '../../components/work-plan-detail-dialog/work-plan-detail-dialog.component';
import { SettingsService, Division, Department } from '../../../settings/settings.service';
import { AuthService } from '../../../../auth/auth.service';
import { RbacService } from '../../../../auth/rbac.service';
import { EventLogService } from '../../../../core/services/event-log.service';

export interface UserSummary {
  leadName: string;
  leadEmail: string;
  division: string;
  totalPlans: number;
  inProgressCount: number;
  completedCount: number;
  underReviewCount: number;
  draftCount: number;
  delayedCount: number;
  urgentCount: number;
  totalBudget: number;
  totalMilestones: number;
  completedMilestones: number;
  milestoneRate: number;
  avgProgress: number;
  plans: WorkPlan[];
}

@Component({
  selector: 'app-work-plan-dashboard',
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
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './work-plan-dashboard.component.html',
  styleUrl: './work-plan-dashboard.component.scss'
})
export class WorkPlanDashboardComponent implements OnInit {
  private workPlanService = inject(WorkPlanService);
  private settingsService = inject(SettingsService);
  private eventLogService = inject(EventLogService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  workPlans = signal<WorkPlan[]>([]);
  divisions = signal<Division[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal<boolean>(true);

  // View Scope & Permissions
  viewScope = signal<'all' | 'own'>('all');

  // Filters & Controls
  searchQuery = signal<string>('');
  selectedDivision = signal<string>('all');
  selectedDepartment = signal<string>('all');
  selectedMonth = signal<string>('all');
  userViewMode = signal<'cards' | 'table'>('cards');
  selectedUserForModal = signal<UserSummary | null>(null);

  displayedColumns: string[] = ['officer', 'division', 'directives', 'totalPlans', 'statusBreakdown', 'milestones', 'avgProgress', 'budget', 'actions'];

  // Permission: Can the user view All Users Summary? (Configured in Work Plan Settings)
  canViewAllSummary = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin() || this.rbacService.isDepartmentHead()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForSummary || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:view_all_summary') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canAccessVerification = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForVerification || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:verify_signoff') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canCreatePlan = computed(() => {
    return this.rbacService.hasPermission('work-plans:create_plan');
  });

  canManageSettings = computed(() => {
    return this.rbacService.hasPermission('work-plans:manage_policies') || this.rbacService.isSuperAdmin() || this.rbacService.isAdmin();
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

  // Effective Scope: If user lacks permission, force 'own'
  effectiveViewScope = computed(() => {
    if (!this.canViewAllSummary()) {
      return 'own';
    }
    return this.viewScope();
  });

  currentUser = computed(() => this.authService.currentUser());

  ngOnInit() {
    this.loadData();
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

  // Filtered master plans according to month, division & department
  scopedPlans = computed(() => {
    let plans = this.workPlans();
    const m = this.selectedMonth();
    if (m !== 'all') {
      plans = plans.filter(p => getWorkPlanMonth(p) === m);
    }
    const div = this.selectedDivision();
    if (div !== 'all') {
      plans = plans.filter(p => p.division === div);
    }
    const dept = this.selectedDepartment();
    if (dept !== 'all') {
      plans = plans.filter(p => (p.department || p.division) === dept);
    }
    return plans;
  });

  // Available months for scoping
  availableMonths = computed(() => {
    const set = new Set<string>();
    for (const p of this.workPlans()) {
      set.add(getWorkPlanMonth(p));
    }
    return Array.from(set).sort();
  });

  // Plans filtered by effectiveViewScope ('all' vs 'own')
  effectivePlans = computed(() => {
    const all = this.scopedPlans();
    if (this.effectiveViewScope() === 'own') {
      const u = this.currentUser();
      if (!u) return [];
      return all.filter(p => isWorkPlanOwner(p, u.email, u.displayName, u.uid));
    }
    return all;
  });

  // --- OVERALL USERS SUMMARY COMPUTATION ---
  overallUsersSummary = computed(() => {
    const plans = this.effectivePlans();
    const userMap = new Set<string>();

    let totalBudget = 0;
    let totalMilestones = 0;
    let completedMilestones = 0;
    let inProgress = 0;
    let completed = 0;
    let underReview = 0;
    let urgent = 0;
    let totalProgressSum = 0;

    for (const p of plans) {
      const officerKey = (p.ownerName || p.leadName || 'Unassigned').trim().toLowerCase();
      userMap.add(officerKey);
      totalBudget += p.budget || 0;
      totalProgressSum += p.progress || 0;

      if (p.status === 'In Progress') inProgress++;
      else if (p.status === 'Completed') completed++;
      else if (p.status === 'Under Review') underReview++;

      if (p.priority === 'Urgent') urgent++;

      if (p.milestones) {
        totalMilestones += p.milestones.length;
        completedMilestones += p.milestones.filter(m => m.completed).length;
      }
    }

    const milestoneRate = totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

    const overallProgress = plans.length > 0
      ? Math.round(totalProgressSum / plans.length)
      : 0;

    return {
      totalOfficers: userMap.size,
      totalDirectives: plans.length,
      inProgressDirectives: inProgress,
      completedDirectives: completed,
      underReviewDirectives: underReview,
      urgentDirectives: urgent,
      totalBudget,
      totalMilestones,
      completedMilestones,
      milestoneRate,
      overallProgress
    };
  });

  // --- EACH USER SUMMARY BREAKDOWN ---
  eachUserSummary = computed<UserSummary[]>(() => {
    const plans = this.effectivePlans();
    const groups = new Map<string, WorkPlan[]>();

    // Group plans by officer name (owner / performer)
    for (const p of plans) {
      const key = (p.ownerName || p.leadName || 'Unassigned').trim();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    }

    const summaries: UserSummary[] = [];

    for (const [officerName, userPlans] of groups.entries()) {
      let totalBudget = 0;
      let totalMilestones = 0;
      let completedMilestones = 0;
      let inProgress = 0;
      let completed = 0;
      let underReview = 0;
      let draft = 0;
      let delayed = 0;
      let urgent = 0;
      let progressSum = 0;

      for (const p of userPlans) {
        totalBudget += p.budget || 0;
        progressSum += p.progress || 0;
        if (p.status === 'In Progress') inProgress++;
        else if (p.status === 'Completed') completed++;
        else if (p.status === 'Under Review') underReview++;
        else if (p.status === 'Draft') draft++;
        else if (p.status === 'Delayed') delayed++;

        if (p.priority === 'Urgent') urgent++;

        if (p.milestones) {
          totalMilestones += p.milestones.length;
          completedMilestones += p.milestones.filter(m => m.completed).length;
        }
      }

      const milestoneRate = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
      const avgProgress = userPlans.length > 0 ? Math.round(progressSum / userPlans.length) : 0;
      const firstPlan = userPlans[0];
      const officerEmail = firstPlan.ownerEmail || firstPlan.leadEmail || `${officerName.toLowerCase().replace(/\s+/g, '.')}@network.gov`;

      summaries.push({
        leadName: officerName,
        leadEmail: officerEmail,
        division: firstPlan.division || 'Central Operations',
        totalPlans: userPlans.length,
        inProgressCount: inProgress,
        completedCount: completed,
        underReviewCount: underReview,
        draftCount: draft,
        delayedCount: delayed,
        urgentCount: urgent,
        totalBudget,
        totalMilestones,
        completedMilestones,
        milestoneRate,
        avgProgress,
        plans: userPlans
      });
    }

    // Apply search query filter
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return summaries;
    }

    return summaries.filter(s =>
      s.leadName.toLowerCase().includes(query) ||
      s.leadEmail.toLowerCase().includes(query) ||
      s.division.toLowerCase().includes(query)
    );
  });

  formatMonth(mStr: string): string {
    return formatMonthDisplay(mStr);
  }

  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  openUserModal(user: UserSummary) {
    this.selectedUserForModal.set(user);
  }

  closeUserModal() {
    this.selectedUserForModal.set(null);
  }

  openPlanDetail(plan: WorkPlan) {
    this.dialog.open(WorkPlanDetailDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { plan }
    });
  }

  openCreateDialog() {
    if (!this.canCreatePlan()) {
      this.snackBar.open('You do not have permission to author new work plans.', 'Dismiss', { duration: 3000 });
      return;
    }

    const targetMonth = this.selectedMonth() !== 'all' ? this.selectedMonth() : undefined;
    const curUser = this.currentUser();
    const ref = this.dialog.open(WorkPlanDialogComponent, {
      width: '740px',
      maxWidth: '95vw',
      data: {
        divisions: this.divisions(),
        departments: this.departments(),
        defaultMonth: targetMonth,
        prefillLead: curUser ? { displayName: curUser.displayName, email: curUser.email } : undefined
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
            ownerName: result.ownerName || (isSelf ? (u?.displayName || uPrefix || 'Staff Officer') : 'Unassigned Officer'),
            ownerEmail: result.ownerEmail || (isSelf ? (u?.email || '') : (result.ownerName ? `${result.ownerName.toLowerCase().replace(/\s+/g, '.')}@gov.lk` : '')),
            ownerUid: result.ownerUid || (isSelf ? (u?.uid || '') : ''),
            createdBy: result.createdBy || u?.uid || '',
            createdByEmail: result.createdByEmail || u?.email || '',
            createdByName: result.createdByName || u?.displayName || (u?.email ? u.email.split('@')[0] : 'Staff Officer')
          };
          await this.workPlanService.addWorkPlan(planToSave);
          this.eventLogService.logAction('CREATED', 'WorkPlans', `Created work plan "${result.title}"`);
          this.snackBar.open(`Work plan "${result.title}" created successfully!`, 'Dismiss', { duration: 3500 });
          
          const planMonth = result.assignedMonth || (result.startDate ? result.startDate.substring(0, 7) : undefined);
          if (planMonth && this.selectedMonth() !== 'all' && this.selectedMonth() !== planMonth) {
            this.selectedMonth.set(planMonth);
          }

          if (this.selectedDivision() !== 'all' && this.selectedDivision() !== result.division) {
            this.selectedDivision.set('all');
          }

          if (this.canViewAllSummary() && this.viewScope() === 'own') {
            const isSelfOwned = isWorkPlanOwner(planToSave, u?.email, u?.displayName, u?.uid);
            if (!isSelfOwned) {
              this.viewScope.set('all');
            }
          }

          this.loadData();
        } catch (e) {
          console.error('Error saving work plan', e);
          this.snackBar.open('Saved to local storage queue', 'Dismiss', { duration: 3000 });
          this.loadData();
        }
      }
    });
  }
}
