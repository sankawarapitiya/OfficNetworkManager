import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Letter, LetterAttachment } from '../../models/letter.model';
import { LetterStatusDialogComponent } from '../letter-status-dialog/letter-status-dialog.component';

@Component({
  selector: 'app-letter-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  template: `
    <div class="letter-detail-wrapper" [class.has-side-viewer]="showSidePreview() && selectedAttachment()">
      
      <!-- LEFT / MAIN PANEL: Letter Dossier -->
      <div class="dossier-panel">
        
        <!-- Header -->
        <div class="dialog-header">
          <div class="hdr-left">
            <span class="ref-badge">{{ data.letter.ref_number }}</span>
            <span class="priority-pill" [ngClass]="data.letter.priority.toLowerCase()">
              {{ data.letter.priority }}
            </span>
            <span class="status-pill" [ngClass]="getStatusClass(data.letter.status)">
              {{ data.letter.status }}
            </span>
          </div>

          <div class="hdr-right">
            <!-- Side Document View Toggle (if attachments exist) -->
            <button *ngIf="data.letter.attachments?.length" 
                    mat-stroked-button 
                    type="button" 
                    class="side-toggle-btn"
                    [class.active]="showSidePreview()"
                    (click)="toggleSidePreview()"
                    matTooltip="Toggle side document viewer">
              <mat-icon>{{ showSidePreview() ? 'visibility_off' : 'dock_to_right' }}</mat-icon>
              <span>{{ showSidePreview() ? 'Hide Document' : 'View Document (' + (data.letter.attachments?.length || 0) + ')' }}</span>
            </button>

            <button mat-icon-button mat-dialog-close class="close-btn" matTooltip="Close dialog">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Scrollable Body -->
        <mat-dialog-content class="dialog-body">
          <h2 class="letter-title">{{ data.letter.title }}</h2>

          <!-- Metadata Grid -->
          <div class="meta-grid">
            <div class="meta-item">
              <span class="label">Received From</span>
              <span class="val font-semibold">{{ data.letter.received_from }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Received Date</span>
              <span class="val">{{ data.letter.received_date }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Category</span>
              <span class="val">{{ data.letter.category || 'General Inward' }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Linked Reference</span>
              <span class="val">
                <span *ngIf="data.letter.link_ref" class="link-badge">
                  <mat-icon class="mini-icon">link</mat-icon> {{ data.letter.link_ref }}
                </span>
                <span *ngIf="!data.letter.link_ref" class="text-muted">None</span>
              </span>
            </div>
          </div>

          <!-- Routing & Assignment -->
          <div class="routing-section">
            <div class="route-col">
              <span class="section-sub-title">Send To > Departments</span>
              <div class="chips-wrap">
                <span *ngFor="let d of data.letter.send_to" class="dept-chip">
                  <mat-icon class="mini-icon">domain</mat-icon> {{ d }}
                </span>
                <span *ngIf="!data.letter.send_to?.length" class="text-muted">No specific department</span>
              </div>
            </div>

            <div class="route-col">
              <span class="section-sub-title">Assigned Officers</span>
              <div class="chips-wrap">
                <span *ngFor="let u of data.letter.assigned_user_names || data.letter.assigned_to" class="user-chip">
                  <mat-icon class="mini-icon">person</mat-icon> {{ u }}
                </span>
                <span *ngIf="!data.letter.assigned_to?.length" class="text-muted">Unassigned</span>
              </div>
            </div>
          </div>

          <!-- Content / Description -->
          <div class="content-box">
            <span class="section-sub-title">Letter Description & Directives</span>
            <p class="desc-text">{{ data.letter.description || 'No detailed remarks recorded.' }}</p>
          </div>

          <!-- Attachments Section -->
          <div class="attachments-section" *ngIf="data.letter.attachments?.length">
            <div class="att-header-row">
              <span class="section-sub-title">Attached Files ({{ data.letter.attachments?.length }})</span>
              <span class="att-hint">Click file to view on side</span>
            </div>

            <div class="att-grid">
              <div *ngFor="let att of data.letter.attachments; let idx = index" 
                   class="att-card" 
                   [class.active-card]="showSidePreview() && selectedAttachment() === att"
                   (click)="selectAttachment(att, idx)">
                <mat-icon class="att-type-icon" [ngClass]="att.storage_destination">
                  {{ isPdf(att) ? 'picture_as_pdf' : (isImage(att) ? 'image' : (att.storage_destination === 'firebase' ? 'cloud_download' : 'folder_shared')) }}
                </mat-icon>
                <div class="att-meta">
                  <span class="att-name">{{ att.name }}</span>
                  <span class="att-dest">
                    {{ att.storage_destination === 'firebase' ? 'Cloud File' : ('Network: ' + att.network_path) }} • {{ (att.size / 1024).toFixed(1) }} KB
                  </span>
                </div>
                
                <div class="card-action-btns" (click)="$event.stopPropagation()">
                  <button mat-stroked-button 
                          color="primary" 
                          class="side-preview-btn" 
                          [class.btn-active]="showSidePreview() && selectedAttachment() === att"
                          (click)="selectAttachment(att, idx)">
                    <mat-icon>dock_to_right</mat-icon> Preview
                  </button>
                  <a *ngIf="att.storage_url" 
                     [href]="att.storage_url" 
                     target="_blank" 
                     mat-icon-button 
                     matTooltip="Open in separate tab" 
                     class="external-btn">
                    <mat-icon>open_in_new</mat-icon>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Timeline -->
          <div class="timeline-section" *ngIf="data.letter.action_logs?.length">
            <span class="section-sub-title">Action & Status History</span>
            <div class="timeline-list">
              <div *ngFor="let log of data.letter.action_logs" class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="tl-header">
                    <strong>{{ log.officer_name }}</strong>
                    <span class="tl-status-change" *ngIf="log.from_status !== 'None'">
                      {{ log.from_status }} → <span class="to-st">{{ log.to_status }}</span>
                    </span>
                    <span class="tl-time">{{ log.timestamp | date:'medium' }}</span>
                  </div>
                  <p class="tl-remarks">{{ log.remarks }}</p>
                </div>
              </div>
            </div>
          </div>
        </mat-dialog-content>

        <!-- Footer Actions -->
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button mat-dialog-close>Close</button>
          <button mat-flat-button color="primary" (click)="openUpdateStatus()">
            <mat-icon>update</mat-icon> Update Status
          </button>
        </mat-dialog-actions>

      </div>

      <!-- RIGHT PANEL: Attached Document Viewer on the Side -->
      <div class="doc-side-viewer" *ngIf="showSidePreview() && selectedAttachment()">
        
        <!-- Side Viewer Toolbar -->
        <div class="side-viewer-header">
          <div class="viewer-file-info">
            <mat-icon class="file-badge-icon" [ngClass]="selectedAttachment()?.storage_destination">
              {{ isPdf(selectedAttachment()) ? 'picture_as_pdf' : (isImage(selectedAttachment()) ? 'image' : 'description') }}
            </mat-icon>
            <div class="file-text-wrap">
              <span class="file-name" [matTooltip]="selectedAttachment()?.name || ''">{{ selectedAttachment()?.name }}</span>
              <span class="file-details">
                {{ ((selectedAttachment()?.size || 0) / 1024).toFixed(1) }} KB • 
                {{ selectedAttachment()?.storage_destination === 'firebase' ? 'Cloud File' : 'Network File' }}
              </span>
            </div>
          </div>

          <!-- Multi-file switcher (if more than 1 attachment) -->
          <div class="file-tabs-bar" *ngIf="(data.letter.attachments?.length || 0) > 1">
            <button *ngFor="let att of data.letter.attachments; let i = index"
                    type="button"
                    class="file-tab-chip"
                    [class.active]="selectedAttachment() === att"
                    (click)="selectAttachment(att, i)"
                    [matTooltip]="att.name">
              Doc {{ i + 1 }}
            </button>
          </div>

          <div class="viewer-actions">
            <!-- Image Zoom Controls -->
            <ng-container *ngIf="isImage(selectedAttachment())">
              <button mat-icon-button (click)="zoomOut()" matTooltip="Zoom Out" class="ctrl-btn">
                <mat-icon>zoom_out</mat-icon>
              </button>
              <span class="zoom-pct">{{ zoomLevel() }}%</span>
              <button mat-icon-button (click)="zoomIn()" matTooltip="Zoom In" class="ctrl-btn">
                <mat-icon>zoom_in</mat-icon>
              </button>
              <button mat-icon-button (click)="resetZoom()" matTooltip="Reset Zoom" class="ctrl-btn">
                <mat-icon>restart_alt</mat-icon>
              </button>
            </ng-container>

            <!-- Open New Tab -->
            <a *ngIf="selectedAttachment()?.storage_url" 
               [href]="selectedAttachment()?.storage_url" 
               target="_blank" 
               mat-icon-button 
               matTooltip="Open in separate tab" 
               class="ctrl-btn">
              <mat-icon>open_in_new</mat-icon>
            </a>

            <!-- Download -->
            <a *ngIf="selectedAttachment()?.storage_url" 
               [href]="selectedAttachment()?.storage_url" 
               [download]="selectedAttachment()?.name" 
               mat-icon-button 
               matTooltip="Download Document" 
               class="ctrl-btn">
              <mat-icon>download</mat-icon>
            </a>

            <!-- Close side view -->
            <button mat-icon-button (click)="toggleSidePreview()" matTooltip="Close document side view" class="ctrl-btn close-side-btn">
              <mat-icon>chevron_right</mat-icon>
            </button>
          </div>
        </div>

        <!-- Side Viewer Canvas -->
        <div class="side-viewer-canvas">
          
          <!-- 1. PDF Viewer with embedded iframe -->
          <div *ngIf="isPdf(selectedAttachment()) && selectedAttachment()?.storage_url" class="pdf-viewer-wrap">
            <iframe [src]="safeDocUrl()" class="pdf-iframe" title="PDF Document Viewer"></iframe>
          </div>

          <!-- 2. Image Viewer -->
          <div *ngIf="isImage(selectedAttachment()) && selectedAttachment()?.storage_url" class="image-viewer-wrap">
            <div class="image-container" [style.transform]="'scale(' + (zoomLevel() / 100) + ')'">
              <img [src]="selectedAttachment()?.storage_url" [alt]="selectedAttachment()?.name" class="preview-img">
            </div>
          </div>

          <!-- 3. Network Share File -->
          <div *ngIf="selectedAttachment()?.storage_destination === 'network'" class="network-file-card">
            <div class="net-icon-box">
              <mat-icon>folder_shared</mat-icon>
            </div>
            <h3>Network Shared Document</h3>
            <p class="net-desc">This document is stored securely on the internal regional office network storage share.</p>
            
            <div class="net-path-box">
              <code>{{ selectedAttachment()?.network_path || 'No network path recorded' }}</code>
              <button mat-icon-button 
                      (click)="copyNetworkPath(selectedAttachment()?.network_path)" 
                      [matTooltip]="copiedPath() ? 'Copied to clipboard!' : 'Copy network path'">
                <mat-icon>{{ copiedPath() ? 'check' : 'content_copy' }}</mat-icon>
              </button>
            </div>
            <span class="copied-indicator" *ngIf="copiedPath()">Network path copied to clipboard!</span>

            <div class="net-instructions">
              <mat-icon>info</mat-icon>
              <span>To access, copy this UNC path and paste into Windows File Explorer or access your local file share mount.</span>
            </div>

            <a *ngIf="selectedAttachment()?.storage_url" 
               [href]="selectedAttachment()?.storage_url" 
               target="_blank" 
               mat-stroked-button 
               color="primary" 
               class="open-cloud-btn">
              <mat-icon>open_in_new</mat-icon> Open Web Replica
            </a>
          </div>

          <!-- 4. Other File Type with URL (Word, Excel, etc.) -->
          <div *ngIf="!isPdf(selectedAttachment()) && !isImage(selectedAttachment()) && selectedAttachment()?.storage_destination !== 'network'" class="generic-file-card">
            <div class="generic-icon-box">
              <mat-icon>description</mat-icon>
            </div>
            <h3>{{ selectedAttachment()?.name }}</h3>
            <p class="file-size-sub">{{ ((selectedAttachment()?.size || 0) / 1024).toFixed(1) }} KB • Direct Document</p>
            
            <p class="generic-desc">This document type cannot be embedded inline. You can download or view it in your default application.</p>
            
            <div class="generic-btn-row">
              <a *ngIf="selectedAttachment()?.storage_url" 
                 [href]="selectedAttachment()?.storage_url" 
                 target="_blank" 
                 mat-flat-button 
                 color="primary">
                <mat-icon>download</mat-icon> Download Document
              </a>
            </div>
          </div>

        </div>

      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      max-height: 94vh;
      overflow: hidden;
      background: white;
    }

    .letter-detail-wrapper {
      display: flex;
      flex-direction: row;
      height: 100%;
      max-height: 94vh;
      overflow: hidden;
      box-sizing: border-box;

      &.has-side-viewer {
        .dossier-panel {
          flex: 0 0 46%;
          max-width: 46%;
          border-right: 1px solid #e2e8f0;
        }
        .doc-side-viewer {
          flex: 1 1 54%;
          min-width: 0;
        }
      }

      &:not(.has-side-viewer) {
        .dossier-panel {
          flex: 1 1 100%;
          max-width: 100%;
        }
      }

      @media (max-width: 900px) {
        flex-direction: column;
        &.has-side-viewer {
          .dossier-panel {
            flex: 0 0 auto;
            max-width: 100%;
            height: 48vh;
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
          }
          .doc-side-viewer {
            flex: 1 1 auto;
            height: 46vh;
          }
        }
      }
    }

    /* Left Dossier Panel */
    .dossier-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: white;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      flex-shrink: 0;

      .hdr-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .hdr-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .side-toggle-btn {
        height: 32px;
        line-height: 32px;
        font-size: 11.5px;
        font-weight: 600;
        padding: 0 10px;
        border-radius: 6px;
        border-color: #cbd5e1;
        color: #334155;
        display: inline-flex;
        align-items: center;
        gap: 5px;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #4f46e5;
        }

        &.active {
          background: #eef2ff;
          border-color: #818cf8;
          color: #4338ca;
        }
      }

      .close-btn { 
        width: 32px; 
        height: 32px; 
        line-height: 32px; 
        color: #64748b;
        mat-icon { font-size: 18px; width: 18px; height: 18px; } 
        &:hover { color: #0f172a; background: #e2e8f0; }
      }
    }

    .ref-badge {
      font-family: monospace;
      font-weight: 700;
      font-size: 11.5px;
      background: #eff6ff;
      color: #1e40af;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
    }

    .priority-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      &.normal { background: #f1f5f9; color: #475569; }
      &.urgent { background: #fef3c7; color: #b45309; }
      &.immediate { background: #fee2e2; color: #b91c1c; }
    }

    .status-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      &.received { background: #e0f2fe; color: #0369a1; }
      &.in-review { background: #fef3c7; color: #b45309; }
      &.action-required { background: #fee2e2; color: #b91c1c; }
      &.in-progress { background: #f3e8ff; color: #7e22ce; }
      &.completed { background: #dcfce7; color: #15803d; }
      &.dispatched { background: #e0e7ff; color: #4338ca; }
      &.archived { background: #f1f5f9; color: #64748b; }
    }

    .dialog-body { 
      padding: 16px 20px !important; 
      flex: 1 1 auto;
      overflow-y: auto !important;
      max-height: none !important;
      margin: 0 !important;
    }

    .letter-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 14px 0;
      line-height: 1.35;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin-bottom: 14px;

      .meta-item {
        display: flex;
        flex-direction: column;
        .label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; }
        .val { font-size: 12.5px; color: #1e293b; margin-top: 2px; }
      }
    }

    .link-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #eef2ff;
      color: #4338ca;
      font-weight: 600;
      font-size: 11px;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .mini-icon { font-size: 13px; width: 13px; height: 13px; }

    .section-sub-title {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
    }

    .routing-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .chips-wrap { display: flex; flex-wrap: wrap; gap: 4px; }

    .dept-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .user-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f3e8ff;
      color: #6b21a8;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .content-box {
      background: #fafaf9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      .desc-text { margin: 0; font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap; }
    }

    .attachments-section { 
      margin-bottom: 16px; 
      .att-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        .att-hint {
          font-size: 10.5px;
          color: #6366f1;
          font-weight: 600;
        }
      }
    }

    .att-grid { display: flex; flex-direction: column; gap: 8px; }

    .att-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
      }

      &.active-card {
        background: #eef2ff;
        border-color: #6366f1;
        box-shadow: 0 0 0 1px #6366f1;
      }

      .att-type-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
        color: #6366f1;
        &.firebase { color: #0284c7; }
        &.network { color: #d97706; }
      }

      .att-meta {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        .att-name { 
          font-size: 12.5px; 
          font-weight: 600; 
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .att-dest { font-size: 10.5px; color: #64748b; margin-top: 1px; }
      }

      .card-action-btns {
        display: flex;
        align-items: center;
        gap: 6px;

        .side-preview-btn {
          height: 28px;
          line-height: 28px;
          font-size: 11px;
          padding: 0 8px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
          &.btn-active {
            background: #4f46e5;
            color: white;
            border-color: #4f46e5;
            mat-icon { color: white; }
          }
        }

        .external-btn {
          width: 28px;
          height: 28px;
          line-height: 28px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
        }
      }
    }

    .timeline-section { margin-top: 16px; }
    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-left: 2px solid #e2e8f0;
      margin-left: 8px;
      padding-left: 16px;
    }
    .timeline-item {
      position: relative;
      .timeline-dot {
        position: absolute;
        left: -21px;
        top: 4px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #3b82f6;
        border: 2px solid white;
      }
      .tl-header {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 12.5px;
        color: #1e293b;
        .to-st { color: #2563eb; font-weight: 700; }
        .tl-time { font-size: 11px; color: #94a3b8; }
      }
      .tl-remarks { margin: 2px 0 0 0; font-size: 12.5px; color: #475569; }
    }

    .text-muted { color: #94a3b8; font-size: 12px; }
    
    .dialog-actions { 
      padding: 10px 20px 14px; 
      border-top: 1px solid #e2e8f0; 
      background: #f8fafc;
      flex-shrink: 0;
      margin: 0 !important;
    }

    /* RIGHT PANEL: Document Side Viewer */
    .doc-side-viewer {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0f172a;
      overflow: hidden;
      border-left: 1px solid #1e293b;
    }

    .side-viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      gap: 12px;
      flex-shrink: 0;
      min-height: 48px;

      .viewer-file-info {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;

        .file-badge-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #38bdf8;
          &.network { color: #fbbf24; }
          &.firebase { color: #38bdf8; }
        }

        .file-text-wrap {
          display: flex;
          flex-direction: column;
          min-width: 0;

          .file-name {
            font-size: 12.5px;
            font-weight: 600;
            color: #f8fafc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .file-details {
            font-size: 10px;
            color: #94a3b8;
          }
        }
      }

      .file-tabs-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        background: #0f172a;
        padding: 2px 4px;
        border-radius: 6px;
        border: 1px solid #334155;

        .file-tab-chip {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 10.5px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            color: white;
            background: rgba(255, 255, 255, 0.08);
          }

          &.active {
            background: #4f46e5;
            color: white;
          }
        }
      }

      .viewer-actions {
        display: flex;
        align-items: center;
        gap: 4px;

        .ctrl-btn {
          width: 32px;
          height: 32px;
          line-height: 32px;
          color: #cbd5e1;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          &:hover {
            color: white;
            background: rgba(255, 255, 255, 0.1);
          }
        }

        .close-side-btn {
          color: #f43f5e;
          &:hover {
            background: rgba(244, 63, 94, 0.15);
          }
        }

        .zoom-pct {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          min-width: 38px;
          text-align: center;
        }
      }
    }

    .side-viewer-canvas {
      flex: 1 1 auto;
      height: calc(100% - 48px);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* PDF Viewer */
    .pdf-viewer-wrap {
      width: 100%;
      height: 100%;
      position: relative;

      .pdf-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: #1e293b;
      }
    }

    /* Image Viewer */
    .image-viewer-wrap {
      width: 100%;
      height: 100%;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;

      .image-container {
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: center center;
        display: flex;
        justify-content: center;

        .preview-img {
          max-width: 100%;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 6px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
      }
    }

    /* Network File Card */
    .network-file-card {
      margin: auto;
      max-width: 480px;
      padding: 32px 24px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #f8fafc;

      .net-icon-box {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        background: rgba(245, 158, 11, 0.12);
        color: #f59e0b;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 32px; width: 32px; height: 32px; }
      }

      h3 { margin: 0; font-size: 16px; font-weight: 700; color: white; }
      .net-desc { margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.4; }

      .net-path-box {
        width: 100%;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        box-sizing: border-box;

        code {
          font-family: monospace;
          font-size: 11.5px;
          color: #38bdf8;
          word-break: break-all;
          text-align: left;
        }

        button {
          color: #cbd5e1;
          width: 30px;
          height: 30px;
          line-height: 30px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
          &:hover { color: white; background: rgba(255, 255, 255, 0.1); }
        }
      }

      .copied-indicator {
        font-size: 11px;
        color: #34d399;
        font-weight: 600;
      }

      .net-instructions {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        text-align: left;
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.4;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; flex-shrink: 0; margin-top: 1px; }
      }

      .open-cloud-btn {
        margin-top: 8px;
        font-size: 12px;
        color: #818cf8;
        border-color: #6366f1;
      }
    }

    /* Generic File Card */
    .generic-file-card {
      margin: auto;
      max-width: 440px;
      padding: 32px 24px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #f8fafc;

      .generic-icon-box {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 32px; width: 32px; height: 32px; }
      }

      h3 { margin: 0; font-size: 15px; font-weight: 700; color: white; word-break: break-all; }
      .file-size-sub { margin: 0; font-size: 11px; color: #94a3b8; }
      .generic-desc { margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.4; }

      .generic-btn-row {
        margin-top: 8px;
        a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }
    }
  `]
})
export class LetterDetailDialogComponent implements OnInit {
  private dialog = inject(MatDialog);
  private sanitizer = inject(DomSanitizer);

  showSidePreview = signal<boolean>(false);
  selectedAttachment = signal<LetterAttachment | null>(null);
  selectedAttachmentIndex = signal<number>(0);
  zoomLevel = signal<number>(100);
  copiedPath = signal<boolean>(false);

  safeDocUrl = computed<SafeResourceUrl | null>(() => {
    const att = this.selectedAttachment();
    if (!att || !att.storage_url) return null;
    let url = att.storage_url;
    if (this.isPdf(att) && !url.includes('#')) {
      url += '#view=FitH';
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { letter: Letter },
    public dialogRef: MatDialogRef<LetterDetailDialogComponent>
  ) {}

  ngOnInit() {
    if (this.data.letter?.attachments && this.data.letter.attachments.length > 0) {
      this.selectedAttachment.set(this.data.letter.attachments[0]);
      this.selectedAttachmentIndex.set(0);
      this.showSidePreview.set(true);
      this.dialogRef.updateSize('1440px', '92vh');
    } else {
      this.showSidePreview.set(false);
      this.dialogRef.updateSize('780px', 'auto');
    }
  }

  toggleSidePreview() {
    const next = !this.showSidePreview();
    this.showSidePreview.set(next);
    if (next) {
      if (!this.selectedAttachment() && this.data.letter.attachments?.length) {
        this.selectedAttachment.set(this.data.letter.attachments[0]);
        this.selectedAttachmentIndex.set(0);
      }
      this.dialogRef.updateSize('1440px', '92vh');
    } else {
      this.dialogRef.updateSize('780px', 'auto');
    }
  }

  selectAttachment(att: LetterAttachment, index: number) {
    this.selectedAttachment.set(att);
    this.selectedAttachmentIndex.set(index);
    this.zoomLevel.set(100);
    if (!this.showSidePreview()) {
      this.showSidePreview.set(true);
      this.dialogRef.updateSize('1440px', '92vh');
    }
  }

  isPdf(att: LetterAttachment | null): boolean {
    if (!att) return false;
    if (att.type === 'application/pdf') return true;
    return (att.name || '').toLowerCase().endsWith('.pdf');
  }

  isImage(att: LetterAttachment | null): boolean {
    if (!att) return false;
    if (att.type?.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.name || '');
  }

  zoomIn() {
    this.zoomLevel.update(z => Math.min(z + 25, 300));
  }

  zoomOut() {
    this.zoomLevel.update(z => Math.max(z - 25, 25));
  }

  resetZoom() {
    this.zoomLevel.set(100);
  }

  copyNetworkPath(path?: string) {
    if (!path) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(path).then(() => {
        this.copiedPath.set(true);
        setTimeout(() => this.copiedPath.set(false), 2500);
      });
    }
  }

  getStatusClass(status: string): string {
    return (status || '').toLowerCase().replace(/\s+/g, '-');
  }

  openUpdateStatus() {
    const ref = this.dialog.open(LetterStatusDialogComponent, {
      width: '520px',
      data: { letter: this.data.letter }
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.dialogRef.close(true);
      }
    });
  }
}
