export interface ModulePartPermission {
  id: string;          // Full permission key, e.g. 'customers:create'
  partKey: string;     // Local action key, e.g. 'create'
  name: string;        // Human-readable title, e.g. 'Register New Customers'
  description: string; // Explanatory description
}

export interface ModulePermissionDefinition {
  moduleId: string;    // 'dashboard' | 'customers' | 'hr' | 'land' | 'work-plans' | 'letters'
  moduleName: string;  // e.g. 'Customer & Citizen Registry'
  icon: string;        // Material icon name
  badgeColor: string;  // Visual accent class
  description: string;
  parts: ModulePartPermission[];
}

export const SYSTEM_MODULE_PERMISSIONS: ModulePermissionDefinition[] = [
  {
    moduleId: 'dashboard',
    moduleName: 'Executive Dashboard',
    icon: 'dashboard',
    badgeColor: 'indigo',
    description: 'Central operations overview, telemetry metrics and high-level KPIs',
    parts: [
      {
        id: 'dashboard:view_overview',
        partKey: 'view_overview',
        name: 'View Global Overview',
        description: 'Access executive summary cards, active totals & operational vitals'
      },
      {
        id: 'dashboard:view_analytics',
        partKey: 'view_analytics',
        name: 'View Analytics & Graphs',
        description: 'View dynamic charts, divisional metrics and throughput graphs'
      },
      {
        id: 'dashboard:export_reports',
        partKey: 'export_reports',
        name: 'Export Platform Reports',
        description: 'Download executive summaries, performance reports & CSV exports'
      }
    ]
  },
  {
    moduleId: 'customers',
    moduleName: 'Customer & Citizen Registry',
    icon: 'people',
    badgeColor: 'blue',
    description: 'Citizen records, corporate stakeholders, identity profiles and filings',
    parts: [
      {
        id: 'customers:view',
        partKey: 'view',
        name: 'Browse Citizen Directory',
        description: 'Search and inspect registered citizen & company profiles'
      },
      {
        id: 'customers:create',
        partKey: 'create',
        name: 'Register New Citizens',
        description: 'Create new customer profiles and initial identity records'
      },
      {
        id: 'customers:edit',
        partKey: 'edit',
        name: 'Edit Customer Records',
        description: 'Modify contact information, addresses, identity proofs & notes'
      },
      {
        id: 'customers:delete',
        partKey: 'delete',
        name: 'Archive & Delete Profiles',
        description: 'Permanently remove or archive customer records'
      },
      {
        id: 'customers:export',
        partKey: 'export',
        name: 'Export Customer Data',
        description: 'Export customer listings and registry spreadsheets'
      }
    ]
  },
  {
    moduleId: 'hr',
    moduleName: 'Human Resources & Staffing',
    icon: 'badge',
    badgeColor: 'teal',
    description: 'Staff directory, payroll assignments, attendance and performance records',
    parts: [
      {
        id: 'hr:view_directory',
        partKey: 'view_directory',
        name: 'View Officer Directory',
        description: 'View employee roster, departmental staff lists and phonebooks'
      },
      {
        id: 'hr:manage_employees',
        partKey: 'manage_employees',
        name: 'Manage Personnel Records',
        description: 'Add new staff members, update postings and record contract status'
      },
      {
        id: 'hr:manage_attendance',
        partKey: 'manage_attendance',
        name: 'Attendance & Leave Tracking',
        description: 'Review staff attendance logs, shift rotations and leave approvals'
      },
      {
        id: 'hr:manage_payroll',
        partKey: 'manage_payroll',
        name: 'Payroll & Compensation',
        description: 'Access salary structures, pay grades and payroll disbursement records'
      }
    ]
  },
  {
    moduleId: 'land',
    moduleName: 'Land Administration & Cadastral',
    icon: 'terrain',
    badgeColor: 'amber',
    description: 'Cadastral parcels, survey records, title deeds and boundary arbitrations',
    parts: [
      {
        id: 'land:view_parcels',
        partKey: 'view_parcels',
        name: 'Browse Land Parcels',
        description: 'Search cadastral plots, boundaries, GPS locations and survey records'
      },
      {
        id: 'land:register_deed',
        partKey: 'register_deed',
        name: 'Register Deeds & Titles',
        description: 'Record new title deeds, survey plans and official ownership filings'
      },
      {
        id: 'land:transfer_ownership',
        partKey: 'transfer_ownership',
        name: 'Process Ownership Transfers',
        description: 'Execute conveyancing, inheritance transfers and buyer re-registrations'
      },
      {
        id: 'land:manage_disputes',
        partKey: 'manage_disputes',
        name: 'Boundary Dispute Resolution',
        description: 'Log disputes, record tribunal decisions, caveats and legal encumbrances'
      },
      {
        id: 'land:delete_record',
        partKey: 'delete_record',
        name: 'Revoke / Delete Land Records',
        description: 'Purge voided registrations or annul erroneous survey entries'
      }
    ]
  },
  {
    moduleId: 'work-plans',
    moduleName: 'Work Plans & Directives',
    icon: 'assignment',
    badgeColor: 'purple',
    description: 'Operational work plans, monthly task cycles, milestone tracking and audits',
    parts: [
      {
        id: 'work-plans:view_tasks',
        partKey: 'view_tasks',
        name: 'View Task List & Kanban',
        description: 'Browse monthly execution tasks, personal directives and progress cards'
      },
      {
        id: 'work-plans:view_all_summary',
        partKey: 'view_all_summary',
        name: 'View All Users Summary',
        description: 'View consolidated multi-officer progress metrics and team throughput'
      },
      {
        id: 'work-plans:create_plan',
        partKey: 'create_plan',
        name: 'Author New Directives',
        description: 'Create operational directives, allocate budgets and define milestones'
      },
      {
        id: 'work-plans:edit_plan',
        partKey: 'edit_plan',
        name: 'Edit & Reassign Directives',
        description: 'Update directive milestones, change deadline dates and assign officers'
      },
      {
        id: 'work-plans:delete_plan',
        partKey: 'delete_plan',
        name: 'Delete / Cancel Directives',
        description: 'Cancel or permanently remove directive items from the work cycle'
      },
      {
        id: 'work-plans:verify_signoff',
        partKey: 'verify_signoff',
        name: 'Verification & Audit Sign-off',
        description: 'Sign off on completed work plans, approve deliverables or request revisions'
      },
      {
        id: 'work-plans:manage_policies',
        partKey: 'manage_policies',
        name: 'Work Plan Policy Settings',
        description: 'Configure carry-forward rules, review cycles and role permissions'
      },
      {
        id: 'work-plans:all_reports',
        partKey: 'all_reports',
        name: 'Generate All Officers Reports',
        description: 'Generate and print whole-month pending, completed and master registers for all officers'
      },
      {
        id: 'work-plans:individual_reports',
        partKey: 'individual_reports',
        name: 'Generate Individual Officer Reports',
        description: 'Generate and export personal A4 Officer Dossier and individual directives'
      }
    ]
  },
  {
    moduleId: 'letters',
    moduleName: 'Official Letters & Dispatch',
    icon: 'mail',
    badgeColor: 'emerald',
    description: 'Government correspondence registers, dispatch books and ministerial communications',
    parts: [
      {
        id: 'letters:view_inward',
        partKey: 'view_inward',
        name: 'View Inward Registry',
        description: 'Browse incoming communications, citizen petitions and official mail'
      },
      {
        id: 'letters:view_outward',
        partKey: 'view_outward',
        name: 'View Outward Dispatches',
        description: 'Inspect outbound official memos, gazette letters and legal responses'
      },
      {
        id: 'letters:create_letter',
        partKey: 'create_letter',
        name: 'Draft & Dispatch Letters',
        description: 'Draft official correspondence, attach digital files and issue tracking numbers'
      },
      {
        id: 'letters:sign_approve',
        partKey: 'sign_approve',
        name: 'Sign & Authorize Letters',
        description: 'Affix executive digital sign-off and seal for official issuance'
      },
      {
        id: 'letters:archive_letter',
        partKey: 'archive_letter',
        name: 'Archive & Restrict Documents',
        description: 'Classify documents, manage confidential archives and seal case files'
      }
    ]
  }
];

