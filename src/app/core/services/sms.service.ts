import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { where, orderBy, limit } from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import { AuthService } from '../../auth/auth.service';
import { EventLogService } from './event-log.service';

export interface SmsSettings {
  apiEndpoint: string;
  apiToken: string;
  senderId: string;
  enabled: boolean;
  templates?: {
    initial?: string;
    documentation?: string;
    verification?: string;
    completed?: string;
    custom?: string;
  };
}

export interface SmsSendResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface SmsLogEntry {
  id?: string;
  jobId?: string;
  jobRef?: string;
  customerName?: string;
  recipient: string;
  senderId: string;
  message: string;
  status: 'SUCCESS' | 'FAILED';
  responseMessage?: string;
  messageUid?: string;
  sentAt: number;
  sentBy: string;
  sentById?: string;
}

export const DEFAULT_SMS_SETTINGS: SmsSettings = {
  apiEndpoint: 'https://sms.send.lk/api/v3/',
  apiToken: '960|Lo09lWIvQSKaZ2ZaqBrenryuVxLJPN6bxN6cH8SC',
  senderId: 'DS-OfficeTM',
  enabled: true,
  templates: {
    initial: 'Dear {CUSTOMER_NAME}, your Land Task {JOB_REF} (Lot {LOT_NUMBER}) has been registered at the DS Office. File No: {FILE_NUMBER}.',
    documentation: 'Dear {CUSTOMER_NAME}, your Land Task {JOB_REF} is in Stage 2 (Documentation). Please submit all pending deeds and surveyor plans to the DS Office.',
    verification: 'Dear {CUSTOMER_NAME}, field inspection & cadastral verification for Land Task {JOB_REF} has been scheduled by our Land Branch.',
    completed: 'Dear {CUSTOMER_NAME}, your Land Task {JOB_REF} has been successfully approved and completed. You may collect your title/certificate from the DS Office.',
    custom: 'Dear {CUSTOMER_NAME}, regarding Land Task {JOB_REF} at the DS Office: '
  }
};

const SMS_SETTINGS_STORAGE_KEY = 'donm_sms_settings';
const SMS_CONFIG_DOC_PATH = 'settings/sms_config';
const SMS_LOGS_COLLECTION = 'sms_logs';

/**
 * Normalizes Sri Lankan phone numbers:
 * Converts "07XXXXXXXX" -> "947XXXXXXXX"
 * Strips non-digit chars (except leading + which is stripped to country code)
 */
