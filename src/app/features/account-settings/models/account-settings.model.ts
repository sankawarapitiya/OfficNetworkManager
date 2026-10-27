export interface VoucherTypeConfig {
  id: string;
  name: string;            // e.g. 'Payment Voucher', 'Receipt Voucher'
  code: string;            // e.g. 'PV', 'RV'
  prefix: string;          // Voucher No prefix, e.g. 'PV', 'RV', 'PCV', 'JV'
  description?: string;
  icon?: string;           // Material icon name, e.g. 'payments', 'receipt'
  badgeColor?: string;     // Color theme, e.g. 'blue', 'green', 'amber', 'purple', 'teal'
  isActive: boolean;
  isDefault?: boolean;
  order?: number;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;            // e.g. 'Cash', 'Cheque', 'Bank Transfer', 'Online / Card'
  code?: string;           // e.g. 'CASH', 'CHQ', 'BT', 'CARD'
  description?: string;
  icon?: string;           // Material icon name, e.g. 'payments', 'account_balance'
  requiresReference: boolean; // True if cheque / transfer reference number is required/prompted
  requiresBank: boolean;      // True if bank name / account particulars are prompted
  isActive: boolean;
  isDefault?: boolean;
  order?: number;
}

export interface AccountSettings {
  voucherTypes: VoucherTypeConfig[];
  paymentMethods: PaymentMethodConfig[];
  updatedAt?: number;
  updatedBy?: string;
}

export const DEFAULT_VOUCHER_TYPES: VoucherTypeConfig[] = [
  {
    id: 'vt_pv',
    name: 'Payment Voucher',
    code: 'PV',
    prefix: 'PV',
    description: 'Official payment voucher for external vendors, contractors, and beneficiaries',
    icon: 'payments',
    badgeColor: 'blue',
    isActive: true,
    isDefault: true,
    order: 1
  },
  {
    id: 'vt_rv',
    name: 'Receipt Voucher',
    code: 'RV',
    prefix: 'RV',
    description: 'Inward cash/cheque collection and revenue receipts voucher',
    icon: 'receipt',
    badgeColor: 'green',
    isActive: true,
    isDefault: false,
    order: 2
  },
  {
    id: 'vt_pcv',
    name: 'Petty Cash',
    code: 'PCV',
    prefix: 'PCV',
    description: 'Disbursements for minor day-to-day office and transport expenses',
    icon: 'account_balance_wallet',
    badgeColor: 'amber',
    isActive: true,
    isDefault: false,
    order: 3
  },
  {
    id: 'vt_jv',
    name: 'Journal Voucher',
    code: 'JV',
    prefix: 'JV',
    description: 'Internal fund transfers, account rectifications, and book adjustments',
    icon: 'description',
    badgeColor: 'purple',
    isActive: true,
    isDefault: false,
    order: 4
  }
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'pm_cash',
    name: 'Cash',
    code: 'CASH',
    description: 'Direct physical cash currency disbursement or collection',
    icon: 'payments',
    requiresReference: false,
    requiresBank: false,
    isActive: true,
    isDefault: true,
    order: 1
  },
  {
    id: 'pm_cheque',
    name: 'Cheque',
    code: 'CHQ',
    description: 'Bank cheque issuance requiring cheque number and settlement bank',
    icon: 'edit_document',
    requiresReference: true,
    requiresBank: true,
    isActive: true,
    isDefault: false,
    order: 2
  },
  {
    id: 'pm_transfer',
    name: 'Bank Transfer',
    code: 'BT',
    description: 'Direct electronic funds transfer (SLIPS, CEFT, RTGS) to recipient account',
    icon: 'account_balance',
    requiresReference: true,
    requiresBank: true,
    isActive: true,
    isDefault: false,
    order: 3
  },
  {
    id: 'pm_online',
    name: 'Online / Card',
    code: 'CARD',
    description: 'Corporate debit/credit card or government digital payment portal',
    icon: 'credit_card',
    requiresReference: true,
    requiresBank: false,
    isActive: true,
    isDefault: false,
    order: 4
  }
];

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  voucherTypes: DEFAULT_VOUCHER_TYPES,
  paymentMethods: DEFAULT_PAYMENT_METHODS
};
