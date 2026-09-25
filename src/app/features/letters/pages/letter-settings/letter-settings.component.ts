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

import { LetterService } from '../../services/letter.service';
import { LetterSettings, DEFAULT_LETTER_SETTINGS, ALL_LETTER_STATUSES } from '../../models/letter.model';

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
    MatTooltipModule
  ],
  template: `
    <div class="page-container max-w-5xl mx-auto p-4 md:p-6">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Letter Management Settings</h1>
          <p class="page-desc">Configure storage destinations, network shares, letter categories, and workflow rules.</p>
        </div>
        <button mat-flat-button color="primary" [disabled]="isSaving()" (click)="saveSettings()">
          <mat-icon>save</mat-icon> {{ isSaving() ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>

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
        this.settings = { ...s };
      }
    });
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
