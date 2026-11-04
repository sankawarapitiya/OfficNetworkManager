import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';

import { InventoryItem, ItemType, ItemCondition, InventorySettings, DEFAULT_INVENTORY_SETTINGS } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { SettingsService, Division } from '../../../settings/settings.service';

@Component({
  selector: 'app-item-dialog',
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
    MatRadioModule,
    MatTooltipModule
  ],
  template: `
    <div class="item-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title-group">
          <mat-icon class="header-icon">{{ isEdit ? 'edit_note' : 'inventory' }}</mat-icon>
          <div>
            <h2 class="dialog-title">{{ isEdit ? 'Edit Inventory Record' : 'Register New Inventory Record' }}</h2>
            <p class="dialog-subtitle">Configure movable store items for staff requisition or register immovable fixed assets</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="itemForm" (ngSubmit)="onSubmit()" class="dialog-form">
        
        <!-- Item Classification Selector (Movable vs Immovable) -->
        <div class="type-selector-card" *ngIf="!isEdit">
          <label class="type-selector-label">Classification / Tier</label>
          <div class="type-cards-grid">
            <div class="type-card" 
                 [class.selected]="itemForm.get('itemType')?.value === 'movable'" 
                 (click)="onTypeSelect('movable')">
              <div class="card-icon-wrap movable">
                <mat-icon>inventory_2</mat-icon>
              </div>
              <div class="card-text">
                <span class="card-title">Movable & Consumable</span>
                <span class="card-desc">Office supplies, stationery, toners & gear. Tracked by quantity and eligible for store requisition.</span>
              </div>
              <mat-icon class="check-icon" *ngIf="itemForm.get('itemType')?.value === 'movable'">check_circle</mat-icon>
            </div>

            <div class="type-card" 
                 [class.selected]="itemForm.get('itemType')?.value === 'immovable'" 
                 (click)="onTypeSelect('immovable')">
              <div class="card-icon-wrap immovable">
                <mat-icon>apartment</mat-icon>
              </div>
              <div class="card-text">
                <span class="card-title">Immovable & Fixed Asset</span>
                <span class="card-desc">Permanent office fixtures, steel almirahs, AC units, furniture & infrastructure. Tracked with Asset Tag & Custodian.</span>
              </div>
              <mat-icon class="check-icon" *ngIf="itemForm.get('itemType')?.value === 'immovable'">check_circle</mat-icon>
            </div>
          </div>
        </div>

        <div class="type-indicator-banner" *ngIf="isEdit" [ngClass]="itemForm.get('itemType')?.value">
          <mat-icon>{{ itemForm.get('itemType')?.value === 'immovable' ? 'apartment' : 'inventory_2' }}</mat-icon>
          <span>Editing <strong>{{ itemForm.get('itemType')?.value === 'immovable' ? 'Immovable Fixed Asset' : 'Movable & Consumable Store Item' }}</strong></span>
        </div>

        <!-- Section 1: Item Identity -->
        <div class="section-divider">
          <span>Item Identification & Cataloging</span>
        </div>

        <div class="form-grid">
          <!-- Item / Asset Code -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>{{ isImmovable ? 'Asset Tag / Code' : 'Item Code' }}</mat-label>
            <input matInput formControlName="itemCode" placeholder="e.g. INV-M-1001" required>
            <mat-icon matPrefix>tag</mat-icon>
            <button type="button" mat-icon-button matSuffix (click)="regenerateCode()" matTooltip="Regenerate Code" *ngIf="!isEdit">
              <mat-icon>refresh</mat-icon>
            </button>
          </mat-form-field>

          <!-- Category -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category" required>
              <mat-option *ngFor="let cat of categories()" [value]="cat">{{ cat }}</mat-option>
            </mat-select>
            <mat-icon matPrefix>category</mat-icon>
          </mat-form-field>

          <!-- Name -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Item / Asset Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. A4 Copy Paper 80GSM, Steel Almirah 4-Door, HP LaserJet Toner 85A" required>
            <mat-icon matPrefix>badge</mat-icon>
          </mat-form-field>

          <!-- Description / Specifications -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Specifications / Description (Optional)</mat-label>
            <input matInput formControlName="description" placeholder="Brand, dimensions, model number, technical details">
            <mat-icon matPrefix>description</mat-icon>
          </mat-form-field>
        </div>

        <!-- Section 2: Specific Fields Based on Type -->

        <!-- A: Movable / Consumable Fields -->
        <div *ngIf="!isImmovable" class="type-specific-section movable-section">
          <div class="section-divider">
            <span>Stock Balances & Unit Specifications</span>
          </div>

          <div class="form-grid">
            <!-- Current Quantity -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>{{ isEdit ? 'Current Stock Quantity' : 'Initial Stock Quantity' }}</mat-label>
              <input matInput type="number" formControlName="quantity" min="0" step="1" placeholder="0" required>
              <mat-icon matPrefix>calculate</mat-icon>
            </mat-form-field>

            <!-- Unit of Measure -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Unit of Measure</mat-label>
              <mat-select formControlName="unit" required>
                <mat-option *ngFor="let u of units()" [value]="u">{{ u }}</mat-option>
              </mat-select>
              <mat-icon matPrefix>straighten</mat-icon>
            </mat-form-field>

            <!-- Minimum Stock Warning Alert -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Low Stock Alert Level</mat-label>
              <input matInput type="number" formControlName="minStockAlert" min="0" placeholder="10">
              <mat-icon matPrefix>notification_important</mat-icon>
              <mat-hint>Triggers alert when balance drops to/below this</mat-hint>
            </mat-form-field>

            <!-- Unit Cost (Optional) -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Estimated Unit Cost (LKR)</mat-label>
              <input matInput type="number" formControlName="unitCost" min="0" step="0.01" placeholder="0.00">
              <mat-icon matPrefix>payments</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <!-- B: Immovable / Fixed Asset Fields -->
        <div *ngIf="isImmovable" class="type-specific-section immovable-section">
          <div class="section-divider">
            <span>Fixed Asset Tracking, Custodian & Condition</span>
          </div>

          <div class="form-grid">
            <!-- Asset Tag / Barcode -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Physical Asset Tag / Barcode</mat-label>
              <input matInput formControlName="assetTag" placeholder="e.g. DS/AST/2026/014">
              <mat-icon matPrefix>qr_code_scanner</mat-icon>
            </mat-form-field>

            <!-- Serial Number -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Manufacturer Serial No</mat-label>
              <input matInput formControlName="serialNumber" placeholder="e.g. SN-984210984">
              <mat-icon matPrefix>pin</mat-icon>
            </mat-form-field>

            <!-- Custodian / Responsible Officer -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Assigned Custodian Officer</mat-label>
              <input matInput formControlName="custodianName" placeholder="e.g. Sanka WG, Accounts Officer">
              <mat-icon matPrefix>person</mat-icon>
              <mat-hint>Designated officer in charge of asset</mat-hint>
            </mat-form-field>

            <!-- Condition -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Physical Condition</mat-label>
              <mat-select formControlName="condition">
                <mat-option value="Good">Good / Fully Functional</mat-option>
                <mat-option value="Fair">Fair / Minor Wear</mat-option>
                <mat-option value="Needs Repair">Needs Repair / Maintenance</mat-option>
                <mat-option value="Damaged">Damaged / Non-Functional</mat-option>
                <mat-option value="Written Off">Written Off / Decommissioned</mat-option>
                <mat-option value="Disposed">Disposed / Transferred</mat-option>
              </mat-select>
              <mat-icon matPrefix>health_and_safety</mat-icon>
            </mat-form-field>

            <!-- Acquisition Date -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Acquisition / Installation Date</mat-label>
              <input matInput type="date" formControlName="acquisitionDate">
              <mat-icon matPrefix>event</mat-icon>
            </mat-form-field>

            <!-- Unit / Purchase Cost -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Acquisition Cost (LKR)</mat-label>
              <input matInput type="number" formControlName="unitCost" min="0" step="0.01" placeholder="0.00">
              <mat-icon matPrefix>payments</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <!-- Section 3: Location & Division Placement -->
        <div class="section-divider">
          <span>Physical Placement & Notes</span>
        </div>

        <div class="form-grid">
          <!-- Location / Room / Shelf -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>{{ isImmovable ? 'Room / Office Hall' : 'Store Location / Shelf' }}</mat-label>
            <mat-select formControlName="location" required>
              <mat-option *ngFor="let loc of locations()" [value]="loc">{{ loc }}</mat-option>
            </mat-select>
            <mat-icon matPrefix>place</mat-icon>
          </mat-form-field>

          <!-- Division -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Administrative Division / Branch</mat-label>
            <mat-select formControlName="division">
              <mat-option value="General Secretariat">General Secretariat</mat-option>
              <mat-option value="Accounts & Finance">Accounts & Finance</mat-option>
              <mat-option value="Land Registry">Land Registry</mat-option>
              <mat-option value="Planning & Development">Planning & Development</mat-option>
              <mat-option value="Grama Niladhari Division">Grama Niladhari Division</mat-option>
              <mat-option *ngFor="let d of divisions()" [value]="d.name">{{ d.name }}</mat-option>
            </mat-select>
            <mat-icon matPrefix>domain</mat-icon>
          </mat-form-field>

          <!-- Remarks / Maintenance Notes -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Remarks / Notes</mat-label>
            <input matInput formControlName="remarks" placeholder="Warranty details, supplier note, special instructions">
            <mat-icon matPrefix>comment</mat-icon>
          </mat-form-field>
        </div>

        <!-- Dialog Action Buttons -->
        <div class="dialog-actions">
          <button type="button" mat-button (click)="dialogRef.close()">Cancel</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="itemForm.invalid" class="submit-btn">
            <mat-icon>{{ isEdit ? 'save' : 'add_circle' }}</mat-icon>
            {{ isEdit ? 'Save Changes' : 'Register Item / Asset' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .item-dialog-container {
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
          color: #4f46e5;
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

      .close-btn {
        color: #94a3b8;
      }
    }

    /* Type Selector Cards Grid */
    .type-selector-card {
      margin-bottom: 18px;

      .type-selector-label {
        font-size: 12.5px;
        font-weight: 700;
        color: #334155;
        display: block;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .type-cards-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;

        @media (max-width: 640px) {
          grid-template-columns: 1fr;
        }

        .type-card {
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #ffffff;
          position: relative;
          transition: all 0.2s ease;

          &:hover {
            border-color: #cbd5e1;
            background: #f8fafc;
          }

          &.selected {
            border-color: #4f46e5;
            background: #f5f3ff;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.12);

            .card-title {
              color: #3730a3;
            }
          }

          .card-icon-wrap {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;

            &.movable {
              background: #dbeafe;
              color: #1d4ed8;
            }

            &.immovable {
              background: #fef3c7;
              color: #b45309;
            }

            mat-icon { font-size: 20px; width: 20px; height: 20px; }
          }

          .card-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
            padding-right: 24px;

            .card-title {
              font-size: 13.5px;
              font-weight: 700;
              color: #0f172a;
            }

            .card-desc {
              font-size: 11px;
              color: #64748b;
              line-height: 1.35;
            }
          }

          .check-icon {
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #4f46e5;
          }
        }
      }
    }

    .type-indicator-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 16px;

      &.movable {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
        mat-icon { color: #2563eb; }
      }

      &.immovable {
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
        mat-icon { color: #d97706; }
      }
    }

    .section-divider {
      display: flex;
      align-items: center;
      margin: 16px 0 12px 0;
      color: #64748b;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;

      &::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid #e2e8f0;
        margin-left: 10px;
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 14px;

      .col-span-1 {
        grid-column: span 1;
      }

      .col-span-2 {
        grid-column: span 2;
      }

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
        .col-span-1, .col-span-2 {
          grid-column: span 1;
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
export class ItemDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<ItemDialogComponent>);
  private fb = inject(FormBuilder);
  private inventoryService = inject(InventoryService);
  private settingsService = inject(SettingsService);

  itemForm!: FormGroup;
  isEdit = false;

  categories = signal<string[]>(DEFAULT_INVENTORY_SETTINGS.categories);
  locations = signal<string[]>(DEFAULT_INVENTORY_SETTINGS.locations);
  units = signal<string[]>(DEFAULT_INVENTORY_SETTINGS.units);
  divisions = signal<Division[]>([]);

  get isImmovable(): boolean {
    return this.itemForm?.get('itemType')?.value === 'immovable';
  }

  constructor(@Inject(MAT_DIALOG_DATA) public data: { item?: InventoryItem; defaultType?: ItemType }) {
    this.isEdit = !!data?.item?.id;
  }

  ngOnInit() {
    this.loadSettings();
    this.initForm();
  }

  private loadSettings() {
    this.inventoryService.getSettings().subscribe(settings => {
      if (settings) {
        if (settings.categories?.length) this.categories.set(settings.categories);
        if (settings.locations?.length) this.locations.set(settings.locations);
        if (settings.units?.length) this.units.set(settings.units);
      }
    });

    this.settingsService.getDivisions().subscribe(divs => {
      this.divisions.set(divs || []);
    });
  }

  private initForm() {
    const it = this.data?.item;
    const initialType: ItemType = it?.itemType || this.data?.defaultType || 'movable';
    const initialCode = it?.itemCode || this.inventoryService.generateItemCode(initialType);

    this.itemForm = this.fb.group({
      itemType: [initialType, Validators.required],
      itemCode: [initialCode, Validators.required],
      name: [it?.name || '', Validators.required],
      description: [it?.description || ''],
      category: [it?.category || this.categories()[0] || 'Office Stationery & Supplies', Validators.required],
      unit: [it?.unit || 'Pcs', Validators.required],
      quantity: [it?.quantity !== undefined ? it.quantity : (initialType === 'immovable' ? 1 : 0), [Validators.required, Validators.min(0)]],
      minStockAlert: [it?.minStockAlert !== undefined ? it.minStockAlert : 10, [Validators.required, Validators.min(0)]],
      unitCost: [it?.unitCost || ''],
      location: [it?.location || this.locations()[0] || 'Central Store Room - Ground Floor', Validators.required],
      division: [it?.division || 'General Secretariat'],
      
      // Fixed Asset specific:
      assetTag: [it?.assetTag || (initialType === 'immovable' ? initialCode : '')],
      serialNumber: [it?.serialNumber || ''],
      custodianName: [it?.custodianName || ''],
      custodianId: [it?.custodianId || ''],
      condition: [it?.condition || 'Good'],
      acquisitionDate: [it?.acquisitionDate || new Date().toISOString().split('T')[0]],
      remarks: [it?.remarks || '']
    });
  }

  onTypeSelect(type: ItemType) {
    if (this.isEdit) return;
    this.itemForm.patchValue({ itemType: type });
    this.regenerateCode();
  }

  regenerateCode() {
    const type = this.itemForm.get('itemType')?.value as ItemType;
    const category = this.itemForm.get('category')?.value;
    const newCode = this.inventoryService.generateItemCode(type, category);
    this.itemForm.patchValue({ itemCode: newCode });
    if (type === 'immovable' && !this.itemForm.get('assetTag')?.value) {
      this.itemForm.patchValue({ assetTag: newCode });
    }
  }

  onSubmit() {
    if (this.itemForm.invalid) return;

    const formVal = this.itemForm.value;
    const isImmovable = formVal.itemType === 'immovable';

    const payload: Partial<InventoryItem> = {
      ...formVal,
      quantity: isImmovable ? 1 : (parseInt(formVal.quantity, 10) || 0),
      minStockAlert: isImmovable ? 0 : (parseInt(formVal.minStockAlert, 10) || 0),
      unitCost: formVal.unitCost ? parseFloat(formVal.unitCost) : undefined,
      assetTag: isImmovable ? (formVal.assetTag || formVal.itemCode) : undefined,
      condition: isImmovable ? formVal.condition : undefined,
      custodianName: isImmovable ? formVal.custodianName : undefined
    };

    this.dialogRef.close(payload);
  }
}
