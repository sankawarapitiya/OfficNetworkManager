import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';

import { LetterService } from '../../services/letter.service';
import { 
  LetterSettings, 
  DEFAULT_LETTER_SETTINGS, 
  ALL_LETTER_STATUSES,
  generateLetterRefNumber 
} from '../../models/letter.model';

@Component({
  selector: 'app-letter-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatChipsModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatSelectModule
  ],
  template: `
    <div class="page-container max-w-5xl mx-auto p-4 md:p-6">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Letter Management Settings</h1>
          <p class="page-desc">Configure storage destinations, reference number auto-generation, categories, and workflow rules.</p>
        </div>
        <button mat-flat-button color="primary" [disabled]="isSaving()" (click)="saveSettings()">
          <mat-icon>save</mat-icon> {{ isSaving() ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>

      <!-- Section 1: Reference Number Auto-Generation Format -->
      <mat-card class="settings-card">
        <div class="card-header">
          <mat-icon class="sec-icon">pin</mat-icon>
          <div>
            <h3>Official Reference Number Auto-Generation</h3>
            <span class="sub">Define custom numbering pattern, prefix, sequence padding, and running counters</span>
          </div>
        </div>

        <div class="card-body">
          <!-- Live Preview Banner -->
          <div class="preview-banner">
            <div class="preview-info">
              <span class="preview-label">Live Reference Number Preview:</span>
              <span class="preview-value">{{ previewRefNumber() }}</span>
            </div>
            <span class="preview-badge" [class.enabled]="settings.ref_auto_generate" [class.disabled]="!settings.ref_auto_generate">
              {{ settings.ref_auto_generate ? 'Auto-Generation Active' : 'Auto-Generation Disabled' }}
            </span>
          </div>

          <!-- Enable Toggle -->
          <div class="form-row-toggle">
            <mat-slide-toggle [(ngModel)]="settings.ref_auto_generate" color="primary">
              <span class="toggle-text">Automatically populate Reference No. on new inward letter registration</span>
            </mat-slide-toggle>
          </div>

          <!-- Configuration Fields -->
          <div class="ref-settings-grid">
            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Prefix Code</mat-label>
              <input matInput [(ngModel)]="settings.ref_prefix" placeholder="e.g. LET, ADM, DS/LW">
            </mat-form-field>

            <mat-form-field appearance="outline" class="compact-field format-pattern-field" subscriptSizing="dynamic">
              <mat-label>Format Pattern</mat-label>
              <input matInput [(ngModel)]="settings.ref_format" placeholder="e.g. {PREFIX}/{YYYY}/{MM}/{SEQ}">
            </mat-form-field>

            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Sequence Digits (Padding)</mat-label>
              <mat-select [(ngModel)]="settings.ref_seq_digits">
                <mat-option [value]="2">2 Digits (01, 02..)</mat-option>
                <mat-option [value]="3">3 Digits (001, 002..)</mat-option>
                <mat-option [value]="4">4 Digits (0001, 0002..)</mat-option>
                <mat-option [value]="5">5 Digits (00001..)</mat-option>
                <mat-option [value]="6">6 Digits (000001..)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
              <mat-label>Next Sequence Number</mat-label>
              <input matInput type="number" min="1" [(ngModel)]="settings.ref_next_seq">
            </mat-form-field>
          </div>

          <!-- Available Tokens & Quick Insert -->
          <div class="token-helper-block">
            <span class="helper-title">Click token to append:</span>
            <div class="token-chips">
              <button type="button" class="token-btn" (click)="insertToken('{PREFIX}')">&#123;PREFIX&#125;</button>
              <button type="button" class="token-btn" (click)="insertToken('{YYYY}')">&#123;YYYY&#125;</button>
              <button type="button" class="token-btn" (click)="insertToken('{YY}')">&#123;YY&#125;</button>
              <button type="button" class="token-btn" (click)="insertToken('{MM}')">&#123;MM&#125;</button>
              <button type="button" class="token-btn" (click)="insertToken('{DD}')">&#123;DD&#125;</button>
              <button type="button" class="token-btn" (click)="insertToken('{SEQ}')">&#123;SEQ&#125;</button>
            </div>
          </div>

          <!-- Presets -->
          <div class="preset-helper-block">
            <span class="helper-title">Format Presets:</span>
            <div class="preset-chips">
              <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}/{YYYY}/{MM}/{SEQ}')">
                Monthly (&#123;PREFIX&#125;/&#123;YYYY&#125;/&#123;MM&#125;/&#123;SEQ&#125;)
              </button>
              <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}/{YYYY}/{SEQ}')">
                Annual (&#123;PREFIX&#125;/&#123;YYYY&#125;/&#123;SEQ&#125;)
              </button>
              <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}/{YYYY}/{MM}-{SEQ}')">
                Divisional (&#123;PREFIX&#125;/&#123;YYYY&#125;/&#123;MM&#125;-&#123;SEQ&#125;)
              </button>
              <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}-{YYYY}{MM}-{SEQ}')">
                Hyphenated (&#123;PREFIX&#125;-&#123;YYYY&#125;&#123;MM&#125;-&#123;SEQ&#125;)
              </button>
            </div>
          </div>
        </div>
      </mat-card>

      <!-- Section 1: Storage Destination & Network Locations -->
      <mat-card class="settings-card">
        <div class="card-header">
          <mat-icon class="sec-icon">cloud_sync</mat-icon>
          <div>
            <h3>Storage Destination Configuration</h3>
            <span class="sub">Choose primary document repository and configure local/UNC network shares</span>
          </div>
        </div>

        <div class="card-body">
          <div class="form-group">
            <label class="group-label">Default Storage Destination for Attachments:</label>
            <mat-radio-group [(ngModel)]="settings.default_storage" class="radio-group">
              <mat-radio-button value="firebase" color="primary">
                <strong>Firebase Cloud Storage</strong> (Direct secure cloud storage with encrypted URLs)
              </mat-radio-button>
              <mat-radio-button value="network" color="primary">
                <strong>Network Shared Location</strong> (Internal LAN / UNC network storage share)
              </mat-radio-button>
            </mat-radio-group>
          </div>

          <!-- Network Share Folders List -->
          <div class="network-shares-section">
            <h4 class="sub-heading">Configured Network File Share Locations</h4>
            <p class="tip-text">Predefine UNC paths (e.g. <code>\\\\SERVER\\OfficialLetters\\Inward</code>) that officers can select when logging letters.</p>

            <div class="shares-list">
              <div *ngFor="let loc of settings.network_storage_locations; let i = index" class="share-item">
                <mat-icon class="folder-icon">folder_shared</mat-icon>
                <span class="share-path">{{ loc }}</span>
                <button mat-icon-button color="warn" (click)="removeNetworkLocation(i)" matTooltip="Remove Location">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <!-- Add new share -->
            <div class="add-share-row">
              <mat-form-field appearance="outline" class="share-input compact-field" subscriptSizing="dynamic">
                <mat-label>New Network Share / Folder Path (UNC)</mat-label>
                <input matInput [(ngModel)]="newNetworkLocation" placeholder="e.g. \\\\SERVER\\OfficialLetters\\2026">
                <mat-icon matSuffix>folder</mat-icon>
              </mat-form-field>
              <button mat-stroked-button color="primary" [disabled]="!newNetworkLocation.trim()" (click)="addNetworkLocation()" class="add-btn">
                <mat-icon>add</mat-icon> Add Location
              </button>
            </div>
          </div>
        </div>
      </mat-card>

      <!-- Section 2: Letter Categories -->
      <mat-card class="settings-card">
        <div class="card-header">
          <mat-icon class="sec-icon">category</mat-icon>
          <div>
            <h3>Letter Categories & Classifications</h3>
            <span class="sub">Manage classification labels used to categorize inward correspondence</span>
          </div>
        </div>

        <div class="card-body">
          <div class="chips-container">
            <div *ngFor="let cat of settings.categories; let i = index" class="cat-chip">
              <span>{{ cat }}</span>
              <button mat-icon-button class="del-chip" (click)="removeCategory(i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <div class="add-cat-row">
            <mat-form-field appearance="outline" class="cat-input compact-field" subscriptSizing="dynamic">
              <mat-label>New Category Name</mat-label>
              <input matInput [(ngModel)]="newCategory" placeholder="e.g. Cabinet Memo, Tender Notice">
            </mat-form-field>
            <button mat-stroked-button color="primary" [disabled]="!newCategory.trim()" (click)="addCategory()" class="add-btn">
              <mat-icon>add</mat-icon> Add Category
            </button>
          </div>
        </div>
      </mat-card>

      <!-- Section 3: Workflow Statuses Reference -->
      <mat-card class="settings-card">
        <div class="card-header">
          <mat-icon class="sec-icon">rule</mat-icon>
          <div>
            <h3>Official Workflow Lifecycle Statuses</h3>
            <span class="sub">Standard stages of official letter turnaround</span>
          </div>
        </div>

        <div class="card-body">
          <div class="status-grid">
            <div *ngFor="let s of statuses" class="st-card">
              <span class="st-pill" [ngClass]="s.toLowerCase().replace(' ', '-')">{{ s }}</span>
              <span class="st-desc">{{ getStatusDescription(s) }}</span>
            </div>
          </div>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 14px; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      .page-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
      .page-desc { font-size: 12.5px; color: #64748b; margin: 2px 0 0 0; }
      button { height: 34px; font-size: 12.5px; }
    }
    .settings-card {
      padding: 16px 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
      .sec-icon { color: #059669; font-size: 22px; width: 22px; height: 22px; }
      h3 { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; }
      .sub { font-size: 11px; color: #64748b; }
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
      .group-label { font-size: 12px; font-weight: 700; color: #334155; }
      .radio-group { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; font-size: 12px; }
    }
    .sub-heading { margin: 0 0 2px 0; font-size: 12.5px; font-weight: 700; color: #1e293b; }
    .tip-text { font-size: 11px; color: #64748b; margin: 0 0 10px 0; code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-family: monospace; } }
    .shares-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .share-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      .folder-icon { color: #d97706; margin-right: 6px; font-size: 18px; width: 18px; height: 18px; }
      .share-path { font-family: monospace; font-size: 12px; font-weight: 600; color: #1e293b; flex: 1; }
      button { width: 28px; height: 28px; line-height: 28px; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    }
    .add-share-row {
      display: flex;
      align-items: center;
      gap: 10px;
      .share-input { flex: 1; }
      .add-btn { height: 36px; font-size: 12px; }
    }
    .chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .cat-chip {
      display: inline-flex;
      align-items: center;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 1px 4px 1px 8px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      .del-chip { width: 18px; height: 18px; line-height: 18px; mat-icon { font-size: 12px; width: 12px; height: 12px; } }
    }
    .add-cat-row {
      display: flex;
      align-items: center;
      gap: 10px;
      .cat-input { width: 260px; }
      .add-btn { height: 36px; font-size: 12px; }
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }
    .st-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      .st-desc { font-size: 10.5px; color: #64748b; }
    }
    .st-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 999px;
      display: inline-block;
      width: fit-content;
      &.received { background: #e0f2fe; color: #0369a1; }
      &.in-review { background: #fef3c7; color: #b45309; }
      &.action-required { background: #fee2e2; color: #b91c1c; }
      &.in-progress { background: #f3e8ff; color: #7e22ce; }
      &.completed { background: #dcfce7; color: #15803d; }
      &.dispatched { background: #e0e7ff; color: #4338ca; }
      &.archived { background: #f1f5f9; color: #64748b; }
    }

    /* Reference Number Auto-Generation Settings Styles */
    .preview-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1.5px solid #a7f3d0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 14px;
      .preview-info {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .preview-label {
        font-size: 11.5px;
        font-weight: 600;
        color: #065f46;
      }
      .preview-value {
        font-family: monospace;
        font-size: 15px;
        font-weight: 700;
        color: #047857;
        background: #ffffff;
        padding: 3px 10px;
        border-radius: 6px;
        border: 1px solid #6ee7b7;
        letter-spacing: 0.05em;
      }
      .preview-badge {
        font-size: 10.5px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 999px;
        &.enabled { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
        &.disabled { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
      }
    }

    .form-row-toggle {
      margin-bottom: 14px;
      .toggle-text {
        font-size: 12px;
        font-weight: 600;
        color: #1e293b;
      }
    }

    .ref-settings-grid {
      display: grid;
      grid-template-columns: 160px 1fr 180px 180px;
      gap: 12px;
      margin-bottom: 14px;
      @media (max-width: 900px) {
        grid-template-columns: 1fr 1fr;
      }
      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .token-helper-block, .preset-helper-block {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 10px;
      .helper-title {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        min-width: 130px;
      }
    }

    .token-chips, .preset-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .token-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      font-family: monospace;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.15s;
      &:hover {
        background: #059669;
        color: white;
        border-color: #059669;
      }
    }

    .preset-btn {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
      &:hover {
        background: #eff6ff;
        color: #1d4ed8;
        border-color: #93c5fd;
      }
    }
  `]
})
export class LetterSettingsComponent implements OnInit {
  private letterService = inject(LetterService);

