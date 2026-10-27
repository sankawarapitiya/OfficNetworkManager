import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { VoucherTypeConfig } from './models/account-settings.model';

@Component({
  selector: 'app-voucher-type-dialog',
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
    MatSlideToggleModule
  ],
  template: `
    <div class="vt-dialog-container">
      <div class="dialog-header">
        <div class="title-group">
          <div class="header-icon-box" [ngClass]="form.get('badgeColor')?.value || 'blue'">
            <mat-icon>{{ form.get('icon')?.value || 'receipt_long' }}</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">{{ isEdit ? 'Edit Voucher Type' : 'Add New Voucher Type' }}</h2>
            <p class="dialog-sub">Configure official classification, reference numbering prefix, and appearance</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <!-- Name & Prefix Grid -->
        <div class="form-grid-2">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Voucher Type Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Payment Voucher or Special Grant" required>
            <mat-icon matPrefix>edit</mat-icon>
            <mat-error *ngIf="form.get('name')?.hasError('required')">Voucher type name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Numbering Prefix (e.g. PV, RV)</mat-label>
            <input matInput formControlName="prefix" placeholder="e.g. PV, RV, SG" (input)="onPrefixInput($event)" uppercase required>
            <mat-icon matPrefix>tag</mat-icon>
            <mat-hint>Auto-generates format: <strong>{{ form.get('prefix')?.value || 'VCH' }}/{{ currentYear }}/1024</strong></mat-hint>
            <mat-error *ngIf="form.get('prefix')?.hasError('required')">Prefix is required</mat-error>
          </mat-form-field>
        </div>

        <!-- Description -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Accounting Purpose / Description</mat-label>
          <textarea matInput formControlName="description" rows="2" placeholder="Describe what transactions are recorded under this voucher type"></textarea>
          <mat-icon matPrefix>description</mat-icon>
        </mat-form-field>

        <!-- Icon & Theme Color -->
        <div class="form-grid-2">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Display Icon</mat-label>
            <mat-select formControlName="icon">
              <mat-option *ngFor="let ic of availableIcons" [value]="ic.icon">
                <mat-icon class="mr-2">{{ ic.icon }}</mat-icon> {{ ic.label }}
              </mat-option>
            </mat-select>
            <mat-icon matPrefix>category</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Badge Color Theme</mat-label>
            <mat-select formControlName="badgeColor">
              <mat-option *ngFor="let col of availableColors" [value]="col.value">
                <span class="color-dot" [ngClass]="col.value"></span> {{ col.label }}
              </mat-option>
            </mat-select>
            <mat-icon matPrefix>palette</mat-icon>
          </mat-form-field>
        </div>

        <!-- Live Preview Strip -->
        <div class="preview-strip">
          <span class="preview-lbl">Preview Badge:</span>
          <span class="sample-type-pill" [ngClass]="form.get('badgeColor')?.value || 'blue'">
            <mat-icon class="pill-icon">{{ form.get('icon')?.value || 'receipt' }}</mat-icon>
            {{ form.get('name')?.value || 'Sample Type' }} ({{ form.get('prefix')?.value || 'VCH' }})
          </span>
          <span class="preview-sample-no font-mono">{{ form.get('prefix')?.value || 'VCH' }}/{{ currentYear }}/1024</span>
        </div>

        <!-- Active Toggle -->
        <div class="toggle-card">
          <div class="toggle-info">
            <span class="toggle-title">Status: {{ form.get('isActive')?.value ? 'Active & Available' : 'Disabled' }}</span>
            <span class="toggle-desc">When disabled, this voucher type will not be selectable in new voucher creation dialogs.</span>
          </div>
          <mat-slide-toggle formControlName="isActive" color="primary"></mat-slide-toggle>
        </div>

        <div class="dialog-actions">
          <button type="button" mat-stroked-button (click)="dialogRef.close()">Cancel</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="form.invalid">
            <mat-icon>check</mat-icon> {{ isEdit ? 'Save Changes' : 'Create Voucher Type' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .vt-dialog-container {
      width: 580px;
      max-width: 95vw;
      display: flex;
      flex-direction: column;
    }
    .dialog-header {
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

        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }

          &.blue { background: #e0f2fe; color: #0284c7; }
          &.green { background: #dcfce7; color: #16a34a; }
          &.amber { background: #fef3c7; color: #d97706; }
          &.purple { background: #ede9fe; color: #7c3aed; }
          &.teal { background: #ccfbf1; color: #0d9488; }
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

    .dialog-body {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .color-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
      &.blue { background: #0284c7; }
      &.green { background: #16a34a; }
      &.amber { background: #d97706; }
      &.purple { background: #7c3aed; }
      &.teal { background: #0d9488; }
    }

    .preview-strip {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;

      .preview-lbl { font-weight: 600; color: #64748b; }

      .sample-type-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 11.5px;

        .pill-icon { font-size: 14px; width: 14px; height: 14px; }

        &.blue { background: #e0f2fe; color: #0369a1; }
        &.green { background: #dcfce7; color: #166534; }
        &.amber { background: #fef3c7; color: #b45309; }
        &.purple { background: #ede9fe; color: #6d28d9; }
        &.teal { background: #ccfbf1; color: #0f766e; }
      }

      .preview-sample-no {
        color: #0284c7;
        font-weight: 700;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        padding: 2px 8px;
        border-radius: 4px;
      }
    }

    .toggle-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;

      .toggle-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        .toggle-title { font-size: 13px; font-weight: 600; color: #0f172a; }
        .toggle-desc { font-size: 11.5px; color: #64748b; }
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
    }
  `]
})
export class VoucherTypeDialogComponent {
  private fb = inject(FormBuilder);
  public dialogRef = inject(MatDialogRef<VoucherTypeDialogComponent>);
  public data: { voucherType?: VoucherTypeConfig } = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data?.voucherType;
  currentYear = new Date().getFullYear();

