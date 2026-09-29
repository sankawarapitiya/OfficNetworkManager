export type LandJobStatus = 
  | 'Initial'
  | 'Documentation'
  | 'Verification'
  | 'Completed'
  | 'Rejected'
  | 'On Hold';

export type LandPriority = 'Normal' | 'Urgent' | 'Immediate';

export interface LandDocTypeConfig {
  id: string;
  name: string;
  code?: string;
  isMandatory: boolean;
  description?: string;
}

export interface LandVerificationStageConfig {
  id: string;
  stageName: string;
  assignedRole: string; // e.g. 'Field Officer', 'Surveyor', 'Legal Officer', 'Divisional Admin'
  checklist: string[];
  isMandatory: boolean;
  description?: string;
}

export interface JobTypeConfig {
  id: string;
  name: string;
  code: string;
  description: string;
  estimatedDays: number;
  isActive: boolean;
  requiredDocumentTypes: LandDocTypeConfig[];
  verificationStages: LandVerificationStageConfig[];
}

export interface LandJobDocument {
  docTypeId: string;
  docTypeName: string;
  isMandatory: boolean;
  status: 'Pending' | 'Uploaded' | 'Verified' | 'Exempted';
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  storageDestination?: 'firebase' | 'network';
  uploadedAt?: number;
  uploadedBy?: string;
  remarks?: string;
}

export interface LandJobVerificationChecklistResult {
  item: string;
  checked: boolean;
}

export interface LandJobVerificationStage {
  stageId: string;
  stageName: string;
  assignedRole: string;
  officerName?: string;
  officerId?: string;
  status: 'Pending' | 'In Progress' | 'Approved' | 'Rejected';
  checklistResults: LandJobVerificationChecklistResult[];
  findings?: string;
  recommendation?: string;
  completedAt?: number;
}

export interface LandJob {
  id?: string;
  jobRef: string; // e.g. LND-2026-0001
  jobTypeId: string;
  jobTypeName: string;
  priority: LandPriority;
  status: LandJobStatus;

  // Stage 1: Initial (Customer & Land Details & Division)
  customerId?: string;
  customerName: string;
  customerNic: string;
  customerPhone: string;
  customerAddress: string;
  customerEmail?: string;

  deedNumber: string;
  planNumber: string;
  lotNumber: string;
  landName?: string;
  sizeSqm?: number;
  extentText?: string; // e.g. "0A-1R-20P" or "500 sq.m"
  locationAddress: string;
  division: string;
  gramaNiladhariDivision?: string;
  gpsCoordinates?: string;
  initialNotes?: string;

  // Stage 2: Documentation
  documents: LandJobDocument[];
  documentationRemarks?: string;

  // Stage 3: Verification
  verificationStages: LandJobVerificationStage[];
  verificationRemarks?: string;

  // Stage 4: Completion
  finalDecision?: 'Approved' | 'Rejected' | 'Conditional Approval';
  completionRemarks?: string;
  completedDate?: string;
  approvedByOfficerName?: string;
  certificateOrGrantNo?: string;

  // Metadata
  assignedOfficer?: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}

export interface LandAuditRecord {
  id?: string;
  jobId: string;
  jobRef: string;
  jobTypeName: string;
  actionType: 'CREATED' | 'DOC_SUBMITTED' | 'STAGE_TRANSITION' | 'VERIFICATION_UPDATED' | 'COMPLETED' | 'UPDATED' | 'DELETED';
  officerId: string;
  officerName: string;
  details: string;
  fromStage?: string;
  toStage?: string;
  timestamp: number;
}

export interface LandSettings {
  jobTypes: JobTypeConfig[];
  divisions: string[];
  defaultJobPrefix: string;
  refFormat: string; // e.g. "{PREFIX}-{YYYY}-{SEQ}"
  nextSeq: number;
  priorities: LandPriority[];
  defaultSlaDays: number;
}

export const DEFAULT_DIVISIONS: string[] = [
  'West Division',
  'Central Division',
  'East Division',
  'North Division',
  'Southern Coastal Division',
  'Highland Division'
];

