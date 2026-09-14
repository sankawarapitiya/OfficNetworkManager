import { Injectable, inject, signal } from '@angular/core';
import { FirestoreService } from '../../../core/services/firestore.service';
import { Observable, BehaviorSubject, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { Department } from '../../settings/settings.service';

export interface WorkPlanMilestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface WorkPlanVerifier {
  id: string;              // Unique identifier ('v_' + Date.now() or uid)
  order: number;           // 1, 2, 3... (Stage 1, Stage 2, etc.)
  name: string;            // Officer name
  email: string;           // Officer email
  role?: string;           // System role / designation
  department?: string;     // Officer department
  verified: boolean;       // True once signed off
  verifiedAt?: number | string; // Approval timestamp
  verifiedByEmail?: string;// Signer email
  reviewComment?: string;  // Verifier's review remarks / audit comment
}

export interface WorkPlan {
  id?: string;
  title: string;
  description: string;
  division: string;
  department?: string;
  category: string;
  leadName: string;         // Primary Regional Lead / 1st Verifier (maintained for backward compatibility)
  leadEmail?: string;
  verifiers?: WorkPlanVerifier[]; // Multi-stage verification pipeline
  ownerName?: string;       // Task Owner / Performer (whom task belongs to)
  ownerEmail?: string;
  ownerUid?: string;
  status: 'Draft' | 'In Progress' | 'Under Review' | 'Completed' | 'Delayed';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  progress: number;
  budget?: number;
  startDate: string;
  targetDate: string;
  assignedMonth?: string; // Format: 'YYYY-MM', e.g. '2026-09'
  milestones: WorkPlanMilestone[];
  customerId?: string;
  revisionNotes?: string;   // Rollback notes / correction requirements
  rollbackAt?: number | string; // Timestamp when rolled back
  rollbackByEmail?: string; // Officer who performed rollback
  createdBy?: string;
  createdByEmail?: string;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkPlanPolicySettings {
  autoRollover: boolean;
  archiveOriginalMonth: boolean;
  highlightRolloverBadge: boolean;
  requireAllMilestones: boolean;
  auditLogTransitions: boolean;
  rolesPermittedForSummary: string[];
  rolesPermittedForVerification: string[];
  rolesPermittedForEditAndAssign: string[];
  rolesPermittedToCreateOnBehalf: string[];
  rolesPermittedForAllReports?: string[];
  rolesPermittedForIndividualReports?: string[];
  rolesPermittedByReportType?: {
    pending?: string[];
    completed?: string[];
    master?: string[];
    individual?: string[];
    department?: string[];
    verification?: string[];
  };
  pillars: string[];
  departmentVerifierPolicies?: Record<string, number>; // departmentName -> required verifiers count
  defaultRequiredVerifiersCount?: number;             // Default fallback (e.g., 1)
}

export const DEFAULT_WORK_PLAN_SETTINGS: WorkPlanPolicySettings = {
  autoRollover: true,
  archiveOriginalMonth: true,
  highlightRolloverBadge: true,
  requireAllMilestones: true,
  auditLogTransitions: true,
  rolesPermittedForSummary: ['Super Admin', 'Divisional Admin', 'Department Head'],
  rolesPermittedForVerification: ['Super Admin', 'Divisional Admin', 'Department Head'],
  rolesPermittedForEditAndAssign: ['Super Admin', 'Divisional Admin', 'Department Head'],
  rolesPermittedToCreateOnBehalf: ['Super Admin', 'Divisional Admin', 'Department Head'],
  rolesPermittedForAllReports: ['Super Admin', 'Divisional Admin', 'Department Head'],
  rolesPermittedForIndividualReports: ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'],
  rolesPermittedByReportType: {
    pending: ['Super Admin', 'Divisional Admin', 'Department Head'],
    completed: ['Super Admin', 'Divisional Admin', 'Department Head'],
    master: ['Super Admin', 'Divisional Admin', 'Department Head'],
    individual: ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'],
    department: ['Super Admin', 'Divisional Admin', 'Department Head'],
    verification: ['Super Admin', 'Divisional Admin', 'Department Head']
  },
  pillars: ['Infrastructure', 'Land Deeds', 'Client Services', 'Operations', 'Compliance'],
  departmentVerifierPolicies: {},
  defaultRequiredVerifiersCount: 1
};

export function getWorkPlanMonth(plan: WorkPlan): string {
  if (plan.assignedMonth) return plan.assignedMonth;
  if (plan.targetDate && plan.targetDate.length >= 7) return plan.targetDate.substring(0, 7);
  if (plan.startDate && plan.startDate.length >= 7) return plan.startDate.substring(0, 7);
  return new Date().toISOString().substring(0, 7);
}

export function isPlanCarriedOver(plan: WorkPlan, runningMonth: string): boolean {
  const planMonth = getWorkPlanMonth(plan);
  return planMonth < runningMonth && plan.status !== 'Completed';
}

export function formatMonthDisplay(monthStr: string): string {
  if (!monthStr || monthStr.length < 7) return monthStr;
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getPlanDepartment(plan: WorkPlan): string {
  return plan.department || plan.division || 'General Operations';
}

export function isWorkPlanOwner(plan: WorkPlan, userEmail?: string | null, userName?: string | null, userUid?: string | null): boolean {
  if (!plan) return false;
  if (!userEmail && !userName && !userUid) return false;

  const uEmail = (userEmail || '').toLowerCase().trim();
  const uName = (userName || '').toLowerCase().trim();
  const uUid = (userUid || '').trim();
  const uPrefix = uEmail ? uEmail.split('@')[0].trim() : '';

  const oEmail = (plan.ownerEmail || '').toLowerCase().trim();
  const oName = (plan.ownerName || '').toLowerCase().trim();
  const oUid = (plan.ownerUid || '').trim();

  const hasExplicitOwner = !!(oEmail || oUid || oName);

  if (hasExplicitOwner) {
    // 1. Direct Email match on ownerEmail (primary unique identity)
    if (uEmail && oEmail) {
      return uEmail === oEmail;
    }

    // 2. Direct UID match on ownerUid
    if (uUid && oUid) {
      return uUid === oUid;
    }

    // 3. Exact ownerName or prefix match only if ownerEmail and ownerUid are not set
    if (!oEmail && !oUid && oName) {
      if (uName && oName === uName) return true;
      if (uPrefix && oName === uPrefix) return true;
    }

    // Had explicit owner fields but did not match the user
    return false;
  }

  // LEGACY FALLBACK (Only for old historical records with NO ownerEmail, NO ownerUid, and NO ownerName):
  const cUid = (plan.createdBy || '').trim();
  const cEmail = (plan.createdByEmail || '').toLowerCase().trim();
  const cName = (plan.createdByName || '').toLowerCase().trim();

  if (uEmail && cEmail && uEmail === cEmail) return true;
  if (uUid && cUid && uUid === cUid) return true;
  if (uName && cName && uName === cName) return true;

  const lEmail = (plan.leadEmail || '').toLowerCase().trim();
  const lName = (plan.leadName || '').toLowerCase().trim();

  if (uEmail && lEmail && uEmail === lEmail) return true;
  if (uName && lName && uName === lName) return true;
  if (uPrefix && lEmail && lEmail.split('@')[0].trim() === uPrefix) return true;

  return false;
}

export const PRIORITY_WEIGHTS: Record<string, number> = {
  'Urgent': 4,
  'High': 3,
  'Medium': 2,
  'Low': 1
};

export function getPlanVerifiers(plan: WorkPlan): WorkPlanVerifier[] {
  if (plan.verifiers && plan.verifiers.length > 0) {
    return plan.verifiers;
  }
  if (plan.leadName) {
    return [{
      id: 'v_legacy_1',
      order: 1,
      name: plan.leadName,
      email: plan.leadEmail || '',
      verified: plan.status === 'Completed',
      verifiedAt: plan.status === 'Completed' ? plan.updatedAt : undefined
    }];
  }
  return [];
}

export function getCompletedVerifiersCount(plan: WorkPlan): number {
  return getPlanVerifiers(plan).filter(v => v.verified).length;
}

export function areAllVerifiersApproved(plan: WorkPlan): boolean {
  const verifiers = getPlanVerifiers(plan);
  if (verifiers.length === 0) return true;
  return verifiers.every(v => v.verified);
}

export function getNextPendingVerifier(plan: WorkPlan): WorkPlanVerifier | undefined {
  const verifiers = getPlanVerifiers(plan);
  return verifiers.slice().sort((a, b) => a.order - b.order).find(v => !v.verified);
}

export function getRequiredVerifiersCountForDepartment(
  settings: WorkPlanPolicySettings,
  departmentName?: string | null,
  databaseDepartments?: Department[]
): number {
  if (!departmentName) return settings.defaultRequiredVerifiersCount || 1;
  const target = departmentName.toLowerCase().trim();

  // 1. Check if the department document in database (settings_departments) has a specific verificationQuota
  if (databaseDepartments && databaseDepartments.length > 0) {
    const match = databaseDepartments.find(d => d.name && d.name.toLowerCase().trim() === target);
    if (match && match.verificationQuota !== undefined && match.verificationQuota > 0) {
      return match.verificationQuota;
    }
  }

  // 2. Check departmentVerifierPolicies loaded from Firestore settings/work_plans
  const policies = settings.departmentVerifierPolicies || {};
  for (const [dept, count] of Object.entries(policies)) {
    if (dept.toLowerCase().trim() === target && count > 0) {
      return count;
    }
  }

  return settings.defaultRequiredVerifiersCount || 1;
}

export function isUserAssignedToVerifier(
  verifier: WorkPlanVerifier | undefined | null,
  userEmail?: string | null,
  userName?: string | null,
  userUid?: string | null
): boolean {
  if (!verifier) return false;

  const vEmail = (verifier.email || '').toLowerCase().trim();
  const vName = (verifier.name || '').toLowerCase().trim();

  // If verifier has neither email nor name specified, it's an unassigned slot
  if (!vEmail && !vName) {
    return true;
  }

  const uEmail = (userEmail || '').toLowerCase().trim();
  const uName = (userName || '').toLowerCase().trim();

  // 1. Exact or prefix email match
  if (uEmail && vEmail) {
    if (uEmail === vEmail) return true;
    const uPrefix = uEmail.split('@')[0];
    const vPrefix = vEmail.split('@')[0];
    if (uPrefix && vPrefix && uPrefix === vPrefix) return true;
  }

  // 2. Name match (case-insensitive, normalized spaces)
  if (uName && vName) {
    const normU = uName.replace(/\s+/g, ' ');
    const normV = vName.replace(/\s+/g, ' ');
    if (normU === normV) return true;
    if (normU.includes(normV) || normV.includes(normU)) return true;
  }

  return false;
}

export function canUserApproveStage(
  plan: WorkPlan,
  stage: WorkPlanVerifier,
  userEmail?: string | null,
  userName?: string | null,
  userUid?: string | null
): boolean {
  if (!stage || stage.verified) return false;

  const verifiers = getPlanVerifiers(plan);
  // Ensure all preceding stages are already verified (Strict sequential sign-off)
  const priorPending = verifiers.filter(v => v.order < stage.order && !v.verified);
  if (priorPending.length > 0) {
    return false;
  }

  // Enforce: only assigned officer can approve this specific stage
  return isUserAssignedToVerifier(stage, userEmail, userName, userUid);
}

export function canUserApproveNextStage(
  plan: WorkPlan,
  userEmail?: string | null,
  userName?: string | null,
  userUid?: string | null
): boolean {
  const next = getNextPendingVerifier(plan);
  if (!next) return false;
  return canUserApproveStage(plan, next, userEmail, userName, userUid);
}

export function isUserAssignedVerifier(plan: WorkPlan, userEmail?: string | null, userName?: string | null): boolean {
  if (!userEmail && !userName) return false;
  const verifiers = getPlanVerifiers(plan);
  return verifiers.some(v => isUserAssignedToVerifier(v, userEmail, userName));
}

export function resetVerifiers(verifiers: WorkPlanVerifier[]): WorkPlanVerifier[] {
  return (verifiers || []).map(v => ({
    ...v,
    verified: false,
    verifiedAt: undefined,
    verifiedByEmail: undefined,
    reviewComment: undefined
  }));
}

export function resetPlanVerifiers(plan: WorkPlan): WorkPlanVerifier[] {
  return resetVerifiers(getPlanVerifiers(plan));
}

export function resetStageVerification(verifiers: WorkPlanVerifier[], stageOrder: number): WorkPlanVerifier[] {
  return (verifiers || []).map(v => {
    if (v.order >= stageOrder) {
      return {
        ...v,
        verified: false,
        verifiedAt: undefined,
        verifiedByEmail: undefined,
        reviewComment: undefined
      };
    }
    return v;
  });
}

@Injectable({
  providedIn: 'root'
})
export class WorkPlanService {
  private firestoreService = inject(FirestoreService);
  private readonly collectionName = 'work_plans';
  private readonly settingsDoc = 'settings/work_plans';

  private readonly plansCacheKey = 'donm_work_plans_cache';
  private plansSubject = new BehaviorSubject<WorkPlan[]>(this.loadCachedPlans());

  settings = signal<WorkPlanPolicySettings>(this.loadLocalSettings());
  databaseDepartments = signal<Department[]>([]);

  constructor() {
    this.initSettingsListener();
    this.initDepartmentsListener();
    this.initPlansListener();
    this.purgeSeedPlans();
    this.syncLocalOnlyPlansToFirestore();
  }

  private initDepartmentsListener() {
    this.firestoreService.getCollection<Department>('settings_departments').subscribe({
      next: (depts) => {
        if (depts && depts.length > 0) {
          this.databaseDepartments.set(depts);
        }
      },
      error: () => {}
    });
  }

  private loadCachedPlans(): WorkPlan[] {
    try {
      const saved = localStorage.getItem(this.plansCacheKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  }

  private persistPlansCache(plans: WorkPlan[]) {
    try {
      localStorage.setItem(this.plansCacheKey, JSON.stringify(plans));
    } catch {}
  }

  private initPlansListener() {
    this.firestoreService.getCollection<WorkPlan>(this.collectionName).subscribe({
      next: (firestorePlans) => {
        if (firestorePlans && firestorePlans.length > 0) {
          const remoteIds = new Set(firestorePlans.map(p => p.id));
          const current = this.plansSubject.getValue();
          const localOnly = current.filter(p => p.id && !remoteIds.has(p.id) && p.id.startsWith('wp_local_'));
          const merged = [...firestorePlans, ...localOnly];
          this.plansSubject.next(merged);
          this.persistPlansCache(merged);
          if (localOnly.length > 0) {
            this.syncLocalOnlyPlansToFirestore(localOnly);
          }
        } else if (firestorePlans && firestorePlans.length === 0) {
          const current = this.plansSubject.getValue();
          const localOnly = current.filter(p => p.id && p.id.startsWith('wp_local_'));
          if (localOnly.length > 0) {
            this.syncLocalOnlyPlansToFirestore(localOnly);
          } else {
            this.plansSubject.next([]);
            this.persistPlansCache([]);
          }
        }
      },
      error: () => {
        // In offline mode, current cached plans remain in plansSubject
      }
    });
  }

  private async syncLocalOnlyPlansToFirestore(localPlans?: WorkPlan[]) {
    const targets = localPlans || this.plansSubject.getValue().filter(p => p.id && p.id.startsWith('wp_local_'));
    if (!targets || targets.length === 0) return;

    for (const plan of targets) {
      try {
        const { id: localId, ...dataToSave } = plan;
        const remoteId = await this.firestoreService.addDocument(this.collectionName, dataToSave);
        if (remoteId) {
          const current = this.plansSubject.getValue();
          const updated = current.map(p => p.id === localId ? { ...p, id: remoteId } : p);
          this.plansSubject.next(updated);
          this.persistPlansCache(updated);
        }
      } catch (e) {
        console.warn('Failed to sync local plan to Firestore', plan.title, e);
      }
    }
  }

  private loadLocalSettings(): WorkPlanPolicySettings {
    try {
      const saved = localStorage.getItem('donm_work_plan_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_WORK_PLAN_SETTINGS, ...parsed };
        if (!parsed.rolesPermittedByReportType) {
          const all = parsed.rolesPermittedForAllReports || ['Super Admin', 'Divisional Admin', 'Department Head'];
          const ind = parsed.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];
          merged.rolesPermittedByReportType = {
            pending: [...all],
            completed: [...all],
            master: [...all],
            individual: [...ind],
            department: [...all],
            verification: [...all]
          };
        }
        return merged;
      }
    } catch {}
    return { ...DEFAULT_WORK_PLAN_SETTINGS };
  }

  private initSettingsListener() {
    this.firestoreService.getDocument<WorkPlanPolicySettings>(this.settingsDoc).subscribe({
      next: (val) => {
        if (val) {
          const merged = { ...DEFAULT_WORK_PLAN_SETTINGS, ...val };
          if (!val.rolesPermittedByReportType) {
            const all = val.rolesPermittedForAllReports || ['Super Admin', 'Divisional Admin', 'Department Head'];
            const ind = val.rolesPermittedForIndividualReports || ['Super Admin', 'Divisional Admin', 'Department Head', 'Staff', 'HR', 'Field Agent'];
            merged.rolesPermittedByReportType = {
              pending: [...all],
              completed: [...all],
              master: [...all],
              individual: [...ind],
              department: [...all],
              verification: [...all]
            };
          }
          this.settings.set(merged);
          try { localStorage.setItem('donm_work_plan_settings', JSON.stringify(merged)); } catch {}
        }
      },
      error: () => {}
    });
  }

  async updateSettings(updated: Partial<WorkPlanPolicySettings>): Promise<void> {
    const current = this.settings();
    const merged = { ...current, ...updated };
    this.settings.set(merged);
    try { localStorage.setItem('donm_work_plan_settings', JSON.stringify(merged)); } catch {}
    try {
      await this.firestoreService.setDocument('settings', 'work_plans', merged);
    } catch {}
  }

  getWorkPlans(): Observable<WorkPlan[]> {
    return this.plansSubject.asObservable();
  }

  getWorkPlan(id: string): Observable<WorkPlan | undefined> {
    return this.firestoreService.getDocument<WorkPlan>(`${this.collectionName}/${id}`);
  }

  async addWorkPlan(plan: Omit<WorkPlan, 'id'>): Promise<string> {
    const timestamp = Date.now();
    let docId = 'wp_local_' + timestamp + '_' + Math.random().toString(36).substring(2, 7);

    const payload = {
      ...plan,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    try {
      const remoteId = await this.firestoreService.addDocument(this.collectionName, payload);
      if (remoteId) {
        docId = remoteId;
      }
    } catch (e) {
      console.warn('Firestore addDocument offline/failed, using local docId', e);
    }

    const createdPlan: WorkPlan = {
      ...payload,
      id: docId
    };

    const current = this.plansSubject.getValue();
    const updated = [createdPlan, ...current.filter(p => p.id !== docId)];
    this.plansSubject.next(updated);
    this.persistPlansCache(updated);

    return docId;
  }

  async updateWorkPlan(id: string, plan: Partial<WorkPlan>): Promise<void> {
    const timestamp = Date.now();
    const current = this.plansSubject.getValue();
    const existing = current.find(p => p.id === id);

    let mergedPlan = { ...plan };

    // Fix 6: Smart Concurrent Verification Merge
    // If updating verifiers, ensure that remotely or locally already signed off stages
    // are not inadvertently overwritten unless this is an intentional rollback/reset.
    if (existing && plan.verifiers && plan.verifiers.length > 0) {
      const isRollbackOrReset = (plan.status === 'In Progress' || plan.status === 'Draft') && (!!plan.revisionNotes || !!plan.rollbackAt);
      if (!isRollbackOrReset && existing.verifiers && existing.verifiers.length > 0) {
        const mergedVerifiers = plan.verifiers.map(incomingV => {
          const matchingExisting = existing.verifiers?.find(ev => ev.order === incomingV.order || ev.id === incomingV.id);
          if (matchingExisting && matchingExisting.verified && !incomingV.verified) {
            // Preserve the signed verification status and review metadata
            return {
              ...incomingV,
              verified: true,
              verifiedAt: matchingExisting.verifiedAt,
              verifiedByEmail: matchingExisting.verifiedByEmail,
              reviewComment: matchingExisting.reviewComment || incomingV.reviewComment
            };
          }
          return incomingV;
        });
        mergedPlan.verifiers = mergedVerifiers;
      }
    }

    const updated = current.map(p => p.id === id ? { ...p, ...mergedPlan, updatedAt: timestamp } : p);
    this.plansSubject.next(updated);
    this.persistPlansCache(updated);

    if (id && !id.startsWith('wp_local_')) {
      try {
        await this.firestoreService.updateDocument(this.collectionName, id, {
          ...mergedPlan,
          updatedAt: timestamp
        });
      } catch (e) {
        console.warn('Firestore updateDocument offline/failed', e);
      }
    }
  }

  async reassignStageVerifier(
    planId: string,
    stageOrder: number,
    newOfficer: { name: string; email: string; role?: string; department?: string },
    reason: string,
    reassignedBy?: { name?: string; email?: string }
  ): Promise<void> {
    const current = this.plansSubject.getValue();
    const plan = current.find(p => p.id === planId);
    if (!plan || !plan.id) return;

    const verifiers = getPlanVerifiers(plan);
    const updatedVerifiers = verifiers.map(v => {
      if (v.order === stageOrder) {
        return {
          ...v,
          name: newOfficer.name,
          email: newOfficer.email,
          role: newOfficer.role || v.role || 'Verification Officer',
          department: newOfficer.department || v.department || plan.department || plan.division || '',
          reassignedFrom: v.name ? `${v.name}${v.email ? ' (' + v.email + ')' : ''}` : undefined
        };
      }
      return v;
    });

    const payload: Partial<WorkPlan> = {
      verifiers: updatedVerifiers,
      ...(stageOrder === 1 ? { leadName: newOfficer.name, leadEmail: newOfficer.email } : {})
    };

    await this.updateWorkPlan(plan.id, payload);
  }

  async deleteWorkPlan(id: string): Promise<void> {
    const current = this.plansSubject.getValue();
    const updated = current.filter(p => p.id !== id);
    this.plansSubject.next(updated);
    this.persistPlansCache(updated);

    if (id && !id.startsWith('wp_local_')) {
      try {
        await this.firestoreService.deleteDocument(this.collectionName, id);
      } catch (e) {
        console.warn('Firestore deleteDocument offline/failed', e);
      }
    }
  }

  getPlanVerifiers(plan: WorkPlan): WorkPlanVerifier[] {
    return getPlanVerifiers(plan);
  }

  getCompletedVerifiersCount(plan: WorkPlan): number {
    return getCompletedVerifiersCount(plan);
  }

  areAllVerifiersApproved(plan: WorkPlan): boolean {
    return areAllVerifiersApproved(plan);
  }

  getNextPendingVerifier(plan: WorkPlan): WorkPlanVerifier | undefined {
    return getNextPendingVerifier(plan);
  }

  getRequiredVerifiersCountForDepartment(settings: WorkPlanPolicySettings, deptName?: string | null): number {
    return getRequiredVerifiersCountForDepartment(settings, deptName, this.databaseDepartments());
  }

  isUserAssignedVerifier(plan: WorkPlan, userEmail?: string | null, userName?: string | null): boolean {
    return isUserAssignedVerifier(plan, userEmail, userName);
  }

  isUserAssignedToVerifier(verifier: WorkPlanVerifier | undefined | null, userEmail?: string | null, userName?: string | null, userUid?: string | null): boolean {
    return isUserAssignedToVerifier(verifier, userEmail, userName, userUid);
  }

  canUserApproveStage(plan: WorkPlan, stage: WorkPlanVerifier, userEmail?: string | null, userName?: string | null, userUid?: string | null): boolean {
    return canUserApproveStage(plan, stage, userEmail, userName, userUid);
  }

  canUserApproveNextStage(plan: WorkPlan, userEmail?: string | null, userName?: string | null, userUid?: string | null): boolean {
    return canUserApproveNextStage(plan, userEmail, userName, userUid);
  }

  resetVerifiers(verifiers: WorkPlanVerifier[]): WorkPlanVerifier[] {
    return resetVerifiers(verifiers);
  }

  resetPlanVerifiers(plan: WorkPlan): WorkPlanVerifier[] {
    return resetPlanVerifiers(plan);
  }

  resetStageVerification(verifiers: WorkPlanVerifier[], stageOrder: number): WorkPlanVerifier[] {
    return resetStageVerification(verifiers, stageOrder);
  }

  async resetStageApproval(planId: string, stageOrder: number, reason?: string, currentPlan?: WorkPlan): Promise<void> {
    const plan = currentPlan || this.plansSubject.getValue().find(p => p.id === planId);
    if (!plan || !plan.id) return;
    const currentVerifiers = getPlanVerifiers(plan);
    const updatedVerifiers = resetStageVerification(currentVerifiers, stageOrder);
    const newStatus = plan.status === 'Completed' ? 'Under Review' : plan.status;
    const rollbackNotes = (reason || '').trim() || `Approval for Stage ${stageOrder} reset by verification officer`;
    await this.updateWorkPlan(plan.id, {
      status: newStatus,
      verifiers: updatedVerifiers,
      revisionNotes: rollbackNotes,
      rollbackAt: new Date().toISOString(),
      ...(plan.progress === 100 ? { progress: 95 } : {})
    });
  }

  async rollbackWorkPlan(planId: string, reason?: string, currentPlan?: WorkPlan): Promise<void> {
    const plan = currentPlan || this.plansSubject.getValue().find(p => p.id === planId);
    if (!plan || !plan.id) return;
    const resetVerifs = resetPlanVerifiers(plan);
    const rollbackNotes = (reason || '').trim() || 'Returned to In Progress for revisions';
    await this.updateWorkPlan(plan.id, {
      status: 'In Progress',
      verifiers: resetVerifs,
      revisionNotes: rollbackNotes,
      rollbackAt: new Date().toISOString(),
      ...(plan.progress === 100 ? { progress: 90 } : {})
    });
  }

  // One-time cleanup to purge any legacy mock/seed plans from Firestore database
  async purgeSeedPlans(): Promise<void> {
    const seedTitles = [
      'District Land Registry Digitization Phase 2',
      'High-Speed Inter-Branch Offline Sync Engine',
      'Citizen Customer KYC & Biometric Modernization',
      'Official Mail Tracking & Secure Courier Integration',
      'Disaster Recovery Plan & Cold Storage Backup',
      'Regional Solar Microgrid & Power Resilience',
      'Land Titles Boundary Cadastral Certification',
      'Fleet Vehicle Telematics & Fuel Audit Review'
    ];
    try {
      const all = await firstValueFrom(this.getWorkPlans().pipe(take(1)));
      if (all && all.length > 0) {
        for (const p of all) {
          if (p.id && (p.id.startsWith('seed-') || seedTitles.includes(p.title))) {
            await this.deleteWorkPlan(p.id);
          }
        }
      }
    } catch {}
  }
}
