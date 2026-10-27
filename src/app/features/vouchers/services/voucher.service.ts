import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AuthService } from '../../../auth/auth.service';
import { EventLogService } from '../../../core/services/event-log.service';
import { AccountSettingsService } from '../../account-settings/services/account-settings.service';
import { Voucher, VoucherStatus } from '../models/voucher.model';

@Injectable({
  providedIn: 'root'
})
export class VoucherService {
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);
  private accountSettingsService = inject(AccountSettingsService);

  private readonly collectionName = 'vouchers';

  getVouchers(): Observable<Voucher[]> {
    return this.firestoreService.getCollection<Voucher>(this.collectionName).pipe(
      map(vouchers => vouchers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    );
  }

  getVoucherById(id: string): Observable<Voucher | undefined> {
    return this.firestoreService.getDocument<Voucher>(`${this.collectionName}/${id}`);
  }

  async generateVoucherNo(type: string = 'Payment Voucher'): Promise<string> {
    const year = new Date().getFullYear();
    const vt = this.accountSettingsService.getVoucherTypeByName(type);
    let prefix = vt?.prefix || vt?.code;
    if (!prefix) {
      prefix = type === 'Receipt Voucher' ? 'RV' : (type === 'Petty Cash' ? 'PCV' : (type === 'Journal Voucher' ? 'JV' : 'PV'));
    }
    const randSeq = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}/${year}/${randSeq}`;
  }

  async addVoucher(voucherData: Omit<Voucher, 'id'>): Promise<string> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Accounts Officer';
    const officerId = user?.uid || 'system';
    const now = Date.now();

    const voucher: Omit<Voucher, 'id'> = {
      ...voucherData,
      createdAt: now,
      createdBy: officerName,
      createdById: officerId,
      updatedAt: now,
      updatedBy: officerName
    };

    const docId = await this.firestoreService.addDocument(this.collectionName, voucher);

    this.eventLogService.logAction(
      'CREATED',
      'account',
      `Created voucher [${voucherData.voucherNo}] for ${voucherData.payeeName} - Amount: LKR ${voucherData.amount.toLocaleString()}`
    );

    return docId;
  }

  async updateVoucher(id: string, voucherData: Partial<Voucher>): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Accounts Officer';
    const now = Date.now();

    await this.firestoreService.updateDocument(this.collectionName, id, {
      ...voucherData,
      updatedAt: now,
      updatedBy: officerName
    });

    this.eventLogService.logAction(
      'UPDATED',
      'account',
      `Updated voucher [${voucherData.voucherNo || id}]`
    );
  }

  async updateStatus(id: string, voucher: Voucher, newStatus: VoucherStatus, remarks?: string): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Accounts Officer';
    const now = Date.now();

    const updatePayload: Partial<Voucher> = {
      status: newStatus,
      updatedAt: now,
      updatedBy: officerName
    };

    if (newStatus === 'Approved') {
      updatePayload.approvedBy = officerName;
      updatePayload.approvedAt = now;
    } else if (newStatus === 'Paid') {
      updatePayload.paidAt = now;
    }

    if (remarks) {
      updatePayload.remarks = remarks;
    }

    await this.firestoreService.updateDocument(this.collectionName, id, updatePayload);

    this.eventLogService.logAction(
      'UPDATED',
      'account',
      `Changed voucher status for [${voucher.voucherNo}] to ${newStatus}`
    );
  }

  async deleteVoucher(voucher: Voucher): Promise<void> {
    if (!voucher.id) return;
    await this.firestoreService.deleteDocument(this.collectionName, voucher.id);

    this.eventLogService.logAction(
      'DELETED',
      'account',
      `Deleted voucher [${voucher.voucherNo}] (${voucher.payeeName})`
    );
  }
}
