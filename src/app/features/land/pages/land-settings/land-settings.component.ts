import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';

import { LandService } from '../../services/land.service';
import { 
  LandSettings, 
  DEFAULT_LAND_SETTINGS, 
  DEFAULT_LAND_REF_PREFIXES,
  LandRefPrefix,
  generateLandJobRef,
  JobTypeConfig, 
  LandDocTypeConfig, 
  LandVerificationStageConfig,
  FORM_FIELD_DEFINITIONS,
  DEFAULT_FORM_REQUIRED_FIELDS,
  FormFieldDefinition
} from '../../models/land.model';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-land-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSelectModule
  ],
  template: `
    <div class="page-container w-full">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Land Management Configuration</h1>
          <p class="page-desc">Configure dynamic Job Types, required document types, verification stages & checklists, and reference numbering.</p>
        </div>
        <div class="actions-group">
          <button mat-flat-button color="primary" class="save-btn" [disabled]="isSaving()" (click)="saveSettings()">
            <mat-icon>save</mat-icon> {{ isSaving() ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>
      </div>

      <!-- Settings Tabs -->
      <mat-card class="settings-card">
        <mat-tab-group animationDuration="200ms">

          <!-- ============================================== -->
          <!-- TAB 1: JOB TYPES & DYNAMIC WORKFLOWS           -->
          <!-- ============================================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">category</mat-icon> Job Types & Workflows
            </ng-template>

            <div class="tab-content">
              <div class="section-intro">
                <div>
                  <h3 class="sec-title">Configured Land Job Types</h3>
                  <p class="sec-desc">Each Job Type defines its own dynamic set of required documents and verification stages with checklists.</p>
                </div>
                <button mat-flat-button color="primary" (click)="openAddJobTypeModal()">
                  <mat-icon>add</mat-icon> Add New Job Type
                </button>
              </div>

              <!-- List of Job Types -->
              <div class="job-types-grid">
                <div *ngFor="let jt of settings.jobTypes; let jtIdx = index" class="jt-config-card" [class.inactive]="!jt.isActive">
                  <div class="jt-card-top">
                    <div class="jt-title-group">
                      <h4 class="jt-name">{{ jt.name }}</h4>
                      <span class="jt-code">[{{ jt.code }}]</span>
                      <span class="sla-badge">{{ jt.estimatedDays }} days SLA</span>
                    </div>

                    <div class="jt-actions">
                      <mat-slide-toggle [checked]="jt.isActive" (change)="toggleJobTypeActive(jtIdx)" color="primary">
                        {{ jt.isActive ? 'Active' : 'Disabled' }}
                      </mat-slide-toggle>
                      <button mat-icon-button color="primary" (click)="editJobType(jtIdx)" matTooltip="Edit Job Type & Checklists">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deleteJobType(jtIdx)" matTooltip="Delete Job Type">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>

                  <p class="jt-desc">{{ jt.description }}</p>

                  <div class="jt-sub-summaries">
                    <!-- Required Documents Summary -->
                    <div class="sub-summary-box">
                      <span class="box-title">
                        <mat-icon class="sm-icon">description</mat-icon> Required Documents ({{ jt.requiredDocumentTypes.length || 0 }})
                      </span>
                      <ul class="mini-list">
                        <li *ngFor="let doc of jt.requiredDocumentTypes">
                          <span class="bullet" [class.mandatory]="doc.isMandatory">•</span>
                          <span class="text-xs">{{ doc.name }}</span>
                          <span *ngIf="doc.isMandatory" class="mini-req-tag">Required</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Verification Stages Summary -->
                    <div class="sub-summary-box">
                      <span class="box-title">
                        <mat-icon class="sm-icon">fact_check</mat-icon> Verification Stages ({{ jt.verificationStages.length || 0 }})
                      </span>
                      <ul class="mini-list">
                        <li *ngFor="let vs of jt.verificationStages">
                          <span class="bullet">•</span>
                          <span class="text-xs font-medium">{{ vs.stageName }}</span>
                          <span class="mini-role-tag">{{ vs.assignedRole }}</span>
                          <span class="mini-checks-count">({{ vs.checklist.length || 0 }} checks)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>



          <!-- ============================================== -->
          <!-- TAB 2: REFERENCE NUMBERING & MULTIPLE SERIES   -->
          <!-- ============================================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">pin</mat-icon> Reference Numbering & Series
            </ng-template>

            <div class="tab-content">
              <div class="section-intro">
                <div>
                  <h3 class="sec-title">Task Reference Auto-Generation Rules</h3>
                  <p class="sec-desc">Configure reference format with Prefix, Subject Code, Year, File Number, File Version, and Sequential Number. Define multiple reference series with independent sequence counters.</p>
                </div>
              </div>

              <!-- General Reference Generation Form -->
              <div class="ref-fields-grid mt-4">
                <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
                  <mat-label>Default Prefix (Used if none selected)</mat-label>
                  <mat-select [(ngModel)]="settings.defaultJobPrefix" (selectionChange)="onDefaultPrefixChange($event.value)">
                    <mat-option *ngFor="let p of settings.refPrefixes" [value]="p.id || p.code">
                      <strong>{{ p.code }}</strong> - {{ p.label }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="compact-field" subscriptSizing="dynamic">
                  <mat-label>Global Seq Digits (Padding)</mat-label>
                  <mat-select [(ngModel)]="settings.seqDigits">
                    <mat-option [value]="2">2 Digits (01, 02..)</mat-option>
                    <mat-option [value]="3">3 Digits (001, 002..)</mat-option>
                    <mat-option [value]="4">4 Digits (0001, 0002..)</mat-option>
                    <mat-option [value]="5">5 Digits (00001..)</mat-option>
                    <mat-option [value]="6">6 Digits (000001..)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <!-- Format Template String -->
              <mat-form-field appearance="outline" class="w-full mt-3">
                <mat-label>Global Reference Format Template</mat-label>
                <input matInput [(ngModel)]="settings.refFormat" placeholder="e.g. {PREFIX}/{SUBJECT_CODE}/{YYYY}/{FILE_NUMBER}/{FILE_VERSION}/{SEQ}">
                <mat-hint>Tokens will automatically be replaced upon saving or registering new land tasks.</mat-hint>
              </mat-form-field>

              <!-- Available Tokens & Quick Insert -->
              <div class="token-helper-block">
                <span class="helper-title">Click token to append:</span>
                <div class="token-chips">
                  <button type="button" class="token-btn" (click)="insertToken('{PREFIX}')">&#123;PREFIX&#125;</button>
                  <button type="button" class="token-btn" (click)="insertToken('{SUBJECT_CODE}')">&#123;SUBJECT_CODE&#125;</button>
                  <button type="button" class="token-btn" (click)="insertToken('{YYYY}')">&#123;YYYY&#125;</button>
                  <button type="button" class="token-btn" (click)="insertToken('{FILE_NUMBER}')">&#123;FILE_NUMBER&#125;</button>
                  <button type="button" class="token-btn" (click)="insertToken('{FILE_VERSION}')">&#123;FILE_VERSION&#125;</button>
                  <button type="button" class="token-btn" (click)="insertToken('{SEQ}')">&#123;SEQ&#125;</button>
                </div>
              </div>
              
              <!-- Live Preview Card (Moved to bottom) -->
              <div class="preview-banner mt-6">
                <div class="preview-info">
                  <div class="preview-line">
                    <span class="preview-label">Live Generated Reference Preview:</span>
                    <span class="preview-value">{{ sampleGeneratedRef }}</span>
                  </div>
                  <div class="preview-prefix-pills" *ngIf="settings.refPrefixes && settings.refPrefixes.length > 0">
                    <span class="test-prefix-lbl">Test Series:</span>
                    <button type="button" 
                            *ngFor="let p of settings.refPrefixes" 
                            class="preview-pill" 
                            [class.active]="previewPrefixCode === (p.id || p.code)"
                            (click)="previewPrefixCode = p.id || p.code">
                      {{ p.code }} <span class="pill-seq">(#{{ p.nextSeq || 1 }})</span>
                    </button>
                  </div>
                </div>
                <div class="preview-extra">
                  <span class="preview-tag font-mono">Format: {{ settings.refFormat }}</span>
                </div>
              </div>

              <!-- Presets -->
              <div class="preset-helper-block">
                <span class="helper-title">Format Presets:</span>
                <div class="preset-chips">
                  <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}/{SUBJECT_CODE}/{YYYY}/{FILE_NUMBER}/{FILE_VERSION}/{SEQ}')">
                    Full Slash: &#123;PREFIX&#125;/&#123;SUBJECT_CODE&#125;/&#123;YYYY&#125;/&#123;FILE_NUMBER&#125;/&#123;FILE_VERSION&#125;/&#123;SEQ&#125;
                  </button>
                  <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}-{SUBJECT_CODE}-{YYYY}-{FILE_NUMBER}-{FILE_VERSION}-{SEQ}')">
                    Hyphenated: &#123;PREFIX&#125;-&#123;SUBJECT_CODE&#125;-&#123;YYYY&#125;-&#123;FILE_NUMBER&#125;-&#123;FILE_VERSION&#125;-&#123;SEQ&#125;
                  </button>
                  <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}/{YYYY}/{FILE_NUMBER}/{SEQ}')">
                    Standard: &#123;PREFIX&#125;/&#123;YYYY&#125;/&#123;FILE_NUMBER&#125;/&#123;SEQ&#125;
                  </button>
                  <button type="button" class="preset-btn" (click)="setFormat('{PREFIX}-{YYYY}-{SEQ}')">
                    Simple: &#123;PREFIX&#125;-&#123;YYYY&#125;-&#123;SEQ&#125;
                  </button>
                </div>
              </div>

              <!-- Multiple Reference Prefixes Section -->
              <div class="prefixes-section">
                <div class="prefixes-header">
                  <div>
                    <h4 class="sub-heading">Configured Multiple Reference Series</h4>
                    <p class="tip-text">Define separate reference numbers and prefixes with dedicated subject codes, file numbers, file versions, and running sequence counters. Users can select any configured reference series when creating a task.</p>
                  </div>
                </div>

                <!-- Prefix Cards Grid -->
                <div class="prefixes-grid">
                  <div *ngFor="let p of settings.refPrefixes; let pIdx = index" class="prefix-card" [class.is-default]="p.code === settings.defaultJobPrefix">
                    <div class="prefix-card-top">
                      <span class="prefix-code-badge">{{ p.code }}</span>
                      <div class="prefix-actions">
                        <span *ngIf="p.code === settings.defaultJobPrefix" class="default-badge">
                          <mat-icon>verified</mat-icon> Default
                        </span>
                        <button *ngIf="p.code !== settings.defaultJobPrefix" 
                                mat-button 
                                class="set-default-btn" 
                                (click)="setDefaultPrefix(p.code)"
                                matTooltip="Make this the default prefix">
                          Set Default
                        </button>
                        <button mat-icon-button color="warn" (click)="removePrefix(pIdx)" class="sm-del-btn" matTooltip="Remove reference series" [disabled]="settings.refPrefixes && settings.refPrefixes.length <= 1">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </div>

                    <div class="prefix-details">
                      <div class="pfx-detail-row">
                        <span class="pfx-label-title">{{ p.label }}</span>
                      </div>
                      <div class="pfx-meta-chips">
                        <span class="meta-tag">Sub: <strong>{{ p.subjectCode || '-' }}</strong></span>
                        <span class="meta-tag">File: <strong>{{ p.fileNumber || '-' }}</strong></span>
                        <span class="meta-tag">Ver: <strong>{{ p.fileVersion || '-' }}</strong></span>
                      </div>
                      <div class="pfx-meta-chips mt-1" *ngIf="p.format">
                        <span class="meta-tag format-tag">Format: <strong class="font-mono">{{ p.format }}</strong></span>
                      </div>
                      <div class="prefix-seq-row">
                        <span class="seq-lbl">Next Seq No:</span>
                        <input type="number" min="1" [(ngModel)]="p.nextSeq" class="inline-seq-input" matTooltip="Next running sequential number for this series">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Add New Reference Series Form -->
                <div class="add-prefix-form-card">
                  <h4 class="form-title"><mat-icon>library_add</mat-icon> Create New Reference Series</h4>
                  <div class="add-prefix-grid">
                    <mat-form-field appearance="outline" class="compact-field">
                      <mat-label>Prefix Code</mat-label>
                      <input matInput [(ngModel)]="newPrefixCode" placeholder="e.g. LND">
                      <mat-hint>Can be reused with diff suffix</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="compact-field" style="grid-column: span 2;">
                      <mat-label>Series / Classification Label</mat-label>
                      <input matInput [(ngModel)]="newPrefixLabel" placeholder="e.g. Cadastral Survey & Demarcation">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="compact-field">
                      <mat-label>Subject Code</mat-label>
                      <input matInput [(ngModel)]="newPrefixSubjectCode" placeholder="e.g. 04-SUR">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="compact-field">
                      <mat-label>File Number</mat-label>
                      <input matInput [(ngModel)]="newPrefixFileNumber" placeholder="e.g. FN-05">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="compact-field">
                      <mat-label>File Version</mat-label>
                      <input matInput [(ngModel)]="newPrefixFileVersion" placeholder="e.g. V1">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="compact-field">
                      <mat-label>Start Seq</mat-label>
                      <input matInput type="number" min="1" [(ngModel)]="newPrefixSeq">
                    </mat-form-field>
                    
                    <mat-form-field appearance="outline" class="compact-field" style="grid-column: span 2;">
                      <mat-label>Format Override (Optional)</mat-label>
                      <input matInput [(ngModel)]="newPrefixFormat" placeholder="{PREFIX}/{SUBJECT_CODE}/...">
                      <mat-hint>Leave empty to use global template</mat-hint>
                    </mat-form-field>

                    <div style="grid-column: 1 / -1;" class="token-helper-block mt-2">
                      <span class="helper-title">Quick insert:</span>
                      <div class="token-chips">
                        <button type="button" class="token-btn" (click)="insertNewPrefixToken('{PREFIX}')">&#123;PREFIX&#125;</button>
                        <button type="button" class="token-btn" (click)="insertNewPrefixToken('{SUBJECT_CODE}')">&#123;SUBJECT_CODE&#125;</button>
                        <button type="button" class="token-btn" (click)="insertNewPrefixToken('{YYYY}')">&#123;YYYY&#125;</button>
                        <button type="button" class="token-btn" (click)="insertNewPrefixToken('{FILE_NUMBER}')">&#123;FILE_NUMBER&#125;</button>
                        <button type="button" class="token-btn" (click)="insertNewPrefixToken('{FILE_VERSION}')">&#123;FILE_VERSION&#125;</button>
                        <button type="button" class="token-btn" (click)="insertNewPrefixToken('{SEQ}')">&#123;SEQ&#125;</button>
                      </div>
                    </div>
                  </div>
                  <div class="form-actions">
                    <button mat-flat-button color="primary" [disabled]="!newPrefixCode.trim()" (click)="addPrefix()" class="add-pfx-btn">
                      <mat-icon>add</mat-icon> Add Series
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </mat-tab>

          <!-- ============================================== -->
          <!-- TAB 4: FORM REQUIRED FIELDS SELECTION          -->
          <!-- ============================================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">checklist_rtl</mat-icon> Form Required Fields
            </ng-template>

            <div class="tab-content">
              <div class="section-intro">
                <div>
                  <h3 class="sec-title">Task Registration Required Field Selection</h3>
                  <p class="sec-desc">Choose which fields are mandatory (required) versus optional in the "Register New Land Task / Job" intake form.</p>
                </div>
                <div class="quick-bulk-actions">
                  <button mat-stroked-button color="primary" (click)="resetFieldRequirementsToDefault()" matTooltip="Reset all fields to recommended system defaults">
                    <mat-icon>restart_alt</mat-icon> Reset Defaults
                  </button>
                  <button mat-button color="primary" (click)="setAllFieldsRequirement(true)">
                    Mark All Required
                  </button>
                  <button mat-button class="text-gray" (click)="setAllFieldsRequirement(false)">
                    Mark All Optional
                  </button>
                </div>
              </div>

              <!-- Customer Fields Group -->
              <div class="fields-category-section">
                <div class="category-header">
                  <div class="cat-title-wrap">
                    <mat-icon class="cat-icon text-blue">person</mat-icon>
                    <h4>1. Citizen / Customer Information Fields</h4>
                  </div>
                  <span class="count-tag">{{ customerFields.length }} fields</span>
                </div>

                <div class="fields-toggle-grid">
                  <div *ngFor="let field of customerFields" class="field-toggle-card" [class.field-required]="isFieldRequired(field.key)">
                    <div class="field-info">
                      <div class="field-title-row">
                        <mat-icon class="field-icon">{{ getFieldIcon(field.key) }}</mat-icon>
                        <span class="field-label">{{ field.label }}</span>
                      </div>
                      <p class="field-hint">{{ field.hint }}</p>
                    </div>

                    <div class="field-toggle-ctrl">
                      <span class="req-badge" [ngClass]="isFieldRequired(field.key) ? 'badge-required' : 'badge-optional'">
                        {{ isFieldRequired(field.key) ? 'Required *' : 'Optional' }}
                      </span>
                      <mat-slide-toggle [checked]="isFieldRequired(field.key)" (change)="toggleFieldRequired(field.key, $event.checked)" color="primary">
                      </mat-slide-toggle>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cadastral Parcel Fields Group -->
              <div class="fields-category-section mt-6">
                <div class="category-header">
                  <div class="cat-title-wrap">
                    <mat-icon class="cat-icon text-amber">terrain</mat-icon>
                    <h4>2. Cadastral Parcel & Location Details Fields</h4>
                  </div>
                  <span class="count-tag">{{ parcelFields.length }} fields</span>
                </div>

                <div class="fields-toggle-grid">
                  <div *ngFor="let field of parcelFields" class="field-toggle-card" [class.field-required]="isFieldRequired(field.key)">
                    <div class="field-info">
                      <div class="field-title-row">
                        <mat-icon class="field-icon">{{ getFieldIcon(field.key) }}</mat-icon>
                        <span class="field-label">{{ field.label }}</span>
                      </div>
                      <p class="field-hint">{{ field.hint }}</p>
                    </div>

                    <div class="field-toggle-ctrl">
                      <span class="req-badge" [ngClass]="isFieldRequired(field.key) ? 'badge-required' : 'badge-optional'">
                        {{ isFieldRequired(field.key) ? 'Required *' : 'Optional' }}
                      </span>
                      <mat-slide-toggle [checked]="isFieldRequired(field.key)" (change)="toggleFieldRequired(field.key, $event.checked)" color="primary">
                      </mat-slide-toggle>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </mat-tab>

        </mat-tab-group>
      </mat-card>

      <!-- ============================================== -->
      <!-- MODAL: ADD / EDIT JOB TYPE                     -->
      <!-- ============================================== -->
      <div *ngIf="showJobTypeModal" class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title">{{ editingJobTypeIndex !== null ? 'Edit Land Job Type' : 'Add New Land Job Type' }}</h3>
            <button mat-icon-button (click)="closeJobTypeModal()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="modal-body">
            <!-- Basic Job Type Info -->
            <div class="grid-2-col">
              <mat-form-field appearance="outline">
                <mat-label>Job Type Title *</mat-label>
                <input matInput [(ngModel)]="currentModalJobType.name" placeholder="e.g. Commercial Lease Agreement">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Short Code *</mat-label>
                <input matInput [(ngModel)]="currentModalJobType.code" placeholder="e.g. COM-LSE">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Estimated SLA (Days)</mat-label>
                <input matInput type="number" [(ngModel)]="currentModalJobType.estimatedDays" placeholder="e.g. 21">
              </mat-form-field>

              <div class="flex-align-center">
                <mat-slide-toggle [(ngModel)]="currentModalJobType.isActive" color="primary">
                  Active in New Job Wizard
                </mat-slide-toggle>
              </div>
            </div>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Description & Scope</mat-label>
              <textarea matInput rows="2" [(ngModel)]="currentModalJobType.description" placeholder="Brief description of when this land task type is used..."></textarea>
            </mat-form-field>

            <!-- Dynamic Required Documents Configuration -->
            <div class="config-sub-section">
              <div class="sub-sec-header">
                <h4><mat-icon>description</mat-icon> Required Document Types</h4>
                <button mat-stroked-button color="primary" type="button" (click)="addDocTypeToCurrentModal()">
                  <mat-icon>add</mat-icon> Add Document Type
                </button>
              </div>

              <div class="doc-types-table">
                <div *ngFor="let doc of currentModalJobType.requiredDocumentTypes; let dIdx = index" class="modal-doc-row">
                  <mat-form-field appearance="outline" class="flex-2" subscriptSizing="dynamic">
                    <mat-label>Document Name</mat-label>
                    <input matInput [(ngModel)]="doc.name" placeholder="e.g. Deed Copy / Survey Plan">
                  </mat-form-field>

                  <mat-checkbox [(ngModel)]="doc.isMandatory" color="primary">
                    Mandatory
                  </mat-checkbox>

                  <button mat-icon-button color="warn" type="button" (click)="removeDocTypeFromCurrentModal(dIdx)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>
            </div>

            <!-- Dynamic Verification Stages Configuration -->
            <div class="config-sub-section">
              <div class="sub-sec-header">
                <h4><mat-icon>fact_check</mat-icon> Verification Stages & Checklists</h4>
                <button mat-stroked-button color="primary" type="button" (click)="addStageToCurrentModal()">
                  <mat-icon>add</mat-icon> Add Verification Stage
                </button>
              </div>

              <div class="stages-config-list">
                <div *ngFor="let vs of currentModalJobType.verificationStages; let sIdx = index" class="modal-stage-box">
                  <div class="stage-box-top">
                    <mat-form-field appearance="outline" class="flex-2" subscriptSizing="dynamic">
                      <mat-label>Verification Stage Name</mat-label>
                      <input matInput [(ngModel)]="vs.stageName" placeholder="e.g. Physical Boundary Inspection">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="flex-1" subscriptSizing="dynamic">
                      <mat-label>Assigned Role</mat-label>
                      <input matInput [(ngModel)]="vs.assignedRole" placeholder="e.g. Surveyor / Field Officer">
                    </mat-form-field>

                    <button mat-icon-button color="warn" type="button" (click)="removeStageFromCurrentModal(sIdx)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>

                  <!-- Checklist items for this stage -->
                  <div class="checklist-config-wrap">
                    <span class="text-xs font-semibold text-gray-500">CHECKLIST CRITERIA:</span>
                    <div *ngFor="let item of vs.checklist; let iIdx = index; trackBy: trackByIndex" class="check-input-row">
                      <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
                        <input matInput [ngModel]="vs.checklist[iIdx]" (ngModelChange)="vs.checklist[iIdx] = $event" placeholder="e.g. Confirm adjacent owner signatures">
                      </mat-form-field>
                      <button mat-icon-button color="warn" type="button" (click)="removeChecklistItem(sIdx, iIdx)">
                        <mat-icon>remove_circle_outline</mat-icon>
                      </button>
                    </div>

                    <button mat-button color="primary" type="button" (click)="addChecklistItem(sIdx)">
                      <mat-icon>add</mat-icon> Add Checklist Item
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div class="modal-footer">
            <button mat-button (click)="closeJobTypeModal()">Cancel</button>
            <button mat-flat-button color="primary" (click)="saveJobTypeModal()">
              Save Job Type
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .page-title { font-size: 1.5rem; font-weight: 800; margin: 0; color: #0f172a; }
      .page-desc { margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem; }
      .save-btn { background: #0e7490 !important; color: #ffffff !important; font-weight: 600; }
    }

    .settings-card {
      padding: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }

    .tab-content {
      padding: 24px;
    }

    .section-intro {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;

      .sec-title { font-size: 1.1rem; font-weight: 700; margin: 0; color: #0f172a; }
      .sec-desc { font-size: 0.85rem; color: #64748b; margin: 2px 0 0 0; }
    }

    .job-types-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .jt-config-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;

      &.inactive {
        opacity: 0.6;
        background: #f8fafc;
      }

      .jt-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .jt-title-group {
          display: flex;
          align-items: center;
          gap: 8px;

          .jt-name { font-size: 1rem; font-weight: 700; margin: 0; color: #1e293b; }
          .jt-code { font-family: monospace; font-size: 0.8rem; font-weight: 700; color: #4f46e5; }
          .sla-badge { font-size: 0.725rem; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
        }

        .jt-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      }

      .jt-desc {
        font-size: 0.825rem;
        color: #64748b;
        margin: 0 0 14px 0;
      }

      .jt-sub-summaries {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;

        .sub-summary-box {
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 8px;
          padding: 10px 12px;

          .box-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
            .sm-icon { font-size: 14px; width: 14px; height: 14px; }
          }

          .mini-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;

            li {
              display: flex;
              align-items: center;
              gap: 4px;

              .bullet {
                color: #94a3b8;
                font-weight: bold;
                &.mandatory { color: #f59e0b; }
              }
              .mini-req-tag { font-size: 0.65rem; background: #fef3c7; color: #b45309; padding: 1px 4px; border-radius: 3px; font-weight: 700; }
              .mini-role-tag { font-size: 0.65rem; background: #eff6ff; color: #2563eb; padding: 1px 4px; border-radius: 3px; }
              .mini-checks-count { font-size: 0.65rem; color: #94a3b8; }
            }
          }
        }
      }
    }



    /* General & Reference Setting Styles */
    .max-w-4xl { max-width: 56rem; }
    .grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .max-w-2xl { max-width: 48rem; }

    .preview-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1.5px solid #a7f3d0;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 18px;
      &.mt-6 { margin-top: 24px; margin-bottom: 0px; }

      .preview-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .preview-line {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        .preview-label { font-size: 11.5px; font-weight: 700; color: #065f46; }
        .preview-value {
          font-family: monospace;
          font-size: 15px;
          font-weight: 800;
          color: #047857;
          background: #ffffff;
          padding: 4px 12px;
          border-radius: 6px;
          border: 1px solid #6ee7b7;
          letter-spacing: 0.05em;
        }
      }
      .preview-prefix-pills {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        .test-prefix-lbl { font-size: 10.5px; font-weight: 600; color: #047857; }
        .preview-pill {
          background: white;
          border: 1px solid #a7f3d0;
          color: #065f46;
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          .pill-seq { font-size: 9.5px; opacity: 0.75; }
          &:hover { border-color: #059669; color: #059669; }
          &.active { background: #059669; color: white; border-color: #059669; }
        }
      }
      .preview-extra {
        .preview-tag {
          font-size: 11px;
          color: #065f46;
          background: #d1fae5;
          padding: 4px 10px;
          border-radius: 6px;
        }
      }
    }

    .ref-fields-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;
      &.mt-4 { margin-top: 24px; margin-bottom: 24px; }
    }

    .token-helper-block, .preset-helper-block {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
      .helper-title {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        min-width: 120px;
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
        background: #0284c7;
        color: white;
        border-color: #0284c7;
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

    /* Prefixes Section */
    .prefixes-section {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      flex-direction: column;
      gap: 14px;

      .sub-heading {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
      }
      .tip-text {
        margin: 3px 0 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }
    }

    .prefixes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }

    .prefix-card {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.15s;

      &.is-default {
        background: #f0fdf4;
        border-color: #86efac;
      }

      .prefix-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .prefix-code-badge {
          font-family: monospace;
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .prefix-actions {
          display: flex;
          align-items: center;
          gap: 4px;

          .default-badge {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 11px;
            font-weight: 700;
            color: #15803d;
            background: #dcfce7;
            padding: 2px 7px;
            border-radius: 999px;
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }

          .set-default-btn {
            font-size: 11px;
            color: #64748b;
            padding: 0 6px;
            height: 24px;
            line-height: 24px;
          }

          .sm-del-btn {
            width: 28px;
            height: 28px;
            line-height: 28px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
        }
      }

      .prefix-details {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .pfx-label-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1e293b;
        }

        .pfx-meta-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          &.mt-1 { margin-top: 6px; }

          .meta-tag {
            font-size: 10px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
            color: #475569;

            &.format-tag {
              background: #e0f2fe;
              color: #0369a1;
              border-color: #bae6fd;
            }
          }
        }

        .prefix-seq-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #64748b;

          .inline-seq-input {
            width: 70px;
            padding: 2px 6px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            font-weight: 700;
            color: #0f172a;
          }
        }
      }
    }

    .add-prefix-form-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-top: 20px;

      .form-title {
        margin: 0 0 16px 0;
        font-size: 1rem;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 8px;
        mat-icon { color: #0284c7; }
      }

      .add-prefix-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 24px;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }

      .w-24 { width: 90px; }
      .add-pfx-btn { height: 42px; font-weight: 600; }
    }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-card {
      background: #ffffff;
      border-radius: 14px;
      width: 800px;
      max-width: 92vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-bottom: 1px solid #e2e8f0;
        .modal-title { margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a; }
      }

      .modal-body {
        padding: 20px 24px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 24px;
        border-top: 1px solid #e2e8f0;
      }
    }

    .config-sub-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;

      .sub-sec-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 6px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #0284c7; }
        }
      }
    }

    .modal-doc-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      .flex-2 { flex: 2; }
    }

    .stages-config-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .modal-stage-box {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 12px;

        .stage-box-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          .flex-2 { flex: 2; }
          .flex-1 { flex: 1; }
        }

        .checklist-config-wrap {
          padding-left: 8px;

          .check-input-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
          }
        }
      }
    }

    .flex-align-center {
      display: flex;
      align-items: center;
    }

    .quick-bulk-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .fields-category-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;

      &.mt-6 {
        margin-top: 24px;
      }

      .category-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px solid #e2e8f0;

        .cat-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;

          .cat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }

          h4 {
            margin: 0;
            font-size: 1rem;
            font-weight: 700;
            color: #0f172a;
          }
        }

        .count-tag {
          font-size: 0.75rem;
          background: #e2e8f0;
          color: #475569;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 600;
        }
      }
    }

    .fields-toggle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .field-toggle-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      transition: all 0.2s ease;

      &.field-required {
        border-color: #cbd5e1;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
      }

      .field-info {
        flex: 1;
        margin-right: 12px;

        .field-title-row {
          display: flex;
          align-items: center;
          gap: 8px;

          .field-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #64748b;
          }

          .field-label {
            font-weight: 700;
            font-size: 0.88rem;
            color: #1e293b;
          }
        }

        .field-hint {
          margin: 2px 0 0 26px;
          font-size: 0.775rem;
          color: #64748b;
          line-height: 1.3;
        }
      }

      .field-toggle-ctrl {
        display: flex;
        align-items: center;
        gap: 10px;

        .req-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          white-space: nowrap;

          &.badge-required {
            background: #fee2e2;
            color: #b91c1c;
          }

          &.badge-optional {
            background: #f1f5f9;
            color: #64748b;
          }
        }
      }
    }
  `]
})
export class LandSettingsComponent implements OnInit {
  private landService = inject(LandService);
  private notif = inject(NotificationService);

