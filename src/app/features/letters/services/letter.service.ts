import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AuthService } from '../../../auth/auth.service';
import { EventLogService } from '../../../core/services/event-log.service';
import { 
  Letter, 
  LetterActionLog, 
  LetterSettings, 
  DEFAULT_LETTER_SETTINGS, 
  LetterStatus, 
  LetterAttachment 
} from '../models/letter.model';

export interface LetterAuditRecord {
  id?: string;
  letter_id: string;
  letter_ref: string;
  letter_title: string;
  action_type: 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNMENT_CHANGED' | 'ATTACHMENT_ADDED' | 'UPDATED' | 'DELETED';
  officer_id: string;
  officer_name: string;
  details: string;
  from_status?: string;
  to_status?: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class LetterService {
  private firestoreService = inject(FirestoreService);
  private storage = inject(Storage, { optional: true });
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);

  private readonly lettersCollection = 'official_letters';
  private readonly auditCollection = 'letter_audit';
  private readonly settingsDoc = 'settings/letters_config';

  /**
   * Stream all official letters sorted by creation date descending
   */
  getLetters(): Observable<Letter[]> {
    return this.firestoreService.getCollection<Letter>(this.lettersCollection).pipe(
      map(letters => {
        return letters.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      })
    );
  }

  /**
   * Get single letter by Firestore ID
   */
  getLetterById(id: string): Observable<Letter | undefined> {
    return this.firestoreService.getDocument<Letter>(`${this.lettersCollection}/${id}`);
  }

  /**
   * Filter letters that belong to a specific user (assigned officer or target department)
   */
  filterLettersForUser(
    letters: Letter[], 
    user: { uid?: string | null; email?: string | null; displayName?: string | null } | null | undefined, 
    department?: string | null
  ): Letter[] {
    if (!user && !department) return [];

    const uid = user?.uid?.toLowerCase().trim();
    const email = user?.email?.toLowerCase().trim();
    const name = user?.displayName?.toLowerCase().trim();
    const dept = department?.toLowerCase().trim();

    return letters.filter(l => {
      // 1. Direct assignment to officer
      if (l.assigned_to && l.assigned_to.length > 0) {
        const assignedMatch = l.assigned_to.some(a => {
          const val = a.toLowerCase().trim();
          return (uid && val === uid) || (email && val === email) || (name && val === name);
        });
        if (assignedMatch) return true;
      }

      if (l.assigned_user_names && l.assigned_user_names.length > 0 && name) {
        const nameMatch = l.assigned_user_names.some(uName => uName.toLowerCase().trim() === name);
        if (nameMatch) return true;
      }

      // 2. Department assignment
      if (dept && l.send_to && l.send_to.length > 0) {
        const deptMatch = l.send_to.some(targetDept => {
          const t = targetDept.toLowerCase().trim();
          return t === dept || t.includes(dept) || dept.includes(t);
        });
        if (deptMatch) return true;
      }

      return false;
    });
  }

  /**
   * Add a new official letter
   */
  async addLetter(letterData: Omit<Letter, 'id'>): Promise<string> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Officer';
    const officerId = user?.uid || 'system';

    const now = Date.now();
    const initialAction: LetterActionLog = {
      id: 'act_' + now,
      timestamp: now,
      officer_name: officerName,
      officer_id: officerId,
      from_status: 'None',
      to_status: letterData.status || 'Received',
      remarks: 'Official letter logged into registry: ' + letterData.title
    };

    const finalLetter: Omit<Letter, 'id'> = {
      ...letterData,
      action_logs: [initialAction],
      created_at: now,
      created_by: officerName,
      updated_at: now,
      updated_by: officerName
    };

    const docId = await this.firestoreService.addDocument(this.lettersCollection, finalLetter);

    // Write audit record
    await this.recordAudit({
      letter_id: docId,
      letter_ref: letterData.ref_number,
      letter_title: letterData.title,
      action_type: 'CREATED',
      officer_id: officerId,
      officer_name: officerName,
      details: 'Registered inward correspondence from: ' + letterData.received_from,
      from_status: 'None',
      to_status: letterData.status || 'Received',
      timestamp: now
    });

    this.eventLogService.logAction('CREATED', 'letters', 'Registered official letter [' + letterData.ref_number + '] ' + letterData.title);

