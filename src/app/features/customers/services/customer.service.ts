import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/services/firestore.service';
import { Observable } from 'rxjs';

export interface Customer {
  id?: string;
  name: string;
  address: string;
  tpno: string;
  division: string;
  nic: string;
  status: 'active' | 'inactive';
  dynamic_data?: Record<string, any>;
  createdAt: number;
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
    return this.firestoreService.updateDocument(this.collectionName, id, customer);
  }

  async deleteCustomer(id: string): Promise<void> {
    return this.firestoreService.deleteDocument(this.collectionName, id);
  }

  async isCustomerLinked(customerId: string): Promise<boolean> {
    // Check if customer is referenced in 'land' or 'work_plans' or 'letters' or 'hr'
    // To do this, we query these collections for docs where customerId === customerId
    try {
      const landDocs = await this.firestoreService.queryDocuments('land', 'customerId', '==', customerId);
      if (landDocs.length > 0) return true;
      
      const workPlanDocs = await this.firestoreService.queryDocuments('work_plans', 'customerId', '==', customerId);
      if (workPlanDocs.length > 0) return true;
      
      const letterDocs = await this.firestoreService.queryDocuments('letters', 'customerId', '==', customerId);
      if (letterDocs.length > 0) return true;

      return false;
    } catch (e) {
      console.error('Error checking if customer is linked', e);
      // Fail safe: assume it is linked so we don't accidentally delete
      return true;
    }
  }
}
