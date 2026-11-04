import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { InventoryItem, StockTransactionType } from '../../models/inventory.model';

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
    MatIconModule
  ],
  template: `
    <div class="adjust-dialog-container">
      <div class="dialog-header">
        <div class="header-title-group">
          <mat-icon class="header-icon">tune</mat-icon>
          <div>
            <h2 class="dialog-title">Stock Adjustment & Replenishment</h2>
            <p class="dialog-subtitle">Record stock inflow, purchase receipts, or loss/damage adjustments</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Item Overview Card -->
      <div class="item-summary-card">
        <div class="sum-row">
          <div class="item-id-wrap">
            <span class="it-name">{{ item.name }}</span>
            <span class="it-code">{{ item.itemCode }} • {{ item.category }}</span>
          </div>
          <div class="current-stock-box">
            <span class="cs-lbl">Current On-Hand</span>
            <span class="cs-val">{{ item.quantity }} {{ item.unit }}</span>
          </div>
        </div>
      </div>

      <form [formGroup]="adjustForm" (ngSubmit)="onSubmit()" class="dialog-form">
        <div class="form-grid">
          <!-- Adjustment Type -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Adjustment Action</mat-label>
            <mat-select formControlName="transactionType" required>
              <mat-optgroup label="Stock Inflow (+)">
                <mat-option value="IN_PURCHASE">+ New Stock Purchase / GRN Inward</mat-option>
                <mat-option value="IN_ADJUSTMENT">+ Stock Count Found / Surplus</mat-option>
              </mat-optgroup>
              <mat-optgroup label="Stock Outflow (-)">
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

          <!-- Reference Number -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Reference No (Invoice, PO, Voucher, or Note)</mat-label>
            <input matInput formControlName="referenceNo" placeholder="e.g. GRN/2026/089">
            <mat-icon matPrefix>receipt</mat-icon>
          </mat-form-field>

          <!-- Resulting Balance Preview Card -->
          <div class="col-span-1 new-balance-preview">
            <span class="nb-lbl">Projected Balance After Adjustment</span>
            <span class="nb-val" [class.danger]="getProjectedBalance() < 0">
              {{ getProjectedBalance() }} {{ item.unit }}
            </span>
          </div>

          <!-- Reason / Notes -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Reason / Audit Explanation</mat-label>
            <input matInput formControlName="notes" placeholder="e.g. Purchased from Government Supplies Bureau under Voucher PV/2026/102" required>
            <mat-icon matPrefix>description</mat-icon>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button type="button" mat-button (click)="dialogRef.close()">Cancel</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="adjustForm.invalid || getProjectedBalance() < 0" class="submit-btn">
            <mat-icon>check</mat-icon>
            Apply Stock Adjustment
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .adjust-dialog-container {
      padding: 24px;
      max-width: 620px;
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

        .header-icon {
          font-size: 30px;
          width: 30px;
          height: 30px;
          color: #4f46e5;
        }

        .dialog-title {
          font-size: 18.5px;
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
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 18px;

      .sum-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .item-id-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .it-name { font-weight: 700; font-size: 14px; color: #0f172a; }
          .it-code { font-size: 11.5px; color: #64748b; font-family: monospace; }
        }

        .current-stock-box {
          text-align: right;
          .cs-lbl { font-size: 11px; color: #64748b; display: block; font-weight: 600; text-transform: uppercase; }
          .cs-val { font-size: 16px; font-weight: 800; color: #166534; }
        }
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      .col-span-1 { grid-column: span 1; }
      .col-span-2 { grid-column: span 2; }

      .unit-tag { font-size: 11.5px; color: #64748b; padding-right: 8px; font-weight: 600; }

      .new-balance-preview {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        justify-content: center;

        .nb-lbl { font-size: 11px; color: #166534; font-weight: 600; text-transform: uppercase; }
        .nb-val {
          font-size: 16px;
          font-weight: 800;
          color: #15803d;
          &.danger { color: #dc2626; }
        }
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
      padding-top: 14px;
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

  constructor(@Inject(MAT_DIALOG_DATA) public data: { item: InventoryItem }) {
    this.item = data.item;
  }

  ngOnInit() {
    this.adjustForm = this.fb.group({
      transactionType: ['IN_PURCHASE' as StockTransactionType, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      referenceNo: [''],
      notes: ['', Validators.required]
    });
  }

  getProjectedBalance(): number {
    const cur = this.item.quantity || 0;
    const type = this.adjustForm?.get('transactionType')?.value as StockTransactionType;
    const change = Math.abs(parseInt(this.adjustForm?.get('quantity')?.value, 10) || 0);

    if (type?.startsWith('IN_')) {
      return cur + change;
    } else {
      return cur - change;
    }
  }

  onSubmit() {
    if (this.adjustForm.invalid || this.getProjectedBalance() < 0) return;

    const val = this.adjustForm.value;
    this.dialogRef.close({
      item: this.item,
      quantityChange: parseInt(val.quantity, 10),
      transactionType: val.transactionType,
      notes: val.notes,
      referenceNo: val.referenceNo
    });
  }
}
