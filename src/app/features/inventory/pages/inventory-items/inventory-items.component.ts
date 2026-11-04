import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import * as XLSX from 'xlsx';

import { InventoryItem, ItemType } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { ItemDialogComponent } from '../../components/item-dialog/item-dialog.component';
import { ItemDetailDialogComponent } from '../../components/item-detail-dialog/item-detail-dialog.component';
import { StockAdjustDialogComponent } from '../../components/stock-adjust-dialog/stock-adjust-dialog.component';
import { RequestDialogComponent } from '../../components/request-dialog/request-dialog.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { RbacService } from '../../../../auth/rbac.service';

@Component({
  selector: 'app-inventory-items',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule
  ],
  templateUrl: './inventory-items.component.html',
  styleUrl: './inventory-items.component.scss'
})
export class InventoryItemsComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private dialog = inject(MatDialog);
  private notif = inject(NotificationService);
  rbacService = inject(RbacService);

  items = signal<InventoryItem[]>([]);
  isLoading = signal<boolean>(true);

  // Filters
  searchQuery = signal<string>('');
  selectedTypeFilter = signal<'ALL' | 'MOVABLE' | 'IMMOVABLE' | 'LOW_STOCK'>('ALL');
  selectedCategory = signal<string>('All');
  selectedLocation = signal<string>('All');

  // Table columns
  displayedColumns: string[] = [
    'code',
    'name',
    'type',
    'category',
    'stockOrTag',
    'location',
    'status',
    'actions'
  ];

  // Metrics
  totalItemsCount = computed(() => this.items().length);

  movableCount = computed(() => {
    return this.items().filter(i => i.itemType === 'movable').length;
  });

  immovableCount = computed(() => {
    return this.items().filter(i => i.itemType === 'immovable').length;
  });

  lowStockCount = computed(() => {
    return this.items().filter(i => i.itemType === 'movable' && i.quantity <= i.minStockAlert).length;
  });

  categoriesList = computed(() => {
    const set = new Set<string>();
    this.items().forEach(i => { if (i.category) set.add(i.category); });
    return Array.from(set).sort();
  });

  locationsList = computed(() => {
    const set = new Set<string>();
    this.items().forEach(i => { if (i.location) set.add(i.location); });
    return Array.from(set).sort();
  });

  filteredItems = computed(() => {
    let list = this.items();
    const typeFilter = this.selectedTypeFilter();

    if (typeFilter === 'MOVABLE') {
      list = list.filter(i => i.itemType === 'movable');
    } else if (typeFilter === 'IMMOVABLE') {
      list = list.filter(i => i.itemType === 'immovable');
    } else if (typeFilter === 'LOW_STOCK') {
      list = list.filter(i => i.itemType === 'movable' && i.quantity <= i.minStockAlert);
    }

    const cat = this.selectedCategory();
    if (cat !== 'All') {
      list = list.filter(i => i.category === cat);
    }

    const loc = this.selectedLocation();
    if (loc !== 'All') {
      list = list.filter(i => i.location === loc);
    }

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.itemCode.toLowerCase().includes(q) ||
        (i.assetTag && i.assetTag.toLowerCase().includes(q)) ||
        (i.serialNumber && i.serialNumber.toLowerCase().includes(q)) ||
        (i.custodianName && i.custodianName.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q))
      );
    }

    return list;
  });

  ngOnInit() {
    this.loadItems();
  }

  loadItems() {
    this.isLoading.set(true);
    this.inventoryService.getItems().subscribe({
      next: (data) => {
        this.items.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load inventory items:', err);
        this.isLoading.set(false);
        this.notif.error('Failed to load inventory items');
      }
    });
  }

  setTypeFilter(filter: 'ALL' | 'MOVABLE' | 'IMMOVABLE' | 'LOW_STOCK') {
    this.selectedTypeFilter.set(filter);
  }

  openAddItemDialog(defaultType: ItemType = 'movable') {
    const dialogRef = this.dialog.open(ItemDialogComponent, {
      width: '740px',
      maxWidth: '96vw',
      data: { defaultType }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.inventoryService.addItem(result);
          this.notif.success(`Registered ${result.itemType === 'immovable' ? 'Asset' : 'Item'} "${result.name}" successfully!`);
        } catch (e: any) {
          console.error('Failed to add item:', e);
          this.notif.error(e?.message || 'Failed to register item');
        }
      }
    });
  }

  openEditDialog(item: InventoryItem) {
    const dialogRef = this.dialog.open(ItemDialogComponent, {
      width: '740px',
      maxWidth: '96vw',
      data: { item }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && item.id) {
        try {
          await this.inventoryService.updateItem(item.id, result);
          this.notif.success(`Updated "${result.name}" successfully!`);
        } catch (e: any) {
          console.error('Failed to update item:', e);
          this.notif.error(e?.message || 'Failed to update item');
        }
      }
    });
  }

  viewItemDetails(item: InventoryItem) {
    this.dialog.open(ItemDetailDialogComponent, {
      width: '820px',
      maxWidth: '96vw',
      data: { item }
    });
  }

  openAdjustDialog(item: InventoryItem) {
    const dialogRef = this.dialog.open(StockAdjustDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      data: { item }
    });

    dialogRef.afterClosed().subscribe(async (res) => {
      if (res) {
        try {
          await this.inventoryService.adjustStock(
            res.item,
            res.quantityChange,
            res.transactionType,
            res.notes,
            res.referenceNo
          );
          this.notif.success(`Stock adjusted for "${item.name}"`);
        } catch (e: any) {
          console.error('Failed to adjust stock:', e);
          this.notif.error('Failed to adjust stock');
        }
      }
    });
  }

  openRequestDialog() {
    const dialogRef = this.dialog.open(RequestDialogComponent, {
      width: '740px',
      maxWidth: '96vw'
    });

    dialogRef.afterClosed().subscribe(async (res) => {
      if (res) {
        try {
          await this.inventoryService.createRequest(res);
          this.notif.success(`Requisition ${res.requestNo} submitted successfully!`);
        } catch (e: any) {
          console.error('Failed to submit requisition:', e);
          this.notif.error('Failed to submit requisition');
        }
      }
    });
  }

  async deleteItem(item: InventoryItem) {
    if (!item.id) return;
    const confirm = window.confirm(`Are you sure you want to delete "${item.name}" (${item.itemCode}) from inventory?`);
    if (confirm) {
      try {
        await this.inventoryService.deleteItem(item.id, item.name);
        this.notif.success(`Removed "${item.name}" from inventory`);
      } catch (e: any) {
        console.error('Failed to delete item:', e);
        this.notif.error('Failed to delete item');
      }
    }
  }

  exportToExcel() {
    const data = this.filteredItems().map(i => ({
      'Code': i.itemCode,
      'Name': i.name,
      'Type': i.itemType === 'immovable' ? 'Immovable Fixed Asset' : 'Movable Store Item',
      'Category': i.category,
      'Quantity': i.itemType === 'movable' ? i.quantity : 'N/A',
      'Unit': i.unit,
      'Min Stock Alert': i.itemType === 'movable' ? i.minStockAlert : 'N/A',
      'Location': i.location,
      'Division': i.division || '',
      'Asset Tag': i.assetTag || '',
      'Serial Number': i.serialNumber || '',
      'Custodian': i.custodianName || '',
      'Condition': i.condition || '',
      'Status': i.status,
      'Unit Cost (LKR)': i.unitCost || 0
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory_Registry');
    XLSX.writeFile(wb, `Inventory_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.notif.success('Inventory registry exported to Excel!');
  }
}
