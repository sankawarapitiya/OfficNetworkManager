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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PaymentMethodConfig } from './models/account-settings.model';

@Component({
  selector: 'app-payment-method-dialog',
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
    MatSlideToggleModule,
    MatCheckboxModule
  ],
  template: `
    <div class="pm-dialog-container">
      <div class="dialog-header">
        <div class="title-group">
          <div class="header-icon-box">
            <mat-icon>{{ form.get('icon')?.value || 'paid' }}</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">{{ isEdit ? 'Edit Payment Method' : 'Add New Payment Method' }}</h2>
            <p class="dialog-sub">Configure disbursement settlement channel, banking requirements, and tracking rules</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <!-- Name & Code Grid -->
        <div class="form-grid-2">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Payment Method Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Bank Transfer or Direct Deposit" required>
            <mat-icon matPrefix>payments</mat-icon>
            <mat-error *ngIf="form.get('name')?.hasError('required')">Payment method name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Short Code</mat-label>
            <input matInput formControlName="code" placeholder="e.g. CASH, CHQ, BT" (input)="onCodeInput($event)">
            <mat-icon matPrefix>tag</mat-icon>
          </mat-form-field>
        </div>

        <!-- Description -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Method Description / Settlement Details</mat-label>
          <textarea matInput formControlName="description" rows="2" placeholder="e.g. SLIPS / CEFT electronic transfer to beneficiary bank account"></textarea>
          <mat-icon matPrefix>description</mat-icon>
        </mat-form-field>

        <!-- Icon Picker -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Visual Icon</mat-label>
          <mat-select formControlName="icon">
            <mat-option *ngFor="let ic of availableIcons" [value]="ic.icon">
              <mat-icon class="mr-2">{{ ic.icon }}</mat-icon> {{ ic.label }}
            </mat-option>
          </mat-select>
          <mat-icon matPrefix>category</mat-icon>
        </mat-form-field>

        <!-- Accounting Requirements Checkboxes -->
        <div class="requirements-box">
          <h4 class="req-title">Disbursement Input Requirements</h4>
          <p class="req-subtitle">Specify what banking or verification information must be entered when this payment method is selected.</p>

          <div class="req-toggles">
            <div class="req-item">
              <mat-checkbox formControlName="requiresReference" color="primary">
                <span class="chk-label">Requires Reference / Cheque Number</span>
              </mat-checkbox>
              <span class="chk-hint">Prompts the officer to enter a Cheque Number or Transaction Reference code (e.g. CHQ-10492 or SLIPS Ref).</span>
            </div>

            <div class="req-item">
              <mat-checkbox formControlName="requiresBank" color="primary">
                <span class="chk-label">Requires Settlement Bank & Account Particulars</span>
              </mat-checkbox>
              <span class="chk-hint">Prompts for settlement bank name and branch information for audit trail.</span>
            </div>
          </div>
        </div>

        <!-- Active Toggle -->
        <div class="toggle-card">
          <div class="toggle-info">
            <span class="toggle-title">Status: {{ form.get('isActive')?.value ? 'Active & Enabled' : 'Disabled' }}</span>
            <span class="toggle-desc">When disabled, this payment method cannot be selected in the voucher breakdown.</span>
          </div>
          <mat-slide-toggle formControlName="isActive" color="primary"></mat-slide-toggle>
        </div>

        <div class="dialog-actions">
          <button type="button" mat-stroked-button (click)="dialogRef.close()">Cancel</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="form.invalid">
            <mat-icon>check</mat-icon> {{ isEdit ? 'Save Changes' : 'Create Payment Method' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .pm-dialog-container {
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
          background: #ecfdf5;
          color: #059669;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
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

    .requirements-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;

      .req-title {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 2px 0;
      }
      .req-subtitle {
        font-size: 11.5px;
        color: #64748b;
        margin: 0 0 12px 0;
      }

      .req-toggles {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .req-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .chk-label { font-size: 12.5px; font-weight: 600; color: #1e293b; }
          .chk-hint { font-size: 11px; color: #64748b; padding-left: 28px; }
        }
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
export class PaymentMethodDialogComponent {
  private fb = inject(FormBuilder);
  public dialogRef = inject(MatDialogRef<PaymentMethodDialogComponent>);
  public data: { paymentMethod?: PaymentMethodConfig } = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data?.paymentMethod;

  availableIcons = [
    { icon: 'payments', label: 'Cash / Currency' },
    { icon: 'edit_document', label: 'Cheque / Draft' },
    { icon: 'account_balance', label: 'Bank Transfer / Wire' },
    { icon: 'credit_card', label: 'Online / Card Payment' },
    { icon: 'savings', label: 'Treasury / Deposit' },
    { icon: 'swap_horiz', label: 'Direct Transfer' },
    { icon: 'local_atm', label: 'ATM / Counter Service' }
  ];

  form: FormGroup = this.fb.group({
    id: [this.data?.paymentMethod?.id || ''],
    name: [this.data?.paymentMethod?.name || '', Validators.required],
    code: [this.data?.paymentMethod?.code || ''],
    description: [this.data?.paymentMethod?.description || ''],
    icon: [this.data?.paymentMethod?.icon || 'payments'],
    requiresReference: [!!this.data?.paymentMethod?.requiresReference],
    requiresBank: [!!this.data?.paymentMethod?.requiresBank],
    isActive: [this.data?.paymentMethod?.isActive !== undefined ? this.data.paymentMethod.isActive : true],
    isDefault: [this.data?.paymentMethod?.isDefault || false],
    order: [this.data?.paymentMethod?.order || 1]
  });

  onCodeInput(event: any) {
    const raw = (event.target.value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    this.form.patchValue({ code: raw });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const val = this.form.value;
    const result: PaymentMethodConfig = {
      id: val.id || `pm_${Date.now()}`,
      name: val.name.trim(),
      code: (val.code || '').trim().toUpperCase(),
      description: val.description?.trim() || '',
      icon: val.icon || 'payments',
      requiresReference: !!val.requiresReference,
      requiresBank: !!val.requiresBank,
      isActive: !!val.isActive,
      isDefault: !!val.isDefault,
      order: val.order || 1
    };
    this.dialogRef.close(result);
  }
}
