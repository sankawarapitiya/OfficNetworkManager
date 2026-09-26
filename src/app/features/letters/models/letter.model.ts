export type LetterStatus = 
  | 'Received'
  | 'In Review'
  | 'Action Required'
  | 'In Progress'
  | 'Completed'
  | 'Dispatched'
  | 'Archived';

export type LetterPriority = 'Normal' | 'Urgent' | 'Immediate';

export interface LetterAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  storage_destination: 'firebase' | 'network';
  storage_url?: string;
  network_path?: string;
  uploaded_at: number;
  uploaded_by: string;
}

export interface LetterActionLog {
  id: string;
  timestamp: number;
  officer_name: string;
  officer_id: string;
  from_status: string;
  to_status: string;
  remarks: string;
}

export interface Letter {
  id?: string;
  title: string;
  ref_number: string;
  link_ref?: string;
  received_from: string;
  received_date: string;
  send_to: string[];                 // Department names
  assigned_to: string[];             // System user IDs or emails
  assigned_user_names?: string[];    // Denormalized user display names
  description: string;
  category: string;
  priority: LetterPriority;
  status: LetterStatus;
  attachments?: LetterAttachment[];
  action_logs?: LetterActionLog[];
  created_at: number;
  created_by: string;
  updated_at: number;
  updated_by: string;
}

export interface LetterSettings {
  network_storage_locations: string[];
  default_storage: 'firebase' | 'network';
  categories: string[];
  priorities: string[];

  // Reference Number Auto-Generation Format Settings
  ref_prefix?: string;            // e.g. 'LET' or 'DS/LW' or 'ADM'
  ref_format?: string;            // e.g. '{PREFIX}/{YYYY}/{MM}/{SEQ}' or '{PREFIX}/{YYYY}/{SEQ}'
  ref_seq_digits?: number;        // e.g. 3, 4, 5
  ref_next_seq?: number;          // e.g. 1 (running sequential number)
  ref_auto_generate?: boolean;    // e.g. true
}

export const DEFAULT_LETTER_SETTINGS: LetterSettings = {
  network_storage_locations: [
    '\\\\SERVER\\OfficialLetters\\Inward',
    '\\\\SERVER\\OfficialLetters\\Directives',
    '\\\\NAS-OFFICE\\Letters\\Confidential'
  ],
  default_storage: 'firebase',
  categories: [
    'General Inward',
    'Ministerial Directive',
    'Citizen Petition',
    'Legal & Arbitration',
    'Land Title Inquiry',
    'Financial & Procurement',
    'Inter-Departmental Memo'
  ],
  priorities: ['Normal', 'Urgent', 'Immediate'],

  ref_prefix: 'LET',
  ref_format: '{PREFIX}/{YYYY}/{MM}/{SEQ}',
  ref_seq_digits: 3,
  ref_next_seq: 1,
  ref_auto_generate: true
};

export function generateLetterRefNumber(settings: Partial<LetterSettings>, seqOverride?: number): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const prefix = (settings.ref_prefix || 'LET').trim();
  const digits = settings.ref_seq_digits || 3;
  const seqNum = seqOverride ?? (settings.ref_next_seq || 1);
  const seqStr = String(seqNum).padStart(digits, '0');

  let pattern = settings.ref_format || '{PREFIX}/{YYYY}/{MM}/{SEQ}';
  return pattern
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{SEQ\}/g, seqStr)
    .replace(/\{NUM\}/g, seqStr);
}

export const ALL_LETTER_STATUSES: LetterStatus[] = [
  'Received',
  'In Review',
  'Action Required',
  'In Progress',
  'Completed',
  'Dispatched',
  'Archived'
];
