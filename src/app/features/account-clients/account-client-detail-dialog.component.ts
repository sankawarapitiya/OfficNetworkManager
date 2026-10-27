import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { AccountClient, isVoucherLinkedToClient, getClientAllocatedAmount, getClientAllocationsFromVoucher, ClientPayeeAllocation } from './models/account-client.model';
import { Voucher } from '../vouchers/models/voucher.model';
import { VoucherService } from '../vouchers/services/voucher.service';
import { VoucherDetailDialogComponent } from '../vouchers/voucher-detail-dialog.component';
import { VoucherDialogComponent } from '../vouchers/voucher-dialog.component';
import { AccountClientDialogComponent } from './account-client-dialog.component';
import { LinkClientVoucherDialogComponent } from './link-client-voucher-dialog.component';
import { AccountClientService } from './services/account-client.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';

@Component({
  selector: 'app-account-client-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatTableModule
  ],
  template: `
    <div class="client-dossier-container">
      <!-- Header Bar -->
      <div class="dossier-header">
        <div class="profile-hero">
          <div class="profile-avatar" [ngClass]="getAvatarColorClass(client().clientType)">
            <mat-icon>{{ getClientTypeIcon(client().clientType) }}</mat-icon>
          </div>
          <div class="profile-meta">
            <div class="name-status-row">
              <h1 class="client-name">{{ client().name }}</h1>
              <span class="status-pill" [ngClass]="client().status">
                <span class="status-dot"></span>
                {{ client().status | titlecase }}
              </span>
              <span class="type-pill">{{ client().clientType }}</span>
            </div>
            <div class="submeta-row">
              <span class="brn-badge" *ngIf="client().nicOrBrn">
                <mat-icon class="inline-icon">badge</mat-icon>
                ID/BRN: {{ client().nicOrBrn }}
              </span>
              <span class="meta-sep" *ngIf="client().nicOrBrn">•</span>
              <span class="phone-badge">
                <mat-icon class="inline-icon">phone</mat-icon>
                {{ client().phone || 'No phone' }}
              </span>
              <span class="meta-sep">•</span>
              <span class="division-text">
                <mat-icon class="inline-icon">domain</mat-icon>
                {{ client().division || 'General' }}
              </span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button color="primary" class="edit-btn" (click)="openEditModal()" matTooltip="Edit Client Profile">
            <mat-icon>edit</mat-icon> Edit Profile
          </button>
          <button mat-icon-button (click)="close()" class="close-btn" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Main Body -->
      <div class="dossier-body">
        <!-- Vitals Grid -->
        <div class="info-grid">
          <div class="info-card">
            <div class="info-icon phone-icon">
              <mat-icon>phone</mat-icon>
            </div>
            <div class="info-text">
              <span class="info-label">Contact Phone</span>
              <span class="info-value">{{ client().phone || 'Not provided' }}</span>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon email-icon">
              <mat-icon>email</mat-icon>
            </div>
            <div class="info-text">
              <span class="info-label">Email Address</span>
              <span class="info-value">{{ client().email || 'Not provided' }}</span>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon bank-icon">
              <mat-icon>account_balance</mat-icon>
            </div>
            <div class="info-text">
              <span class="info-label">Settlement Bank</span>
              <span class="info-value">{{ client().bankName || 'General Bank' }}</span>
              <span class="info-sub" *ngIf="client().accountNumber">Acc: {{ client().accountNumber }}</span>
            </div>
          </div>

          <div class="info-card">
            <div class="info-icon address-icon">
              <mat-icon>place</mat-icon>
            </div>
            <div class="info-text">
              <span class="info-label">Address</span>
              <span class="info-value">{{ client().address || 'Not specified' }}</span>
            </div>
          </div>
        </div>

        <!-- Financial Summary Metrics -->
        <div class="metrics-strip">
          <div class="metric-block">
            <span class="metric-num">{{ clientVouchers().length }}</span>
            <span class="metric-desc">Master Vouchers</span>
          </div>
          <div class="metric-separator"></div>
          <div class="metric-block sub-v-block">
            <span class="metric-num">{{ totalSubVouchersCount() }}</span>
            <span class="metric-desc">Sub Vouchers / Splits</span>
          </div>
          <div class="metric-separator"></div>
          <div class="metric-block paid-block">
            <span class="metric-num">LKR {{ totalPaidAmount() | number:'1.2-2' }}</span>
            <span class="metric-desc">Total Paid / Disbursed</span>
          </div>
          <div class="metric-separator"></div>
          <div class="metric-block pending-block">
            <span class="metric-num">LKR {{ pendingAmount() | number:'1.2-2' }}</span>
            <span class="metric-desc">Pending / Unpaid ({{ pendingCount() }})</span>
          </div>
        </div>

        <!-- Linked Vouchers Table Section -->
        <div class="section-container">
          <div class="section-header">
            <div class="section-title-wrap">
              <mat-icon class="section-icon">receipt_long</mat-icon>
              <div>
                <h3 class="section-title">Client Financial Vouchers History</h3>
                <p class="section-desc">All linked vouchers and individual sub-voucher allocations for this account client</p>
              </div>
            </div>
            <div class="section-actions-wrap">
              <span class="voucher-count-pill">{{ clientVouchers().length }} {{ clientVouchers().length === 1 ? 'Voucher' : 'Vouchers' }} ({{ totalSubVouchersCount() }} Sub Vouchers)</span>
              <button mat-stroked-button color="primary" class="voucher-action-btn" (click)="openCreateVoucherModal()" matTooltip="Issue New Voucher for this Client">
                <mat-icon>add</mat-icon> Issue Voucher
              </button>
              <button mat-stroked-button class="voucher-action-btn link-voucher-btn" (click)="openLinkExistingVoucherModal()" matTooltip="Link Existing Voucher from Ledger">
                <mat-icon>link</mat-icon> Link Voucher
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div *ngIf="clientVouchers().length === 0" class="empty-vouchers-card">
            <mat-icon class="empty-icon">payments</mat-icon>
            <h4>No Vouchers Issued to this Client Yet</h4>
            <p>When financial vouchers are recorded under this client, they will appear here automatically.</p>
            <div class="empty-actions">
              <button mat-flat-button color="primary" (click)="openCreateVoucherModal()">
                <mat-icon>add</mat-icon> Issue New Voucher
              </button>
              <button mat-stroked-button (click)="openLinkExistingVoucherModal()">
                <mat-icon>link</mat-icon> Link Existing Voucher
              </button>
            </div>
          </div>

          <!-- Vouchers List -->
          <div *ngIf="clientVouchers().length > 0" class="vouchers-list">
            <div *ngFor="let v of clientVouchers()" class="voucher-item-card">
              <!-- Header Row -->
              <div class="v-header-row">
                <div class="v-ref-group">
                  <span class="v-no-tag" (click)="openVoucherDetail(v)" matTooltip="Click to inspect & print voucher certificate">
                    <mat-icon class="v-icon">receipt</mat-icon>
                    Master: {{ v.voucherNo }}
                  </span>
                  <span class="v-type">{{ v.type }}</span>
                  <span class="v-date font-mono">
                    <mat-icon class="inline-v-icon">calendar_today</mat-icon>
                    {{ v.date }}
                  </span>
                </div>
                <div class="v-status-group">
                  <span class="v-status-pill" [ngClass]="v.status.toLowerCase().replace(' ', '-')">
                    <span class="status-dot"></span>
                    {{ v.status }}
                  </span>
                </div>
              </div>

              <!-- Linked Sub-Voucher Allocations Table for this Client -->
              <div class="v-allocations-block">
                <table class="allocations-table">
                  <thead>
                    <tr>
                      <th style="width: 170px;">Sub Voucher #</th>
                      <th style="width: 140px;">Payment Method</th>
                      <th style="width: 150px;">Cheque / Ref No</th>
                      <th>Allocation Note / Purpose</th>
                      <th class="text-right" style="width: 140px;">Allocated Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let alloc of getClientAllocations(v)">
                      <td class="sub-v-col">
                        <span class="sub-v-badge" (click)="openVoucherDetail(v)" matTooltip="Inspect this Sub Voucher">
                          <mat-icon class="badge-icon">tag</mat-icon>
                          {{ alloc.subVoucherNo || v.voucherNo }}
                        </span>
                      </td>
                      <td class="method-col">
                        <span class="method-tag">{{ alloc.paymentMethod || v.paymentMethod || 'Cash' }}</span>
                      </td>
                      <td class="ref-col font-mono">
                        {{ alloc.referenceNo || v.referenceNo || '-' }}
                      </td>
                      <td class="notes-col">
                        <span class="notes-text" [title]="alloc.notes || v.description">
                          {{ alloc.notes || v.description || 'General Disbursement' }}
                        </span>
                      </td>
                      <td class="amount-col text-right font-mono font-bold">
                        LKR {{ alloc.amount | number:'1.2-2' }}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot *ngIf="getClientAllocations(v).length > 1 || isMultiPayee(v)">
                    <tr>
                      <td colspan="4" class="text-right summary-label">
                        Total Client Share in this Voucher:
                        <span *ngIf="isMultiPayee(v)" class="master-total-hint">
                          (Master Voucher Total: LKR {{ v.amount | number:'1.2-2' }})
                        </span>
                      </td>
                      <td class="text-right font-mono font-bold total-client-val">
                        LKR {{ getClientShare(v) | number:'1.2-2' }}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Footer Row -->
              <div class="v-footer-row">
                <span class="v-desc" [title]="v.description">
                  <strong class="desc-lbl">Particulars:</strong> {{ v.description }}
                </span>
                <div class="v-actions">
                  <button mat-stroked-button class="view-v-btn" (click)="openVoucherDetail(v)" matTooltip="Inspect full voucher certificate & breakdown">
                    <mat-icon>visibility</mat-icon> Inspect Voucher
                  </button>
                  <button mat-button color="warn" class="unlink-v-btn" (click)="unlinkVoucher(v)" matTooltip="Unlink Voucher from this Client">
                    <mat-icon>link_off</mat-icon> Unlink
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="dossier-footer">
        <span class="footer-hint">
          <mat-icon class="hint-icon">verified</mat-icon>
          Account Client profile is part of the financial ledger dataset.
        </span>
        <button mat-flat-button color="primary" (click)="close()">Close Dossier</button>
      </div>
    </div>
  `,
  styles: [`
    .client-dossier-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
    }
    .dossier-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;

      .profile-hero {
        display: flex;
        align-items: center;
        gap: 16px;

        .profile-avatar {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: #e0f2fe;
          color: #0369a1;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 28px; width: 28px; height: 28px; }

          &.vendor { background: #fef3c7; color: #b45309; }
          &.gov { background: #ede9fe; color: #6d28d9; }
          &.employee { background: #dcfce7; color: #15803d; }
        }

        .name-status-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;

          .client-name {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin: 0;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 12px;
            background: #dcfce7;
            color: #166534;

            .status-dot {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #16a34a;
            }

            &.inactive {
              background: #f1f5f9;
              color: #64748b;
              .status-dot { background: #94a3b8; }
            }
          }

          .type-pill {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 12px;
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
          }
        }

        .submeta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;

          .inline-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            vertical-align: middle;
          }
          .meta-sep { color: #cbd5e1; }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .dossier-body {
      padding: 20px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;

      .info-card {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;

        .info-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }

          &.phone-icon { background: #e0f2fe; color: #0284c7; }
          &.email-icon { background: #ede9fe; color: #7c3aed; }
          &.bank-icon { background: #fef3c7; color: #d97706; }
          &.address-icon { background: #f1f5f9; color: #475569; }
        }

        .info-text {
          display: flex;
          flex-direction: column;
          overflow: hidden;

          .info-label {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
          }
          .info-value {
            font-size: 13px;
            color: #0f172a;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .info-sub {
            font-size: 11px;
            color: #0284c7;
            font-family: monospace;
          }
        }
      }
    }

    .metrics-strip {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 20px;

      .metric-block {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;

        .metric-num {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .metric-desc {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }

        &.sub-v-block .metric-num { color: #0284c7; }
        &.paid-block .metric-num { color: #059669; }
        &.pending-block .metric-num { color: #d97706; }
      }

      .metric-separator {
        width: 1px;
        height: 36px;
        background: #e2e8f0;
      }
    }

    .section-container {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      padding: 16px;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px solid #f1f5f9;

        .section-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;

          .section-icon { color: #0284c7; font-size: 22px; width: 22px; height: 22px; }
          .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
          .section-desc { font-size: 11px; color: #64748b; margin: 0; }
        }

        .section-actions-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .voucher-action-btn {
            height: 28px;
            line-height: 28px;
            font-size: 11px;
            padding: 0 10px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            mat-icon { font-size: 15px; width: 15px; height: 15px; }

            &.link-voucher-btn {
              color: #0284c7;
              border-color: #bae6fd;
              &:hover { background: #f0f9ff; }
            }
          }
        }

        .voucher-count-pill {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
          background: #e0f2fe;
          color: #0369a1;
        }
      }

      .empty-vouchers-card {
        text-align: center;
        padding: 30px 16px;
        color: #64748b;
        .empty-icon { font-size: 36px; width: 36px; height: 36px; color: #cbd5e1; }
        h4 { margin: 8px 0 4px 0; color: #334155; }
        p { margin: 0; font-size: 12px; }

        .empty-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 14px;
          button {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
        }
      }

      .vouchers-list {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .voucher-item-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;

          .v-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .v-ref-group {
              display: flex;
              align-items: center;
              gap: 8px;

              .v-no-tag {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: monospace;
                font-weight: 700;
                font-size: 13px;
                color: #0284c7;
                background: #e0f2fe;
                padding: 2px 8px;
                border-radius: 4px;
                cursor: pointer;
                &:hover { background: #bae6fd; }
                .v-icon { font-size: 14px; width: 14px; height: 14px; }
              }

              .v-type {
                font-size: 12px;
                color: #64748b;
                font-weight: 500;
              }

              .v-date {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: #64748b;
                background: #f1f5f9;
                padding: 1px 6px;
                border-radius: 4px;
                .inline-v-icon { font-size: 13px; width: 13px; height: 13px; }
              }
            }

            .v-status-group {
              display: flex;
              align-items: center;
              gap: 8px;

              .v-status-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 12px;
                background: #f1f5f9;
                color: #475569;

                .status-dot {
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: #94a3b8;
                }

                &.paid {
                  background: #dcfce7;
                  color: #166534;
                  .status-dot { background: #16a34a; }
                }
                &.approved {
                  background: #e0f2fe;
                  color: #075985;
                  .status-dot { background: #0284c7; }
                }
                &.pending-approval {
                  background: #fef3c7;
                  color: #92400e;
                  .status-dot { background: #d97706; }
                }
                &.draft {
                  background: #f1f5f9;
                  color: #64748b;
                  .status-dot { background: #94a3b8; }
                }
              }
            }
          }

          .v-allocations-block {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #ffffff;
            overflow: hidden;

            .allocations-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;

              th {
                background: #f8fafc;
                color: #64748b;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                padding: 7px 12px;
                border-bottom: 1px solid #e2e8f0;
                text-align: left;
                &.text-right { text-align: right; }
              }

              td {
                padding: 7px 12px;
                border-bottom: 1px solid #f1f5f9;
                color: #1e293b;
                vertical-align: middle;
                &.text-right { text-align: right; }
              }

              tr:last-child td {
                border-bottom: none;
              }

              .sub-v-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: monospace;
                font-weight: 700;
                font-size: 12px;
                color: #0284c7;
                background: #e0f2fe;
                padding: 2px 8px;
                border-radius: 4px;
                cursor: pointer;
                &:hover {
                  background: #bae6fd;
                }
                .badge-icon {
                  font-size: 12px;
                  width: 12px;
                  height: 12px;
                }
              }

              .method-tag {
                display: inline-block;
                font-size: 11px;
                font-weight: 600;
                color: #475569;
                background: #f1f5f9;
                padding: 1px 8px;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
              }

              .notes-text {
                color: #475569;
                display: inline-block;
                max-width: 320px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .amount-col {
                color: #059669;
                font-weight: 700;
              }

              tfoot {
                background: #fafafa;
                border-top: 1px solid #e2e8f0;
                td {
                  padding: 7px 12px;
                }
                .summary-label {
                  font-size: 11.5px;
                  color: #64748b;
                }
                .master-total-hint {
                  color: #94a3b8;
                  font-size: 11px;
                  margin-left: 4px;
                }
                .total-client-val {
                  color: #0f172a;
                  font-size: 12.5px;
                }
              }
            }
          }

          .v-footer-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;

            .v-desc {
              color: #475569;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 60%;
              .desc-lbl {
                color: #64748b;
                font-weight: 600;
              }
            }

            .v-actions {
              display: flex;
              align-items: center;
              gap: 6px;

              .view-v-btn {
                font-size: 11px;
                height: 28px;
                line-height: 28px;
                padding: 0 8px;
                mat-icon { font-size: 14px; width: 14px; height: 14px; }
              }

              .unlink-v-btn {
                font-size: 11px;
                height: 28px;
                line-height: 28px;
                padding: 0 6px;
                min-width: 68px;
                mat-icon { font-size: 14px; width: 14px; height: 14px; }
              }
            }
          }
        }
      }
    }

    .dossier-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;

      .footer-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #64748b;
        .hint-icon { font-size: 16px; width: 16px; height: 16px; color: #0284c7; }
      }
    }

    @media (max-width: 768px) {
      .info-grid { grid-template-columns: 1fr 1fr; }
      .v-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class AccountClientDetailDialogComponent implements OnInit {
  private voucherService = inject(VoucherService);
  private clientService = inject(AccountClientService);
  private dialog = inject(MatDialog);
  private notif = inject(NotificationService);
  public dialogRef = inject(MatDialogRef<AccountClientDetailDialogComponent>);

  public data: { client: AccountClient } = inject(MAT_DIALOG_DATA);

  client = signal<AccountClient>(this.data.client);
  clientVouchers = signal<Voucher[]>([]);

  totalPaidAmount = computed(() => {
    const c = this.client();
    return this.clientVouchers()
      .filter(v => v.status === 'Paid')
      .reduce((sum, v) => sum + getClientAllocatedAmount(v, c), 0);
  });

  pendingAmount = computed(() => {
    const c = this.client();
    return this.clientVouchers()
      .filter(v => v.status !== 'Paid' && v.status !== 'Cancelled')
      .reduce((sum, v) => sum + getClientAllocatedAmount(v, c), 0);
  });

  pendingCount = computed(() => {
    return this.clientVouchers()
      .filter(v => v.status !== 'Paid' && v.status !== 'Cancelled').length;
  });

  totalSubVouchersCount = computed(() => {
    return this.clientVouchers()
      .reduce((sum, v) => sum + this.getClientAllocations(v).length, 0);
  });

  getClientAllocations(v: Voucher): ClientPayeeAllocation[] {
    return getClientAllocationsFromVoucher(v, this.client());
  }

  getClientShare(v: Voucher): number {
    return getClientAllocatedAmount(v, this.client());
  }

  isMultiPayee(v: Voucher): boolean {
    return !!(v.payees && v.payees.length > 1);
  }

  ngOnInit() {
    this.loadClientVouchers();
  }

  loadClientVouchers() {
    const client = this.client();
    this.voucherService.getVouchers().subscribe({
      next: (vouchers) => {
        const filtered = (vouchers || []).filter(v => isVoucherLinkedToClient(v, client));
        this.clientVouchers.set(filtered);
      },
      error: () => this.clientVouchers.set([])
    });
  }

  openCreateVoucherModal() {
    const ref = this.dialog.open(VoucherDialogComponent, {
      width: '960px',
      maxWidth: '96vw',
      data: { preselectedClient: this.client() }
    });

    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.loadClientVouchers();
      }
    });
  }

  openLinkExistingVoucherModal() {
    const ref = this.dialog.open(LinkClientVoucherDialogComponent, {
      width: '740px',
      maxWidth: '96vw',
      data: { client: this.client() }
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.linked) {
        this.loadClientVouchers();
      }
    });
  }

  unlinkVoucher(v: Voucher) {
    if (!v.id) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Unlink Voucher',
        message: `Are you sure you want to unlink Voucher "${v.voucherNo}" from ${this.client().name}? The voucher will remain in the financial ledger as an unassigned voucher.`,
        confirmText: 'Unlink Voucher'
      }
    });

    ref.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          const clientId = this.client().id;
          const updatedPayees = v.payees?.map(p => {
            if (p.clientId && p.clientId === clientId) {
              return { ...p, clientId: '' };
            }
            return p;
          });

          const updatedPayments = v.payments?.map(pm => ({
            ...pm,
            payees: pm.payees?.map(p => {
              if (p.clientId && p.clientId === clientId) {
                return { ...p, clientId: '' };
              }
              return p;
            })
          }));

          const updatePayload: any = {
            clientId: v.clientId === clientId ? '' : (v.clientId || ''),
            customerId: (v as any).customerId === clientId ? '' : ((v as any).customerId || '')
          };
          if (updatedPayees) {
            updatePayload.payees = updatedPayees;
          }
          if (updatedPayments) {
            updatePayload.payments = updatedPayments;
          }

          await this.voucherService.updateVoucher(v.id!, updatePayload);
          this.notif.success(`Voucher ${v.voucherNo} unlinked successfully`);
          this.loadClientVouchers();
        } catch (e: any) {
          console.error('Failed to unlink voucher', e);
          this.notif.error(e?.message || 'Failed to unlink voucher');
        }
      }
    });
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

  openEditModal() {
    const editRef = this.dialog.open(AccountClientDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: { client: this.client() }
    });

    editRef.afterClosed().subscribe(async (result) => {
      if (result && this.client().id) {
        try {
          await this.clientService.updateClient(this.client().id!, result);
          this.client.update(c => ({ ...c, ...result }));
          this.notif.success('Client profile updated successfully');
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to update client profile');
        }
      }
    });
  }

  openVoucherDetail(voucher: Voucher) {
    this.dialog.open(VoucherDetailDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      data: { voucher }
    });
  }

  close() {
    this.dialogRef.close();
  }
}
