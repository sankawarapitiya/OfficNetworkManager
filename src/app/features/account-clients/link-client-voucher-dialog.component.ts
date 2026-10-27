import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AccountClient, isVoucherLinkedToClient } from './models/account-client.model';
import { Voucher } from '../vouchers/models/voucher.model';
import { VoucherService } from '../vouchers/services/voucher.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-link-client-voucher-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="link-voucher-modal">
      <!-- Header -->
      <div class="modal-header">
        <div class="title-group">
          <mat-icon class="header-icon">link</mat-icon>
          <div>
            <h2 class="dialog-title">Link Existing Voucher</h2>
            <p class="dialog-sub">Search and associate an existing ledger voucher with <strong>{{ data.client.name }}</strong></p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Client Mini Strip -->
      <div class="client-mini-strip">
        <div class="strip-item">
          <span class="lbl">Client / Payee:</span>
          <span class="val font-semibold">{{ data.client.name }}</span>
        </div>
        <div class="strip-item" *ngIf="data.client.nicOrBrn">
          <span class="lbl">ID / BRN:</span>
          <span class="val font-mono">{{ data.client.nicOrBrn }}</span>
        </div>
        <div class="strip-item" *ngIf="data.client.phone">
          <span class="lbl">Phone:</span>
          <span class="val">{{ data.client.phone }}</span>
        </div>
        <div class="strip-item">
          <span class="lbl">Classification:</span>
          <span class="val">{{ data.client.clientType }}</span>
        </div>
      </div>

      <div class="modal-body">
        <!-- Search filter -->
        <mat-form-field appearance="outline" class="w-full search-field" subscriptSizing="dynamic">
          <mat-label>Search unlinked vouchers by Voucher No, Payee Name, Ref, or Description...</mat-label>
          <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="e.g. PV/2026/1024 or Electricity Bill">
          <mat-icon matPrefix>search</mat-icon>
          <button mat-icon-button matSuffix *ngIf="searchQuery()" (click)="searchQuery.set('')">
            <mat-icon>close</mat-icon>
          </button>
        </mat-form-field>

        <!-- Loading state -->
        <div *ngIf="isLoading()" class="loading-state">
          <p>Loading available vouchers...</p>
        </div>

        <!-- Available vouchers list -->
        <div *ngIf="!isLoading()" class="vouchers-scroll-container">
          <!-- Empty State -->
          <div *ngIf="filteredAvailableVouchers().length === 0" class="empty-state">
            <mat-icon>receipt_long</mat-icon>
            <h4>No Unlinked Vouchers Found</h4>
            <p *ngIf="searchQuery()">No vouchers match your search keyword "{{ searchQuery() }}".</p>
            <p *ngIf="!searchQuery()">All existing vouchers in the ledger are already linked to clients, or no vouchers exist.</p>
          </div>

          <!-- Cards List -->
          <div *ngFor="let v of filteredAvailableVouchers()" class="voucher-candidate-card">
            <div class="card-left">
              <div class="v-ref-line">
                <span class="v-num-badge">
                  <mat-icon>receipt</mat-icon> {{ v.voucherNo }}
                </span>
                <span class="v-type-tag">{{ v.type }}</span>
                <span class="v-date font-mono">{{ v.date }}</span>
                <span class="v-status-pill" [ngClass]="v.status.toLowerCase().replace(' ', '-')">{{ v.status }}</span>
              </div>
              <div class="v-details">
                <span class="v-payee">Payee: <strong>{{ v.payeeName || 'Unspecified' }}</strong></span>
                <span class="v-nic" *ngIf="v.payeeNic">• NIC: {{ v.payeeNic }}</span>
                <span class="v-phone" *ngIf="v.payeePhone">• Phone: {{ v.payeePhone }}</span>
              </div>
              <p class="v-desc" *ngIf="v.description">{{ v.description }}</p>
            </div>

            <div class="card-right">
              <span class="v-amount">LKR {{ v.amount | number:'1.2-2' }}</span>
              <span class="v-method">{{ v.paymentMethod }}</span>
              <button mat-flat-button color="primary" class="link-btn" (click)="linkVoucher(v)">
                <mat-icon>link</mat-icon> Link to Client
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <span class="footer-note">Linking associates this voucher directly with {{ data.client.name }}'s financial ledger profile.</span>
        <button mat-stroked-button (click)="dialogRef.close()">Cancel</button>
      </div>
    </div>
  `,
  styles: [`
    .link-voucher-modal {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
      width: 720px;
      max-width: 95vw;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;

      .title-group {
        display: flex;
        align-items: center;
        gap: 12px;

        .header-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: #0284c7;
        }

        .dialog-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .dialog-sub {
          font-size: 12px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
      }
    }

    .client-mini-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding: 10px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;

      .strip-item {
        display: flex;
        align-items: center;
        gap: 5px;
        .lbl { color: #64748b; }
        .val { color: #1e293b; }
      }
    }

    .modal-body {
      padding: 16px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;

      .search-field {
        width: 100%;
      }
    }

    .vouchers-scroll-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 420px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .voucher-candidate-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      transition: all 0.15s ease;

      &:hover {
        border-color: #0284c7;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .card-left {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;

        .v-ref-line {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .v-num-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-family: monospace;
            font-weight: 700;
            color: #0284c7;
            font-size: 13px;

            mat-icon { font-size: 15px; width: 15px; height: 15px; }
          }

          .v-type-tag {
            font-size: 11px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;
            background: #f1f5f9;
            color: #475569;
          }

          .v-date {
            font-size: 11.5px;
            color: #64748b;
          }

          .v-status-pill {
            font-size: 10.5px;
            font-weight: 600;
            padding: 1px 7px;
            border-radius: 10px;

            &.draft { background: #f1f5f9; color: #475569; }
            &.pending-approval { background: #fef3c7; color: #b45309; }
            &.approved { background: #e0f2fe; color: #0369a1; }
            &.paid { background: #dcfce7; color: #15803d; }
          }
        }

        .v-details {
          font-size: 12px;
          color: #334155;
          margin-top: 2px;
        }

        .v-desc {
          font-size: 11.5px;
          color: #64748b;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .card-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        margin-left: 16px;
        flex-shrink: 0;

        .v-amount {
          font-size: 14px;
          font-weight: 700;
          color: #059669;
        }

        .v-method {
          font-size: 11px;
          color: #64748b;
        }

        .link-btn {
          height: 28px;
          font-size: 11.5px;
          font-weight: 600;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 36px 20px;
      color: #94a3b8;
      text-align: center;

      mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }
      h4 { font-size: 15px; font-weight: 600; color: #475569; margin: 0 0 4px 0; }
      p { font-size: 12.5px; margin: 0; }
    }

    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;

      .footer-note {
        font-size: 11.5px;
        color: #64748b;
      }
    }
  `]
})
export class LinkClientVoucherDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<LinkClientVoucherDialogComponent>);
  private voucherService = inject(VoucherService);
  private notif = inject(NotificationService);

  public data: { client: AccountClient } = inject(MAT_DIALOG_DATA);

  allVouchers = signal<Voucher[]>([]);
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(true);

  availableVouchers = computed(() => {
    const client = this.data.client;
    // Exclude vouchers already linked to this client
    return this.allVouchers().filter(v => !isVoucherLinkedToClient(v, client));
  });

  filteredAvailableVouchers = computed(() => {
    const list = this.availableVouchers();
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return list;

    return list.filter(v =>
      v.voucherNo.toLowerCase().includes(q) ||
      (v.payeeName && v.payeeName.toLowerCase().includes(q)) ||
      (v.payeeNic && v.payeeNic.toLowerCase().includes(q)) ||
      (v.description && v.description.toLowerCase().includes(q)) ||
      (v.referenceNo && v.referenceNo.toLowerCase().includes(q))
    );
  });

  ngOnInit() {
    this.loadVouchers();
  }

  private loadVouchers() {
    this.isLoading.set(true);
    this.voucherService.getVouchers().subscribe({
      next: (data) => {
        this.allVouchers.set(data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.allVouchers.set([]);
        this.isLoading.set(false);
      }
    });
  }

  async linkVoucher(v: Voucher) {
    if (!v.id) return;
    const client = this.data.client;

    try {
      const updatedPayees = v.payees && v.payees.length > 0
        ? v.payees.map((p, idx) => idx === 0 ? { 
            ...p, 
            clientId: client.id, 
            payeeName: client.name, 
            payeeNic: client.nicOrBrn || p.payeeNic || '', 
            payeePhone: client.phone || p.payeePhone || '' 
          } : p)
        : undefined;

      const updatedPayments = v.payments && v.payments.length > 0
        ? v.payments.map((pm, pmIdx) => ({
            ...pm,
            payees: pm.payees?.map((p, pIdx) => (pmIdx === 0 && pIdx === 0) ? {
              ...p,
              clientId: client.id,
              payeeName: client.name,
              payeeNic: client.nicOrBrn || p.payeeNic || '',
              payeePhone: client.phone || p.payeePhone || ''
            } : p)
          }))
        : undefined;

      const payload: any = {
        clientId: client.id,
        clientType: client.clientType,
        payeeName: client.name,
        payeeNic: client.nicOrBrn || v.payeeNic || '',
        payeePhone: client.phone || v.payeePhone || '',
        bankName: client.bankName || v.bankName || ''
      };
      if (updatedPayees) {
        payload.payees = updatedPayees;
      }
      if (updatedPayments) {
        payload.payments = updatedPayments;
      }

      await this.voucherService.updateVoucher(v.id, payload);

      this.notif.success(`Voucher ${v.voucherNo} successfully linked to ${client.name}!`);
      this.dialogRef.close({ linked: true, voucher: v });
    } catch (e: any) {
      console.error('Failed to link voucher', e);
      this.notif.error(e?.message || 'Failed to link voucher to client');
    }
  }
}
