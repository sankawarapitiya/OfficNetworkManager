import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LandJob } from '../../models/land.model';
import { LandService } from '../../services/land.service';
import { SmsService, formatSriLankanPhoneNumber, SmsLogEntry } from '../../../../core/services/sms.service';
import { NotificationService } from '../../../../core/services/notification.service';

export interface SendSmsDialogData {
  job: LandJob;
  defaultMessage?: string;
}

@Component({
  selector: 'app-send-sms-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="sms-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="sms-icon-avatar">
            <mat-icon>sms</mat-icon>
          </div>
          <div>
            <div class="title-row">
              <h2 class="dialog-title">Send SMS Notification</h2>
              <span class="job-ref-tag">{{ job.jobRef }}</span>
              <span class="status-pill" [ngClass]="job.status.toLowerCase()">{{ job.status }}</span>
            </div>
            <p class="dialog-subtitle">
              Customer: <strong>{{ job.customerName }}</strong> • Division: {{ job.division }} • Lot {{ job.lotNumber }}
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="close()" class="close-btn" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar *ngIf="isSending()" mode="indeterminate" class="header-loader"></mat-progress-bar>

      <mat-dialog-content class="sms-dialog-content">
        <!-- Gateway Info Banner -->
        <div class="gateway-info-strip">
          <div class="gw-item">
            <mat-icon class="sm-icon">cell_tower</mat-icon>
            <span>Gateway: <code>{{ smsService.settings().apiEndpoint }}</code></span>
          </div>
          <div class="gw-item">
            <mat-icon class="sm-icon">branding_watermark</mat-icon>
            <span>Sender ID: <strong>{{ senderId() }}</strong></span>
          </div>
          <div class="gw-badge" [class.enabled]="smsService.settings().enabled" [class.disabled]="!smsService.settings().enabled">
            <mat-icon class="mini-icon">{{ smsService.settings().enabled ? 'check_circle' : 'block' }}</mat-icon>
            {{ smsService.settings().enabled ? 'Active Gateway' : 'Gateway Disabled' }}
          </div>
        </div>

        <!-- Form Section -->
        <div class="form-section">
          <!-- Recipient Phone & Sender ID -->
          <div class="grid-2-col">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Recipient Mobile Number (TPNO)</mat-label>
              <input matInput [(ngModel)]="recipient" placeholder="e.g. 0771234567 or 94771234567" (ngModelChange)="onRecipientChange($event)">
              <mat-icon matPrefix class="field-icon">phone_iphone</mat-icon>
              <mat-hint>Pre-filled from customer contact phone</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full sender-id-field">
              <mat-label>Sender ID (Disabled)</mat-label>
              <input matInput [disabled]="true" [value]="senderId()" readonly placeholder="DS-OfficeTM">
              <mat-icon matPrefix class="field-icon">lock</mat-icon>
              <mat-hint>Fixed: Configured via SMS Settings</mat-hint>
            </mat-form-field>
          </div>

          <!-- Quick Template Selector -->
          <div class="template-selector-box">
            <div class="tpl-header">
              <span class="tpl-label"><mat-icon class="mini-icon">bolt</mat-icon> Quick Message Templates:</span>
            </div>
            <div class="tpl-chips-row">
              <button type="button" class="tpl-chip" [class.active]="selectedTemplateKey === 'initial'" (click)="applyTemplate('initial')">
                <mat-icon class="chip-icon">domain_add</mat-icon> 1. Initial Registration
              </button>
              <button type="button" class="tpl-chip" [class.active]="selectedTemplateKey === 'documentation'" (click)="applyTemplate('documentation')">
                <mat-icon class="chip-icon">folder_open</mat-icon> 2. Documentation
              </button>
              <button type="button" class="tpl-chip" [class.active]="selectedTemplateKey === 'verification'" (click)="applyTemplate('verification')">
                <mat-icon class="chip-icon">checklist_rtl</mat-icon> 3. Field Verification
              </button>
              <button type="button" class="tpl-chip" [class.active]="selectedTemplateKey === 'completed'" (click)="applyTemplate('completed')">
                <mat-icon class="chip-icon">verified</mat-icon> 4. Task Completed
              </button>
              <button type="button" class="tpl-chip" [class.active]="selectedTemplateKey === 'custom'" (click)="applyTemplate('custom')">
                <mat-icon class="chip-icon">edit_note</mat-icon> Custom
              </button>
            </div>
          </div>

          <!-- Editable Message Content (Full Width) -->
          <div class="message-field-wrap">
            <mat-form-field appearance="outline" class="w-full message-form-field">
              <mat-label>SMS Message Body (Editable)</mat-label>
              <textarea matInput rows="5" [(ngModel)]="messageText" placeholder="Enter SMS text message content to send to citizen..."></textarea>
              <mat-hint align="end">
                <span class="char-counter" [class.warn-text]="charCount() > 160">
                  {{ charCount() }} characters • {{ smsParts() }} {{ smsParts() === 1 ? 'Part' : 'Parts' }}
                </span>
              </mat-hint>
            </mat-form-field>
          </div>

          <!-- Mobile Screen Preview Bubble -->
          <div class="preview-card" *ngIf="messageText.trim()">
            <div class="preview-header">
              <mat-icon class="preview-icon">smartphone</mat-icon>
              <span>Recipient Preview ({{ formattedRecipientPreview() || 'No number' }})</span>
            </div>
            <div class="sms-bubble">
              <div class="bubble-sender">{{ senderId() }}</div>
              <p class="bubble-text">{{ messageText }}</p>
              <div class="bubble-meta">Now • SMS</div>
            </div>
          </div>

          <!-- Result Alert Banner -->
          <div *ngIf="lastResult()" class="result-banner" [class.success]="lastResult()?.success" [class.error]="!lastResult()?.success">
            <mat-icon class="res-icon">{{ lastResult()?.success ? 'check_circle' : 'error_outline' }}</mat-icon>
            <div class="res-body">
              <strong>{{ lastResult()?.success ? 'Message Sent Successfully!' : 'SMS Dispatch Failed' }}</strong>
              <p>{{ lastResult()?.message }}</p>
            </div>
          </div>

          <!-- History / Past SMS Log for this Job -->
          <div class="history-section" *ngIf="jobSmsLogs().length > 0">
            <div class="history-hdr">
              <mat-icon class="mini-icon">history</mat-icon>
              <span>Previous SMS Dispatches for this Job ({{ jobSmsLogs().length }})</span>
            </div>
            <div class="history-list">
              <div *ngFor="let log of jobSmsLogs()" class="history-item">
                <div class="hist-left">
                  <span class="hist-status-tag" [class.success]="log.status === 'SUCCESS'" [class.failed]="log.status === 'FAILED'">
                    {{ log.status }}
                  </span>
                  <span class="hist-recipient">To: {{ log.recipient }}</span>
                  <span class="hist-time">{{ log.sentAt | date:'short' }}</span>
                </div>
                <p class="hist-msg">{{ log.message }}</p>
              </div>
            </div>
          </div>

        </div>
      </mat-dialog-content>

      <!-- Footer Actions -->
      <div class="dialog-footer">
        <div class="footer-left">
          <span class="recipient-summary" *ngIf="formattedRecipientPreview()">
            Destination: <strong>{{ formattedRecipientPreview() }}</strong>
          </span>
        </div>

        <div class="footer-right">
          <button mat-button (click)="close()" [disabled]="isSending()">
            Cancel
          </button>
          <button mat-flat-button color="primary" class="send-btn" (click)="onSendSms()" [disabled]="isSending() || !messageText.trim() || !recipient.trim()">
            <mat-icon>send</mat-icon>
            {{ isSending() ? 'Sending SMS...' : 'Send SMS Now' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sms-dialog-container {
      width: 700px;
      max-width: 96vw;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 22px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .sms-icon-avatar {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #ecfdf5;
          color: #059669;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .dialog-title {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 800;
            color: #0f172a;
          }

          .job-ref-tag {
            font-family: monospace;
            font-size: 0.75rem;
            font-weight: 700;
            background: #0f172a;
            color: #ffffff;
            padding: 2px 7px;
            border-radius: 4px;
          }

          .status-pill {
            font-size: 0.7rem;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            &.initial { background: #e0f2fe; color: #0284c7; }
            &.documentation { background: #fef3c7; color: #d97706; }
            &.verification { background: #fae8ff; color: #a21caf; }
            &.completed { background: #dcfce7; color: #16a34a; }
            &.rejected { background: #fee2e2; color: #dc2626; }
          }
        }

        .dialog-subtitle {
          margin: 3px 0 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }
      }
    }

    .header-loader {
      flex-shrink: 0;
    }

    .sms-dialog-content {
      padding: 18px 22px !important;
      max-height: 72vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .gateway-info-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding: 8px 12px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #475569;

      .gw-item {
        display: flex;
        align-items: center;
        gap: 5px;
        code {
          font-family: monospace;
          background: #e2e8f0;
          padding: 1px 4px;
          border-radius: 3px;
        }
      }

      .gw-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 10px;
        &.enabled { background: #dcfce7; color: #16a34a; }
        &.disabled { background: #fee2e2; color: #dc2626; }
      }
    }

    .grid-2-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      @media (max-width: 580px) {
        grid-template-columns: 1fr;
      }
    }

    .field-icon {
      color: #64748b;
      margin-right: 6px;
    }

    .template-selector-box {
      margin-top: 4px;
      margin-bottom: 12px;

      .tpl-header {
        margin-bottom: 6px;
        .tpl-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
      }

      .tpl-chips-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;

        .tpl-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;

          .chip-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #64748b;
          }

          &:hover {
            background: #f1f5f9;
            border-color: #94a3b8;
          }

          &.active {
            background: #0e7490;
            border-color: #0e7490;
            color: #ffffff;
            .chip-icon { color: #ffffff; }
          }
        }
      }
    }

    .w-full {
      width: 100% !important;
      display: block !important;
    }

    .form-section {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sender-id-field {
      ::ng-deep .mat-mdc-text-field-wrapper {
        background-color: #f8fafc !important;
      }
      input[disabled] {
        color: #0f172a !important;
        -webkit-text-fill-color: #0f172a !important;
        font-weight: 700 !important;
        cursor: not-allowed;
      }
    }

    .message-field-wrap {
      width: 100%;
      display: block;

      .message-form-field {
        width: 100% !important;
        display: block !important;

        ::ng-deep .mat-mdc-form-field-flex {
          width: 100% !important;
        }

        ::ng-deep .mat-mdc-text-field-wrapper {
          width: 100% !important;
        }

        textarea {
          width: 100% !important;
          min-height: 120px;
          line-height: 1.5;
          font-size: 0.925rem;
          resize: vertical;
        }
      }

      .char-counter {
        font-size: 0.75rem;
        font-family: monospace;
        color: #64748b;
        &.warn-text { color: #d97706; font-weight: 700; }
      }
    }

    .preview-card {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 12px 14px;

      .preview-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 8px;

        .preview-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .sms-bubble {
        background: #0284c7;
        color: #ffffff;
        padding: 10px 14px;
        border-radius: 14px 14px 2px 14px;
        max-width: 90%;
        margin-left: auto;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);

        .bubble-sender {
          font-size: 0.65rem;
          font-weight: 800;
          opacity: 0.85;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
          text-transform: uppercase;
        }

        .bubble-text {
          margin: 0;
          font-size: 0.85rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        .bubble-meta {
          font-size: 0.65rem;
          opacity: 0.7;
          text-align: right;
          margin-top: 4px;
        }
      }
    }

    .result-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.825rem;

      .res-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .res-body {
        p { margin: 2px 0 0 0; }
      }

      &.success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
        .res-icon { color: #16a34a; }
      }

      &.error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        .res-icon { color: #dc2626; }
      }
    }

    .history-section {
      margin-top: 10px;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;

      .history-hdr {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 8px;
      }

      .history-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 140px;
        overflow-y: auto;

        .history-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 0.75rem;

          .hist-left {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 3px;

            .hist-status-tag {
              font-size: 0.65rem;
              font-weight: 700;
              padding: 1px 5px;
              border-radius: 4px;
              &.success { background: #dcfce7; color: #166534; }
              &.failed { background: #fee2e2; color: #991b1b; }
            }

            .hist-recipient { font-weight: 600; color: #1e293b; }
            .hist-time { color: #94a3b8; font-size: 0.7rem; margin-left: auto; }
          }

          .hist-msg {
            margin: 0;
            color: #475569;
            font-size: 0.75rem;
            white-space: pre-wrap;
          }
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 22px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;

      .recipient-summary {
        font-size: 0.8rem;
        color: #475569;
        strong { color: #0284c7; font-family: monospace; }
      }

      .footer-right {
        display: flex;
        align-items: center;
        gap: 10px;

        .send-btn {
          background: #0284c7 !important;
          color: #ffffff !important;
          font-weight: 600;
        }
      }
    }

    .sm-icon { font-size: 16px; width: 16px; height: 16px; }
    .mini-icon { font-size: 13px; width: 13px; height: 13px; }
  `]
})
export class SendSmsDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<SendSmsDialogComponent>);
  smsService = inject(SmsService);
  landService = inject(LandService);
  notif = inject(NotificationService);

  job: LandJob;
  recipient = '';
  customSenderId = '';
  messageText = '';
  selectedTemplateKey = 'initial';
  isSending = signal<boolean>(false);
  lastResult = signal<{ success: boolean; message: string } | null>(null);
  jobSmsLogs = signal<SmsLogEntry[]>([]);

  charCount = computed(() => this.messageText.length);
  smsParts = computed(() => Math.max(1, Math.ceil(this.charCount() / 160)));

  senderId = computed(() => {
    return (this.customSenderId || this.smsService.settings().senderId || 'DS-OfficeTM').trim();
  });

  formattedRecipientPreview = computed(() => {
    return formatSriLankanPhoneNumber(this.recipient);
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: SendSmsDialogData) {
    this.job = { ...data.job };
  }

  ngOnInit() {
    // 1. Pre-fill recipient from connected customer's contact phone number
    const initialPhone = this.job.customerPhone || '';
    this.recipient = initialPhone;

    // 2. Select initial template matching current stage if possible
    const currentStatus = (this.job.status || 'Initial').toLowerCase();
    if (currentStatus === 'initial') this.selectedTemplateKey = 'initial';
    else if (currentStatus === 'documentation') this.selectedTemplateKey = 'documentation';
    else if (currentStatus === 'verification') this.selectedTemplateKey = 'verification';
    else if (currentStatus === 'completed') this.selectedTemplateKey = 'completed';
    else this.selectedTemplateKey = 'initial';

    // 3. Populate default message if provided or generate from template
    if (this.data.defaultMessage) {
      this.messageText = this.data.defaultMessage;
      this.selectedTemplateKey = 'custom';
    } else {
      this.applyTemplate(this.selectedTemplateKey);
    }

    // 4. Load past SMS logs for this job
    if (this.job.id) {
      this.smsService.getJobSmsLogs(this.job.id).subscribe({
        next: (logs) => this.jobSmsLogs.set(logs || []),
        error: () => {}
      });
    }
  }

  onRecipientChange(val: string) {
    this.recipient = val;
  }

  applyTemplate(key: string) {
    this.selectedTemplateKey = key;
    const settings = this.smsService.settings();
    const tpls = settings.templates || {};

    let rawTemplate = '';
    switch (key) {
      case 'initial':
        rawTemplate = tpls.initial || 'Dear {CUSTOMER_NAME}, your Land Task {JOB_REF} (Lot {LOT_NUMBER}) has been registered at the DS Office. File No: {FILE_NUMBER}.';
        break;
      case 'documentation':
        rawTemplate = tpls.documentation || 'Dear {CUSTOMER_NAME}, your Land Task {JOB_REF} is in Stage 2 (Documentation). Please submit all pending deeds and surveyor plans to the DS Office.';
        break;
      case 'verification':
        rawTemplate = tpls.verification || 'Dear {CUSTOMER_NAME}, field inspection & cadastral verification for Land Task {JOB_REF} has been scheduled by our Land Branch.';
        break;
      case 'completed':
        rawTemplate = tpls.completed || 'Dear {CUSTOMER_NAME}, your Land Task {JOB_REF} has been successfully approved and completed. You may collect your title/certificate from the DS Office.';
        break;
      case 'custom':
      default:
        rawTemplate = tpls.custom || 'Dear {CUSTOMER_NAME}, regarding Land Task {JOB_REF} at the DS Office: ';
        break;
    }

    // Interpolate placeholders
    this.messageText = this.interpolatePlaceholders(rawTemplate);
  }

  private interpolatePlaceholders(template: string): string {
    const custName = this.job.customerName || 'Citizen';
    const jobRef = this.job.jobRef || 'LND-TASK';
    const fileNum = this.job.fileNumber || 'N/A';
    const lotNum = this.job.lotNumber || 'N/A';
    const planNum = this.job.planNumber || 'N/A';
    const deedNum = this.job.deedNumber || 'N/A';
    const division = this.job.division || 'DS Division';

    return template
      .replace(/{CUSTOMER_NAME}/g, custName)
      .replace(/{JOB_REF}/g, jobRef)
      .replace(/{FILE_NUMBER}/g, fileNum)
      .replace(/{LOT_NUMBER}/g, lotNum)
      .replace(/{PLAN_NUMBER}/g, planNum)
      .replace(/{DEED_NUMBER}/g, deedNum)
      .replace(/{DIVISION}/g, division);
  }

  async onSendSms() {
    const formattedPhone = formatSriLankanPhoneNumber(this.recipient);
    if (!formattedPhone || formattedPhone.length < 9) {
      this.notif.warning('Please enter a valid recipient phone number (e.g. 0771234567 or 94771234567).');
      return;
    }

    if (!this.messageText.trim()) {
      this.notif.warning('Please write a message content to send.');
      return;
    }

    this.isSending.set(true);
    this.lastResult.set(null);

    const result = await this.smsService.sendSms({
      recipient: formattedPhone,
      message: this.messageText.trim(),
      senderId: this.senderId(),
      jobId: this.job.id,
      jobRef: this.job.jobRef,
      customerName: this.job.customerName
    });

    this.isSending.set(false);
    this.lastResult.set(result);

    if (result.success) {
      this.notif.success(`SMS successfully dispatched to ${formattedPhone}!`);

      // Record audit in Land Service
      if (this.job.id) {
        await this.landService.recordAudit({
          jobId: this.job.id,
          jobRef: this.job.jobRef,
          jobTypeName: this.job.jobTypeName || 'Land Task',
          actionType: 'UPDATED',
          officerId: 'system',
          officerName: 'SMS Gateway',
          details: `Sent SMS to ${formattedPhone} via ${this.senderId()}: "${this.messageText.trim()}"`,
          timestamp: Date.now()
        });
      }

      // Close dialog after a short delay so the user sees the confirmation
      setTimeout(() => {
        this.dialogRef.close({ success: true, result });
      }, 1200);
    } else {
      this.notif.error('SMS sending failed: ' + result.message);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
