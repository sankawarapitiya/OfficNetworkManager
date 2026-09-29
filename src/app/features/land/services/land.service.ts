import { Injectable, inject } from '@angular/core';
import { Observable, from, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AuthService } from '../../../auth/auth.service';
import { EventLogService } from '../../../core/services/event-log.service';
import { 
  LandJob, 
  LandJobStatus, 
  LandAuditRecord, 
  LandSettings, 
  DEFAULT_LAND_SETTINGS, 
  generateLandJobRef 
} from '../models/land.model';

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
  uploaded_documents: Record<string, string>;
  job_status: 'Open' | 'In Progress' | 'Resolved';
  recommendation?: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class LandService {
  private firestoreService = inject(FirestoreService);
  private storage = inject(Storage, { optional: true });
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);

  private readonly jobsCollection = 'land_jobs';
  private readonly auditCollection = 'land_audit';
  private readonly settingsDoc = 'settings/land_config';

  // ----------------------------------------------------
  // Legacy compatibility methods
  // ----------------------------------------------------
  getLandRecords(): Observable<LandRecord[]> {
    return this.firestoreService.getCollection<LandRecord>('land_records');
  }

  async addLandRecord(record: Omit<LandRecord, 'id'>): Promise<string> {
    return this.firestoreService.addDocument('land_records', record);
  }

  getLandIssues(): Observable<LandIssue[]> {
    return this.firestoreService.getCollection<LandIssue>('land_issues');
  }

  async addLandIssue(issue: Omit<LandIssue, 'id'>): Promise<string> {
    return this.firestoreService.addDocument('land_issues', issue);
  }

  async updateIssueStatus(id: string, status: 'Open' | 'In Progress' | 'Resolved'): Promise<void> {
    return this.firestoreService.updateDocument('land_issues', id, { job_status: status });
  }

  // ----------------------------------------------------
  // Land Jobs Workflow Management
  // ----------------------------------------------------

  /**
   * Stream all land tasks / jobs ordered by creation descending
   */
  getLandJobs(): Observable<LandJob[]> {
    return this.firestoreService.getCollection<LandJob>(this.jobsCollection).pipe(
      map(jobs => jobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    );
  }

  /**
   * Fetch single land job by Firestore ID
   */
  getLandJobById(id: string): Observable<LandJob | undefined> {
    return this.firestoreService.getDocument<LandJob>(`${this.jobsCollection}/${id}`);
  }

  /**
   * Create a new land job from the 4-stage wizard
   */
  async createLandJob(jobData: Omit<LandJob, 'id' | 'jobRef' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>): Promise<string> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Land Officer';
    const officerId = user?.uid || 'system';

    // Retrieve settings to generate sequence reference
    let settings = DEFAULT_LAND_SETTINGS;
    try {
      const dbSettings = await firstValueFrom(this.firestoreService.getDocument<LandSettings>(this.settingsDoc));
      if (dbSettings) {
        settings = { ...DEFAULT_LAND_SETTINGS, ...dbSettings };
      }
    } catch {
      // Fallback to default settings
    }

    const jobRef = generateLandJobRef(settings);
    const now = Date.now();

    const newJob: Omit<LandJob, 'id'> = {
      ...jobData,
      jobRef,
      createdAt: now,
      createdBy: officerName,
      updatedAt: now,
      updatedBy: officerName
    };

    const docId = await this.firestoreService.addDocument(this.jobsCollection, newJob);

    // Increment nextSeq in settings
    try {
      await this.firestoreService.setDocument('settings', 'land_config', {
        ...settings,
        nextSeq: (settings.nextSeq || 1) + 1
      });
    } catch (e) {
      console.warn('Could not increment nextSeq in land settings:', e);
    }

    // Write audit trail
    await this.recordAudit({
      jobId: docId,
      jobRef,
      jobTypeName: jobData.jobTypeName || 'Land Task',
      actionType: 'CREATED',
      officerId,
      officerName,
      details: `Created new land task for customer: ${jobData.customerName} in ${jobData.division}. Lot: ${jobData.lotNumber || 'N/A'}, Deed: ${jobData.deedNumber || 'N/A'}`,
      toStage: jobData.status || 'Initial',
      timestamp: now
    });

    this.eventLogService.logAction(
      'CREATED',
      'land',
      `Registered land job [${jobRef}] for ${jobData.customerName} (${jobData.jobTypeName})`
    );

    return docId;
  }

  /**
   * Update full or partial land job details
   */
  async updateLandJob(id: string, jobData: Partial<LandJob>, auditNote?: string): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Land Officer';
    const officerId = user?.uid || 'system';
    const now = Date.now();

    const updatePayload: Partial<LandJob> = {
      ...jobData,
      updatedAt: now,
      updatedBy: officerName
    };

    await this.firestoreService.updateDocument(this.jobsCollection, id, updatePayload);

    if (auditNote) {
      await this.recordAudit({
        jobId: id,
        jobRef: jobData.jobRef || id,
        jobTypeName: jobData.jobTypeName || 'Land Task',
        actionType: 'UPDATED',
        officerId,
        officerName,
        details: auditNote,
        timestamp: now
      });
    }
  }

  /**
   * Advance workflow stage with remarks and audit tracking
   */
  async updateJobStage(
    job: LandJob, 
    newStage: LandJobStatus, 
    remarks: string, 
    completionDetails?: { finalDecision?: 'Approved' | 'Rejected' | 'Conditional Approval'; certificateNo?: string }
  ): Promise<void> {
    if (!job.id) return;

    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Land Officer';
    const officerId = user?.uid || 'system';
    const now = Date.now();

    const updates: Partial<LandJob> = {
      status: newStage,
      updatedAt: now,
      updatedBy: officerName
    };

    if (newStage === 'Completed' || completionDetails?.finalDecision) {
      updates.finalDecision = completionDetails?.finalDecision || 'Approved';
      updates.completionRemarks = remarks;
      updates.completedDate = new Date().toISOString().split('T')[0];
      updates.approvedByOfficerName = officerName;
      if (completionDetails?.certificateNo) {
        updates.certificateOrGrantNo = completionDetails.certificateNo;
      }
    }

    await this.firestoreService.updateDocument(this.jobsCollection, job.id, updates);

    await this.recordAudit({
      jobId: job.id,
      jobRef: job.jobRef,
      jobTypeName: job.jobTypeName,
      actionType: newStage === 'Completed' ? 'COMPLETED' : 'STAGE_TRANSITION',
      officerId,
      officerName,
      details: `Advanced stage to ${newStage}. Remarks: ${remarks}`,
      fromStage: job.status,
      toStage: newStage,
      timestamp: now
    });

    this.eventLogService.logAction(
      'UPDATED',
      'land',
      `Advanced land job [${job.jobRef}] to stage ${newStage}`
    );
  }

  /**
   * Delete a land job record with audit entry
   */
  async deleteLandJob(job: LandJob): Promise<void> {
    if (!job.id) return;

    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Land Officer';
    const officerId = user?.uid || 'system';

    await this.firestoreService.deleteDocument(this.jobsCollection, job.id);

    await this.recordAudit({
      jobId: job.id,
      jobRef: job.jobRef,
      jobTypeName: job.jobTypeName,
      actionType: 'DELETED',
      officerId,
      officerName,
      details: `Deleted land job: ${job.jobRef} (${job.customerName})`,
      timestamp: Date.now()
    });

    this.eventLogService.logAction('DELETED', 'land', `Deleted land job: ${job.jobRef}`);
  }

  /**
   * Upload document file to Firebase Storage or generate local object URL
   */
  async uploadDocumentFile(file: File, jobRef: string): Promise<string> {
    if (!this.storage) {
      console.warn('Firebase Storage not injected, using object URL');
      return URL.createObjectURL(file);
    }

    try {
      const safeRef = jobRef.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `land_documents/${safeRef}/${safeName}`;
      const storageRef = ref(this.storage, path);

      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (err) {
      console.warn('Cloud upload failed, falling back to local object URL:', err);
      return URL.createObjectURL(file);
    }
  }

  // ----------------------------------------------------
  // Audit Logs
  // ----------------------------------------------------

  async recordAudit(record: LandAuditRecord): Promise<void> {
    try {
      await this.firestoreService.addDocument(this.auditCollection, record);
    } catch (err) {
      console.error('Failed to write land audit entry:', err);
    }
  }

  getAuditLogs(): Observable<LandAuditRecord[]> {
    return this.firestoreService.getCollection<LandAuditRecord>(this.auditCollection).pipe(
      map(logs => logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    );
  }

  // ----------------------------------------------------
  // Dynamic Settings
  // ----------------------------------------------------

  getSettings(): Observable<LandSettings> {
    return this.firestoreService.getDocument<LandSettings>(this.settingsDoc).pipe(
      map(s => s ? { ...DEFAULT_LAND_SETTINGS, ...s } : DEFAULT_LAND_SETTINGS),
      catchError(() => of(DEFAULT_LAND_SETTINGS))
    );
  }

  async saveSettings(settings: LandSettings): Promise<void> {
    await this.firestoreService.setDocument('settings', 'land_config', settings);
    this.eventLogService.logAction('UPDATED', 'land', 'Updated Land Management configuration and job types');
  }
}
