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
import { AuthService } from '../../auth/auth.service';
import { EventLogService, EventLog } from '../../core/services/event-log.service';
import { WorkPlanService, WorkPlan } from '../work-plans/services/work-plan.service';
import { CustomerService, Customer } from '../customers/services/customer.service';

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
    MatTooltipModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private eventLogService = inject(EventLogService);
  private workPlanService = inject(WorkPlanService);
  private customerService = inject(CustomerService);

  recentActivity = signal<EventLog[]>([]);
  workPlans = signal<WorkPlan[]>([]);
  customers = signal<Customer[]>([]);

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
}
