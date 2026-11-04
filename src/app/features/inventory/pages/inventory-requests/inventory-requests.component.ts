import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

import { InventoryRequest, InventorySettings, DEFAULT_INVENTORY_SETTINGS } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { RequestDialogComponent } from '../../components/request-dialog/request-dialog.component';
import { ReleaseDialogComponent } from '../../components/release-dialog/release-dialog.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../auth/auth.service';
import { RbacService } from '../../../../auth/rbac.service';

@Component({
  selector: 'app-inventory-requests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule
  ],
  templateUrl: './inventory-requests.component.html',
  styleUrl: './inventory-requests.component.scss'
})
export class InventoryRequestsComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private dialog = inject(MatDialog);
  private notif = inject(NotificationService);
  private authService = inject(AuthService);
  rbacService = inject(RbacService);

  requests = signal<InventoryRequest[]>([]);
  settings = signal<InventorySettings>(DEFAULT_INVENTORY_SETTINGS);
  isLoading = signal<boolean>(true);

  // Active Tab: 'ALL' (Store Management) vs 'MY' (Personal)
  activeTab = signal<'ALL' | 'MY'>('ALL');
  selectedStatusFilter = signal<string>('All');
  searchQuery = signal<string>('');

  // Expanded row ID for showing item details
  expandedRequestId = signal<string | null>(null);

  displayedColumns: string[] = [
    'requestNo',
    'date',
    'requester',
    'division',
    'itemsCount',
    'urgency',
    'status',
    'actions'
  ];

  currentUser = computed(() => this.authService.currentUser());

  // Metrics
  totalCount = computed(() => this.requests().length);
  pendingCount = computed(() => this.requests().filter(r => r.status === 'Pending' || r.status === 'Supervisor Approved').length);
  releasedCount = computed(() => this.requests().filter(r => r.status === 'Released' || r.status === 'Partially Released').length);
  rejectedCount = computed(() => this.requests().filter(r => r.status === 'Rejected').length);

  myRequestsCount = computed(() => {
    const uid = this.currentUser()?.uid;
    const email = this.currentUser()?.email;
    if (!uid && !email) return 0;
    return this.requests().filter(r => r.requesterId === uid || (email && r.requesterEmail === email)).length;
  });

  filteredRequests = computed(() => {
    let list = this.requests();
    const tab = this.activeTab();
    const uid = this.currentUser()?.uid;
    const email = this.currentUser()?.email;

    if (tab === 'MY') {
      list = list.filter(r => r.requesterId === uid || (email && r.requesterEmail === email));
    }

    const st = this.selectedStatusFilter();
    if (st !== 'All') {
      list = list.filter(r => r.status === st);
    }

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(r =>
        r.requestNo.toLowerCase().includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        r.division.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.items.some(it => it.itemName.toLowerCase().includes(q) || it.itemCode.toLowerCase().includes(q))
      );
    }

    return list;
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.inventoryService.getSettings().subscribe(s => {
      if (s) this.settings.set(s);
    });

    this.inventoryService.getRequests().subscribe({
      next: (data) => {
        this.requests.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load requisitions:', err);
        this.isLoading.set(false);
        this.notif.error('Failed to load store requisitions');
      }
    });
  }

  setTab(tab: 'ALL' | 'MY') {
    this.activeTab.set(tab);
  }

  toggleRowExpansion(reqId: string) {
    if (this.expandedRequestId() === reqId) {
      this.expandedRequestId.set(null);
    } else {
      this.expandedRequestId.set(reqId);
    }
  }

  openCreateRequestDialog() {
    const dialogRef = this.dialog.open(RequestDialogComponent, {
      width: '740px',
      maxWidth: '96vw'
    });

    dialogRef.afterClosed().subscribe(async (res) => {
      if (res) {
        try {
          await this.inventoryService.createRequest(res);
          this.notif.success(`Requisition ${res.requestNo} submitted successfully!`);
        } catch (e: any) {
          console.error('Failed to submit requisition:', e);
          this.notif.error('Failed to submit requisition');
        }
      }
    });
  }

  openReleaseDialog(req: InventoryRequest) {
    const dialogRef = this.dialog.open(ReleaseDialogComponent, {
      width: '800px',
      maxWidth: '96vw',
      data: { request: req }
    });

    dialogRef.afterClosed().subscribe(async (res) => {
      if (res) {
        if (res.action === 'RELEASE' && req.id) {
          try {
            await this.inventoryService.releaseRequest(
              req.id,
              req,
              res.releaseLines,
              res.currentItemsMap,
              res.remarks,
              res.receivedBy
            );
            this.notif.success(`Store items released for ${req.requestNo}!`);
          } catch (e: any) {
            console.error('Failed to release items:', e);
            this.notif.error('Failed to release store items');
          }
        } else if (res.action === 'REJECT' && req.id) {
          try {
            await this.inventoryService.rejectRequest(req.id, req, res.reason);
            this.notif.warning(`Requisition ${req.requestNo} rejected`);
          } catch (e: any) {
            console.error('Failed to reject requisition:', e);
            this.notif.error('Failed to reject requisition');
          }
        }
      }
    });
  }

  async approveAsSupervisor(req: InventoryRequest) {
    if (!req.id) return;
    const confirm = window.confirm(`Approve store requisition "${req.requestNo}" for ${req.requesterName}?`);
    if (confirm) {
      try {
        await this.inventoryService.approveBySupervisor(req.id, req);
        this.notif.success(`Requisition ${req.requestNo} approved by Supervisor`);
      } catch (e) {
        this.notif.error('Failed to approve requisition');
      }
    }
  }

  async cancelRequest(req: InventoryRequest) {
    if (!req.id) return;
    const confirm = window.confirm(`Are you sure you want to cancel requisition "${req.requestNo}"?`);
    if (confirm) {
      try {
        await this.inventoryService.cancelRequest(req.id, req);
        this.notif.info(`Requisition ${req.requestNo} cancelled`);
      } catch (e) {
        this.notif.error('Failed to cancel requisition');
      }
    }
  }

  canSupervisorApprove(req: InventoryRequest): boolean {
    const isSupervisor = this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDepartmentHead() || this.rbacService.isDivisionalAdmin();
    const isTwoStep = this.settings().approvalWorkflow === 'supervisor_then_store_manager';
    return isSupervisor && isTwoStep && req.status === 'Pending';
  }

  canStoreManagerRelease(req: InventoryRequest): boolean {
    const isStoreManager = this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.hasRole('Store Manager') || this.rbacService.hasRole('Inventory Officer') || this.rbacService.isDepartmentHead();
    const isTwoStep = this.settings().approvalWorkflow === 'supervisor_then_store_manager';
    
    if (isTwoStep) {
      return isStoreManager && req.status === 'Supervisor Approved';
    } else {
      return isStoreManager && (req.status === 'Pending' || req.status === 'Supervisor Approved');
    }
  }
}
