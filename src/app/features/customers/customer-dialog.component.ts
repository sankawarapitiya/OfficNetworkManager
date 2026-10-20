import { Component, Inject, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Division } from '../settings/settings.service';
import { Customer } from './services/customer.service';

@Component({
  selector: 'app-customer-dialog',
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
    <div class="dialog-header-wrap">
      <div class="header-icon-box" [class.edit-mode]="isEditMode">
        <mat-icon>{{ isEditMode ? 'person_edit' : 'person_add' }}</mat-icon>
      </div>
      <div>
        <h2 mat-dialog-title class="dialog-title">
          {{ isEditMode ? 'Edit Customer Details' : 'Customer Registration' }}
        </h2>
        <p class="dialog-subtitle">
          {{ isEditMode 
              ? 'Update citizen identity, contact information, and divisional registration.' 
              : 'Register citizen or corporate entity in the central registry.' }}
        </p>
      </div>
    </div>

    <mat-dialog-content class="dialog-content-body">
      <form [formGroup]="customerForm" class="dialog-form pt-2">
        <!-- Row 1: Full Name & NIC -->
        <div class="form-row-2">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Full Name</mat-label>
            <mat-icon matPrefix class="field-icon">person</mat-icon>
            <input matInput formControlName="name" required placeholder="e.g. K. M. Bandara">
            <mat-error *ngIf="customerForm.get('name')?.hasError('required')">Name is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>NIC Number</mat-label>
            <mat-icon matPrefix class="field-icon">badge</mat-icon>
            <input matInput formControlName="nic" required placeholder="e.g. 198512345678 or 851234567V">
            <mat-error *ngIf="customerForm.get('nic')?.hasError('required')">NIC number is required</mat-error>
          </mat-form-field>
        </div>

        <!-- Row 2: Phone & Email -->
        <div class="form-row-2">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Telephone / Mobile</mat-label>
            <mat-icon matPrefix class="field-icon">phone</mat-icon>
            <input matInput formControlName="tpno" required placeholder="e.g. 0771234567">
            <mat-error *ngIf="customerForm.get('tpno')?.hasError('required')">Telephone number is required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Email Address (Optional)</mat-label>
            <mat-icon matPrefix class="field-icon">email</mat-icon>
            <input matInput formControlName="email" type="email" placeholder="e.g. citizen@example.com">
            <mat-error *ngIf="customerForm.get('email')?.hasError('email')">Please enter a valid email address</mat-error>
          </mat-form-field>
        </div>

        <!-- Row 3: Postal Address -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Postal / Permanent Address</mat-label>
          <mat-icon matPrefix class="field-icon">place</mat-icon>
          <textarea matInput formControlName="address" rows="2" required placeholder="e.g. No. 42, Temple Road, Kandy"></textarea>
          <mat-error *ngIf="customerForm.get('address')?.hasError('required')">Address is required</mat-error>
        </mat-form-field>

        <!-- Row 4: DS Division & GN Division Dropdowns -->
        <div class="form-row-2">
          <!-- DS Division Select Dropdown -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>DS Division</mat-label>
            <mat-icon matPrefix class="field-icon">domain</mat-icon>
            <mat-select formControlName="division" required placeholder="Select DS Division" (selectionChange)="onDSDivisionChange($event.value)">
              <!-- Search inside DS Division dropdown if many -->
              <div class="select-search-box" (click)="$event.stopPropagation()" *ngIf="availableDSDivisions().length > 6">
                <mat-icon class="search-mini-icon">search</mat-icon>
                <input class="search-mini-input" 
                       placeholder="Filter DS divisions..." 
                       [value]="dsSearchTerm()" 
                       (input)="dsSearchTerm.set($any($event.target).value)"
                       (keydown)="$event.stopPropagation()">
                <button *ngIf="dsSearchTerm()" type="button" class="clear-mini-btn" (click)="dsSearchTerm.set(''); $event.stopPropagation()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <mat-option *ngFor="let ds of filteredDSDivisions()" [value]="ds">
                {{ ds }}
              </mat-option>
              <mat-option *ngIf="filteredDSDivisions().length === 0" disabled>
                No matching DS divisions found
              </mat-option>
            </mat-select>
            <mat-error *ngIf="customerForm.get('division')?.hasError('required')">DS Division is required</mat-error>
          </mat-form-field>

          <!-- GN Division Select Dropdown (Filtered by selected DS Division) -->
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>GN Division</mat-label>
            <mat-icon matPrefix class="field-icon">map</mat-icon>
            <mat-select formControlName="gnDivision" placeholder="Select GN Division">
              <!-- Search inside GN Division dropdown -->
              <div class="select-search-box" (click)="$event.stopPropagation()" *ngIf="availableGNDivisions().length > 6">
                <mat-icon class="search-mini-icon">search</mat-icon>
                <input class="search-mini-input" 
                       placeholder="Search GN division or code..." 
                       [value]="gnSearchTerm()" 
                       (input)="gnSearchTerm.set($any($event.target).value)"
                       (keydown)="$event.stopPropagation()">
                <button *ngIf="gnSearchTerm()" type="button" class="clear-mini-btn" (click)="gnSearchTerm.set(''); $event.stopPropagation()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <mat-option value="">-- None / Select Later --</mat-option>
              <mat-option *ngFor="let gn of filteredGNDivisions()" [value]="gn">
                {{ gn }}
              </mat-option>
              <mat-option *ngIf="filteredGNDivisions().length === 0" disabled>
                No GN divisions available for this DS Division
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Row 5: Status -->
        <div class="form-row-1" *ngIf="isEditMode">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Account Status</mat-label>
            <mat-icon matPrefix class="field-icon">toggle_on</mat-icon>
            <mat-select formControlName="status">
              <mat-option value="active">Active (Permitted for New Filings)</mat-option>
              <mat-option value="inactive">Inactive (Restricted / Archived)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions-bar">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="customerForm.invalid" (click)="onSave()">
        <mat-icon>{{ isEditMode ? 'check_circle' : 'save' }}</mat-icon>
        {{ isEditMode ? 'Update Customer Details' : 'Save Customer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px 12px 24px;
      border-bottom: 1px solid var(--border-subtle, #e2e8f0);

      .header-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #eef2ff;
        color: #4f46e5;
        display: flex;
        align-items: center;
        justify-content: center;

        &.edit-mode {
          background: #ecfdf5;
          color: #059669;
        }

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .dialog-title {
        margin: 0;
        padding: 0;
        font-size: 19px;
        font-weight: 700;
        color: var(--text-primary, #0f172a);
        line-height: 1.2;
      }

      .dialog-subtitle {
        margin: 3px 0 0 0;
        font-size: 12.5px;
        color: var(--text-muted, #64748b);
      }
    }

    .dialog-content-body {
      padding: 16px 24px !important;
      max-height: 75vh;
      overflow-y: auto;
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 480px;

      @media (max-width: 600px) {
        min-width: 100%;
      }
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }

    .form-row-1 {
      display: flex;
    }

    .w-full {
      width: 100%;
    }

    .field-icon {
      color: var(--text-subtle, #94a3b8);
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 6px;
    }

    .select-search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-subtle, #e2e8f0);
      background: #f8fafc;
      position: sticky;
      top: 0;
      z-index: 10;

      .search-mini-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #94a3b8;
      }

      .search-mini-input {
        border: none;
        outline: none;
        background: transparent;
        font-size: 13px;
        color: #0f172a;
        width: 100%;
        padding: 4px 0;

        &::placeholder {
          color: #94a3b8;
        }
      }

      .clear-mini-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        color: #94a3b8;
        &:hover { color: #0f172a; }
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
    }

    .dialog-actions-bar {
      padding: 12px 24px 20px 24px;
      border-top: 1px solid var(--border-subtle, #e2e8f0);
      display: flex;
      gap: 10px;

      button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
  `]
})
export class CustomerDialogComponent {
  private fb = inject(FormBuilder);
  
  customerForm: FormGroup;
  isEditMode: boolean = false;

  dsSearchTerm = signal<string>('');
  gnSearchTerm = signal<string>('');
  selectedDSDivision = signal<string>('');

  private cleanEn(s?: string): string {
    if (!s) return '';
    return s.replace(/[^\x20-\x7E]/g, '')
            .replace(/\//g, '')
            .replace(/(^[\s-]+|[\s-]+$)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
  }

  availableDSDivisions = computed(() => {
    const all = this.data.divisions || [];
    const set = new Set<string>();

    for (const d of all) {
      const ds = this.cleanEn(d.divisionalSecretariat);
      if (ds) set.add(ds);
    }

    // Fallback: If no divisionalSecretariat is defined on records, use d.name
    if (set.size === 0) {
      for (const d of all) {
        const name = this.cleanEn(d.name);
        if (name) set.add(name);
      }
    }

    // Retain customer's existing division if present
    if (this.data.customer?.division) {
      const current = this.cleanEn(this.data.customer.division);
      if (current) set.add(current);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  filteredDSDivisions = computed(() => {
    const term = this.dsSearchTerm().toLowerCase().trim();
    const list = this.availableDSDivisions();
    if (!term) return list;
    return list.filter(ds => ds.toLowerCase().includes(term));
  });

  availableGNDivisions = computed(() => {
    const selectedDs = this.selectedDSDivision();
    const all = this.data.divisions || [];
    const set = new Set<string>();

    for (const d of all) {
      const ds = this.cleanEn(d.divisionalSecretariat);
      // Filter by selected DS division if one is chosen
      if (!selectedDs || !ds || ds.toLowerCase() === selectedDs.toLowerCase()) {
        const val = d.gnCode ? `${d.gnCode} - ${d.name}` : d.name;
        if (val && val.trim()) {
          set.add(val.trim());
        }
      }
    }

    // Retain customer's existing GN division if present
    if (this.data.customer?.gnDivision && this.data.customer.gnDivision.trim()) {
      set.add(this.data.customer.gnDivision.trim());
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  filteredGNDivisions = computed(() => {
    const term = this.gnSearchTerm().toLowerCase().trim();
    const list = this.availableGNDivisions();
    if (!term) return list;
    return list.filter(gn => gn.toLowerCase().includes(term));
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { customer?: Customer, divisions: Division[] },
    public dialogRef: MatDialogRef<CustomerDialogComponent>
  ) {
    this.isEditMode = !!data.customer;
    const initialDs = data.customer?.division || '';
    this.selectedDSDivision.set(initialDs);

    this.customerForm = this.fb.group({
      name: [data.customer?.name || '', Validators.required],
      nic: [data.customer?.nic || '', Validators.required],
      address: [data.customer?.address || '', Validators.required],
      tpno: [data.customer?.tpno || '', Validators.required],
      email: [data.customer?.email || '', [Validators.email]],
      division: [initialDs, Validators.required],
      gnDivision: [data.customer?.gnDivision || ''],
      status: [data.customer?.status || 'active', Validators.required]
    });
  }

  onDSDivisionChange(newDs: string) {
    this.selectedDSDivision.set(newDs);
    this.gnSearchTerm.set('');
    this.customerForm.patchValue({ division: newDs });

    // Clear current GN division if it doesn't belong to the newly selected DS division
    const available = this.availableGNDivisions();
    const currentGN = this.customerForm.get('gnDivision')?.value;
    if (currentGN && !available.includes(currentGN)) {
      this.customerForm.patchValue({ gnDivision: '' });
    }
  }

  onSave() {
    if (this.customerForm.valid) {
      this.dialogRef.close(this.customerForm.value);
    }
  }
}
