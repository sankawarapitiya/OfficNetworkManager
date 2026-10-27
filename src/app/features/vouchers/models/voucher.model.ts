export type VoucherType = 'Payment Voucher' | 'Receipt Voucher' | 'Petty Cash' | 'Journal Voucher' | (string & {});

export type VoucherStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Paid' | 'Cancelled';

export type PaymentMethod = 'Cash' | 'Cheque' | 'Bank Transfer' | 'Online / Card' | (string & {});

export interface VoucherPaymentSplit {
  id?: string;
  paymentMethod: PaymentMethod;
  amount: number;
  referenceNo?: string; // Cheque No, Transaction Ref, etc.
  bankName?: string;
  notes?: string;
  payees?: VoucherPayeeSplit[]; // Payees allocated under this payment method
}

export interface VoucherPayeeSplit {
  id?: string;
  subVoucherNo?: string; // Auto-generated sub-voucher number, e.g. PV/2026/1024-1
  clientId?: string;    // ID in account_clients if linked
  clientType?: string;  // Individual, Business / Vendor, etc.
  payeeName: string;    // Client or payee legal name
  payeeNic?: string;    // NIC or BRN
  payeePhone?: string;  // Contact phone
  bankName?: string;    // Bank name
  accountNumber?: string; // Account number
  amount: number;       // Allocated disbursement / payment amount
  notes?: string;       // Allocation remark / invoice ref
  paymentMethod?: PaymentMethod; // The payment method this payee belongs to
  referenceNo?: string; // Payment reference or cheque number
}

export interface VoucherItem {
  id: string;
  description: string;
  accountCode?: string;
  amount: number;
}

export interface Voucher {
  id?: string;
  voucherNo: string; // e.g. VCH/2026/0001
  type: VoucherType;
  date: string; // YYYY-MM-DD
  clientId?: string; // Account Client ID (primary/first)
  clientType?: string; // Individual, Business / Vendor, etc.
  customerId?: string; // Kept for backward compatibility
  payeeName: string; // Client / Payee or Vendor name (or summary if multiple)
  payeeNic?: string;
  payeePhone?: string;
  department?: string;
  division?: string;
  category?: string;
  description: string;
  amount: number; // Total amount (sum of payments = sum of payees)
  paymentMethod: PaymentMethod | 'Multiple';
  referenceNo?: string; // Cheque number or bank transaction ref
  bankName?: string;
  status: VoucherStatus;

  // Multi-Payment and Multi-Payee Breakdown
  payments?: VoucherPaymentSplit[];
  payees?: VoucherPayeeSplit[];

  // Customer Task Linkage
  taskId?: string;
  taskType?: 'work_plan' | 'land_job';
  taskTitle?: string;
  taskRef?: string;

  items?: VoucherItem[];
  approvedBy?: string;
  approvedAt?: number;
  paidAt?: number;
  remarks?: string;
  createdAt: number;
  createdBy: string;
  createdById?: string;
  updatedAt?: number;
  updatedBy?: string;
}
