import { Component, Inject, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { LandService } from '../../services/land.service';
import { CustomerService, Customer } from '../../../customers/services/customer.service';
import { CustomerDialogComponent } from '../../../customers/customer-dialog.component';
import { SettingsService, Division, SystemDefaults } from '../../../settings/settings.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { 
  LandJob, 
  LandJobStatus,
  LandJobDocument, 
  LandJobVerificationStage, 
  JobTypeConfig, 
  LandSettings, 
  DEFAULT_LAND_SETTINGS,
  DEFAULT_FORM_REQUIRED_FIELDS
} from '../../models/land.model';

@Component({
  selector: 'app-land-job-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatProgressBarModule
  ],
  templateUrl: './land-job-dialog.component.html',
  styleUrl: './land-job-dialog.component.scss'
})
export class LandJobDialogComponent implements OnInit {
  @ViewChild('stepper') stepper!: MatStepper;

  private fb = inject(FormBuilder);
  private landService = inject(LandService);
  private customerService = inject(CustomerService);
  private settingsService = inject(SettingsService);
  private notif = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<LandJobDialogComponent>);
  private dialog = inject(MatDialog);

  existingJob: LandJob | null = null;
  isEditMode = signal<boolean>(false);

  // Administrative Divisions mapping
  systemDefaults = signal<SystemDefaults | null>(null);
  allDivisions = signal<Division[]>([]);
  gnFilterText = signal<string>('');
  filteredGNDivisions = computed(() => {
    const filter = this.gnFilterText().toLowerCase().trim();
    let divs = this.allDivisions();

    const enOnly = (s?: string) => {
      if (!s) return '';
      return s.replace(/[^\x20-\x7E]/g, '').replace(/\//g, '').replace(/(^[\s-]+|[\s-]+$)/g, '').replace(/\s{2,}/g, ' ').trim();
    };

    const adminDiv = this.initialForm?.get('division')?.value || '';
    
    // Filter by DS if adminDiv is set
    if (adminDiv) {
      divs = divs.filter(d => enOnly(d.divisionalSecretariat) === adminDiv);
    }

    if (filter) {
      divs = divs.filter(d => 
        (d.name && d.name.toLowerCase().includes(filter)) ||
        (d.gnCode && d.gnCode.toLowerCase().includes(filter))
      );
    }
    return divs.slice(0, 50); // Limit dropdown size
  });

  adminFilterText = signal<string>('');
  
  uniqueAdminDivisions = computed(() => {
    const divs = this.allDivisions();
    const set = new Set<string>();
    
    const enOnly = (s?: string) => {
      if (!s) return '';
      return s.replace(/[^\x20-\x7E]/g, '')
              .replace(/\//g, '')
              .replace(/(^[\s-]+|[\s-]+$)/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
    };

    for (const d of divs) {
      const ds = enOnly(d.divisionalSecretariat);
      if (ds) {
        set.add(ds);
      }
    }
    return Array.from(set).sort();
  });

  filteredAdminDivisions = computed(() => {
    const filter = this.adminFilterText().toLowerCase().trim();
    const all = this.uniqueAdminDivisions();
    if (!filter) return all.slice(0, 50);
    return all.filter(a => a.toLowerCase().includes(filter)).slice(0, 50);
  });

  settings = signal<LandSettings>(DEFAULT_LAND_SETTINGS);
  availableCustomers = signal<Customer[]>([]);
  isSaving = signal<boolean>(false);
  currentStepIndex = signal<number>(0);

  // Selected Job Type Configuration
  selectedJobType = signal<JobTypeConfig | null>(null);

  // Dynamic documentation list for Stage 2
  dynamicDocuments = signal<LandJobDocument[]>([]);

  // Dynamic verification stages for Stage 3
  dynamicVerificationStages = signal<LandJobVerificationStage[]>([]);

  // Forms for each step
  initialForm!: FormGroup;
  completionForm!: FormGroup;

  selectedCustomerName = signal<string>('');

  customerFilterText = signal<string>('');
  filteredCustomers = computed(() => {
    const filter = this.customerFilterText().toLowerCase().trim();
    const list = this.availableCustomers();
    if (!filter) return list.slice(0, 20);
    return list.filter(c => 
      (c.name && c.name.toLowerCase().includes(filter)) ||
      (c.nic && c.nic.toLowerCase().includes(filter)) ||
      (c.tpno && c.tpno.toLowerCase().includes(filter))
    ).slice(0, 20);
  });

  // Stage 2 & 4 summary metrics
  totalDocsCount = computed(() => this.dynamicDocuments().length);
  mandatoryDocsCount = computed(() => this.dynamicDocuments().filter(d => d.isMandatory).length);
  receivedDocsCount = computed(() => this.dynamicDocuments().filter(d => d.received || d.status === 'Uploaded').length);
  uploadedMandatoryCount = computed(() => this.dynamicDocuments().filter(d => d.isMandatory && (d.received || d.status === 'Uploaded')).length);
  allMandatoryUploaded = computed(() => this.mandatoryDocsCount() === 0 || this.uploadedMandatoryCount() >= this.mandatoryDocsCount());

  currentStageName = computed(() => {
    switch (this.currentStepIndex()) {
      case 0: return 'Stage 1: Initial Setup';
      case 1: return 'Stage 2: Documentation';
      case 2: return 'Stage 3: Verification';
      case 3: return 'Stage 4: Completion';
      default: return 'Land Task Wizard';
    }
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { existingJob?: LandJob }) {
    if (data?.existingJob) {
      this.existingJob = data.existingJob;
      this.isEditMode.set(true);
    }
    this.initForms();
  }

  ngOnInit() {
    this.loadSettingsAndData();
  }

  isFieldRequired(fieldKey: string): boolean {
    const reqMap = this.settings().formRequiredFields || DEFAULT_FORM_REQUIRED_FIELDS;
    return reqMap[fieldKey] === true;
  }

  private updateFormValidators() {
    if (!this.initialForm) return;
    const reqMap = this.settings().formRequiredFields || DEFAULT_FORM_REQUIRED_FIELDS;
    const fields = Object.keys(DEFAULT_FORM_REQUIRED_FIELDS);

    fields.forEach(fieldKey => {
      const control = this.initialForm.get(fieldKey);
      if (control) {
        if (reqMap[fieldKey] === true) {
          control.setValidators([Validators.required]);
        } else {
          control.clearValidators();
        }
        control.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  private initForms() {
    const ej = this.existingJob;

    this.initialForm = this.fb.group({
      jobTypeId: [ej?.jobTypeId || '', Validators.required],
      // Customer
      customerId: [ej?.customerId || ''],
      customerName: [ej?.customerName || ''],
      customerNic: [ej?.customerNic || ''],
      customerPhone: [ej?.customerPhone || ''],
      customerAddress: [ej?.customerAddress || ''],
      customerEmail: [ej?.customerEmail || ''],
      // Land
      deedNumber: [ej?.deedNumber || ''],
      planNumber: [ej?.planNumber || ''],
      lotNumber: [ej?.lotNumber || ''],
      landName: [ej?.landName || ''],
      sizeSqm: [ej?.sizeSqm || null],
      extentText: [ej?.extentText || ''],
      locationAddress: [ej?.locationAddress || ''],
      division: [ej?.division ? ej.division.split('/').pop()?.trim() : ''],
      gramaNiladhariDivision: [ej?.gramaNiladhariDivision || ''],
      gpsCoordinates: [ej?.gpsCoordinates || ''],
      priority: [ej?.priority || 'Normal'],
      initialNotes: [ej?.initialNotes || '']
    });

    this.updateFormValidators();

    if (ej?.customerName) {
      this.selectedCustomerName.set(ej.customerName);
    }

    this.completionForm = this.fb.group({
      assignedOfficer: [ej?.assignedOfficer || ''],
      finalDecision: [ej?.finalDecision || 'Approved'],
      completionRemarks: [ej?.completionRemarks || ''],
      certificateOrGrantNo: [ej?.certificateOrGrantNo || '']
    });

    if (ej?.documents) {
      this.dynamicDocuments.set([...ej.documents]);
    }
    if (ej?.verificationStages) {
      this.dynamicVerificationStages.set([...ej.verificationStages]);
    }
  }

  private loadSettingsAndData() {
    this.landService.getSettings().subscribe({
      next: (s) => {
        this.settings.set(s);
        this.updateFormValidators();
        const ej = this.existingJob;

        if (ej && ej.jobTypeId) {
          const matchedJt = s.jobTypes.find(j => j.id === ej.jobTypeId) || null;
          this.selectedJobType.set(matchedJt);
          
          // Position stepper to current stage
          setTimeout(() => {
            if (this.stepper) {
              if (ej.status === 'Documentation') this.stepper.selectedIndex = 1;
              else if (ej.status === 'Verification') this.stepper.selectedIndex = 2;
              else if (ej.status === 'Completed') this.stepper.selectedIndex = 3;
            }
          }, 100);
        } else if (!this.selectedJobType() && s.jobTypes?.length > 0) {
          const first = s.jobTypes.find(j => j.isActive) || s.jobTypes[0];
          this.onJobTypeChange(first.id);
        }
      }
    });

    this.customerService.getCustomers().subscribe({
      next: (custs) => {
        this.availableCustomers.set(custs || []);
      }
    });

    this.settingsService.getSystemDefaults().subscribe(defaults => {
      this.systemDefaults.set(defaults || null);
      if (defaults && !this.existingJob) {
        if (defaults.divisionalSecretariat) {
          const enOnly = (s: string) => s.replace(/[^\x20-\x7E]/g, '').replace(/\//g, '').replace(/(^[\s-]+|[\s-]+$)/g, '').replace(/\s{2,}/g, ' ').trim();
          this.initialForm.patchValue({ division: enOnly(defaults.divisionalSecretariat) });
        }
      }
    });

    this.settingsService.getDivisions().subscribe(divs => {
      this.allDivisions.set(divs);
    });
  }

  onStepChange(event: any) {
    this.currentStepIndex.set(event.selectedIndex);
  }

  onJobTypeChange(jobTypeId: string) {
    this.initialForm.patchValue({ jobTypeId });
    const jt = this.settings().jobTypes.find(j => j.id === jobTypeId) || null;
    this.selectedJobType.set(jt);

    if (jt) {
      // If not editing an existing job with populated docs, load template
      if (!this.existingJob || this.dynamicDocuments().length === 0) {
        const docs: LandJobDocument[] = (jt.requiredDocumentTypes || []).map(dt => ({
          docTypeId: dt.id,
          docTypeName: dt.name,
          isMandatory: dt.isMandatory,
          received: false,
          status: 'Pending',
          remarks: ''
        }));
        this.dynamicDocuments.set(docs);
      }

      // If not editing an existing job with populated stages, load template
      if (!this.existingJob || this.dynamicVerificationStages().length === 0) {
        const stages: LandJobVerificationStage[] = (jt.verificationStages || []).map(vs => ({
          stageId: vs.id,
          stageName: vs.stageName,
          assignedRole: vs.assignedRole,
          status: 'Pending',
          findings: '',
          recommendation: '',
          checklistResults: (vs.checklist || []).map(item => ({
            item,
            checked: false
          }))
        }));
        this.dynamicVerificationStages.set(stages);
      }
    }
  }

  onSelectExistingCustomer(customer: Customer) {
    this.selectedCustomerName.set(customer.name);
    this.initialForm.patchValue({
      customerId: customer.id || '',
      customerName: customer.name || '',
      customerNic: customer.nic || '',
      customerPhone: customer.tpno || '',
      customerAddress: customer.address || '',
      gramaNiladhariDivision: customer.division || ''
    });
    this.notif.info(`Loaded citizen profile: ${customer.name}`);
  }

  clearCustomerSelection() {
    this.selectedCustomerName.set('');
    this.customerFilterText.set('');
    this.initialForm.patchValue({
      customerId: '',
      customerName: '',
      customerNic: '',
      customerPhone: '',
      customerAddress: ''
    });
  }

  async openNewCustomerDialog() {
    const dialogRef = this.dialog.open(CustomerDialogComponent, {
      width: '500px',
      data: { divisions: this.allDivisions() }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          const id = await this.customerService.addCustomer(result);
          this.notif.success('Citizen registered successfully');
          
          this.selectedCustomerName.set(result.name);
          this.initialForm.patchValue({
            customerId: id,
            customerName: result.name,
            customerNic: result.nic,
            customerPhone: result.tpno,
            customerAddress: result.address,
            gramaNiladhariDivision: result.division || ''
          });
        } catch (error) {
          console.error('Error creating customer:', error);
          this.notif.error('Failed to register citizen');
        }
      }
    });
  }

  async handleFileUpload(event: Event, docIndex: number) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const docs = [...this.dynamicDocuments()];
    const targetDoc = { ...docs[docIndex] };

    try {
      const tempRef = this.existingJob?.jobRef || this.initialForm.get('lotNumber')?.value || 'TEMP_PARCEL';
      const fileUrl = await this.landService.uploadDocumentFile(file, tempRef);

      targetDoc.fileName = file.name;
      targetDoc.fileSize = file.size;
      targetDoc.fileUrl = fileUrl;
      targetDoc.status = 'Uploaded';
      targetDoc.uploadedAt = Date.now();
      targetDoc.storageDestination = 'firebase';

      docs[docIndex] = targetDoc;
      this.dynamicDocuments.set(docs);
      this.notif.success(`Document uploaded: ${file.name}`);
    } catch (e: any) {
      this.notif.error('File upload failed: ' + (e?.message || 'Unknown error'));
    }
  }

  removeDocumentFile(docIndex: number) {
    const docs = [...this.dynamicDocuments()];
    docs[docIndex] = {
      ...docs[docIndex],
      fileName: undefined,
      fileSize: undefined,
      fileUrl: undefined,
      status: 'Pending'
    };
    this.dynamicDocuments.set(docs);
  }

  toggleDocReceived(docIndex: number, received: boolean) {
    const docs = [...this.dynamicDocuments()];
    const doc = { ...docs[docIndex], received };
    if (received && doc.status === 'Pending') {
      doc.status = doc.fileName ? 'Uploaded' : 'Verified';
    } else if (!received && !doc.fileName) {
      doc.status = 'Pending';
    }
    docs[docIndex] = doc;
    this.dynamicDocuments.set(docs);
  }

  toggleAllDocsReceived(received: boolean) {
    const docs = this.dynamicDocuments().map(doc => {
      const updated = { ...doc, received };
      if (received && updated.status === 'Pending') {
        updated.status = updated.fileName ? 'Uploaded' : 'Verified';
      } else if (!received && !updated.fileName) {
        updated.status = 'Pending';
      }
      return updated;
    });
    this.dynamicDocuments.set(docs);
  }

  toggleChecklistItem(stageIndex: number, itemIndex: number) {
    const stages = [...this.dynamicVerificationStages()];
    const stage = { ...stages[stageIndex] };
    const items = [...stage.checklistResults];
    
    items[itemIndex] = {
      ...items[itemIndex],
      checked: !items[itemIndex].checked
    };
    stage.checklistResults = items;

    // Auto-update stage status based on checks
    const allChecked = items.every(i => i.checked);
    if (allChecked && items.length > 0) {
      stage.status = 'Approved';
    } else if (items.some(i => i.checked)) {
      stage.status = 'In Progress';
    } else {
      stage.status = 'Pending';
    }

    stages[stageIndex] = stage;
    this.dynamicVerificationStages.set(stages);
  }

  toggleCheckAll(stageIndex: number, check: boolean) {
    const stages = [...this.dynamicVerificationStages()];
    const stage = { ...stages[stageIndex] };
    stage.checklistResults = stage.checklistResults.map(i => ({ ...i, checked: check }));
    stage.status = check ? 'Approved' : 'Pending';
    stages[stageIndex] = stage;
    this.dynamicVerificationStages.set(stages);
  }

  updateStageStatus(stageIndex: number, status: 'Pending' | 'In Progress' | 'Approved' | 'Rejected') {
    const stages = [...this.dynamicVerificationStages()];
    stages[stageIndex] = {
      ...stages[stageIndex],
      status
    };
    this.dynamicVerificationStages.set(stages);
  }

  updateStageFindings(stageIndex: number, findings: string) {
    const stages = [...this.dynamicVerificationStages()];
    stages[stageIndex] = {
      ...stages[stageIndex],
      findings
    };
    this.dynamicVerificationStages.set(stages);
  }

  updateDocRemarks(docIndex: number, remarks: string) {
    const docs = [...this.dynamicDocuments()];
    docs[docIndex] = {
      ...docs[docIndex],
      remarks
    };
    this.dynamicDocuments.set(docs);
  }

  // Determine stage based on step or data
  getStageByStepIndex(stepIdx: number): LandJobStatus {
    switch (stepIdx) {
      case 0: return 'Initial';
      case 1: return 'Documentation';
      case 2: return 'Verification';
      case 3: return 'Completed';
      default: return 'Initial';
    }
  }

  /**
   * Save and Exit at ANY stage
   */
  async saveAndExit(explicitStage?: LandJobStatus) {
    // Validate Stage 1 basics (required before saving any task)
    if (this.initialForm.invalid) {
      this.initialForm.markAllAsTouched();
      this.notif.warning('Please complete the mandatory initial details (Job Type, Customer, Deed/Lot, Division) to save this task.');
      // Switch stepper to step 0 if not already there
      if (this.stepper && this.stepper.selectedIndex !== 0) {
        this.stepper.selectedIndex = 0;
      }
      return;
    }

    const jt = this.selectedJobType();
    if (!jt) {
      this.notif.warning('Please select a valid Job Type.');
      return;
    }

    this.isSaving.set(true);

    const stepIndex = this.currentStepIndex();
    const stageToSave = explicitStage || this.getStageByStepIndex(stepIndex);
    const initialVal = this.initialForm.value;
    const completionVal = this.completionForm.value;

    const payload: Omit<LandJob, 'id' | 'jobRef' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
      jobTypeId: jt.id,
      jobTypeName: jt.name,
      priority: initialVal.priority,
      status: stageToSave,

      // Customer
      customerId: initialVal.customerId || undefined,
      customerName: initialVal.customerName,
      customerNic: initialVal.customerNic,
      customerPhone: initialVal.customerPhone,
      customerAddress: initialVal.customerAddress,
      customerEmail: initialVal.customerEmail || undefined,

      // Land Details
      deedNumber: initialVal.deedNumber,
      planNumber: initialVal.planNumber,
      lotNumber: initialVal.lotNumber,
      landName: initialVal.landName || undefined,
      sizeSqm: initialVal.sizeSqm ? Number(initialVal.sizeSqm) : undefined,
      extentText: initialVal.extentText || undefined,
      locationAddress: initialVal.locationAddress,
      division: initialVal.division,
      gramaNiladhariDivision: initialVal.gramaNiladhariDivision || undefined,
      gpsCoordinates: initialVal.gpsCoordinates || undefined,
      initialNotes: initialVal.initialNotes || undefined,

      // Documents
      documents: this.dynamicDocuments(),
      documentationRemarks: '',

      // Verification
      verificationStages: this.dynamicVerificationStages(),
      verificationRemarks: '',

      // Completion
      assignedOfficer: completionVal.assignedOfficer || undefined,
      finalDecision: stageToSave === 'Completed' ? completionVal.finalDecision : undefined,
      completionRemarks: completionVal.completionRemarks || undefined,
      completedDate: stageToSave === 'Completed' ? new Date().toISOString().split('T')[0] : undefined,
      certificateOrGrantNo: completionVal.certificateOrGrantNo || undefined
    };

    try {
      if (this.isEditMode() && this.existingJob?.id) {
        await this.landService.updateLandJob(
          this.existingJob.id,
          payload,
          `Saved task progress at ${stageToSave}`
        );
        this.notif.success(`Land task ${this.existingJob.jobRef} saved at [${stageToSave}]!`);
        this.dialogRef.close({ success: true, docId: this.existingJob.id });
      } else {
        const docId = await this.landService.createLandJob(payload);
        this.notif.success(`Land task registered & saved at [${stageToSave}]! You can resume it anytime.`);
        this.dialogRef.close({ success: true, docId });
      }
    } catch (err: any) {
      console.error('Failed to save land task:', err);
      this.notif.error('Failed to save: ' + (err?.message || 'Server error'));
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Finalize and complete from Stage 4
   */
  async finalizeJob() {
    await this.saveAndExit('Completed');
  }

  close() {
    this.dialogRef.close();
  }
}
