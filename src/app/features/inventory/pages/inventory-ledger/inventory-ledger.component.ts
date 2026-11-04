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
import { MatTooltipModule } from '@angular/material/tooltip';
import * as XLSX from 'xlsx';

import { StockTransaction, StockTransactionType } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-inventory-ledger',
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
    MatTooltipModule
  ],
  templateUrl: './inventory-ledger.component.html',
  styleUrl: './inventory-ledger.component.scss'
})
export class InventoryLedgerComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private notif = inject(NotificationService);

  transactions = signal<StockTransaction[]>([]);
  isLoading = signal<boolean>(true);

  // Filters
  searchQuery = signal<string>('');
  selectedTypeFilter = signal<string>('All');

  displayedColumns: string[] = [
    'date',
    'txnNo',
    'item',
    'type',
    'quantity',
    'balance',
    'reference',
    'officer'
  ];

  // Computed Metrics
  totalTxnCount = computed(() => this.transactions().length);

  inwardCount = computed(() => {
    return this.transactions().filter(t => t.transactionType.startsWith('IN_')).length;
  });

  outwardCount = computed(() => {
    return this.transactions().filter(t => t.transactionType.startsWith('OUT_')).length;
  });

  filteredTransactions = computed(() => {
    let list = this.transactions();
    const typeF = this.selectedTypeFilter();

    if (typeF !== 'All') {
      if (typeF === 'IN') {
        list = list.filter(t => t.transactionType.startsWith('IN_'));
      } else if (typeF === 'OUT') {
        list = list.filter(t => t.transactionType.startsWith('OUT_'));
      } else {
        list = list.filter(t => t.transactionType === typeF);
      }
    }

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(t =>
        t.transactionNo.toLowerCase().includes(q) ||
        t.itemName.toLowerCase().includes(q) ||
        t.itemCode.toLowerCase().includes(q) ||
        (t.referenceNo && t.referenceNo.toLowerCase().includes(q)) ||
        (t.performedBy && t.performedBy.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return list;
  });

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions() {
    this.isLoading.set(true);
    this.inventoryService.getTransactions().subscribe({
      next: (data) => {
        this.transactions.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load stock transactions:', err);
        this.isLoading.set(false);
        this.notif.error('Failed to load stock ledger transactions');
      }
    });
  }

  exportToExcel() {
    const data = this.filteredTransactions().map(t => ({
      'Date/Time': new Date(t.performedAt).toLocaleString(),
      'Transaction No': t.transactionNo,
      'Item Code': t.itemCode,
      'Item Name': t.itemName,
      'Type': t.transactionType,
      'Quantity Changed': t.transactionType.startsWith('IN_') ? `+${t.quantity}` : `-${t.quantity}`,
      'Previous Balance': t.previousQty,
      'New Balance': t.balanceQty,
      'Reference No': t.referenceNo || '',
      'Notes': t.notes || '',
      'Performed By': t.performedBy
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Ledger');
    XLSX.writeFile(wb, `Stock_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.notif.success('Stock transactions ledger exported to Excel!');
  }
}
