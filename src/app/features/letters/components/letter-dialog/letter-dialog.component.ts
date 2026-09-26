import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { 
  Letter, 
  LetterAttachment, 
  LetterPriority, 
  LetterStatus, 
  ALL_LETTER_STATUSES, 
  DEFAULT_LETTER_SETTINGS, 
  LetterSettings,
  generateLetterRefNumber
} from '../../models/letter.model';
import { LetterService } from '../../services/letter.service';
import { SettingsService, Department } from '../../../settings/settings.service';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { AppUser } from '../../../profile/profile.component';

@Component({
  selector: 'app-letter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatRadioModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="dialog-header">
      <div class="title-wrap">
        <div class="hdr-icon-box">
          <mat-icon>{{ data.letter ? 'edit_note' : 'mark_email_read' }}</mat-icon>
        </div>
        <div class="header-text-group">
          <span class="header-tag">{{ data.letter ? 'EDIT RECORD' : 'NEW REGISTRATION' }}</span>
          <h2 mat-dialog-title class="dialog-title">{{ data.letter ? 'Edit Official Letter' : 'Register Inward Official Letter' }}</h2>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn" matTooltip="Close dialog">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-body">
      <form [formGroup]="form" class="form-container">

        <!-- SECTION 1: Identification & Subject -->
        <div class="section-block">
          <div class="section-label">
            <mat-icon class="sec-icon">badge</mat-icon>
            <span>Identification & Subject</span>
          </div>

          <!-- Letter Title -->
          <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
            <mat-label>Letter Title / Subject</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Directive regarding Land Tax Assessment 2026" required>
            <mat-icon matSuffix>title</mat-icon>
          </mat-form-field>

          <div class="grid-2">
            <!-- Ref Number with Auto-generate -->
            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Official Reference No.</mat-label>
              <input matInput formControlName="ref_number" placeholder="e.g. LET/2026/09/014" required>
              <button mat-icon-button matSuffix type="button" (click)="generateRefNumber()" matTooltip="Auto-generate tracking reference" class="sm-btn">
                <mat-icon>autorenew</mat-icon>
              </button>
            </mat-form-field>

            <!-- Linked Ref with Typeahead Autocomplete -->
            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Linked Reference (Link Ref)</mat-label>
              <input matInput 
                     formControlName="link_ref" 
                     [matAutocomplete]="autoLink"
                     (focus)="onLinkRefInput($event)"
                     (input)="onLinkRefInput($event)"
                     placeholder="Search prior reference...">
              <mat-icon matSuffix>link</mat-icon>

              <mat-autocomplete #autoLink="matAutocomplete">
                <mat-option *ngFor="let l of filteredLinkRefs()" [value]="l.ref_number">
                  <div class="typeahead-row">
                    <span class="typeahead-ref">{{ l.ref_number }}</span>
                    <span class="typeahead-title">{{ l.title }}</span>
                    <span class="typeahead-from">{{ l.received_from }}</span>
                  </div>
                </mat-option>
              </mat-autocomplete>
            </mat-form-field>
          </div>
        </div>

        <!-- SECTION 2: Origin & Classification -->
        <div class="section-block">
          <div class="section-label">
            <mat-icon class="sec-icon">travel_explore</mat-icon>
            <span>Origin, Classification & Priority</span>
          </div>

          <div class="grid-2">
            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Received From</mat-label>
              <input matInput formControlName="received_from" placeholder="e.g. Ministry of Public Administration" required>
              <mat-icon matSuffix>business</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Received Date</mat-label>
              <input matInput [matDatepicker]="datePicker" formControlName="received_date" (click)="datePicker.open()" placeholder="Select date" required>
              <mat-datepicker-toggle matIconSuffix [for]="datePicker"></mat-datepicker-toggle>
              <mat-datepicker #datePicker></mat-datepicker>
            </mat-form-field>
          </div>

          <div class="grid-3">
            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Category</mat-label>
              <mat-select formControlName="category">
                <mat-option *ngFor="let cat of categories()" [value]="cat">{{ cat }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Priority Level</mat-label>
              <mat-select formControlName="priority">
                <mat-select-trigger>
                  <span class="opt-priority-tag" [ngClass]="(form.get('priority')?.value || 'Normal').toLowerCase()">
                    {{ form.get('priority')?.value || 'Normal' }}
                  </span>
                </mat-select-trigger>
                <mat-option value="Normal">
                  <span class="opt-priority-tag normal">Normal</span>
                </mat-option>
                <mat-option value="Urgent">
                  <span class="opt-priority-tag urgent">Urgent</span>
                </mat-option>
                <mat-option value="Immediate">
                  <span class="opt-priority-tag immediate">Immediate</span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Workflow Status</mat-label>
              <mat-select formControlName="status">
                <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- SECTION 3: Routing & Assignment -->
        <div class="section-block">
          <div class="section-label">
            <mat-icon class="sec-icon">alt_route</mat-icon>
            <span>Routing & Assignment</span>
          </div>

          <div class="grid-2">
            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Send To > Departments</mat-label>
              <mat-select formControlName="send_to" multiple>
                <mat-select-trigger>
                  <span *ngIf="form.get('send_to')?.value?.length" class="multi-trigger-text">
                    {{ form.get('send_to')?.value[0] }}
                    <span *ngIf="(form.get('send_to')?.value?.length || 0) > 1" class="more-count-badge">
                      +{{ (form.get('send_to')?.value?.length || 0) - 1 }}
                    </span>
                  </span>
                </mat-select-trigger>
                <mat-option *ngFor="let dept of departments()" [value]="dept.name">
                  {{ dept.name }} <span *ngIf="dept.code" class="text-muted">({{ dept.code }})</span>
                </mat-option>
              </mat-select>
              <mat-icon matSuffix>domain</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
              <mat-label>Assignment > System Users</mat-label>
              <mat-select formControlName="assigned_to" multiple>
                <mat-select-trigger>
                  <span *ngIf="form.get('assigned_to')?.value?.length" class="multi-trigger-text">
                    {{ getUserName(form.get('assigned_to')?.value[0]) }}
                    <span *ngIf="(form.get('assigned_to')?.value?.length || 0) > 1" class="more-count-badge">
                      +{{ (form.get('assigned_to')?.value?.length || 0) - 1 }}
                    </span>
                  </span>
                </mat-select-trigger>
                <mat-option *ngFor="let u of systemUsers()" [value]="u.id || u.email">
                  {{ u.displayName || u.email }} <span *ngIf="u.department" class="text-muted">[{{ u.department }}]</span>
                </mat-option>
              </mat-select>
              <mat-icon matSuffix>person_search</mat-icon>
            </mat-form-field>
          </div>
        </div>

        <!-- SECTION 4: Description / Directives -->
        <div class="section-block">
          <div class="section-label">
            <mat-icon class="sec-icon">description</mat-icon>
            <span>Directives & Description</span>
          </div>

          <mat-form-field appearance="outline" class="w-full field-textarea" subscriptSizing="dynamic">
            <mat-label>Letter Directives & Remarks</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="Summary of letter directives, action requirements, or remarks..."></textarea>
          </mat-form-field>
        </div>

        <!-- SECTION 5: Document Attachments (Dual Storage) -->
        <div class="section-block attachments-block">
          <div class="section-label">
            <mat-icon class="sec-icon">attach_file</mat-icon>
            <span>Digital Document Attachments</span>
          </div>

          <div class="storage-container">
            <div class="storage-segmented-control">
              <span class="storage-title">Storage Destination:</span>
              <div class="segment-pill-group">
                <button type="button" 
                        class="segment-pill" 
                        [class.active]="storageType === 'firebase'" 
                        (click)="storageType = 'firebase'">
                  <mat-icon class="pill-icon">cloud_queue</mat-icon>
                  <span>Firebase Cloud Storage</span>
                </button>
                <button type="button" 
                        class="segment-pill" 
                        [class.active]="storageType === 'network'" 
                        (click)="storageType = 'network'">
                  <mat-icon class="pill-icon">folder_shared</mat-icon>
                  <span>Network Location Share</span>
                </button>
              </div>
            </div>

            <!-- Network Path Dropdown when network is active -->
            <div *ngIf="storageType === 'network'" class="network-select-wrap">
              <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
                <mat-label>Network Share Path</mat-label>
                <mat-select [(ngModel)]="selectedNetworkLocation" [ngModelOptions]="{standalone: true}">
                  <mat-option *ngFor="let loc of networkLocations()" [value]="loc">
                    {{ loc }}
                  </mat-option>
                </mat-select>
                <mat-icon matSuffix>folder_open</mat-icon>
              </mat-form-field>
            </div>

            <!-- Upload Row -->
            <div class="upload-action-bar">
              <input type="file" #fileInput (change)="onFileSelected($event)" style="display: none" multiple>
              <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="isUploading()" class="upload-btn">
                <mat-icon>upload_file</mat-icon> Attach File(s)
              </button>
              <span class="upload-hint" *ngIf="!isUploading() && attachments().length === 0">
                PDF, Word, or Scanned Images
              </span>
              <span *ngIf="isUploading()" class="uploading-indicator">
                <mat-icon class="spin-icon">sync</mat-icon> Uploading to {{ storageType === 'firebase' ? 'Cloud' : 'Network' }}...
              </span>
            </div>

            <!-- Attached Files List -->
            <div class="attached-list" *ngIf="attachments().length > 0">
              <div *ngFor="let att of attachments(); let i = index" class="att-item">
                <div class="att-info">
                  <mat-icon class="file-icon" [ngClass]="att.storage_destination">
                    {{ att.storage_destination === 'firebase' ? 'cloud_done' : 'folder_shared' }}
                  </mat-icon>
                  <div class="att-names">
                    <span class="fname">{{ att.name }}</span>
                    <span class="fmeta">
                      {{ (att.size / 1024).toFixed(1) }} KB • 
                      {{ att.storage_destination === 'firebase' ? 'Firebase Cloud' : ('Network: ' + att.network_path) }}
                    </span>
                  </div>
                </div>
                <div class="att-actions">
                  <a *ngIf="att.storage_url" [href]="att.storage_url" target="_blank" mat-icon-button color="primary" matTooltip="Download / View" class="icon-btn-xs">
                    <mat-icon>visibility</mat-icon>
                  </a>
                  <button mat-icon-button color="warn" type="button" (click)="removeAttachment(i)" matTooltip="Remove" class="icon-btn-xs">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close class="cancel-btn">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || isSaving() || isUploading()" (click)="save()" class="submit-btn">
        <mat-icon *ngIf="!isSaving()">{{ data.letter ? 'save' : 'done_all' }}</mat-icon>
        <mat-icon *ngIf="isSaving()" class="spin-icon">sync</mat-icon>
        <span>{{ isSaving() ? 'Saving...' : (data.letter ? 'Save Changes' : 'Register Official Letter') }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 92vh;
      overflow: hidden;
      box-sizing: border-box;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 22px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      flex-shrink: 0;
      .title-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        .hdr-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: #ecfdf5;
          color: #059669;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 22px; width: 22px; height: 22px; }
        }
        .header-text-group {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .header-tag {
          font-size: 9.5px;
          font-weight: 700;
          color: #059669;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .dialog-title {
          margin: 0 !important;
          padding: 0 !important;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }
      }
      .close-btn {
        width: 32px;
        height: 32px;
        line-height: 32px;
        color: #64748b;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:hover { color: #0f172a; background: #f1f5f9; }
      }
    }

    .dialog-body {
      padding: 16px 22px !important;
      margin: 0 !important;
      flex: 1 1 auto;
      max-height: calc(92vh - 128px) !important;
      overflow-y: auto;
      box-sizing: border-box;
    }

    .form-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .section-block {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.2s, box-shadow 0.2s;
      &:focus-within {
        border-color: #cbd5e1;
        box-shadow: 0 1px 4px rgba(0,0,0,0.03);
      }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      margin-bottom: 2px;
      .sec-icon { font-size: 14px; width: 14px; height: 14px; color: #059669; }
    }

    .w-full { width: 100%; }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .sm-btn {
      width: 26px;
      height: 26px;
      line-height: 26px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    .field-textarea {
      textarea {
        font-size: 12px !important;
        line-height: 1.4;
      }
    }

    /* Typeahead Row Styling */
    .typeahead-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
      width: 100%;
      .typeahead-ref {
        font-family: monospace;
        font-weight: 700;
        background: #eff6ff;
        color: #1e40af;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
      }
      .typeahead-title {
        color: #1e293b;
        font-weight: 500;
        max-width: 220px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .typeahead-from {
        color: #64748b;
        font-size: 10.5px;
        margin-left: auto;
        white-space: nowrap;
      }
    }

    /* Priority Options & Trigger */
    .opt-priority-tag {
      font-size: 11px;
      font-weight: 600;
      padding: 1px 8px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      &.normal { background: #f1f5f9; color: #475569; }
      &.urgent { background: #fef3c7; color: #b45309; }
      &.immediate { background: #fee2e2; color: #b91c1c; }
    }

    /* Multi-select Trigger Badges */
    .multi-trigger-text {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .more-count-badge {
      background: #e2e8f0;
      color: #334155;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 10px;
    }

    /* Attachments Block & Segmented Control */
    .attachments-block {
      background: #fbfcfe;
    }

    .storage-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .storage-segmented-control {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      .storage-title {
        font-size: 11.5px;
        font-weight: 600;
        color: #334155;
      }
      .segment-pill-group {
        display: inline-flex;
        background: #f1f5f9;
        padding: 2px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        gap: 2px;
      }
      .segment-pill {
        border: none;
        background: transparent;
        font-size: 11px;
        font-weight: 500;
        color: #64748b;
        padding: 4px 10px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
        transition: all 0.15s ease-in-out;
        .pill-icon { font-size: 14px; width: 14px; height: 14px; }
        &:hover { color: #0f172a; }
        &.active {
          background: white;
          color: #059669;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
      }
    }

    .network-select-wrap {
      animation: fadeIn 0.2s ease-in-out;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    .upload-action-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      .upload-btn {
        height: 32px;
        font-size: 11.5px;
        border-color: #cbd5e1;
        color: #334155;
        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; color: #059669; }
        &:hover { background: #f8fafc; border-color: #94a3b8; }
      }
      .upload-hint { font-size: 11px; color: #94a3b8; }
      .uploading-indicator {
        font-size: 11px;
        color: #059669;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .attached-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 2px;
    }

    .att-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      transition: border-color 0.15s, background-color 0.15s;
      &:hover { border-color: #cbd5e1; background: #fafafa; }
      .att-info {
        display: flex;
        align-items: center;
        gap: 8px;
        .file-icon {
          font-size: 18px; width: 18px; height: 18px;
          &.firebase { color: #0284c7; }
          &.network { color: #d97706; }
        }
        .att-names {
          display: flex;
          flex-direction: column;
          .fname { font-size: 11.5px; font-weight: 600; color: #1e293b; }
          .fmeta { font-size: 10px; color: #64748b; }
        }
      }
      .att-actions { display: flex; gap: 4px; }
    }

    .icon-btn-xs {
      width: 26px;
      height: 26px;
      line-height: 26px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    .dialog-actions {
      padding: 12px 22px !important;
      margin: 0 !important;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      flex-shrink: 0;
      gap: 10px;
      .cancel-btn { height: 34px; font-size: 12px; color: #64748b; }
      .submit-btn {
        height: 34px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }
    .text-muted { color: #94a3b8; font-size: 11px; }
  `]
})
export class LetterDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private letterService = inject(LetterService);
  private settingsService = inject(SettingsService);
  private firestoreService = inject(FirestoreService);

  form: FormGroup;
  statuses = ALL_LETTER_STATUSES;
  categories = signal<string[]>(DEFAULT_LETTER_SETTINGS.categories);
  networkLocations = signal<string[]>(DEFAULT_LETTER_SETTINGS.network_storage_locations);
  departments = signal<Department[]>([]);
  systemUsers = signal<AppUser[]>([]);
  existingLetters = signal<Letter[]>([]);

  linkRefSearch = signal<string>('');

  letterSettings = signal<LetterSettings>(DEFAULT_LETTER_SETTINGS);
  storageType: 'firebase' | 'network' = 'firebase';
  selectedNetworkLocation: string = '';
  attachments = signal<LetterAttachment[]>([]);
  isUploading = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  filteredLinkRefs = computed(() => {
    const q = this.linkRefSearch().toLowerCase().trim();
    const letters = this.existingLetters();
    if (!q) {
      return letters.slice(0, 8);
    }
    return letters.filter(l => 
      l.ref_number.toLowerCase().includes(q) ||
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.received_from && l.received_from.toLowerCase().includes(q))
    ).slice(0, 12);
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { letter?: Letter },
    public dialogRef: MatDialogRef<LetterDialogComponent>
  ) {
    const letter = this.data?.letter;
    const initDate = letter?.received_date ? new Date(letter.received_date + 'T00:00:00') : new Date();

    this.form = this.fb.group({
      title: [letter?.title || '', Validators.required],
      ref_number: [letter?.ref_number || '', Validators.required],
      link_ref: [letter?.link_ref || ''],
      received_from: [letter?.received_from || '', Validators.required],
      received_date: [initDate, Validators.required],
      send_to: [letter?.send_to || []],
      assigned_to: [letter?.assigned_to || []],
      category: [letter?.category || 'General Inward'],
      priority: [letter?.priority || 'Normal'],
      status: [letter?.status || 'Received'],
      description: [letter?.description || '']
    });

    if (letter?.link_ref) {
      this.linkRefSearch.set(letter.link_ref);
    }

    if (letter && letter.attachments) {
      this.attachments.set([...letter.attachments]);
    }
  }

  ngOnInit() {
    this.loadSettings();
    this.loadDepartments();
    this.loadUsers();
    this.loadExistingLetters();

    this.form.get('link_ref')?.valueChanges.subscribe(v => {
      this.linkRefSearch.set(v || '');
    });
  }

  loadExistingLetters() {
    this.letterService.getLetters().subscribe(letters => {
      this.existingLetters.set(letters);
    });
  }

  loadSettings() {
    this.letterService.getSettings().subscribe(s => {
      if (s) {
        const merged: LetterSettings = {
          ...DEFAULT_LETTER_SETTINGS,
          ...s,
          ref_prefix: s.ref_prefix ?? DEFAULT_LETTER_SETTINGS.ref_prefix,
          ref_format: s.ref_format ?? DEFAULT_LETTER_SETTINGS.ref_format,
          ref_seq_digits: s.ref_seq_digits ?? DEFAULT_LETTER_SETTINGS.ref_seq_digits,
          ref_next_seq: s.ref_next_seq ?? DEFAULT_LETTER_SETTINGS.ref_next_seq,
          ref_auto_generate: s.ref_auto_generate ?? DEFAULT_LETTER_SETTINGS.ref_auto_generate
        };
        this.letterSettings.set(merged);
        this.categories.set(merged.categories || DEFAULT_LETTER_SETTINGS.categories);
        this.networkLocations.set(merged.network_storage_locations || DEFAULT_LETTER_SETTINGS.network_storage_locations);
        this.storageType = merged.default_storage || 'firebase';
        if (this.networkLocations().length > 0 && !this.selectedNetworkLocation) {
          this.selectedNetworkLocation = this.networkLocations()[0];
        }

        // If this is a new letter registration and auto-generation is enabled and ref_number is blank, populate it
        if (!this.data?.letter) {
          const currentRef = this.form.get('ref_number')?.value;
          if (!currentRef && merged.ref_auto_generate !== false) {
            const generated = generateLetterRefNumber(merged, merged.ref_next_seq || 1);
            this.form.patchValue({ ref_number: generated });
          }
        }
      }
    });
  }

  loadDepartments() {
    this.settingsService.getDepartments().subscribe(depts => {
      this.departments.set(depts);
    });
  }

  loadUsers() {
    this.firestoreService.getCollection<AppUser>('users').subscribe(users => {
      this.systemUsers.set(users);
    });
  }

  onLinkRefInput(event: any) {
    this.linkRefSearch.set(event.target.value || '');
  }

  generateRefNumber() {
    const s = this.letterSettings();
    const generated = generateLetterRefNumber(s, s.ref_next_seq || 1);
    this.form.patchValue({ ref_number: generated });
  }

  async onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    this.isUploading.set(true);
    const refNumber = this.form.get('ref_number')?.value || 'UNREF_' + Date.now();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let storageUrl: string | undefined;

        if (this.storageType === 'firebase') {
          storageUrl = await this.letterService.uploadAttachmentToFirebase(file, refNumber);
        }

        const newAtt: LetterAttachment = {
          id: 'att_' + Date.now() + '_' + i,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          storage_destination: this.storageType,
          storage_url: storageUrl,
          network_path: this.storageType === 'network' ? (this.selectedNetworkLocation + '\\' + file.name) : undefined,
          uploaded_at: Date.now(),
          uploaded_by: 'Officer'
        };

        this.attachments.update(list => [...list, newAtt]);
      }
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      this.isUploading.set(false);
      event.target.value = '';
    }
  }

  removeAttachment(index: number) {
    this.attachments.update(list => list.filter((_, i) => i !== index));
  }

  resolveUserNames(userIds: string[]): string[] {
    const users = this.systemUsers();
    return userIds.map(uid => {
      const u = users.find(x => x.id === uid || x.email === uid);
      return u ? (u.displayName || u.email) : uid;
    });
  }

  getUserName(idOrEmail: string): string {
    if (!idOrEmail) return '';
    const u = this.systemUsers().find(x => x.id === idOrEmail || x.email === idOrEmail);
    return u ? (u.displayName || u.email) : idOrEmail;
  }

  formatDate(d: any): string {
    if (!d) return '';
    if (d instanceof Date) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    if (typeof d === 'string') {
      return d.substring(0, 10);
    }
    return '';
  }

  async save() {
    if (this.form.invalid) return;
    this.isSaving.set(true);

    const val = this.form.value;
    const assignedUserNames = this.resolveUserNames(val.assigned_to || []);

    const payload: Partial<Letter> = {
      title: val.title,
      ref_number: val.ref_number,
      link_ref: val.link_ref || '',
      received_from: val.received_from,
      received_date: this.formatDate(val.received_date),
      send_to: val.send_to || [],
      assigned_to: val.assigned_to || [],
      assigned_user_names: assignedUserNames,
      category: val.category,
      priority: val.priority as LetterPriority,
      status: val.status as LetterStatus,
      description: val.description || '',
      attachments: this.attachments()
    };

    try {
      if (this.data.letter && this.data.letter.id) {
        await this.letterService.updateLetter(this.data.letter.id, payload, 'Updated letter properties via form');
      } else {
        await this.letterService.addLetter(payload as Omit<Letter, 'id'>);
        // Increment next sequence counter in settings if auto-generation is enabled
        const s = this.letterSettings();
        if (s.ref_auto_generate !== false) {
          const nextSeq = (s.ref_next_seq || 1) + 1;
          this.letterService.saveSettings({
            ...s,
            ref_next_seq: nextSeq
          }).catch(err => console.warn('Could not increment reference sequence number:', err));
        }
      }
      this.dialogRef.close(true);
    } catch (err) {
      console.error('Failed to save letter:', err);
    } finally {
      this.isSaving.set(false);
    }
  }
}