export const DEFAULT_JOB_TYPES: JobTypeConfig[] = [
  {
    id: 'jt_subdivision',
    name: 'Land Sub-division / Partition',
    code: 'SUB',
    description: 'Partitioning of an existing cadastral land parcel into two or more individual lots.',
    estimatedDays: 21,
    isActive: true,
    requiredDocumentTypes: [
      { id: 'doc_deed', name: 'Original Title Deed / Certified Extract', code: 'DEED', isMandatory: true, description: 'Copy of registered deed certified by Land Registry' },
      { id: 'doc_survey_plan', name: 'Cadastral Survey Plan (Original & Proposed)', code: 'PLAN', isMandatory: true, description: 'Prepared by a Licensed Surveyor with lot coordinates' },
      { id: 'doc_nic', name: 'National Identity Card (NIC) / Passport Copy', code: 'NIC', isMandatory: true, description: 'Proof of applicant ownership identity' },
      { id: 'doc_local_council', name: 'Local Authority (Pradeshiya Sabha/MC) Clearance', code: 'LCC', isMandatory: true, description: 'Certificate of non-vesting and street line clearance' },
      { id: 'doc_title_report', name: '30-Year Title Search & Pedigree Report', code: 'REP', isMandatory: false, description: 'Title search report issued by an Attorney-at-Law' }
    ],
    verificationStages: [
      {
        id: 'vs_field_survey',
        stageName: 'Physical Boundary Inspection & Ground Survey',
        assignedRole: 'Surveyor',
        isMandatory: true,
        checklist: [
          'Verify existing boundary landmarks and corner stones',
          'Ensure minimum access road width satisfies planning regulations',
          'Inspect physical overlaps with adjacent parcels',
          'Confirm no unauthorized encroachments on state reservations'
        ]
      },
      {
        id: 'vs_legal_clearance',
        stageName: 'Legal & Encumbrance Verification',
        assignedRole: 'Legal Officer',
        isMandatory: true,
        checklist: [
          'Verify applicant is lawful owner with clear unencumbered title',
          'Check for pending partition litigation or lis pendens caveats',
          'Verify local tax assessment receipts are up to date'
        ]
      },
      {
        id: 'vs_divisional_signoff',
        stageName: 'Divisional Officer Recommendation',
        assignedRole: 'Divisional Admin',
        isMandatory: true,
        checklist: [
          'Review Grama Niladhari report regarding peaceful possession',
          'Validate compliance with Town & Country Planning legislation',
          'Authorize issuance of partitioned certificate'
        ]
      }
    ]
  },
  {
    id: 'jt_boundary_survey',
    name: 'Boundary Demarcation & Dispute Survey',
    code: 'BND',
    description: 'Formal demarcation and re-establishment of lost or disputed boundary landmarks.',
    estimatedDays: 14,
    isActive: true,
    requiredDocumentTypes: [
      { id: 'doc_deed', name: 'Current Title Deed', code: 'DEED', isMandatory: true, description: 'Registered deed proving ownership' },
      { id: 'doc_survey_plan', name: 'Previous Approved Survey Plan', code: 'PLAN', isMandatory: true, description: 'Existing plan filed with Land Registry' },
      { id: 'doc_nic', name: 'Applicant NIC / Photo Identification', code: 'NIC', isMandatory: true, description: 'Proof of identity' },
      { id: 'doc_dispute_letter', name: 'Statement of Dispute / Adjoining Owner Notice', code: 'DISP', isMandatory: false, description: 'Details of boundary controversy or missing boundary pegs' }
    ],
    verificationStages: [
      {
        id: 'vs_field_demarcation',
        stageName: 'On-site Survey & Peg Placement',
        assignedRole: 'Surveyor',
        isMandatory: true,
        checklist: [
          'Issue prior written notice to adjacent land owners',
          'Execute precision traverse survey using GPS / Total Station',
          'Re-fix missing boundary pegs in presence of adjoining owners',
          'Obtain sign-offs / acknowledgments from adjoining owners'
        ]
      },
      {
        id: 'vs_dispute_arb',
        stageName: 'Cadastral Officer Endorsement',
        assignedRole: 'Field Officer',
        isMandatory: true,
        checklist: [
          'Confirm survey field notes align with registration folio',
          'Prepare formal boundary demarcation certificate'
        ]
      }
    ]
  },
  {
    id: 'jt_deed_transfer',
    name: 'Title Deed Transfer & Registration',
    code: 'TRF',
    description: 'Conveyance and title transfer following sale, gift, or inheritance.',
    estimatedDays: 10,
    isActive: true,
    requiredDocumentTypes: [
      { id: 'doc_deed_draft', name: 'Draft Deed of Transfer / Declaration', code: 'DRFT', isMandatory: true, description: 'Notarially attested deed document' },
      { id: 'doc_prev_deed', name: 'Previous Deed & Folio Extracts', code: 'PVD', isMandatory: true, description: 'Mother deed and certified folios' },
      { id: 'doc_stamp_duty', name: 'Stamp Duty Payment Slip & Valuation Certificate', code: 'VAL', isMandatory: true, description: 'Proof of duty payment to provincial revenue' },
      { id: 'doc_nic_parties', name: 'NICs of Transferor & Transferee', code: 'NIC', isMandatory: true, description: 'Copies of identification for all parties' }
    ],
    verificationStages: [
      {
        id: 'vs_title_audit',
        stageName: 'Title Examination & Duplicate Folio Audit',
        assignedRole: 'Legal Officer',
        isMandatory: true,
        checklist: [
          'Examine 30-year unbroken chain of title',
          'Check for adverse rights, leases, mortgages or caveats',
          'Verify correct valuation and duty stamps affixed'
        ]
      },
      {
        id: 'vs_registrar_signoff',
        stageName: 'Registrar of Lands Endorsement',
        assignedRole: 'Divisional Admin',
        isMandatory: true,
        checklist: [
          'Enter registration in volume and day book',
          'Issue registered deed and updated folio extract'
        ]
      }
    ]
  },
  {
    id: 'jt_state_land_lease',
    name: 'State Land Alienation / Lease',
    code: 'STT',
    description: 'Long-term lease or annual permit for crown/state land for agriculture or commercial development.',
    estimatedDays: 30,
    isActive: true,
    requiredDocumentTypes: [
      { id: 'doc_application', name: 'Formal Application for State Land', code: 'APP', isMandatory: true, description: 'Prescribed government application form' },
      { id: 'doc_project_prop', name: 'Project Proposal & Development Plan', code: 'PRP', isMandatory: true, description: 'Utilization strategy, financial plan & job creation' },
      { id: 'doc_env_clear', name: 'Environmental & Forest Dept Clearance', code: 'ENV', isMandatory: true, description: 'No-objection certificates from CEA/Forest/Wildlife' },
      { id: 'doc_nic', name: 'Applicant/Company Registration Docs', code: 'REG', isMandatory: true, description: 'BR certificate and director NICs' }
    ],
    verificationStages: [
      {
        id: 'vs_state_field',
        stageName: 'State Land Cadastral & Encroachment Check',
        assignedRole: 'Field Officer',
        isMandatory: true,
        checklist: [
          'Confirm parcel is crown/state property not previously alienated',
          'Inspect forest, water reservation or archaeological setbacks',
          'Verify no illegal squatters or traditional customary claims'
        ]
      },
      {
        id: 'vs_divisional_comm',
        stageName: 'Divisional Land Advisory Committee Review',
        assignedRole: 'Divisional Admin',
        isMandatory: true,
        checklist: [
          'Appraise economic merit and rent valuation',
          'Adopt Land Advisory Committee recommendation',
          'Submit docket to Ministry/Commissioner General of Lands'
        ]
      }
    ]
  }
];

export const DEFAULT_LAND_SETTINGS: LandSettings = {
  jobTypes: DEFAULT_JOB_TYPES,
  divisions: DEFAULT_DIVISIONS,
  defaultJobPrefix: 'LND',
  refFormat: '{PREFIX}-{YYYY}-{SEQ}',
  nextSeq: 1,
  priorities: ['Normal', 'Urgent', 'Immediate'],
  defaultSlaDays: 21
};

export function generateLandJobRef(settings: LandSettings): string {
  const prefix = settings.defaultJobPrefix || 'LND';
  const year = new Date().getFullYear();
  const seqNum = String(settings.nextSeq || 1).padStart(4, '0');
  
  const format = settings.refFormat || '{PREFIX}-{YYYY}-{SEQ}';
  return format
    .replace('{PREFIX}', prefix)
    .replace('{YYYY}', String(year))
    .replace('{SEQ}', seqNum);
}
