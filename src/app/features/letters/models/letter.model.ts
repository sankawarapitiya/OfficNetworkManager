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
  priorities: ['Normal', 'Urgent', 'Immediate']
};

export const ALL_LETTER_STATUSES: LetterStatus[] = [
  'Received',
  'In Review',
  'Action Required',
  'In Progress',
  'Completed',
  'Dispatched',
  'Archived'
];
