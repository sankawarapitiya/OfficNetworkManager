import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { LetterService } from '../../services/letter.service';
import { Letter, LetterStatus, ALL_LETTER_STATUSES, DEFAULT_LETTER_SETTINGS } from '../../models/letter.model';
import { LetterDialogComponent } from '../../components/letter-dialog/letter-dialog.component';
import { LetterStatusDialogComponent } from '../../components/letter-status-dialog/letter-status-dialog.component';
import { LetterDetailDialogComponent } from '../../components/letter-detail-dialog/letter-detail-dialog.component';
import { SettingsService, Department } from '../../../settings/settings.service';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { AppUser } from '../../../profile/profile.component';

@Component({
  selector: 'app-letter-inbox',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="page-container max-w-7xl mx-auto p-4 md:p-6">
      <!-- Header -->
      <div class="page-header">
        <div class="header-titles">
          <div class="title-row">
            <mat-icon class="title-icon">inbox</mat-icon>
            <h1 class="page-title">Inward Letters Registry (Inbox)</h1>
          </div>
          <p class="page-desc">Official incoming correspondence, ministerial directives, and citizen submissions.</p>
        </div>
        <div class="actions-group">
          <button mat-flat-button color="primary" (click)="openAddDialog()" class="add-btn">
            <mat-icon>add</mat-icon> Register Inward Letter
          </button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <mat-card class="filter-card">
        <!-- PRIMARY SEARCH & QUICK FILTERS ROW -->
        <div class="filters-row">
          <!-- Text Search input with Clear Icon -->
          <mat-form-field appearance="outline" class="search-field compact-field" subscriptSizing="dynamic">
            <mat-label>Search Reference, Title, Sender, Link Ref, Officer...</mat-label>
            <mat-icon matPrefix class="search-prefix">search</mat-icon>
            <input matInput 
                   [ngModel]="searchKeyword()" 
                   (ngModelChange)="onSearchChange($event)"
                   placeholder="e.g. LET/2026, Ministry, Land Tax, John">
            <button *ngIf="searchKeyword()" 
                    mat-icon-button 
                    matSuffix 
                    (click)="clearSearch()" 
                    matTooltip="Clear Search" 
                    type="button" 
                    class="clear-btn">
              <mat-icon>close</mat-icon>
            </button>
          </mat-form-field>

          <!-- Status Filter -->
          <mat-form-field appearance="outline" class="filter-field compact-field" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); onFilterChange()">
              <mat-option value="ALL">All Statuses</mat-option>
              <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Department Filter -->
          <mat-form-field appearance="outline" class="filter-field compact-field" subscriptSizing="dynamic">
            <mat-label>Department</mat-label>
            <mat-select [ngModel]="departmentFilter()" (ngModelChange)="departmentFilter.set($event); onFilterChange()">
              <mat-option value="ALL">All Departments</mat-option>
              <mat-option *ngFor="let d of departments()" [value]="d.name">{{ d.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Priority Filter -->
          <mat-form-field appearance="outline" class="filter-field compact-field" subscriptSizing="dynamic">
            <mat-label>Priority</mat-label>
            <mat-select [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event); onFilterChange()">
              <mat-option value="ALL">All Priorities</mat-option>
              <mat-option value="Normal">Normal</mat-option>
              <mat-option value="Urgent">Urgent</mat-option>
              <mat-option value="Immediate">Immediate</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Advanced Filters Toggle Button -->
          <button mat-stroked-button 
                  type="button"
                  (click)="toggleAdvancedFilters()" 
                  class="adv-toggle-btn"
                  [class.active]="showAdvancedFilters()">
            <mat-icon>{{ showAdvancedFilters() ? 'filter_list_off' : 'tune' }}</mat-icon>
            <span>Filters</span>
            <span *ngIf="activeFilterCount() > 0" class="active-count-badge">{{ activeFilterCount() }}</span>
          </button>

          <!-- Reset Filter Button -->
          <button mat-icon-button (click)="resetFilters()" matTooltip="Reset All Filters" type="button" class="reset-btn sm-btn">
            <mat-icon>restart_alt</mat-icon>
          </button>
        </div>

        <!-- COLLAPSIBLE ADVANCED FILTERS PANEL -->
        <div *ngIf="showAdvancedFilters()" class="advanced-filters-panel">
          <div class="adv-grid">
            <!-- Received Date Range: Date From -->
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Date From</mat-label>
              <input matInput [matDatepicker]="fromPicker" [ngModel]="dateFromObj()" (ngModelChange)="onDateFromChange($event)" (click)="fromPicker.open()" placeholder="Select date">
              <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
              <mat-datepicker #fromPicker></mat-datepicker>
            </mat-form-field>

            <!-- Received Date Range: Date To -->
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Date To</mat-label>
              <input matInput [matDatepicker]="toPicker" [ngModel]="dateToObj()" (ngModelChange)="onDateToChange($event)" (click)="toPicker.open()" placeholder="Select date">
              <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
              <mat-datepicker #toPicker></mat-datepicker>
            </mat-form-field>

            <!-- Category Filter -->
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Category</mat-label>
              <mat-select [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event); onFilterChange()">
                <mat-option value="ALL">All Categories</mat-option>
                <mat-option *ngFor="let c of categories()" [value]="c">{{ c }}</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Assigned Officer Filter -->
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Assigned Officer</mat-label>
              <mat-select [ngModel]="officerFilter()" (ngModelChange)="officerFilter.set($event); onFilterChange()">
                <mat-option value="ALL">All Officers</mat-option>
                <mat-option *ngFor="let u of systemUsers()" [value]="u.displayName || u.email">
                  {{ u.displayName || u.email }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Document Attachments Filter -->
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Document Attachments</mat-label>
              <mat-select [ngModel]="attachmentFilter()" (ngModelChange)="attachmentFilter.set($event); onFilterChange()">
                <mat-option value="ALL">All Letters</mat-option>
                <mat-option value="WITH">With Attachments Only</mat-option>
                <mat-option value="WITHOUT">Without Attachments</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Storage Location Filter -->
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Storage Destination</mat-label>
              <mat-select [ngModel]="storageFilter()" (ngModelChange)="storageFilter.set($event); onFilterChange()">
                <mat-option value="ALL">All Storage Locations</mat-option>
                <mat-option value="firebase">Firebase Cloud Storage</mat-option>
                <mat-option value="network">Network Share Location</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Sort By -->
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Sort By</mat-label>
              <mat-select [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event); onFilterChange()">
                <mat-option value="date_desc">Newest Received First</mat-option>
                <mat-option value="date_asc">Oldest Received First</mat-option>
                <mat-option value="priority">Priority (Immediate First)</mat-option>
                <mat-option value="ref_asc">Reference Number (A-Z)</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Date Quick Preset Chips -->
          <div class="date-chips-row">
            <span class="chips-label">Date Presets:</span>
            <button type="button" class="quick-chip" (click)="setDatePreset('today')">Today</button>
            <button type="button" class="quick-chip" (click)="setDatePreset('week')">This Week</button>
            <button type="button" class="quick-chip" (click)="setDatePreset('month')">This Month</button>
            <button type="button" class="quick-chip" (click)="setDatePreset('30d')">Last 30 Days</button>
            <button type="button" class="quick-chip clear" (click)="clearDates()">Clear Dates</button>
          </div>
        </div>

        <!-- ACTIVE FILTER CHIPS STRIP -->
        <div *ngIf="activeFilterCount() > 0" class="active-chips-strip">
          <span class="strip-label">Active:</span>

          <span *ngIf="searchKeyword()" class="filter-pill">
            Search: "{{ searchKeyword() }}"
            <mat-icon (click)="clearSearch()">close</mat-icon>
          </span>

          <span *ngIf="statusFilter() !== 'ALL'" class="filter-pill">
            Status: {{ statusFilter() }}
            <mat-icon (click)="statusFilter.set('ALL'); onFilterChange()">close</mat-icon>
          </span>

          <span *ngIf="departmentFilter() !== 'ALL'" class="filter-pill">
            Dept: {{ departmentFilter() }}
            <mat-icon (click)="departmentFilter.set('ALL'); onFilterChange()">close</mat-icon>
          </span>

          <span *ngIf="priorityFilter() !== 'ALL'" class="filter-pill">
            Priority: {{ priorityFilter() }}
            <mat-icon (click)="priorityFilter.set('ALL'); onFilterChange()">close</mat-icon>
          </span>

          <span *ngIf="categoryFilter() !== 'ALL'" class="filter-pill">
            Category: {{ categoryFilter() }}
            <mat-icon (click)="categoryFilter.set('ALL'); onFilterChange()">close</mat-icon>
          </span>

          <span *ngIf="officerFilter() !== 'ALL'" class="filter-pill">
            Officer: {{ officerFilter() }}
            <mat-icon (click)="officerFilter.set('ALL'); onFilterChange()">close</mat-icon>
          </span>

          <span *ngIf="dateFrom() || dateTo()" class="filter-pill">
            Date: {{ dateFrom() || 'Start' }} to {{ dateTo() || 'Present' }}
            <mat-icon (click)="clearDates()">close</mat-icon>
          </span>

          <span *ngIf="attachmentFilter() !== 'ALL'" class="filter-pill">
            {{ attachmentFilter() === 'WITH' ? 'Has Attachments' : 'No Attachments' }}
            <mat-icon (click)="attachmentFilter.set('ALL'); onFilterChange()">close</mat-icon>
          </span>

          <span *ngIf="storageFilter() !== 'ALL'" class="filter-pill">
            Storage: {{ storageFilter() === 'firebase' ? 'Firebase' : 'Network Share' }}
            <mat-icon (click)="storageFilter.set('ALL'); onFilterChange()">close</mat-icon>
          </span>

          <button type="button" class="clear-all-link" (click)="resetFilters()">Clear All</button>
        </div>
      </mat-card>

      <!-- Letters Table & Pagination -->
      <mat-card class="table-card">
        <div class="table-header-info">
          <span>Showing <strong>{{ paginatedRangeText() }}</strong> of <strong>{{ filteredLetters().length }}</strong> matching letters (Total registered: {{ allLetters().length }})</span>
        </div>

        <div class="table-wrap">
          <table mat-table [dataSource]="paginatedLetters()" class="inbox-table mat-elevation-z1">
            <!-- Ref Number -->
            <ng-container matColumnDef="ref">
              <th mat-header-cell *matHeaderCellDef> Reference No. </th>
              <td mat-cell *matCellDef="let l">
                <span class="ref-badge" (click)="openDetail(l)" matTooltip="Click to inspect dossier">{{ l.ref_number }}</span>
              </td>
            </ng-container>

            <!-- Title & Date -->
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef> Title & Date </th>
              <td mat-cell *matCellDef="let l">
                <div class="title-cell" (click)="openDetail(l)">
                  <strong class="title-txt">{{ l.title }}</strong>
                  <div class="meta-row">
                    <span class="date-txt"><mat-icon class="mini-icon">event</mat-icon> {{ l.received_date }}</span>
                    <span *ngIf="l.link_ref" class="link-chip">
                      <mat-icon class="mini-icon">link</mat-icon> {{ l.link_ref }}
                    </span>
                    <span *ngIf="l.category" class="cat-chip-inline">{{ l.category }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Sender -->
            <ng-container matColumnDef="sender">
              <th mat-header-cell *matHeaderCellDef> Received From </th>
              <td mat-cell *matCellDef="let l">
                <span class="sender-txt">{{ l.received_from }}</span>
              </td>
            </ng-container>

            <!-- Departments -->
            <ng-container matColumnDef="departments">
              <th mat-header-cell *matHeaderCellDef> Send To (Dept) </th>
              <td mat-cell *matCellDef="let l">
                <div class="chips-wrap">
                  <span *ngFor="let d of l.send_to" class="dept-chip">{{ d }}</span>
                  <span *ngIf="!l.send_to?.length" class="text-muted">-</span>
                </div>
              </td>
            </ng-container>

            <!-- Assigned Officers -->
            <ng-container matColumnDef="assigned">
              <th mat-header-cell *matHeaderCellDef> Assigned Officer </th>
              <td mat-cell *matCellDef="let l">
                <div class="chips-wrap">
                  <span *ngFor="let u of l.assigned_user_names || l.assigned_to" class="user-chip">{{ u }}</span>
                  <span *ngIf="!l.assigned_to?.length" class="text-muted">Unassigned</span>
                </div>
              </td>
            </ng-container>

            <!-- Priority -->
            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef class="text-center"> Priority </th>
              <td mat-cell *matCellDef="let l" class="text-center">
                <span class="priority-pill" [ngClass]="(l.priority || 'Normal').toLowerCase()">
                  {{ l.priority || 'Normal' }}
                </span>
              </td>
            </ng-container>

            <!-- Status -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="text-center"> Status </th>
              <td mat-cell *matCellDef="let l" class="text-center">
                <span class="status-chip" [ngClass]="getStatusClass(l.status)" (click)="openStatusDialog(l)" matTooltip="Click to update workflow status">
                  {{ l.status }}
                </span>
              </td>
            </ng-container>

            <!-- Attachments -->
            <ng-container matColumnDef="attachments">
              <th mat-header-cell *matHeaderCellDef class="text-center"> Attachments </th>
              <td mat-cell *matCellDef="let l" class="text-center">
                <span *ngIf="l.attachments?.length" class="file-count-badge" (click)="openDetail(l)" matTooltip="View attached files">
                  <mat-icon style="font-size: 14px; width: 14px; height: 14px;">attach_file</mat-icon>
                  {{ l.attachments.length }}
                </span>
                <span *ngIf="!l.attachments?.length" class="text-muted">-</span>
              </td>
            </ng-container>

            <!-- Actions -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right"> Actions </th>
              <td mat-cell *matCellDef="let l" class="text-right">
                <button mat-icon-button [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="openDetail(l)">
                    <mat-icon color="primary">visibility</mat-icon> View Dossier
                  </button>
                  <button mat-menu-item (click)="openStatusDialog(l)">
                    <mat-icon>update</mat-icon> Update Status
                  </button>
                  <button mat-menu-item (click)="openEditDialog(l)">
                    <mat-icon>edit</mat-icon> Edit Letter
                  </button>
                  <button mat-menu-item (click)="deleteLetter(l)">
                    <mat-icon color="warn">delete</mat-icon> Delete Record
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" colspan="9">
                <mat-icon style="font-size: 36px; width: 36px; height: 36px; color: #94a3b8; margin-bottom: 8px;">find_in_page</mat-icon>
                <p>No matching official letters found for current search or filters.</p>
                <button mat-stroked-button (click)="resetFilters()" style="margin-top: 8px;">
                  <mat-icon>restart_alt</mat-icon> Reset Filters
                </button>
              </td>
            </tr>
          </table>
        </div>

        <!-- Mat-Paginator -->
        <mat-paginator [length]="filteredLetters().length"
                       [pageSize]="pageSize()"
                       [pageIndex]="pageIndex()"
                       [pageSizeOptions]="[5, 10, 25, 50, 100]"
                       (page)="onPageChange($event)"
                       showFirstLastButtons
                       class="inbox-paginator">
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 12px; }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
      .header-titles {
        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          .title-icon { color: #0284c7; font-size: 24px; width: 24px; height: 24px; }
          .page-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
        }
        .page-desc { font-size: 12.5px; color: #64748b; margin: 3px 0 0 0; }
      }
      .actions-group {
        .add-btn { height: 36px; font-size: 12.5px; }
      }
    }

    .filter-card {
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .filters-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      .search-field {
        flex: 1;
        min-width: 260px;
        .search-prefix { color: #64748b; margin-right: 4px; }
        .clear-btn {
          width: 24px;
          height: 24px;
          line-height: 24px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
          &:hover mat-icon { color: #0f172a; }
        }
      }
      .filter-field { width: 150px; }
      .adv-toggle-btn {
        height: 38px;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-color: #cbd5e1;
        color: #475569;
        &.active {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #1d4ed8;
        }
        .active-count-badge {
          background: #0284c7;
          color: white;
          border-radius: 10px;
          padding: 1px 6px;
          font-size: 10.5px;
          font-weight: 700;
        }
      }
      .sm-btn {
        width: 34px;
        height: 34px;
        line-height: 34px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    /* COLLAPSIBLE ADVANCED FILTERS */
    .advanced-filters-panel {
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .adv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
    }

    .date-chips-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      .chips-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
      .quick-chip {
        padding: 3px 8px;
        border-radius: 5px;
        border: 1px solid #cbd5e1;
        background: white;
        font-size: 11px;
        font-weight: 500;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover { background: #e2e8f0; color: #0f172a; }
        &.clear { color: #dc2626; border-color: #fca5a5; &:hover { background: #fee2e2; } }
      }
    }

    /* ACTIVE FILTER CHIPS */
    .active-chips-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
      .strip-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
      .filter-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #e0f2fe;
        color: #0369a1;
        border: 1px solid #bae6fd;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        mat-icon {
          font-size: 13px; width: 13px; height: 13px; cursor: pointer;
          &:hover { color: #dc2626; }
        }
      }
      .clear-all-link {
        background: transparent;
        border: none;
        color: #dc2626;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
        padding: 2px 4px;
        &:hover { color: #991b1b; }
      }
    }

    .table-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }

    .table-header-info {
      padding: 8px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11.5px;
      color: #64748b;
    }

    .table-wrap { overflow-x: auto; }

    .inbox-table {
      width: 100%;
      th {
        background: #f8fafc;
        color: #475569;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.03em;
        white-space: nowrap;
        height: 38px !important;
        padding: 0 10px;
        border-bottom: 1px solid #e2e8f0;
      }
      td { font-size: 12px; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
      .table-row {
        &:hover { background: #fafafa; }
      }
    }

    .ref-badge {
      font-family: monospace;
      font-weight: 700;
      color: #1e40af;
      background: #eff6ff;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      white-space: nowrap;
      &:hover { text-decoration: underline; }
    }

    .title-cell {
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-width: 320px;
      .title-txt { color: #0f172a; font-size: 12px; &:hover { color: #1e40af; } }
      .meta-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        .date-txt {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          color: #64748b;
          font-size: 10.5px;
          .mini-icon { font-size: 12px; width: 12px; height: 12px; }
        }
        .link-chip {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          background: #f1f5f9;
          color: #475569;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 10px;
          font-family: monospace;
          .mini-icon { font-size: 11px; width: 11px; height: 11px; }
        }
        .cat-chip-inline {
          background: #fdf2f8;
          color: #9d174d;
          font-size: 9.5px;
          padding: 1px 5px;
          border-radius: 3px;
          font-weight: 600;
        }
      }
    }

    .sender-txt {
      font-weight: 500;
      color: #334155;
      font-size: 11.5px;
    }

    .chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      .dept-chip {
        background: #f1f5f9;
        color: #334155;
        font-size: 10.5px;
        padding: 1px 6px;
        border-radius: 4px;
        white-space: nowrap;
      }
      .user-chip {
        background: #f0fdf4;
        color: #166534;
        border: 1px solid #bbf7d0;
        font-size: 10.5px;
        padding: 1px 6px;
        border-radius: 4px;
        white-space: nowrap;
      }
    }

    .priority-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      &.normal { background: #f1f5f9; color: #475569; }
      &.urgent { background: #fef3c7; color: #b45309; }
      &.immediate { background: #fee2e2; color: #b91c1c; }
    }

    .status-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      cursor: pointer;
      display: inline-block;
      white-space: nowrap;
      &.received { background: #e0f2fe; color: #0369a1; }
      &.in-review { background: #fef3c7; color: #b45309; }
      &.action-required { background: #fee2e2; color: #b91c1c; }
      &.in-progress { background: #f3e8ff; color: #7e22ce; }
      &.completed { background: #dcfce7; color: #15803d; }
      &.dispatched { background: #e0e7ff; color: #4338ca; }
      &.archived { background: #f1f5f9; color: #64748b; }
      &:hover { filter: brightness(0.95); }
    }

    .file-count-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      &:hover { background: #e2e8f0; }
    }

    .inbox-paginator {
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
    }

    .empty-cell {
      text-align: center;
      color: #94a3b8;
      padding: 32px !important;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      p { margin: 0; font-size: 13px; }
    }

    .text-muted { color: #94a3b8; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
  `]
})
export class LetterInboxComponent implements OnInit {
  private letterService = inject(LetterService);
  private settingsService = inject(SettingsService);
  private firestoreService = inject(FirestoreService);
  private dialog = inject(MatDialog);

  allLetters = signal<Letter[]>([]);
  departments = signal<Department[]>([]);
  systemUsers = signal<AppUser[]>([]);
  statuses = ALL_LETTER_STATUSES;

  // Search & Filter Signals (Fully Reactive)
  searchKeyword = signal<string>('');
  statusFilter = signal<string>('ALL');
  departmentFilter = signal<string>('ALL');
  priorityFilter = signal<string>('ALL');

  // Advanced Filters Signals
  showAdvancedFilters = signal<boolean>(false);
  categoryFilter = signal<string>('ALL');
  officerFilter = signal<string>('ALL');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
  dateFromObj = computed(() => this.dateFrom() ? new Date(this.dateFrom() + 'T00:00:00') : null);
  dateToObj = computed(() => this.dateTo() ? new Date(this.dateTo() + 'T00:00:00') : null);
  attachmentFilter = signal<string>('ALL'); // 'ALL' | 'WITH' | 'WITHOUT'
  storageFilter = signal<string>('ALL');    // 'ALL' | 'firebase' | 'network'
  sortBy = signal<string>('date_desc');     // 'date_desc' | 'date_asc' | 'priority' | 'ref_asc'

  // Pagination Signals
  pageSize = signal<number>(10);
  pageIndex = signal<number>(0);

  displayedColumns = [
    'ref',
    'title',
    'sender',
    'departments',
    'assigned',
    'priority',
    'status',
    'attachments',
    'actions'
  ];

  // Dynamic Categories from settings & registered letters
  categories = computed(() => {
    const fromLetters = this.allLetters().map(l => l.category).filter(Boolean);
    const set = new Set<string>([...DEFAULT_LETTER_SETTINGS.categories, ...fromLetters]);
    return Array.from(set).sort();
  });

  // Active filter count for badge
  activeFilterCount = computed(() => {
    let count = 0;
    if (this.searchKeyword().trim()) count++;
    if (this.statusFilter() !== 'ALL') count++;
    if (this.departmentFilter() !== 'ALL') count++;
    if (this.priorityFilter() !== 'ALL') count++;
    if (this.categoryFilter() !== 'ALL') count++;
    if (this.officerFilter() !== 'ALL') count++;
    if (this.dateFrom()) count++;
    if (this.dateTo()) count++;
    if (this.attachmentFilter() !== 'ALL') count++;
    if (this.storageFilter() !== 'ALL') count++;
    return count;
  });

  // Filtered Letters (Reactive Signal Computation)
  filteredLetters = computed(() => {
    let list = this.allLetters();
    const kw = this.searchKeyword().toLowerCase().trim();

    // 1. Text Search across reference, title, sender, link_ref, directives, category, departments, officers
    if (kw) {
      list = list.filter(l => {
        const ref = (l.ref_number || '').toLowerCase();
        const title = (l.title || '').toLowerCase();
        const sender = (l.received_from || '').toLowerCase();
        const link = (l.link_ref || '').toLowerCase();
        const desc = (l.description || '').toLowerCase();
        const cat = (l.category || '').toLowerCase();
        const depts = (l.send_to || []).join(' ').toLowerCase();
        const officers = (l.assigned_user_names || l.assigned_to || []).join(' ').toLowerCase();

        return ref.includes(kw) ||
               title.includes(kw) ||
               sender.includes(kw) ||
               link.includes(kw) ||
               desc.includes(kw) ||
               cat.includes(kw) ||
               depts.includes(kw) ||
               officers.includes(kw);
      });
    }

    // 2. Status Filter
    const st = this.statusFilter();
    if (st !== 'ALL') {
      list = list.filter(l => l.status === st);
    }

    // 3. Department Filter
    const dept = this.departmentFilter();
    if (dept !== 'ALL') {
      list = list.filter(l => l.send_to?.includes(dept));
    }

    // 4. Priority Filter
    const prio = this.priorityFilter();
    if (prio !== 'ALL') {
      list = list.filter(l => l.priority === prio);
    }

    // 5. Category Filter
    const cat = this.categoryFilter();
    if (cat !== 'ALL') {
      list = list.filter(l => l.category === cat);
    }

    // 6. Officer Filter
    const off = this.officerFilter().toLowerCase();
    if (off !== 'all') {
      list = list.filter(l => 
        l.assigned_to?.some(u => u.toLowerCase().includes(off)) ||
        l.assigned_user_names?.some(u => u.toLowerCase().includes(off))
      );
    }

    // 7. Date Range Filter
    const dFrom = this.dateFrom();
    if (dFrom) {
      list = list.filter(l => (l.received_date || '') >= dFrom);
    }
    const dTo = this.dateTo();
    if (dTo) {
      list = list.filter(l => (l.received_date || '') <= dTo);
    }

    // 8. Attachments Filter
    const att = this.attachmentFilter();
    if (att === 'WITH') {
      list = list.filter(l => (l.attachments?.length || 0) > 0);
    } else if (att === 'WITHOUT') {
      list = list.filter(l => !l.attachments?.length);
    }

    // 9. Storage Location Filter
    const stor = this.storageFilter();
    if (stor !== 'ALL') {
      list = list.filter(l => l.attachments?.some(a => a.storage_destination === stor));
    }

    // 10. Sorting
    const sort = this.sortBy();
    if (sort === 'date_desc') {
      list = [...list].sort((a, b) => (b.received_date || '').localeCompare(a.received_date || ''));
    } else if (sort === 'date_asc') {
      list = [...list].sort((a, b) => (a.received_date || '').localeCompare(b.received_date || ''));
    } else if (sort === 'priority') {
      const pWeights: Record<string, number> = { 'Immediate': 3, 'Urgent': 2, 'Normal': 1 };
      list = [...list].sort((a, b) => (pWeights[b.priority] || 0) - (pWeights[a.priority] || 0));
    } else if (sort === 'ref_asc') {
      list = [...list].sort((a, b) => (a.ref_number || '').localeCompare(b.ref_number || ''));
    }

    return list;
  });

  // Paginated Slice of Filtered Letters
  paginatedLetters = computed(() => {
    const letters = this.filteredLetters();
    const start = this.pageIndex() * this.pageSize();
    return letters.slice(start, start + this.pageSize());
  });

  // User-facing "Showing X – Y" range text
  paginatedRangeText = computed(() => {
    const total = this.filteredLetters().length;
    if (total === 0) return '0';
    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min((this.pageIndex() + 1) * this.pageSize(), total);
    return `${start}–${end}`;
  });

  ngOnInit() {
    this.letterService.getLetters().subscribe(letters => {
      this.allLetters.set(letters);
    });

    this.settingsService.getDepartments().subscribe(depts => {
      this.departments.set(depts);
    });

    this.firestoreService.getCollection<AppUser>('users').subscribe(users => {
      this.systemUsers.set(users);
    });
  }

  // --- FILTER & SEARCH EVENTS ---

  onSearchChange(val: string) {
    this.searchKeyword.set(val);
    this.onFilterChange();
  }

  clearSearch() {
    this.searchKeyword.set('');
    this.onFilterChange();
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.update(v => !v);
  }

  onFilterChange() {
    this.pageIndex.set(0); // Reset to first page whenever search or filter changes
  }

  onPageChange(event: PageEvent) {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
  }

  formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onDateFromChange(d: Date | null) {
    this.dateFrom.set(d ? this.formatDate(d) : '');
    this.onFilterChange();
  }

  onDateToChange(d: Date | null) {
    this.dateTo.set(d ? this.formatDate(d) : '');
    this.onFilterChange();
  }

  setDatePreset(preset: 'today' | 'week' | 'month' | '30d') {
    const today = new Date();
    const format = (d: Date) => this.formatDate(d);

    if (preset === 'today') {
      const str = format(today);
      this.dateFrom.set(str);
      this.dateTo.set(str);
    } else if (preset === 'week') {
      const day = today.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const mon = new Date(today);
      mon.setDate(today.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      this.dateFrom.set(format(mon));
      this.dateTo.set(format(sun));
    } else if (preset === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      this.dateFrom.set(format(first));
      this.dateTo.set(format(last));
    } else if (preset === '30d') {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      this.dateFrom.set(format(past));
      this.dateTo.set(format(today));
    }

    this.onFilterChange();
  }

  clearDates() {
    this.dateFrom.set('');
    this.dateTo.set('');
    this.onFilterChange();
  }

  resetFilters() {
    this.searchKeyword.set('');
    this.statusFilter.set('ALL');
    this.departmentFilter.set('ALL');
    this.priorityFilter.set('ALL');
    this.categoryFilter.set('ALL');
    this.officerFilter.set('ALL');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.attachmentFilter.set('ALL');
    this.storageFilter.set('ALL');
    this.sortBy.set('date_desc');
    this.pageIndex.set(0);
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  // --- DIALOG ACTIONS ---

  openAddDialog() {
    this.dialog.open(LetterDialogComponent, {
      width: '840px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      panelClass: 'letter-dialog-overlay',
      autoFocus: false,
      data: {}
    });
  }

  openEditDialog(letter: Letter) {
    this.dialog.open(LetterDialogComponent, {
      width: '840px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      panelClass: 'letter-dialog-overlay',
      autoFocus: false,
      data: { letter }
    });
  }

  openDetail(letter: Letter) {
    this.dialog.open(LetterDetailDialogComponent, {
      width: '800px',
      maxWidth: '96vw',
      data: { letter }
    });
  }

  openStatusDialog(letter: Letter) {
    this.dialog.open(LetterStatusDialogComponent, {
      width: '520px',
      data: { letter }
    });
  }

  async deleteLetter(letter: Letter) {
    if (confirm('Are you sure you want to delete official letter ' + letter.ref_number + '?')) {
      await this.letterService.deleteLetter(letter);
    }
  }
}
