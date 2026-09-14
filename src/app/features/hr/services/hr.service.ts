import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/services/firestore.service';
import { Observable } from 'rxjs';

export interface Employee {
  id?: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  locationId: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  dynamic_data?: Record<string, any>;
  joinedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class HrService {
  private firestoreService = inject(FirestoreService);
  private readonly collectionName = 'employees';

  getEmployees(): Observable<Employee[]> {
    return this.firestoreService.getCollection<Employee>(this.collectionName);
  }

  async addEmployee(employee: Omit<Employee, 'id'>): Promise<string> {
    return this.firestoreService.addDocument(this.collectionName, employee);
  }
}
