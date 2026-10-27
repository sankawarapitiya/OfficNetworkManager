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
import * as XLSX from 'xlsx';

import { VoucherService } from './services/voucher.service';
import { Voucher, VoucherStatus, VoucherType } from './models/voucher.model';
import { VoucherDialogComponent } from './voucher-dialog.component';
import { VoucherDetailDialogComponent } from './voucher-detail-dialog.component';
import { AuthService } from '../../auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-vouchers',
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
  templateUrl: './vouchers.component.html',
  styleUrl: './vouchers.component.scss'
})
export class VouchersComponent implements OnInit {
  private voucherService = inject(VoucherService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private notif = inject(NotificationService);
  rbacService = inject(RbacService);

  vouchers = signal<Voucher[]>([]);
  isLoading = signal<boolean>(true);

  // Filters
  searchQuery = signal<string>('');
  selectedType = signal<string>('All');
  selectedStatus = signal<string>('All');

  // Table columns
  displayedColumns: string[] = [
    'voucherNo',
    'type',
    'date',
    'payee',
    'amount',
    'paymentMethod',
    'status',
    'actions'
  ];

  // Computed Metrics
  totalAmountPaid = computed(() => {
    return this.vouchers()
      .filter(v => v.status === 'Paid')
      .reduce((acc, v) => acc + (v.amount || 0), 0);
  });

  pendingApprovalCount = computed(() => {
    return this.vouchers().filter(v => v.status === 'Pending Approval').length;
  });

  totalVouchersCount = computed(() => this.vouchers().length);

  approvedCount = computed(() => {
    return this.vouchers().filter(v => v.status === 'Approved').length;
  });

  filteredVouchers = computed(() => {
    let list = this.vouchers();
    const type = this.selectedType();
    if (type !== 'All') {
      list = list.filter(v => v.type === type);
    }
    const status = this.selectedStatus();
    if (status !== 'All') {
      list = list.filter(v => v.status === status);
    }
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(v =>
        v.voucherNo.toLowerCase().includes(q) ||
        v.payeeName.toLowerCase().includes(q) ||
        (v.payeeNic && v.payeeNic.toLowerCase().includes(q)) ||
        v.description.toLowerCase().includes(q) ||
        (v.referenceNo && v.referenceNo.toLowerCase().includes(q)) ||
        (v.taskRef && v.taskRef.toLowerCase().includes(q)) ||
        (v.taskTitle && v.taskTitle.toLowerCase().includes(q))
      );
    }
    return list;
  });

  ngOnInit() {
    this.loadVouchers();
  }

  loadVouchers() {
    this.isLoading.set(true);
    this.voucherService.getVouchers().subscribe({
      next: (data) => {
        this.vouchers.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load vouchers:', err);
        this.isLoading.set(false);
        this.notif.error('Failed to load vouchers list');
      }
    });
  }

  async openCreateDialog() {
    const defaultNo = await this.voucherService.generateVoucherNo('Payment Voucher');
    const dialogRef = this.dialog.open(VoucherDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      data: { defaultVoucherNo: defaultNo }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.voucherService.addVoucher(result);
          this.notif.success(`Voucher ${result.voucherNo} created successfully!`);
        } catch (e: any) {
          console.error('Failed to create voucher:', e);
          this.notif.error(e?.message || 'Failed to save voucher');
        }
      }
    });
  }

  openEditDialog(voucher: Voucher) {
    const dialogRef = this.dialog.open(VoucherDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      data: { voucher }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && voucher.id) {
        try {
          await this.voucherService.updateVoucher(voucher.id, result);
          this.notif.success(`Voucher ${voucher.voucherNo} updated!`);
        } catch (e: any) {
          console.error('Failed to update voucher:', e);
          this.notif.error(e?.message || 'Failed to update voucher');
        }
      }
    });
  }

  viewVoucher(voucher: Voucher) {
    const canApprove = this.rbacService.isAdmin() || this.rbacService.isSuperAdmin() || this.rbacService.isDivisionalAdmin() || this.rbacService.isDepartmentHead();
    const dialogRef = this.dialog.open(VoucherDetailDialogComponent, {
      width: '840px',
      maxWidth: '96vw',
      data: { voucher, canApprove }
    });

    dialogRef.afterClosed().subscribe(async (res) => {
      if (res && res.action === 'STATUS_CHANGE' && voucher.id) {
        try {
          await this.voucherService.updateStatus(voucher.id, voucher, res.newStatus);
          this.notif.success(`Voucher status updated to ${res.newStatus}`);
        } catch (e) {
          this.notif.error('Failed to update voucher status');
        }
      }
    });
  }

  async deleteVoucher(voucher: Voucher) {
    const confirmed = await this.notif.confirmDelete(
      `voucher "${voucher.voucherNo}" (${voucher.payeeName})`,
      'This action will permanently delete this financial record!'
    );
    if (confirmed) {
      try {
        await this.voucherService.deleteVoucher(voucher);
        this.notif.success(`Voucher ${voucher.voucherNo} deleted`);
      } catch (e) {
        this.notif.error('Failed to delete voucher');
      }
    }
  }

  exportExcel() {
    const dataToExport = this.filteredVouchers().map(v => ({
      'Voucher No': v.voucherNo,
      'Type': v.type,
      'Date': v.date,
      'Payee Name': v.payeeName,
      'NIC / Reg No': v.payeeNic || '',
      'Phone': v.payeePhone || '',
      'Department': v.department || '',
      'Description': v.description,
      'Amount (LKR)': v.amount,
      'Payment Method': v.paymentMethod,
      'Reference No': v.referenceNo || '',
      'Status': v.status,
      'Approved By': v.approvedBy || '',
      'Created By': v.createdBy
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `DONM_Vouchers_Registry_${today}.xlsx`);
    this.notif.info('Exported vouchers to Excel');
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'Payment Voucher': return 'type-pv';
      case 'Receipt Voucher': return 'type-rv';
      case 'Petty Cash': return 'type-pcv';
      default: return 'type-jv';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Draft': return 'status-draft';
      case 'Pending Approval': return 'status-pending';
      case 'Approved': return 'status-approved';
      case 'Paid': return 'status-paid';
      case 'Cancelled': return 'status-cancelled';
      default: return 'status-default';
    }
  }
}
