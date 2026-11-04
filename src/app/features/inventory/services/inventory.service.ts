import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AuthService } from '../../../auth/auth.service';
import { EventLogService } from '../../../core/services/event-log.service';
import { 
  InventoryItem, 
  InventoryRequest, 
  StockTransaction, 
  InventorySettings, 
  DEFAULT_INVENTORY_SETTINGS, 
  StockTransactionType, 
  ItemType,
  InventoryRequestStatus
} from '../models/inventory.model';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);

  private readonly itemsCollection = 'inventory_items';
  private readonly requestsCollection = 'inventory_requests';
  private readonly transactionsCollection = 'inventory_transactions';
  private readonly settingsDocPath = 'settings/inventory_settings';

  // ==========================================
  // ITEMS & ASSETS MANAGEMENT
  // ==========================================

  getItems(): Observable<InventoryItem[]> {
    return this.firestoreService.getCollection<InventoryItem>(this.itemsCollection).pipe(
      map(items => items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)))
    );
  }

  getItemById(id: string): Observable<InventoryItem | undefined> {
    return this.firestoreService.getDocument<InventoryItem>(`${this.itemsCollection}/${id}`);
  }

  computeItemStatus(item: Partial<InventoryItem>): InventoryItem['status'] {
    if (item.condition === 'Damaged' || item.condition === 'Needs Repair') {
      return 'Damaged';
    }
    if (item.condition === 'Disposed' || item.condition === 'Written Off') {
      return 'Disposed';
    }
    if (item.itemType === 'immovable') {
      return 'Active';
    }
    const qty = item.quantity ?? 0;
    const minAlert = item.minStockAlert ?? 10;
    if (qty <= 0) return 'Out of Stock';
    if (qty <= minAlert) return 'Low Stock';
    return 'Active';
  }

  async addItem(itemData: Omit<InventoryItem, 'id'>): Promise<string> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Store Officer';
    const now = Date.now();

    const status = this.computeItemStatus(itemData);

    const item: Omit<InventoryItem, 'id'> = {
      ...itemData,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: officerName,
      updatedBy: officerName
    };

    const docId = await this.firestoreService.addDocument(this.itemsCollection, item);

    // If initial stock is greater than 0 for movable item, record initial stock-in transaction
    if (item.itemType === 'movable' && item.quantity > 0) {
      await this.recordStockTransaction({
        transactionNo: this.generateTransactionNo(),
        itemId: docId,
        itemName: item.name,
        itemCode: item.itemCode,
        transactionType: 'IN_PURCHASE',
        quantity: item.quantity,
        previousQty: 0,
        balanceQty: item.quantity,
        referenceNo: 'INITIAL-STOCK',
        notes: 'Initial inventory stock registration',
        performedBy: officerName,
        performedAt: now
      });
    }

    this.eventLogService.logAction(
      'CREATED',
      'inventory',
      `Registered ${item.itemType === 'immovable' ? 'Fixed Asset' : 'Movable Item'} [${item.itemCode}] ${item.name}`
    );

    return docId;
  }

  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Store Officer';
    const now = Date.now();

    const status = this.computeItemStatus(updates);

    const payload = {
      ...updates,
      status,
      updatedAt: now,
      updatedBy: officerName
    };

    await this.firestoreService.updateDocument(this.itemsCollection, id, payload);

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Updated inventory item/asset [${updates.itemCode || id}] ${updates.name || ''}`
    );
  }

  async deleteItem(id: string, name: string): Promise<void> {
    await this.firestoreService.deleteDocument(this.itemsCollection, id);

    this.eventLogService.logAction(
      'DELETED',
      'inventory',
      `Removed inventory item [${id}] ${name}`
    );
  }

  // Quick Stock Adjustment (Stock-in / Purchase, Loss, Damage write-off)
  async adjustStock(
    item: InventoryItem, 
    qtyChange: number, 
    type: StockTransactionType, 
    notes?: string,
    refNo?: string
  ): Promise<void> {
    if (!item.id) return;
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Store Officer';
    const now = Date.now();

    const prevQty = item.quantity || 0;
    let newQty: number;

    if (type.startsWith('IN_')) {
      newQty = prevQty + Math.abs(qtyChange);
    } else {
      newQty = Math.max(0, prevQty - Math.abs(qtyChange));
    }

    const updatedStatus = this.computeItemStatus({
      ...item,
      quantity: newQty
    });

    await this.firestoreService.updateDocument(this.itemsCollection, item.id, {
      quantity: newQty,
      status: updatedStatus,
      updatedAt: now,
      updatedBy: officerName
    });

    await this.recordStockTransaction({
      transactionNo: this.generateTransactionNo(),
      itemId: item.id,
      itemName: item.name,
      itemCode: item.itemCode,
      transactionType: type,
      quantity: Math.abs(qtyChange),
      previousQty: prevQty,
      balanceQty: newQty,
      referenceNo: refNo || '',
      notes: notes || '',
      performedBy: officerName,
      performedAt: now
    });

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Stock adjustment for [${item.itemCode}] ${item.name}: ${prevQty} -> ${newQty} (${type})`
    );
  }

  // ==========================================
  // REQUISITION & RELEASE MANAGEMENT
  // ==========================================

  getRequests(): Observable<InventoryRequest[]> {
    return this.firestoreService.getCollection<InventoryRequest>(this.requestsCollection).pipe(
      map(reqs => reqs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    );
  }

  getRequestById(id: string): Observable<InventoryRequest | undefined> {
    return this.firestoreService.getDocument<InventoryRequest>(`${this.requestsCollection}/${id}`);
  }

  async createRequest(requestData: Omit<InventoryRequest, 'id'>): Promise<string> {
    const user = this.authService.currentUser();
    const now = Date.now();

    const request: Omit<InventoryRequest, 'id'> = {
      ...requestData,
      createdAt: now,
      updatedAt: now
    };

    const docId = await this.firestoreService.addDocument(this.requestsCollection, request);

    this.eventLogService.logAction(
      'CREATED',
      'inventory',
      `Submitted store requisition [${request.requestNo}] with ${request.items.length} items by ${request.requesterName}`
    );

    return docId;
  }

  async approveBySupervisor(requestId: string, req: InventoryRequest, remarks?: string): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Supervisor';
    const now = Date.now();

    const payload: Partial<InventoryRequest> = {
      status: 'Supervisor Approved',
      supervisorApproval: {
        approvedBy: officerName,
        approvedAt: now,
        remarks: remarks || ''
      },
      updatedAt: now
    };

    await this.firestoreService.updateDocument(this.requestsCollection, requestId, payload);

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Supervisor approval granted for store requisition [${req.requestNo}] by ${officerName}`
    );
  }

  async releaseRequest(
    requestId: string,
    req: InventoryRequest,
    releaseLines: { itemId: string; releasedQty: number }[],
    currentItemsMap: Map<string, InventoryItem>,
    remarks?: string,
    receivedBy?: string
  ): Promise<void> {
    const user = this.authService.currentUser();
    const storeManagerName = user?.displayName || user?.email || 'Store Manager';
    const now = Date.now();

    // 1. Process stock deduction for each item
    let totalRequested = 0;
    let totalReleased = 0;

    const updatedReqItems = req.items.map(itemLine => {
      const lineRelease = releaseLines.find(r => r.itemId === itemLine.itemId);
      const qtyToRelease = lineRelease ? Math.max(0, lineRelease.releasedQty) : 0;
      totalRequested += itemLine.requestedQty;
      totalReleased += qtyToRelease;
      return {
        ...itemLine,
        releasedQty: qtyToRelease
      };
    });

    for (const line of updatedReqItems) {
      const releaseQty = line.releasedQty || 0;
      if (releaseQty > 0) {
        const itemObj = currentItemsMap.get(line.itemId);
        if (itemObj) {
          const prevQty = itemObj.quantity || 0;
          const newQty = Math.max(0, prevQty - releaseQty);
          const newStatus = this.computeItemStatus({ ...itemObj, quantity: newQty });

          // Deduct from item in Firestore
          await this.firestoreService.updateDocument(this.itemsCollection, line.itemId, {
            quantity: newQty,
            status: newStatus,
            updatedAt: now,
            updatedBy: storeManagerName
          });

          // Record OUT transaction in ledger
          await this.recordStockTransaction({
            transactionNo: this.generateTransactionNo(),
            itemId: line.itemId,
            itemName: line.itemName,
            itemCode: line.itemCode,
            transactionType: 'OUT_RELEASE',
            quantity: releaseQty,
            previousQty: prevQty,
            balanceQty: newQty,
            referenceNo: req.requestNo,
            notes: `Issued to ${req.requesterName} (${req.division}) - ${remarks || 'Store Requisition'}`,
            performedBy: storeManagerName,
            performedAt: now
          });
        }
      }
    }

    // Determine final requisition status
    let finalStatus: InventoryRequestStatus = 'Released';
    if (totalReleased === 0) {
      finalStatus = 'Rejected';
    } else if (totalReleased < totalRequested) {
      finalStatus = 'Partially Released';
    }

    const payload: Partial<InventoryRequest> = {
      status: finalStatus,
      items: updatedReqItems,
      releaseDetails: {
        releasedBy: storeManagerName,
        releasedAt: now,
        remarks: remarks || '',
        receivedBy: receivedBy || req.requesterName
      },
      updatedAt: now
    };

    await this.firestoreService.updateDocument(this.requestsCollection, requestId, payload);

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Store items released for requisition [${req.requestNo}] (${totalReleased}/${totalRequested} units issued to ${receivedBy || req.requesterName})`
    );
  }

  async rejectRequest(requestId: string, req: InventoryRequest, reason: string): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Store Officer';
    const now = Date.now();

    const payload: Partial<InventoryRequest> = {
      status: 'Rejected',
      rejectionReason: reason,
      updatedAt: now
    };

    await this.firestoreService.updateDocument(this.requestsCollection, requestId, payload);

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Requisition [${req.requestNo}] rejected by ${officerName}. Reason: ${reason}`
    );
  }

  async cancelRequest(requestId: string, req: InventoryRequest): Promise<void> {
    const now = Date.now();
    await this.firestoreService.updateDocument(this.requestsCollection, requestId, {
      status: 'Cancelled',
      updatedAt: now
    });

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Requisition [${req.requestNo}] cancelled by requester`
    );
  }

  // ==========================================
  // STOCK TRANSACTIONS / AUDIT LEDGER
  // ==========================================

  getTransactions(): Observable<StockTransaction[]> {
    return this.firestoreService.getCollection<StockTransaction>(this.transactionsCollection).pipe(
      map(txns => txns.sort((a, b) => (b.performedAt || 0) - (a.performedAt || 0)))
    );
  }

  private async recordStockTransaction(txn: Omit<StockTransaction, 'id'>): Promise<string> {
    return this.firestoreService.addDocument(this.transactionsCollection, txn);
  }

  // ==========================================
  // SETTINGS & CONFIGURATION
  // ==========================================

  getSettings(): Observable<InventorySettings> {
    return this.firestoreService.getDocument<InventorySettings>(this.settingsDocPath).pipe(
      map(s => {
        if (!s) return DEFAULT_INVENTORY_SETTINGS;
        return {
          ...DEFAULT_INVENTORY_SETTINGS,
          ...s
        };
      })
    );
  }

  async updateSettings(settings: Partial<InventorySettings>): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Admin';
    const now = Date.now();

    const payload = {
      ...settings,
      updatedAt: now,
      updatedBy: officerName
    };

    await this.firestoreService.setDocument('settings', 'inventory_settings', payload);

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Updated inventory configuration & approval workflow policies`
    );
  }

  // ==========================================
  // NUMBER & CODE GENERATORS
  // ==========================================

  generateItemCode(type: ItemType, category: string = ''): string {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    if (type === 'immovable') {
      return `AST-${year}-${rand}`;
    }
    const catCode = category ? category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') : 'GEN';
    return `INV-${catCode}-${rand}`;
  }

  generateRequestNo(): string {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `REQ/${year}/${rand}`;
  }

  generateTransactionNo(): string {
    const year = new Date().getFullYear();
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `TXN-${year}-${rand}`;
  }
}
