import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';

import { LetterService } from '../../services/letter.service';
import { Letter, LetterStatus } from '../../models/letter.model';
import { LetterStatusDialogComponent } from '../../components/letter-status-dialog/letter-status-dialog.component';
import { LetterDetailDialogComponent } from '../../components/letter-detail-dialog/letter-detail-dialog.component';
import { LetterDialogComponent } from '../../components/letter-dialog/letter-dialog.component';
import { AuthService } from '../../../../auth/auth.service';
import { RbacService } from '../../../../auth/rbac.service';
import { SettingsService, Department } from '../../../settings/settings.service';

export type ActionSegment = 'ALL_OPEN' | 'MINE' | 'DEPT' | 'URGENT' | 'ACTION_REQ' | 'IN_PROGRESS';
export type ViewMode = 'grid' | 'kanban' | 'table';
export type DateFilter = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK';
export type DensityMode = 'comfortable' | 'compact';

@Component({
  selector: 'app-letter-actions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatBadgeModule
  ],
  templateUrl: './letter-actions.component.html',
  styleUrl: './letter-actions.component.scss'
})
/**
 * Directives & Pending Actions Management Component
 */
export class LetterActionsComponent implements OnInit {
  private letterService = inject(LetterService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);
  private settingsService = inject(SettingsService);
  private dialog = inject(MatDialog);

  allLetters = signal<Letter[]>([]);
  departments = signal<Department[]>([]);
  activeSegment = signal<ActionSegment>('ALL_OPEN');
  viewMode = signal<ViewMode>('grid');
  dateFilter = signal<DateFilter>('ALL');
  densityMode = signal<DensityMode>('compact');

  // Pagination for high volume (40+ letters/day)
  pageSize = signal<number>(40);
  pageIndex = signal<number>(0);
  pageSizeOptions = [20, 40, 50, 100, 200];

  searchQuery = signal<string>('');
  selectedDepartment = signal<string>('ALL');
  selectedPriority = signal<string>('ALL');

  currentUser = computed(() => this.authService.currentUser());
  userDept = computed(() => this.rbacService.userDepartment() || '');

  tableDisplayedColumns: string[] = [
    'ref_number',
    'priority',
    'title',
    'received_from',
    'received_date',
    'send_to',
    'assigned_to',
    'status',
    'actions'
  ];

  // Base list of actionable letters (open status)
  allOpenActions = computed(() => {
    return this.allLetters().filter(l => 
      l.status === 'Received' || 
      l.status === 'In Review' || 
      l.status === 'Action Required' || 
      l.status === 'In Progress'
    );
  });

  // KPI Computations
  myActions = computed(() => {
    const u = this.currentUser();
    if (!u) return [];
    const uid = u.uid?.toLowerCase().trim();
    const email = u.email?.toLowerCase().trim();
    const name = u.displayName?.toLowerCase().trim();

    return this.allOpenActions().filter(l => {
      if (l.assigned_to && l.assigned_to.length > 0) {
        const match = l.assigned_to.some(a => {
          const v = a.toLowerCase().trim();
          return (uid && v === uid) || (email && v === email) || (name && v === name);
        });
        if (match) return true;
      }
      if (l.assigned_user_names && l.assigned_user_names.length > 0 && name) {
        if (l.assigned_user_names.some(uName => uName.toLowerCase().trim() === name)) return true;
      }
      return false;
    });
  });

  deptActions = computed(() => {
    const dept = this.userDept().toLowerCase().trim();
    if (!dept) return [];
    return this.allOpenActions().filter(l => {
      if (!l.send_to || !l.send_to.length) return false;
      return l.send_to.some(d => {
        const target = d.toLowerCase().trim();
        return target === dept || target.includes(dept) || dept.includes(target);
      });
    });
  });

  urgentActions = computed(() => {
    return this.allOpenActions().filter(l => l.priority === 'Urgent' || l.priority === 'Immediate');
  });

