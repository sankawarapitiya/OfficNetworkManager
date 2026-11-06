import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AuthService } from '../../../auth/auth.service';
import { EventLogService } from '../../../core/services/event-log.service';
import { 
  InventoryItem, 
  InventoryBatch,
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

    // If movable item with stock > 0, generate initial FIFO batch
    let initialBatches: InventoryBatch[] = [];
    if (itemData.itemType === 'movable' && (itemData.quantity || 0) > 0) {
      const initCost = itemData.unitCost || 0;
      const initialBatch: InventoryBatch = {
        id: `BATCH-${now}-${Math.random().toString(36).substring(2, 7)}`,
        batchNo: `BATCH-${new Date(now).getFullYear()}-001`,
        receivedDate: new Date(now).toISOString().split('T')[0],
        receivedAt: now,
        initialQty: itemData.quantity,
        remainingQty: itemData.quantity,
        unitCost: initCost,
        referenceNo: 'INITIAL-STOCK',
        notes: 'Initial inventory registration'
      };
      initialBatches = [initialBatch];
    }

    const item: Omit<InventoryItem, 'id'> = {
      ...itemData,
      batches: initialBatches.length > 0 ? initialBatches : (itemData.batches || []),
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: officerName,
      updatedBy: officerName
    };

    const docId = await this.firestoreService.addDocument(this.itemsCollection, item);

    // If initial stock is greater than 0 for movable item, record initial stock-in transaction
    if (item.itemType === 'movable' && item.quantity > 0) {
      const initialCost = item.unitCost || 0;
      await this.recordStockTransaction({
        transactionNo: this.generateTransactionNo(),
        itemId: docId,
        itemName: item.name,
        itemCode: item.itemCode,
        transactionType: 'IN_PURCHASE',
        quantity: item.quantity,
        previousQty: 0,
        balanceQty: item.quantity,
        unitCost: initialCost,
        totalCost: item.quantity * initialCost,
        batchDetails: `Initial Batch BATCH-${new Date(now).getFullYear()}-001 (${item.quantity} @ LKR ${initialCost.toFixed(2)})`,
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

  async addItemsBatch(itemsList: Omit<InventoryItem, 'id'>[]): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of itemsList) {
      try {
        await this.addItem(item);
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`Item "${item.name}": ${err?.message || 'Failed to save'}`);
      }
    }

    return { success, failed, errors };
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

  // Quick Stock Adjustment (Stock-in / Purchase, Loss, Damage write-off) with FIFO & New Item Price
  async adjustStock(
    item: InventoryItem, 
    qtyChange: number, 
    type: StockTransactionType, 
    notes?: string,
    refNo?: string,
    unitCost?: number
  ): Promise<void> {
    if (!item.id) return;
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Store Officer';
    const now = Date.now();

    const prevQty = item.quantity || 0;
    const absQty = Math.abs(qtyChange);
    let newQty: number;
    let newUnitCost = item.unitCost;
    let txnUnitCost = 0;
    let txnTotalCost = 0;
    let batchDetails = '';

    // Initialize or clone batches queue
    let batches: InventoryBatch[] = (item.batches || []).map(b => ({ ...b }));

    // If existing item has stock > 0 but no batches array yet (legacy items), create legacy opening batch
    if (batches.length === 0 && prevQty > 0) {
      batches = [{
        id: `BATCH-LEGACY-${item.createdAt || now}`,
        batchNo: 'BATCH-LEGACY',
        receivedDate: new Date(item.createdAt || now).toISOString().split('T')[0],
        receivedAt: item.createdAt || now,
        initialQty: prevQty,
        remainingQty: prevQty,
        unitCost: item.unitCost || 0,
        referenceNo: 'LEGACY-STOCK',
        notes: 'Legacy stock opening balance'
      }];
    }

    if (type.startsWith('IN_')) {
      newQty = prevQty + absQty;
      // New incoming unit price (defaults to entered unitCost or existing item.unitCost)
      const incomingPrice = unitCost !== undefined && unitCost !== null && !isNaN(unitCost) 
        ? Math.max(0, unitCost) 
        : (item.unitCost || 0);

      newUnitCost = incomingPrice;
      txnUnitCost = incomingPrice;
      txnTotalCost = absQty * incomingPrice;

      // Create new FIFO batch
      const batchCount = batches.length + 1;
      const cleanRef = refNo?.trim();
      const generatedBatchNo = cleanRef 
        ? cleanRef 
        : `BATCH-${new Date(now).getFullYear()}-${String(batchCount).padStart(3, '0')}`;

      const newBatch: InventoryBatch = {
        id: `BATCH-${now}-${Math.random().toString(36).substring(2, 7)}`,
        batchNo: generatedBatchNo,
        receivedDate: new Date(now).toISOString().split('T')[0],
        receivedAt: now,
        initialQty: absQty,
        remainingQty: absQty,
        unitCost: incomingPrice,
        referenceNo: cleanRef || '',
        notes: notes || ''
      };

      batches.push(newBatch);
      batchDetails = `New FIFO Batch: ${newBatch.batchNo} (+${absQty} @ LKR ${incomingPrice.toFixed(2)})`;
    } else {
      // Outward adjustment (damage / write-off) - consume from FIFO queue (oldest first)
      newQty = Math.max(0, prevQty - absQty);
      const fifo = this.consumeBatchesFIFO(batches, absQty, item.unitCost || 0);
      batches = fifo.updatedBatches;
      txnTotalCost = fifo.totalCost;
      txnUnitCost = fifo.effectiveUnitCost;
      batchDetails = fifo.summaryText ? `FIFO Deducted: ${fifo.summaryText}` : 'FIFO Deducted from stock';
    }

    const updatedStatus = this.computeItemStatus({
      ...item,
      quantity: newQty
    });

    await this.firestoreService.updateDocument(this.itemsCollection, item.id, {
      quantity: newQty,
      unitCost: newUnitCost,
      batches: batches,
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
      quantity: absQty,
      previousQty: prevQty,
      balanceQty: newQty,
      unitCost: txnUnitCost,
      totalCost: txnTotalCost,
      batchDetails: batchDetails,
      referenceNo: refNo || '',
      notes: notes || '',
      performedBy: officerName,
      performedAt: now
    });

    this.eventLogService.logAction(
      'UPDATED',
      'inventory',
      `Stock adjustment for [${item.itemCode}] ${item.name}: ${prevQty} -> ${newQty} (${type}, Unit Price: LKR ${txnUnitCost.toFixed(2)})`
    );
  }

  /**
   * Helper to consume quantities from inventory batches using First-In, First-Out (FIFO) queue.
   */
  consumeBatchesFIFO(
    batches: InventoryBatch[] = [],
    qtyToConsume: number,
    fallbackUnitCost: number = 0
  ): {
    updatedBatches: InventoryBatch[];
    consumedDetails: { batchNo: string; qty: number; unitCost: number; cost: number }[];
    totalCost: number;
    effectiveUnitCost: number;
    summaryText: string;
  } {
    let remainingToConsume = Math.abs(qtyToConsume);
    let totalCost = 0;
    const consumedDetails: { batchNo: string; qty: number; unitCost: number; cost: number }[] = [];

    // Clone batches and sort by receivedAt ascending (oldest first = FIFO)
    const sortedBatches: InventoryBatch[] = (batches || []).map(b => ({ ...b })).sort((a, b) => (a.receivedAt || 0) - (b.receivedAt || 0));

    for (const b of sortedBatches) {
      if (remainingToConsume <= 0) break;
      if (b.remainingQty > 0) {
        const take = Math.min(b.remainingQty, remainingToConsume);
        b.remainingQty -= take;
        remainingToConsume -= take;
        const lineCost = take * (b.unitCost || 0);
        totalCost += lineCost;
        consumedDetails.push({
          batchNo: b.batchNo,
          qty: take,
          unitCost: b.unitCost || 0,
          cost: lineCost
        });
      }
    }

    // If remainingToConsume > 0 (e.g. unbatched legacy stock), deduct with fallback unit cost
    if (remainingToConsume > 0) {
      const lineCost = remainingToConsume * (fallbackUnitCost || 0);
      totalCost += lineCost;
      consumedDetails.push({
        batchNo: 'LEGACY-STOCK',
        qty: remainingToConsume,
        unitCost: fallbackUnitCost || 0,
        cost: lineCost
      });
    }

    const effectiveUnitCost = qtyToConsume > 0 ? (totalCost / qtyToConsume) : fallbackUnitCost;
    const summaryText = consumedDetails
      .map(cd => `${cd.qty} from ${cd.batchNo} @ LKR ${cd.unitCost.toFixed(2)}`)
      .join('; ');

    return {
      updatedBatches: sortedBatches,
      consumedDetails,
      totalCost,
      effectiveUnitCost,
      summaryText
    };
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

          // Deduct from FIFO batches
          let batches: InventoryBatch[] = (itemObj.batches || []).map(b => ({ ...b }));
          if (batches.length === 0 && prevQty > 0) {
            batches = [{
              id: `BATCH-LEGACY-${itemObj.createdAt || now}`,
              batchNo: 'BATCH-LEGACY',
              receivedDate: new Date(itemObj.createdAt || now).toISOString().split('T')[0],
              receivedAt: itemObj.createdAt || now,
              initialQty: prevQty,
              remainingQty: prevQty,
              unitCost: itemObj.unitCost || 0,
              referenceNo: 'LEGACY-STOCK',
              notes: 'Legacy stock opening balance'
            }];
          }

          const fifo = this.consumeBatchesFIFO(batches, releaseQty, itemObj.unitCost || 0);

          // Deduct from item in Firestore
          await this.firestoreService.updateDocument(this.itemsCollection, line.itemId, {
            quantity: newQty,
            batches: fifo.updatedBatches,
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
            unitCost: fifo.effectiveUnitCost,
            totalCost: fifo.totalCost,
            batchDetails: fifo.summaryText ? `FIFO Released: ${fifo.summaryText}` : 'FIFO Released from stock',
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