  availableIcons = [
    { icon: 'payments', label: 'Payments / Currency' },
    { icon: 'receipt', label: 'Receipt / Voucher' },
    { icon: 'receipt_long', label: 'Ledger Long Receipt' },
    { icon: 'account_balance_wallet', label: 'Wallet / Petty Cash' },
    { icon: 'description', label: 'Journal / Document' },
    { icon: 'monetization_on', label: 'Coin / Grant' },
    { icon: 'local_atm', label: 'ATM / Cash Transfer' }
  ];

  availableColors = [
    { value: 'blue', label: 'Ocean Blue (General)' },
    { value: 'green', label: 'Emerald Green (Receipts)' },
    { value: 'amber', label: 'Warm Amber (Petty Cash)' },
    { value: 'purple', label: 'Royal Purple (Journal)' },
    { value: 'teal', label: 'Teal Mint (Grants & Funds)' }
  ];

  form: FormGroup = this.fb.group({
    id: [this.data?.voucherType?.id || ''],
    name: [this.data?.voucherType?.name || '', Validators.required],
    code: [this.data?.voucherType?.code || ''],
    prefix: [this.data?.voucherType?.prefix || this.data?.voucherType?.code || 'PV', Validators.required],
    description: [this.data?.voucherType?.description || ''],
    icon: [this.data?.voucherType?.icon || 'payments'],
    badgeColor: [this.data?.voucherType?.badgeColor || 'blue'],
    isActive: [this.data?.voucherType?.isActive !== undefined ? this.data.voucherType.isActive : true],
    isDefault: [this.data?.voucherType?.isDefault || false],
    order: [this.data?.voucherType?.order || 1]
  });

  onPrefixInput(event: any) {
    const raw = (event.target.value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    this.form.patchValue({ prefix: raw, code: raw });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const val = this.form.value;
    const result: VoucherTypeConfig = {
      id: val.id || `vt_${Date.now()}`,
      name: val.name.trim(),
      code: (val.prefix || val.code || 'PV').trim().toUpperCase(),
      prefix: (val.prefix || 'PV').trim().toUpperCase(),
      description: val.description?.trim() || '',
      icon: val.icon || 'payments',
      badgeColor: val.badgeColor || 'blue',
      isActive: !!val.isActive,
      isDefault: !!val.isDefault,
      order: val.order || 1
    };
    this.dialogRef.close(result);
  }
}
