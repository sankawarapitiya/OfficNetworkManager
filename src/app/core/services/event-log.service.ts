import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';
import { orderBy, limit, QueryConstraint } from '@angular/fire/firestore';

export interface EventLog {
  id?: string;
  userId: string;
  userName: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'LOGIN' | 'SYSTEM';
  module: string;
  description: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class EventLogService {
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private readonly collectionName = 'system_logs';

  logAction(action: EventLog['action'], module: string, description: string) {
    const user = this.authService.currentUser();
    if (!user) return;

    const log: Omit<EventLog, 'id'> = {
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown User',
      action,
      module,
      description,
      timestamp: Date.now()
    };

    // Fire and forget - don't block the UI
    this.firestoreService.addDocument(this.collectionName, log)
      .catch(err => console.error('Failed to save event log', err));
  }

  getRecentLogs(limitCount: number = 20): Observable<EventLog[]> {
    const constraints: QueryConstraint[] = [
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    ];
    return this.firestoreService.getCollection<EventLog>(this.collectionName, constraints);
  }

  getAllLogs(): Observable<EventLog[]> {
    const constraints: QueryConstraint[] = [
      orderBy('timestamp', 'desc')
    ];
    return this.firestoreService.getCollection<EventLog>(this.collectionName, constraints);
  }
}
