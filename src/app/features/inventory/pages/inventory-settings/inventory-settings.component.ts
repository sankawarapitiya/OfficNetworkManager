import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { InventorySettings, DEFAULT_INVENTORY_SETTINGS, InventoryApprovalWorkflow } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RbacService } from '../../../../auth/rbac.service';

@Component({
  selector: 'app-inventory-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './inventory-settings.component.html',
  styleUrl: './inventory-settings.component.scss'
})
export class InventorySettingsComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private fb = inject(FormBuilder);
  private notif = inject(NotificationService);
  rbacService = inject(RbacService);

  settingsForm!: FormGroup;
  isLoading = signal<boolean>(true);

  canManageSettings = computed(() => {
    return this.rbacService.isAdmin() ||
           this.rbacService.isSuperAdmin() ||
           this.rbacService.isDivisionalAdmin() ||
           this.rbacService.hasRole('Store Manager') ||
           this.rbacService.hasPermission('inventory:settings');
  });

  // Chip lists
  categories = signal<string[]>([...DEFAULT_INVENTORY_SETTINGS.categories]);
  locations = signal<string[]>([...DEFAULT_INVENTORY_SETTINGS.locations]);
  units = signal<string[]>([...DEFAULT_INVENTORY_SETTINGS.units]);

  // Input bindings for adding new chips
  newCategoryInput = '';
  newLocationInput = '';
  newUnitInput = '';

  ngOnInit() {
    this.initForm();
    this.loadSettings();
  }

  private initForm() {
    this.settingsForm = this.fb.group({
      approvalWorkflow: ['direct_store_manager' as InventoryApprovalWorkflow],
      allowZeroStockRequests: [false],
      enableLowStockAlerts: [true],
      defaultLowStockThreshold: [10],
      requestPrefix: ['REQ'],
      movablePrefix: ['INV-M'],
      assetPrefix: ['AST']
    });
  }

  private loadSettings() {
    this.isLoading.set(true);
    this.inventoryService.getSettings().subscribe({
      next: (s) => {
        if (s) {
          this.settingsForm.patchValue({
            approvalWorkflow: s.approvalWorkflow || 'direct_store_manager',
            allowZeroStockRequests: s.allowZeroStockRequests ?? false,
            enableLowStockAlerts: s.enableLowStockAlerts ?? true,
            defaultLowStockThreshold: s.defaultLowStockThreshold ?? 10,
            requestPrefix: s.requestPrefix || 'REQ',
            movablePrefix: s.movablePrefix || 'INV-M',
            assetPrefix: s.assetPrefix || 'AST'
          });

          if (s.categories?.length) this.categories.set([...s.categories]);
          if (s.locations?.length) this.locations.set([...s.locations]);
          if (s.units?.length) this.units.set([...s.units]);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  // --- Category Chips ---
  addCategory() {
    const val = this.newCategoryInput.trim();
    if (val && !this.categories().includes(val)) {
      this.categories.update(arr => [...arr, val]);
      this.newCategoryInput = '';
    }
  }

  removeCategory(cat: string) {
    this.categories.update(arr => arr.filter(c => c !== cat));
  }

  // --- Location Chips ---
  addLocation() {
    const val = this.newLocationInput.trim();
    if (val && !this.locations().includes(val)) {
      this.locations.update(arr => [...arr, val]);
      this.newLocationInput = '';
    }
  }

  removeLocation(loc: string) {
    this.locations.update(arr => arr.filter(l => l !== loc));
  }

  // --- Unit Chips ---
  addUnit() {
    const val = this.newUnitInput.trim();
    if (val && !this.units().includes(val)) {
      this.units.update(arr => [...arr, val]);
      this.newUnitInput = '';
    }
  }

  removeUnit(u: string) {
    this.units.update(arr => arr.filter(unit => unit !== u));
  }

  async onSaveSettings() {
    if (!this.canManageSettings()) {
      this.notif.error('Permission denied: You do not have permission to modify inventory settings.');
      return;
    }
    try {
      const val = this.settingsForm.value;
      const updatedSettings: InventorySettings = {
        approvalWorkflow: val.approvalWorkflow,
        allowZeroStockRequests: val.allowZeroStockRequests,
        enableLowStockAlerts: val.enableLowStockAlerts,
        defaultLowStockThreshold: parseInt(val.defaultLowStockThreshold, 10) || 10,
        requestPrefix: val.requestPrefix || 'REQ',
        movablePrefix: val.movablePrefix || 'INV-M',
        assetPrefix: val.assetPrefix || 'AST',
        categories: this.categories(),
        locations: this.locations(),
        units: this.units()
      };

      await this.inventoryService.updateSettings(updatedSettings);
      this.notif.success('Inventory settings and approval workflow saved!');
    } catch (e) {
      console.error('Failed to save inventory settings:', e);
      this.notif.error('Failed to save settings');
    }
  }

  resetToDefaults() {
    if (!this.canManageSettings()) {
      this.notif.error('Permission denied: You do not have permission to reset inventory settings.');
      return;
    }
    const confirm = window.confirm('Reset all categories, locations, and settings to factory defaults?');
    if (confirm) {
      this.settingsForm.patchValue({
        approvalWorkflow: DEFAULT_INVENTORY_SETTINGS.approvalWorkflow,
        allowZeroStockRequests: DEFAULT_INVENTORY_SETTINGS.allowZeroStockRequests,
        enableLowStockAlerts: DEFAULT_INVENTORY_SETTINGS.enableLowStockAlerts,
        defaultLowStockThreshold: DEFAULT_INVENTORY_SETTINGS.defaultLowStockThreshold,
        requestPrefix: DEFAULT_INVENTORY_SETTINGS.requestPrefix,
        movablePrefix: DEFAULT_INVENTORY_SETTINGS.movablePrefix,
        assetPrefix: DEFAULT_INVENTORY_SETTINGS.assetPrefix
      });
      this.categories.set([...DEFAULT_INVENTORY_SETTINGS.categories]);
      this.locations.set([...DEFAULT_INVENTORY_SETTINGS.locations]);
      this.units.set([...DEFAULT_INVENTORY_SETTINGS.units]);
      this.notif.info('Settings reset to defaults. Click "Save Configuration" to persist.');
    }
  }
}
