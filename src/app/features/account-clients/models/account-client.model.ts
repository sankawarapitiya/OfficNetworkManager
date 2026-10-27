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

/**
 * Checks if a single payee descriptor matches an AccountClient.
 */
function isSinglePayeeLinked(
  payee: { clientId?: string; customerId?: string; payeeNic?: string; payeeName?: string; payeePhone?: string } | null | undefined,
  client: AccountClient | null | undefined
): boolean {
  if (!payee || !client) return false;

  // 1. Direct ID match
  if (client.id) {
    if (payee.clientId && payee.clientId.trim() === client.id.trim()) return true;
    if (payee.customerId && payee.customerId.trim() === client.id.trim()) return true;
  }

  // 2. Normalized NIC / BRN match
  if (client.nicOrBrn && payee.payeeNic) {
    const cleanClientNic = client.nicOrBrn.replace(/[\s-]/g, '').toLowerCase();
    const cleanPayeeNic = payee.payeeNic.replace(/[\s-]/g, '').toLowerCase();
    if (cleanClientNic && cleanClientNic === cleanPayeeNic) return true;
  }

  // 3. Exact Payee Name match
  if (client.name && payee.payeeName) {
    const cleanClientName = client.name.trim().toLowerCase();
    const cleanPayeeName = payee.payeeName.trim().toLowerCase();
    if (cleanClientName && cleanClientName === cleanPayeeName) return true;
  }

  // 4. Normalized Phone match
  if (client.phone && payee.payeePhone) {
    const cleanCPhone = client.phone.replace(/[\s\-\+]/g, '').replace(/^94/, '0');
    const cleanVPhone = payee.payeePhone.replace(/[\s\-\+]/g, '').replace(/^94/, '0');
    if (cleanCPhone.length >= 9 && cleanCPhone === cleanVPhone) return true;
  }

  return false;
}

/**
 * Robustly checks if a Voucher record is linked or matches an AccountClient.
 * Checks both the multi-payee list (payees[]), nested payments[].payees[], and top-level voucher fields.
 */
export function isVoucherLinkedToClient(
  voucher: { 
    clientId?: string; 
    customerId?: string; 
    payeeNic?: string; 
    payeeName?: string; 
    payeePhone?: string;
    payees?: Array<{ clientId?: string; customerId?: string; payeeNic?: string; payeeName?: string; payeePhone?: string }>;
    payments?: Array<{ payees?: Array<{ clientId?: string; customerId?: string; payeeNic?: string; payeeName?: string; payeePhone?: string }> }>;
  } | null | undefined,
  client: AccountClient | null | undefined
): boolean {
  if (!voucher || !client) return false;

  // 1. If voucher has multi-payee splits, check if client is one of them
  if (voucher.payees && Array.isArray(voucher.payees) && voucher.payees.length > 0) {
    if (voucher.payees.some(p => isSinglePayeeLinked(p, client))) {
      return true;
    }
  }

  // 2. If voucher has nested payments[].payees[], check if client is in any
  if (voucher.payments && Array.isArray(voucher.payments)) {
    for (const pm of voucher.payments) {
      if (pm.payees && Array.isArray(pm.payees) && pm.payees.some(p => isSinglePayeeLinked(p, client))) {
        return true;
      }
    }
  }

  // 3. Check root-level payee fields
  return isSinglePayeeLinked(voucher, client);
}

export interface ClientPayeeAllocation {
  subVoucherNo?: string;
  payeeName: string;
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
}

/**
 * Extracts all payee allocations belonging to this client from a voucher.
 */
export function getClientAllocationsFromVoucher(
  voucher: any,
  client: AccountClient | null | undefined
): ClientPayeeAllocation[] {
  if (!voucher || !client) return [];

  const results: ClientPayeeAllocation[] = [];

  // Check nested payments[].payees[]
  if (voucher.payments && Array.isArray(voucher.payments)) {
    let globalSeq = 1;
    for (const pm of voucher.payments) {
      if (pm.payees && Array.isArray(pm.payees)) {
        for (const p of pm.payees) {
          if (isSinglePayeeLinked(p, client)) {
            results.push({
              subVoucherNo: p.subVoucherNo || (voucher.voucherNo ? `${voucher.voucherNo}-${globalSeq}` : ''),
              payeeName: p.payeeName,
              amount: Number(p.amount) || 0,
              paymentMethod: p.paymentMethod || pm.paymentMethod,
              referenceNo: p.referenceNo || pm.referenceNo,
              notes: p.notes
            });
          }
          globalSeq++;
        }
      }
    }
  }

  // If none found in payments, check flat payees[]
  if (results.length === 0 && voucher.payees && Array.isArray(voucher.payees)) {
    voucher.payees.forEach((p: any, idx: number) => {
      if (isSinglePayeeLinked(p, client)) {
        results.push({
          subVoucherNo: p.subVoucherNo || (voucher.voucherNo ? `${voucher.voucherNo}-${idx + 1}` : ''),
          payeeName: p.payeeName,
          amount: Number(p.amount) || 0,
          paymentMethod: p.paymentMethod || voucher.paymentMethod,
          referenceNo: p.referenceNo || voucher.referenceNo,
          notes: p.notes
        });
      }
    });
  }

  // If still none found, but root level matches
  if (results.length === 0 && isSinglePayeeLinked(voucher, client)) {
    results.push({
      subVoucherNo: voucher.voucherNo || '',
      payeeName: voucher.payeeName || client.name,
      amount: Number(voucher.amount) || 0,
      paymentMethod: voucher.paymentMethod,
      referenceNo: voucher.referenceNo,
      notes: voucher.description
    });
  }

  return results;
}

/**
 * Calculates the specific amount allocated to a client within a voucher.
 * If the voucher has multiple payees, returns the sum of shares for this client.
 * If single payee, returns the voucher amount.
 */
export function getClientAllocatedAmount(
  voucher: any,
  client: AccountClient | null | undefined
): number {
  if (!voucher || !client) return 0;

  const allocations = getClientAllocationsFromVoucher(voucher, client);
  if (allocations.length > 0) {
    return allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  }

  return 0;
}
