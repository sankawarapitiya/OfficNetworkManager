import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LandJob, LandJobStatus } from '../../models/land.model';
import { LandService } from '../../services/land.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LandJobDialogComponent } from '../land-job-dialog/land-job-dialog.component';

@Component({
  selector: 'app-land-job-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="status-indicator-box" [ngClass]="job.status.toLowerCase()">
            <mat-icon>{{ getStageIcon(job.status) }}</mat-icon>
          </div>
          <div>
            <div class="title-row">
              <span class="job-ref">{{ job.jobRef }}</span>
              <span class="job-type-pill">{{ job.jobTypeName }}</span>
              <span class="priority-pill" [ngClass]="job.priority.toLowerCase()">{{ job.priority }}</span>
            </div>
            <p class="subtitle">{{ job.customerName }} • {{ job.division }} • Lot {{ job.lotNumber }} (Plan {{ job.planNumber }})</p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button color="primary" class="mr-2" (click)="openInWizard()" matTooltip="Open full 4-stage workflow wizard to update documents, checklist or completion">
            <mat-icon>edit_document</mat-icon> Edit in Wizard
          </button>
          <button mat-icon-button (click)="close()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Quick Stage Action Bar -->
      <div class="stage-flow-bar">
        <div class="current-stage-info">
          <span class="label">CURRENT STAGE:</span>
          <span class="stage-tag" [ngClass]="job.status.toLowerCase()">{{ job.status }}</span>
        </div>

        <div class="advance-group">
          <button *ngIf="job.status === 'Initial'" mat-flat-button color="primary" (click)="advanceStage('Documentation')">
            <mat-icon>arrow_forward</mat-icon> Advance to Documentation
          </button>
          <button *ngIf="job.status === 'Documentation'" mat-flat-button color="accent" (click)="advanceStage('Verification')">
            <mat-icon>arrow_forward</mat-icon> Advance to Verification
          </button>
          <button *ngIf="job.status === 'Verification'" mat-flat-button color="primary" class="btn-success" (click)="advanceStage('Completed')">
            <mat-icon>check_circle</mat-icon> Finalize & Complete Job
          </button>

          <mat-form-field appearance="outline" class="quick-status-field" subscriptSizing="dynamic">
            <mat-label>Change Stage</mat-label>
            <mat-select [ngModel]="job.status" (selectionChange)="onStageSelectChange($event.value)">
              <mat-option value="Initial">Initial</mat-option>
              <mat-option value="Documentation">Documentation</mat-option>
              <mat-option value="Verification">Verification</mat-option>
              <mat-option value="Completed">Completed</mat-option>
              <mat-option value="On Hold">On Hold</mat-option>
              <mat-option value="Rejected">Rejected</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <!-- Detail Tabs -->
      <mat-dialog-content class="content-scroll">
        <mat-tab-group animationDuration="200ms">
          
          <!-- TAB 1: Dossier Overview -->
          <mat-tab label="Dossier & Land Profile">
            <div class="tab-pane">
              <div class="info-card">
                <h4 class="card-heading"><mat-icon>person</mat-icon> Customer Information</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">Full Name</span>
                    <span class="val font-semibold">{{ job.customerName }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">National Identity Card (NIC)</span>
                    <span class="val font-mono">{{ job.customerNic }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Contact Phone</span>
                    <span class="val">{{ job.customerPhone }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Email Address</span>
                    <span class="val">{{ job.customerEmail || 'N/A' }}</span>
                  </div>
                  <div class="info-item span-2">
                    <span class="label">Residential Address</span>
                    <span class="val">{{ job.customerAddress }}</span>
                  </div>
                </div>
              </div>

              <div class="info-card">
                <h4 class="card-heading"><mat-icon>terrain</mat-icon> Cadastral Parcel Details</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">Deed Number</span>
                    <span class="val font-mono font-semibold">{{ job.deedNumber }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Cadastral Plan Number</span>
                    <span class="val font-mono font-semibold">{{ job.planNumber }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Lot / Parcel Number</span>
                    <span class="val font-mono font-semibold">{{ job.lotNumber }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Administrative Division</span>
                    <span class="val font-semibold text-indigo">{{ job.division }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Extent / Land Area</span>
                    <span class="val">{{ job.extentText || (job.sizeSqm ? (job.sizeSqm + ' sq.m') : 'N/A') }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Parcel / Estate Name</span>
                    <span class="val">{{ job.landName || 'N/A' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">GN Division</span>
                    <span class="val">{{ job.gramaNiladhariDivision || 'N/A' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">GPS Coordinates</span>
                    <span class="val">{{ job.gpsCoordinates || 'N/A' }}</span>
                  </div>
                  <div class="info-item span-2">
                    <span class="label">Physical Land Location Address</span>
                    <span class="val">{{ job.locationAddress }}</span>
                  </div>
                </div>
              </div>

              <div class="info-card" *ngIf="job.initialNotes">
                <h4 class="card-heading"><mat-icon>notes</mat-icon> Initial Notes</h4>
                <p class="notes-text">{{ job.initialNotes }}</p>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 2: Documentation Checklist -->
          <mat-tab label="Required Documentation">
            <div class="tab-pane">
              <div class="docs-list">
                <div *ngFor="let doc of job.documents; let i = index" class="doc-card">
                  <div class="doc-check-side">
                    <mat-checkbox [checked]="doc.received || false" (change)="toggleDocReceivedInDetail(i, $event.checked)" color="primary">
                      <span class="text-xs font-semibold" [class.text-green]="doc.received">{{ doc.received ? 'Received' : 'Not Received' }}</span>
                    </mat-checkbox>
                  </div>

                  <div class="doc-main">
                    <div class="doc-title-row">
                      <span class="doc-title">{{ doc.docTypeName }}</span>
                      <span *ngIf="doc.isMandatory" class="chip-req">Required</span>
                    </div>

                    <div class="doc-meta-row">
                      <span class="doc-status" [ngClass]="doc.status.toLowerCase()">
                        <mat-icon>{{ (doc.status === 'Uploaded' || doc.received) ? 'check_circle' : 'hourglass_top' }}</mat-icon>
                        {{ doc.status }}
                      </span>
                      <span *ngIf="doc.fileName" class="doc-filename">
                        <mat-icon>attach_file</mat-icon> {{ doc.fileName }}
                      </span>
                    </div>

                    <p *ngIf="doc.remarks" class="doc-note">Note: {{ doc.remarks }}</p>
                  </div>

                  <div class="doc-actions">
                    <a *ngIf="doc.fileUrl" [href]="doc.fileUrl" target="_blank" mat-stroked-button color="primary">
                      <mat-icon>visibility</mat-icon> View
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 3: Verification Stages -->
          <mat-tab label="Verification & Field Inspection">
            <div class="tab-pane">
              <div class="verif-list">
                <div *ngFor="let stage of job.verificationStages; let sIdx = index" class="verif-card">
                  <div class="verif-hdr">
                    <div>
                      <h4 class="v-title">{{ stage.stageName }}</h4>
                      <span class="v-role"><mat-icon>badge</mat-icon> {{ stage.assignedRole }}</span>
                    </div>
                    <span class="stage-tag" [ngClass]="stage.status.toLowerCase()">{{ stage.status }}</span>
                  </div>

                  <div class="v-checks">
                    <div *ngFor="let check of stage.checklistResults" class="check-line">
                      <mat-icon [class.text-green]="check.checked" [class.text-gray]="!check.checked">
                        {{ check.checked ? 'check_box' : 'check_box_outline_blank' }}
                      </mat-icon>
                      <span [class.checked-text]="check.checked">{{ check.item }}</span>
                    </div>
                  </div>

                  <div *ngIf="stage.findings" class="v-findings">
                    <strong>Observations:</strong> {{ stage.findings }}
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 4: Final Completion & Endorsement -->
          <mat-tab label="Completion & Decisions">
            <div class="tab-pane">
              <div class="info-card">
                <h4 class="card-heading"><mat-icon>gavel</mat-icon> Decision & Registration Outcome</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">Final Decision</span>
                    <span class="val font-semibold text-green">{{ job.finalDecision || 'Pending Determination' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Certificate / Grant Ref</span>
                    <span class="val font-mono">{{ job.certificateOrGrantNo || 'N/A' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Authorized Officer</span>
                    <span class="val">{{ job.approvedByOfficerName || job.assignedOfficer || 'Not Assigned' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Completed Date</span>
                    <span class="val">{{ job.completedDate || 'In Progress' }}</span>
                  </div>
                  <div class="info-item span-2">
                    <span class="label">Completion Remarks</span>
                    <span class="val">{{ job.completionRemarks || 'No formal remarks registered.' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

        </mat-tab-group>
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    .dialog-container {
      width: 850px;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;

      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .status-indicator-box {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          &.initial { background: #e0f2fe; color: #0284c7; }
          &.documentation { background: #fef3c7; color: #d97706; }
          &.verification { background: #fae8ff; color: #a21caf; }
          &.completed { background: #dcfce7; color: #16a34a; }
          &.rejected { background: #fee2e2; color: #dc2626; }
          &.on_hold { background: #f1f5f9; color: #64748b; }
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 10px;

          .job-ref {
            font-size: 1.2rem;
            font-weight: 800;
            font-family: monospace;
            color: #0f172a;
          }

          .job-type-pill {
            background: #f1f5f9;
            color: #334155;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 6px;
          }

          .priority-pill {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            &.normal { background: #f1f5f9; color: #475569; }
            &.urgent { background: #ffedd5; color: #c2410c; }
            &.immediate { background: #fee2e2; color: #b91c1c; }
          }
        }

        .subtitle {
          margin: 4px 0 0 0;
          font-size: 0.85rem;
          color: #64748b;
        }
      }
    }

    .stage-flow-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 24px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;

      .current-stage-info {
        display: flex;
        align-items: center;
        gap: 8px;
        .label { font-size: 0.75rem; font-weight: 700; color: #64748b; }
      }

      .advance-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }

    .content-scroll {
      padding: 16px 24px !important;
      overflow-y: auto;
      max-height: calc(90vh - 150px);
    }

    .tab-pane {
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .info-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px 20px;

      .card-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 14px 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: #1e293b;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;

        .span-2 { grid-column: span 2; }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .label { font-size: 0.725rem; font-weight: 600; text-transform: uppercase; color: #64748b; }
          .val { font-size: 0.9rem; color: #0f172a; }
        }
      }
    }

    .stage-tag {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;

      &.initial { background: #e0f2fe; color: #0284c7; }
      &.documentation { background: #fef3c7; color: #d97706; }
      &.verification { background: #fae8ff; color: #a21caf; }
      &.completed { background: #dcfce7; color: #16a34a; }
      &.rejected { background: #fee2e2; color: #dc2626; }
    }

    .doc-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 10px;

      .doc-title { font-weight: 600; font-size: 0.9rem; color: #0f172a; }
      .chip-req { background: #fef3c7; color: #b45309; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }
      .doc-meta-row { display: flex; align-items: center; gap: 12px; font-size: 0.8rem; margin-top: 4px; }
      .doc-note { font-size: 0.8rem; color: #64748b; margin: 4px 0 0 0; }
    }

    .verif-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 12px;

      .verif-hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 8px;
        margin-bottom: 10px;

        .v-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: #1e293b; }
        .v-role { font-size: 0.75rem; color: #64748b; display: inline-flex; align-items: center; gap: 4px; }
      }

      .check-line {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        padding: 3px 0;
      }

      .v-findings {
        margin-top: 10px;
        font-size: 0.85rem;
        background: #f8fafc;
        padding: 8px 12px;
        border-radius: 6px;
      }
    }

    .text-green { color: #16a34a; }
    .text-gray { color: #94a3b8; }
    .text-indigo { color: #4f46e5; }
    .btn-success { background: #16a34a !important; color: #ffffff !important; }
  `]
})
export class LandJobDetailDialogComponent {
  private landService = inject(LandService);
  private notif = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<LandJobDetailDialogComponent>);

  job: LandJob;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { job: LandJob }) {
    this.job = { ...data.job };
  }

  getStageIcon(status: LandJobStatus): string {
    switch (status) {
      case 'Initial': return 'flag';
      case 'Documentation': return 'description';
      case 'Verification': return 'fact_check';
      case 'Completed': return 'task_alt';
      case 'Rejected': return 'cancel';
      default: return 'hourglass_empty';
    }
  }

  async advanceStage(targetStage: LandJobStatus) {
    try {
      await this.landService.updateJobStage(this.job, targetStage, `Stage advanced to ${targetStage} by officer.`);
      this.job.status = targetStage;
      this.notif.success(`Land task advanced to ${targetStage}`);
    } catch (e: any) {
      this.notif.error('Failed to advance stage: ' + (e?.message || 'Server error'));
    }
  }

  async onStageSelectChange(newStage: LandJobStatus) {
    if (newStage === this.job.status) return;
    await this.advanceStage(newStage);
  }

  async toggleDocReceivedInDetail(idx: number, received: boolean) {
    if (!this.job.id || !this.job.documents) return;
    this.job.documents[idx].received = received;
    if (received && this.job.documents[idx].status === 'Pending') {
      this.job.documents[idx].status = this.job.documents[idx].fileName ? 'Uploaded' : 'Verified';
    } else if (!received && !this.job.documents[idx].fileName) {
      this.job.documents[idx].status = 'Pending';
    }
    try {
      await this.landService.updateLandJob(
        this.job.id, 
        { documents: this.job.documents },
        `Updated document receipt: ${this.job.documents[idx].docTypeName} -> ${received ? 'Received' : 'Not Received'}`
      );
      this.notif.info(`Marked "${this.job.documents[idx].docTypeName}" as ${received ? 'Received' : 'Not Received'}`);
    } catch (e: any) {
      this.notif.error('Failed to update receipt status: ' + (e?.message || 'Server error'));
    }
  }

  private dialog = inject(MatDialog);

  openInWizard() {
    const currentJob = this.job;
    this.dialogRef.close();
    this.dialog.open(LandJobDialogComponent, {
      width: '960px',
      disableClose: true,
      data: { existingJob: currentJob }
    });
  }

  close() {
    this.dialogRef.close({ updatedJob: this.job });
  }
}
