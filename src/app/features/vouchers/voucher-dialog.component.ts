import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AccountClient, AccountClientType } from '../account-clients/models/account-client.model';
import { AccountClientService } from '../account-clients/services/account-client.service';
import { SettingsService, Division } from '../settings/settings.service';
import { Voucher, VoucherType } from './models/voucher.model';

@Component({
  selector: 'app-voucher-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="voucher-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title-group">
          <mat-icon class="header-icon">receipt_long</mat-icon>
          <div>
            <h2 class="dialog-title">{{ isEdit ? 'Edit Voucher' : 'New Voucher Entry' }}</h2>
            <p class="dialog-subtitle">Record and manage financial disbursements, receipts, and client settlement ledger</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="voucherForm" (ngSubmit)="onSubmit()" class="dialog-form">
        <!-- Voucher Vitals Row -->
        <div class="form-grid">
          <!-- Voucher No -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Voucher Number</mat-label>
            <input matInput formControlName="voucherNo" placeholder="e.g. PV/2026/1024" required>
            <mat-icon matPrefix>tag</mat-icon>
          </mat-form-field>

          <!-- Type -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Voucher Type</mat-label>
            <mat-select formControlName="type" required (selectionChange)="onTypeChange($event.value)">
              <mat-option value="Payment Voucher">Payment Voucher (PV)</mat-option>
              <mat-option value="Receipt Voucher">Receipt Voucher (RV)</mat-option>
              <mat-option value="Petty Cash">Petty Cash Voucher (PCV)</mat-option>
              <mat-option value="Journal Voucher">Journal Voucher (JV)</mat-option>
            </mat-select>
            <mat-icon matPrefix>category</mat-icon>
          </mat-form-field>

          <!-- Date -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Voucher Date</mat-label>
            <input matInput type="date" formControlName="date" required>
            <mat-icon matPrefix>event</mat-icon>
          </mat-form-field>

          <!-- Status -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Initial Status</mat-label>
            <mat-select formControlName="status" required>
              <mat-option value="Draft">Draft</mat-option>
              <mat-option value="Pending Approval">Pending Approval</mat-option>
              <mat-option value="Approved">Approved</mat-option>
              <mat-option value="Paid">Paid / Disbursed</mat-option>
            </mat-select>
            <mat-icon matPrefix>info</mat-icon>
          </mat-form-field>
        </div>

        <!-- Payee / Client Section Header with Typeahead and Add Client -->
        <div class="payee-section-header">
          <div class="section-title-wrap">
            <mat-icon>business</mat-icon>
            <span>Payee & Beneficiary Identification (Account Client Dataset)</span>
          </div>
          <button type="button" 
                  mat-stroked-button 
                  color="primary" 
                  class="add-cust-btn"
                  (click)="toggleNewClientMode()">
            <mat-icon>{{ isNewClientMode() ? 'close' : 'person_add' }}</mat-icon>
            {{ isNewClientMode() ? 'Cancel New Client' : '+ Add New Client' }}
          </button>
        </div>

        <!-- TYPEAHEAD SEARCH (When NOT in manual new client registration mode) -->
        <div class="typeahead-card" *ngIf="!isNewClientMode()">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Search Account Client / Payee (Typeahead Name, NIC / BRN, or Phone)</mat-label>
            <input type="text"
                   matInput
                   [formControl]="clientSearchCtrl"
                   [matAutocomplete]="autoClient"
                   placeholder="Type to search Account Clients ledger...">
            <mat-icon matPrefix>person_search</mat-icon>
            <button mat-icon-button matSuffix *ngIf="clientSearchCtrl.value" (click)="clearClientSelection()">
              <mat-icon>close</mat-icon>
            </button>
            <mat-hint>Search dedicated payees, vendors, suppliers, and beneficiaries in Account dataset</mat-hint>

            <!-- Autocomplete Dropdown -->
            <mat-autocomplete #autoClient="matAutocomplete" (optionSelected)="onClientSelected($event)">
              <!-- Option to add new client directly from dropdown -->
              <mat-option [value]="'__ADD_NEW__'" class="add-new-option">
                <div class="add-new-content">
                  <mat-icon color="primary">person_add</mat-icon>
                  <span>Register <strong>"{{ clientSearchCtrl.value || 'New Client' }}"</strong> into Account Clients...</span>
                </div>
              </mat-option>

              <!-- Filtered existing account clients -->
              <mat-option *ngFor="let c of filteredClients()" [value]="c">
                <div class="cust-option-row">
                  <div class="cust-opt-main">
                    <span class="cust-opt-name">{{ c.name }}</span>
                    <span class="cust-opt-badge" [ngClass]="getClientTypeClass(c.clientType)">{{ c.clientType }}</span>
                  </div>
                  <div class="cust-opt-sub">
                    <span *ngIf="c.nicOrBrn">BRN/NIC: {{ c.nicOrBrn }}</span>
                    <span *ngIf="c.phone">• {{ c.phone }}</span>
                    <span *ngIf="c.bankName">• {{ c.bankName }}</span>
                  </div>
                </div>
              </mat-option>

              <mat-option *ngIf="filteredClients().length === 0 && clientSearchCtrl.value" disabled>
                <em>No matching account clients found. Click "+ Add New Client" to register.</em>
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>

          <!-- Linked Profile Indicator Chip -->
          <div class="linked-chip" *ngIf="selectedClient()">
            <mat-icon class="check-icon">check_circle</mat-icon>
            <span>Linked to Account Client: <strong>{{ selectedClient()?.name }}</strong> ({{ selectedClient()?.clientType }}{{ selectedClient()?.nicOrBrn ? ' • ' + selectedClient()?.nicOrBrn : '' }})</span>
            <button type="button" mat-icon-button (click)="clearClientSelection()" matTooltip="Unlink client">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- NEW CLIENT INLINE FORM (Appears when + Add New Client is toggled or chosen from typeahead) -->
        <div class="new-customer-card" *ngIf="isNewClientMode()">
          <div class="new-cust-header">
            <mat-icon color="primary">business</mat-icon>
            <div>
              <span class="new-cust-title">Register New Client in Account Dataset</span>
              <span class="new-cust-sub">This client/vendor will be added to the Account client dataset and linked to this voucher</span>
            </div>
          </div>

          <div class="form-grid pt-2">
            <!-- Full Legal Name -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Client / Legal Payee Name</mat-label>
              <input matInput [formControl]="newClientNameCtrl" placeholder="e.g. Lanka Electricity Co or Sunil Gamage" required>
              <mat-icon matPrefix>person</mat-icon>
            </mat-form-field>

            <!-- Classification Type -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Client Classification</mat-label>
              <mat-select [formControl]="newClientTypeCtrl" required>
                <mat-option value="Business / Vendor">Business / Vendor / Supplier</mat-option>
                <mat-option value="Individual">Individual Payee</mat-option>
                <mat-option value="Government Agency">Government / Statutory Agency</mat-option>
                <mat-option value="Employee">Employee / Staff</mat-option>
                <mat-option value="Financial Institution">Financial Institution</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
              <mat-icon matPrefix>category</mat-icon>
            </mat-form-field>

            <!-- NIC or BRN -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>NIC or Business Reg No (BRN)</mat-label>
              <input matInput [formControl]="newClientNicBrnCtrl" placeholder="e.g. PV-12345 or 198214500123">
              <mat-icon matPrefix>badge</mat-icon>
            </mat-form-field>

            <!-- Phone -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Mobile / Office Telephone</mat-label>
              <input matInput [formControl]="newClientPhoneCtrl" placeholder="07XXXXXXXX or 011XXXXXXX" required>
              <mat-icon matPrefix>phone</mat-icon>
            </mat-form-field>

            <!-- Settlement Bank Name -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Settlement Bank Name</mat-label>
              <input matInput [formControl]="newClientBankNameCtrl" placeholder="e.g. Bank of Ceylon">
              <mat-icon matPrefix>account_balance</mat-icon>
            </mat-form-field>

            <!-- Settlement Account Number -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Bank Account Number</mat-label>
              <input matInput [formControl]="newClientAccountNoCtrl" placeholder="e.g. 10023456789">
              <mat-icon matPrefix>credit_card</mat-icon>
            </mat-form-field>

            <!-- Address -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Official / Permanent Address</mat-label>
              <input matInput [formControl]="newClientAddressCtrl" placeholder="Street, City, Postal Code">
              <mat-icon matPrefix>place</mat-icon>
            </mat-form-field>
          </div>

          <div class="save-registry-row">
            <mat-checkbox [checked]="saveToClientDataset()" (change)="saveToClientDataset.set($event.checked)" color="primary">
              Automatically save client to central Account Clients ledger
            </mat-checkbox>
          </div>
        </div>

        <!-- Manual Payee Details (shown when NOT in new client mode, with auto-filled values) -->
        <div class="form-grid" *ngIf="!isNewClientMode()">
          <!-- Payee Name -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Payee / Beneficiary Name</mat-label>
            <input matInput formControlName="payeeName" placeholder="Full legal name or agency" required>
            <mat-icon matPrefix>person</mat-icon>
          </mat-form-field>

          <!-- Payee NIC / BRN -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Payee NIC / BRN Number</mat-label>
            <input matInput formControlName="payeeNic" placeholder="NIC or Registration No.">
            <mat-icon matPrefix>badge</mat-icon>
          </mat-form-field>

          <!-- Payee Phone -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Contact Phone</mat-label>
            <input matInput formControlName="payeePhone" placeholder="07XXXXXXXX">
            <mat-icon matPrefix>phone</mat-icon>
          </mat-form-field>

          <!-- Department -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Department / Branch</mat-label>
            <input matInput formControlName="department" placeholder="e.g. Accounts, Admin, Works">
            <mat-icon matPrefix>apartment</mat-icon>
          </mat-form-field>
        </div>


        <!-- Financial Particulars -->
        <div class="section-divider">
          <span>Financial Particulars & Payment Method</span>
        </div>

        <div class="form-grid">
          <!-- Amount -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Total Amount (LKR)</mat-label>
            <input matInput type="number" formControlName="amount" min="0.01" step="0.01" placeholder="0.00" required>
            <mat-icon matPrefix>payments</mat-icon>
          </mat-form-field>

          <!-- Payment Method -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Payment Method</mat-label>
            <mat-select formControlName="paymentMethod" required>
              <mat-option value="Cash">Cash Payment</mat-option>
              <mat-option value="Cheque">Official Cheque</mat-option>
              <mat-option value="Bank Transfer">Direct Bank Transfer</mat-option>
              <mat-option value="Online / Card">Online / Card Gateway</mat-option>
            </mat-select>
            <mat-icon matPrefix>account_balance_wallet</mat-icon>
          </mat-form-field>

          <!-- Cheque / Ref No -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Cheque / Reference Number</mat-label>
            <input matInput formControlName="referenceNo" placeholder="Cheque or Bank Ref">
            <mat-icon matPrefix>receipt</mat-icon>
          </mat-form-field>

          <!-- Bank Name -->
          <mat-form-field appearance="outline" class="col-span-1">
            <mat-label>Bank & Branch Name</mat-label>
            <input matInput formControlName="bankName" placeholder="e.g. Bank of Ceylon - Colombo">
            <mat-icon matPrefix>account_balance</mat-icon>
          </mat-form-field>

          <!-- Category -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Classification / Budget Head</mat-label>
            <input matInput formControlName="category" placeholder="e.g. Office Supplies, Contract Compensation, Legal Clearance">
            <mat-icon matPrefix>folder</mat-icon>
          </mat-form-field>

          <!-- Description -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Description / Particulars of Payment</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="State reason, bill particulars or resolution" required></textarea>
            <mat-icon matPrefix>description</mat-icon>
          </mat-form-field>

          <!-- Remarks -->
          <mat-form-field appearance="outline" class="col-span-2">
            <mat-label>Internal Remarks / Notes</mat-label>
            <input matInput formControlName="remarks" placeholder="Audit remarks or accounting notes">
            <mat-icon matPrefix>edit_note</mat-icon>
          </mat-form-field>
        </div>

        <!-- Actions -->
        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="isSubmitDisabled()">
            <mat-icon>{{ isEdit ? 'save' : 'add_task' }}</mat-icon>
            {{ isEdit ? 'Save Changes' : (isNewClientMode() ? 'Register Client & Create Voucher' : 'Create Voucher') }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .voucher-dialog-container {
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
    .w-full { width: 100%; }

    .payee-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 16px 0 10px 0;
      padding-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;

      .section-title-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #0369a1;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .add-cust-btn {
        font-size: 12px;
        height: 32px;
        line-height: 32px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      }
    }

    .typeahead-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
    }

    .linked-chip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12.5px;
      color: #0369a1;
      margin-top: 6px;

      .check-icon { font-size: 16px; width: 16px; height: 16px; color: #0284c7; margin-right: 6px; }
      button { width: 22px; height: 22px; line-height: 22px; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    }

    .new-customer-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;

      .new-cust-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        mat-icon { font-size: 24px; width: 24px; height: 24px; color: #059669; }
        .new-cust-title { font-size: 13px; font-weight: 700; color: #166534; display: block; }
        .new-cust-sub { font-size: 11px; color: #15803d; display: block; }
      }
      .save-registry-row { margin-top: 6px; }
    }


    .cust-option-row {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
      line-height: 1.3;

      .cust-opt-main {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .cust-opt-name { font-weight: 600; font-size: 13px; color: #0f172a; }
        .cust-opt-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px;
          background: #f1f5f9;
          color: #475569;

          &.vendor { background: #fef3c7; color: #b45309; }
          &.gov { background: #ede9fe; color: #6d28d9; }
          &.employee { background: #dcfce7; color: #15803d; }
        }
      }

      .cust-opt-sub {
        font-size: 11px;
        color: #64748b;
        margin-top: 2px;
      }
    }

    .add-new-option {
      background: #eff6ff;
      border-bottom: 1px solid #dbeafe;

      .add-new-content {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1d4ed8;
        font-size: 13px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

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
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
    }
  `]
})
export class VoucherDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<VoucherDialogComponent>);
  private fb = inject(FormBuilder);
  private clientService = inject(AccountClientService);
  private settingsService = inject(SettingsService);

  clients = signal<AccountClient[]>([]);
  divisions = signal<Division[]>([]);
  voucherForm!: FormGroup;
  isEdit = false;

  // Typeahead control & state for Account Client
  clientSearchCtrl = new FormControl('');
  selectedClient = signal<AccountClient | null>(null);

  // Inline "Add New Client" state & controls
  isNewClientMode = signal<boolean>(false);
  saveToClientDataset = signal<boolean>(true);

  newClientNameCtrl = new FormControl('', [Validators.required]);
  newClientTypeCtrl = new FormControl('Business / Vendor', [Validators.required]);
  newClientNicBrnCtrl = new FormControl('');
  newClientPhoneCtrl = new FormControl('', [Validators.required]);
  newClientEmailCtrl = new FormControl('');
  newClientBankNameCtrl = new FormControl('');
  newClientAccountNoCtrl = new FormControl('');
  newClientAddressCtrl = new FormControl('');

  filteredClients = computed(() => {
    const list = this.clients();
    const query = (this.clientSearchCtrl.value || '').toLowerCase().trim();
    if (!query) {
      return list.slice(0, 8);
    }
    return list.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.nicOrBrn && c.nicOrBrn.toLowerCase().includes(query)) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.bankName && c.bankName.toLowerCase().includes(query))
    ).slice(0, 10);
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { voucher?: Voucher; defaultVoucherNo?: string }) {
    this.isEdit = !!data?.voucher?.id;
  }

  ngOnInit() {
    this.initForm();
    this.loadClients();
    this.loadDivisions();
  }

  private initForm() {
    const today = new Date().toISOString().split('T')[0];
    const v = this.data?.voucher;

    this.voucherForm = this.fb.group({
      voucherNo: [v?.voucherNo || this.data?.defaultVoucherNo || '', Validators.required],
      type: [v?.type || 'Payment Voucher', Validators.required],
      date: [v?.date || today, Validators.required],
      status: [v?.status || 'Draft', Validators.required],
      clientId: [v?.clientId || ''],
      clientType: [v?.clientType || 'Business / Vendor'],
      payeeName: [v?.payeeName || '', Validators.required],
      payeeNic: [v?.payeeNic || ''],
      payeePhone: [v?.payeePhone || ''],
      taskId: [v?.taskId || ''],
      taskType: [v?.taskType || null],
      taskTitle: [v?.taskTitle || ''],
      taskRef: [v?.taskRef || ''],
      department: [v?.department || 'Accounts'],
      division: [v?.division || 'General'],
      category: [v?.category || 'Office Operational Expenses'],
      description: [v?.description || '', Validators.required],
      amount: [v?.amount !== undefined ? v.amount : '', [Validators.required, Validators.min(0.01)]],
      paymentMethod: [v?.paymentMethod || 'Cash', Validators.required],
      referenceNo: [v?.referenceNo || ''],
      bankName: [v?.bankName || ''],
      remarks: [v?.remarks || '']
    });

    if (v?.payeeName) {
      this.clientSearchCtrl.setValue(v.payeeName);
    }
  }

  private loadClients() {
    this.clientService.getClients().subscribe({
      next: (clients) => {
        this.clients.set(clients || []);
        if (this.data?.voucher?.clientId) {
          const match = clients.find(c => c.id === this.data.voucher?.clientId);
          if (match) {
            this.selectedClient.set(match);
          }
        }
      },
      error: () => this.clients.set([])
    });
  }

  private loadDivisions() {
    this.settingsService.getDivisions().subscribe({
      next: (divs) => this.divisions.set(divs || []),
      error: () => this.divisions.set([])
    });
  }


  getClientTypeClass(type: string): string {
    switch (type) {
      case 'Business / Vendor': return 'vendor';
      case 'Government Agency': return 'gov';
      case 'Employee': return 'employee';
      default: return 'individual';
    }
  }

  onTypeChange(newType: VoucherType) {
    if (!this.isEdit) {
      const year = new Date().getFullYear();
      const prefix = newType === 'Receipt Voucher' ? 'RV' : (newType === 'Petty Cash' ? 'PCV' : (newType === 'Journal Voucher' ? 'JV' : 'PV'));
      const randSeq = Math.floor(1000 + Math.random() * 9000);
      this.voucherForm.patchValue({ voucherNo: `${prefix}/${year}/${randSeq}` });
    }
  }

  onClientSelected(event: MatAutocompleteSelectedEvent) {
    const val = event.option.value;

    if (val === '__ADD_NEW__') {
      const currentQuery = this.clientSearchCtrl.value || '';
      this.openNewClientMode(currentQuery);
      return;
    }

    const client: AccountClient = val;
    this.selectedClient.set(client);
    this.clientSearchCtrl.setValue(client.name, { emitEvent: false });

    this.voucherForm.patchValue({
      clientId: client.id || '',
      clientType: client.clientType || 'Business / Vendor',
      payeeName: client.name,
      payeeNic: client.nicOrBrn || '',
      payeePhone: client.phone || '',
      bankName: client.bankName || this.voucherForm.value.bankName,
      division: client.division || this.voucherForm.value.division
    });
  }


  clearClientSelection() {
    this.clientSearchCtrl.setValue('');
    this.selectedClient.set(null);
    this.voucherForm.patchValue({
      clientId: '',
      payeeName: '',
      payeeNic: '',
      payeePhone: ''
    });
  }

  toggleNewClientMode() {
    if (this.isNewClientMode()) {
      this.isNewClientMode.set(false);
    } else {
      const currentQuery = this.clientSearchCtrl.value || '';
      this.openNewClientMode(currentQuery);
    }
  }

  openNewClientMode(initialName: string = '') {
    this.isNewClientMode.set(true);
    this.selectedClient.set(null);
    if (initialName && initialName !== '__ADD_NEW__') {
      this.newClientNameCtrl.setValue(initialName);
    }
  }

  isSubmitDisabled(): boolean {
    if (this.isNewClientMode()) {
      return this.newClientNameCtrl.invalid ||
             this.newClientPhoneCtrl.invalid ||
             this.voucherForm.get('voucherNo')?.invalid ||
             this.voucherForm.get('amount')?.invalid ||
             this.voucherForm.get('description')?.invalid ||
             false;
    }
    return this.voucherForm.invalid;
  }

  async onSubmit() {
    if (this.isSubmitDisabled()) return;

    let clientId = this.voucherForm.value.clientId;
    let clientType = this.voucherForm.value.clientType || 'Business / Vendor';
    let payeeName = this.voucherForm.value.payeeName;
    let payeeNic = this.voucherForm.value.payeeNic;
    let payeePhone = this.voucherForm.value.payeePhone;
    let bankName = this.voucherForm.value.bankName;

    // Handle inline new client registration
    if (this.isNewClientMode()) {
      payeeName = this.newClientNameCtrl.value || 'Payee';
      clientType = this.newClientTypeCtrl.value || 'Business / Vendor';
      payeeNic = this.newClientNicBrnCtrl.value || '';
      payeePhone = this.newClientPhoneCtrl.value || '';
      bankName = this.newClientBankNameCtrl.value || bankName;

      if (this.saveToClientDataset()) {
        try {
          const newClient: Omit<AccountClient, 'id'> = {
            name: payeeName,
            clientType: clientType as AccountClientType,
            nicOrBrn: payeeNic,
            phone: payeePhone,
            email: this.newClientEmailCtrl.value || '',
            bankName: bankName,
            accountNumber: this.newClientAccountNoCtrl.value || '',
            address: this.newClientAddressCtrl.value || '',
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          clientId = await this.clientService.addClient(newClient);
        } catch (e) {
          console.error('Failed to register new account client:', e);
        }
      }
    }

    const payload = {
      ...this.voucherForm.value,
      clientId: clientId || '',
      clientType,
      payeeName,
      payeeNic,
      payeePhone,
      bankName
    };

    this.dialogRef.close(payload);
  }
}
