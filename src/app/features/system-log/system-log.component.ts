import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventLogService, EventLog } from '../../core/services/event-log.service';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-system-log',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatOption, MatIconModule, MatProgressSpinnerModule
  ],
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .page-header h1 { font-size: 26px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .page-header p { color: var(--text-muted); margin: 4px 0 0 0; font-size: 13.5px; }
    .filters-card { margin-bottom: 0; padding: 16px !important; }
    .filters-content { display: flex; gap: 16px; flex-wrap: wrap; }
    .filters-content mat-form-field { flex: 1; min-width: 200px; }
    .table-card { padding: 0 !important; overflow: hidden; }
    .table-container { overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch; }
    table { width: 100%; min-width: 600px; }
    .status-badge {
      padding: 3px 10px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; text-transform: uppercase;
      &.created { background: var(--accent-emerald-tint); color: var(--accent-emerald); border: 1px solid var(--accent-emerald-border); }
      &.updated { background: var(--accent-sky-tint); color: var(--accent-sky); border: 1px solid var(--accent-sky-border); }
      &.deleted { background: var(--accent-coral-tint); color: var(--accent-coral); border: 1px solid var(--accent-coral-border); }
      &.login { background: var(--brand-tint); color: var(--brand-accent); border: 1px solid var(--brand-border); }
      &.system { background: #f1f5f9; color: var(--text-muted); border: 1px solid #cbd5e1; }
    }
    .empty-cell { text-align: center; padding: 48px 20px !important; color: var(--text-muted); }
    .empty-cell mat-spinner { margin: 0 auto 16px auto; }

    @media (max-width: 768px) {
      .page-container { gap: 16px; }
      .page-header h1 { font-size: 22px; }
      .filters-content { flex-direction: column; gap: 10px; }
      .filters-content mat-form-field { width: 100%; min-width: unset; }
    }
  `],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>System Logs</h1>
        <p>View and track all user actions across the application.</p>
      </div>

      <mat-card class="filters-card">
        <mat-card-content class="filters-content">
          <mat-form-field appearance="outline">
            <mat-label>Search</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event); onFilterChange()" placeholder="Search by user, action, or module...">
          </mat-form-field>
          
          <mat-form-field appearance="outline">
            <mat-label>Module</mat-label>
            <mat-select [ngModel]="filterModule()" (ngModelChange)="filterModule.set($event); onFilterChange()">
              <mat-option value="">All Modules</mat-option>
              <mat-option value="Customers">Customers</mat-option>
              <mat-option value="Settings">Settings</mat-option>
              <mat-option value="Profile">Profile</mat-option>
              <mat-option value="Auth">Auth</mat-option>
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card">
        <div class="table-container">
          <table mat-table [dataSource]="paginatedLogs()">
            
            <ng-container matColumnDef="timestamp">
              <th mat-header-cell *matHeaderCellDef> Timestamp </th>
              <td mat-cell *matCellDef="let log" class="text-gray-500 text-sm"> {{ log.timestamp | date:'MMM d, y, h:mm:ss a' }} </td>
            </ng-container>

            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef> User </th>
              <td mat-cell *matCellDef="let log" class="font-medium"> {{ log.userName }} </td>
            </ng-container>

            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef> Action </th>
              <td mat-cell *matCellDef="let log"> 
                <span class="status-badge" [ngClass]="log.action.toLowerCase()">{{ log.action }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="module">
              <th mat-header-cell *matHeaderCellDef> Module </th>
              <td mat-cell *matCellDef="let log"> {{ log.module }} </td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef> Description </th>
              <td mat-cell *matCellDef="let log" [title]="log.description" class="truncate max-w-xs"> {{ log.description }} </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" colspan="5" *ngIf="isLoading()">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading logs...</p>
              </td>
              <td class="mat-cell empty-cell" colspan="5" *ngIf="!isLoading()">
                No logs found matching your criteria.
              </td>
            </tr>
          </table>
        </div>
        
        <mat-paginator [length]="filteredLogs().length" [pageSize]="15" [pageSizeOptions]="[10, 15, 50, 100]" (page)="onPageChange($event)"></mat-paginator>
      </mat-card>
    </div>
  `
})
export class SystemLogComponent implements OnInit {
  private eventLogService = inject(EventLogService);

  logs = signal<EventLog[]>([]);
  isLoading = signal<boolean>(true);
  displayedColumns: string[] = ['timestamp', 'user', 'action', 'module', 'description'];

  // Filter and Pagination State
  searchTerm = signal<string>('');
  filterModule = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(15);

  // Computed properties
  filteredLogs = computed(() => {
    let filtered = this.logs();
    
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(l => 
        l.userName.toLowerCase().includes(search) || 
        l.action.toLowerCase().includes(search) ||
        l.description.toLowerCase().includes(search) ||
        l.module.toLowerCase().includes(search)
      );
    }
    
    const module = this.filterModule();
    if (module) {
      filtered = filtered.filter(l => l.module === module);
    }
    
    return filtered;
  });

  paginatedLogs = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredLogs().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.eventLogService.getAllLogs().subscribe({
      next: (data) => {
        this.logs.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching logs', err);
        this.isLoading.set(false);
      }
    });
  }

  onFilterChange() {
    this.currentPage.set(1);
  }

  onPageChange(event: PageEvent) {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }
}