  settings: LetterSettings = { ...DEFAULT_LETTER_SETTINGS };
  statuses = ALL_LETTER_STATUSES;
  newNetworkLocation: string = '';
  newCategory: string = '';
  isSaving = signal<boolean>(false);

  ngOnInit() {
    this.letterService.getSettings().subscribe(s => {
      if (s) {
        this.settings = { 
          ...DEFAULT_LETTER_SETTINGS,
          ...s,
          ref_prefix: s.ref_prefix ?? DEFAULT_LETTER_SETTINGS.ref_prefix,
          ref_format: s.ref_format ?? DEFAULT_LETTER_SETTINGS.ref_format,
          ref_seq_digits: s.ref_seq_digits ?? DEFAULT_LETTER_SETTINGS.ref_seq_digits,
          ref_next_seq: s.ref_next_seq ?? DEFAULT_LETTER_SETTINGS.ref_next_seq,
          ref_auto_generate: s.ref_auto_generate ?? DEFAULT_LETTER_SETTINGS.ref_auto_generate
        };
      }
    });
  }

  previewRefNumber(): string {
    return generateLetterRefNumber(this.settings, this.settings.ref_next_seq || 1);
  }

  insertToken(token: string) {
    if (!this.settings.ref_format) {
      this.settings.ref_format = token;
    } else {
      this.settings.ref_format += '/' + token;
    }
  }

