export type AccountClientType = 
  | 'Individual' 
  | 'Business / Vendor' 
  | 'Government Agency' 
  | 'Employee' 
  | 'Financial Institution' 
  | 'Other';

export type AccountClientStatus = 'active' | 'inactive';

export interface AccountClient {
  id?: string;
  name: string;               // Client / Payee / Beneficiary Legal Name
  clientType: AccountClientType;
  nicOrBrn?: string;          // NIC for individuals or BRN for business entities
  phone?: string;             // Mobile or office telephone
  email?: string;             // Contact email
  address?: string;           // Physical / Postal address
  division?: string;          // Administrative division
  bankName?: string;          // Preferred bank for disbursements
  accountNumber?: string;     // Bank account number
  branch?: string;            // Bank branch name or code
  category?: string;          // Supplier, Contractor, Grantee, Staff, Service Provider, etc.
  status: AccountClientStatus;
  notes?: string;             // Remarks / audit notes
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
}