export const ALL_SYSTEM_PERMISSION_IDS: string[] = SYSTEM_MODULE_PERMISSIONS.flatMap(m =>
  m.parts.map(p => p.id)
);

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': [...ALL_SYSTEM_PERMISSION_IDS],

  'Divisional Admin': [
    'dashboard:view_overview',
    'dashboard:view_analytics',
    'dashboard:export_reports',
    'customers:view',
    'customers:create',
    'customers:edit',
    'customers:export',
    'hr:view_directory',
    'land:view_parcels',
    'land:register_deed',
    'land:transfer_ownership',
    'land:manage_disputes',
    'work-plans:view_tasks',
    'work-plans:view_all_summary',
    'work-plans:create_plan',
    'work-plans:edit_plan',
    'work-plans:verify_signoff',
    'work-plans:all_reports',
    'work-plans:individual_reports',
    'letters:view_inward',
    'letters:view_outward',
    'letters:create_letter',
    'letters:sign_approve'
  ],

  'Department Head': [
    'dashboard:view_overview',
    'dashboard:view_analytics',
    'customers:view',
    'customers:create',
    'customers:edit',
    'hr:view_directory',
    'land:view_parcels',
    'land:register_deed',
    'work-plans:view_tasks',
    'work-plans:view_all_summary',
    'work-plans:create_plan',
    'work-plans:edit_plan',
    'work-plans:verify_signoff',
    'work-plans:all_reports',
    'work-plans:individual_reports',
    'letters:view_inward',
    'letters:view_outward',
    'letters:create_letter',
    'letters:sign_approve'
  ],

  'Staff': [
    'dashboard:view_overview',
    'customers:view',
    'customers:create',
    'land:view_parcels',
    'land:register_deed',
    'work-plans:view_tasks',
    'work-plans:create_plan',
    'work-plans:individual_reports',
    'letters:view_inward',
    'letters:create_letter'
  ],

  'HR': [
    'dashboard:view_overview',
    'hr:view_directory',
    'hr:manage_employees',
    'hr:manage_attendance',
    'hr:manage_payroll',
    'work-plans:view_tasks',
    'work-plans:create_plan',
    'work-plans:individual_reports',
    'letters:view_inward',
    'letters:view_outward',
    'letters:create_letter'
  ],

  'Field Agent': [
    'dashboard:view_overview',
    'customers:view',
    'customers:create',
    'land:view_parcels',
    'work-plans:view_tasks',
    'work-plans:individual_reports',
    'letters:view_inward'
  ]
};
