import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccountClient, AccountClientType, AccountClientStatus } from './models/account-client.model';
import { SettingsService, Division } from '../settings/settings.service';
import { signal, computed } from '@angular/core';

@Component({
  selector: 'app-account-client-dialog',
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
    <div class="client-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title-group">
          <mat-icon class="header-icon">business</mat-icon>
          <div>
            <h2 class="dialog-title">{{ isEdit ? 'Edit Account Client' : 'Register New Account Client' }}</h2>
            <p class="dialog-subtitle">Dedicated payee, vendor, contractor, or beneficiary profile for Account disbursements</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="clientForm" (ngSubmit)="onSubmit()" class="dialog-form">
        <div class="form-grid">
          <!-- Client / Legal Name -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Client / Legal Payee Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Lanka Electricity Company, or Sunil Perera" required>
            <mat-icon matPrefix>person</mat-icon>
          </mat-form-field>

          <!-- Client Classification Type -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Client Type</mat-label>
            <mat-select formControlName="clientType" required>
              <mat-option value="Individual">Individual Payee</mat-option>
              <mat-option value="Business / Vendor">Business / Vendor / Supplier</mat-option>
              <mat-option value="Government Agency">Government / Statutory Agency</mat-option>
              <mat-option value="Employee">Employee / Staff Member</mat-option>
              <mat-option value="Financial Institution">Bank / Financial Institution</mat-option>
              <mat-option value="Other">Other Organization</mat-option>
            </mat-select>
            <mat-icon matPrefix>category</mat-icon>
          </mat-form-field>

          <!-- NIC or Business Registration Number -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>NIC or Business Reg No (BRN)</mat-label>
            <input matInput formControlName="nicOrBrn" placeholder="e.g. PV-12345 or 198512345678">
            <mat-icon matPrefix>badge</mat-icon>
          </mat-form-field>

          <!-- Phone -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Contact Telephone / Mobile</mat-label>
            <input matInput formControlName="phone" placeholder="07XXXXXXXX or 011XXXXXXX" required>
            <mat-icon matPrefix>phone</mat-icon>
          </mat-form-field>

          <!-- Email -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Email Address</mat-label>
            <input matInput type="email" formControlName="email" placeholder="accounts@vendor.com">
            <mat-icon matPrefix>email</mat-icon>
          </mat-form-field>

          <!-- Category / Business Head -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Category / Specialization</mat-label>
            <input matInput formControlName="category" placeholder="e.g. Hardware Supplier, Security Services, Legal">
            <mat-icon matPrefix>folder</mat-icon>
          </mat-form-field>

          <!-- Status -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status" required>
              <mat-option value="active">Active</mat-option>
              <mat-option value="inactive">Inactive</mat-option>
            </mat-select>
            <mat-icon matPrefix>toggle_on</mat-icon>
          </mat-form-field>

          <!-- Address -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Billing / Official Address</mat-label>
            <input matInput formControlName="address" placeholder="Street, City, Postal Code">
            <mat-icon matPrefix>place</mat-icon>
          </mat-form-field>
        </div>

        <!-- Banking Information Section -->
        <div class="section-divider">
          <mat-icon>account_balance</mat-icon>
          <span>Bank & Settlement Particulars</span>
        </div>

        <div class="form-grid">
          <!-- Bank Name -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Bank Name</mat-label>
            <input matInput formControlName="bankName" placeholder="e.g. Bank of Ceylon, Commercial Bank">
            <mat-icon matPrefix>account_balance</mat-icon>
          </mat-form-field>

          <!-- Account Number -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Account Number</mat-label>
            <input matInput formControlName="accountNumber" placeholder="e.g. 10023456789">
            <mat-icon matPrefix>credit_card</mat-icon>
          </mat-form-field>

          <!-- Branch -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Branch Name / Code</mat-label>
            <input matInput formControlName="branch" placeholder="e.g. Colombo City Branch">
            <mat-icon matPrefix>domain</mat-icon>
          </mat-form-field>

          <!-- Division -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Administrative Division (DS Division)</mat-label>
            <mat-select formControlName="division" placeholder="Select DS Division">
              <mat-option *ngFor="let ds of availableDSDivisions()" [value]="ds">{{ ds }}</mat-option>
            </mat-select>
            <mat-icon matPrefix>location_city</mat-icon>
          </mat-form-field>

          <!-- Notes -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Notes & Settlement Remarks</mat-label>
            <textarea matInput formControlName="notes" rows="2" placeholder="Credit terms, tax numbers, or specific settlement instructions"></textarea>
            <mat-icon matPrefix>edit_note</mat-icon>
          </mat-form-field>
        </div>

        <!-- Actions -->
        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="clientForm.invalid">
            <mat-icon>{{ isEdit ? 'save' : 'person_add' }}</mat-icon>
            {{ isEdit ? 'Update Client' : 'Register Client' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .client-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow-y: auto;
      padding: 24px;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #0284c7;
    }
    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .dialog-subtitle {
      font-size: 12px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .col-span-1 { grid-column: span 1; }
    .col-span-2 { grid-column: span 2; }
    .section-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #0369a1;
      margin: 16px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
    }
    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
      .col-span-1, .col-span-2 { grid-column: span 1; }
    }
  `]
})
export class AccountClientDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);
  public dialogRef = inject(MatDialogRef<AccountClientDialogComponent>);
  public data: { client?: AccountClient } = inject(MAT_DIALOG_DATA);

  clientForm!: FormGroup;
  isEdit = false;

  divisions = signal<Division[]>([]);

  private cleanEn(s?: string): string {
    if (!s) return '';
    return s.replace(/[^\x20-\x7E]/g, '')
            .replace(/\//g, '')
            .replace(/(^[\s-]+|[\s-]+$)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
  }

  availableDSDivisions = computed(() => {
    const all = this.divisions() || [];
    const set = new Set<string>();

    for (const d of all) {
      const ds = this.cleanEn(d.divisionalSecretariat);
      if (ds) set.add(ds);
    }

    if (set.size === 0) {
      for (const d of all) {
        const name = this.cleanEn(d.name);
        if (name) set.add(name);
      }
    }

    set.add('General');

    const current = this.data?.client?.division;
    if (current && typeof current === 'string' && current.trim()) {
      set.add(current.trim());
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  ngOnInit() {
    this.settingsService.getDivisions().subscribe({
      next: (divs) => this.divisions.set(divs || []),
      error: () => this.divisions.set([])
    });

    this.isEdit = !!this.data?.client?.id;
    const c = this.data?.client;

    this.clientForm = this.fb.group({
      name: [c?.name || '', [Validators.required]],
      clientType: [c?.clientType || 'Business / Vendor', [Validators.required]],
      nicOrBrn: [c?.nicOrBrn || ''],
      phone: [c?.phone || '', [Validators.required]],
      email: [c?.email || '', [Validators.email]],
      address: [c?.address || ''],
      division: [c?.division || 'General'],
      bankName: [c?.bankName || ''],
      accountNumber: [c?.accountNumber || ''],
      branch: [c?.branch || ''],
      category: [c?.category || 'General Supplies'],
      status: [c?.status || 'active', [Validators.required]],
      notes: [c?.notes || '']
    });
  }

  onSubmit() {
    if (this.clientForm.invalid) return;
    this.dialogRef.close(this.clientForm.value);
  }
}
