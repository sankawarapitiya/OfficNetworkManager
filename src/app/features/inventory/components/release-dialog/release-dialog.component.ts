import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { InventoryRequest, InventoryItem } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';

@Component({
  selector: 'app-release-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="release-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title-group">
          <mat-icon class="header-icon">storefront</mat-icon>
          <div>
            <h2 class="dialog-title">Review & Dispatch Requisition</h2>
            <p class="dialog-subtitle">Verify stock on hand and release items for requisition <strong>{{ request.requestNo }}</strong></p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Requisition Summary Banner -->
      <div class="req-summary-card">
        <div class="sum-row">
          <div class="sum-item">
            <span class="sum-lbl">Requester:</span>
            <span class="sum-val primary-bold">{{ request.requesterName }}</span>
          </div>
          <div class="sum-item">
            <span class="sum-lbl">Division:</span>
            <span class="sum-val">{{ request.division }}</span>
          </div>
          <div class="sum-item">
            <span class="sum-lbl">Required Date:</span>
            <span class="sum-val">{{ request.requestDate }}</span>
          </div>
          <div class="sum-item">
            <span class="sum-lbl">Urgency:</span>
            <span class="urgency-pill" [ngClass]="request.urgency.toLowerCase()">{{ request.urgency }}</span>
          </div>
        </div>
        <div class="sum-purpose">
          <mat-icon class="purpose-icon">info</mat-icon>
          <span><strong>Purpose:</strong> {{ request.purpose }}</span>
        </div>
      </div>

      <form [formGroup]="releaseForm" (ngSubmit)="onReleaseSubmit()" class="dialog-form">
        <!-- Requested Items Release Table -->
        <div class="table-card">
          <div class="table-header-title">
            <mat-icon>inventory</mat-icon>
            <span>Items to Dispatch ({{ request.items.length }})</span>
          </div>

          <table class="release-items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th class="text-center">Current Stock</th>
                <th class="text-center">Requested Qty</th>
                <th style="width: 140px;">Release Qty</th>
                <th>Status Check</th>
              </tr>
            </thead>
            <tbody [formArrayName]="'lines'">
              <tr *ngFor="let line of linesArray.controls; let i = index" [formGroupName]="i">
                <td class="col-idx">{{ i + 1 }}</td>
                <td class="col-item-name">
                  <div class="item-name-wrap">
                    <span class="it-title">{{ request.items[i].itemName }}</span>
                    <span class="it-code">{{ request.items[i].itemCode }}</span>
                  </div>
                </td>
                <td class="text-center">
                  <span class="stock-badge" [ngClass]="getStockBadgeClass(request.items[i].itemId)">
                    {{ getAvailableStock(request.items[i].itemId) }} {{ request.items[i].unit }}
                  </span>
                </td>
                <td class="text-center">
                  <strong class="req-qty-num">{{ request.items[i].requestedQty }} {{ request.items[i].unit }}</strong>
                </td>
                <td>
                  <mat-form-field appearance="outline" class="qty-field" subscriptSizing="dynamic">
                    <input matInput type="number" formControlName="releasedQty" min="0" [max]="getAvailableStock(request.items[i].itemId)">
                    <span matSuffix class="suffix-text">{{ request.items[i].unit }}</span>
                  </mat-form-field>
                </td>
                <td>
                  <span class="status-indicator" *ngIf="line.get('releasedQty')?.value === request.items[i].requestedQty" style="color: #16a34a;">
                    <mat-icon class="status-icon">check_circle</mat-icon> Full
                  </span>
                  <span class="status-indicator" *ngIf="line.get('releasedQty')?.value > 0 && line.get('releasedQty')?.value < request.items[i].requestedQty" style="color: #d97706;">
                    <mat-icon class="status-icon">timelapse</mat-icon> Partial
                  </span>
                  <span class="status-indicator" *ngIf="line.get('releasedQty')?.value === 0" style="color: #dc2626;">
                    <mat-icon class="status-icon">cancel</mat-icon> None
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Release Metadata & Recipient Sign-off -->
        <div class="meta-inputs-grid">
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Received By / Collector Name</mat-label>
            <input matInput formControlName="receivedBy" placeholder="Officer collecting items" required>
            <mat-icon matPrefix>badge</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Store Release Remarks</mat-label>
            <input matInput formControlName="remarks" placeholder="Batch details, condition on issue, or reason for partial release">
            <mat-icon matPrefix>notes</mat-icon>
          </mat-form-field>
        </div>

        <!-- Reject Section Trigger (If store manager cannot release) -->
        <div class="reject-box" *ngIf="showRejectSection">
          <div class="reject-header">
            <mat-icon color="warn">warning</mat-icon>
            <span>Specify Rejection Reason</span>
          </div>
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Reason for rejecting requisition</mat-label>
            <input matInput [(ngModel)]="rejectionReasonText" [ngModelOptions]="{standalone: true}" placeholder="e.g. Out of stock with supplier, Insufficient allocation, Duplicate request">
          </mat-form-field>
          <div class="reject-actions">
            <button type="button" mat-button (click)="showRejectSection = false">Back</button>
            <button type="button" mat-flat-button color="warn" [disabled]="!rejectionReasonText.trim()" (click)="confirmReject()">
              <mat-icon>block</mat-icon> Confirm Rejection
            </button>
          </div>
        </div>

        <!-- Dialog Action Buttons -->
        <div class="dialog-actions" *ngIf="!showRejectSection">
          <button type="button" mat-button color="warn" (click)="showRejectSection = true">
            <mat-icon>close</mat-icon> Reject Request
          </button>
          <span class="spacer"></span>
          <button type="button" mat-button (click)="dialogRef.close()">Cancel</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="releaseForm.invalid || !hasAnyReleaseQty()" class="submit-btn">
            <mat-icon>send</mat-icon>
            Confirm & Issue Stock
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .release-dialog-container {
      padding: 24px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid #e2e8f0;

      .header-title-group {
        display: flex;
        align-items: center;
        gap: 12px;

        .header-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: #059669;
        }

        .dialog-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .dialog-subtitle {
          font-size: 12.5px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
      }

      .close-btn { color: #94a3b8; }
    }

    .req-summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;

      .sum-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;

        .sum-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;

          .sum-lbl { color: #64748b; font-weight: 600; }
          .sum-val { color: #0f172a; }
          .primary-bold { font-weight: 700; color: #1e40af; }
        }

        .urgency-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          text-transform: uppercase;

          &.low { background: #f1f5f9; color: #475569; }
          &.normal { background: #e0f2fe; color: #0369a1; }
          &.high { background: #fef3c7; color: #b45309; }
          &.urgent { background: #fee2e2; color: #b91c1c; }
        }
      }

      .sum-purpose {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #e2e8f0;
        font-size: 12.5px;
        color: #334155;

        .purpose-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
      }
    }

    .table-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 18px;

      .table-header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f1f5f9;
        padding: 8px 12px;
        font-size: 12.5px;
        font-weight: 700;
        color: #334155;
        border-bottom: 1px solid #cbd5e1;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #4f46e5; }
      }

      .release-items-table {
        width: 100%;
        border-collapse: collapse;

        th, td {
          padding: 10px 12px;
          font-size: 13px;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          font-size: 11.5px;
          text-transform: uppercase;
        }

        .text-center { text-align: center; }

        .col-idx { color: #94a3b8; font-weight: 600; width: 30px; }

        .col-item-name {
          .item-name-wrap {
            display: flex;
            flex-direction: column;
            gap: 2px;
            .it-title { font-weight: 700; color: #0f172a; }
            .it-code { font-size: 11px; font-family: monospace; color: #64748b; }
          }
        }

        .stock-badge {
          display: inline-block;
          font-size: 11.5px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;

          &.in-stock { background: #dcfce7; color: #166534; }
          &.low-stock { background: #fef3c7; color: #92400e; }
          &.out-of-stock { background: #fee2e2; color: #991b1b; }
        }

        .req-qty-num {
          font-size: 13.5px;
          color: #0f172a;
        }

        .qty-field {
          width: 100%;
          .suffix-text { font-size: 11px; color: #64748b; font-weight: 600; padding-right: 6px; }
        }

        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
          .status-icon { font-size: 15px; width: 15px; height: 15px; }
        }
      }
    }

    .meta-inputs-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 12px;
      margin-bottom: 16px;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .reject-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 14px;
      margin-top: 14px;

      .reject-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 13px;
        color: #991b1b;
        margin-bottom: 10px;
      }

      .reject-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;

      .spacer { flex: 1; }

      .submit-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        height: 40px;
        padding: 0 18px;
        background: #059669;
      }
    }
  `]
})
export class ReleaseDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<ReleaseDialogComponent>);
  private fb = inject(FormBuilder);
  private inventoryService = inject(InventoryService);

  request!: InventoryRequest;
  releaseForm!: FormGroup;
  currentItemsMap = signal<Map<string, InventoryItem>>(new Map());

  showRejectSection = false;
  rejectionReasonText = '';

  get linesArray(): FormArray {
    return this.releaseForm.get('lines') as FormArray;
  }

  constructor(@Inject(MAT_DIALOG_DATA) public data: { request: InventoryRequest }) {
    this.request = data.request;
  }

  ngOnInit() {
    this.initForm();
    this.loadCurrentItems();
  }

  private initForm() {
    const linesFormArray = this.fb.array<FormGroup>([]);

    this.request.items.forEach(it => {
      linesFormArray.push(this.fb.group({
        itemId: [it.itemId, Validators.required],
        releasedQty: [it.requestedQty, [Validators.required, Validators.min(0)]]
      }));
    });

    this.releaseForm = this.fb.group({
      lines: linesFormArray,
      receivedBy: [this.request.requesterName, Validators.required],
      remarks: ['']
    });
  }

  private loadCurrentItems() {
    this.inventoryService.getItems().subscribe(items => {
      const map = new Map<string, InventoryItem>();
      items.forEach(i => {
        if (i.id) map.set(i.id, i);
      });
      this.currentItemsMap.set(map);

      // Auto-cap releasedQty to available stock if requested > stock
      this.linesArray.controls.forEach((ctrl, idx) => {
        const itemLine = this.request.items[idx];
        const stock = map.get(itemLine.itemId)?.quantity ?? 0;
        const currentRel = ctrl.get('releasedQty')?.value;
        if (currentRel > stock) {
          ctrl.patchValue({ releasedQty: stock });
        }
      });
    });
  }

  getAvailableStock(itemId: string): number {
    return this.currentItemsMap().get(itemId)?.quantity ?? 0;
  }

  getStockBadgeClass(itemId: string): string {
    const s = this.getAvailableStock(itemId);
    if (s <= 0) return 'out-of-stock';
    if (s <= 10) return 'low-stock';
    return 'in-stock';
  }

  hasAnyReleaseQty(): boolean {
    return this.linesArray.controls.some(ctrl => (ctrl.get('releasedQty')?.value || 0) > 0);
  }

  onReleaseSubmit() {
    if (this.releaseForm.invalid || !this.hasAnyReleaseQty()) return;

    const val = this.releaseForm.value;
    const releaseLines = val.lines.map((l: any) => ({
      itemId: l.itemId,
      releasedQty: parseInt(l.releasedQty, 10) || 0
    }));

    this.dialogRef.close({
      action: 'RELEASE',
      releaseLines,
      currentItemsMap: this.currentItemsMap(),
      remarks: val.remarks,
      receivedBy: val.receivedBy
    });
  }

  confirmReject() {
    if (!this.rejectionReasonText.trim()) return;
    this.dialogRef.close({
      action: 'REJECT',
      reason: this.rejectionReasonText.trim()
    });
  }
}
