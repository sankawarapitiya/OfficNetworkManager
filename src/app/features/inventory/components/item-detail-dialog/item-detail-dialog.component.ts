import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';

import { InventoryItem, InventoryBatch, StockTransaction } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';

@Component({
  selector: 'app-item-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatTableModule
  ],
  template: `
    <div class="item-detail-modal">
      <!-- Top Action Bar (Hidden on print) -->
      <div class="modal-top-bar no-print">
        <div class="top-title">
          <mat-icon>{{ item.itemType === 'immovable' ? 'apartment' : 'inventory_2' }}</mat-icon>
          <span>{{ item.itemType === 'immovable' ? 'Fixed Asset Dossier' : 'Store Item Profile' }}</span>
        </div>
        <div class="top-actions">
          <button mat-stroked-button (click)="printDossier()">
            <mat-icon>print</mat-icon> Print Profile
          </button>
          <button mat-icon-button (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Printable Certificate Layout -->
      <div class="dossier-document">
        <!-- Document Header -->
        <div class="doc-header">
          <div class="doc-emblem">
            <mat-icon>account_balance</mat-icon>
          </div>
          <div class="doc-org-info">
            <h1 class="org-title">DISTRICT SECRETARIAT / DIVISIONAL COUNCIL</h1>
            <h2 class="org-sub">CENTRAL STORES & FIXED ASSETS REGISTRY</h2>
            <p class="doc-type-title">{{ item.itemType === 'immovable' ? 'OFFICIAL FIXED ASSET RECORD' : 'STORE CONSUMABLE SPECIFICATION' }}</p>
          </div>
          <div class="doc-meta-box">
            <div class="meta-row">
              <span class="meta-lbl">Code / Tag:</span>
              <span class="meta-val highlight">{{ item.assetTag || item.itemCode }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Type:</span>
              <span class="meta-val">{{ item.itemType === 'immovable' ? 'Fixed Asset' : 'Movable Store Item' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Status:</span>
              <span class="meta-val status-badge" [ngClass]="item.status.toLowerCase().replace(' ', '-')">
                {{ item.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- Body Table -->
        <div class="doc-body">
          <table class="item-specs-table">
            <tr>
              <td class="lbl">Item / Asset Name:</td>
              <td class="val primary-bold" colspan="3">{{ item.name }}</td>
            </tr>
            <tr>
              <td class="lbl">Category:</td>
              <td class="val">{{ item.category }}</td>
              <td class="lbl">Location / Room:</td>
              <td class="val">{{ item.location }}</td>
            </tr>
            <tr>
              <td class="lbl">Division / Section:</td>
              <td class="val">{{ item.division || 'General Administration' }}</td>
              <td class="lbl">{{ item.itemType === 'immovable' ? 'Unit / Cost:' : 'Unit of Measure:' }}</td>
              <td class="val">
                {{ item.unit }}
                <span *ngIf="item.unitCost"> (LKR {{ item.unitCost | number:'1.2-2' }})</span>
              </td>
            </tr>

            <!-- Immovable Specific Specs -->
            <tr *ngIf="item.itemType === 'immovable'" class="asset-highlight-tr">
              <td class="lbl">Asset Tag / Barcode:</td>
              <td class="val font-mono primary-bold">{{ item.assetTag || item.itemCode }}</td>
              <td class="lbl">Manufacturer Serial No:</td>
              <td class="val font-mono">{{ item.serialNumber || 'N/A' }}</td>
            </tr>
            <tr *ngIf="item.itemType === 'immovable'" class="asset-highlight-tr">
              <td class="lbl">Assigned Custodian:</td>
              <td class="val primary-bold">{{ item.custodianName || 'Unassigned / General Secretariat' }}</td>
              <td class="lbl">Physical Condition:</td>
              <td class="val">
                <span class="condition-badge" [ngClass]="(item.condition || 'Good').toLowerCase().replace(' ', '-')">
                  {{ item.condition || 'Good' }}
                </span>
              </td>
            </tr>
            <tr *ngIf="item.itemType === 'immovable' && item.acquisitionDate">
              <td class="lbl">Acquisition Date:</td>
              <td class="val">{{ item.acquisitionDate }}</td>
              <td class="lbl">Purchase Cost:</td>
              <td class="val">{{ item.unitCost ? 'LKR ' + (item.unitCost | number:'1.2-2') : 'N/A' }}</td>
            </tr>

            <!-- Movable Specific Specs -->
            <tr *ngIf="item.itemType === 'movable'">
              <td class="lbl">Available Stock:</td>
              <td class="val stock-highlight">{{ item.quantity }} {{ item.unit }}</td>
              <td class="lbl">Low Stock Alert Level:</td>
              <td class="val">{{ item.minStockAlert }} {{ item.unit }}</td>
            </tr>

            <tr *ngIf="item.description">
              <td class="lbl">Specifications:</td>
              <td class="val" colspan="3">{{ item.description }}</td>
            </tr>

            <tr *ngIf="item.remarks">
              <td class="lbl">Remarks / Notes:</td>
              <td class="val" colspan="3">{{ item.remarks }}</td>
            </tr>
          </table>

          <!-- FIFO Batches & Stock Valuation (For Movable Items) -->
          <div class="batches-block" *ngIf="item.itemType === 'movable'">
            <div class="batches-header-bar">
              <h3 class="history-title">
                <mat-icon>layers</mat-icon>
                First-In, First-Out (FIFO) Batches & Stock Valuation
              </h3>
              <div class="total-valuation-badge">
                <span class="v-lbl">Total Inventory Valuation:</span>
                <strong class="v-val font-mono">LKR {{ getTotalValuation() | number:'1.2-2' }}</strong>
              </div>
            </div>

            <table class="batches-detail-table" *ngIf="getItemBatches().length > 0; else noBatchesTpl">
              <thead>
                <tr>
                  <th>FIFO Priority</th>
                  <th>Batch / Reference</th>
                  <th>Received Date</th>
                  <th>Initial Qty</th>
                  <th>Remaining Qty</th>
                  <th>Batch Unit Price</th>
                  <th>Valuation (LKR)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let b of getItemBatches(); let i = index" [class.exhausted]="b.remainingQty <= 0" [class.active-head]="i === 0 && b.remainingQty > 0">
                  <td>
                    <span class="batch-order-pill" [class.active]="b.remainingQty > 0" [class.first-pill]="i === 0 && b.remainingQty > 0">
                      {{ b.remainingQty > 0 ? (i === 0 ? 'Next Out (#1)' : '#' + (i + 1) + ' In Queue') : 'Exhausted' }}
                    </span>
                  </td>
                  <td class="font-mono">
                    <strong>{{ b.batchNo }}</strong>
                    <span class="sub-ref" *ngIf="b.referenceNo && b.referenceNo !== b.batchNo">({{ b.referenceNo }})</span>
                  </td>
                  <td>{{ b.receivedDate || '—' }}</td>
                  <td>{{ b.initialQty }} {{ item.unit }}</td>
                  <td>
                    <strong [class.text-success]="b.remainingQty > 0">{{ b.remainingQty }} {{ item.unit }}</strong>
                  </td>
                  <td class="font-mono">LKR {{ b.unitCost | number:'1.2-2' }}</td>
                  <td class="font-mono val-col">LKR {{ (b.remainingQty * b.unitCost) | number:'1.2-2' }}</td>
                  <td>
                    <span class="batch-status-chip" [class.in-stock]="b.remainingQty > 0" [class.depleted]="b.remainingQty <= 0">
                      {{ b.remainingQty > 0 ? 'Active' : 'Depleted' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <ng-template #noBatchesTpl>
              <div class="no-batches-box">
                <mat-icon>info</mat-icon>
                <span>No FIFO batches tracked yet. Current inventory is {{ item.quantity }} {{ item.unit }} at reference price LKR {{ (item.unitCost || 0) | number:'1.2-2' }}.</span>
              </div>
            </ng-template>
          </div>

          <!-- Transaction Movement History (For Movable Items) -->
          <div class="history-block" *ngIf="item.itemType === 'movable'">
            <h3 class="history-title">
              <mat-icon>history</mat-icon>
              Recent Stock Movement Ledger
            </h3>

            <table class="history-table" *ngIf="itemTransactions().length > 0; else noTxnTpl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Balance</th>
                  <th>Reference</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of itemTransactions()">
                  <td>{{ t.performedAt | date:'yyyy-MM-dd HH:mm' }}</td>
                  <td class="font-mono">{{ t.transactionNo }}</td>
                  <td>
                    <span class="type-pill" [ngClass]="t.transactionType.toLowerCase()">
                      {{ t.transactionType.replace('IN_', '+ ').replace('OUT_', '- ') }}
                    </span>
                  </td>
                  <td><strong>{{ t.quantity }}</strong></td>
                  <td><strong>{{ t.balanceQty }}</strong></td>
                  <td>{{ t.referenceNo || '—' }}</td>
                  <td>{{ t.performedBy }}</td>
                </tr>
              </tbody>
            </table>

            <ng-template #noTxnTpl>
              <div class="no-history-box">
                <mat-icon>receipt_long</mat-icon>
                <span>No stock transaction history recorded yet for this item.</span>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Document Sign-off Footer -->
        <div class="doc-footer">
          <div class="sign-column">
            <div class="sign-line"></div>
            <span class="sign-title">Store Officer / Custodian</span>
            <span class="sign-sub">Divisional Secretariat</span>
          </div>
          <div class="sign-column">
            <div class="sign-line"></div>
            <span class="sign-title">Divisional Secretary / Head</span>
            <span class="sign-sub">Official Stamp & Date</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .item-detail-modal {
      padding: 0;
      max-height: 90vh;
      overflow-y: auto;
      background: #f8fafc;
    }

    .modal-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 10;

      .top-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 15px;
        color: #0f172a;
        mat-icon { color: #4f46e5; }
      }

      .top-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .dossier-document {
      background: #ffffff;
      max-width: 800px;
      margin: 16px auto;
      padding: 30px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

      .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 16px;
        border-bottom: 2px solid #0f172a;
        margin-bottom: 20px;

        .doc-emblem {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 30px; width: 30px; height: 30px; color: #1e3a8a; }
        }

        .doc-org-info {
          text-align: center;
          flex: 1;
          padding: 0 16px;

          .org-title {
            font-size: 14px;
            font-weight: 800;
            margin: 0;
            color: #0f172a;
            letter-spacing: 0.04em;
          }

          .org-sub {
            font-size: 12px;
            font-weight: 600;
            margin: 2px 0 0 0;
            color: #475569;
          }

          .doc-type-title {
            font-size: 13px;
            font-weight: 800;
            margin: 6px 0 0 0;
            color: #4f46e5;
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
            margin-bottom: 3px;

            &:last-child { margin-bottom: 0; }

            .meta-lbl { color: #64748b; font-weight: 600; }
            .meta-val { font-weight: 700; color: #0f172a; }
            .highlight { color: #4f46e5; font-family: monospace; }
          }
        }
      }

      .status-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;

        &.active { background: #dcfce7; color: #15803d; }
        &.low-stock { background: #fef3c7; color: #b45309; }
        &.out-of-stock { background: #fee2e2; color: #b91c1c; }
        &.damaged { background: #fee2e2; color: #991b1b; }
        &.disposed { background: #f1f5f9; color: #475569; }
      }

      .item-specs-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;

        td {
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          font-size: 12.5px;
        }

        .lbl {
          width: 18%;
          background: #f8fafc;
          font-weight: 600;
          color: #475569;
        }

        .val {
          width: 32%;
          color: #0f172a;
        }

        .primary-bold {
          font-weight: 700;
          color: #1e3a8a;
        }

        .font-mono { font-family: monospace; }

        .stock-highlight {
          font-weight: 700;
          color: #166534;
        }

        .asset-highlight-tr {
          background: #fffbeb;
        }

        .condition-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;

          &.good { background: #dcfce7; color: #166534; }
          &.fair { background: #e0f2fe; color: #0369a1; }
          &.needs-repair { background: #fef3c7; color: #b45309; }
          &.damaged { background: #fee2e2; color: #b91c1c; }
          &.written-off, &.disposed { background: #f1f5f9; color: #475569; }
        }
      }

      .batches-block {
        margin-top: 24px;

        .batches-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;

          .history-title {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13.5px;
            font-weight: 800;
            color: #0f172a;
            mat-icon { font-size: 18px; width: 18px; height: 18px; color: #4f46e5; }
          }

          .total-valuation-badge {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 6px;
            padding: 4px 10px;
            display: flex;
            align-items: baseline;
            gap: 6px;

            .v-lbl { font-size: 11px; color: #065f46; font-weight: 600; }
            .v-val { font-size: 13.5px; font-weight: 800; color: #047857; }
          }
        }

        .batches-detail-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;

          th {
            background: #f8fafc;
            color: #64748b;
            font-weight: 700;
            text-align: left;
            padding: 6px 8px;
            border-bottom: 2px solid #e2e8f0;
          }

          td {
            padding: 6px 8px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            vertical-align: middle;

            &.val-col { font-weight: 700; color: #047857; }
          }

          tr.active-head {
            background: #f0fdf4;
          }

          tr.exhausted {
            opacity: 0.6;
            background: #f8fafc;
          }

          .batch-order-pill {
            display: inline-block;
            font-size: 9.5px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            background: #e2e8f0;
            color: #475569;

            &.first-pill {
              background: #dcfce7;
              color: #15803d;
              border: 1px solid #86efac;
            }
          }

          .sub-ref {
            font-size: 10px;
            color: #64748b;
            margin-left: 4px;
          }

          .text-success { color: #15803d; }

          .batch-status-chip {
            display: inline-block;
            font-size: 9.5px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;

            &.in-stock { background: #dcfce7; color: #166534; }
            &.depleted { background: #f1f5f9; color: #94a3b8; }
          }
        }

        .no-batches-box {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #1e40af;
          font-size: 11.5px;
          padding: 10px 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3b82f6; }
        }
      }

      .history-block {
        margin-top: 20px;
        border-top: 1px solid #e2e8f0;
        padding-top: 14px;

        .history-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 10px 0;
          mat-icon { font-size: 17px; width: 17px; height: 17px; color: #4f46e5; }
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;

          th, td {
            padding: 6px 8px;
            font-size: 11.5px;
            border-bottom: 1px solid #e2e8f0;
          }

          th {
            background: #f8fafc;
            color: #64748b;
            font-weight: 700;
            text-align: left;
          }

          .type-pill {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;

            &.in_purchase, &.in_adjustment { background: #dcfce7; color: #166534; }
            &.out_release { background: #e0f2fe; color: #0369a1; }
            &.out_damage, &.out_write_off { background: #fee2e2; color: #b91c1c; }
          }
        }

        .no-history-box {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 6px;
        }
      }

      .doc-footer {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        padding-top: 10px;

        .sign-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 200px;

          .sign-line {
            width: 100%;
            border-bottom: 1px solid #94a3b8;
            margin-bottom: 6px;
          }

          .sign-title {
            font-size: 11.5px;
            font-weight: 700;
            color: #0f172a;
          }

          .sign-sub {
            font-size: 10.5px;
            color: #64748b;
          }
        }
      }
    }

    @media print {
      .no-print { display: none !important; }
      .dossier-document {
        border: none;
        box-shadow: none;
        padding: 0;
        margin: 0;
      }
    }
  `]
})
export class ItemDetailDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<ItemDetailDialogComponent>);
  private inventoryService = inject(InventoryService);

  item!: InventoryItem;
  itemTransactions = signal<StockTransaction[]>([]);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { item: InventoryItem }) {
    this.item = data.item;
  }

  ngOnInit() {
    if (this.item.id && this.item.itemType === 'movable') {
      this.inventoryService.getTransactions().subscribe(txns => {
        const filtered = (txns || []).filter(t => t.itemId === this.item.id).slice(0, 10);
        this.itemTransactions.set(filtered);
      });
    }
  }

  getItemBatches(): InventoryBatch[] {
    return [...(this.item.batches || [])].sort((a, b) => (a.receivedAt || 0) - (b.receivedAt || 0));
  }

  getTotalValuation(): number {
    const active = (this.item.batches || []).filter(b => b.remainingQty > 0);
    if (active.length > 0) {
      return active.reduce((sum, b) => sum + (b.remainingQty * (b.unitCost || 0)), 0);
    }
    return (this.item.quantity || 0) * (this.item.unitCost || 0);
  }

  printDossier() {
    window.print();
  }
}