    return docId;
  }

  /**
   * Update full or partial letter details
   */
  async updateLetter(id: string, letter: Partial<Letter>, auditNote?: string): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Officer';
    const officerId = user?.uid || 'system';
    const now = Date.now();

    const updatePayload: Partial<Letter> = {
      ...letter,
      updated_at: now,
      updated_by: officerName
    };

    await this.firestoreService.updateDocument(this.lettersCollection, id, updatePayload);

    if (auditNote) {
      await this.recordAudit({
        letter_id: id,
        letter_ref: letter.ref_number || id,
        letter_title: letter.title || 'Official Letter',
        action_type: 'UPDATED',
        officer_id: officerId,
        officer_name: officerName,
        details: auditNote,
        timestamp: now
      });
    }
  }

  /**
   * Update letter status with structured remarks and audit logging
   */
  async updateLetterStatus(
    letter: Letter, 
    newStatus: LetterStatus, 
    remarks: string, 
    newAssignment?: string[]
  ): Promise<void> {
    if (!letter.id) return;

    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Officer';
    const officerId = user?.uid || 'system';
    const now = Date.now();

    const newActionLog: LetterActionLog = {
      id: 'act_' + now,
      timestamp: now,
      officer_name: officerName,
      officer_id: officerId,
      from_status: letter.status,
      to_status: newStatus,
      remarks: remarks || 'Status updated to ' + newStatus
    };

    const existingLogs = letter.action_logs || [];
    const updatedLogs = [...existingLogs, newActionLog];

    const patch: Partial<Letter> = {
      status: newStatus,
      action_logs: updatedLogs,
      updated_at: now,
      updated_by: officerName
    };

    if (newAssignment && newAssignment.length > 0) {
      patch.assigned_to = newAssignment;
    }

    await this.firestoreService.updateDocument(this.lettersCollection, letter.id, patch);

    // Audit trail
    await this.recordAudit({
      letter_id: letter.id,
      letter_ref: letter.ref_number,
      letter_title: letter.title,
      action_type: 'STATUS_CHANGED',
      officer_id: officerId,
      officer_name: officerName,
      from_status: letter.status,
      to_status: newStatus,
      details: remarks || 'Changed workflow status from ' + letter.status + ' to ' + newStatus,
      timestamp: now
    });

    this.eventLogService.logAction(
      'UPDATED', 
      'letters', 
      'Updated letter status [' + letter.ref_number + '] to ' + newStatus + ' - ' + remarks
    );
  }

  /**
   * Delete letter from system
   */
  async deleteLetter(letter: Letter): Promise<void> {
    if (!letter.id) return;
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Officer';
    const officerId = user?.uid || 'system';

    await this.firestoreService.deleteDocument(this.lettersCollection, letter.id);

    await this.recordAudit({
      letter_id: letter.id,
      letter_ref: letter.ref_number,
      letter_title: letter.title,
      action_type: 'DELETED',
      officer_id: officerId,
      officer_name: officerName,
      details: 'Deleted letter record from registry: ' + letter.title,
      timestamp: Date.now()
    });

    this.eventLogService.logAction('DELETED', 'letters', 'Deleted letter record: ' + letter.ref_number);
  }

  /**
   * Upload file to Firebase Cloud Storage and return download URL
   */
  async uploadAttachmentToFirebase(file: File, letterRef: string): Promise<string> {
    if (!this.storage) {
      console.warn('Firebase storage not injected, generating mock local preview URL');
      return URL.createObjectURL(file);
    }

    const safeRef = letterRef.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `official_letters/${safeRef}/${safeName}`;
    const storageRef = ref(this.storage, filePath);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  /**
   * Record entry in dedicated letter audit log
   */
  private async recordAudit(record: LetterAuditRecord): Promise<void> {
    try {
      await this.firestoreService.addDocument(this.auditCollection, record);
    } catch (err) {
      console.error('Failed to write letter audit record:', err);
    }
  }

  /**
   * Stream all audit logs sorted by timestamp desc
   */
  getAuditLogs(): Observable<LetterAuditRecord[]> {
    return this.firestoreService.getCollection<LetterAuditRecord>(this.auditCollection).pipe(
      map(logs => logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    );
  }

  /**
   * Retrieve module settings
   */
  getSettings(): Observable<LetterSettings> {
    return this.firestoreService.getDocument<LetterSettings>(this.settingsDoc).pipe(
      map(s => s ? { ...DEFAULT_LETTER_SETTINGS, ...s } : DEFAULT_LETTER_SETTINGS),
      catchError(() => of(DEFAULT_LETTER_SETTINGS))
    );
  }

  /**
   * Save module settings
   */
  async saveSettings(settings: LetterSettings): Promise<void> {
    await this.firestoreService.setDocument('settings', 'letters_config', settings);
  }
}
