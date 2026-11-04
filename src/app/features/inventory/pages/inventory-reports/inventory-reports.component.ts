import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';

import { InventoryService } from '../../services/inventory.service';
import { 
  InventoryItem, 
  InventoryRequest, 
  StockTransaction, 
  InventorySettings,
  DEFAULT_INVENTORY_SETTINGS,
  ItemType
} from '../../models/inventory.model';
import { SettingsService, Division } from '../../../settings/settings.service';
import { AuthService } from '../../../../auth/auth.service';

export type StockReportType = 
  | 'stock-balance'        // Stock Balance & Valuation Register
  | 'low-stock'            // Low Stock & Reorder Advisory
  | 'fixed-assets'          // Fixed Assets & Immovable Register
  | 'stock-issue'          // Stock Dispatches & Consumption
  | 'requisitions'         // Requisition Fulfillment Analysis
  | 'audit-ledger'         // Physical Stock Movements Audit Ledger
  | 'consumption-matrix';  // Department vs Category Consumption Matrix

export type TimeframePreset = 'all' | 'today' | 'this-week' | 'this-month' | 'this-quarter' | 'this-year' | 'custom';

export interface ReportTabDef {
  id: StockReportType;
  label: string;
  icon: string;
  description: string;
  badge?: string;
}

export interface DispatchedIssueRow {
  date: number;
  requestNo: string;
  itemCode: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  division: string;
  requesterName: string;
  releasedBy: string;
  purpose: string;
}

export interface MatrixRow {
  department: string;
  categories: Record<string, number>;
  totalQty: number;
  totalValue: number;
}

