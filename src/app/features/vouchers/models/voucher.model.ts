export type VoucherType = 'Payment Voucher' | 'Receipt Voucher' | 'Petty Cash' | 'Journal Voucher';

export type VoucherStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Paid' | 'Cancelled';

export type PaymentMethod = 'Cash' | 'Cheque' | 'Bank Transfer' | 'Online / Card';

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
  clientId?: string; // Account Client ID
  clientType?: string; // Individual, Business / Vendor, etc.
  customerId?: string; // Kept for backward compatibility
  payeeName: string; // Client / Payee or Vendor name
  payeeNic?: string;
  payeePhone?: string;
  department?: string;
  division?: string;
  category?: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string; // Cheque number or bank transaction ref
  bankName?: string;
  status: VoucherStatus;

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
