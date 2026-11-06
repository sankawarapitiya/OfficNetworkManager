import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
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
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import * as XLSX from 'xlsx';

import { InventoryItem, ItemType, ItemCondition, InventorySettings, DEFAULT_INVENTORY_SETTINGS } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { SettingsService, Division } from '../../../settings/settings.service';
import { NotificationService } from '../../../../core/services/notification.service';

export interface ParsedExcelItem {
  rowNum: number;
  status: 'valid' | 'warning' | 'error';
  statusMsg: string;
  item: Omit<InventoryItem, 'id'>;
}

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
    MatTooltipModule,
    MatDividerModule,
    MatProgressBarModule
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

      <!-- Mode Toggle: Single vs Excel (Registration Only) -->
      <div class="entry-mode-toggle" *ngIf="!isEdit">
        <button type="button" 
                class="mode-btn" 
                [class.active]="entryMode() === 'single'" 
                (click)="setEntryMode('single')">
          <mat-icon>edit_note</mat-icon>
          <span>Single Record Entry</span>
        </button>
        <button type="button" 
                class="mode-btn" 
                [class.active]="entryMode() === 'excel'" 
                (click)="setEntryMode('excel')">
          <mat-icon>upload_file</mat-icon>
          <span>Bulk Excel Upload</span>
          <span class="mode-badge">Batch Import</span>
        </button>
      </div>

      <!-- ================= OPTION A: SINGLE RECORD FORM ================= -->
      <form *ngIf="entryMode() === 'single'" [formGroup]="itemForm" (ngSubmit)="onSubmit()" class="dialog-form">
        
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

      <!-- ================= OPTION B: EXCEL BULK UPLOAD VIEW ================= -->
      <div *ngIf="entryMode() === 'excel'" class="excel-upload-view">
        
        <!-- Step 1: Sample Template Download Card -->
        <div class="template-card">
          <div class="tc-icon-wrap">
            <mat-icon>table_chart</mat-icon>
          </div>
          <div class="tc-content">
            <h4 class="tc-title">Step 1: Download Standard Sample Excel Template</h4>
            <p class="tc-desc">
              Download our pre-structured template containing movable store items and fixed assets samples, standard column headers, category guides, and units of measurement.
            </p>
          </div>
          <button type="button" mat-flat-button class="download-btn" (click)="downloadSampleExcel()">
            <mat-icon>download</mat-icon> Download Sample Template (.xlsx)
          </button>
        </div>

        <!-- Step 2: Drag & Drop Upload Zone -->
        <div class="upload-dropzone" 
             [class.dragging]="isDragging()"
             [class.has-file]="uploadedFileName()"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onFileDrop($event)"
             (click)="fileInput.click()">
          <input #fileInput type="file" accept=".xlsx, .xls" (change)="onFileSelected($event)" hidden>

          <ng-container *ngIf="!uploadedFileName()">
            <div class="dropzone-icon-circle">
              <mat-icon>cloud_upload</mat-icon>
            </div>
            <h4 class="dropzone-title">Step 2: Upload Your Completed Excel File</h4>
            <p class="dropzone-subtitle">Click to choose a file or drag & drop <strong>.xlsx / .xls</strong> spreadsheet here</p>
            <span class="dropzone-hint">Supports bulk addition of both Movable Store Items and Immovable Fixed Assets</span>
          </ng-container>

          <ng-container *ngIf="uploadedFileName()">
            <div class="file-loaded-row" (click)="$event.stopPropagation()">
              <div class="file-icon-box">
                <mat-icon>description</mat-icon>
              </div>
              <div class="file-details">
                <span class="file-name">{{ uploadedFileName() }}</span>
                <span class="file-meta">{{ uploadedFileSize() }} • {{ parsedRows().length }} total rows parsed</span>
              </div>
              <button type="button" mat-icon-button color="warn" (click)="clearUploadedFile(); fileInput.value = ''" matTooltip="Remove File">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </ng-container>
        </div>

        <!-- Step 3: Parsed Data Preview & Validation -->
        <div class="parsed-preview-section" *ngIf="parsedRows().length > 0">
          <div class="preview-header">
            <div class="ph-title-group">
              <mat-icon class="ph-icon">verified</mat-icon>
              <h4>Parsed Items Preview</h4>
            </div>
            <div class="ph-tally-pills">
              <span class="tally-pill total">Total: {{ parsedRows().length }}</span>
              <span class="tally-pill valid">Ready: {{ validCount() }}</span>
              <span class="tally-pill warning" *ngIf="warningCount() > 0">Auto-assigned: {{ warningCount() }}</span>
              <span class="tally-pill error" *ngIf="errorCount() > 0">Skipped (Errors): {{ errorCount() }}</span>
            </div>
          </div>

          <div class="preview-table-wrapper">
            <table class="preview-table">
              <thead>
                <tr>
                  <th class="text-center">#</th>
                  <th>Status</th>
                  <th>Code</th>
                  <th>Classification</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th class="text-center">Quantity</th>
                  <th>Location / Room</th>
                  <th>Validation Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of parsedRows()" [class.row-error]="row.status === 'error'" [class.row-warn]="row.status === 'warning'">
                  <td class="font-mono text-center">{{ row.rowNum }}</td>
                  <td>
                    <span class="status-pill" [ngClass]="row.status">
                      <mat-icon>{{ row.status === 'valid' ? 'check_circle' : (row.status === 'warning' ? 'info' : 'error') }}</mat-icon>
                      {{ row.status === 'valid' ? 'Valid' : (row.status === 'warning' ? 'Notice' : 'Error') }}
                    </span>
                  </td>
                  <td class="font-mono">{{ row.item.itemCode }}</td>
                  <td>
                    <span class="tier-pill" [ngClass]="row.item.itemType">
                      <mat-icon class="tier-icon">{{ row.item.itemType === 'immovable' ? 'apartment' : 'inventory_2' }}</mat-icon>
                      {{ row.item.itemType === 'immovable' ? 'Immovable' : 'Movable' }}
                    </span>
                  </td>
                  <td><strong>{{ row.item.name }}</strong></td>
                  <td><span class="cell-cat">{{ row.item.category }}</span></td>
                  <td class="text-center font-mono">{{ row.item.quantity }} {{ row.item.unit }}</td>
                  <td><span class="cell-loc">{{ row.item.location }}</span></td>
                  <td class="notes-cell" [matTooltip]="row.statusMsg">{{ row.statusMsg }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Excel Action Buttons -->
        <div class="dialog-actions">
          <button type="button" mat-button (click)="dialogRef.close()">Cancel</button>
          <button type="button" 
                  mat-flat-button 
                  color="primary" 
                  class="submit-btn" 
                  [disabled]="validCount() === 0 || isImporting()" 
                  (click)="confirmExcelImport()">
            <mat-icon>cloud_upload</mat-icon>
            {{ isImporting() ? 'Importing Items...' : ('Import ' + validCount() + ' Inventory Records') }}
          </button>
        </div>
      </div>

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
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid #e2e8f0;

      .header-title-group {
        display: flex;
        align-items: center;
        gap: 12px;

        .header-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: #4f46e5;
        }

        .dialog-title {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          color: #0f172a;
        }

        .dialog-subtitle {
          margin: 2px 0 0 0;
          font-size: 12.5px;
          color: #64748b;
        }
      }

      .close-btn {
        margin: -8px -8px 0 0;
        color: #94a3b8;
        &:hover { color: #0f172a; }
      }
    }

    /* Entry Mode Toggle (Single vs Excel) */
    .entry-mode-toggle {
      display: flex;
      gap: 10px;
      background: #f1f5f9;
      padding: 6px;
      border-radius: 10px;
      margin-bottom: 20px;

      .mode-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 9px 16px;
        border: none;
        background: transparent;
        border-radius: 8px;
        font-size: 13.5px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;

        mat-icon {
          font-size: 19px;
          width: 19px;
          height: 19px;
        }

        .mode-badge {
          font-size: 10px;
          font-weight: 700;
          background: #dbeafe;
          color: #1e40af;
          padding: 2px 7px;
          border-radius: 999px;
          text-transform: uppercase;
        }

        &:hover:not(.active) {
          background: #e2e8f0;
          color: #1e293b;
        }

        &.active {
          background: #ffffff;
          color: #4f46e5;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

          mat-icon {
            color: #4f46e5;
          }

          .mode-badge {
            background: #e0e7ff;
            color: #4338ca;
          }
        }
      }
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Classification Cards */
    .type-selector-card {
      margin-bottom: 6px;

      .type-selector-label {
        font-size: 12px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: block;
        margin-bottom: 8px;
      }

      .type-cards-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;

        @media (max-width: 600px) {
          grid-template-columns: 1fr;
        }

        .type-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
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

    /* ================= EXCEL BULK UPLOAD VIEW STYLING ================= */
    .excel-upload-view {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Template Card */
    .template-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 16px 20px;
      flex-wrap: wrap;

      .tc-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #dcfce7;
        color: #166534;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .tc-content {
        flex: 1;
        min-width: 220px;

        .tc-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #14532d;
        }

        .tc-desc {
          margin: 3px 0 0 0;
          font-size: 12px;
          color: #15803d;
          line-height: 1.35;
        }
      }

      .download-btn {
        background: #16a34a;
        color: #ffffff;
        font-weight: 600;
        font-size: 12.5px;
        height: 38px;
        border-radius: 8px;
        mat-icon { margin-right: 4px; font-size: 18px; width: 18px; height: 18px; }
        &:hover { background: #15803d; }
      }
    }

    /* Upload Dropzone */
    .upload-dropzone {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 28px 20px;
      background: #f8fafc;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      &:hover, &.dragging {
        border-color: #4f46e5;
        background: #f5f3ff;
      }

      &.has-file {
        padding: 14px 20px;
        background: #f8fafc;
        border-style: solid;
        border-color: #e2e8f0;
      }

      .dropzone-icon-circle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #eef2ff;
        color: #4f46e5;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }
      }

      .dropzone-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
      }

      .dropzone-subtitle {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: #475569;
      }

      .dropzone-hint {
        margin-top: 6px;
        font-size: 11.5px;
        color: #94a3b8;
      }

      /* File Selected State */
      .file-loaded-row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
        text-align: left;

        .file-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: #e0e7ff;
          color: #4338ca;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }
        }

        .file-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;

          .file-name {
            font-size: 13.5px;
            font-weight: 700;
            color: #0f172a;
          }

          .file-meta {
            font-size: 11.5px;
            color: #64748b;
          }
        }
      }
    }

    /* Parsed Preview Section */
    .parsed-preview-section {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        flex-wrap: wrap;
        gap: 10px;

        .ph-title-group {
          display: flex;
          align-items: center;
          gap: 8px;

          .ph-icon {
            color: #4f46e5;
            font-size: 20px;
            width: 20px;
            height: 20px;
          }

          h4 {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
          }
        }

        .ph-tally-pills {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          .tally-pill {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 999px;

            &.total {
              background: #f1f5f9;
              color: #475569;
            }

            &.valid {
              background: #dcfce7;
              color: #15803d;
            }

            &.warning {
              background: #fef3c7;
              color: #b45309;
            }

            &.error {
              background: #fee2e2;
              color: #b91c1c;
            }
          }
        }
      }

      .preview-table-wrapper {
        max-height: 280px;
        overflow-y: auto;
        overflow-x: auto;

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;

          th {
            background: #f1f5f9;
            padding: 8px 10px;
            text-align: left;
            font-weight: 700;
            color: #475569;
            position: sticky;
            top: 0;
            z-index: 1;
            border-bottom: 1px solid #e2e8f0;
            white-space: nowrap;
          }

          td {
            padding: 8px 10px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
            white-space: nowrap;
          }

          tr:hover td {
            background: #fafbfc;
          }

          tr.row-error td {
            background: #fef2f2;
          }

          tr.row-warn td {
            background: #fffdf5;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10.5px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;

            mat-icon {
              font-size: 13px;
              width: 13px;
              height: 13px;
            }

            &.valid {
              background: #dcfce7;
              color: #15803d;
            }

            &.warning {
              background: #fef3c7;
              color: #b45309;
            }

            &.error {
              background: #fee2e2;
              color: #b91c1c;
            }
          }

          .tier-badge {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;

            &.movable {
              background: #dbeafe;
              color: #1e40af;
            }

            &.immovable {
              background: #fef3c7;
              color: #92400e;
            }
          }

          .tier-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 600;

            .tier-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }

            &.movable { color: #2563eb; }
            &.immovable { color: #d97706; }
          }

          .cell-cat {
            color: #64748b;
          }

          .cell-loc {
            color: #64748b;
            font-size: 11.5px;
          }

          .notes-cell {
            color: #64748b;
            font-size: 11px;
            max-width: 220px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
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
  private notif = inject(NotificationService);

  itemForm!: FormGroup;
  isEdit = false;

  // Entry Mode: Single vs Excel
  entryMode = signal<'single' | 'excel'>('single');

  // Excel Upload Signals
  uploadedFileName = signal<string>('');
  uploadedFileSize = signal<string>('');
  isDragging = signal<boolean>(false);
  isImporting = signal<boolean>(false);
  parsedRows = signal<ParsedExcelItem[]>([]);

  validCount = computed(() => this.parsedRows().filter(r => r.status !== 'error').length);
  warningCount = computed(() => this.parsedRows().filter(r => r.status === 'warning').length);
  errorCount = computed(() => this.parsedRows().filter(r => r.status === 'error').length);
  validParsedItems = computed(() => this.parsedRows().filter(r => r.status !== 'error').map(r => r.item));

  categories = signal<string[]>(DEFAULT_INVENTORY_SETTINGS.categories);
  locations = signal<string[]>(DEFAULT_INVENTORY_SETTINGS.locations);
  units = signal<string[]>(DEFAULT_INVENTORY_SETTINGS.units);
  divisions = signal<Division[]>([]);

  get isImmovable(): boolean {
    return this.itemForm?.get('itemType')?.value === 'immovable';
  }

  constructor(@Inject(MAT_DIALOG_DATA) public data: { item?: InventoryItem; defaultType?: ItemType; defaultMode?: 'single' | 'excel' }) {
    this.isEdit = !!data?.item?.id;
    if (data?.defaultMode) {
      this.entryMode.set(data.defaultMode);
    }
  }

  ngOnInit() {
    this.loadSettings();
    this.initForm();
  }

  setEntryMode(mode: 'single' | 'excel') {
    if (this.isEdit) return;
    this.entryMode.set(mode);
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

  // ================= EXCEL TEMPLATE & PARSER LOGIC =================

  downloadSampleExcel() {
    const headers = [
      'Item Code',
      'Classification',
      'Category',
      'Item Name',
      'Description',
      'Unit',
      'Quantity',
      'Min Stock Alert',
      'Unit Cost (LKR)',
      'Location',
      'Division',
      'Asset Tag',
      'Serial Number',
      'Custodian Name',
      'Condition',
      'Acquisition Date',
      'Remarks'
    ];

    const sampleRows = [
      [
        'INV-M-1001',
        'movable',
        'Office Stationery & Supplies',
        'A4 Copy Paper 80GSM (Box of 5 Reams)',
        'Double A High-speed white copy paper',
        'Box',
        50,
        10,
        8500.00,
        'Central Store Room - Ground Floor',
        'General Secretariat',
        '',
        '',
        '',
        '',
        '2026-01-15',
        'Regular monthly store stock'
      ],
      [
        'INV-M-1002',
        'movable',
        'Computer & IT Consumables',
        'HP LaserJet Toner Cartridge 85A',
        'Black toner for HP LaserJet P1102 printers',
        'Pcs',
        8,
        2,
        14200.00,
        'IT Equipment Room - 1st Floor',
        'Planning & Development',
        '',
        '',
        '',
        '',
        '2026-02-10',
        'Original OEM toner'
      ],
      [
        'AST-I-2001',
        'immovable',
        'Office Furniture & Fixtures',
        'Heavy-Duty Steel Almirah 4-Door',
        'Standard 72x36x18 inch powder-coated grey',
        'Unit',
        1,
        0,
        48500.00,
        'Main Accounts Office - 1st Floor',
        'Accounts & Finance',
        'DS/AST/2026/014',
        'ALM-2026-991',
        'Sanka WG, Accounts Officer',
        'Good',
        '2025-08-20',
        'Fixed asset tag affixed on upper door'
      ],
      [
        'AST-I-2002',
        'immovable',
        'Office Equipment & Electronics',
        'Inverter Split Air Conditioner 24000BTU',
        'Daikin Wall-mounted inverter unit with outdoor condenser',
        'Unit',
        1,
        0,
        265000.00,
        'Conference Hall - 2nd Floor',
        'General Secretariat',
        'DS/AST/2026/015',
        'SN-DK-884210',
        'Administrative Officer',
        'Good',
        '2025-11-05',
        'Installed under 5-year comprehensive warranty'
      ]
    ];

    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 15 }, // Item Code
      { wch: 16 }, // Classification
      { wch: 30 }, // Category
      { wch: 40 }, // Item Name
      { wch: 36 }, // Description
      { wch: 10 }, // Unit
      { wch: 12 }, // Quantity
      { wch: 16 }, // Min Stock Alert
      { wch: 16 }, // Unit Cost
      { wch: 34 }, // Location
      { wch: 25 }, // Division
      { wch: 18 }, // Asset Tag
      { wch: 18 }, // Serial Number
      { wch: 28 }, // Custodian Name
      { wch: 14 }, // Condition
      { wch: 18 }, // Acquisition Date
      { wch: 35 }  // Remarks
    ];

    const refHeaders = ['Field', 'Allowed Values / Instructions', 'Example Values'];
    const refRows = [
      ['Classification', 'movable (store items/consumables) OR immovable (fixed assets/fixtures)', 'movable, immovable'],
      ['Category', this.categories().join(', '), 'Office Stationery & Supplies, Office Furniture & Fixtures'],
      ['Unit', this.units().join(', '), 'Pcs, Box, Ream, Pack, Unit, Kg, Set, Roll'],
      ['Location', this.locations().join(', '), 'Central Store Room - Ground Floor, IT Equipment Room'],
      ['Condition', 'Good, Fair, Needs Repair, Damaged, Written Off, Disposed', 'Good'],
      ['Item Code', 'Optional: If blank, system will auto-generate based on classification and category', 'INV-M-1001, AST-I-2001']
    ];

    const refWs = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows]);
    refWs['!cols'] = [{ wch: 20 }, { wch: 65 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory_Template');
    XLSX.utils.book_append_sheet(wb, refWs, 'Reference_Guidelines');

    XLSX.writeFile(wb, 'inventory_items_sample_template.xlsx');
    this.notif.success('Sample Excel template downloaded successfully!');
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.processFile(file);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  private processFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      this.notif.error('Invalid file format. Please upload a valid Excel spreadsheet (.xlsx or .xls).');
      return;
    }

    this.uploadedFileName.set(file.name);
    this.uploadedFileSize.set(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        this.parseUploadedRows(rawRows);
      } catch (err) {
        console.error('Error reading Excel spreadsheet:', err);
        this.notif.error('Failed to parse Excel file. Please ensure the file is not corrupted.');
        this.clearUploadedFile();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  clearUploadedFile() {
    this.uploadedFileName.set('');
    this.uploadedFileSize.set('');
    this.parsedRows.set([]);
  }

  private parseUploadedRows(rawRows: any[]) {
    if (!rawRows || rawRows.length === 0) {
      this.notif.error('Uploaded file appears to be empty or has no data rows.');
      return;
    }

    const parsed: ParsedExcelItem[] = [];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2; // Row 1 is header
      const rowKeys = Object.keys(row);
      const getVal = (candidates: string[]): string => {
        for (const c of candidates) {
          const matchKey = rowKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === c);
          if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
            return String(row[matchKey]).trim();
          }
        }
        return '';
      };

      const name = getVal(['itemname', 'name', 'title', 'item']);
      const codeVal = getVal(['itemcode', 'code', 'itemid', 'assetcode', 'tag']);
      const typeVal = getVal(['classification', 'type', 'itemtype', 'tier']).toLowerCase();
      const catVal = getVal(['category', 'cat', 'group']);
      const descVal = getVal(['description', 'desc', 'specifications', 'specs']);
      const unitVal = getVal(['unit', 'uom', 'unitofmeasure']);
      const qtyVal = getVal(['quantity', 'qty', 'initialquantity', 'stock', 'balance']);
      const alertVal = getVal(['minstockalert', 'alert', 'lowstockalert', 'minstock']);
      const costVal = getVal(['unitcost', 'cost', 'price', 'rate', 'unitprice']);
      const locVal = getVal(['location', 'room', 'storelocation', 'placement']);
      const divVal = getVal(['division', 'branch', 'department']);
      const assetTagVal = getVal(['assettag', 'tag', 'barcode', 'assetid']);
      const serialVal = getVal(['serialnumber', 'serial', 'serialno', 'sn']);
      const custodianVal = getVal(['custodianname', 'custodian', 'responsibleofficer', 'officer']);
      const conditionVal = getVal(['condition', 'state', 'physicalcondition']);
      const acqDateVal = getVal(['acquisitiondate', 'purchasedate', 'date']);
      const remarksVal = getVal(['remarks', 'notes', 'comment']);

      // Skip row if completely empty
      if (!name && !codeVal && !catVal && !descVal) {
        return;
      }

      // Check classification
      const isImmovable = typeVal.includes('immov') || typeVal.includes('fixed') || typeVal.includes('asset');
      const itemType: ItemType = isImmovable ? 'immovable' : 'movable';

      let status: 'valid' | 'warning' | 'error' = 'valid';
      const notes: string[] = [];

      if (!name) {
        status = 'error';
        notes.push('Missing Item Name');
      }

      const category = catVal || (isImmovable ? 'Office Furniture & Fixtures' : 'Office Stationery & Supplies');
      if (!catVal) {
        notes.push(`Default category applied (${category})`);
        if (status !== 'error') status = 'warning';
      }

      let itemCode = codeVal;
      if (!itemCode) {
        itemCode = this.inventoryService.generateItemCode(itemType, category);
        notes.push(`Auto-generated Code: ${itemCode}`);
        if (status !== 'error') status = 'warning';
      }

      const unit = unitVal || (isImmovable ? 'Unit' : 'Pcs');
      const quantity = qtyVal !== '' ? Math.max(0, parseInt(qtyVal, 10) || 0) : (isImmovable ? 1 : 0);
      const minStockAlert = alertVal !== '' ? Math.max(0, parseInt(alertVal, 10) || 0) : (isImmovable ? 0 : 10);
      const unitCost = costVal !== '' ? parseFloat(costVal) : undefined;
      const location = locVal || (this.locations()[0] || 'Central Store Room - Ground Floor');
      const division = divVal || 'General Secretariat';
      const assetTag = isImmovable ? (assetTagVal || itemCode) : undefined;
      const serialNumber = serialVal || undefined;
      const custodianName = isImmovable ? (custodianVal || undefined) : undefined;
      const condition = isImmovable ? ((['Good', 'Fair', 'Needs Repair', 'Damaged', 'Written Off', 'Disposed'].includes(conditionVal) ? conditionVal : 'Good') as ItemCondition) : undefined;
      const remarks = remarksVal || undefined;
      const description = descVal || undefined;

      const item: Omit<InventoryItem, 'id'> = {
        itemCode,
        name: name || 'Unnamed Item',
        description,
        category,
        itemType,
        unit,
        quantity,
        minStockAlert,
        unitCost: isNaN(unitCost as any) ? undefined : unitCost,
        location,
        division,
        assetTag,
        serialNumber,
        custodianName,
        condition,
        acquisitionDate: acqDateVal || (isImmovable ? new Date().toISOString().split('T')[0] : undefined),
        status: 'Active',
        remarks,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'Excel Import'
      };

      parsed.push({
        rowNum,
        status,
        statusMsg: notes.join(' • ') || 'Ready for import',
        item
      });
    });

    this.parsedRows.set(parsed);
    if (parsed.length > 0) {
      const validCnt = parsed.filter(p => p.status !== 'error').length;
      this.notif.info(`Parsed ${parsed.length} rows from Excel (${validCnt} ready for import).`);
    } else {
      this.notif.error('No valid rows found in the uploaded spreadsheet.');
    }
  }

  confirmExcelImport() {
    const validItems = this.validParsedItems();
    if (validItems.length === 0) {
      this.notif.error('No valid records to import.');
      return;
    }

    this.isImporting.set(true);
    this.dialogRef.close({
      batch: true,
      items: validItems
    });
  }
}
