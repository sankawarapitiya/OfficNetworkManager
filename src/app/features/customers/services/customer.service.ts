import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/services/firestore.service';
import { Observable } from 'rxjs';

export interface Customer {
  id?: string;
  name: string;
  address: string;
  tpno: string;
  division: string;
  gnDivision?: string;
  email?: string;
  nic: string;
  status: 'active' | 'inactive';
  dynamic_data?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private firestoreService = inject(FirestoreService);
  private readonly collectionName = 'customers';

  getCustomers(): Observable<Customer[]> {
    return this.firestoreService.getCollection<Customer>(this.collectionName);
  }

  getCustomer(id: string): Observable<Customer | undefined> {
    return this.firestoreService.getDocument<Customer>(`${this.collectionName}/${id}`);
  }

  async addCustomer(customer: Omit<Customer, 'id'>): Promise<string> {
    return this.firestoreService.addDocument(this.collectionName, customer);
  }

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<void> {
    return this.firestoreService.updateDocument(this.collectionName, id, {
      ...customer,
      updatedAt: Date.now()
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    return this.firestoreService.deleteDocument(this.collectionName, id);
  }

  async isCustomerLinked(customerId: string, customerNic?: string): Promise<boolean> {
    // Check if customer is referenced in 'land_jobs' (the primary land tasks collection)
    try {
      if (customerId) {
        const landJobs = await this.firestoreService.queryDocuments('land_jobs', 'customerId', '==', customerId);
        if (landJobs && landJobs.length > 0) return true;

        const legacyRecords = await this.firestoreService.queryDocuments('land_records', 'ownerCustomerId', '==', customerId);
        if (legacyRecords && legacyRecords.length > 0) return true;
      }

      if (customerNic) {
        const jobsByNic = await this.firestoreService.queryDocuments('land_jobs', 'customerNic', '==', customerNic.trim());
        if (jobsByNic && jobsByNic.length > 0) return true;
      }

      return false;
    } catch (e) {
      console.error('Error checking if customer is linked', e);
      // Fail safe: assume it is linked so we don't accidentally delete
      return true;
    }
  }
}
