import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { WorkPlan, WorkPlanService, WorkPlanVerifier, getWorkPlanMonth, isPlanCarriedOver, formatMonthDisplay, isWorkPlanOwner } from './services/work-plan.service';
import { WorkPlanDialogComponent } from './components/work-plan-dialog/work-plan-dialog.component';
import { WorkPlanDetailDialogComponent } from './components/work-plan-detail-dialog/work-plan-detail-dialog.component';
import { SettingsService, Division, Department } from '../settings/settings.service';
import { EventLogService } from '../../core/services/event-log.service';
import { AuthService } from '../../auth/auth.service';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-work-plans',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    RouterModule
  ],
  templateUrl: './work-plans.component.html',
  styleUrl: './work-plans.component.scss'
})
export class WorkPlansComponent implements OnInit {
  private workPlanService = inject(WorkPlanService);
  private settingsService = inject(SettingsService);
  private eventLogService = inject(EventLogService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // Running Month (Current Calendar Month, e.g. '2026-09')
  readonly runningMonth: string = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  // State signals
  workPlans = signal<WorkPlan[]>([]);
  divisions = signal<Division[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal<boolean>(true);

  // View Scope & Permissions
  viewScope = signal<'all' | 'own'>('all');

  canViewAllPlans = computed(() => {
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

  canEditAndAssign = computed(() => {
    if (this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin() || this.rbacService.isDepartmentHead()) {
      return true;
    }
    const settings = this.workPlanService.settings();
    const permittedRoles = settings.rolesPermittedForEditAndAssign || ['Super Admin', 'Divisional Admin', 'Department Head'];
    return this.rbacService.hasPermission('work-plans:edit_plan') || this.rbacService.hasAnyRole(permittedRoles);
  });

  canCreatePlan = computed(() => {
    return this.rbacService.hasPermission('work-plans:create_plan');
  });

  canDeletePlan = computed(() => {
    return this.rbacService.hasPermission('work-plans:delete_plan');
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

  effectiveViewScope = computed(() => {
    if (!this.canViewAllPlans()) {
      return 'own';
    }
    return this.viewScope();
  });

  currentUser = computed(() => this.authService.currentUser());

  // Selected Month (defaults to the running month)
  selectedMonth = signal<string>(this.runningMonth);

  // View mode: 'kanban' or 'table'
  viewMode = signal<'kanban' | 'table'>('kanban');

  // Filters
  searchQuery = signal<string>('');
  filterDivision = signal<string>('all');
  filterDepartment = signal<string>('all');
  filterStatus = signal<string>('all');
  filterCategory = signal<string>('all');
  onlyRollover = signal<boolean>(false);

  // Pagination for table view
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  displayedColumns: string[] = ['title', 'month', 'division', 'lead', 'priority', 'progress', 'targetDate', 'status', 'actions'];

  // Available Months for Selector
  availableMonths = computed(() => {
    const set = new Set<string>();
    set.add(this.runningMonth);

    for (const p of this.workPlans()) {
      set.add(getWorkPlanMonth(p));
    }

    const [currY, currM] = this.runningMonth.split('-').map(Number);
    for (let offset = -2; offset <= 3; offset++) {
      const d = new Date(currY, currM - 1 + offset, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(mStr);
    }

    return Array.from(set).sort();
  });

  // Base Monthly Plans (handles previous incomplete jobs rollover to running month + own vs all scope)
  monthlyPlans = computed(() => {
    const sel = this.selectedMonth();
    let all = this.workPlans();

    // If personal view scope is active, filter strictly by current user's own assigned tasks
    if (this.effectiveViewScope() === 'own') {
      const u = this.currentUser();
      if (u) {
        all = all.filter(p => isWorkPlanOwner(p, u.email, u.displayName, u.uid));
      } else {
        all = [];
      }
    }

    if (sel === 'all') {
      return all;
    }

    if (sel === this.runningMonth) {
      // Running month: includes jobs originating this month PLUS previous incomplete jobs!
      return all.filter(p => {
        const pMonth = getWorkPlanMonth(p);
        if (pMonth === sel) return true;
        // Previous incomplete job rollover:
        if (pMonth < sel && p.status !== 'Completed') return true;
        return false;
      });
    } else {
      // Historical or future month:
      return all.filter(p => getWorkPlanMonth(p) === sel);
    }
  });

  // Monthly Metrics
  monthTotalCount = computed(() => this.monthlyPlans().length);

  monthRolloverCount = computed(() => 
    this.monthlyPlans().filter(p => this.isCarriedOver(p)).length
  );

  monthActiveCount = computed(() => 
    this.monthlyPlans().filter(p => p.status === 'In Progress').length
  );

  monthCompletedCount = computed(() => 
    this.monthlyPlans().filter(p => p.status === 'Completed').length
  );

  monthTotalBudget = computed(() => 
    this.monthlyPlans().reduce((sum, p) => sum + (p.budget || 0), 0)
  );

  monthAvgProgress = computed(() => {
    const active = this.monthlyPlans().filter(p => p.status !== 'Completed' && p.status !== 'Draft');
    if (active.length === 0) return 0;
    const sum = active.reduce((acc, p) => acc + p.progress, 0);
    return Math.round(sum / active.length);
  });

  // Filtered Plans based on search, division, status, category, and rollover toggle
  filteredPlans = computed(() => {
    let list = this.monthlyPlans();

    if (this.onlyRollover()) {
      list = list.filter(p => this.isCarriedOver(p));
    }

    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(p => 
        p.title.toLowerCase().includes(q) ||
        p.leadName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    const div = this.filterDivision();
    if (div !== 'all') {
      list = list.filter(p => p.division === div);
    }

    const dept = this.filterDepartment();
    if (dept !== 'all') {
      list = list.filter(p => p.department === dept);
    }

    const stat = this.filterStatus();
    if (stat !== 'all') {
      list = list.filter(p => p.status === stat);
    }

    const cat = this.filterCategory();
    if (cat !== 'all') {
      list = list.filter(p => p.category === cat);
    }

    return list;
  });

  // Filtered Kanban Columns
  kanbanDraft = computed(() => this.filteredPlans().filter(p => p.status === 'Draft'));
  kanbanInProgress = computed(() => this.filteredPlans().filter(p => p.status === 'In Progress' || p.status === 'Delayed'));
  kanbanUnderReview = computed(() => this.filteredPlans().filter(p => p.status === 'Under Review'));
  kanbanCompleted = computed(() => this.filteredPlans().filter(p => p.status === 'Completed'));

  // Paginated for Table View
  paginatedPlans = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPlans().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.loadWorkPlans();
    this.loadDivisions();
    this.loadDepartments();
  }

  loadWorkPlans() {
    this.isLoading.set(true);
    this.workPlanService.getWorkPlans().subscribe({
      next: (data) => {
        this.workPlans.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching work plans', err);
        this.workPlans.set([]);
        this.isLoading.set(false);
      }
    });
  }

  loadDivisions() {
    this.settingsService.getDivisions().subscribe({
      next: (data) => this.divisions.set(data || []),
      error: (err) => console.error('Error loading divisions', err)
    });
  }

  loadDepartments() {
    this.settingsService.getDepartments().subscribe({
      next: (data) => this.departments.set(data || []),
      error: (err) => console.error('Error loading departments', err)
    });
  }

  onPageChange(event: PageEvent) {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  changeMonth(delta: number) {
    const curr = this.selectedMonth() === 'all' ? this.runningMonth : this.selectedMonth();
    const [y, m] = curr.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.selectedMonth.set(nextStr);
  }

  goToRunningMonth() {
    this.selectedMonth.set(this.runningMonth);
    this.onlyRollover.set(false);
  }

  isCarriedOver(plan: WorkPlan): boolean {
    return isPlanCarriedOver(plan, this.runningMonth);
  }

  getPlanMonthLabel(plan: WorkPlan): string {
    return formatMonthDisplay(getWorkPlanMonth(plan));
  }

  formatMonth(mStr: string): string {
    if (mStr === 'all') return 'All Directives';
    return formatMonthDisplay(mStr);
  }

  getPlanVerifiers(plan: WorkPlan): WorkPlanVerifier[] {
    return this.workPlanService.getPlanVerifiers(plan);
  }

  getCompletedVerifiersCount(plan: WorkPlan): number {
    return this.workPlanService.getCompletedVerifiersCount(plan);
  }

  areAllVerifiersApproved(plan: WorkPlan): boolean {
    return this.workPlanService.areAllVerifiersApproved(plan);
  }

  openCreateDialog() {
    if (!this.canCreatePlan()) {
      this.showFeedback('You do not have permission to author new work plans.');
      return;
    }

    const targetMonth = this.selectedMonth() === 'all' ? this.runningMonth : this.selectedMonth();
    const curUser = this.currentUser();
    const ref = this.dialog.open(WorkPlanDialogComponent, {
      width: '680px',
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
          this.showFeedback('Cannot publish work plan: at least one milestone deliverable is required.');
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
          this.showFeedback('Work plan created successfully');

          // 1. Ensure month alignment so user immediately sees their newly created directive
          const planMonth = result.assignedMonth || (result.startDate ? result.startDate.substring(0, 7) : this.runningMonth);
          if (this.selectedMonth() !== 'all' && this.selectedMonth() !== planMonth) {
            this.selectedMonth.set(planMonth);
          }

          // 2. Reset active filters so the new directive is guaranteed visible
          this.filterStatus.set('all');
          this.onlyRollover.set(false);
          this.searchQuery.set('');
          if (this.filterDivision() !== 'all' && this.filterDivision() !== result.division) {
            this.filterDivision.set('all');
          }
          if (this.filterDepartment() !== 'all' && this.filterDepartment() !== result.department) {
            this.filterDepartment.set('all');
          }
          if (this.filterCategory() !== 'all' && this.filterCategory() !== result.category) {
            this.filterCategory.set('all');
          }

          // 3. If in personal view but task was assigned to someone else, switch to 'all' so creator sees it
          if (this.canViewAllPlans() && this.viewScope() === 'own') {
            const isSelfOwned = isWorkPlanOwner(planToSave, u?.email, u?.displayName, u?.uid);
            if (!isSelfOwned) {
              this.viewScope.set('all');
            }
          }
        } catch (e) {
          console.error(e);
          this.showFeedback('Offline protection: Plan saved to local queue');
        }
      }
    });
  }

  openEditDialog(plan: WorkPlan) {
    if (!this.canEditAndAssign()) {
      this.showFeedback('Editing directive specifications and reassigning officers is restricted to authorized roles (configured in Settings)');
      return;
    }

    const ref = this.dialog.open(WorkPlanDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { plan, divisions: this.divisions(), canEditAndAssign: true }
    });

    ref.afterClosed().subscribe(async (result) => {
      if (result && plan.id) {
        try {
          await this.workPlanService.updateWorkPlan(plan.id, result);
          this.eventLogService.logAction('UPDATED', 'WorkPlans', `Updated work plan "${result.title}"`);
          this.showFeedback('Work plan updated successfully');
        } catch (e) {
          console.error(e);
          this.showFeedback('Offline protection: Changes saved to local queue');
        }
      }
    });
  }

  openDetailDialog(plan: WorkPlan) {
    const ref = this.dialog.open(WorkPlanDetailDialogComponent, {
      width: '740px',
      maxWidth: '95vw',
      data: { plan }
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.action === 'edit') {
        if (this.canEditAndAssign()) {
          this.openEditDialog(res.plan);
        } else {
          this.showFeedback('Editing directives and reassigning officers is restricted to authorized roles');
        }
      }
    });
  }

  async updateStatusQuick(plan: WorkPlan, newStatus: WorkPlan['status'], event?: Event) {
    if (event) event.stopPropagation();
    if (!plan.id) return;

    // State transition access permission check
    const u = this.currentUser();
    const isOwner = u && isWorkPlanOwner(plan, u.email, u.displayName, u.uid);
    const canManage = this.canEditAndAssign() || this.canAccessVerification();
    if (!isOwner && !canManage) {
      this.showFeedback('Access Denied: You do not have permission to transition this directive state.');
      return;
    }

    if (newStatus === 'Completed') {
      if (!this.canAccessVerification()) {
        this.showFeedback('Milestone sign-off and completion approval is restricted to authorized audit roles.');
        return;
      }
      const settings = this.workPlanService.settings();
      if (settings.requireAllMilestones && plan.milestones && plan.milestones.length > 0) {
        const allDone = plan.milestones.every(m => m.completed);
        if (!allDone) {
          this.showFeedback('Cannot mark Completed: all deliverable milestones must be completed first.');
          return;
        }
      }
      if (!this.areAllVerifiersApproved(plan)) {
        const total = this.getPlanVerifiers(plan).length;
        const done = this.getCompletedVerifiersCount(plan);
        this.showFeedback(`Cannot mark Completed: All verification stages must be signed off first (${done}/${total} approved). Use Verification Hub or Directive Details.`);
        return;
      }
    }

    try {
      const progress = newStatus === 'Completed' ? 100 : (newStatus === 'Draft' ? 0 : plan.progress);
      const updatedMilestones = newStatus === 'Completed' && plan.milestones && plan.milestones.length > 0
        ? plan.milestones.map(m => ({ ...m, completed: true }))
        : plan.milestones;

      await this.workPlanService.updateWorkPlan(plan.id, { 
        status: newStatus, 
        progress,
        ...(updatedMilestones ? { milestones: updatedMilestones } : {})
      });
      this.eventLogService.logAction('UPDATED', 'WorkPlans', `Moved "${plan.title}" to ${newStatus}`);
      this.showFeedback(`Status updated to ${newStatus}`);
    } catch (e) {
      console.error(e);
      this.showFeedback('Offline protection: Status saved locally');
    }
  }

  async resetPlanApprovals(plan: WorkPlan) {
    if (!plan.id) return;
    if (!this.canAccessVerification()) {
      this.showFeedback('Verification reset is restricted to authorized audit roles.');
      return;
    }
    if (!confirm(`Are you sure you want to reset all verification approvals for "${plan.title}"? This will return the directive to pending verification.`)) {
      return;
    }
    try {
      const resetVerifs = this.workPlanService.resetPlanVerifiers(plan);
      const newStatus = plan.status === 'Completed' ? 'Under Review' : plan.status;
      await this.workPlanService.updateWorkPlan(plan.id, {
        status: newStatus,
        verifiers: resetVerifs,
        revisionNotes: 'Verification approvals reset',
        rollbackAt: new Date().toISOString(),
        ...(plan.progress === 100 ? { progress: 95 } : {})
      });
      this.eventLogService.logAction('UPDATED', 'WorkPlans', `Reset verification approvals for "${plan.title}"`);
      this.showFeedback('Verification approvals reset successfully.');
    } catch {
      this.showFeedback('Offline protection: Reset saved locally');
    }
  }

  async deletePlan(plan: WorkPlan, event?: Event) {
    if (event) event.stopPropagation();
    if (!plan.id) return;

    if (!this.canDeletePlan()) {
      this.showFeedback('You do not have permission to delete work plans.');
      return;
    }

    if (confirm(`Are you sure you want to permanently delete the work plan "${plan.title}"?`)) {
      try {
        await this.workPlanService.deleteWorkPlan(plan.id);
        this.eventLogService.logAction('DELETED', 'WorkPlans', `Deleted work plan "${plan.title}"`);
        this.showFeedback('Work plan deleted');
      } catch (e) {
        console.error(e);
        this.showFeedback('Offline protection: Deletion staged');
      }
    }
  }

  private showFeedback(message: string) {
    const isOffline = !navigator.onLine;
    const text = isOffline ? 'Disconnected but data is protected. ' + message : message;
    this.snackBar.open(text, 'Dismiss', { duration: 4000 });
  }
}
