import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AccountSettingsService } from './services/account-settings.service';
import { VoucherTypeConfig, PaymentMethodConfig } from './models/account-settings.model';
import { VoucherTypeDialogComponent } from './voucher-type-dialog.component';
import { PaymentMethodDialogComponent } from './payment-method-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { RbacService } from '../../auth/rbac.service';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule
  ],
  template: `
    <div class="account-settings-container">
      <!-- Hero Banner -->
      <div class="settings-hero">
        <div class="hero-left">
          <div class="hero-tag">
            <mat-icon class="tag-icon">settings</mat-icon>
            <span>Account Ledger Governance</span>
          </div>
          <h1 class="hero-title">Account Settings & Classifications</h1>
          <p class="hero-subtitle">
            Configure official Voucher Types, numbering prefixes, and supported Payment Methods for financial disbursement and ledger tracking.
          </p>
        </div>

        <div class="hero-actions">
          <button mat-stroked-button class="reset-btn" (click)="resetToDefaults()" [disabled]="!canManage()" matTooltip="Restore system default voucher types and payment methods">
            <mat-icon>restart_alt</mat-icon> Reset to Defaults
          </button>
        </div>
      </div>

      <!-- Access Control / Authorized Roles Strip -->
      <div class="rbac-strip" [class.authorized]="canManage()" [class.restricted]="!canManage()">
        <div class="rbac-left">
          <mat-icon class="rbac-icon">{{ canManage() ? 'verified_user' : 'lock' }}</mat-icon>
          <div class="rbac-texts">
            <span class="rbac-title">
              {{ canManage() ? 'Management Access Granted' : 'View-Only Access' }}
            </span>
            <span class="rbac-desc">
              Voucher types and payment methods can be configured by:
              <strong>Super Admin</strong>, <strong>Divisional Admin</strong>, and <strong>Department Head</strong>.
            </span>
          </div>
        </div>
        <div class="rbac-badges">
          <span class="role-pill" [class.active-user-role]="rbacService.isSuperAdmin()">Super Admin</span>
          <span class="role-pill" [class.active-user-role]="rbacService.isDivisionalAdmin()">Divisional Admin</span>
          <span class="role-pill" [class.active-user-role]="rbacService.hasRole('Department Head')">Department Head</span>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="metrics-strip">
        <div class="metric-card">
          <div class="metric-icon-box vt-icon">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="metric-content">
            <span class="metric-lbl">Active Voucher Types</span>
            <span class="metric-val">{{ activeVoucherTypesCount() }} / {{ totalVoucherTypesCount() }}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box pm-icon">
            <mat-icon>payments</mat-icon>
          </div>
          <div class="metric-content">
            <span class="metric-lbl">Active Payment Methods</span>
            <span class="metric-val">{{ activePaymentMethodsCount() }} / {{ totalPaymentMethodsCount() }}</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box update-icon">
            <mat-icon>history</mat-icon>
          </div>
          <div class="metric-content">
            <span class="metric-lbl">Last Modified By</span>
            <span class="metric-val officer-text">{{ settings().updatedBy || 'System Default' }}</span>
          </div>
        </div>
      </div>

      <!-- Settings Tabs -->
      <mat-card class="content-card">
        <mat-tab-group animationDuration="200ms" class="account-tabs">

          <!-- ========================================== -->
          <!-- TAB 1: VOUCHER TYPES                       -->
          <!-- ========================================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">receipt_long</mat-icon>
              <span>Voucher Types ({{ totalVoucherTypesCount() }})</span>
            </ng-template>

            <div class="tab-content">
              <!-- Section Toolbar -->
              <div class="tab-toolbar">
                <div>
                  <h3 class="tab-title">Configured Voucher Classifications</h3>
                  <p class="tab-subtitle">
                    Manage official voucher types and their reference numbering prefixes (e.g. PV, RV, PCV, JV).
                  </p>
                </div>
                <button mat-flat-button color="primary" class="add-btn" (click)="openAddVoucherTypeModal()" [disabled]="!canManage()" matTooltip="Add a new voucher classification">
                  <mat-icon>add</mat-icon> Add Voucher Type
                </button>
              </div>

              <!-- Voucher Types Grid -->
              <div class="items-grid">
                <div *ngFor="let vt of settings().voucherTypes" class="item-card" [class.inactive]="!vt.isActive">
                  <div class="card-top-row">
                    <div class="card-title-group">
                      <div class="type-icon-box" [ngClass]="vt.badgeColor || 'blue'">
                        <mat-icon>{{ vt.icon || 'receipt' }}</mat-icon>
                      </div>
                      <div>
                        <div class="name-badge-row">
                          <h4 class="item-name">{{ vt.name }}</h4>
                          <span class="prefix-badge font-mono">{{ vt.prefix || vt.code }}</span>
                          <span class="default-badge" *ngIf="vt.isDefault">Default</span>
                        </div>
                        <span class="sample-no font-mono" matTooltip="Auto-generated format">
                          Format: {{ vt.prefix || vt.code }}/{{ currentYear }}/1024
                        </span>
                      </div>
                    </div>

                    <div class="card-status-toggle">
                      <mat-slide-toggle [checked]="vt.isActive" (change)="toggleVoucherType(vt.id)" [disabled]="!canManage()" color="primary" matTooltip="Toggle active status">
                        <span class="toggle-text">{{ vt.isActive ? 'Active' : 'Disabled' }}</span>
                      </mat-slide-toggle>
                    </div>
                  </div>

                  <p class="item-desc" *ngIf="vt.description">{{ vt.description }}</p>
                  <p class="item-desc empty-desc" *ngIf="!vt.description">No specific description provided.</p>

                  <div class="card-footer-row">
                    <span class="status-pill" [class.active]="vt.isActive" [class.inactive]="!vt.isActive">
                      <span class="dot"></span>
                      {{ vt.isActive ? 'Available in Creation' : 'Hidden from Selection' }}
                    </span>

                    <div class="card-actions" *ngIf="canManage()">
                      <button mat-icon-button (click)="openEditVoucherTypeModal(vt)" class="action-icon-btn edit-btn" matTooltip="Edit Voucher Type">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button (click)="deleteVoucherType(vt)" class="action-icon-btn delete-btn" [disabled]="vt.isDefault" matTooltip="Delete Voucher Type">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- ========================================== -->
          <!-- TAB 2: PAYMENT METHODS                     -->
          <!-- ========================================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">payments</mat-icon>
              <span>Payment Methods ({{ totalPaymentMethodsCount() }})</span>
            </ng-template>

            <div class="tab-content">
              <!-- Section Toolbar -->
              <div class="tab-toolbar">
                <div>
                  <h3 class="tab-title">Configured Disbursement Methods</h3>
                  <p class="tab-subtitle">
                    Define settlement channels (Cash, Cheque, Bank Transfer, Online) and their validation rules.
                  </p>
                </div>
                <button mat-flat-button color="primary" class="add-btn" (click)="openAddPaymentMethodModal()" [disabled]="!canManage()" matTooltip="Add a new disbursement method">
                  <mat-icon>add</mat-icon> Add Payment Method
                </button>
              </div>

              <!-- Payment Methods Grid -->
              <div class="items-grid">
                <div *ngFor="let pm of settings().paymentMethods" class="item-card" [class.inactive]="!pm.isActive">
                  <div class="card-top-row">
                    <div class="card-title-group">
                      <div class="method-icon-box">
                        <mat-icon>{{ pm.icon || 'payments' }}</mat-icon>
                      </div>
                      <div>
                        <div class="name-badge-row">
                          <h4 class="item-name">{{ pm.name }}</h4>
                          <span class="code-badge font-mono" *ngIf="pm.code">[{{ pm.code }}]</span>
                          <span class="default-badge" *ngIf="pm.isDefault">Default</span>
                        </div>
                        <span class="settle-label">Settlement Channel</span>
                      </div>
                    </div>

                    <div class="card-status-toggle">
                      <mat-slide-toggle [checked]="pm.isActive" (change)="togglePaymentMethod(pm.id)" [disabled]="!canManage()" color="primary" matTooltip="Toggle active status">
                        <span class="toggle-text">{{ pm.isActive ? 'Active' : 'Disabled' }}</span>
                      </mat-slide-toggle>
                    </div>
                  </div>

                  <p class="item-desc" *ngIf="pm.description">{{ pm.description }}</p>
                  <p class="item-desc empty-desc" *ngIf="!pm.description">Standard settlement method.</p>

                  <!-- Requirement badges -->
                  <div class="requirements-strip">
                    <span class="req-chip" [class.active]="pm.requiresReference">
                      <mat-icon class="req-icon">{{ pm.requiresReference ? 'check_circle' : 'cancel' }}</mat-icon>
                      {{ pm.requiresReference ? 'Requires Cheque / Ref #' : 'No Ref Required' }}
                    </span>
                    <span class="req-chip" [class.active]="pm.requiresBank">
                      <mat-icon class="req-icon">{{ pm.requiresBank ? 'check_circle' : 'cancel' }}</mat-icon>
                      {{ pm.requiresBank ? 'Requires Bank Particulars' : 'No Bank Required' }}
                    </span>
                  </div>

                  <div class="card-footer-row">
                    <span class="status-pill" [class.active]="pm.isActive" [class.inactive]="!pm.isActive">
                      <span class="dot"></span>
                      {{ pm.isActive ? 'Enabled for Vouchers' : 'Disabled' }}
                    </span>

                    <div class="card-actions" *ngIf="canManage()">
                      <button mat-icon-button (click)="openEditPaymentMethodModal(pm)" class="action-icon-btn edit-btn" matTooltip="Edit Payment Method">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button (click)="deletePaymentMethod(pm)" class="action-icon-btn delete-btn" [disabled]="pm.isDefault" matTooltip="Delete Payment Method">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .account-settings-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .settings-hero {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff;
      padding: 28px 32px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

      .hero-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.15);
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.03em;
        margin-bottom: 8px;
        .tag-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .hero-title {
        font-size: 24px;
        font-weight: 800;
        margin: 0 0 6px 0;
        letter-spacing: -0.01em;
      }

      .hero-subtitle {
        font-size: 13.5px;
        color: #e0f2fe;
        margin: 0;
        max-width: 680px;
        line-height: 1.5;
      }

      .hero-actions {
        .reset-btn {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.35);
          &:hover {
            background: rgba(255, 255, 255, 0.1);
          }
        }
      }
    }

    /* RBAC Strip */
    .rbac-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 20px;
      border-radius: 8px;

      &.authorized {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
        .rbac-icon { color: #059669; }
      }

      &.restricted {
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
        .rbac-icon { color: #d97706; }
      }

      .rbac-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .rbac-icon { font-size: 24px; width: 24px; height: 24px; }

        .rbac-texts {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .rbac-title { font-size: 13px; font-weight: 700; }
          .rbac-desc { font-size: 12px; opacity: 0.9; }
        }
      }

      .rbac-badges {
        display: flex;
        align-items: center;
        gap: 8px;

        .role-pill {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 10px;
          border-radius: 12px;
          background: #ffffff;
          color: #475569;
          border: 1px solid #cbd5e1;

          &.active-user-role {
            background: #0284c7;
            color: #ffffff;
            border-color: #0284c7;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          }
        }
      }
    }

    /* Metrics Strip */
    .metrics-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;

      .metric-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 14px;

        .metric-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 22px; width: 22px; height: 22px; }

          &.vt-icon { background: #e0f2fe; color: #0284c7; }
          &.pm-icon { background: #dcfce7; color: #16a34a; }
          &.update-icon { background: #fef3c7; color: #d97706; }
        }

        .metric-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          .metric-lbl { font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          .metric-val { font-size: 18px; font-weight: 800; color: #0f172a; }
          .officer-text { font-size: 14px; font-weight: 700; color: #334155; }
        }
      }
    }

    /* Content Card & Tabs */
    .content-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }

    .tab-content {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .tab-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f1f5f9;

      .tab-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
      .tab-subtitle { font-size: 12.5px; color: #64748b; margin: 2px 0 0 0; }

      .add-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }

    /* Cards Grid */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;

      .item-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: all 0.2s ease;

        &:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        &.inactive {
          background: #f8fafc;
          opacity: 0.75;
        }

        .card-top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;

          .card-title-group {
            display: flex;
            align-items: center;
            gap: 12px;

            .type-icon-box {
              width: 40px;
              height: 40px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              mat-icon { font-size: 20px; width: 20px; height: 20px; }

              &.blue { background: #e0f2fe; color: #0284c7; }
              &.green { background: #dcfce7; color: #16a34a; }
              &.amber { background: #fef3c7; color: #d97706; }
              &.purple { background: #ede9fe; color: #7c3aed; }
              &.teal { background: #ccfbf1; color: #0d9488; }
            }

            .method-icon-box {
              width: 40px;
              height: 40px;
              border-radius: 8px;
              background: #ecfdf5;
              color: #059669;
              display: flex;
              align-items: center;
              justify-content: center;
              mat-icon { font-size: 20px; width: 20px; height: 20px; }
            }

            .name-badge-row {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;

              .item-name { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }
              .prefix-badge, .code-badge {
                font-size: 11px;
                font-weight: 700;
                background: #f1f5f9;
                color: #0284c7;
                padding: 1px 6px;
                border-radius: 4px;
                border: 1px solid #e2e8f0;
              }
              .default-badge {
                font-size: 10px;
                font-weight: 700;
                background: #fef3c7;
                color: #b45309;
                padding: 1px 6px;
                border-radius: 4px;
                text-transform: uppercase;
              }
            }

            .sample-no, .settle-label {
              font-size: 11.5px;
              color: #64748b;
              margin-top: 2px;
              display: block;
            }
          }

          .card-status-toggle {
            .toggle-text { font-size: 11.5px; font-weight: 600; color: #475569; }
          }
        }

        .item-desc {
          font-size: 12.5px;
          color: #475569;
          line-height: 1.45;
          margin: 0;
          &.empty-desc { font-style: italic; color: #94a3b8; }
        }

        .requirements-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .req-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 12px;
            background: #f1f5f9;
            color: #64748b;
            border: 1px solid #e2e8f0;
            .req-icon { font-size: 13px; width: 13px; height: 13px; color: #94a3b8; }

            &.active {
              background: #f0fdf4;
              color: #166534;
              border-color: #bbf7d0;
              .req-icon { color: #16a34a; }
            }
          }
        }

        .card-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            font-weight: 600;

            .dot { width: 6px; height: 6px; border-radius: 50%; }

            &.active {
              color: #059669;
              .dot { background: #10b981; }
            }
            &.inactive {
              color: #94a3b8;
              .dot { background: #cbd5e1; }
            }
          }

          .card-actions {
            display: flex;
            align-items: center;
            gap: 4px;

            .action-icon-btn {
              width: 30px;
              height: 30px;
              line-height: 30px;
              mat-icon { font-size: 16px; width: 16px; height: 16px; }

              &.edit-btn:hover { color: #0284c7; }
              &.delete-btn:hover { color: #ef4444; }
            }
          }
        }
      }
    }

    @media (max-width: 900px) {
      .metrics-strip { grid-template-columns: 1fr; }
      .items-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class AccountSettingsComponent implements OnInit {
  private accountSettingsService = inject(AccountSettingsService);
  private dialog = inject(MatDialog);
  private notif = inject(NotificationService);
  public rbacService = inject(RbacService);

  currentYear = new Date().getFullYear();

  settings = this.accountSettingsService.settings;
  isLoading = this.accountSettingsService.isLoading;
  canManage = this.accountSettingsService.canManageSettings;

  totalVoucherTypesCount = computed(() => this.settings().voucherTypes?.length || 0);
  activeVoucherTypesCount = computed(() => (this.settings().voucherTypes || []).filter(v => v.isActive).length);

  totalPaymentMethodsCount = computed(() => this.settings().paymentMethods?.length || 0);
  activePaymentMethodsCount = computed(() => (this.settings().paymentMethods || []).filter(pm => pm.isActive).length);

  ngOnInit() {
    this.accountSettingsService.loadSettings().subscribe();
  }

  // --- Voucher Types CRUD ---
  openAddVoucherTypeModal() {
    if (!this.canManage()) return;
    const ref = this.dialog.open(VoucherTypeDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      data: {}
    });

    ref.afterClosed().subscribe(async (result: VoucherTypeConfig) => {
      if (result) {
        try {
          await this.accountSettingsService.saveVoucherType(result);
          this.notif.success(`Voucher Type "${result.name}" added successfully`);
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to add voucher type');
        }
      }
    });
  }

  openEditVoucherTypeModal(vt: VoucherTypeConfig) {
    if (!this.canManage()) return;
    const ref = this.dialog.open(VoucherTypeDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      data: { voucherType: vt }
    });

    ref.afterClosed().subscribe(async (result: VoucherTypeConfig) => {
      if (result) {
        try {
          await this.accountSettingsService.saveVoucherType(result);
          this.notif.success(`Voucher Type "${result.name}" updated successfully`);
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to update voucher type');
        }
      }
    });
  }

  async toggleVoucherType(id: string) {
    if (!this.canManage()) return;
    try {
      await this.accountSettingsService.toggleVoucherType(id);
      this.notif.success('Voucher type status updated');
    } catch (e: any) {
      this.notif.error(e?.message || 'Failed to toggle status');
    }
  }

  deleteVoucherType(vt: VoucherTypeConfig) {
    if (!this.canManage() || vt.isDefault) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete Voucher Type',
        message: `Are you sure you want to delete Voucher Type "${vt.name}" (${vt.prefix || vt.code})? Existing vouchers recorded with this type will retain their history.`,
        confirmText: 'Delete Type'
      }
    });

    ref.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.accountSettingsService.deleteVoucherType(vt.id);
          this.notif.success(`Voucher Type "${vt.name}" removed successfully`);
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to delete voucher type');
        }
      }
    });
  }

  // --- Payment Methods CRUD ---
  openAddPaymentMethodModal() {
    if (!this.canManage()) return;
    const ref = this.dialog.open(PaymentMethodDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      data: {}
    });

    ref.afterClosed().subscribe(async (result: PaymentMethodConfig) => {
      if (result) {
        try {
          await this.accountSettingsService.savePaymentMethod(result);
          this.notif.success(`Payment Method "${result.name}" added successfully`);
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to add payment method');
        }
      }
    });
  }

  openEditPaymentMethodModal(pm: PaymentMethodConfig) {
    if (!this.canManage()) return;
    const ref = this.dialog.open(PaymentMethodDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      data: { paymentMethod: pm }
    });

    ref.afterClosed().subscribe(async (result: PaymentMethodConfig) => {
      if (result) {
        try {
          await this.accountSettingsService.savePaymentMethod(result);
          this.notif.success(`Payment Method "${result.name}" updated successfully`);
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to update payment method');
        }
      }
    });
  }

  async togglePaymentMethod(id: string) {
    if (!this.canManage()) return;
    try {
      await this.accountSettingsService.togglePaymentMethod(id);
      this.notif.success('Payment method status updated');
    } catch (e: any) {
      this.notif.error(e?.message || 'Failed to toggle status');
    }
  }

  deletePaymentMethod(pm: PaymentMethodConfig) {
    if (!this.canManage() || pm.isDefault) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete Payment Method',
        message: `Are you sure you want to delete Payment Method "${pm.name}"? Existing vouchers recorded with this method will retain their records.`,
        confirmText: 'Delete Method'
      }
    });

    ref.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.accountSettingsService.deletePaymentMethod(pm.id);
          this.notif.success(`Payment Method "${pm.name}" removed successfully`);
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to delete payment method');
        }
      }
    });
  }

  // --- Reset to Defaults ---
  resetToDefaults() {
    if (!this.canManage()) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Reset Account Settings to System Defaults',
        message: 'This will reset all Voucher Types (PV, RV, PCV, JV) and Payment Methods (Cash, Cheque, Bank Transfer, Online) to standard institutional defaults. Custom configurations will be replaced. Proceed?',
        confirmText: 'Reset to Defaults'
      }
    });

    ref.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.accountSettingsService.resetToDefaults();
          this.notif.success('Account settings restored to system defaults');
        } catch (e: any) {
          this.notif.error(e?.message || 'Failed to reset settings');
        }
      }
    });
  }
}
