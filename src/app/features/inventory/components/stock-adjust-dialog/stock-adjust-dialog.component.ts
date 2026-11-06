import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

import { InventoryItem, InventoryBatch, StockTransactionType } from '../../models/inventory.model';

@Component({
  selector: 'app-stock-adjust-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatChipsModule
  ],
  template: `
    <div class="adjust-dialog-container">
      <div class="dialog-header">
        <div class="header-title-group">
          <div class="header-icon-box">
            <mat-icon>tune</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Stock Adjustment & Replenishment</h2>
            <p class="dialog-subtitle">First-In, First-Out (FIFO) batch tracking & pricing adjustment</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Item Overview & Financial Summary Card -->
      <div class="item-summary-card">
        <div class="sum-row">
          <div class="item-id-wrap">
            <span class="it-name">{{ item.name }}</span>
            <span class="it-code">{{ item.itemCode }} • {{ item.category }} • {{ item.location }}</span>
          </div>
          <div class="stock-financials">
            <div class="stat-pill">
              <span class="cs-lbl">On-Hand Stock</span>
              <span class="cs-val">{{ item.quantity }} {{ item.unit }}</span>
            </div>
            <div class="stat-pill">
              <span class="cs-lbl">Current Reference Cost</span>
              <span class="cs-val font-mono">LKR {{ (item.unitCost || 0) | number:'1.2-2' }}</span>
            </div>
            <div class="stat-pill highlight">
              <span class="cs-lbl">Current Stock Valuation</span>
              <span class="cs-val font-mono">LKR {{ getTotalValuation() | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>
      </div>

      <form [formGroup]="adjustForm" (ngSubmit)="onSubmit()" class="dialog-form">
        <!-- Action & Quantity -->
        <div class="form-grid">
          <!-- Adjustment Type -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Adjustment Action</mat-label>
            <mat-select formControlName="transactionType" required (selectionChange)="onTypeChange()">
              <mat-optgroup label="Stock Inflow (+) [New FIFO Batch]">
                <mat-option value="IN_PURCHASE">+ New Stock Purchase / GRN Inward</mat-option>
                <mat-option value="IN_ADJUSTMENT">+ Stock Count Found / Surplus Inward</mat-option>
              </mat-optgroup>
              <mat-optgroup label="Stock Outflow (-) [FIFO Depletion]">
                <mat-option value="OUT_DAMAGE">- Damaged / Broken in Storage</mat-option>
                <mat-option value="OUT_WRITE_OFF">- Expired / Obsolete Write-Off</mat-option>
              </mat-optgroup>
            </mat-select>
            <mat-icon matPrefix>sync_alt</mat-icon>
          </mat-form-field>

          <!-- Quantity to Adjust -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Quantity to Adjust</mat-label>
            <input matInput type="number" formControlName="quantity" min="1" step="1" placeholder="1" required>
            <span matSuffix class="unit-tag">{{ item.unit }}</span>
            <mat-icon matPrefix>calculate</mat-icon>
          </mat-form-field>
        </div>

        <!-- ================= INWARD STOCK: NEW ITEM PRICE & VALUATION ================= -->
        <div class="inward-pricing-panel" *ngIf="isInflow()">
          <div class="panel-header">
            <div class="title-with-icon">
              <mat-icon class="panel-icon">payments</mat-icon>
              <div>
                <span class="panel-title">Replenishment Price & FIFO Batch Creation</span>
                <span class="panel-sub">Creates a new batch at this unit price. Sets new reference cost for the item.</span>
              </div>
            </div>
            <div class="fifo-badge">
              <mat-icon>all_inclusive</mat-icon>
              <span>FIFO Enabled</span>
            </div>
          </div>

          <div class="pricing-grid">
            <!-- New Unit Price -->
            <mat-form-field appearance="outline" class="price-input">
              <mat-label>New Item Unit Price (LKR)</mat-label>
              <input matInput type="number" formControlName="unitCost" min="0" step="0.01" placeholder="0.00" required>
              <span matPrefix class="currency-prefix">LKR&nbsp;</span>
              <mat-hint>Current reference cost: LKR {{ (item.unitCost || 0) | number:'1.2-2' }}</mat-hint>
            </mat-form-field>

            <!-- Live Batch Inflow Valuation Card -->
            <div class="inflow-calc-card">
              <div class="calc-row">
                <span class="calc-lbl">Incoming Batch Valuation:</span>
                <span class="calc-val font-mono">
                  LKR {{ getInflowValuation() | number:'1.2-2' }}
                </span>
              </div>
              <div class="calc-formula">
                {{ adjustForm.get('quantity')?.value || 0 }} {{ item.unit }} &times; LKR {{ (adjustForm.get('unitCost')?.value || 0) | number:'1.2-2' }}
              </div>
              <!-- Price Variance Indicator -->
              <div class="price-variance" [ngClass]="getPriceVariance().type" *ngIf="adjustForm.get('unitCost')?.value">
                <mat-icon class="var-icon">{{ getPriceVariance().icon }}</mat-icon>
                <span>{{ getPriceVariance().label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= OUTWARD STOCK: FIFO SIMULATOR PREVIEW ================= -->
        <div class="outward-fifo-panel" *ngIf="!isInflow()">
          <div class="panel-header">
            <div class="title-with-icon">
              <mat-icon class="panel-icon danger">layers_clear</mat-icon>
              <div>
                <span class="panel-title">First-In, First-Out (FIFO) Deduction Simulator</span>
                <span class="panel-sub">Stock is automatically consumed from the oldest available batches first</span>
              </div>
            </div>
          </div>

          <!-- Dynamic Breakdown of Consumed Batches -->
          <div class="fifo-simulation-box">
            <div class="sim-header">
              <span>FIFO Batch Depletion Plan:</span>
              <strong class="total-outflow-cost font-mono">
                Est. Write-off Value: LKR {{ getSimulatedOutflowValuation() | number:'1.2-2' }}
              </strong>
            </div>

            <div class="depletion-lines" *ngIf="getSimulatedOutflow().length > 0; else noDeductTpl">
              <div class="depletion-line" *ngFor="let line of getSimulatedOutflow(); let i = index">
                <div class="line-badge font-mono">#{{ i + 1 }}</div>
                <div class="line-batch">
                  <strong>{{ line.batchNo }}</strong>
                  <span class="sub-date" *ngIf="line.receivedDate">({{ line.receivedDate }})</span>
                </div>
                <div class="line-qty">
                  Deducting <strong>{{ line.qty }} {{ item.unit }}</strong>
                </div>
                <div class="line-rate font-mono">&#64; LKR {{ line.unitCost | number:'1.2-2' }}</div>
                <div class="line-total font-mono">LKR {{ line.cost | number:'1.2-2' }}</div>
              </div>
            </div>

            <ng-template #noDeductTpl>
              <div class="empty-sim-msg">
                Enter quantity to simulate FIFO batch deduction.
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Reference & Balance Row -->
        <div class="form-grid mt-2">
          <!-- Reference Number -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Reference No (GRN, Invoice, PO, or Note)</mat-label>
            <input matInput formControlName="referenceNo" placeholder="e.g. GRN/2026/089 or INV-8429">
            <mat-icon matPrefix>receipt</mat-icon>
            <mat-hint>Assigned to this FIFO batch for auditing</mat-hint>
          </mat-form-field>

          <!-- Projected Balance Preview -->
          <div class="col-span-1 new-balance-preview">
            <span class="nb-lbl">Projected Balance After Adjustment</span>
            <div class="nb-row">
              <span class="nb-val" [class.danger]="getProjectedBalance() < 0">
                {{ getProjectedBalance() }} {{ item.unit }}
              </span>
              <span class="nb-change" [class.pos]="isInflow()" [class.neg]="!isInflow()">
                ({{ isInflow() ? '+' : '-' }}{{ adjustForm.get('quantity')?.value || 0 }})
              </span>
            </div>
            <span class="nb-sub" *ngIf="getProjectedBalance() < 0">
              <mat-icon class="err-icon">error</mat-icon> Cannot deduct more than available on-hand stock!
            </span>
          </div>

          <!-- Reason / Notes -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Reason / Audit Explanation</mat-label>
            <input matInput formControlName="notes" placeholder="e.g. Received new stock shipment from Government Supplies Bureau" required>
            <mat-icon matPrefix>description</mat-icon>
          </mat-form-field>
        </div>

        <!-- ================= ACTIVE FIFO BATCHES QUEUE ACCORDION ================= -->
        <div class="active-batches-card">
          <div class="batches-header" (click)="toggleBatchesView()">
            <div class="bh-left">
              <mat-icon class="bh-icon">inventory</mat-icon>
              <div>
                <span class="bh-title">Active FIFO Batches In Stock ({{ getActiveBatches().length }})</span>
                <span class="bh-sub">Priority queue for store releases and stock write-offs</span>
              </div>
            </div>
            <div class="bh-right">
              <span class="queue-valuation font-mono">Valuation: LKR {{ getTotalValuation() | number:'1.2-2' }}</span>
              <mat-icon class="expand-icon">{{ showBatchesQueue() ? 'expand_less' : 'expand_more' }}</mat-icon>
            </div>
          </div>

          <div class="batches-body" *ngIf="showBatchesQueue()">
            <div *ngIf="getActiveBatches().length > 0; else noBatchesTpl">
              <table class="batches-table">
                <thead>
                  <tr>
                    <th>FIFO Priority</th>
                    <th>Batch / Ref</th>
                    <th>Received Date</th>
                    <th class="text-right">Available Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Remaining Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let b of getActiveBatches(); let i = index" [class.next-out]="i === 0">
                    <td>
                      <span class="priority-pill" [class.first-pill]="i === 0">
                        {{ i === 0 ? 'Next to Release (#1)' : '#' + (i + 1) + ' In Queue' }}
                      </span>
                    </td>
                    <td>
                      <strong class="font-mono">{{ b.batchNo }}</strong>
                      <span class="batch-ref" *ngIf="b.referenceNo && b.referenceNo !== b.batchNo">({{ b.referenceNo }})</span>
                    </td>
                    <td>{{ b.receivedDate || '—' }}</td>
                    <td class="text-right">
                      <strong>{{ b.remainingQty }}</strong> / {{ b.initialQty }} {{ item.unit }}
                    </td>
                    <td class="text-right font-mono">LKR {{ b.unitCost | number:'1.2-2' }}</td>
                    <td class="text-right font-mono highlight-cost">
                      LKR {{ (b.remainingQty * b.unitCost) | number:'1.2-2' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <ng-template #noBatchesTpl>
              <div class="unbatched-notice">
                <mat-icon>info</mat-icon>
                <div>
                  <strong>No tracked FIFO batches recorded yet for this item.</strong>
                  <p>Current stock is {{ item.quantity }} {{ item.unit }} &#64; reference price LKR {{ (item.unitCost || 0) | number:'1.2-2' }}. Recording an inward adjustment will initialize automated batch tracking.</p>
                </div>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Dialog Footer Actions -->
        <div class="dialog-actions">
          <button type="button" mat-button (click)="dialogRef.close()">Cancel</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="adjustForm.invalid || getProjectedBalance() < 0" class="submit-btn">
            <mat-icon>check_circle</mat-icon>
            Apply Adjustment & Update FIFO
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .adjust-dialog-container {
      padding: 24px;
      max-width: 680px;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;

      .header-title-group {
        display: flex;
        align-items: center;
        gap: 12px;

        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #eef2ff;
          color: #4f46e5;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .dialog-title {
          font-size: 19px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .dialog-subtitle {
          font-size: 12px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
      }

      .close-btn { color: #94a3b8; }
    }

    .item-summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;

      .sum-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;

        .item-id-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .it-name { font-weight: 800; font-size: 14.5px; color: #0f172a; }
          .it-code { font-size: 11.5px; color: #64748b; }
        }

        .stock-financials {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;

          .stat-pill {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 6px 10px;
            text-align: right;

            .cs-lbl { font-size: 10px; color: #64748b; display: block; font-weight: 700; text-transform: uppercase; }
            .cs-val { font-size: 13.5px; font-weight: 800; color: #1e293b; }

            &.highlight {
              background: #ecfdf5;
              border-color: #a7f3d0;
              .cs-lbl { color: #065f46; }
              .cs-val { color: #047857; }
            }
          }
        }
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      .col-span-1 { grid-column: span 1; }
      .col-span-2 { grid-column: span 2; }
      &.mt-2 { margin-top: 10px; }
    }

    .unit-tag { font-size: 12px; color: #64748b; padding-right: 8px; font-weight: 600; }
    .currency-prefix { font-size: 12.5px; font-weight: 700; color: #64748b; margin-right: 4px; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

    /* Inward Stock Replenishment Panel */
    .inward-pricing-panel {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 14px 16px;
      margin-top: 6px;
      margin-bottom: 6px;

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .title-with-icon {
          display: flex;
          align-items: center;
          gap: 10px;

          .panel-icon {
            color: #16a34a;
            font-size: 24px;
            width: 24px;
            height: 24px;
          }

          .panel-title {
            font-size: 13px;
            font-weight: 800;
            color: #166534;
            display: block;
          }

          .panel-sub {
            font-size: 11px;
            color: #15803d;
            display: block;
          }
        }

        .fifo-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #dcfce7;
          border: 1px solid #86efac;
          color: #15803d;
          border-radius: 20px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 700;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }

      .pricing-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        align-items: start;

        .price-input {
          width: 100%;
        }

        .inflow-calc-card {
          background: #ffffff;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 10px 12px;

          .calc-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            .calc-lbl { font-size: 11px; color: #374151; font-weight: 700; }
            .calc-val { font-size: 15px; font-weight: 800; color: #15803d; }
          }

          .calc-formula {
            font-size: 11px;
            color: #6b7280;
            margin-top: 2px;
          }

          .price-variance {
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 700;

            .var-icon { font-size: 14px; width: 14px; height: 14px; }

            &.increase {
              color: #b45309;
            }
            &.decrease {
              color: #2563eb;
            }
            &.equal {
              color: #4b5563;
            }
          }
        }
      }
    }

    /* Outward Stock FIFO Simulator Panel */
    .outward-fifo-panel {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 10px;
      padding: 14px 16px;
      margin-top: 6px;
      margin-bottom: 6px;

      .panel-header {
        margin-bottom: 10px;
        .title-with-icon {
          display: flex;
          align-items: center;
          gap: 10px;
          .panel-icon.danger { color: #e11d48; }
          .panel-title { font-size: 13px; font-weight: 800; color: #9f1239; display: block; }
          .panel-sub { font-size: 11px; color: #be123c; display: block; }
        }
      }

      .fifo-simulation-box {
        background: #ffffff;
        border: 1px solid #f43f5e;
        border-radius: 8px;
        padding: 10px 12px;

        .sim-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 11.5px;
          font-weight: 700;
          color: #881337;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px dashed #fecdd3;
          .total-outflow-cost { font-size: 13.5px; color: #e11d48; }
        }

        .depletion-lines {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .depletion-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11.5px;
            background: #fff1f2;
            padding: 5px 8px;
            border-radius: 6px;

            .line-badge {
              background: #e11d48;
              color: #ffffff;
              font-size: 10px;
              font-weight: 800;
              padding: 2px 6px;
              border-radius: 4px;
            }

            .line-batch {
              flex: 1;
              margin-left: 8px;
              color: #0f172a;
              .sub-date { color: #64748b; font-size: 10.5px; margin-left: 4px; }
            }

            .line-qty { color: #881337; font-weight: 600; margin-right: 8px; }
            .line-rate { color: #64748b; margin-right: 8px; font-size: 11px; }
            .line-total { font-weight: 800; color: #be123c; }
          }
        }

        .empty-sim-msg {
          font-size: 11.5px;
          color: #94a3b8;
          font-style: italic;
          text-align: center;
          padding: 8px;
        }
      }
    }

    /* Projected Balance Card */
    .new-balance-preview {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;

      .nb-lbl { font-size: 10.5px; color: #475569; font-weight: 700; text-transform: uppercase; }
      .nb-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
        .nb-val {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          &.danger { color: #dc2626; }
        }
        .nb-change {
          font-size: 12px;
          font-weight: 700;
          &.pos { color: #16a34a; }
          &.neg { color: #dc2626; }
        }
      }

      .nb-sub {
        font-size: 10.5px;
        color: #dc2626;
        display: flex;
        align-items: center;
        gap: 3px;
        margin-top: 2px;
        font-weight: 600;
        .err-icon { font-size: 13px; width: 13px; height: 13px; }
      }
    }

    /* Active Batches Queue Card */
    .active-batches-card {
      margin-top: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      overflow: hidden;

      .batches-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: #f8fafc;
        cursor: pointer;
        user-select: none;
        border-bottom: 1px solid #e2e8f0;

        &:hover {
          background: #f1f5f9;
        }

        .bh-left {
          display: flex;
          align-items: center;
          gap: 8px;
          .bh-icon { color: #4f46e5; font-size: 20px; width: 20px; height: 20px; }
          .bh-title { font-size: 12.5px; font-weight: 800; color: #1e293b; display: block; }
          .bh-sub { font-size: 10.5px; color: #64748b; display: block; }
        }

        .bh-right {
          display: flex;
          align-items: center;
          gap: 10px;
          .queue-valuation { font-size: 12px; font-weight: 700; color: #047857; }
          .expand-icon { color: #64748b; }
        }
      }

      .batches-body {
        padding: 10px 14px;
        max-height: 220px;
        overflow-y: auto;

        .batches-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;

          th {
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            padding: 4px 6px 6px 6px;
            border-bottom: 1px solid #e2e8f0;
            &.text-right { text-align: right; }
          }

          td {
            padding: 6px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            &.text-right { text-align: right; }
            &.highlight-cost { font-weight: 700; color: #047857; }
          }

          tr.next-out {
            background: #f0fdf4;
          }

          .priority-pill {
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

          .batch-ref {
            font-size: 10px;
            color: #64748b;
            margin-left: 4px;
          }
        }

        .unbatched-notice {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 8px 12px;
          color: #1e40af;
          font-size: 11.5px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; color: #3b82f6; flex-shrink: 0; }
          p { margin: 2px 0 0 0; font-size: 11px; color: #1d4ed8; }
        }
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;

      .submit-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        height: 38px;
        padding: 0 16px;
      }
    }
  `]
})
export class StockAdjustDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<StockAdjustDialogComponent>);
  private fb = inject(FormBuilder);

  item!: InventoryItem;
  adjustForm!: FormGroup;
  showBatchesQueue = signal<boolean>(false);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { item: InventoryItem }) {
    this.item = data.item;
  }

  ngOnInit() {
    const currentPrice = this.item.unitCost !== undefined && this.item.unitCost !== null 
      ? this.item.unitCost 
      : 0;

    this.adjustForm = this.fb.group({
      transactionType: ['IN_PURCHASE' as StockTransactionType, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitCost: [currentPrice, [Validators.required, Validators.min(0)]],
      referenceNo: [''],
      notes: ['', Validators.required]
    });

    // Auto-expand batches queue if item already has active batches
    if (this.getActiveBatches().length > 0) {
      this.showBatchesQueue.set(true);
    }
  }

  isInflow(): boolean {
    const type = this.adjustForm?.get('transactionType')?.value as string;
    return !!type && type.startsWith('IN_');
  }

  onTypeChange() {
    if (this.isInflow()) {
      this.adjustForm.get('unitCost')?.setValidators([Validators.required, Validators.min(0)]);
    } else {
      this.adjustForm.get('unitCost')?.clearValidators();
    }
    this.adjustForm.get('unitCost')?.updateValueAndValidity();
  }

  toggleBatchesView() {
    this.showBatchesQueue.set(!this.showBatchesQueue());
  }

  getActiveBatches(): InventoryBatch[] {
    const batches = (this.item.batches || []).filter(b => b.remainingQty > 0);
    // Sort oldest first (FIFO order)
    return batches.sort((a, b) => (a.receivedAt || 0) - (b.receivedAt || 0));
  }

  getTotalValuation(): number {
    const active = this.getActiveBatches();
    if (active.length > 0) {
      return active.reduce((sum, b) => sum + (b.remainingQty * (b.unitCost || 0)), 0);
    }
    return (this.item.quantity || 0) * (this.item.unitCost || 0);
  }

  getInflowValuation(): number {
    const qty = Math.abs(parseInt(this.adjustForm?.get('quantity')?.value, 10) || 0);
    const unitPrice = parseFloat(this.adjustForm?.get('unitCost')?.value) || 0;
    return qty * unitPrice;
  }

  getPriceVariance(): { label: string; icon: string; type: 'increase' | 'decrease' | 'equal' } {
    const current = this.item.unitCost || 0;
    const entered = parseFloat(this.adjustForm?.get('unitCost')?.value) || 0;
    if (current === 0) {
      return { label: 'New Price Set', icon: 'payments', type: 'equal' };
    }
    const diff = entered - current;
    if (Math.abs(diff) < 0.01) {
      return { label: 'Same as current price', icon: 'check', type: 'equal' };
    }
    const pct = ((diff / current) * 100).toFixed(1);
    if (diff > 0) {
      return { label: `+LKR ${diff.toFixed(2)} (+${pct}%) from current`, icon: 'trending_up', type: 'increase' };
    } else {
      return { label: `-LKR ${Math.abs(diff).toFixed(2)} (${pct}%) from current`, icon: 'trending_down', type: 'decrease' };
    }
  }

  getSimulatedOutflow(): { batchNo: string; receivedDate?: string; qty: number; unitCost: number; cost: number }[] {
    const qty = Math.abs(parseInt(this.adjustForm?.get('quantity')?.value, 10) || 0);
    if (qty <= 0) return [];

    let remaining = qty;
    const result: { batchNo: string; receivedDate?: string; qty: number; unitCost: number; cost: number }[] = [];
    const active = this.getActiveBatches();

    for (const b of active) {
      if (remaining <= 0) break;
      const take = Math.min(b.remainingQty, remaining);
      result.push({
        batchNo: b.batchNo,
        receivedDate: b.receivedDate,
        qty: take,
        unitCost: b.unitCost || 0,
        cost: take * (b.unitCost || 0)
      });
      remaining -= take;
    }

    if (remaining > 0) {
      const fallbackCost = this.item.unitCost || 0;
      result.push({
        batchNo: 'Legacy Stock (Unbatched)',
        qty: remaining,
        unitCost: fallbackCost,
        cost: remaining * fallbackCost
      });
    }

    return result;
  }

  getSimulatedOutflowValuation(): number {
    return this.getSimulatedOutflow().reduce((sum, item) => sum + item.cost, 0);
  }

  getProjectedBalance(): number {
    const cur = this.item.quantity || 0;
    const change = Math.abs(parseInt(this.adjustForm?.get('quantity')?.value, 10) || 0);

    if (this.isInflow()) {
      return cur + change;
    } else {
      return cur - change;
    }
  }

  onSubmit() {
    if (this.adjustForm.invalid || this.getProjectedBalance() < 0) return;

    const val = this.adjustForm.value;
    const isIncoming = this.isInflow();
    const unitCost = isIncoming && val.unitCost !== null && val.unitCost !== undefined
      ? parseFloat(val.unitCost)
      : (this.item.unitCost || 0);

    this.dialogRef.close({
      item: this.item,
      quantityChange: parseInt(val.quantity, 10),
      transactionType: val.transactionType,
      notes: val.notes,
      referenceNo: val.referenceNo,
      unitCost: unitCost
    });
  }
}
