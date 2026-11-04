import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { InventoryItem, InventoryRequest, InventoryRequestItem, InventoryRequestUrgency } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../../../auth/auth.service';
import { SettingsService, Division } from '../../../settings/settings.service';

@Component({
  selector: 'app-request-dialog',
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
    MatTooltipModule
  ],
  template: `
    <div class="request-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title-group">
          <mat-icon class="header-icon">shopping_bag</mat-icon>
          <div>
            <h2 class="dialog-title">Submit Store Requisition</h2>
            <p class="dialog-subtitle">Request consumable store items and office stationery from the central store</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="requestForm" (ngSubmit)="onSubmit()" class="dialog-form">
        <!-- Requester & Vitals Grid -->
        <div class="vitals-card">
          <div class="form-grid">
            <!-- Request No -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Requisition Number</mat-label>
              <input matInput formControlName="requestNo" readonly>
              <mat-icon matPrefix>tag</mat-icon>
            </mat-form-field>

            <!-- Date -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Date Required</mat-label>
              <input matInput type="date" formControlName="requestDate" required>
              <mat-icon matPrefix>event</mat-icon>
            </mat-form-field>

            <!-- Requester Name -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Requester Name</mat-label>
              <input matInput formControlName="requesterName" required>
              <mat-icon matPrefix>person</mat-icon>
            </mat-form-field>

            <!-- Division / Branch -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Division / Section</mat-label>
              <mat-select formControlName="division" required>
                <mat-option value="General Administration">General Administration</mat-option>
                <mat-option value="Accounts & Finance">Accounts & Finance</mat-option>
                <mat-option value="Land Registry Branch">Land Registry Branch</mat-option>
                <mat-option value="Planning & Development">Planning & Development</mat-option>
                <mat-option *ngFor="let d of divisions()" [value]="d.name">{{ d.name }}</mat-option>
              </mat-select>
              <mat-icon matPrefix>domain</mat-icon>
            </mat-form-field>

            <!-- Urgency Level -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Urgency Level</mat-label>
              <mat-select formControlName="urgency" required>
                <mat-option value="Low">Low - Normal Replenishment</mat-option>
                <mat-option value="Normal">Normal - Standard Office Need</mat-option>
                <mat-option value="High">High - Urgent Work Directive</mat-option>
                <mat-option value="Urgent">Critical - Immediate Operations Stop</mat-option>
              </mat-select>
              <mat-icon matPrefix>priority_high</mat-icon>
            </mat-form-field>

            <!-- Purpose / Justification -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Purpose / Operational Justification</mat-label>
              <input matInput formControlName="purpose" placeholder="e.g. Month-end accounts reporting, Field survey project, Public day citizen registrations" required>
              <mat-icon matPrefix>description</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <!-- Section: Requested Items Table -->
        <div class="items-section">
          <div class="items-section-header">
            <div class="ish-title">
              <mat-icon>format_list_bulleted</mat-icon>
              <span>Requested Store Items ({{ itemsArray.length }})</span>
            </div>
            <button type="button" mat-stroked-button color="primary" (click)="addItemRow()" class="add-item-btn">
              <mat-icon>add</mat-icon> + Add Item
            </button>
          </div>

          <div [formArrayName]="'items'" class="items-rows-container">
            <div *ngFor="let line of itemsArray.controls; let i = index" [formGroupName]="i" class="item-line-card">
              <div class="line-top-row">
                <span class="line-index-badge">#{{ i + 1 }}</span>
                <span class="spacer"></span>
                <button type="button" mat-icon-button color="warn" (click)="removeItemRow(i)" *ngIf="itemsArray.length > 1" matTooltip="Remove Item Line">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>

              <div class="line-grid">
                <!-- Item Selector -->
                <mat-form-field appearance="outline" class="col-item-select" subscriptSizing="dynamic">
                  <mat-label>Select Store Item</mat-label>
                  <mat-select formControlName="itemId" (selectionChange)="onItemSelect(i, $event.value)" required>
                    <mat-option *ngFor="let it of availableMovableItems()" [value]="it.id">
                      <div class="item-opt-row">
                        <span class="it-opt-name">{{ it.name }}</span>
                        <span class="it-opt-stock" [class.out-of-stock]="it.quantity <= 0">
                          Stock: {{ it.quantity }} {{ it.unit }}
                        </span>
                      </div>
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix>inventory_2</mat-icon>
                </mat-form-field>

                <!-- Requested Quantity -->
                <mat-form-field appearance="outline" class="col-qty" subscriptSizing="dynamic">
                  <mat-label>Requested Qty</mat-label>
                  <input matInput type="number" formControlName="requestedQty" min="1" step="1" placeholder="1" required>
                  <span matSuffix class="unit-suffix">{{ line.get('unit')?.value || 'Pcs' }}</span>
                </mat-form-field>

                <!-- Line Remarks / Specific Note -->
                <mat-form-field appearance="outline" class="col-notes" subscriptSizing="dynamic">
                  <mat-label>Line Note (Optional)</mat-label>
                  <input matInput formControlName="notes" placeholder="Color, specific team, or priority note">
                </mat-form-field>
              </div>

              <!-- Available Stock Badge Indicator -->
              <div class="stock-check-bar" *ngIf="line.get('itemId')?.value">
                <div class="stock-info">
                  <mat-icon class="stock-icon" [ngClass]="getStockStatusClass(line.get('itemId')?.value)">
                    {{ getStockAvailable(line.get('itemId')?.value) > 0 ? 'check_circle' : 'error' }}
                  </mat-icon>
                  <span>Current Store Availability: <strong>{{ getStockAvailable(line.get('itemId')?.value) }} {{ line.get('unit')?.value }}</strong></span>
                </div>
                <span class="stock-warning" *ngIf="line.get('requestedQty')?.value > getStockAvailable(line.get('itemId')?.value)">
                  ⚠️ Requested quantity exceeds available on-hand stock ({{ getStockAvailable(line.get('itemId')?.value) }} {{ line.get('unit')?.value }})
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog Action Buttons -->
        <div class="dialog-actions">
          <button type="button" mat-button (click)="dialogRef.close()">Cancel</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="requestForm.invalid || itemsArray.length === 0" class="submit-btn">
            <mat-icon>send</mat-icon>
            Submit Requisition
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .request-dialog-container {
      padding: 24px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
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
          color: #0284c7;
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

    .vitals-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 14px;

      .col-span-1 { grid-column: span 1; }
      .col-span-2 { grid-column: span 2; }

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
        .col-span-1, .col-span-2 { grid-column: span 1; }
      }
    }

    .items-section {
      margin-top: 10px;

      .items-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .ish-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #4f46e5; }
        }

        .add-item-btn {
          height: 34px;
          font-size: 12px;
          font-weight: 700;
        }
      }

      .items-rows-container {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .item-line-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;

          .line-top-row {
            display: flex;
            align-items: center;

            .line-index-badge {
              font-size: 11px;
              font-weight: 700;
              background: #e2e8f0;
              color: #475569;
              padding: 2px 8px;
              border-radius: 4px;
            }

            .spacer { flex: 1; }

            button { width: 28px; height: 28px; line-height: 28px; }
          }

          .line-grid {
            display: grid;
            grid-template-columns: 2fr 1fr 2fr;
            gap: 10px;

            @media (max-width: 768px) {
              grid-template-columns: 1fr;
            }

            .unit-suffix {
              font-size: 12px;
              color: #64748b;
              font-weight: 600;
              padding-right: 8px;
            }
          }

          .stock-check-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 11.5px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 4px 10px;
            border-radius: 6px;

            .stock-info {
              display: flex;
              align-items: center;
              gap: 6px;
              color: #334155;

              .stock-icon {
                font-size: 15px;
                width: 15px;
                height: 15px;
                &.in-stock { color: #16a34a; }
                &.low-stock { color: #d97706; }
                &.out-of-stock { color: #dc2626; }
              }
            }

            .stock-warning {
              color: #b45309;
              font-weight: 600;
            }
          }
        }
      }
    }

    .item-opt-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;

      .it-opt-name { font-weight: 600; color: #0f172a; }
      .it-opt-stock {
        font-size: 11px;
        color: #16a34a;
        background: #dcfce7;
        padding: 1px 6px;
        border-radius: 4px;
        &.out-of-stock {
          color: #dc2626;
          background: #fee2e2;
        }
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;

      .submit-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        height: 40px;
        padding: 0 18px;
      }
    }
  `]
})
export class RequestDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<RequestDialogComponent>);
  private fb = inject(FormBuilder);
  private inventoryService = inject(InventoryService);
  private authService = inject(AuthService);
  private settingsService = inject(SettingsService);

  requestForm!: FormGroup;
  availableMovableItems = signal<InventoryItem[]>([]);
  divisions = signal<Division[]>([]);

  get itemsArray(): FormArray {
    return this.requestForm.get('items') as FormArray;
  }

  ngOnInit() {
    this.initForm();
    this.loadData();
  }

  private initForm() {
    const user = this.authService.currentUser();
    const today = new Date().toISOString().split('T')[0];
    const generatedNo = this.inventoryService.generateRequestNo();

    this.requestForm = this.fb.group({
      requestNo: [generatedNo, Validators.required],
      requestDate: [today, Validators.required],
      requesterId: [user?.uid || 'anonymous'],
      requesterName: [user?.displayName || user?.email || 'Office Staff', Validators.required],
      requesterEmail: [user?.email || ''],
      department: ['Operations'],
      division: ['General Administration', Validators.required],
      urgency: ['Normal' as InventoryRequestUrgency, Validators.required],
      purpose: ['', Validators.required],
      items: this.fb.array([])
    });

    // Add initial item line
    this.addItemRow();
  }

  private loadData() {
    this.inventoryService.getItems().subscribe(items => {
      // Only movable & consumable items can be requested for store release!
      const movableOnly = (items || []).filter(i => i.itemType === 'movable');
      this.availableMovableItems.set(movableOnly);
    });

    this.settingsService.getDivisions().subscribe(divs => {
      this.divisions.set(divs || []);
    });
  }

  createItemRow(): FormGroup {
    return this.fb.group({
      itemId: ['', Validators.required],
      itemName: ['', Validators.required],
      itemCode: [''],
      unit: ['Pcs'],
      requestedQty: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  addItemRow() {
    this.itemsArray.push(this.createItemRow());
  }

  removeItemRow(index: number) {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  onItemSelect(index: number, itemId: string) {
    const it = this.availableMovableItems().find(item => item.id === itemId);
    if (it) {
      this.itemsArray.at(index).patchValue({
        itemId: it.id,
        itemName: it.name,
        itemCode: it.itemCode,
        unit: it.unit || 'Pcs'
      });
    }
  }

  getStockAvailable(itemId: string): number {
    const it = this.availableMovableItems().find(item => item.id === itemId);
    return it?.quantity ?? 0;
  }

  getStockStatusClass(itemId: string): string {
    const qty = this.getStockAvailable(itemId);
    if (qty <= 0) return 'out-of-stock';
    if (qty <= 10) return 'low-stock';
    return 'in-stock';
  }

  onSubmit() {
    if (this.requestForm.invalid || this.itemsArray.length === 0) return;

    const val = this.requestForm.value;
    const itemsList: InventoryRequestItem[] = val.items.map((line: any) => ({
      itemId: line.itemId,
      itemName: line.itemName,
      itemCode: line.itemCode,
      unit: line.unit,
      requestedQty: parseInt(line.requestedQty, 10) || 1,
      releasedQty: 0,
      notes: line.notes || ''
    }));

    const payload: Omit<InventoryRequest, 'id'> = {
      requestNo: val.requestNo,
      requesterId: val.requesterId,
      requesterName: val.requesterName,
      requesterEmail: val.requesterEmail,
      department: val.department,
      division: val.division,
      requestDate: val.requestDate,
      urgency: val.urgency,
      status: 'Pending',
      purpose: val.purpose,
      items: itemsList,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.dialogRef.close(payload);
  }
}