  actionRequiredActions = computed(() => {
    return this.allOpenActions().filter(l => l.status === 'Action Required');
  });

  inProgressActions = computed(() => {
    return this.allOpenActions().filter(l => l.status === 'In Progress' || l.status === 'In Review');
  });

  // Date String Helpers for High-Volume (40+/day) Processing
  todayStr = computed(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  yesterdayStr = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  weekStartStr = computed(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    const y = mon.getFullYear();
    const m = String(mon.getMonth() + 1).padStart(2, '0');
    const dd = String(mon.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });

  // Volume Counts by Date
  todayActionsCount = computed(() => {
    const today = this.todayStr();
    return this.allOpenActions().filter(l => l.received_date === today).length;
  });

  yesterdayActionsCount = computed(() => {
    const yest = this.yesterdayStr();
    return this.allOpenActions().filter(l => l.received_date === yest).length;
  });

  thisWeekActionsCount = computed(() => {
    const start = this.weekStartStr();
    return this.allOpenActions().filter(l => (l.received_date || '') >= start).length;
  });

  // Final Filtered List based on Segment, Date, Search & Dropdowns
  filteredLetters = computed(() => {
    let list = this.allOpenActions();

    // 1. Segment Filter
    const seg = this.activeSegment();
    if (seg === 'MINE') list = this.myActions();
    else if (seg === 'DEPT') list = this.deptActions();
    else if (seg === 'URGENT') list = this.urgentActions();
    else if (seg === 'ACTION_REQ') list = this.actionRequiredActions();
    else if (seg === 'IN_PROGRESS') list = this.inProgressActions();

    // 2. Department Dropdown Filter
    const dFilter = this.selectedDepartment();
    if (dFilter !== 'ALL') {
      const df = dFilter.toLowerCase().trim();
      list = list.filter(l => l.send_to?.some(d => d.toLowerCase().trim().includes(df)));
    }

    // 3. Priority Dropdown Filter
    const pFilter = this.selectedPriority();
    if (pFilter !== 'ALL') {
      list = list.filter(l => l.priority === pFilter);
    }

    // 4. Date Presets (Today, Yesterday, This Week)
    const df = this.dateFilter();
    if (df === 'TODAY') {
      const today = this.todayStr();
      list = list.filter(l => l.received_date === today);
    } else if (df === 'YESTERDAY') {
      const yest = this.yesterdayStr();
      list = list.filter(l => l.received_date === yest);
    } else if (df === 'WEEK') {
      const start = this.weekStartStr();
      list = list.filter(l => (l.received_date || '') >= start);
    }

    // 5. Full-text Search
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(l => 
        l.ref_number.toLowerCase().includes(q) ||
        (l.title && l.title.toLowerCase().includes(q)) ||
        (l.received_from && l.received_from.toLowerCase().includes(q)) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.link_ref && l.link_ref.toLowerCase().includes(q)) ||
        l.send_to?.some(d => d.toLowerCase().includes(q)) ||
        l.assigned_user_names?.some(u => u.toLowerCase().includes(q))
      );
    }

    // Sort: Newest received first, with Urgent/Immediate highlighted
    list = [...list].sort((a, b) => {
      const dateCmp = (b.received_date || '').localeCompare(a.received_date || '');
      if (dateCmp !== 0) return dateCmp;
      const pWeights: Record<string, number> = { 'Immediate': 3, 'Urgent': 2, 'Normal': 1 };
      return (pWeights[b.priority] || 0) - (pWeights[a.priority] || 0);
    });

    return list;
  });

  // Paginated View Slice for Grid and Dense Table
  paginatedLetters = computed(() => {
    const list = this.filteredLetters();
    const start = this.pageIndex() * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  // Kanban Stage Columns
  readonly kanbanColumns: { status: LetterStatus; label: string; icon: string; colorClass: string; desc: string }[] = [
    { status: 'Received', label: 'Received & Logged', icon: 'mark_email_unread', colorClass: 'col-received', desc: 'Newly registered inward letters' },
    { status: 'In Review', label: 'Under Review', icon: 'rate_review', colorClass: 'col-review', desc: 'Assessment and routing' },
    { status: 'Action Required', label: 'Action Required', icon: 'assignment_late', colorClass: 'col-action', desc: 'Directives requiring decisions' },
    { status: 'In Progress', label: 'In Progress', icon: 'pending', colorClass: 'col-progress', desc: 'Active execution & reply drafting' }
  ];

  ngOnInit() {
    this.loadData();

    this.settingsService.getDepartments().subscribe(depts => {
      this.departments.set(depts || []);
    });
  }

  loadData() {
    this.letterService.getLetters().subscribe(letters => {
      this.allLetters.set(letters || []);
    });
  }

  setSegment(seg: ActionSegment) {
    this.activeSegment.set(seg);
  }

  setViewMode(mode: ViewMode) {
    this.viewMode.set(mode);
  }

  getLettersForColumn(status: LetterStatus): Letter[] {
    return this.filteredLetters().filter(l => l.status === status);
  }

  getStatusClass(status: string): string {
    return (status || '').toLowerCase().replace(/\s+/g, '-');
  }

  getPriorityClass(priority: string): string {
    const p = (priority || '').toLowerCase();
    if (p === 'immediate' || p === 'urgent') return 'priority-urgent';
    if (p === 'normal' || p === 'medium') return 'priority-normal';
    return 'priority-low';
  }

  getLastLog(letter: Letter) {
    if (!letter.action_logs?.length) return null;
    return letter.action_logs[letter.action_logs.length - 1];
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  isDirectlyAssigned(letter: Letter): boolean {
    const user = this.currentUser();
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

  getTimeAgo(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const now = new Date();
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(d.getTime())) return dateStr;
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return `${Math.floor(diffDays / 30)}mo ago`;
    } catch {
      return dateStr;
    }
  }

  // Quick 1-click status advancement in Kanban view
  async advanceStage(letter: Letter, nextStatus: LetterStatus) {
    const user = this.currentUser();
    const officerName = user?.displayName || user?.email || 'Officer';
    const remarks = `Workflow stage advanced to "${nextStatus}" via Directives Board by ${officerName}.`;
    await this.letterService.updateLetterStatus(letter, nextStatus, remarks);
  }

  openRegisterDialog() {
    this.dialog.open(LetterDialogComponent, {
      width: '840px',
      height: '92vh',
      maxWidth: '96vw',
      maxHeight: '94vh',
      panelClass: 'letter-dialog-overlay',
      autoFocus: false,
      data: {}
    }).afterClosed().subscribe(res => {
      if (res) this.loadData();
    });
  }

  openDetail(letter: Letter) {
    this.dialog.open(LetterDetailDialogComponent, {
      width: letter.attachments?.length ? '1440px' : '780px',
      height: '92vh',
      maxWidth: '96vw',
      maxHeight: '94vh',
      panelClass: 'letter-detail-dialog-overlay',
      data: { letter }
    }).afterClosed().subscribe(() => {
      this.loadData();
    });
  }

  openUpdateStatus(letter: Letter) {
    this.dialog.open(LetterStatusDialogComponent, {
      width: '520px',
      panelClass: 'letter-dialog-overlay',
      data: { letter }
    }).afterClosed().subscribe(res => {
      if (res) this.loadData();
    });
  }

  setDateFilter(f: DateFilter) {
    this.dateFilter.set(f);
    this.pageIndex.set(0);
  }

  setDensityMode(d: DensityMode) {
    this.densityMode.set(d);
  }

  onPageChange(event: PageEvent) {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedDepartment.set('ALL');
    this.selectedPriority.set('ALL');
    this.activeSegment.set('ALL_OPEN');
    this.dateFilter.set('ALL');
    this.pageIndex.set(0);
  }
}
