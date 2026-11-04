export type ItemType = 'movable' | 'immovable';

export type ItemCondition = 'Good' | 'Fair' | 'Needs Repair' | 'Damaged' | 'Written Off' | 'Disposed';

export type ItemStatus = 'Active' | 'Low Stock' | 'Out of Stock' | 'Damaged' | 'Disposed';

export interface InventoryItem {
  id?: string;
  itemCode: string;          // e.g. INV-M-1001 or AST-2026-0042
  name: string;
  description?: string;
  category: string;
  itemType: ItemType;        // 'movable' (consumable/releasable) vs 'immovable' (fixed asset)
  unit: string;              // 'Pcs', 'Box', 'Ream', 'Pack', 'Roll', 'Kg', 'Ltr', 'Set', etc.
  quantity: number;          // Current stock on hand (0 for purely tracked fixed assets, or count)
  minStockAlert: number;     // Low stock warning threshold
  unitCost?: number;
  location: string;          // Store shelf/rack, or office room/hall
  division?: string;         // Assigned DS Division or Section
  
  // Immovable / Fixed Asset specific fields:
  assetTag?: string;         // Unique Asset Tag Barcode / Number
  serialNumber?: string;     // Manufacturer serial
  custodianName?: string;    // Officer / custodian responsible
  custodianId?: string;
  condition?: ItemCondition;
  acquisitionDate?: string;
  
  status: ItemStatus;
  remarks?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy?: string;
}

export type InventoryRequestUrgency = 'Low' | 'Normal' | 'High' | 'Urgent';

export type InventoryRequestStatus = 
  | 'Pending' 
  | 'Supervisor Approved' 
  | 'Released' 
  | 'Partially Released' 
  | 'Rejected' 
  | 'Cancelled';

export interface InventoryRequestItem {
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  requestedQty: number;
  releasedQty?: number;
  availableStockAtRequest?: number;
  notes?: string;
}

export interface InventoryRequest {
  id?: string;
  requestNo: string;         // e.g. REQ/2026/0104
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  division: string;
  requestDate: string;       // YYYY-MM-DD
  urgency: InventoryRequestUrgency;
  status: InventoryRequestStatus;
  purpose: string;
  items: InventoryRequestItem[];
  
  // Supervisor approval info (if two-step workflow is enabled)
  supervisorApproval?: {
    approvedBy: string;
    approvedAt: number;
    remarks?: string;
  };
  
  // Store Manager release details
  releaseDetails?: {
    releasedBy: string;
    releasedAt: number;
    remarks?: string;
    receivedBy?: string;     // Acknowledging recipient officer
  };
  
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
}

export type StockTransactionType = 
  | 'IN_PURCHASE' 
  | 'IN_ADJUSTMENT' 
  | 'OUT_RELEASE' 
  | 'OUT_DAMAGE' 
  | 'OUT_WRITE_OFF';

export interface StockTransaction {
  id?: string;
  transactionNo: string;     // e.g. TXN-2026-00452
  itemId: string;
  itemName: string;
  itemCode: string;
  transactionType: StockTransactionType;
  quantity: number;          // Absolute quantity of transaction
  previousQty: number;
  balanceQty: number;
  referenceNo?: string;      // Requisition No (REQ/...) or GRN/Invoice No
  notes?: string;
  performedBy: string;
  performedAt: number;
}

export type InventoryApprovalWorkflow = 'direct_store_manager' | 'supervisor_then_store_manager';

export interface InventorySettings {
  id?: string;
  approvalWorkflow: InventoryApprovalWorkflow;
  allowZeroStockRequests: boolean;
  enableLowStockAlerts: boolean;
  defaultLowStockThreshold: number;
  categories: string[];
  locations: string[];
  units: string[];
  requestPrefix: string;
  movablePrefix: string;
  assetPrefix: string;
  updatedAt?: number;
  updatedBy?: string;
}

export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  approvalWorkflow: 'direct_store_manager',
  allowZeroStockRequests: false,
  enableLowStockAlerts: true,
  defaultLowStockThreshold: 10,
  categories: [
    'Office Stationery & Supplies',
    'IT & Computer Hardware',
    'Office Furniture & Fixtures',
    'Machinery & Technical Equipment',
    'Cleaning & Sanitation Supplies',
    'Electrical & Utilities',
    'Printed Books & Registers',
    'Building & Infrastructure'
  ],
  locations: [
    'Central Store Room - Ground Floor',
    'Stationery Cabinet A',
    'Stationery Cabinet B',
    'IT Storage & Server Room',
    'Main Administrative Hall',
    'Divisional Secretariat Office',
    'Accounts & Finance Branch',
    'Land Registry & Deeds Branch',
    'Planning & Development Division',
    'Auditorium / Conference Room'
  ],
  units: [
    'Pcs',
    'Box',
    'Ream',
    'Pack',
    'Roll',
    'Kg',
    'Ltr',
    'Set',
    'Pair',
    'Bundle',
    'Carton'
  ],
  requestPrefix: 'REQ',
  movablePrefix: 'INV-M',
  assetPrefix: 'AST'
};
