import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../auth/auth.service';
import { RbacService } from '../../auth/rbac.service';
import { EventLogService, EventLog } from '../../core/services/event-log.service';
import { WorkPlanService, WorkPlan } from '../work-plans/services/work-plan.service';
import { CustomerService, Customer } from '../customers/services/customer.service';
import { LetterService } from '../letters/services/letter.service';
import { Letter } from '../letters/models/letter.model';

export interface ProjectItem {
  id: string;
  name: string;
  category: string;
  owner: string;
  ownerAvatar?: string;
  status: 'In Progress' | 'Completed' | 'On Hold' | 'Review';
  progress: number;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private eventLogService = inject(EventLogService);
  private workPlanService = inject(WorkPlanService);
  private customerService = inject(CustomerService);
  private letterService = inject(LetterService);

  recentActivity = signal<EventLog[]>([]);
  workPlans = signal<WorkPlan[]>([]);
  customers = signal<Customer[]>([]);
  allLetters = signal<Letter[]>([]);

  displayedColumns: string[] = ['name', 'category', 'owner', 'status', 'progress', 'dueDate', 'actions'];

  searchQuery = signal<string>('');
  selectedFilter = signal<string>('All');

  // KPI Computations from real database
  totalAllocatedFunds = computed(() =>
    this.workPlans().reduce((acc, p) => acc + (p.budget || 0), 0)
  );
  totalClientsCount = computed(() => this.customers().length);
  pendingActionCount = computed(() =>
    this.workPlans().filter(p => p.status !== 'Completed').length
  );

  allProjects = computed<ProjectItem[]>(() => {
    return this.workPlans().map(p => {
      let uiStatus: 'In Progress' | 'Completed' | 'On Hold' | 'Review' = 'In Progress';
      if (p.status === 'Completed') uiStatus = 'Completed';
      else if (p.status === 'Under Review') uiStatus = 'Review';
      else if (p.status === 'Draft' || p.status === 'Delayed') uiStatus = 'On Hold';

      let uiPriority: 'High' | 'Medium' | 'Low' = 'Medium';
      if (p.priority === 'Urgent' || p.priority === 'High') uiPriority = 'High';
      else if (p.priority === 'Low') uiPriority = 'Low';

      return {
        id: p.id ? p.id.substring(0, 8).toUpperCase() : 'DIR',
        name: p.title,
        category: p.category || p.division || 'Operations',
        owner: p.leadName || p.createdByName || 'Assignee',
        status: uiStatus,
        progress: p.progress || 0,
        dueDate: p.targetDate || '',
        priority: uiPriority
      };
    });
  });

  filteredProjects = computed(() => {
    let list = this.allProjects();
    const filter = this.selectedFilter();
    if (filter !== 'All') {
      list = list.filter(p => p.status === filter);
    }
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.owner.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }
    return list;
  });

  // User Letter Notifications
  userDepartment = computed(() => this.rbacService.userDepartment() || '');

  userLetters = computed(() => {
    const user = this.authService.currentUser();
    const dept = this.userDepartment();
    return this.letterService.filterLettersForUser(this.allLetters(), user, dept);
  });

  userPendingLetters = computed(() => {
    return this.userLetters().filter(l => 
      l.status !== 'Completed' && l.status !== 'Archived' && l.status !== 'Dispatched'
    );
  });

  userPendingLettersCount = computed(() => this.userPendingLetters().length);

  userUrgentLettersCount = computed(() => {
    return this.userPendingLetters().filter(l => l.priority === 'Urgent' || l.priority === 'Immediate').length;
  });

  userRecentLetters = computed(() => {
    return this.userPendingLetters().slice(0, 4);
  });

  ngOnInit() {
    this.eventLogService.getAllLogs().subscribe({
      next: (logs) => {
        this.recentActivity.set((logs || []).slice(0, 6));
      },
      error: () => this.recentActivity.set([])
    });

    this.workPlanService.getWorkPlans().subscribe({
      next: (plans) => this.workPlans.set(plans || []),
      error: () => this.workPlans.set([])
    });

    this.customerService.getCustomers().subscribe({
      next: (custs) => this.customers.set(custs || []),
      error: () => this.customers.set([])
    });

    this.letterService.getLetters().subscribe({
      next: (letters) => this.allLetters.set(letters || []),
      error: () => this.allLetters.set([])
    });
  }

  getFirstName(): string {
    const user = this.authService.currentUser();
    if (!user || !user.displayName) return 'Administrator';
    return user.displayName.split(' ')[0];
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  setFilter(status: string) {
    this.selectedFilter.set(status);
  }

  isDirectlyAssigned(letter: Letter): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    const uid = user.uid?.toLowerCase().trim();
    const email = user.email?.toLowerCase().trim();
    const name = user.displayName?.toLowerCase().trim();

    if (letter.assigned_to && letter.assigned_to.length > 0) {
      const match = letter.assigned_to.some(a => {
        const val = a.toLowerCase().trim();
        return (uid && val === uid) || (email && val === email) || (name && val === name);
      });
      if (match) return true;
    }

    if (letter.assigned_user_names && letter.assigned_user_names.length > 0 && name) {
      if (letter.assigned_user_names.some(uName => uName.toLowerCase().trim() === name)) {
        return true;
      }
    }

    return false;
  }

  getPriorityBadgeClass(priority: string | undefined): string {
    const p = (priority || '').toLowerCase();
    if (p === 'immediate' || p === 'urgent') return 'priority-urgent';
    if (p === 'normal' || p === 'medium') return 'priority-normal';
    return 'priority-low';
  }

  getStatusBadgeClass(status: string | undefined): string {
    const s = (status || '').toLowerCase();
    if (s.includes('action') || s.includes('urgent')) return 'status-action';
    if (s.includes('review') || s.includes('progress')) return 'status-progress';
    if (s.includes('received')) return 'status-received';
    if (s.includes('complete') || s.includes('closed')) return 'status-completed';
    return 'status-default';
  }
}