export function formatSriLankanPhoneNumber(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '94' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Resolves the send.lk API endpoint URL ensuring `/sms/send` path is present
 */
export function resolveSmsSendUrl(endpoint: string): string {
  let url = (endpoint || '').trim().replace(/\/+$/, '');
  if (!url) url = 'https://sms.send.lk/api/v3';
  if (url.endsWith('/sms/send')) return url;
  if (url.endsWith('/send')) return url;
  return `${url}/sms/send`;
}

@Injectable({
  providedIn: 'root'
})
export class SmsService {
  private http = inject(HttpClient);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);

  private settingsSubject = new BehaviorSubject<SmsSettings>(this.loadInitialSettings());
  settings$ = this.settingsSubject.asObservable();
  settings = signal<SmsSettings>(this.loadInitialSettings());

  constructor() {
    this.initSettingsListener();
  }

  private loadInitialSettings(): SmsSettings {
    try {
      const saved = localStorage.getItem(SMS_SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SMS_SETTINGS,
          ...parsed,
          templates: { ...DEFAULT_SMS_SETTINGS.templates, ...(parsed.templates || {}) }
        };
      }
    } catch {}
    return { ...DEFAULT_SMS_SETTINGS };
  }

  private initSettingsListener() {
    this.firestoreService.getDocument<SmsSettings>(SMS_CONFIG_DOC_PATH).subscribe({
      next: (remote) => {
        if (remote) {
          const merged: SmsSettings = {
            ...DEFAULT_SMS_SETTINGS,
            ...remote,
            templates: { ...DEFAULT_SMS_SETTINGS.templates, ...(remote.templates || {}) }
          };
          this.settingsSubject.next(merged);
          this.settings.set(merged);
          try {
            localStorage.setItem(SMS_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
      },
      error: (err) => console.warn('Could not load remote SMS settings:', err)
    });
  }

  /**
   * Persist updated SMS Gateway Settings to Firestore and LocalStorage
   */
  async saveSettings(updated: Partial<SmsSettings>): Promise<void> {
    const current = this.settingsSubject.getValue();
    const cleanSettings: SmsSettings = {
      ...current,
      ...updated,
      templates: {
        ...current.templates,
        ...(updated.templates || {})
      }
    };

    this.settingsSubject.next(cleanSettings);
    this.settings.set(cleanSettings);

    try {
      localStorage.setItem(SMS_SETTINGS_STORAGE_KEY, JSON.stringify(cleanSettings));
    } catch {}

    try {
      await this.firestoreService.setDocument('settings', 'sms_config', cleanSettings);
    } catch (err) {
      console.error('Failed to sync SMS settings to Firestore:', err);
    }

    this.eventLogService.logAction('UPDATED', 'settings', 'Updated SMS Gateway configuration (Endpoint / Sender ID)');
  }

  /**
   * Send an SMS using the configured send.lk v3 REST API
   */
  async sendSms(params: {
    recipient: string;
    message: string;
    senderId?: string;
    jobId?: string;
    jobRef?: string;
    customerName?: string;
  }): Promise<SmsSendResult> {
    const currentSettings = this.settings();

    if (!currentSettings.enabled) {
      return { success: false, message: 'SMS service is currently disabled in system settings.' };
    }

    const token = (currentSettings.apiToken || '').trim();
    if (!token) {
      return { success: false, message: 'SMS API Token is not configured. Please set the API token in SMS Settings.' };
    }

    const formattedRecipient = formatSriLankanPhoneNumber(params.recipient);
    if (!formattedRecipient || formattedRecipient.length < 9) {
      return { success: false, message: 'Invalid recipient phone number. Please specify a valid mobile number (e.g. 0771234567 or 94771234567).' };
    }

    const trimmedMessage = (params.message || '').trim();
    if (!trimmedMessage) {
      return { success: false, message: 'Message content cannot be blank.' };
    }

    const senderId = (params.senderId || currentSettings.senderId || 'DS-OfficeTM').trim();
    const targetUrl = resolveSmsSendUrl(currentSettings.apiEndpoint);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    const body = {
      recipient: formattedRecipient,
      sender_id: senderId,
      type: 'plain',
      message: trimmedMessage
    };

    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Officer';
    const officerId = user?.uid || 'system';

    try {
      const response = await firstValueFrom(
        this.http.post<any>(targetUrl, body, { headers })
      );

      const isSuccess = response && (response.status === 'success' || response.status === 200 || response.data?.uid);
      const resMsg = response?.message || (isSuccess ? 'Message sent successfully.' : 'Failed to send SMS');
      const uid = response?.data?.uid || '';

      // Log attempt to Firestore
      await this.logSms({
        jobId: params.jobId,
        jobRef: params.jobRef,
        customerName: params.customerName,
        recipient: formattedRecipient,
        senderId,
        message: trimmedMessage,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        responseMessage: resMsg,
        messageUid: uid,
        sentAt: Date.now(),
        sentBy: officerName,
        sentById: officerId
      });

      if (isSuccess) {
        this.eventLogService.logAction(
          'CREATED',
          'land',
          `Sent SMS to ${formattedRecipient} for job [${params.jobRef || 'N/A'}] via ${senderId}`
        );
        return { success: true, message: resMsg, data: response?.data };
      } else {
        return { success: false, message: resMsg, data: response };
      }
    } catch (err: any) {
      console.error('sendSms error:', err);
      const errMsg = err?.error?.message || err?.message || 'Network error while contacting SMS gateway.';

      await this.logSms({
        jobId: params.jobId,
        jobRef: params.jobRef,
        customerName: params.customerName,
        recipient: formattedRecipient,
        senderId,
        message: trimmedMessage,
        status: 'FAILED',
        responseMessage: errMsg,
        sentAt: Date.now(),
        sentBy: officerName,
        sentById: officerId
      });

      return { success: false, message: errMsg };
    }
  }

  /**
   * Record SMS Log entry
   */
  async logSms(entry: SmsLogEntry): Promise<void> {
    try {
      await this.firestoreService.addDocument(SMS_LOGS_COLLECTION, entry);
    } catch (e) {
      console.warn('Failed to write SMS log to Firestore:', e);
    }
  }

  /**
   * Get recent SMS logs for a specific job
   */
  getJobSmsLogs(jobId: string): Observable<SmsLogEntry[]> {
    return this.firestoreService.getCollection<SmsLogEntry>(
      SMS_LOGS_COLLECTION, 
      [where('jobId', '==', jobId), orderBy('sentAt', 'desc'), limit(20)]
    );
  }

  /**
   * Get all recent SMS dispatches across the platform
   */
  getAllSmsLogs(maxCount: number = 50): Observable<SmsLogEntry[]> {
    return this.firestoreService.getCollection<SmsLogEntry>(
      SMS_LOGS_COLLECTION,
      [orderBy('sentAt', 'desc'), limit(maxCount)]
    );
  }
}
