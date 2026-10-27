import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AuthService } from '../../../auth/auth.service';
import { EventLogService } from '../../../core/services/event-log.service';
import { AccountClient } from '../models/account-client.model';

@Injectable({
  providedIn: 'root'
})
export class AccountClientService {
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private eventLogService = inject(EventLogService);

  private readonly collectionName = 'account_clients';

  /**
   * Retrieve all clients in the Account dataset
   */
  getClients(): Observable<AccountClient[]> {
    return this.firestoreService.getCollection<AccountClient>(this.collectionName).pipe(
      map(clients => clients.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)))
    );
  }

  /**
   * Retrieve a single client by ID
   */
  getClientById(id: string): Observable<AccountClient | undefined> {
    return this.firestoreService.getDocument<AccountClient>(`${this.collectionName}/${id}`);
  }

  /**
   * Add a new client to the Account dataset
   */
  async addClient(clientData: Omit<AccountClient, 'id'>): Promise<string> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Accounts Officer';
    const now = Date.now();

    const client: Omit<AccountClient, 'id'> = {
      ...clientData,
      createdAt: now,
      updatedAt: now,
      createdBy: officerName,
      updatedBy: officerName
    };

    const docId = await this.firestoreService.addDocument(this.collectionName, client);

    this.eventLogService.logAction(
      'CREATED',
      'account',
      `Registered account client [${clientData.name}] (${clientData.clientType}${clientData.nicOrBrn ? ' - ' + clientData.nicOrBrn : ''})`
    );

    return docId;
  }

  /**
   * Update an existing account client
   */
  async updateClient(id: string, clientData: Partial<AccountClient>): Promise<void> {
    const user = this.authService.currentUser();
    const officerName = user?.displayName || user?.email || 'Accounts Officer';
    const now = Date.now();

    await this.firestoreService.updateDocument(this.collectionName, id, {
      ...clientData,
      updatedAt: now,
      updatedBy: officerName
    });

    this.eventLogService.logAction(
      'UPDATED',
      'account',
      `Updated account client [${clientData.name || id}]`
    );
  }

  /**
   * Delete an account client
   */
  async deleteClient(id: string, clientName?: string): Promise<void> {
    await this.firestoreService.deleteDocument(this.collectionName, id);

    this.eventLogService.logAction(
      'DELETED',
      'account',
      `Deleted account client [${clientName || id}]`
    );
  }

  /**
   * Check if a client has any linked vouchers before deleting
   */
  async isClientLinked(clientId: string, clientNicOrBrn?: string): Promise<boolean> {
    try {
      if (clientId) {
        const byClientId = await this.firestoreService.queryDocuments('vouchers', 'clientId', '==', clientId);
        if (byClientId && byClientId.length > 0) return true;
        const byCustomerId = await this.firestoreService.queryDocuments('vouchers', 'customerId', '==', clientId);
        if (byCustomerId && byCustomerId.length > 0) return true;
      }
      if (clientNicOrBrn && clientNicOrBrn.trim()) {
        const byNic = await this.firestoreService.queryDocuments('vouchers', 'payeeNic', '==', clientNicOrBrn.trim());
        if (byNic && byNic.length > 0) return true;
      }
      return false;
    } catch (e) {
      console.warn('Error checking if client is linked to vouchers', e);
      return false;
    }
  }
}