  setFormat(pattern: string) {
    this.settings.ref_format = pattern;
  }

  addNetworkLocation() {
    const loc = this.newNetworkLocation.trim();
    if (!loc) return;
    if (!this.settings.network_storage_locations.includes(loc)) {
      this.settings.network_storage_locations.push(loc);
    }
    this.newNetworkLocation = '';
  }

  removeNetworkLocation(index: number) {
    this.settings.network_storage_locations.splice(index, 1);
  }

  addCategory() {
    const cat = this.newCategory.trim();
    if (!cat) return;
    if (!this.settings.categories.includes(cat)) {
      this.settings.categories.push(cat);
    }
    this.newCategory = '';
  }

  removeCategory(index: number) {
    this.settings.categories.splice(index, 1);
  }

  getStatusDescription(status: string): string {
    switch (status) {
      case 'Received': return 'Newly logged into registry, pending officer review';
      case 'In Review': return 'Under executive/departmental inspection';
      case 'Action Required': return 'Requires specific action or officer response';
      case 'In Progress': return 'Active task execution or draft response underway';
      case 'Completed': return 'Directive fulfilled or official reply dispatched';
      case 'Dispatched': return 'Response delivered and tracking archived';
      case 'Archived': return 'Case file closed and archived for records';
      default: return '';
    }
  }

  async saveSettings() {
    this.isSaving.set(true);
    try {
      await this.letterService.saveSettings(this.settings);
      alert('Letter management settings saved successfully.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Error saving settings.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
