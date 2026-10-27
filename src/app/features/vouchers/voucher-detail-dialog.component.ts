import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { Voucher } from './models/voucher.model';

@Component({
  selector: 'app-voucher-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule
  ],
  template: `
    <div class="voucher-print-modal">
      <!-- Modal Header (Hidden on print) -->
      <div class="modal-top-bar no-print">
        <div class="top-title">
          <mat-icon class="icon">receipt_long</mat-icon>
          <span>Official Voucher Details</span>
        </div>
        <div class="top-actions">
          <button mat-flat-button color="primary" (click)="printVoucher()">
            <mat-icon>print</mat-icon>
            Print Voucher
          </button>
          <button mat-icon-button (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Printable Voucher Certificate Layout -->
      <div class="voucher-document">
        <div class="doc-header">
          <div class="doc-emblem">
            <mat-icon>account_balance</mat-icon>
          </div>
          <div class="doc-org-info">
            <h1 class="org-title">DISTRICT SECRETARIAT / DIVISIONAL COUNCIL</h1>
            <h2 class="org-sub">ACCOUNTS & FINANCIAL DISBURSEMENT DIVISION</h2>
            <p class="doc-type-title">{{ voucher.type | uppercase }}</p>
          </div>
          <div class="doc-meta-box">
            <div class="meta-row">
              <span class="meta-lbl">Voucher No:</span>
              <span class="meta-val highlight">{{ voucher.voucherNo }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Date:</span>
              <span class="meta-val">{{ voucher.date }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Status:</span>
              <span class="meta-val status-badge" [ngClass]="voucher.status.toLowerCase().replace(' ', '-')">
                {{ voucher.status }}
              </span>
            </div>
          </div>
        </div>

        <div class="doc-body">
          <table class="voucher-info-table">
            <tr>
              <td class="lbl">Payee / Beneficiary:</td>
              <td class="val primary-bold">{{ voucher.payeeName }}</td>
              <td class="lbl">National ID / Reg:</td>
              <td class="val">{{ voucher.payeeNic || 'N/A' }}</td>
            </tr>
            <tr>
              <td class="lbl">Contact Phone:</td>
              <td class="val">{{ voucher.payeePhone || 'N/A' }}</td>
              <td class="lbl">Department / Branch:</td>
              <td class="val">{{ voucher.department || 'Accounts' }}</td>
            </tr>
            <tr *ngIf="voucher.taskRef || voucher.taskTitle" class="linked-task-tr">
              <td class="lbl">Linked Project / Task:</td>
              <td class="val primary-bold" colspan="3">
                <div class="doc-task-pill" [ngClass]="voucher.taskType || 'land_job'">
                  <mat-icon class="task-icon">{{ voucher.taskType === 'land_job' ? 'terrain' : 'assignment' }}</mat-icon>
                  <span class="task-badge">{{ voucher.taskType === 'land_job' ? 'Land Task' : 'Work Plan Directive' }}</span>
                  <strong class="task-ref">{{ voucher.taskRef }}</strong>
                  <span class="task-title" *ngIf="voucher.taskTitle">— {{ voucher.taskTitle }}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td class="lbl">Payment Method:</td>
              <td class="val">{{ voucher.paymentMethod }}</td>
              <td class="lbl">Cheque / Ref No:</td>
              <td class="val">{{ voucher.referenceNo || 'N/A' }}</td>
            </tr>
            <tr *ngIf="voucher.bankName">
              <td class="lbl">Bank & Branch:</td>
              <td class="val" colspan="3">{{ voucher.bankName }}</td>
            </tr>
          </table>

          <!-- Payment Methods with Nested Payees Allocation -->
          <div *ngIf="hasNestedPayees()" class="sub-table-section">
            <h4 class="sub-table-title">
              <mat-icon class="sub-icon">account_balance_wallet</mat-icon>
              Payment Methods & Allocated Beneficiaries ({{ voucher.payments?.length }} {{ voucher.payments?.length === 1 ? 'Method' : 'Methods' }})
            </h4>
            
            <div *ngFor="let pm of voucher.payments; let j = index" class="print-pm-block">
              <div class="print-pm-banner">
                <div class="pm-banner-left">
                  <span class="pm-pill">Method #{{ j + 1 }}: {{ pm.paymentMethod }}</span>
                  <span class="pm-ref-text" *ngIf="pm.referenceNo">Cheque/Ref: {{ pm.referenceNo }}</span>
                  <span class="pm-bank-text" *ngIf="pm.bankName">• {{ pm.bankName }}</span>
                </div>
                <div class="pm-banner-right">
                  Payment Amount: <strong>LKR {{ pm.amount | number:'1.2-2' }}</strong>
                </div>
              </div>

              <!-- Nested Payees Table under this payment method -->
              <table class="schedule-table nested-table" *ngIf="pm.payees && pm.payees.length > 0">
                <thead>
                  <tr>
                    <th style="width: 32px;">#</th>
                    <th style="width: 140px;">Sub Voucher No</th>
                    <th>Payee / Beneficiary Name</th>
                    <th>Classification / NIC</th>
                    <th>Bank & Account</th>
                    <th>Note / Purpose</th>
                    <th class="text-right" style="width: 130px;">Allocated Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of pm.payees; let idx = index">
                    <td class="text-center">{{ idx + 1 }}</td>
                    <td class="font-mono font-bold" style="color: #0284c7;">{{ p.subVoucherNo || (voucher.voucherNo + '-' + (idx + 1)) }}</td>
                    <td class="primary-bold">{{ p.payeeName }}</td>
                    <td>{{ p.clientType }} {{ p.payeeNic ? '• ' + p.payeeNic : '' }}</td>
                    <td>{{ p.bankName || p.accountNumber || 'N/A' }}</td>
                    <td>{{ p.notes || '-' }}</td>
                    <td class="text-right font-mono font-bold">LKR {{ p.amount | number:'1.2-2' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Fallback: Multi-Payees Allocation Schedule Table (when not nested) -->
          <div *ngIf="!hasNestedPayees() && voucher.payees && voucher.payees.length > 0" class="sub-table-section">
            <h4 class="sub-table-title">
              <mat-icon class="sub-icon">groups</mat-icon>
              Payee & Beneficiary Allocations Schedule ({{ voucher.payees.length }} {{ voucher.payees.length === 1 ? 'Record' : 'Records' }})
            </h4>
            <table class="schedule-table">
              <thead>
                <tr>
                  <th style="width: 35px;">#</th>
                  <th style="width: 140px;">Sub Voucher No</th>
                  <th>Payee / Beneficiary Name</th>
                  <th>Classification / NIC</th>
                  <th>Bank & Account</th>
                  <th>Note / Memo</th>
                  <th class="text-right" style="width: 130px;">Amount (LKR)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of voucher.payees; let idx = index">
                  <td class="text-center">{{ idx + 1 }}</td>
                  <td class="font-mono font-bold" style="color: #0284c7;">{{ p.subVoucherNo || (voucher.voucherNo + '-' + (idx + 1)) }}</td>
                  <td class="primary-bold">{{ p.payeeName }}</td>
                  <td>{{ p.clientType }} {{ p.payeeNic ? '• ' + p.payeeNic : '' }}</td>
                  <td>{{ p.bankName || p.accountNumber || 'N/A' }}</td>
                  <td>{{ p.notes || '-' }}</td>
                  <td class="text-right font-mono font-bold">LKR {{ p.amount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="text-right font-bold">Subtotal Payees Allocated:</td>
                  <td class="text-right font-mono font-bold highlight">LKR {{ voucher.amount | number:'1.2-2' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Fallback: Multi-Payment Methods Breakdown Table (when not nested) -->
          <div *ngIf="!hasNestedPayees() && voucher.payments && voucher.payments.length > 0" class="sub-table-section">
            <h4 class="sub-table-title">
              <mat-icon class="sub-icon">account_balance_wallet</mat-icon>
              Payment Methods Settlement Breakdown ({{ voucher.payments.length }} {{ voucher.payments.length === 1 ? 'Method' : 'Methods' }})
            </h4>
            <table class="schedule-table">
              <thead>
                <tr>
                  <th style="width: 35px;">#</th>
                  <th>Payment Method</th>
                  <th>Cheque / Reference Number</th>
                  <th>Settlement Bank & Branch</th>
                  <th class="text-right" style="width: 130px;">Amount (LKR)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let pm of voucher.payments; let j = index">
                  <td class="text-center">{{ j + 1 }}</td>
                  <td class="primary-bold">{{ pm.paymentMethod }}</td>
                  <td class="font-mono">{{ pm.referenceNo || 'N/A' }}</td>
                  <td>{{ pm.bankName || 'General Account' }}</td>
                  <td class="text-right font-mono font-bold">LKR {{ pm.amount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right font-bold">Subtotal Payments Disbursed:</td>
                  <td class="text-right font-mono font-bold highlight">LKR {{ voucher.amount | number:'1.2-2' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="particulars-section">
            <h3 class="part-header">PARTICULARS OF DISBURSEMENT / RECEIPT</h3>
            <div class="part-text">
              {{ voucher.description }}
            </div>
          </div>

          <div class="amount-summary-box">
            <div class="amount-words">
              <span class="words-lbl">Classification Category:</span>
              <span class="words-val">{{ voucher.category || 'General Operational Budget' }}</span>
            </div>
            <div class="amount-figures">
              <span class="fig-lbl">TOTAL AMOUNT:</span>
              <span class="fig-val">LKR {{ voucher.amount | number:'1.2-2' }}</span>
            </div>
          </div>

          <div *ngIf="voucher.remarks" class="remarks-box">
            <strong>Notes / Accounting Remarks:</strong> {{ voucher.remarks }}
          </div>
        </div>

        <!-- Official Signatures -->
        <div class="doc-signatures">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-role">Prepared By</span>
            <span class="sig-name">{{ voucher.createdBy || 'Accounts Clerk' }}</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-role">Checked & Verified</span>
            <span class="sig-name">Accountant</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-role">Authorized Signatory</span>
            <span class="sig-name">Divisional Secretary</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span class="sig-role">Payee Acknowledgment</span>
            <span class="sig-name">Signature / Date</span>
          </div>
        </div>

        <div class="doc-footer">
          <span>This is an official financial voucher issued under District Accounts by the Divisional Administration System.</span>
          <span class="print-timestamp">Generated on {{ printDate }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .voucher-print-modal {
      display: flex;
      flex-direction: column;
      max-height: 92vh;
      overflow-y: auto;
      background: #f1f5f9;
      padding: 20px;
    }

    .modal-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding: 0 4px;

      .top-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;

        .icon {
          color: #4338ca;
        }
      }

      .top-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .voucher-document {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      padding: 36px 44px;
      border-radius: 4px;
      color: #0f172a;
      font-family: inherit;
    }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;

      .doc-emblem {
        mat-icon {
          font-size: 50px;
          width: 50px;
          height: 50px;
          color: #312e81;
        }
      }

      .doc-org-info {
        text-align: center;
        flex: 1;
        padding: 0 20px;

        .org-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin: 0;
          color: #0f172a;
        }

        .org-sub {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin: 2px 0 6px 0;
          letter-spacing: 0.03em;
        }

        .doc-type-title {
          display: inline-block;
          font-size: 14px;
          font-weight: 800;
          color: #312e81;
          border: 1px solid #312e81;
          padding: 3px 14px;
          border-radius: 4px;
          margin: 0;
          letter-spacing: 0.06em;
        }
      }

      .doc-meta-box {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 12px;
        background: #f8fafc;
        min-width: 170px;

        .meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          margin-bottom: 4px;
          &:last-child { margin-bottom: 0; }

          .meta-lbl { color: #64748b; font-weight: 500; }
          .meta-val { font-weight: 600; color: #0f172a; }
          .meta-val.highlight { color: #312e81; font-family: monospace; font-size: 12px; }
        }
      }
    }

    .voucher-info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12.5px;

      td {
        padding: 6px 10px;
        border: 1px solid #e2e8f0;
      }

      .lbl {
        width: 18%;
        background: #f8fafc;
        font-weight: 600;
        color: #475569;
      }

      .val {
        color: #0f172a;
      }

      .primary-bold {
        font-weight: 700;
        color: #1e1b4b;
      }

      .doc-task-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;

        &.land_job {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          .task-icon { color: #059669; }
          .task-badge { background: #d1fae5; color: #047857; }
        }

        &.work_plan {
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          color: #3730a3;
          .task-icon { color: #4f46e5; }
          .task-badge { background: #e0e7ff; color: #4338ca; }
        }

        .task-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        .task-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .task-ref {
          font-family: monospace;
          font-weight: 700;
        }

        .task-title {
          font-weight: 500;
        }
      }
    }

    .sub-table-section {
      margin-bottom: 20px;

      .sub-table-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        font-weight: 700;
        color: #312e81;
        margin: 0 0 6px 0;
        letter-spacing: 0.03em;
        text-transform: uppercase;

        .sub-icon { font-size: 16px; width: 16px; height: 16px; color: #4338ca; }
      }

      .schedule-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11.5px;

        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 6px 8px;
          border: 1px solid #cbd5e1;
        }

        td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }

        tfoot td {
          background: #f8fafc;
          border-top: 2px solid #cbd5e1;
          padding: 6px 8px;
        }

        .highlight { color: #047857; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; }
        .font-bold { font-weight: 700; }
        .primary-bold { font-weight: 700; color: #1e1b4b; }
      }

      .print-pm-block {
        margin-bottom: 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        overflow: hidden;

        .print-pm-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f1f5f9;
          padding: 6px 10px;
          border-bottom: 1px solid #cbd5e1;

          .pm-banner-left {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11.5px;

            .pm-pill {
              font-weight: 700;
              background: #dcfce7;
              color: #065f46;
              padding: 2px 8px;
              border-radius: 4px;
            }

            .pm-ref-text { font-family: monospace; font-weight: 600; color: #1e293b; }
            .pm-bank-text { color: #64748b; }
          }

          .pm-banner-right {
            font-size: 12px;
            color: #065f46;
          }
        }

        .nested-table {
          border: none;
          th { background: #f8fafc; font-size: 11px; }
          td { font-size: 11px; }
        }
      }
    }

    .particulars-section {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      margin-bottom: 20px;
      overflow: hidden;

      .part-header {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #334155;
        background: #f1f5f9;
        padding: 6px 12px;
        margin: 0;
        border-bottom: 1px solid #cbd5e1;
      }

      .part-text {
        padding: 12px;
        font-size: 13px;
        line-height: 1.5;
        color: #1e293b;
        min-height: 60px;
      }
    }

    .amount-summary-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 2px solid #312e81;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;

      .amount-words {
        font-size: 12px;
        .words-lbl { color: #64748b; margin-right: 6px; }
        .words-val { font-weight: 600; color: #1e293b; }
      }

      .amount-figures {
        text-align: right;
        .fig-lbl { font-size: 11px; font-weight: 700; color: #475569; margin-right: 8px; }
        .fig-val { font-size: 18px; font-weight: 800; color: #047857; }
      }
    }

    .remarks-box {
      font-size: 12px;
      color: #64748b;
      background: #fffbeb;
      border: 1px solid #fde68a;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 24px;
    }

    .doc-signatures {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 40px;
      padding-top: 20px;

      .sig-col {
        text-align: center;
        .sig-line {
          border-bottom: 1px dashed #94a3b8;
          margin-bottom: 6px;
          height: 36px;
        }
        .sig-role {
          display: block;
          font-size: 11.5px;
          font-weight: 700;
          color: #0f172a;
        }
        .sig-name {
          font-size: 10.5px;
          color: #64748b;
        }
      }
    }

    .doc-footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      margin-top: 24px;
      padding-top: 10px;
      font-size: 10px;
      color: #94a3b8;
    }

    @media print {
      .no-print {
        display: none !important;
      }
      .voucher-print-modal {
        background: transparent !important;
        padding: 0 !important;
      }
      .voucher-document {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
    }
  `]
})
export class VoucherDetailDialogComponent {
  dialogRef = inject(MatDialogRef<VoucherDetailDialogComponent>);
  public voucher: Voucher;
  printDate = new Date().toLocaleString();

  constructor(@Inject(MAT_DIALOG_DATA) public data: { voucher: Voucher }) {
    this.voucher = data.voucher;
  }

  hasNestedPayees(): boolean {
    return !!(this.voucher.payments && this.voucher.payments.some(pm => pm.payees && pm.payees.length > 0));
  }

  printVoucher() {
    window.print();
  }
}
