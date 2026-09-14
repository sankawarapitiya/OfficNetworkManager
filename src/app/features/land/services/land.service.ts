import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/services/firestore.service';
import { Observable } from 'rxjs';

export interface LandRecord {
  id?: string;
  ownerCustomerId: string;
  deedNumber: string;
  division: string;
  sizeSqm: number;
  dynamic_data?: Record<string, any>;
}

export interface LandIssue {
  id?: string;
  landId: string;
  customerId: string;
  issueTypeId: string;
  division: string;
  address: string;
  uploaded_documents: Record<string, string>; // Maps document name to storage URL
  job_status: 'Open' | 'In Progress' | 'Resolved';
  recommendation?: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class LandService {
  private firestoreService = inject(FirestoreService);

  // -- Land Records --
  getLandRecords(): Observable<LandRecord[]> {
    return this.firestoreService.getCollection<LandRecord>('land_records');
  }

  async addLandRecord(record: Omit<LandRecord, 'id'>): Promise<string> {
    return this.firestoreService.addDocument('land_records', record);
  }

  // -- Land Issues --
  getLandIssues(): Observable<LandIssue[]> {
    return this.firestoreService.getCollection<LandIssue>('land_issues');
  }

  async addLandIssue(issue: Omit<LandIssue, 'id'>): Promise<string> {
    return this.firestoreService.addDocument('land_issues', issue);
  }

  async updateIssueStatus(id: string, status: 'Open' | 'In Progress' | 'Resolved'): Promise<void> {
    return this.firestoreService.updateDocument('land_issues', id, { job_status: status });
  }
}
