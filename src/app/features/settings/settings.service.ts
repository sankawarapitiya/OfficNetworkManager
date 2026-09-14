import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../core/services/firestore.service';
import { Observable } from 'rxjs';

export interface DynamicField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date';
  required: boolean;
}

export interface DynamicSchema {
  id?: string;
  schema_id: string;
  target_module: string;
  fields: DynamicField[];
}

export interface IssueType {
  id?: string;
  name: string;
  required_documents: string[];
}

export interface Division {
  id?: string;
  name: string;
}

export interface Department {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  leadName?: string;
  verificationQuota?: number; // Department Specific Verification Quota stored in database
  createdAt?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private firestoreService = inject(FirestoreService);

  // -- Departments --
  getDepartments(): Observable<Department[]> {
    return this.firestoreService.getCollection<Department>('settings_departments');
  }

  async addDepartment(department: Department): Promise<void> {
    const data = {
      ...department,
      createdAt: department.createdAt || Date.now()
    };
    if (department.id) {
      await this.firestoreService.updateDocument('settings_departments', department.id, data);
    } else {
      await this.firestoreService.addDocument('settings_departments', data);
    }
  }

  async updateDepartment(id: string, department: Partial<Department>): Promise<void> {
    await this.firestoreService.updateDocument('settings_departments', id, department);
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.firestoreService.deleteDocument('settings_departments', id);
  }

  getDefaultSeedDepartments(): Department[] {
    return [
      {
        id: 'dept_surv',
        name: 'Survey & Cadastral Mapping',
        code: 'SURV',
        description: 'Cadastral boundary surveys, geodetic positioning & spatial GIS data',
        leadName: 'Chief Surveyor',
        verificationQuota: 2,
        createdAt: Date.now()
      },
      {
        id: 'dept_land',
        name: 'Land Administration & Titles',
        code: 'LAND',
        description: 'Land registry deeds, ownership transfers & title certificate validation',
        leadName: 'Registrar of Titles',
        verificationQuota: 2,
        createdAt: Date.now()
      },
      {
        id: 'dept_plan',
        name: 'Planning & Urban Development',
        code: 'PLAN',
        description: 'Zoning clearance, subdivision approvals & municipal master planning',
        leadName: 'Director of Planning',
        verificationQuota: 1,
        createdAt: Date.now()
      },
      {
        id: 'dept_legal',
        name: 'Legal & Regulatory Affairs',
        code: 'LEGAL',
        description: 'Dispute arbitration, compliance reviews & statutory conveyancing',
        leadName: 'Senior Legal Counsel',
        verificationQuota: 2,
        createdAt: Date.now()
      },
      {
        id: 'dept_fin',
        name: 'Finance & Asset Management',
        code: 'FIN',
        description: 'Budget appropriations, revenue collections & capital expenditures',
        leadName: 'Financial Controller',
        verificationQuota: 2,
        createdAt: Date.now()
      },
      {
        id: 'dept_cs',
        name: 'Public Desk & Customer Care',
        code: 'CS',
        description: 'Citizen inquiry intake, official filings & correspondence delivery',
        leadName: 'Public Relations Officer',
        verificationQuota: 1,
        createdAt: Date.now()
      }
    ];
  }

  async seedDefaultDepartmentsIfEmpty(currentCount: number): Promise<void> {
    if (currentCount === 0) {
      const defaults = this.getDefaultSeedDepartments();
      for (const d of defaults) {
        await this.firestoreService.setDocument('settings_departments', d.id!, d);
      }
    }
  }

  // -- Divisions --
  getDivisions(): Observable<Division[]> {
    return this.firestoreService.getCollection<Division>('settings_divisions');
  }

  async addDivision(division: Division): Promise<void> {
    if (division.id) {
      await this.firestoreService.updateDocument('settings_divisions', division.id, division);
    } else {
      await this.firestoreService.addDocument('settings_divisions', division);
    }
  }

  async deleteDivision(id: string): Promise<void> {
    await this.firestoreService.deleteDocument('settings_divisions', id);
  }

  // -- Role & Permission Mappings --
  getRolePermissions(): Observable<{ id?: string; mapping?: Record<string, string[]> } | undefined> {
    return this.firestoreService.getDocument<{ id?: string; mapping?: Record<string, string[]> }>('settings/role_permissions');
  }

  async saveRolePermissions(mapping: Record<string, string[]>): Promise<void> {
    await this.firestoreService.setDocument('settings', 'role_permissions', {
      mapping,
      updatedAt: Date.now()
    });
  }

  // -- Dynamic Schemas --
  getSchemas(): Observable<DynamicSchema[]> {
    return this.firestoreService.getCollection<DynamicSchema>('dynamic_schemas');
  }

  getSchema(targetModule: string): Observable<DynamicSchema[]> {
    // Ideally we'd use a where clause here if the firestore service supported it easily,
    // but we can query by ID if we enforce schema_id === targetModule
    return this.firestoreService.getCollection<DynamicSchema>('dynamic_schemas'); // We will filter on client for now or update getCollection
  }

  async saveSchema(schema: DynamicSchema): Promise<void> {
    if (schema.id) {
      await this.firestoreService.updateDocument('dynamic_schemas', schema.id, schema);
    } else {
      await this.firestoreService.addDocument('dynamic_schemas', schema);
    }
  }

  async deleteSchema(id: string): Promise<void> {
    await this.firestoreService.deleteDocument('dynamic_schemas', id);
  }

  // -- Issue Types --
  getIssueTypes(): Observable<IssueType[]> {
    return this.firestoreService.getCollection<IssueType>('settings_issue_types');
  }

  async saveIssueType(issueType: IssueType): Promise<void> {
    if (issueType.id) {
      await this.firestoreService.updateDocument('settings_issue_types', issueType.id, issueType);
    } else {
      await this.firestoreService.addDocument('settings_issue_types', issueType);
    }
  }
}