  settings: LandSettings = { ...DEFAULT_LAND_SETTINGS };
  isSaving = signal<boolean>(false);

  // Modal State
  showJobTypeModal = false;
  editingJobTypeIndex: number | null = null;
  currentModalJobType: JobTypeConfig = this.getEmptyJobType();

  // Reference Series State
  previewPrefixCode: string = '';
  newPrefixCode: string = '';
  newPrefixLabel: string = '';
  newPrefixSubjectCode: string = '04';
  newPrefixFileNumber: string = 'FN-01';
  newPrefixFileVersion: string = 'V1';
  newPrefixFormat: string = '';
  newPrefixSeq: number = 1;

  get sampleGeneratedRef(): string {
    const chosenPfx = this.previewPrefixCode || this.settings.defaultJobPrefix || 'LND';
    return generateLandJobRef(this.settings, {
      prefixCode: chosenPfx
    });
  }

  ngOnInit() {
    this.landService.getSettings().subscribe({
      next: (s) => {
        this.settings = { ...DEFAULT_LAND_SETTINGS, ...s };
        if (!this.settings.refPrefixes || this.settings.refPrefixes.length === 0) {
          this.settings.refPrefixes = [...DEFAULT_LAND_REF_PREFIXES];
        }
        if (!this.previewPrefixCode) {
          this.previewPrefixCode = this.settings.defaultJobPrefix || 'LND';
        }
      }
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  // --- Reference Series & Tokens ---
  insertToken(token: string) {
    if (!this.settings.refFormat) {
      this.settings.refFormat = token;
    } else {
      this.settings.refFormat += (this.settings.refFormat.endsWith('/') || this.settings.refFormat.endsWith('-') ? '' : '/') + token;
    }
  }

  insertNewPrefixToken(token: string) {
    if (!this.newPrefixFormat) {
      this.newPrefixFormat = token;
    } else {
      this.newPrefixFormat += (this.newPrefixFormat.endsWith('/') || this.newPrefixFormat.endsWith('-') ? '' : '/') + token;
    }
  }

  setFormat(format: string) {
    this.settings.refFormat = format;
  }

  onDefaultPrefixChange(idOrCode: string) {
    this.previewPrefixCode = idOrCode;
    const pfx = this.settings.refPrefixes?.find(p => (p.id || p.code) === idOrCode);
    if (pfx) {
      if (pfx.subjectCode) this.settings.subjectCode = pfx.subjectCode;
      if (pfx.fileNumber) this.settings.fileNumber = pfx.fileNumber;
      if (pfx.fileVersion) this.settings.fileVersion = pfx.fileVersion;
    }
  }

  async setDefaultPrefix(idOrCode: string) {
    this.settings.defaultJobPrefix = idOrCode;
    this.onDefaultPrefixChange(idOrCode);
    await this.saveSettings(true, `Reference series set as default.`);
  }

  async addPrefix() {
    const code = this.newPrefixCode.trim().toUpperCase();
    if (!code) return;

    if (!this.settings.refPrefixes) {
      this.settings.refPrefixes = [];
    }

    const sub = this.newPrefixSubjectCode.trim() || '04';
    const fnum = this.newPrefixFileNumber.trim() || 'FN-01';
    const fver = this.newPrefixFileVersion.trim() || 'V1';

    // Uniqueness is based on the combination of code and suffixes
    if (this.settings.refPrefixes.some(p => p.code === code && p.subjectCode === sub && p.fileNumber === fnum && p.fileVersion === fver)) {
      this.notif.warning(`Reference series "${code}/${sub}/${fnum}/${fver}" already exists.`);
      return;
    }

    const newId = `${code}-${sub}-${fnum}-${fver}-${Date.now()}`;

    const newPrefix: LandRefPrefix = {
      id: newId,
      code,
      label: this.newPrefixLabel.trim() || code,
      subjectCode: sub,
      fileNumber: fnum,
      fileVersion: fver,
      format: this.newPrefixFormat.trim() || undefined,
      nextSeq: Number(this.newPrefixSeq) || 1
    };

    this.settings.refPrefixes.push(newPrefix);
    this.previewPrefixCode = newId;

    // Reset inputs
    this.newPrefixCode = '';
    this.newPrefixLabel = '';
    this.newPrefixSubjectCode = '04';
    this.newPrefixFileNumber = 'FN-01';
    this.newPrefixFileVersion = 'V1';
    this.newPrefixFormat = '';
    this.newPrefixSeq = 1;

    await this.saveSettings(true, `Reference series "${code}" added and persisted!`);
  }

  async removePrefix(idx: number) {
    if (!this.settings.refPrefixes || this.settings.refPrefixes.length <= 1) {
      this.notif.warning('At least one reference prefix must remain configured.');
      return;
    }

    const removed = this.settings.refPrefixes[idx];
    const removedId = removed.id || removed.code;
    this.settings.refPrefixes.splice(idx, 1);

    if (this.settings.defaultJobPrefix === removedId) {
      const nextDefault = this.settings.refPrefixes[0];
      this.settings.defaultJobPrefix = nextDefault.id || nextDefault.code;
      this.previewPrefixCode = this.settings.defaultJobPrefix;
    } else if (this.previewPrefixCode === removedId) {
      this.previewPrefixCode = this.settings.defaultJobPrefix;
    }

    await this.saveSettings(true, `Reference series "${removed.code}" removed.`);
  }



  // --- Job Types ---
  async toggleJobTypeActive(idx: number) {
    const jt = this.settings.jobTypes[idx];
    jt.isActive = !jt.isActive;
    await this.saveSettings(true, `Job Type "${jt.name}" marked as ${jt.isActive ? 'Active' : 'Disabled'}.`);
  }

  async deleteJobType(idx: number) {
    const jt = this.settings.jobTypes[idx];
    if (confirm(`Delete job type "${jt.name}"?`)) {
      this.settings.jobTypes.splice(idx, 1);
      await this.saveSettings(true, `Job Type "${jt.name}" deleted.`);
    }
  }

  openAddJobTypeModal() {
    this.editingJobTypeIndex = null;
    this.currentModalJobType = this.getEmptyJobType();
    this.showJobTypeModal = true;
  }

  editJobType(idx: number) {
    this.editingJobTypeIndex = idx;
    // Deep copy to prevent unintended live edits
    this.currentModalJobType = JSON.parse(JSON.stringify(this.settings.jobTypes[idx]));
    this.showJobTypeModal = true;
  }

  closeJobTypeModal() {
    this.showJobTypeModal = false;
    this.editingJobTypeIndex = null;
  }

  addDocTypeToCurrentModal() {
    this.currentModalJobType.requiredDocumentTypes.push({
      id: 'doc_' + Date.now(),
      name: '',
      code: '',
      isMandatory: true,
      description: ''
    });
  }

  removeDocTypeFromCurrentModal(idx: number) {
    this.currentModalJobType.requiredDocumentTypes.splice(idx, 1);
  }

  addStageToCurrentModal() {
    this.currentModalJobType.verificationStages.push({
      id: 'vs_' + Date.now(),
      stageName: '',
      assignedRole: 'Field Officer',
      isMandatory: true,
      checklist: ['']
    });
  }

  removeStageFromCurrentModal(idx: number) {
    this.currentModalJobType.verificationStages.splice(idx, 1);
  }

  addChecklistItem(stageIdx: number) {
    this.currentModalJobType.verificationStages[stageIdx].checklist.push('');
  }

  removeChecklistItem(stageIdx: number, itemIdx: number) {
    this.currentModalJobType.verificationStages[stageIdx].checklist.splice(itemIdx, 1);
  }

  async saveJobTypeModal() {
    if (!this.currentModalJobType.name.trim()) {
      this.notif.warning('Please enter a Job Type Title');
      return;
    }
    if (!this.currentModalJobType.code.trim()) {
      this.notif.warning('Please enter a Short Code');
      return;
    }

    const savedName = this.currentModalJobType.name.trim();

    if (this.editingJobTypeIndex !== null) {
      this.settings.jobTypes[this.editingJobTypeIndex] = { ...this.currentModalJobType };
    } else {
      this.settings.jobTypes.push({
        ...this.currentModalJobType,
        id: 'jt_' + Date.now()
      });
    }

    this.closeJobTypeModal();

    // Persist immediately to database & local cache
    await this.saveSettings(true, `Job Type "${savedName}" saved and persisted successfully!`);
  }

  private getEmptyJobType(): JobTypeConfig {
    return {
      id: 'jt_' + Date.now(),
      name: '',
      code: '',
      description: '',
      estimatedDays: 14,
      isActive: true,
      requiredDocumentTypes: [
        { id: 'doc_' + Date.now(), name: 'Title Deed Extract', isMandatory: true }
      ],
      verificationStages: [
        { id: 'vs_' + Date.now(), stageName: 'Field Inspection', assignedRole: 'Field Officer', isMandatory: true, checklist: ['Verify physical boundaries'] }
      ]
    };
  }

  async saveSettings(showToast = true, customMsg?: string) {
    this.isSaving.set(true);
    try {
      await this.landService.saveSettings(this.settings);
      if (showToast) {
        this.notif.success(customMsg || 'Land Management configuration saved successfully!');
      }
    } catch (e: any) {
      this.notif.error('Failed to save settings: ' + (e?.message || 'Server error'));
    } finally {
      this.isSaving.set(false);
    }
  }

  // --- Form Required Fields Management ---
  formFieldDefs = FORM_FIELD_DEFINITIONS;

  get customerFields(): FormFieldDefinition[] {
    return this.formFieldDefs.filter(f => f.category === 'Customer');
  }

  get parcelFields(): FormFieldDefinition[] {
    return this.formFieldDefs.filter(f => f.category === 'Parcel');
  }

  isFieldRequired(key: string): boolean {
    if (!this.settings.formRequiredFields) {
      this.settings.formRequiredFields = { ...DEFAULT_FORM_REQUIRED_FIELDS };
    }
    return this.settings.formRequiredFields[key] !== false;
  }

  async toggleFieldRequired(key: string, required: boolean) {
    if (!this.settings.formRequiredFields) {
      this.settings.formRequiredFields = { ...DEFAULT_FORM_REQUIRED_FIELDS };
    }
    this.settings.formRequiredFields[key] = required;
    const def = this.formFieldDefs.find(f => f.key === key);
    const label = def?.label || key;
    await this.saveSettings(true, `Field "${label}" marked as ${required ? 'Required' : 'Optional'}`);
  }

  async resetFieldRequirementsToDefault() {
    this.settings.formRequiredFields = { ...DEFAULT_FORM_REQUIRED_FIELDS };
    await this.saveSettings(true, 'Form field requirements reset to standard defaults');
  }

  async setAllFieldsRequirement(required: boolean) {
    const updated: Record<string, boolean> = {};
    this.formFieldDefs.forEach(f => {
      updated[f.key] = required;
    });
    this.settings.formRequiredFields = updated;
    await this.saveSettings(true, `All fields set to ${required ? 'Required' : 'Optional'}`);
  }

  getFieldIcon(key: string): string {
    switch (key) {
      case 'customerName': return 'person';
      case 'customerNic': return 'badge';
      case 'customerPhone': return 'phone';
      case 'customerAddress': return 'home';
      case 'customerEmail': return 'email';
      case 'division': return 'place';
      case 'deedNumber': return 'description';
      case 'planNumber': return 'map';
      case 'lotNumber': return 'domain';
      case 'locationAddress': return 'location_on';
      case 'extentText': return 'straighten';
      case 'sizeSqm': return 'square_foot';
      case 'landName': return 'label';
      case 'gramaNiladhariDivision': return 'holiday_village';
      case 'gpsCoordinates': return 'gps_fixed';
      case 'priority': return 'flag';
      case 'initialNotes': return 'edit_note';
      default: return 'help_outline';
    }
  }
}
