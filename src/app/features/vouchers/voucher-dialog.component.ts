import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AccountClient, AccountClientType } from '../account-clients/models/account-client.model';
import { AccountClientService } from '../account-clients/services/account-client.service';
import { AccountClientDialogComponent } from '../account-clients/account-client-dialog.component';
import { SettingsService, Division } from '../settings/settings.service';
import { AccountSettingsService } from '../account-settings/services/account-settings.service';
import { Voucher, VoucherType, PaymentMethod, VoucherPaymentSplit, VoucherPayeeSplit } from './models/voucher.model';

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
    MatTooltipModule
  ],
  template: `
    <div class="voucher-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-title-group">
          <mat-icon class="header-icon">receipt_long</mat-icon>
          <div>
            <h2 class="dialog-title">{{ isEdit ? 'Edit Financial Voucher' : 'New Financial Voucher Entry' }}</h2>
            <p class="dialog-subtitle">Configure payment methods with allocated payees, sub-vouchers, and ledger settlements</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="voucherForm" (ngSubmit)="onSubmit()" class="dialog-form">
        <!-- Voucher Vitals Grid -->
        <div class="vitals-card">
          <div class="form-grid">
            <!-- Voucher No -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Master Voucher Number</mat-label>
              <input matInput formControlName="voucherNo" placeholder="e.g. PV/2026/1024" required (input)="onVoucherNoChange()">
              <mat-icon matPrefix>tag</mat-icon>
            </mat-form-field>

            <!-- Total Amount of Voucher -->
            <mat-form-field appearance="outline" class="col-span-1 total-amount-field">
              <mat-label>Total Amount of Voucher (LKR)</mat-label>
              <input matInput type="number" formControlName="amount" placeholder="0.00" min="0.01" step="0.01" required (input)="onTotalAmountInput()">
              <mat-icon matPrefix>payments</mat-icon>
              <span matSuffix class="currency-tag">LKR</span>
              <mat-error *ngIf="voucherForm.get('amount')?.hasError('required')">Total amount is required</mat-error>
              <mat-error *ngIf="voucherForm.get('amount')?.hasError('min')">Amount must be greater than 0</mat-error>
            </mat-form-field>

            <!-- Date -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Voucher Date</mat-label>
              <input matInput type="date" formControlName="date" required>
              <mat-icon matPrefix>event</mat-icon>
            </mat-form-field>

            <!-- Status -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status" required>
                <mat-option value="Draft">Draft</mat-option>
                <mat-option value="Pending Approval">Pending Approval</mat-option>
                <mat-option value="Approved">Approved</mat-option>
                <mat-option value="Paid">Paid / Disbursed</mat-option>
              </mat-select>
              <mat-icon matPrefix>info</mat-icon>
            </mat-form-field>

            <!-- Administrative Division (DS Division) -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Administrative Division (DS Division)</mat-label>
              <mat-select formControlName="division" placeholder="Select DS Division">
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
              <mat-icon matPrefix>domain</mat-icon>
            </mat-form-field>

            <!-- Category / Budget Head -->
            <mat-form-field appearance="outline" class="col-span-1">
              <mat-label>Classification / Budget Head</mat-label>
              <input matInput formControlName="category" placeholder="e.g. Office Operational Expenses">
              <mat-icon matPrefix>folder</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <!-- MAIN SECTION: PAYMENT METHODS BREAKDOWN & NESTED PAYEES ALLOCATION -->
        <div class="payments-container">
          <div class="section-top-header">
            <div class="top-title-group">
              <div class="section-icon-badge">
                <mat-icon>account_balance_wallet</mat-icon>
              </div>
              <div>
                <h3 class="section-main-title">Payment Methods & Payees Allocation</h3>
                <p class="section-sub-title">Add payment methods (Cheque, Cash, Bank Transfer), and assign multiple payees with auto-generated sub-vouchers under each method</p>
              </div>
            </div>
            <div class="top-actions-right">
              <!-- Live balance summary pill -->
              <div class="master-balance-pill" [class.balanced]="isPaymentsBalancedWithTotal()" [class.unbalanced]="!isPaymentsBalancedWithTotal()">
                <mat-icon>{{ isPaymentsBalancedWithTotal() ? 'verified' : 'balance' }}</mat-icon>
                <div class="pill-amounts">
                  <span class="pill-label">Voucher Target:</span>
                  <span class="pill-val">LKR {{ totalVoucherAmount() | number:'1.2-2' }}</span>
                  <span class="pill-sep">•</span>
                  <span class="pill-label">Methods:</span>
                  <span class="pill-val" [class.mismatch]="!isPaymentsBalancedWithTotal()">LKR {{ sumOfPaymentMethods() | number:'1.2-2' }}</span>
                </div>
                <button *ngIf="!isPaymentsBalancedWithTotal() && totalVoucherAmount() > 0" 
                        type="button" 
                        mat-stroked-button 
                        class="pill-balance-btn"
                        matTooltip="Auto-balance payment methods to match Total Voucher Amount" 
                        (click)="autoBalancePaymentsWithTotal()">
                  <mat-icon>auto_fix_high</mat-icon> Balance Methods
                </button>
              </div>

              <button type="button" mat-flat-button color="primary" class="add-pm-btn" (click)="addPayment()">
                <mat-icon>add_card</mat-icon> + Add Another Payment Method
              </button>
            </div>
          </div>

          <!-- List of Payment Methods -->
          <div formArrayName="payments" class="payment-methods-list">
            <div *ngFor="let pmGroup of paymentsArray.controls; let j = index" [formGroupName]="j" class="payment-block-card">
              
              <!-- Payment Method Bar -->
              <div class="pm-header-bar">
                <div class="pm-badge-title">
                  <span class="pm-num">Method #{{ j + 1 }}</span>
                  <span class="pm-type-tag">{{ pmGroup.get('paymentMethod')?.value }}</span>
                  <span class="pm-amount-text" *ngIf="getPaymentMethodAmount(j) > 0">
                    LKR {{ getPaymentMethodAmount(j) | number:'1.2-2' }}
                  </span>
                </div>
                <div class="pm-header-actions">
                  <button type="button" 
                          mat-button 
                          class="sync-amount-btn" 
                          (click)="syncPaymentAmountFromPayees(j)" 
                          matTooltip="Set payment amount equal to the sum of its payees">
                    <mat-icon>sync</mat-icon> Match Payees Sum (LKR {{ getPaymentPayeesSum(j) | number:'1.2-2' }})
                  </button>
                  <button type="button" 
                          mat-icon-button 
                          color="warn" 
                          class="del-pm-btn" 
                          *ngIf="paymentsArray.length > 1" 
                          (click)="removePayment(j)" 
                          matTooltip="Delete this payment method">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Payment Method Inputs -->
              <div class="pm-inputs-grid">
                <!-- Payment Method Type -->
                <mat-form-field appearance="outline" class="col-field">
                  <mat-label>Payment Method</mat-label>
                  <mat-select formControlName="paymentMethod" required>
                    <mat-option *ngFor="let pm of activePaymentMethods()" [value]="pm.name">
                      {{ pm.name }}
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix>paid</mat-icon>
                </mat-form-field>

                <!-- Amount (LKR) -->
                <mat-form-field appearance="outline" class="col-field">
                  <mat-label>Payment Method Amount (LKR)</mat-label>
                  <input matInput type="number" formControlName="amount" min="0.01" step="0.01" placeholder="0.00" required>
                  <mat-icon matPrefix>payments</mat-icon>
                </mat-form-field>

                <!-- Reference / Cheque No -->
                <mat-form-field appearance="outline" class="col-field">
                  <mat-label>Cheque / Reference Number</mat-label>
                  <input matInput formControlName="referenceNo" placeholder="e.g. CHQ-882109 or Bank Ref">
                  <mat-icon matPrefix>receipt</mat-icon>
                </mat-form-field>

                <!-- Settlement Bank & Branch -->
                <mat-form-field appearance="outline" class="col-field">
                  <mat-label>Settlement Bank & Branch</mat-label>
                  <input matInput formControlName="bankName" placeholder="e.g. Bank of Ceylon - Colombo">
                  <mat-icon matPrefix>account_balance</mat-icon>
                </mat-form-field>
              </div>

              <!-- SUB-SECTION: PAYEES UNDER THIS PAYMENT METHOD -->
              <div class="nested-payees-wrapper">
                <div class="nested-payees-header">
                  <div class="np-title-wrap">
                    <mat-icon class="np-icon">groups</mat-icon>
                    <div>
                      <span class="np-title">Payees & Beneficiaries Allocation (Under Method #{{ j + 1 }})</span>
                      <span class="np-subtitle">Client details are read-only; edit amount and note for each allocated payee</span>
                    </div>
                  </div>
                  <div class="np-header-actions">
                    <span class="np-subtotal-badge" [class.is-matched]="isPaymentMethodTallied(j)" [class.is-mismatched]="!isPaymentMethodTallied(j)">
                      Allocated: <strong>LKR {{ getPaymentPayeesSum(j) | number:'1.2-2' }}</strong> of <strong>LKR {{ getPaymentMethodAmount(j) | number:'1.2-2' }}</strong>
                    </span>
                    <button type="button" mat-stroked-button color="primary" class="add-nested-payee-btn" (click)="addPayeeToPayment(j)">
                      <mat-icon>person_add</mat-icon> + Add Payee
                    </button>
                  </div>
                </div>

                <!-- Payee Cards List -->
                <div [formArrayName]="'payees'" class="nested-payees-list">
                  <div *ngFor="let pGroup of getPayeesArray(j).controls; let i = index" [formGroupName]="i" class="payee-row-card">
                    
                    <!-- Card Top: Sub-Voucher Pill & Actions -->
                    <div class="payee-card-top">
                      <div class="p-top-left">
                        <span class="sub-voucher-pill" matTooltip="Auto-generated Sub Voucher Number for this payee allocation">
                          <mat-icon class="sub-v-icon">tag</mat-icon>
                          Sub Voucher: <strong>{{ getSubVoucherNo(j, i) }}</strong>
                        </span>
                        <span class="client-type-tag" *ngIf="pGroup.get('clientType')?.value">
                          {{ pGroup.get('clientType')?.value }}
                        </span>
                      </div>
                      <span class="spacer"></span>
                      <button type="button" 
                              mat-button 
                              class="switch-client-btn" 
                              *ngIf="pGroup.get('payeeName')?.value"
                              (click)="clearPayeeClient(j, i)"
                              matTooltip="Switch or choose a different client">
                        <mat-icon>swap_horiz</mat-icon> Switch Client
                      </button>
                      <button type="button" 
                              mat-icon-button 
                              color="warn" 
                              class="del-payee-btn" 
                              *ngIf="getPayeesArray(j).length > 1" 
                              (click)="removePayeeFromPayment(j, i)" 
                              matTooltip="Remove this payee">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>

                    <!-- Client Selection Bar (Visible when client is NOT yet chosen) -->
                    <div class="client-search-block" *ngIf="!pGroup.get('payeeName')?.value">
                      <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                        <mat-label>Select Client / Payee (Search Name, NIC / BRN, or Phone)</mat-label>
                        <input matInput 
                               formControlName="payeeName" 
                               [matAutocomplete]="autoClient" 
                               placeholder="Type to search Account Clients ledger..." 
                               required>
                        <mat-icon matPrefix>person_search</mat-icon>
                        <mat-autocomplete #autoClient="matAutocomplete" (optionSelected)="onClientSelected(j, i, $event)">
                          <mat-option *ngFor="let c of getMatchingClients(pGroup.get('payeeName')?.value)" [value]="c">
                            <div class="cust-option-row">
                              <div class="cust-opt-main">
                                <span class="cust-opt-name">{{ c.name }}</span>
                                <span class="cust-opt-badge">{{ c.clientType }}</span>
                              </div>
                              <div class="cust-opt-sub">
                                <span *ngIf="c.nicOrBrn">ID/BRN: {{ c.nicOrBrn }}</span>
                                <span *ngIf="c.phone">• {{ c.phone }}</span>
                                <span *ngIf="c.bankName">• {{ c.bankName }}</span>
                              </div>
                            </div>
                          </mat-option>
                        </mat-autocomplete>
                      </mat-form-field>
                      <button type="button" 
                              mat-stroked-button 
                              color="primary" 
                              class="reg-client-btn" 
                              (click)="openRegisterClientModal(j, i)"
                              matTooltip="Register a new payee profile in central Account Clients dataset">
                        <mat-icon>person_add</mat-icon> + Register New Client Profile
                      </button>
                    </div>

                    <!-- READ-ONLY CLIENT DETAILS STRIP (Visible once client is selected) -->
                    <div class="client-details-display-box" *ngIf="pGroup.get('payeeName')?.value">
                      <div class="cd-avatar" [ngClass]="getAvatarColorClass(pGroup.get('clientType')?.value)">
                        <mat-icon>{{ getClientTypeIcon(pGroup.get('clientType')?.value) }}</mat-icon>
                      </div>
                      <div class="cd-info-col">
                        <div class="cd-name-row">
                          <span class="cd-client-name">{{ pGroup.get('payeeName')?.value }}</span>
                          <span class="cd-type-badge">{{ pGroup.get('clientType')?.value }}</span>
                        </div>
                        <div class="cd-vitals-row">
                          <span class="vital-item" *ngIf="pGroup.get('payeeNic')?.value">
                            <mat-icon class="v-icon">badge</mat-icon>
                            ID/BRN: <strong>{{ pGroup.get('payeeNic')?.value }}</strong>
                          </span>
                          <span class="vital-item" *ngIf="pGroup.get('payeePhone')?.value">
                            <mat-icon class="v-icon">phone</mat-icon>
                            {{ pGroup.get('payeePhone')?.value }}
                          </span>
                          <span class="vital-item" *ngIf="pGroup.get('bankName')?.value">
                            <mat-icon class="v-icon">account_balance</mat-icon>
                            {{ pGroup.get('bankName')?.value }}
                          </span>
                          <span class="vital-item font-mono" *ngIf="pGroup.get('accountNumber')?.value">
                            Acc: {{ pGroup.get('accountNumber')?.value }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- EDITABLE FIELDS ONLY: AMOUNT AND NOTE -->
                    <div class="payee-editable-row">
                      <!-- Allocated Amount (Editable) -->
                      <mat-form-field appearance="outline" class="col-amount-field" subscriptSizing="dynamic">
                        <mat-label>Allocated Amount for {{ getSubVoucherNo(j, i) }} (LKR)</mat-label>
                        <input matInput type="number" formControlName="amount" min="0.01" step="0.01" placeholder="0.00" required>
                        <mat-icon matPrefix>payments</mat-icon>
                      </mat-form-field>

                      <!-- Note / Purpose (Editable) -->
                      <mat-form-field appearance="outline" class="col-note-field" subscriptSizing="dynamic">
                        <mat-label>Payee Note / Purpose / Invoice Ref</mat-label>
                        <input matInput formControlName="notes" placeholder="e.g. Stage 1 disbursement, Invoice #882, Material compensation">
                        <mat-icon matPrefix>edit_note</mat-icon>
                      </mat-form-field>
                    </div>
                  </div>
                </div>

                <!-- Mini Tally Status for This Payment Method -->
                <div class="method-tally-bar" [class.tallied]="isPaymentMethodTallied(j)" [class.untallied]="!isPaymentMethodTallied(j)">
                  <div class="mt-left">
                    <mat-icon>{{ isPaymentMethodTallied(j) ? 'check_circle' : 'warning' }}</mat-icon>
                    <span *ngIf="isPaymentMethodTallied(j)">
                      Method #{{ j + 1 }} tallies: LKR {{ getPaymentMethodAmount(j) | number:'1.2-2' }} distributed to {{ getPayeesArray(j).length }} {{ getPayeesArray(j).length === 1 ? 'payee' : 'payees' }}.
                    </span>
                    <span *ngIf="!isPaymentMethodTallied(j)">
                      Method #{{ j + 1 }} mismatch: Difference of <strong>LKR {{ getPaymentDifference(j) | number:'1.2-2' }}</strong> between payment amount (LKR {{ getPaymentMethodAmount(j) | number:'1.2-2' }}) and payees total (LKR {{ getPaymentPayeesSum(j) | number:'1.2-2' }}).
                    </span>
                  </div>
                  <div class="mt-helpers" *ngIf="!isPaymentMethodTallied(j)">
                    <button type="button" mat-stroked-button class="mini-btn" (click)="syncPaymentAmountFromPayees(j)">
                      <mat-icon>sync</mat-icon> Set Method to LKR {{ getPaymentPayeesSum(j) | number:'1.2-2' }}
                    </button>
                    <button type="button" 
                            mat-stroked-button 
                            class="mini-btn" 
                            *ngIf="getPaymentMethodAmount(j) > getPaymentPayeesSum(j)" 
                            (click)="autoBalancePaymentPayees(j)">
                      <mat-icon>add</mat-icon> Auto-fill Payee Difference (+LKR {{ getPaymentDifference(j) | number:'1.2-2' }})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- OVERALL VOUCHER TALLY & RECONCILIATION SUMMARY -->
        <div class="overall-tally-box" [ngClass]="isOverallTallied() ? 'tally-success' : 'tally-warning'">
          <div class="tally-main-info">
            <div class="tally-icon-box">
              <mat-icon>{{ isOverallTallied() ? 'verified' : 'error' }}</mat-icon>
            </div>
            <div class="tally-texts">
              <span class="tally-status-heading">
                {{ getTallyStatusHeading() }}
              </span>
              <div class="tally-summary-chips">
                <span class="chip-item">
                  Total Voucher Amount: <strong>LKR {{ totalVoucherAmount() | number:'1.2-2' }}</strong>
                </span>
                <span class="sep">•</span>
                <span class="chip-item">
                  Payment Methods Sum: <strong [class.text-amber]="!isPaymentsBalancedWithTotal()">LKR {{ sumOfPaymentMethods() | number:'1.2-2' }}</strong>
                </span>
                <ng-container *ngIf="!isPaymentsBalancedWithTotal() && totalVoucherAmount() > 0">
                  <span class="sep">•</span>
                  <span class="chip-item diff-chip">
                    Difference: <strong>LKR {{ paymentMethodsDifference() | number:'1.2-2' }}</strong> ({{ sumOfPaymentMethods() < totalVoucherAmount() ? 'Under-allocated' : 'Over-allocated' }})
                  </span>
                </ng-container>
                <span class="sep">•</span>
                <span class="chip-item">
                  Payment Methods: <strong>{{ paymentsArray.length }}</strong>
                </span>
                <span class="sep">•</span>
                <span class="chip-item">
                  Total Sub-Vouchers Generated: <strong>{{ totalAllPayeesCount() }}</strong>
                </span>
              </div>
            </div>
          </div>
          <div class="tally-right-action" *ngIf="!isPaymentsBalancedWithTotal() && totalVoucherAmount() > 0">
            <button type="button" mat-flat-button color="accent" class="tally-balance-btn" (click)="autoBalancePaymentsWithTotal()">
              <mat-icon>balance</mat-icon> Balance Payment Methods
            </button>
          </div>
        </div>

        <!-- Particulars & Remarks -->
        <div class="particulars-card">
          <div class="form-grid">
            <!-- Description -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Description / Particulars of Payment</mat-label>
              <textarea matInput formControlName="description" rows="2" placeholder="State reason, bill particulars, or purpose of voucher" required></textarea>
              <mat-icon matPrefix>description</mat-icon>
            </mat-form-field>

            <!-- Remarks -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Internal Accounting Remarks / Audit Notes</mat-label>
              <input matInput formControlName="remarks" placeholder="Audit observations or accounting memos">
              <mat-icon matPrefix>edit_note</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="dialog-actions">
          <div class="left-hint">
            <span *ngIf="totalVoucherAmount() <= 0" class="warn-hint">
              <mat-icon>info</mat-icon> Please enter a valid Total Amount of Voucher (greater than 0).
            </span>
            <span *ngIf="totalVoucherAmount() > 0 && !isPaymentsBalancedWithTotal()" class="warn-hint">
              <mat-icon>warning</mat-icon> Payment methods sum (LKR {{ sumOfPaymentMethods() | number:'1.2-2' }}) must balance with Total Voucher Amount (LKR {{ totalVoucherAmount() | number:'1.2-2' }}). Difference: LKR {{ paymentMethodsDifference() | number:'1.2-2' }}.
            </span>
            <span *ngIf="totalVoucherAmount() > 0 && isPaymentsBalancedWithTotal() && !arePayeesBalancedWithPayments()" class="warn-hint">
              <mat-icon>warning</mat-icon> Each payment method must tally with its allocated payees before saving.
            </span>
            <span *ngIf="isOverallTallied()" class="ready-hint">
              <mat-icon>check_circle</mat-icon> Total amount, payment methods & sub-vouchers verified and balanced. Ready to record in ledger.
            </span>
          </div>
          <div class="btn-group">
            <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancel</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="isSubmitDisabled()">
              <mat-icon>{{ isEdit ? 'save' : 'add_task' }}</mat-icon>
              {{ isEdit ? 'Save Changes' : 'Create Voucher' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .voucher-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 92vh;
      overflow-y: auto;
      padding: 24px;
      background: #f8fafc;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 20px;
      margin-bottom: 18px;
      background: #ffffff;
      border-radius: 10px;
      border: 1px solid #e2e8f0;

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
      }
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .vitals-card, .particulars-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .col-span-1 { grid-column: span 1; }
    .col-span-2 { grid-column: span 2; }
    .w-full { width: 100%; }

    .total-amount-field {
      input {
        font-weight: 700;
        font-size: 15px;
        color: #0f172a;
      }
      .currency-tag {
        font-weight: 700;
        font-size: 11px;
        color: #0284c7;
        margin-right: 4px;
        letter-spacing: 0.05em;
      }
    }

    /* Main Section: Payment Methods Container */
    .payments-container {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .section-top-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px 18px;

        .top-title-group {
          display: flex;
          align-items: center;
          gap: 12px;

          .section-icon-badge {
            width: 38px;
            height: 38px;
            border-radius: 8px;
            background: #ecfdf5;
            color: #059669;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 22px; width: 22px; height: 22px; }
          }

          .section-main-title {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            margin: 0;
          }

          .section-sub-title {
            font-size: 11.5px;
            color: #64748b;
            margin: 0;
          }
        }

        .top-actions-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;

          .master-balance-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            transition: all 0.2s ease;

            mat-icon {
              font-size: 17px;
              width: 17px;
              height: 17px;
            }

            .pill-amounts {
              display: flex;
              align-items: center;
              gap: 5px;

              .pill-label {
                color: #64748b;
                font-weight: 500;
                font-size: 11px;
              }

              .pill-val {
                font-weight: 700;
                font-family: monospace;

                &.mismatch {
                  color: #b45309;
                }
              }

              .pill-sep {
                color: #cbd5e1;
              }
            }

            &.balanced {
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
              color: #065f46;
              mat-icon { color: #059669; }
            }

            &.unbalanced {
              background: #fffbeb;
              border: 1px solid #fde68a;
              color: #92400e;
              mat-icon { color: #d97706; }
            }

            .pill-balance-btn {
              height: 24px;
              line-height: 24px;
              font-size: 11px;
              padding: 0 8px;
              border-color: #f59e0b;
              color: #b45309;
              background: #ffffff;
              mat-icon {
                font-size: 13px;
                width: 13px;
                height: 13px;
                margin-right: 2px;
              }
              &:hover {
                background: #fef3c7;
              }
            }
          }

          .add-pm-btn {
            height: 34px;
            line-height: 34px;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
        }
      }
    }

    .payment-methods-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Individual Payment Block Card */
    .payment-block-card {
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);

      .pm-header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 10px;

        .pm-badge-title {
          display: flex;
          align-items: center;
          gap: 8px;

          .pm-num {
            font-size: 12px;
            font-weight: 700;
            color: #047857;
            background: #dcfce7;
            padding: 3px 10px;
            border-radius: 6px;
          }

          .pm-type-tag {
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
          }

          .pm-amount-text {
            font-size: 13px;
            font-weight: 700;
            color: #065f46;
            font-family: monospace;
          }
        }

        .pm-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;

          .sync-amount-btn {
            font-size: 11px;
            height: 28px;
            line-height: 28px;
            color: #0284c7;
            mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
          }

          .del-pm-btn {
            width: 30px;
            height: 30px;
            line-height: 30px;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }
        }
      }

      .pm-inputs-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
    }

    /* Nested Payees Container */
    .nested-payees-wrapper {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-left: 4px solid #0284c7;

      .nested-payees-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;

        .np-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;

          .np-icon { font-size: 20px; width: 20px; height: 20px; color: #0284c7; }
          .np-title { font-size: 13px; font-weight: 700; color: #0f172a; display: block; }
          .np-subtitle { font-size: 11px; color: #64748b; display: block; }
        }

        .np-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;

          .np-subtotal-badge {
            font-size: 11.5px;
            padding: 3px 8px;
            border-radius: 12px;
            font-weight: 500;

            &.is-matched {
              background: #ecfdf5;
              color: #065f46;
              border: 1px solid #a7f3d0;
            }

            &.is-mismatched {
              background: #fffbeb;
              color: #92400e;
              border: 1px solid #fde68a;
            }
          }

          .add-nested-payee-btn {
            height: 28px;
            line-height: 28px;
            font-size: 11.5px;
            padding: 0 8px;
            mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
          }
        }
      }
    }

    .nested-payees-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Individual Payee Card Row */
    .payee-row-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);

      .payee-card-top {
        display: flex;
        align-items: center;
        gap: 8px;

        .p-top-left {
          display: flex;
          align-items: center;
          gap: 8px;

          .sub-voucher-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-family: monospace;
            font-weight: 700;
            color: #0284c7;
            background: #e0f2fe;
            border: 1px solid #bae6fd;
            padding: 2px 8px;
            border-radius: 4px;

            .sub-v-icon { font-size: 13px; width: 13px; height: 13px; }
          }

          .client-type-tag {
            font-size: 10px;
            color: #475569;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
          }
        }

        .spacer { flex: 1; }

        .switch-client-btn {
          font-size: 11px;
          height: 26px;
          line-height: 26px;
          color: #0284c7;
          mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
        }

        .del-payee-btn {
          width: 26px;
          height: 26px;
          line-height: 26px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      /* Client Search Block */
      .client-search-block {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;

        .reg-client-btn {
          height: 36px;
          line-height: 36px;
          font-size: 11.5px;
          white-space: nowrap;
          mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
        }
      }

      /* READ-ONLY CLIENT DETAILS STRIP */
      .client-details-display-box {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;

        .cd-avatar {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: #e0f2fe;
          color: #0284c7;
          mat-icon { font-size: 20px; width: 20px; height: 20px; }

          &.vendor { background: #fef3c7; color: #b45309; }
          &.gov { background: #ede9fe; color: #6d28d9; }
          &.employee { background: #dcfce7; color: #15803d; }
        }

        .cd-info-col {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;

          .cd-name-row {
            display: flex;
            align-items: center;
            gap: 8px;

            .cd-client-name {
              font-size: 13.5px;
              font-weight: 700;
              color: #0f172a;
            }

            .cd-type-badge {
              font-size: 10px;
              font-weight: 600;
              padding: 1px 6px;
              border-radius: 4px;
              background: #f1f5f9;
              color: #475569;
            }
          }

          .cd-vitals-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            font-size: 11.5px;
            color: #64748b;

            .vital-item {
              display: inline-flex;
              align-items: center;
              gap: 3px;

              .v-icon { font-size: 13px; width: 13px; height: 13px; color: #94a3b8; }
            }
          }
        }
      }

      /* EDITABLE ROW: AMOUNT AND NOTE ONLY */
      .payee-editable-row {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 10px;
        margin-top: 2px;

        .col-amount-field {
          min-width: 180px;
        }

        .col-note-field {
          flex: 1;
        }
      }
    }

    /* Autocomplete option */
    .cust-option-row {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
      .cust-opt-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .cust-opt-name { font-weight: 600; font-size: 13px; color: #0f172a; }
        .cust-opt-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: #f1f5f9; color: #475569; }
      }
      .cust-opt-sub { font-size: 11px; color: #64748b; }
    }

    /* DS Division Search in Select Dropdown */
    .select-search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
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
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        &:hover { color: #475569; }
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }

    /* Mini Tally Bar for Payment Method */
    .method-tally-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;

      &.tallied {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        mat-icon { color: #059669; font-size: 16px; width: 16px; height: 16px; }
      }

      &.untallied {
        background: #fffbeb;
        color: #92400e;
        border: 1px solid #fde68a;
        mat-icon { color: #d97706; font-size: 16px; width: 16px; height: 16px; }
      }

      .mt-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .mt-helpers {
        display: flex;
        align-items: center;
        gap: 6px;

        .mini-btn {
          font-size: 11px;
          height: 26px;
          line-height: 26px;
          padding: 0 6px;
          background: #ffffff;
          mat-icon { font-size: 13px; width: 13px; height: 13px; margin-right: 2px; }
        }
      }
    }

    /* OVERALL TALLY SUMMARY BOX */
    .overall-tally-box {
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;

      &.tally-success {
        background: #ecfdf5;
        border: 2px solid #6ee7b7;
        color: #065f46;
        .tally-icon-box mat-icon { color: #059669; font-size: 30px; width: 30px; height: 30px; }
      }

      &.tally-warning {
        background: #fffbeb;
        border: 2px solid #fcd34d;
        color: #92400e;
        .tally-icon-box mat-icon { color: #d97706; font-size: 30px; width: 30px; height: 30px; }
      }

      .tally-main-info {
        display: flex;
        align-items: center;
        gap: 12px;

        .tally-texts {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .tally-status-heading {
            font-size: 13.5px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }

          .tally-summary-chips {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #4b5563;
            flex-wrap: wrap;
            .sep { color: #9ca3af; }
            .text-amber { color: #b45309; }
            .diff-chip {
              background: #fef3c7;
              color: #92400e;
              padding: 1px 6px;
              border-radius: 4px;
              font-weight: 600;
            }
          }
        }
      }

      .tally-right-action {
        .tally-balance-btn {
          height: 34px;
          line-height: 34px;
          font-size: 12px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
    }

    /* Footer Actions */
    .dialog-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;

      .left-hint {
        display: flex;
        align-items: center;
        font-size: 12px;

        .warn-hint {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #d97706;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .ready-hint {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #059669;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .btn-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    }

    @media (max-width: 900px) {
      .pm-inputs-grid {
        grid-template-columns: 1fr 1fr;
      }
      .payee-editable-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class VoucherDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clientService = inject(AccountClientService);
  private settingsService = inject(SettingsService);
  private accountSettingsService = inject(AccountSettingsService);
  private dialog = inject(MatDialog);
  public dialogRef = inject(MatDialogRef<VoucherDialogComponent>);

  isEdit = false;
  voucherForm!: FormGroup;

  clients = signal<AccountClient[]>([]);
  divisions = signal<Division[]>([]);
  dsSearchTerm = signal<string>('');

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

    // Fallback: If no divisionalSecretariat is defined on records, use d.name
    if (set.size === 0) {
      for (const d of all) {
        const name = this.cleanEn(d.name);
        if (name) set.add(name);
      }
    }

    // Always include 'General' for Secretariat/District wide vouchers
    set.add('General');

    // Retain current voucher division if present
    const current = this.voucherForm?.get('division')?.value;
    if (current && typeof current === 'string' && current.trim()) {
      set.add(current.trim());
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  filteredDSDivisions = computed(() => {
    const term = this.dsSearchTerm().toLowerCase().trim();
    const list = this.availableDSDivisions();
    if (!term) return list;
    return list.filter(ds => ds.toLowerCase().includes(term));
  });

  activeVoucherTypes = this.accountSettingsService.activeVoucherTypes;
  activePaymentMethods = this.accountSettingsService.activePaymentMethods;

  // Signal triggering recalculation on form changes
  recalcTrigger = signal<number>(0);

  enteredTotalAmount = computed(() => {
    this.recalcTrigger();
    const val = parseFloat(this.voucherForm?.get('amount')?.value);
    return isNaN(val) || val < 0 ? 0 : Math.round(val * 100) / 100;
  });

  sumOfPaymentMethods = computed(() => {
    this.recalcTrigger();
    let sum = 0;
    if (this.paymentsArray) {
      for (let j = 0; j < this.paymentsArray.length; j++) {
        sum += this.getPaymentMethodAmount(j);
      }
    }
    return Math.round(sum * 100) / 100;
  });

  paymentMethodsDifference = computed(() => {
    return Math.round(Math.abs(this.enteredTotalAmount() - this.sumOfPaymentMethods()) * 100) / 100;
  });

  isPaymentsBalancedWithTotal = computed(() => {
    const total = this.enteredTotalAmount();
    const sum = this.sumOfPaymentMethods();
    return total > 0 && sum > 0 && Math.abs(total - sum) < 0.01;
  });

  arePayeesBalancedWithPayments = computed(() => {
    this.recalcTrigger();
    if (!this.paymentsArray || this.paymentsArray.length === 0) return false;
    for (let j = 0; j < this.paymentsArray.length; j++) {
      if (!this.isPaymentMethodTallied(j)) return false;
    }
    return true;
  });

  totalVoucherAmount = computed(() => {
    return this.enteredTotalAmount();
  });

  totalAllPayeesCount = computed(() => {
    this.recalcTrigger();
    let count = 0;
    if (this.paymentsArray) {
      for (let j = 0; j < this.paymentsArray.length; j++) {
        count += this.getPayeesArray(j)?.length || 0;
      }
    }
    return count;
  });

  isOverallTallied = computed(() => {
    return this.isPaymentsBalancedWithTotal() && this.arePayeesBalancedWithPayments();
  });

  getTallyStatusHeading(): string {
    if (this.totalVoucherAmount() <= 0) {
      return 'PLEASE ENTER TOTAL AMOUNT OF VOUCHER';
    }
    if (!this.isPaymentsBalancedWithTotal()) {
      const diff = this.paymentMethodsDifference();
      const isUnder = this.sumOfPaymentMethods() < this.totalVoucherAmount();
      return `PAYMENT METHODS MISMATCH: ${isUnder ? 'UNDER-ALLOCATED' : 'OVER-ALLOCATED'} BY LKR ${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (!this.arePayeesBalancedWithPayments()) {
      return 'PAYEES ALLOCATION MISMATCH: ONE OR MORE PAYMENT METHODS DO NOT MATCH THEIR ALLOCATED PAYEES';
    }
    return 'ALL PAYMENT METHODS & SUB-VOUCHERS ARE PERFECTLY BALANCED WITH TOTAL AMOUNT';
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { 
      voucher?: Voucher; 
      defaultVoucherNo?: string; 
      preselectedClient?: AccountClient 
    }
  ) {
    this.isEdit = !!data?.voucher?.id;
  }

  ngOnInit() {
    this.initForm();
    this.loadClients();
    this.loadDivisions();
  }

  get paymentsArray(): FormArray {
    return this.voucherForm.get('payments') as FormArray;
  }

  getPayeesArray(paymentIndex: number): FormArray {
    return this.paymentsArray.at(paymentIndex).get('payees') as FormArray;
  }

  private initForm() {
    const today = new Date().toISOString().split('T')[0];
    const v = this.data?.voucher;
    const client = this.data?.preselectedClient;
    const initialAmount = (v?.amount !== undefined && v.amount !== null && v.amount > 0)
      ? v.amount
      : (v?.payments && v.payments.length > 0 ? v.payments.reduce((acc, p) => acc + (p.amount || 0), 0) : '');

    const defaultNo = v?.voucherNo || this.data?.defaultVoucherNo || `PV/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

    this.voucherForm = this.fb.group({
      voucherNo: [defaultNo, Validators.required],
      type: [v?.type || 'Payment Voucher', Validators.required],
      amount: [initialAmount, [Validators.required, Validators.min(0.01)]],
      date: [v?.date || today, Validators.required],
      status: [v?.status || 'Draft', Validators.required],
      department: [v?.department || 'Accounts'],
      division: [v?.division || client?.division || 'General'],
      category: [v?.category || client?.category || 'Office Operational Expenses'],
      description: [v?.description || '', Validators.required],
      remarks: [v?.remarks || ''],
      taskId: [v?.taskId || ''],
      taskType: [v?.taskType || null],
      taskTitle: [v?.taskTitle || ''],
      taskRef: [v?.taskRef || ''],
      payments: this.fb.array([])
    });

    // Populate Payments with nested Payees
    if (v?.payments && v.payments.length > 0) {
      v.payments.forEach((pm, pIndex) => {
        const payees = (pm.payees && pm.payees.length > 0) 
          ? pm.payees 
          : (v.payees && v.payees.length > 0 ? v.payees : undefined);
        this.addPayment(pm, payees);
      });
    } else if (client) {
      // Single payment preselected for client
      const amt = initialAmount || ('' as any);
      this.addPayment({
        paymentMethod: 'Cash',
        amount: amt
      }, [{
        clientId: client.id,
        clientType: client.clientType,
        payeeName: client.name,
        payeeNic: client.nicOrBrn,
        payeePhone: client.phone,
        bankName: client.bankName,
        accountNumber: client.accountNumber,
        amount: amt
      }]);
    } else if (v?.payeeName) {
      // Legacy voucher conversion
      this.addPayment({
        paymentMethod: v.paymentMethod === 'Multiple' ? 'Cash' : (v.paymentMethod as PaymentMethod),
        amount: v.amount,
        referenceNo: v.referenceNo,
        bankName: v.bankName
      }, [{
        clientId: v.clientId || v.customerId,
        clientType: v.clientType || 'Business / Vendor',
        payeeName: v.payeeName,
        payeeNic: v.payeeNic,
        payeePhone: v.payeePhone,
        bankName: v.bankName,
        amount: v.amount
      }]);
    } else {
      // Fresh new voucher default
      this.addPayment({ paymentMethod: 'Cash' });
    }

    // Trigger recalculation on form changes
    this.voucherForm.valueChanges.subscribe(() => {
      this.recalcTrigger.update(n => n + 1);
    });
  }

  private loadClients() {
    this.clientService.getClients().subscribe({
      next: (clients) => this.clients.set(clients || []),
      error: () => this.clients.set([])
    });
  }

  private loadDivisions() {
    this.settingsService.getDivisions().subscribe({
      next: (divs) => this.divisions.set(divs || []),
      error: () => this.divisions.set([])
    });
  }

  // --- Sub-Voucher Generator ---
  getSubVoucherNo(paymentIndex: number, payeeIndex: number): string {
    const masterNo = this.voucherForm.get('voucherNo')?.value?.trim() || 'VCH';
    let seq = 1;
    for (let j = 0; j < paymentIndex; j++) {
      seq += this.getPayeesArray(j)?.length || 0;
    }
    seq += payeeIndex;
    return `${masterNo}-${seq}`;
  }

  onVoucherNoChange() {
    this.recalcTrigger.update(n => n + 1);
  }

  onTotalAmountInput() {
    this.recalcTrigger.update(n => n + 1);
    const entered = this.enteredTotalAmount();
    // If only 1 payment method, auto-sync if its amount is empty or was equal/zero
    if (this.paymentsArray.length === 1 && entered > 0) {
      const currentMethodAmt = parseFloat(this.paymentsArray.at(0).get('amount')?.value) || 0;
      if (currentMethodAmt === 0 || !this.paymentsArray.at(0).get('amount')?.value) {
        this.paymentsArray.at(0).patchValue({ amount: entered });
        const payees = this.getPayeesArray(0);
        if (payees.length === 1) {
          const currentPayeeAmt = parseFloat(payees.at(0).get('amount')?.value) || 0;
          if (currentPayeeAmt === 0 || !payees.at(0).get('amount')?.value) {
            payees.at(0).patchValue({ amount: entered });
          }
        }
      }
    }
  }

  autoBalancePaymentsWithTotal() {
    const total = this.enteredTotalAmount();
    if (total <= 0) return;

    if (this.paymentsArray.length === 1) {
      this.paymentsArray.at(0).patchValue({ amount: total });
      const payees = this.getPayeesArray(0);
      if (payees.length === 1) {
        payees.at(0).patchValue({ amount: total });
      }
      this.recalcTrigger.update(n => n + 1);
      return;
    }

    const currentSum = this.sumOfPaymentMethods();
    const diff = Math.round((total - currentSum) * 100) / 100;
    if (diff === 0) return;

    // Check if there is an empty/zero payment method
    let targetIndex = -1;
    for (let j = 0; j < this.paymentsArray.length; j++) {
      const val = parseFloat(this.paymentsArray.at(j).get('amount')?.value) || 0;
      if (val === 0) {
        targetIndex = j;
        break;
      }
    }

    if (diff > 0) {
      if (targetIndex !== -1) {
        this.paymentsArray.at(targetIndex).patchValue({ amount: diff });
        const payees = this.getPayeesArray(targetIndex);
        if (payees.length === 1) {
          payees.at(0).patchValue({ amount: diff });
        }
      } else {
        const lastIndex = this.paymentsArray.length - 1;
        const currentAmt = parseFloat(this.paymentsArray.at(lastIndex).get('amount')?.value) || 0;
        const newAmt = Math.round((currentAmt + diff) * 100) / 100;
        this.paymentsArray.at(lastIndex).patchValue({ amount: newAmt });
      }
    } else if (diff < 0) {
      const lastIndex = this.paymentsArray.length - 1;
      const currentAmt = parseFloat(this.paymentsArray.at(lastIndex).get('amount')?.value) || 0;
      const newAmt = Math.max(0.01, Math.round((currentAmt + diff) * 100) / 100);
      this.paymentsArray.at(lastIndex).patchValue({ amount: newAmt });
    }

    this.recalcTrigger.update(n => n + 1);
  }

  // --- Payment Method Management ---
  createPaymentGroup(initialPm?: Partial<VoucherPaymentSplit>, initialPayees?: Partial<VoucherPayeeSplit>[]): FormGroup {
    const payeesArray = this.fb.array<FormGroup>([]);

    if (initialPayees && initialPayees.length > 0) {
      initialPayees.forEach(p => payeesArray.push(this.createPayeeGroup(p)));
    } else {
      payeesArray.push(this.createPayeeGroup({ amount: initialPm?.amount }));
    }

    return this.fb.group({
      id: [initialPm?.id || ''],
      paymentMethod: [initialPm?.paymentMethod || 'Cash', Validators.required],
      amount: [initialPm?.amount !== undefined ? initialPm.amount : '', [Validators.required, Validators.min(0.01)]],
      referenceNo: [initialPm?.referenceNo || ''],
      bankName: [initialPm?.bankName || ''],
      notes: [initialPm?.notes || ''],
      payees: payeesArray
    });
  }

  addPayment(initialPm?: Partial<VoucherPaymentSplit>, initialPayees?: Partial<VoucherPayeeSplit>[]) {
    this.paymentsArray.push(this.createPaymentGroup(initialPm, initialPayees));
    this.recalcTrigger.update(n => n + 1);
  }

  removePayment(index: number) {
    if (this.paymentsArray.length > 1) {
      this.paymentsArray.removeAt(index);
      this.recalcTrigger.update(n => n + 1);
    }
  }

  // --- Payee Management under a Payment Method ---
  createPayeeGroup(initial?: Partial<VoucherPayeeSplit>): FormGroup {
    return this.fb.group({
      id: [initial?.id || ''],
      subVoucherNo: [initial?.subVoucherNo || ''],
      clientId: [initial?.clientId || ''],
      clientType: [initial?.clientType || 'Business / Vendor'],
      payeeName: [initial?.payeeName || '', Validators.required],
      payeeNic: [initial?.payeeNic || ''],
      payeePhone: [initial?.payeePhone || ''],
      bankName: [initial?.bankName || ''],
      accountNumber: [initial?.accountNumber || ''],
      amount: [initial?.amount !== undefined ? initial.amount : '', [Validators.required, Validators.min(0.01)]],
      notes: [initial?.notes || '']
    });
  }

  addPayeeToPayment(paymentIndex: number, initial?: Partial<VoucherPayeeSplit>) {
    const payees = this.getPayeesArray(paymentIndex);
    payees.push(this.createPayeeGroup(initial));
    this.recalcTrigger.update(n => n + 1);
  }

  removePayeeFromPayment(paymentIndex: number, payeeIndex: number) {
    const payees = this.getPayeesArray(paymentIndex);
    if (payees.length > 1) {
      payees.removeAt(payeeIndex);
      this.recalcTrigger.update(n => n + 1);
    }
  }

  clearPayeeClient(paymentIndex: number, payeeIndex: number) {
    const payeeRow = this.getPayeesArray(paymentIndex).at(payeeIndex);
    payeeRow.patchValue({
      clientId: '',
      payeeName: '',
      clientType: 'Business / Vendor',
      payeeNic: '',
      payeePhone: '',
      bankName: '',
      accountNumber: ''
    });
    this.recalcTrigger.update(n => n + 1);
  }

  // --- Calculation & Tally for Individual Payment Method ---
  getPaymentMethodAmount(j: number): number {
    const row = this.paymentsArray.at(j);
    const val = parseFloat(row?.get('amount')?.value);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }

  getPaymentPayeesSum(j: number): number {
    const payees = this.getPayeesArray(j);
    if (!payees) return 0;
    let sum = 0;
    for (const ctrl of payees.controls) {
      const val = parseFloat(ctrl.get('amount')?.value);
      if (!isNaN(val) && val > 0) sum += val;
    }
    return Math.round(sum * 100) / 100;
  }

  getPaymentDifference(j: number): number {
    return Math.round(Math.abs(this.getPaymentMethodAmount(j) - this.getPaymentPayeesSum(j)) * 100) / 100;
  }

  isPaymentMethodTallied(j: number): boolean {
    const methodAmt = this.getPaymentMethodAmount(j);
    const payeesSum = this.getPaymentPayeesSum(j);
    return methodAmt > 0 && payeesSum > 0 && Math.abs(methodAmt - payeesSum) < 0.01;
  }

  syncPaymentAmountFromPayees(j: number) {
    const payeesSum = this.getPaymentPayeesSum(j);
    if (payeesSum > 0) {
      this.paymentsArray.at(j).patchValue({ amount: payeesSum });
      this.recalcTrigger.update(n => n + 1);
    }
  }

  autoBalancePaymentPayees(j: number) {
    const diff = this.getPaymentDifference(j);
    if (diff <= 0) return;

    const payees = this.getPayeesArray(j);
    const lastRow = payees.at(payees.length - 1);
    const lastAmt = parseFloat(lastRow.get('amount')?.value);
    if (!lastAmt || isNaN(lastAmt)) {
      lastRow.patchValue({ amount: diff });
    } else {
      this.addPayeeToPayment(j, { amount: diff });
    }
    this.recalcTrigger.update(n => n + 1);
  }

  // --- Autocomplete & Client Registration ---
  getMatchingClients(query: string | null | undefined): AccountClient[] {
    const list = this.clients();
    if (!query || typeof query !== 'string') return list.slice(0, 6);
    const q = query.toLowerCase().trim();
    if (!q) return list.slice(0, 6);

    return list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.nicOrBrn && c.nicOrBrn.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.bankName && c.bankName.toLowerCase().includes(q))
    ).slice(0, 8);
  }

  onClientSelected(paymentIndex: number, payeeIndex: number, event: MatAutocompleteSelectedEvent) {
    const client: AccountClient = event.option.value;
    if (!client) return;

    const payeeRow = this.getPayeesArray(paymentIndex).at(payeeIndex);
    payeeRow.patchValue({
      clientId: client.id || '',
      clientType: client.clientType || 'Business / Vendor',
      payeeName: client.name,
      payeeNic: client.nicOrBrn || '',
      payeePhone: client.phone || '',
      bankName: client.bankName ? `${client.bankName}${client.accountNumber ? ' - Acc ' + client.accountNumber : ''}` : (payeeRow.get('bankName')?.value || ''),
      accountNumber: client.accountNumber || ''
    });
    this.recalcTrigger.update(n => n + 1);
  }

  openRegisterClientModal(paymentIndex: number, payeeIndex: number) {
    const payeeRow = this.getPayeesArray(paymentIndex).at(payeeIndex);
    const initialName = payeeRow?.get('payeeName')?.value || '';

    const dialogRef = this.dialog.open(AccountClientDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: {
        client: initialName ? { name: initialName } : undefined
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          const newId = await this.clientService.addClient(result);
          const fullClient: AccountClient = { ...result, id: newId };
          this.clients.update(prev => [fullClient, ...prev]);

          payeeRow.patchValue({
            clientId: newId,
            clientType: fullClient.clientType,
            payeeName: fullClient.name,
            payeeNic: fullClient.nicOrBrn || '',
            payeePhone: fullClient.phone || '',
            bankName: fullClient.bankName || '',
            accountNumber: fullClient.accountNumber || ''
          });
          this.recalcTrigger.update(n => n + 1);
        } catch (e) {
          console.error('Failed to register account client:', e);
        }
      }
    });
  }

  getClientTypeIcon(type: string): string {
    switch (type) {
      case 'Business / Vendor': return 'storefront';
      case 'Government Agency': return 'account_balance';
      case 'Employee': return 'badge';
      case 'Financial Institution': return 'savings';
      default: return 'person';
    }
  }

  getAvatarColorClass(type: string): string {
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
      const matched = this.activeVoucherTypes().find(vt => vt.name.toLowerCase() === newType.toLowerCase());
      const prefix = matched?.prefix || matched?.code || (newType === 'Receipt Voucher' ? 'RV' : (newType === 'Petty Cash' ? 'PCV' : (newType === 'Journal Voucher' ? 'JV' : 'PV')));
      const randSeq = Math.floor(1000 + Math.random() * 9000);
      this.voucherForm.patchValue({ voucherNo: `${prefix}/${year}/${randSeq}` });
      this.recalcTrigger.update(n => n + 1);
    }
  }

  isSubmitDisabled(): boolean {
    if (this.voucherForm.invalid) return true;
    if (this.paymentsArray.length === 0) return true;
    if (this.enteredTotalAmount() <= 0) return true;
    if (!this.isOverallTallied()) return true;
    return false;
  }

  async onSubmit() {
    if (this.isSubmitDisabled()) return;

    const paymentsList: VoucherPaymentSplit[] = [];
    const flattenedAllPayees: VoucherPayeeSplit[] = [];

    for (let j = 0; j < this.paymentsArray.length; j++) {
      const pmGroup = this.paymentsArray.at(j);
      const pmVal = pmGroup.value;
      const payeesArray = this.getPayeesArray(j);

      const methodPayees: VoucherPayeeSplit[] = [];
      for (let i = 0; i < payeesArray.length; i++) {
        const pCtrl = payeesArray.at(i);
        const pVal = pCtrl.value;
        let clientId = pVal.clientId;
        const payeeName = (pVal.payeeName || '').trim();
        const payeeNic = (pVal.payeeNic || '').trim();

        if (!clientId && payeeName) {
          const normName = payeeName.toLowerCase();
          const normNic = payeeNic.toLowerCase();
          const matched = this.clients().find(c =>
            (normNic && c.nicOrBrn && c.nicOrBrn.trim().toLowerCase() === normNic) ||
            (c.name && c.name.trim().toLowerCase() === normName)
          );
          if (matched?.id) clientId = matched.id;
        }

        const subVoucherNo = this.getSubVoucherNo(j, i);

        const payeeRecord: VoucherPayeeSplit = {
          id: pVal.id || Math.random().toString(36).substring(2, 9),
          subVoucherNo: subVoucherNo,
          clientId: clientId || '',
          clientType: pVal.clientType || 'Business / Vendor',
          payeeName: payeeName,
          payeeNic: payeeNic,
          payeePhone: pVal.payeePhone || '',
          bankName: pVal.bankName || '',
          accountNumber: pVal.accountNumber || '',
          amount: parseFloat(pVal.amount) || 0,
          notes: pVal.notes || '',
          paymentMethod: pmVal.paymentMethod,
          referenceNo: pmVal.referenceNo || ''
        };

        methodPayees.push(payeeRecord);
        flattenedAllPayees.push(payeeRecord);
      }

      paymentsList.push({
        id: pmVal.id || Math.random().toString(36).substring(2, 9),
        paymentMethod: pmVal.paymentMethod || 'Cash',
        amount: parseFloat(pmVal.amount) || 0,
        referenceNo: pmVal.referenceNo || '',
        bankName: pmVal.bankName || '',
        notes: pmVal.notes || '',
        payees: methodPayees
      });
    }

    const primaryPayment = paymentsList[0];
    const primaryPayee = flattenedAllPayees[0];
    const totalAmount = this.totalVoucherAmount();

    const payeeSummary = flattenedAllPayees.length === 1
      ? primaryPayee.payeeName
      : `${primaryPayee.payeeName} (+${flattenedAllPayees.length - 1} others)`;

    const methodSummary = paymentsList.length === 1
      ? primaryPayment.paymentMethod
      : 'Multiple';

    const payload = {
      ...this.voucherForm.value,
      amount: totalAmount,
      paymentMethod: methodSummary,
      referenceNo: primaryPayment.referenceNo || '',
      bankName: primaryPayment.bankName || primaryPayee.bankName || '',
      clientId: primaryPayee.clientId || '',
      clientType: primaryPayee.clientType || 'Business / Vendor',
      payeeName: payeeSummary,
      payeeNic: primaryPayee.payeeNic || '',
      payeePhone: primaryPayee.payeePhone || '',
      payments: paymentsList,
      payees: flattenedAllPayees
    };

    this.dialogRef.close(payload);
  }
}
