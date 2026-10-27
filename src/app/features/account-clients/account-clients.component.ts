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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import * as XLSX from 'xlsx';

import { AccountClient, AccountClientType } from './models/account-client.model';
import { AccountClientService } from './services/account-client.service';
import { AccountClientDialogComponent } from './account-client-dialog.component';
import { AccountClientDetailDialogComponent } from './account-client-detail-dialog.component';
import { VoucherService } from '../vouchers/services/voucher.service';
import { Voucher } from '../vouchers/models/voucher.model';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-account-clients',
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
    MatPaginatorModule
  ],
  templateUrl: './account-clients.component.html',
  styleUrl: './account-clients.component.scss'
})
export class AccountClientsComponent implements OnInit {
  private clientService = inject(AccountClientService);
  private voucherService = inject(VoucherService);
  private dialog = inject(MatDialog);
  private notif = inject(NotificationService);
  public rbacService = inject(RbacService);

  clients = signal<AccountClient[]>([]);
  vouchers = signal<Voucher[]>([]);
  isLoading = signal<boolean>(true);

  // Filters
  searchQuery = signal<string>('');
  selectedType = signal<string>('All');
  selectedStatus = signal<string>('All');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  displayedColumns: string[] = [
    'client',
    'clientType',
    'contact',
    'banking',
    'vouchersCount',
    'status',
    'actions'
  ];

  // Overview metrics
  totalClients = computed(() => this.clients().length);
  activeClientsCount = computed(() => this.clients().filter(c => c.status === 'active').length);
  vendorClientsCount = computed(() => this.clients().filter(c => c.clientType === 'Business / Vendor').length);

  totalLinkedVouchersCount = computed(() => {
    const clientIds = new Set(this.clients().map(c => c.id).filter(Boolean));
    const clientNics = new Set(this.clients().map(c => c.nicOrBrn?.trim().toLowerCase()).filter(Boolean));
    const clientNames = new Set(this.clients().map(c => c.name?.trim().toLowerCase()).filter(Boolean));

    return this.vouchers().filter(v =>
      (v.clientId && clientIds.has(v.clientId)) ||
      (v.payeeNic && clientNics.has(v.payeeNic.trim().toLowerCase())) ||
      (v.payeeName && clientNames.has(v.payeeName.trim().toLowerCase()))
    ).length;
  });

  filteredClients = computed(() => {
    let list = this.clients();

    const type = this.selectedType();
    if (type !== 'All') {
      list = list.filter(c => c.clientType === type);
    }

    const status = this.selectedStatus();
    if (status !== 'All') {
      list = list.filter(c => c.status === status);
    }

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.nicOrBrn && c.nicOrBrn.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.bankName && c.bankName.toLowerCase().includes(q)) ||
        (c.accountNumber && c.accountNumber.includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q))
      );
    }

    return list;
  });

  paginatedClients = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredClients().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.loadClients();
    this.loadVouchers();
  }

  loadClients() {
    this.isLoading.set(true);
    this.clientService.getClients().subscribe({
      next: (data) => {
        this.clients.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load account clients', err);
        this.isLoading.set(false);
        this.notif.error('Failed to load account clients dataset');
      }
    });
  }

  loadVouchers() {
    this.voucherService.getVouchers().subscribe({
      next: (data) => this.vouchers.set(data || []),
      error: () => this.vouchers.set([])
    });
  }

  onFilterChange() {
    this.currentPage.set(1);
  }

  onPageChange(event: PageEvent) {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  getClientVouchersCount(client: AccountClient): number {
    if (!client) return 0;
    const cId = client.id;
    const cNic = client.nicOrBrn?.trim().toLowerCase();
    const cName = client.name?.trim().toLowerCase();

    return this.vouchers().filter(v =>
      (cId && v.clientId && v.clientId === cId) ||
      (cNic && v.payeeNic && v.payeeNic.trim().toLowerCase() === cNic) ||
      (cName && v.payeeName && v.payeeName.trim().toLowerCase() === cName)
    ).length;
  }

  getClientTypeIcon(type: string): string {
    switch (type) {
      case 'Business / Vendor': return 'storefront';
      case 'Government Agency': return 'account_balance';
      case 'Employee': return 'badge';
      case 'Financial Institution': return 'savings';
      default: return 'person';
    }
  }

  getAvatarColorClass(type: string): string {
    switch (type) {
      case 'Business / Vendor': return 'vendor';
      case 'Government Agency': return 'gov';
      case 'Employee': return 'employee';
      default: return 'individual';
    }
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(AccountClientDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: {}
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.clientService.addClient(result);
          this.notif.success(`Account client "${result.name}" registered successfully!`);
          this.loadClients();
        } catch (e: any) {
          console.error('Failed to register client', e);
          this.notif.error(e?.message || 'Failed to register client');
        }
      }
    });
  }

  openEditDialog(client: AccountClient) {
    const dialogRef = this.dialog.open(AccountClientDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: { client }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && client.id) {
        try {
          await this.clientService.updateClient(client.id, result);
          this.notif.success(`Account client "${result.name}" updated!`);
          this.loadClients();
        } catch (e: any) {
          console.error('Failed to update client', e);
          this.notif.error(e?.message || 'Failed to update client');
        }
      }
    });
  }

  openDetailDialog(client: AccountClient) {
    const ref = this.dialog.open(AccountClientDetailDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      data: { client }
    });

    ref.afterClosed().subscribe(() => {
      this.loadClients();
      this.loadVouchers();
    });
  }

  async deleteClient(client: AccountClient) {
    if (!client.id) return;

    // Check if client is linked to vouchers
    const isLinked = await this.clientService.isClientLinked(client.id, client.nicOrBrn);
    if (isLinked) {
      this.notif.warning(
        `Cannot delete "${client.name}". There are active financial vouchers associated with this client in the Account ledger.`
      );
      return;
    }

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete Account Client',
        message: `Are you sure you want to delete "${client.name}" from the Account client dataset? This action cannot be undone.`,
        confirmText: 'Delete Client'
      }
    });

    ref.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.clientService.deleteClient(client.id!, client.name);
          this.notif.success(`Client "${client.name}" deleted successfully`);
          this.loadClients();
        } catch (e: any) {
          console.error('Error deleting client', e);
          this.notif.error(e?.message || 'Failed to delete client');
        }
      }
    });
  }

  exportExcel() {
    const dataToExport = this.filteredClients().map(c => ({
      'Client Name': c.name,
      'Classification Type': c.clientType,
      'NIC / BRN': c.nicOrBrn || '',
      'Phone': c.phone || '',
      'Email': c.email || '',
      'Address': c.address || '',
      'Division': c.division || '',
      'Bank Name': c.bankName || '',
      'Account Number': c.accountNumber || '',
      'Branch': c.branch || '',
      'Category': c.category || '',
      'Status': c.status,
      'Linked Vouchers': this.getClientVouchersCount(c),
      'Created Date': c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Account Clients');
    XLSX.writeFile(wb, `Account_Clients_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}
