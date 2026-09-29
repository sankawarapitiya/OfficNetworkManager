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

import { LandService } from '../../services/land.service';
import { 
  LandSettings, 
  DEFAULT_LAND_SETTINGS, 
  JobTypeConfig, 
  LandDocTypeConfig, 
  LandVerificationStageConfig 
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
    MatTooltipModule
  ],
  template: `
    <div class="page-container w-full">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Land Management Configuration</h1>
          <p class="page-desc">Configure dynamic Job Types, required document types, verification stages & checklists, and administrative divisions.</p>
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
          <!-- TAB 2: ADMINISTRATIVE DIVISIONS               -->
          <!-- ============================================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">holiday_village</mat-icon> Administrative Divisions
            </ng-template>

            <div class="tab-content">
              <div class="section-intro">
                <div>
                  <h3 class="sec-title">Divisional Secretariats / Boundaries</h3>
                  <p class="sec-desc">Manage regional divisions available during Stage 1 parcel filing and reporting.</p>
                </div>
              </div>

              <!-- Add New Division Box -->
              <div class="add-division-box">
                <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
                  <mat-label>New Administrative Division Name</mat-label>
                  <input matInput [(ngModel)]="newDivisionName" placeholder="e.g. Northern Central Division">
                </mat-form-field>
                <button mat-flat-button color="primary" [disabled]="!newDivisionName.trim()" (click)="addDivision()">
                  <mat-icon>add_location</mat-icon> Add Division
                </button>
              </div>

              <!-- Divisions List -->
              <div class="divisions-list">
                <div *ngFor="let div of settings.divisions; let dIdx = index" class="division-item">
                  <div class="div-left">
                    <mat-icon class="div-icon">place</mat-icon>
                    <span class="div-name">{{ div }}</span>
                  </div>
                  <button mat-icon-button color="warn" (click)="removeDivision(dIdx)" matTooltip="Remove Division">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- ============================================== -->
          <!-- TAB 3: REFERENCE NUMBERING & GENERAL           -->
          <!-- ============================================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">pin</mat-icon> Reference Numbering & General
            </ng-template>

            <div class="tab-content max-w-2xl">
              <div class="section-intro">
                <div>
                  <h3 class="sec-title">Reference Auto-Generation Rules</h3>
                  <p class="sec-desc">Format syntax for assigning cadastral task reference numbers.</p>
                </div>
              </div>

              <div class="grid-2-col">
                <mat-form-field appearance="outline">
                  <mat-label>Prefix Code</mat-label>
                  <input matInput [(ngModel)]="settings.defaultJobPrefix" placeholder="e.g. LND">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Default SLA Days</mat-label>
                  <input matInput type="number" [(ngModel)]="settings.defaultSlaDays" placeholder="e.g. 21">
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Reference Format Template</mat-label>
                <input matInput [(ngModel)]="settings.refFormat" placeholder="e.g. {PREFIX}-{YYYY}-{SEQ}">
                <mat-hint>Supported tokens: &#123;PREFIX&#125;, &#123;YYYY&#125;, &#123;SEQ&#125;</mat-hint>
              </mat-form-field>

              <div class="sample-ref-box">
                <span class="label">Sample Next Generated Reference:</span>
                <span class="sample-ref font-mono font-bold">{{ sampleGeneratedRef }}</span>
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

    /* Divisions Management */
    .add-division-box {
      display: flex;
      gap: 12px;
      align-items: center;
      max-width: 600px;
      margin-bottom: 20px;
    }

    .divisions-list {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;

      @media (max-width: 768px) { grid-template-columns: 1fr; }

      .division-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 14px;

        .div-left {
          display: flex;
          align-items: center;
          gap: 8px;
          .div-icon { color: #0284c7; }
          .div-name { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
        }
      }
    }

    /* General */
    .grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .max-w-2xl { max-width: 48rem; }
    .sample-ref-box {
      margin-top: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      .label { font-size: 0.85rem; color: #64748b; }
      .sample-ref { font-size: 1.1rem; color: #0f172a; }
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
  `]
})
export class LandSettingsComponent implements OnInit {
  private landService = inject(LandService);
  private notif = inject(NotificationService);

  settings: LandSettings = { ...DEFAULT_LAND_SETTINGS };
  isSaving = signal<boolean>(false);
  newDivisionName: string = '';

  // Modal State
  showJobTypeModal = false;
  editingJobTypeIndex: number | null = null;
  currentModalJobType: JobTypeConfig = this.getEmptyJobType();

  get sampleGeneratedRef(): string {
    const prefix = this.settings.defaultJobPrefix || 'LND';
    const year = new Date().getFullYear();
    const seq = String(this.settings.nextSeq || 1).padStart(4, '0');
    return (this.settings.refFormat || '{PREFIX}-{YYYY}-{SEQ}')
      .replace('{PREFIX}', prefix)
      .replace('{YYYY}', String(year))
      .replace('{SEQ}', seq);
  }

  ngOnInit() {
    this.landService.getSettings().subscribe({
      next: (s) => {
        this.settings = { ...DEFAULT_LAND_SETTINGS, ...s };
      }
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  // --- Divisions ---
  addDivision() {
    const val = this.newDivisionName.trim();
    if (!val) return;
    if (this.settings.divisions.includes(val)) {
      this.notif.warning('This division already exists.');
      return;
    }
    this.settings.divisions.push(val);
    this.newDivisionName = '';
  }

  removeDivision(idx: number) {
    this.settings.divisions.splice(idx, 1);
  }

  // --- Job Types ---
  toggleJobTypeActive(idx: number) {
    this.settings.jobTypes[idx].isActive = !this.settings.jobTypes[idx].isActive;
  }

  deleteJobType(idx: number) {
    if (confirm(`Delete job type "${this.settings.jobTypes[idx].name}"?`)) {
      this.settings.jobTypes.splice(idx, 1);
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

  saveJobTypeModal() {
    if (!this.currentModalJobType.name.trim()) {
      this.notif.warning('Please enter a Job Type Title');
      return;
    }
    if (!this.currentModalJobType.code.trim()) {
      this.notif.warning('Please enter a Short Code');
      return;
    }

    if (this.editingJobTypeIndex !== null) {
      this.settings.jobTypes[this.editingJobTypeIndex] = { ...this.currentModalJobType };
    } else {
      this.settings.jobTypes.push({
        ...this.currentModalJobType,
        id: 'jt_' + Date.now()
      });
    }

    this.closeJobTypeModal();
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

  async saveSettings() {
    this.isSaving.set(true);
    try {
      await this.landService.saveSettings(this.settings);
      this.notif.success('Land Management configuration saved successfully!');
    } catch (e: any) {
      this.notif.error('Failed to save settings: ' + (e?.message || 'Server error'));
    } finally {
      this.isSaving.set(false);
    }
  }
}
