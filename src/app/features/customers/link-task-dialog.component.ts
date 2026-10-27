import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Customer } from './services/customer.service';
import { WorkPlan, WorkPlanService } from '../work-plans/services/work-plan.service';
import { LandJob } from '../land/models/land.model';
import { LandService } from '../land/services/land.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-link-task-dialog',
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
    MatTabsModule,
    MatRadioModule,
    MatTooltipModule
  ],
  template: `
    <div class="link-task-modal">
      <div class="modal-header">
        <div class="title-group">
          <mat-icon class="header-icon">add_task</mat-icon>
          <div>
            <h2 class="dialog-title">Task Association & Linking</h2>
            <p class="dialog-sub">Attach, create, or remove linked operational and cadastral tasks for <strong>{{ data.customer.name }}</strong></p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Citizen Mini Dossier Strip -->
      <div class="citizen-strip">
        <div class="strip-item">
          <span class="strip-lbl">Citizen Name:</span>
          <span class="strip-val">{{ data.customer.name }}</span>
        </div>
        <div class="strip-item">
          <span class="strip-lbl">NIC:</span>
          <span class="strip-val font-mono">{{ data.customer.nic }}</span>
        </div>
        <div class="strip-item">
          <span class="strip-lbl">Phone:</span>
          <span class="strip-val">{{ data.customer.tpno || 'N/A' }}</span>
        </div>
        <div class="strip-item">
          <span class="strip-lbl">Division:</span>
          <span class="strip-val">{{ data.customer.division }}</span>
        </div>
      </div>

      <mat-tab-group class="link-tabs" mat-stretch-tabs="false">
        <!-- TAB 1: Link Existing Task -->
        <mat-tab label="Link Existing Task">
          <div class="tab-body">
            <p class="tab-desc">Search and select an active work plan directive or cadastral task to associate with this citizen.</p>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Task Domain / Category</mat-label>
              <mat-select [value]="selectedDomain()" (selectionChange)="selectedDomain.set($event.value)">
                <mat-option value="work_plan">Work Plan Operational Directive (Work Plans)</mat-option>
                <mat-option value="land_job">Cadastral / Land Management Task (Land Registry)</mat-option>
              </mat-select>
              <mat-icon matPrefix>category</mat-icon>
            </mat-form-field>

            <!-- Work Plan selector -->
            <div *ngIf="selectedDomain() === 'work_plan'">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Select Work Plan Task</mat-label>
                <mat-select [formControl]="selectedWorkPlanCtrl">
                  <mat-option *ngFor="let p of availableWorkPlans()" [value]="p">
                    <div class="opt-row">
                      <strong>{{ p.title }}</strong>
                      <span class="opt-meta">[{{ p.division || 'General' }} • {{ p.status }}]</span>
                    </div>
                  </mat-option>
                  <mat-option *ngIf="availableWorkPlans().length === 0" disabled>
                    No unlinked work plans available
                  </mat-option>
                </mat-select>
                <mat-icon matPrefix>assignment</mat-icon>
              </mat-form-field>
            </div>

            <!-- Land Job selector -->
            <div *ngIf="selectedDomain() === 'land_job'">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Select Land Cadastral Job</mat-label>
                <mat-select [formControl]="selectedLandJobCtrl">
                  <mat-option *ngFor="let j of availableLandJobs()" [value]="j">
                    <div class="opt-row">
                      <strong>{{ j.jobRef }}</strong> — {{ j.jobTypeName }}
                      <span class="opt-meta">[{{ j.division }} • Lot: {{ j.lotNumber || 'N/A' }}]</span>
                    </div>
                  </mat-option>
                  <mat-option *ngIf="availableLandJobs().length === 0" disabled>
                    No unlinked land jobs available
                  </mat-option>
                </mat-select>
                <mat-icon matPrefix>terrain</mat-icon>
              </mat-form-field>
            </div>

            <div class="tab-actions">
              <button mat-stroked-button (click)="dialogRef.close()">Cancel</button>
              <button mat-flat-button color="primary" 
                      [disabled]="isLinkExistingDisabled()"
                      (click)="onLinkExisting()">
                <mat-icon>link</mat-icon>
                Link Selected Task
              </button>
            </div>
          </div>
        </mat-tab>

        <!-- TAB 2: Create & Link New Task -->
        <mat-tab label="Create & Link New Task">
          <form [formGroup]="newTaskForm" (ngSubmit)="onCreateNewTask()" class="tab-body">
            <p class="tab-desc">Author a new operational directive or field assignment automatically tied to this citizen.</p>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Task / Directive Title</mat-label>
              <input matInput formControlName="title" placeholder="e.g. Boundary Inspection & Survey Inquiry" required>
              <mat-icon matPrefix>edit_note</mat-icon>
            </mat-form-field>

            <div class="form-grid-2">
              <mat-form-field appearance="outline">
                <mat-label>Department</mat-label>
                <mat-select formControlName="department" required>
                  <mat-option value="Land Administration & Titles">Land Administration & Titles</mat-option>
                  <mat-option value="Survey & Cadastral Mapping">Survey & Cadastral Mapping</mat-option>
                  <mat-option value="Public Desk & Customer Care">Public Desk & Customer Care</mat-option>
                  <mat-option value="Planning & Urban Development">Planning & Urban Development</mat-option>
                  <mat-option value="Accounts">Accounts</mat-option>
                  <mat-option value="Legal & Regulatory Affairs">Legal & Regulatory Affairs</mat-option>
                </mat-select>
                <mat-icon matPrefix>apartment</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Category / Pillar</mat-label>
                <mat-select formControlName="category" required>
                  <mat-option value="Client Services">Client Services</mat-option>
                  <mat-option value="Land Deeds">Land Deeds</mat-option>
                  <mat-option value="Operations">Operations</mat-option>
                  <mat-option value="Infrastructure">Infrastructure</mat-option>
                  <mat-option value="Compliance">Compliance</mat-option>
                </mat-select>
                <mat-icon matPrefix>category</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Target Completion Date</mat-label>
                <input matInput type="date" formControlName="targetDate" required>
                <mat-icon matPrefix>event</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Priority Level</mat-label>
                <mat-select formControlName="priority" required>
                  <mat-option value="Urgent">Urgent</mat-option>
                  <mat-option value="High">High</mat-option>
                  <mat-option value="Medium">Medium</mat-option>
                  <mat-option value="Low">Low</mat-option>
                </mat-select>
                <mat-icon matPrefix>flag</mat-icon>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Task Scope / Description</mat-label>
              <textarea matInput formControlName="description" rows="2" placeholder="Brief scope, citizen requirements, or surveyor objectives..." required></textarea>
              <mat-icon matPrefix>description</mat-icon>
            </mat-form-field>

            <div class="tab-actions">
              <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancel</button>
              <button mat-flat-button color="primary" type="submit" [disabled]="newTaskForm.invalid">
                <mat-icon>add_task</mat-icon>
                Create & Link Task
              </button>
            </div>
          </form>
        </mat-tab>

        <!-- TAB 3: Currently Linked Tasks & Remove Link -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-label-icon">link</mat-icon>
            <span>Linked Tasks ({{ totalAlreadyLinkedCount() }})</span>
          </ng-template>

          <div class="tab-body">
            <p class="tab-desc">Tasks currently associated with <strong>{{ data.customer.name }}</strong>. You can remove a link here without deleting the underlying task.</p>

            <div *ngIf="totalAlreadyLinkedCount() === 0" class="empty-linked-box">
              <mat-icon>link_off</mat-icon>
              <p>No tasks currently linked to this citizen.</p>
            </div>

            <div *ngIf="totalAlreadyLinkedCount() > 0" class="linked-items-list">
              <!-- Work Plans -->
              <div *ngFor="let p of alreadyLinkedWorkPlans()" class="linked-item-row wp-item">
                <div class="linked-item-main">
                  <div class="linked-type-pill wp-pill">
                    <mat-icon>assignment</mat-icon> Work Plan
                  </div>
                  <div class="linked-item-info">
                    <span class="linked-title">{{ p.title }}</span>
                    <span class="linked-meta">{{ p.department || 'Operations' }} • {{ p.status }} • Due: {{ p.targetDate || 'Open' }}</span>
                  </div>
                </div>
                <button mat-stroked-button class="unlink-mini-btn" (click)="onUnlinkWorkPlanFromDialog(p)">
                  <mat-icon>link_off</mat-icon> Remove Link
                </button>
              </div>

              <!-- Land Jobs -->
              <div *ngFor="let j of alreadyLinkedLandJobs()" class="linked-item-row land-item">
                <div class="linked-item-main">
                  <div class="linked-type-pill land-pill">
                    <mat-icon>terrain</mat-icon> Land Task
                  </div>
                  <div class="linked-item-info">
                    <span class="linked-title">{{ j.jobRef }} — {{ j.jobTypeName }}</span>
                    <span class="linked-meta">{{ j.division }} • Lot: {{ j.lotNumber || 'N/A' }} • Status: {{ j.status }}</span>
                  </div>
                </div>
                <button mat-stroked-button class="unlink-mini-btn" (click)="onUnlinkLandJobFromDialog(j)">
                  <mat-icon>link_off</mat-icon> Remove Link
                </button>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .link-task-modal {
      display: flex;
      flex-direction: column;
      padding: 24px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 14px;
      margin-bottom: 16px;
      .title-group {
        display: flex;
        align-items: center;
        gap: 12px;
        .header-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: #4f46e5;
        }
        .dialog-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .dialog-sub {
          font-size: 12.5px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
      }
      .close-btn { color: #94a3b8; }
    }
    .citizen-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      .strip-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        .strip-lbl {
          font-size: 10.5px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .strip-val {
          font-size: 12.5px;
          font-weight: 600;
          color: #0f172a;
          &.font-mono { font-family: monospace; }
        }
      }
    }
    .tab-body {
      padding: 18px 4px 6px 4px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .tab-desc {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 4px 0;
    }
    .w-full {
      width: 100%;
    }
    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .opt-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      .opt-meta {
        font-size: 11px;
        color: #64748b;
        margin-left: 10px;
      }
    }
    .tab-label-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 4px;
    }
    .empty-linked-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      color: #94a3b8;
      gap: 8px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; }
      p { margin: 0; font-size: 13px; }
    }
    .linked-items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .linked-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      gap: 12px;

      &.wp-item { border-left: 3px solid #4f46e5; }
      &.land-item { border-left: 3px solid #059669; }

      .linked-item-main {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex: 1;

        .linked-type-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;

          &.wp-pill { background: #eef2ff; color: #4338ca; mat-icon { font-size: 13px; width: 13px; height: 13px; } }
          &.land-pill { background: #ecfdf5; color: #065f46; mat-icon { font-size: 13px; width: 13px; height: 13px; } }
        }

        .linked-item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;

          .linked-title {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .linked-meta {
            font-size: 11px;
            color: #64748b;
          }
        }
      }

      .unlink-mini-btn {
        height: 30px;
        font-size: 11.5px;
        font-weight: 600;
        color: #dc2626 !important;
        border-color: #fecaca !important;
        background: #fef2f2 !important;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;

        mat-icon { font-size: 15px; width: 15px; height: 15px; color: #dc2626; }

        &:hover {
          background: #fee2e2 !important;
          border-color: #f87171 !important;
          color: #b91c1c !important;
        }
      }
    }
    .tab-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
    }
  `]
})
export class LinkTaskDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<LinkTaskDialogComponent>);
  private fb = inject(FormBuilder);
  private workPlanService = inject(WorkPlanService);
  private landService = inject(LandService);
  private notif = inject(NotificationService);
  private authService = inject(AuthService);

  selectedDomain = signal<'work_plan' | 'land_job'>('work_plan');
  workPlans = signal<WorkPlan[]>([]);
  landJobs = signal<LandJob[]>([]);

  selectedWorkPlanCtrl = new FormControl<WorkPlan | null>(null);
  selectedLandJobCtrl = new FormControl<LandJob | null>(null);

  newTaskForm!: FormGroup;

  availableWorkPlans = computed(() => {
    const list = this.workPlans();
    const custId = this.data.customer.id;
    return list.filter(p => !p.customerId || p.customerId !== custId);
  });

  availableLandJobs = computed(() => {
    const list = this.landJobs();
    const custId = this.data.customer.id;
    return list.filter(j => !j.customerId || j.customerId !== custId);
  });

  alreadyLinkedWorkPlans = computed(() => {
    const custId = this.data.customer.id;
    if (!custId) return [];
    return this.workPlans().filter(p => p.customerId && p.customerId.trim() === custId);
  });

  alreadyLinkedLandJobs = computed(() => {
    const custId = this.data.customer.id;
    const custNic = this.data.customer.nic?.trim().toLowerCase();
    return this.landJobs().filter(j => {
      if (custId && j.customerId && j.customerId.trim() === custId) return true;
      if (custNic && j.customerNic && j.customerNic.trim().toLowerCase() === custNic) return true;
      return false;
    });
  });

  totalAlreadyLinkedCount = computed(() => {
    return this.alreadyLinkedWorkPlans().length + this.alreadyLinkedLandJobs().length;
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { customer: Customer }) {}

  ngOnInit() {
    this.initNewTaskForm();
    this.loadData();
  }

  private initNewTaskForm() {
    const today = new Date();
    const target = new Date();
    target.setDate(today.getDate() + 14);
    const targetDateStr = target.toISOString().split('T')[0];

    this.newTaskForm = this.fb.group({
      title: ['', Validators.required],
      department: ['Land Administration & Titles', Validators.required],
      category: ['Client Services', Validators.required],
      targetDate: [targetDateStr, Validators.required],
      priority: ['High', Validators.required],
      description: ['', Validators.required]
    });
  }

  private loadData() {
    this.workPlanService.getWorkPlans().subscribe({
      next: (plans) => this.workPlans.set(plans || []),
      error: () => this.workPlans.set([])
    });

    this.landService.getLandJobs().subscribe({
      next: (jobs) => this.landJobs.set(jobs || []),
      error: () => this.landJobs.set([])
    });
  }

  isLinkExistingDisabled(): boolean {
    if (this.selectedDomain() === 'work_plan') {
      return !this.selectedWorkPlanCtrl.value;
    }
    return !this.selectedLandJobCtrl.value;
  }

  async onLinkExisting() {
    const custId = this.data.customer.id;
    if (!custId) return;

    try {
      if (this.selectedDomain() === 'work_plan') {
        const plan = this.selectedWorkPlanCtrl.value;
        if (plan && plan.id) {
          await this.workPlanService.updateWorkPlan(plan.id, {
            customerId: custId
          });
          this.notif.success(`Task "${plan.title}" successfully linked to ${this.data.customer.name}!`);
          this.dialogRef.close({ linked: true, domain: 'work_plan', taskId: plan.id });
        }
      } else {
        const job = this.selectedLandJobCtrl.value;
        if (job && job.id) {
          await this.landService.updateLandJob(job.id, {
            customerId: custId,
            customerName: this.data.customer.name,
            customerNic: this.data.customer.nic,
            customerPhone: this.data.customer.tpno || job.customerPhone,
            customerAddress: this.data.customer.address || job.customerAddress
          }, `Linked customer ${this.data.customer.name} (NIC: ${this.data.customer.nic})`);
          this.notif.success(`Land Task "${job.jobRef}" successfully linked to ${this.data.customer.name}!`);
          this.dialogRef.close({ linked: true, domain: 'land_job', taskId: job.id });
        }
      }
    } catch (e: any) {
      console.error('Error linking task:', e);
      this.notif.error(e?.message || 'Failed to link task.');
    }
  }

  async onCreateNewTask() {
    if (this.newTaskForm.invalid) return;

    const cust = this.data.customer;
    const formVal = this.newTaskForm.value;
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Officer';
    const officerEmail = user?.email || '';

    const currentMonth = new Date().toISOString().substring(0, 7);

    const newPlan: Omit<WorkPlan, 'id'> = {
      title: formVal.title,
      description: formVal.description,
      division: cust.division || 'General',
      department: formVal.department,
      category: formVal.category,
      leadName: officerName,
      leadEmail: officerEmail,
      ownerName: cust.name,
      ownerUid: cust.id,
      customerId: cust.id,
      status: 'In Progress',
      priority: formVal.priority,
      progress: 0,
      startDate: new Date().toISOString().split('T')[0],
      targetDate: formVal.targetDate,
      assignedMonth: currentMonth,
      milestones: [
        { id: 'm_' + Date.now() + '_1', title: 'Intake and document receipt from citizen', completed: true },
        { id: 'm_' + Date.now() + '_2', title: 'Officer field verification / action', completed: false },
        { id: 'm_' + Date.now() + '_3', title: 'Final executive determination', completed: false }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdByEmail: officerEmail,
      createdByName: officerName
    };

    try {
      const newPlanId = await this.workPlanService.addWorkPlan(newPlan);
      this.notif.success(`Created & linked new task "${formVal.title}" for ${cust.name}!`);
      this.dialogRef.close({ linked: true, domain: 'work_plan', taskId: newPlanId });
    } catch (e: any) {
      console.error('Error creating task:', e);
      this.notif.error(e?.message || 'Failed to create task.');
    }
  }

  async onUnlinkWorkPlanFromDialog(plan: WorkPlan) {
    if (!plan?.id) return;
    try {
      const updates: Partial<WorkPlan> = { customerId: '' };
      if (plan.ownerUid === this.data.customer.id) {
        updates.ownerUid = '';
        updates.ownerName = '';
      }
      await this.workPlanService.updateWorkPlan(plan.id, updates);
      this.workPlans.update(plans => plans.map(p => p.id === plan.id ? { ...p, customerId: undefined } : p));
      this.notif.success(`Task "${plan.title}" unlinked from ${this.data.customer.name}`);
    } catch (e: any) {
      this.notif.error(e?.message || 'Failed to unlink task');
    }
  }

  async onUnlinkLandJobFromDialog(job: LandJob) {
    if (!job?.id) return;
    try {
      await this.landService.updateLandJob(job.id, {
        customerId: '',
        customerNic: '',
        customerName: 'Unassigned',
        customerPhone: '',
        customerAddress: '',
        customerEmail: ''
      }, `Unlinked customer ${this.data.customer.name} from job ${job.jobRef}`);
      this.landJobs.update(jobs => jobs.map(j => j.id === job.id ? { ...j, customerId: undefined, customerNic: '' } : j));
      this.notif.success(`Land Task "${job.jobRef}" unlinked from ${this.data.customer.name}`);
    } catch (e: any) {
      this.notif.error(e?.message || 'Failed to unlink land task');
    }
  }
}
