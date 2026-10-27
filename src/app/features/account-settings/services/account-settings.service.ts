import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AuthService } from '../../../auth/auth.service';
import { RbacService } from '../../../auth/rbac.service';
import {
  AccountSettings,
  VoucherTypeConfig,
  PaymentMethodConfig,
  DEFAULT_ACCOUNT_SETTINGS,
  DEFAULT_VOUCHER_TYPES,
  DEFAULT_PAYMENT_METHODS
} from '../models/account-settings.model';

@Injectable({
  providedIn: 'root'
})
export class AccountSettingsService {
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private rbacService = inject(RbacService);

  private readonly docPath = 'settings/account_settings';

  settings = signal<AccountSettings>(DEFAULT_ACCOUNT_SETTINGS);
  isLoading = signal<boolean>(true);

  activeVoucherTypes = computed(() => {
    const list = this.settings().voucherTypes || [];
    return list.filter(vt => vt.isActive);
  });

  activePaymentMethods = computed(() => {
    const list = this.settings().paymentMethods || [];
    return list.filter(pm => pm.isActive);
  });

  canManageSettings = computed(() => {
    return this.rbacService.isAdmin() ||
           this.rbacService.isSuperAdmin() ||
           this.rbacService.isDivisionalAdmin() ||
           this.rbacService.hasRole('Department Head');
  });

  constructor() {
    this.loadSettings();
  }

  loadSettings(): Observable<AccountSettings | undefined> {
    this.isLoading.set(true);
    return this.firestoreService.getDocument<AccountSettings>(this.docPath).pipe(
      tap({
        next: (data) => {
          if (data && data.voucherTypes && data.paymentMethods) {
            this.settings.set(data);
          } else if (data) {
            // Merge with defaults if missing either array
            this.settings.set({
              voucherTypes: data.voucherTypes || DEFAULT_VOUCHER_TYPES,
              paymentMethods: data.paymentMethods || DEFAULT_PAYMENT_METHODS,
              updatedAt: data.updatedAt,
              updatedBy: data.updatedBy
            });
          } else {
            // First time init with defaults
            this.settings.set(DEFAULT_ACCOUNT_SETTINGS);
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          console.warn('Failed to load account settings from Firestore, using defaults:', err);
          this.settings.set(DEFAULT_ACCOUNT_SETTINGS);
          this.isLoading.set(false);
        }
      })
    );
  }

  getVoucherTypeByName(name: string): VoucherTypeConfig | undefined {
    return this.settings().voucherTypes.find(vt => vt.name.toLowerCase() === name.toLowerCase());
  }

  getPaymentMethodByName(name: string): PaymentMethodConfig | undefined {
    return this.settings().paymentMethods.find(pm => pm.name.toLowerCase() === name.toLowerCase());
  }

  async saveSettings(updated: AccountSettings): Promise<void> {
    const user = this.authService.currentUser();
    const payload: AccountSettings = {
      voucherTypes: updated.voucherTypes || [],
      paymentMethods: updated.paymentMethods || [],
      updatedAt: Date.now(),
      updatedBy: user?.displayName || user?.email || 'Authorized Officer'
    };

    await this.firestoreService.setDocument('settings', 'account_settings', payload);
    this.settings.set(payload);
  }

  async saveVoucherType(vt: VoucherTypeConfig): Promise<void> {
    const current = this.settings();
    let updatedList = [...current.voucherTypes];
    const index = updatedList.findIndex(item => item.id === vt.id);

    if (index >= 0) {
      updatedList[index] = { ...updatedList[index], ...vt };
    } else {
      updatedList.push({
        ...vt,
        id: vt.id || `vt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        order: updatedList.length + 1
      });
    }

    await this.saveSettings({
      ...current,
      voucherTypes: updatedList
    });
  }

  async toggleVoucherType(id: string): Promise<void> {
    const current = this.settings();
    const updatedList = current.voucherTypes.map(vt => {
      if (vt.id === id) {
        return { ...vt, isActive: !vt.isActive };
      }
      return vt;
    });

    await this.saveSettings({
      ...current,
      voucherTypes: updatedList
    });
  }

  async deleteVoucherType(id: string): Promise<void> {
    const current = this.settings();
    const updatedList = current.voucherTypes.filter(vt => vt.id !== id);

    await this.saveSettings({
      ...current,
      voucherTypes: updatedList
    });
  }

  async savePaymentMethod(pm: PaymentMethodConfig): Promise<void> {
    const current = this.settings();
    let updatedList = [...current.paymentMethods];
    const index = updatedList.findIndex(item => item.id === pm.id);

    if (index >= 0) {
      updatedList[index] = { ...updatedList[index], ...pm };
    } else {
      updatedList.push({
        ...pm,
        id: pm.id || `pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        order: updatedList.length + 1
      });
    }

    await this.saveSettings({
      ...current,
      paymentMethods: updatedList
    });
  }

  async togglePaymentMethod(id: string): Promise<void> {
    const current = this.settings();
    const updatedList = current.paymentMethods.map(pm => {
      if (pm.id === id) {
        return { ...pm, isActive: !pm.isActive };
      }
      return pm;
    });

    await this.saveSettings({
      ...current,
      paymentMethods: updatedList
    });
  }

  async deletePaymentMethod(id: string): Promise<void> {
    const current = this.settings();
    const updatedList = current.paymentMethods.filter(pm => pm.id !== id);

    await this.saveSettings({
      ...current,
      paymentMethods: updatedList
    });
  }

  async resetToDefaults(): Promise<void> {
    await this.saveSettings(DEFAULT_ACCOUNT_SETTINGS);
  }
}