@Component({
  selector: 'app-inventory-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatMenuModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule
  ],
  templateUrl: './inventory-reports.component.html',
  styleUrl: './inventory-reports.component.scss'
})
export class InventoryReportsComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);

  // Raw Signals from Firestore
  items = signal<InventoryItem[]>([]);
  requests = signal<InventoryRequest[]>([]);
  transactions = signal<StockTransaction[]>([]);
  settings = signal<InventorySettings>(DEFAULT_INVENTORY_SETTINGS);
  divisions = signal<Division[]>([]);
  isLoading = signal<boolean>(true);

  // Active Report Tab
  activeReport = signal<StockReportType>('stock-balance');

  // Filter Signals
  timeframe = signal<TimeframePreset>('this-month');
  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);
  selectedCategory = signal<string>('ALL');
  selectedDivision = signal<string>('ALL');
  selectedCondition = signal<string>('ALL');
  searchQuery = signal<string>('');

  // Generation Metadata
  generatedAt = signal<Date>(new Date());
  generatedBy = computed(() => {
    const user = this.authService.currentUser();
    return user?.displayName || user?.email || 'Store Administration Officer';
  });

  // Report Tabs Configuration
  reportTabs: ReportTabDef[] = [
    {
      id: 'stock-balance',
      label: 'Stock Balance & Valuation',
      icon: 'inventory_2',
      description: 'Current physical balances, on-hand counts & stock valuation'
    },
    {
      id: 'low-stock',
      label: 'Low Stock & Reorder Advisory',
      icon: 'warning',
      description: 'Items below minimum threshold & purchase budget requirements'
    },
    {
      id: 'fixed-assets',
      label: 'Fixed Assets Register',
      icon: 'domain',
      description: 'Immovable assets, room allocations, custodians & condition status'
    },
    {
      id: 'stock-issue',
      label: 'Dispatches & Consumption',
      icon: 'output',
      description: 'Stock issued to divisions, recipients & consumption volume'
    },
    {
      id: 'requisitions',
      label: 'Requisitions Fulfillment',
      icon: 'assignment',
      description: 'Requisition pipeline, approval rates & turnaround status'
    },
    {
      id: 'audit-ledger',
      label: 'Movements Audit Ledger',
      icon: 'receipt_long',
      description: 'Complete chronological transaction log with before/after balances'
    },
    {
      id: 'consumption-matrix',
      label: 'Consumption Matrix',
      icon: 'grid_view',
      description: 'Cross-tabulation of departmental consumption by product category'
    }
  ];

  ngOnInit() {
    this.setTimeframePreset('this-month');
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);

    this.inventoryService.getItems().subscribe({
      next: (data) => {
        this.items.set(data || []);
      },
      error: (err) => console.error('Error fetching inventory items', err)
    });

    this.inventoryService.getRequests().subscribe({
      next: (data) => {
        this.requests.set(data || []);
      },
      error: (err) => console.error('Error fetching requests', err)
    });

    this.inventoryService.getTransactions().subscribe({
      next: (data) => {
        this.transactions.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching transactions', err);
        this.isLoading.set(false);
      }
    });

    this.inventoryService.getSettings().subscribe({
      next: (data) => {
        if (data) this.settings.set(data);
      }
    });

    this.settingsService.getDivisions().subscribe({
      next: (data) => {
        this.divisions.set(data || []);
      }
    });
  }

  // ==========================================
  // TIMEFRAME PRESETS
  // ==========================================
  setTimeframePreset(preset: TimeframePreset) {
    this.timeframe.set(preset);
    const now = new Date();

    if (preset === 'all') {
      this.dateFrom.set(null);
      this.dateTo.set(null);
      return;
    }

    if (preset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      this.dateFrom.set(start);
      this.dateTo.set(end);
      return;
    }

    if (preset === 'this-week') {
      const currentDay = now.getDay();
      const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
      this.dateFrom.set(monday);
      this.dateTo.set(sunday);
      return;
    }

    if (preset === 'this-month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      this.dateFrom.set(start);
      this.dateTo.set(end);
      return;
    }

    if (preset === 'this-quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
      this.dateFrom.set(start);
      this.dateTo.set(end);
      return;
    }

    if (preset === 'this-year') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      this.dateFrom.set(start);
      this.dateTo.set(end);
      return;
    }
  }

  isWithinDateRange(timestamp?: number | string): boolean {
    if (!timestamp) return true;
    const from = this.dateFrom();
    const to = this.dateTo();
    if (!from && !to) return true;

    const t = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    if (from && t < from.getTime()) return false;
    if (to && t > to.getTime()) return false;
    return true;
  }

  // ==========================================
  // REPORT 1: STOCK BALANCE & VALUATION
  // ==========================================
  filteredStockBalanceItems = computed(() => {
    let list = this.items().filter(i => (i.itemType || 'movable') === 'movable');
    const cat = this.selectedCategory();
    const q = this.searchQuery().trim().toLowerCase();

    if (cat !== 'ALL') {
      list = list.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase());
    }

    if (q) {
      list = list.filter(i => 
        (i.name || '').toLowerCase().includes(q) ||
        (i.itemCode || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

  stockBalanceMetrics = computed(() => {
    const list = this.filteredStockBalanceItems();
    const totalItems = list.length;
    let totalQty = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of list) {
      const q = item.quantity || 0;
      const price = item.unitCost || 0;
      const min = item.minStockAlert ?? 10;
      totalQty += q;
      totalValuation += q * price;
      if (q <= 0) {
        outOfStockCount++;
      } else if (q <= min) {
        lowStockCount++;
      }
    }

    return {
      totalItems,
      totalQty,
      totalValuation,
      lowStockCount,
      outOfStockCount
    };
  });

  categoryBalanceSummary = computed(() => {
    const list = this.filteredStockBalanceItems();
    const map = new Map<string, { count: number; qty: number; valuation: number }>();

    for (const item of list) {
      const cat = item.category || 'General Supplies';
      const existing = map.get(cat) || { count: 0, qty: 0, valuation: 0 };
      const q = item.quantity || 0;
      const p = item.unitCost || 0;
      existing.count += 1;
      existing.qty += q;
      existing.valuation += q * p;
      map.set(cat, existing);
    }

    return Array.from(map.entries()).map(([category, stats]) => ({
      category,
      ...stats
    })).sort((a, b) => b.valuation - a.valuation);
  });

  // ==========================================
  // REPORT 2: LOW STOCK & REORDER ADVISORY
  // ==========================================
  filteredLowStockItems = computed(() => {
    let list = this.items().filter(i => {
      if ((i.itemType || 'movable') !== 'movable') return false;
      const q = i.quantity || 0;
      const min = i.minStockAlert ?? 10;
      return q <= min;
    });

    const cat = this.selectedCategory();
    const q = this.searchQuery().trim().toLowerCase();

    if (cat !== 'ALL') {
      list = list.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase());
    }

    if (q) {
      list = list.filter(i => 
        (i.name || '').toLowerCase().includes(q) ||
        (i.itemCode || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
  });

  lowStockMetrics = computed(() => {
    const list = this.filteredLowStockItems();
    let outOfStockCount = 0;
    let totalDeficit = 0;
    let totalBudgetRequired = 0;

    for (const item of list) {
      const q = item.quantity || 0;
      const min = item.minStockAlert ?? 10;
      const deficit = Math.max(0, min - q);
      const suggested = Math.max(0, (min * 2) - q);
      const price = item.unitCost || 0;

      if (q <= 0) outOfStockCount++;
      totalDeficit += deficit;
      totalBudgetRequired += suggested * price;
    }

    return {
      totalAlertItems: list.length,
      outOfStockCount,
      totalDeficit,
      totalBudgetRequired
    };
  });

  // ==========================================
  // REPORT 3: FIXED ASSETS REGISTER
  // ==========================================
  filteredFixedAssets = computed(() => {
    let list = this.items().filter(i => i.itemType === 'immovable');
    const cat = this.selectedCategory();
    const div = this.selectedDivision();
    const cond = this.selectedCondition();
    const q = this.searchQuery().trim().toLowerCase();

    if (cat !== 'ALL') {
      list = list.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase());
    }

    if (div !== 'ALL') {
      list = list.filter(i => (i.location || '').toLowerCase().includes(div.toLowerCase()) || (i.division || '').toLowerCase().includes(div.toLowerCase()));
    }

    if (cond !== 'ALL') {
      list = list.filter(i => (i.condition || '').toLowerCase() === cond.toLowerCase());
    }

    if (q) {
      list = list.filter(i => 
        (i.name || '').toLowerCase().includes(q) ||
        (i.serialNumber || '').toLowerCase().includes(q) ||
        (i.assetTag || '').toLowerCase().includes(q) ||
        (i.custodianName || '').toLowerCase().includes(q) ||
        (i.location || '').toLowerCase().includes(q) ||
        (i.itemCode || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
  });

  fixedAssetsMetrics = computed(() => {
    const list = this.filteredFixedAssets();
    let totalBookValue = 0;
    let goodCount = 0;
    let repairCount = 0;
    let damagedCount = 0;

    for (const asset of list) {
      totalBookValue += asset.unitCost || 0;
      const c = asset.condition || 'Good';
      if (c === 'Good' || c === 'Fair') goodCount++;
      else if (c === 'Needs Repair') repairCount++;
      else damagedCount++;
    }

    return {
      totalAssets: list.length,
      totalBookValue,
      goodCount,
      repairCount,
      damagedCount
    };
  });

  locationAssetSummary = computed(() => {
    const list = this.filteredFixedAssets();
    const map = new Map<string, { count: number; bookValue: number }>();

    for (const asset of list) {
      const loc = asset.location || 'Unassigned Location';
      const existing = map.get(loc) || { count: 0, bookValue: 0 };
      existing.count += 1;
      existing.bookValue += asset.unitCost || 0;
      map.set(loc, existing);
    }

    return Array.from(map.entries()).map(([location, stats]) => ({
      location,
      ...stats
    })).sort((a, b) => b.count - a.count);
  });

  // ==========================================
  // REPORT 4: STOCK DISPATCHES & CONSUMPTION
  // ==========================================
  filteredStockIssues = computed<DispatchedIssueRow[]>(() => {
    const rows: DispatchedIssueRow[] = [];
    const itemMap = new Map<string, InventoryItem>();
    this.items().forEach(item => {
      if (item.id) itemMap.set(item.id, item);
    });

    const releasedReqs = this.requests().filter(r => 
      (r.status === 'Released' || r.status === 'Partially Released') &&
      this.isWithinDateRange(r.releaseDetails?.releasedAt || r.updatedAt || r.createdAt)
    );

    const divFilter = this.selectedDivision();
    const catFilter = this.selectedCategory();
    const q = this.searchQuery().trim().toLowerCase();

    for (const req of releasedReqs) {
      const reqDiv = req.division || req.department || 'General Administration';
      if (divFilter !== 'ALL' && !reqDiv.toLowerCase().includes(divFilter.toLowerCase())) {
        continue;
      }

      for (const line of req.items) {
        const releasedQty = line.releasedQty ?? 0;
        if (releasedQty <= 0) continue;

        const itemObj = itemMap.get(line.itemId);
        const cat = itemObj?.category || 'General Supplies';

        if (catFilter !== 'ALL' && cat.toLowerCase() !== catFilter.toLowerCase()) {
          continue;
        }

        const unitCost = itemObj?.unitCost || 0;
        const totalVal = releasedQty * unitCost;
        const date = req.releaseDetails?.releasedAt || req.updatedAt || req.createdAt || 0;

        const row: DispatchedIssueRow = {
          date,
          requestNo: req.requestNo,
          itemCode: line.itemCode || itemObj?.itemCode || '-',
          itemName: line.itemName || itemObj?.name || 'Unknown Item',
          category: cat,
          quantity: releasedQty,
          unit: line.unit || itemObj?.unit || 'units',
          unitPrice: unitCost,
          totalValue: totalVal,
          division: reqDiv,
          requesterName: req.requesterName,
          releasedBy: req.releaseDetails?.releasedBy || 'Store Manager',
          purpose: req.purpose || '-'
        };

        if (q) {
          const match = 
            row.itemName.toLowerCase().includes(q) ||
            row.itemCode.toLowerCase().includes(q) ||
            row.requestNo.toLowerCase().includes(q) ||
            row.division.toLowerCase().includes(q) ||
            row.requesterName.toLowerCase().includes(q);
          if (!match) continue;
        }

        rows.push(row);
      }
    }

    return rows.sort((a, b) => b.date - a.date);
  });

  stockIssueMetrics = computed(() => {
    const list = this.filteredStockIssues();
    let totalQty = 0;
    let totalValue = 0;
    const divSet = new Set<string>();

    for (const r of list) {
      totalQty += r.quantity;
      totalValue += r.totalValue;
      if (r.division) divSet.add(r.division);
    }

    return {
      totalIssuesCount: list.length,
      totalQty,
      totalValue,
      uniqueDivisions: divSet.size
    };
  });

  divisionConsumptionSummary = computed(() => {
    const list = this.filteredStockIssues();
    const map = new Map<string, { dispatches: number; qty: number; value: number }>();

    for (const item of list) {
      const div = item.division || 'Unassigned';
      const existing = map.get(div) || { dispatches: 0, qty: 0, value: 0 };
      existing.dispatches += 1;
      existing.qty += item.quantity;
      existing.value += item.totalValue;
      map.set(div, existing);
    }

    return Array.from(map.entries()).map(([division, stats]) => ({
      division,
      ...stats
    })).sort((a, b) => b.value - a.value);
  });

  // ==========================================
  // REPORT 5: REQUISITIONS FULFILLMENT
  // ==========================================
  filteredRequisitions = computed(() => {
    let list = this.requests().filter(r => this.isWithinDateRange(r.createdAt));
    const div = this.selectedDivision();
    const q = this.searchQuery().trim().toLowerCase();

    if (div !== 'ALL') {
      list = list.filter(r => (r.division || r.department || '').toLowerCase().includes(div.toLowerCase()));
    }

    if (q) {
      list = list.filter(r => 
        (r.requestNo || '').toLowerCase().includes(q) ||
        (r.requesterName || '').toLowerCase().includes(q) ||
        (r.purpose || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  });

  requisitionMetrics = computed(() => {
    const list = this.filteredRequisitions();
    const total = list.length;
    let fullyReleased = 0;
    let partiallyReleased = 0;
    let pendingAction = 0;
    let rejected = 0;

    for (const r of list) {
      if (r.status === 'Released') fullyReleased++;
      else if (r.status === 'Partially Released') partiallyReleased++;
      else if (r.status === 'Pending' || r.status === 'Supervisor Approved') pendingAction++;
      else if (r.status === 'Rejected') rejected++;
    }

    const fulfillmentRate = total > 0 ? Math.round(((fullyReleased + partiallyReleased * 0.5) / total) * 100) : 0;

    return {
      total,
      fullyReleased,
      partiallyReleased,
      pendingAction,
      rejected,
      fulfillmentRate
    };
  });

  // ==========================================
  // REPORT 6: AUDIT LEDGER (MOVEMENTS)
  // ==========================================
  filteredAuditLedger = computed(() => {
    let list = this.transactions().filter(t => this.isWithinDateRange(t.performedAt));
    const q = this.searchQuery().trim().toLowerCase();

    if (q) {
      list = list.filter(t => 
        (t.itemName || '').toLowerCase().includes(q) ||
        (t.itemCode || '').toLowerCase().includes(q) ||
        (t.transactionNo || '').toLowerCase().includes(q) ||
        (t.referenceNo || '').toLowerCase().includes(q) ||
        (t.performedBy || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.performedAt || 0) - (a.performedAt || 0));
  });

  auditLedgerMetrics = computed(() => {
    const list = this.filteredAuditLedger();
    let totalInUnits = 0;
    let totalOutUnits = 0;
    let adjustmentsCount = 0;

    for (const t of list) {
      const qty = t.quantity || 0;
      if (t.transactionType === 'IN_PURCHASE' || t.transactionType === 'IN_ADJUSTMENT') {
        totalInUnits += qty;
      } else if (t.transactionType === 'OUT_RELEASE' || t.transactionType === 'OUT_DAMAGE' || t.transactionType === 'OUT_WRITE_OFF') {
        totalOutUnits += qty;
      } else {
        adjustmentsCount++;
      }
    }

    return {
      totalTxns: list.length,
      totalInUnits,
      totalOutUnits,
      adjustmentsCount
    };
  });

  // ==========================================
  // REPORT 7: CONSUMPTION MATRIX
  // ==========================================
  matrixCategories = computed(() => {
    const available = this.settings().categories || [];
    if (available.length > 0) return available;
    return ['Stationery', 'Computer Accessories', 'Electrical Items', 'Cleaning Supplies', 'Office Equipment', 'Other'];
  });

  consumptionMatrix = computed<MatrixRow[]>(() => {
    const issues = this.filteredStockIssues();
    const categories = this.matrixCategories();
    const map = new Map<string, { categories: Record<string, number>; totalQty: number; totalValue: number }>();

    for (const issue of issues) {
      const div = issue.division || 'General Administration';
      if (!map.has(div)) {
        const catObj: Record<string, number> = {};
        for (const c of categories) catObj[c] = 0;
        map.set(div, { categories: catObj, totalQty: 0, totalValue: 0 });
      }

      const entry = map.get(div)!;
      const matchedCat = categories.find(c => c.toLowerCase() === (issue.category || '').toLowerCase()) || 'Other';
      
      if (!entry.categories[matchedCat]) {
        entry.categories[matchedCat] = 0;
      }
      entry.categories[matchedCat] += issue.quantity;
      entry.totalQty += issue.quantity;
      entry.totalValue += issue.totalValue;
    }

    return Array.from(map.entries()).map(([department, data]) => ({
      department,
      ...data
    })).sort((a, b) => b.totalValue - a.totalValue);
  });

  matrixTotals = computed(() => {
    const matrix = this.consumptionMatrix();
    const categories = this.matrixCategories();
    const catTotals: Record<string, number> = {};
    for (const c of categories) catTotals[c] = 0;
    let grandQty = 0;
    let grandValue = 0;

    for (const row of matrix) {
      grandQty += row.totalQty;
      grandValue += row.totalValue;
      for (const c of categories) {
        catTotals[c] += row.categories[c] || 0;
      }
    }

    return {
      catTotals,
      grandQty,
      grandValue
    };
  });

  // ==========================================
  // EXPORT TO EXCEL / CSV
  // ==========================================
  exportToCsv() {
    const rep = this.activeReport();
    let csvContent = '\uFEFF';
    let filename = `Stock_Report_${rep}_${new Date().toISOString().split('T')[0]}.csv`;

    if (rep === 'stock-balance') {
      const rows = this.filteredStockBalanceItems();
      csvContent += 'Item Code,Item Description,Category,Unit,Unit Cost (LKR),Quantity on Hand,Min Reorder Alert,Stock Valuation (LKR),Status\r\n';
      for (const r of rows) {
        const val = (r.quantity || 0) * (r.unitCost || 0);
        csvContent += `"${r.itemCode}","${this.escapeCsv(r.name)}","${r.category}","${r.unit}",${r.unitCost || 0},${r.quantity || 0},${r.minStockAlert || 0},${val},"${r.status}"\r\n`;
      }
      csvContent += `,,,Total Valuation,,${this.stockBalanceMetrics().totalQty},,${this.stockBalanceMetrics().totalValuation},\r\n`;
    } else if (rep === 'low-stock') {
      const rows = this.filteredLowStockItems();
      csvContent += 'Item Code,Item Name,Category,Current Qty,Min Reorder Level,Deficit Qty,Suggested Order Qty,Est. Unit Cost (LKR),Est. Budget Required (LKR),Urgency\r\n';
      for (const r of rows) {
        const q = r.quantity || 0;
        const min = r.minStockAlert ?? 10;
        const deficit = Math.max(0, min - q);
        const suggested = Math.max(0, (min * 2) - q);
        const price = r.unitCost || 0;
        const urgency = q <= 0 ? 'CRITICAL - OUT OF STOCK' : 'BELOW MINIMUM';
        csvContent += `"${r.itemCode}","${this.escapeCsv(r.name)}","${r.category}",${q},${min},${deficit},${suggested},${price},${suggested * price},"${urgency}"\r\n`;
      }
      csvContent += `,,,Total Budget Needed,,${this.lowStockMetrics().totalDeficit},,,${this.lowStockMetrics().totalBudgetRequired},\r\n`;
    } else if (rep === 'fixed-assets') {
      const rows = this.filteredFixedAssets();
      csvContent += 'Asset Tag #,Serial Number,Asset Description,Category,Location,Custodian Officer,Condition,Acquisition Date,Book Value (LKR),Status\r\n';
      for (const r of rows) {
        csvContent += `"${r.assetTag || r.itemCode}","${r.serialNumber || '-'}","${this.escapeCsv(r.name)}","${r.category}","${this.escapeCsv(r.location || '-')}","${this.escapeCsv(r.custodianName || '-')}","${r.condition || 'Good'}","${r.acquisitionDate || '-'}","${r.unitCost || 0}","${r.status}"\r\n`;
      }
      csvContent += `,,,Total Capital Value,,,,,,${this.fixedAssetsMetrics().totalBookValue}\r\n`;
    } else if (rep === 'stock-issue') {
      const rows = this.filteredStockIssues();
      csvContent += 'Date,Requisition #,Item Code,Item Name,Category,Issued Qty,Unit,Unit Cost (LKR),Total Value (LKR),Division,Recipient,Issued By,Purpose\r\n';
      for (const r of rows) {
        const dStr = new Date(r.date).toLocaleDateString('en-CA');
        csvContent += `"${dStr}","${r.requestNo}","${r.itemCode}","${this.escapeCsv(r.itemName)}","${r.category}",${r.quantity},"${r.unit}",${r.unitPrice},${r.totalValue},"${this.escapeCsv(r.division)}","${this.escapeCsv(r.requesterName)}","${this.escapeCsv(r.releasedBy)}","${this.escapeCsv(r.purpose)}"\r\n`;
      }
      csvContent += `,,,Total Dispatched Value,,${this.stockIssueMetrics().totalQty},,,${this.stockIssueMetrics().totalValue},,,,\r\n`;
    } else if (rep === 'requisitions') {
      const rows = this.filteredRequisitions();
      csvContent += 'Requisition #,Date,Requester,Department/Division,Urgency,Items Count,Status,Supervisor Approved,Released At,Purpose\r\n';
      for (const r of rows) {
        csvContent += `"${r.requestNo}","${r.requestDate}","${this.escapeCsv(r.requesterName)}","${this.escapeCsv(r.division || r.department || '')}","${r.urgency}",${r.items.length},"${r.status}","${r.supervisorApproval?.approvedBy || '-'}","${r.releaseDetails?.releasedBy || '-'}","${this.escapeCsv(r.purpose)}"\r\n`;
      }
    } else if (rep === 'audit-ledger') {
      const rows = this.filteredAuditLedger();
      csvContent += 'Date & Time,Transaction No,Item Code,Item Name,Movement Type,Qty Changed,Previous Balance,New Balance,Reference #,Performed By,Notes\r\n';
      for (const r of rows) {
        const dStr = new Date(r.performedAt).toLocaleString();
        csvContent += `"${dStr}","${r.transactionNo}","${r.itemCode}","${this.escapeCsv(r.itemName)}","${r.transactionType}",${r.quantity},${r.previousQty},${r.balanceQty},"${r.referenceNo || '-'}","${this.escapeCsv(r.performedBy)}","${this.escapeCsv(r.notes || '-')}"\r\n`;
      }
    } else if (rep === 'consumption-matrix') {
      const cats = this.matrixCategories();
      const rows = this.consumptionMatrix();
      csvContent += `Department/Division,${cats.map(c => `"${c}"`).join(',')},Total Units,Total Estimated Value (LKR)\r\n`;
      for (const r of rows) {
        const catVals = cats.map(c => r.categories[c] || 0).join(',');
        csvContent += `"${this.escapeCsv(r.department)}",${catVals},${r.totalQty},${r.totalValue}\r\n`;
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private escapeCsv(str: string): string {
    if (!str) return '';
    return str.replace(/"/g, '""');
  }

  // ==========================================
  // PRINT ACTION
  // ==========================================
  printReport() {
    this.generatedAt.set(new Date());
    window.print();
  }

  getCurrentReportTitle(): string {
    const tab = this.reportTabs.find(t => t.id === this.activeReport());
    return tab ? tab.label : 'Office Stock Report';
  }

  getTimeframeSummary(): string {
    const from = this.dateFrom();
    const to = this.dateTo();
    if (!from && !to) return 'All Records (Lifetime)';
    if (from && to) {
      return `${from.toLocaleDateString()} to ${to.toLocaleDateString()}`;
    }
    if (from) return `From ${from.toLocaleDateString()}`;
    if (to) return `Up to ${to.toLocaleDateString()}`;
    return 'All Records';
  }
}
