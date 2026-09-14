import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, collectionData, docData, setDoc, updateDoc, deleteDoc, addDoc, query, QueryConstraint, getDocs, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Recursive sanitizer to eliminate unsupported undefined fields before sending to Firestore
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as any;
  }
  return obj;
}

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore = inject(Firestore);

  // Read collection
  getCollection<T>(path: string, queryConstraints?: QueryConstraint[]): Observable<T[]> {
    const colRef = collection(this.firestore, path);
    const q = queryConstraints ? query(colRef, ...queryConstraints) : colRef;
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  // Read document
  getDocument<T>(path: string): Observable<T | undefined> {
    const docRef = doc(this.firestore, path);
    return docData(docRef, { idField: 'id' }) as Observable<T | undefined>;
  }

  // Create document with auto ID
  async addDocument<T extends object>(path: string, data: T): Promise<string> {
    const colRef = collection(this.firestore, path);
    const cleanData = sanitizeForFirestore(data);
    const docRef = await addDoc(colRef, cleanData as any);
    return docRef.id;
  }

  // Set document with custom ID
  async setDocument<T extends object>(path: string, id: string, data: T): Promise<void> {
    const docRef = doc(this.firestore, `${path}/${id}`);
    const cleanData = sanitizeForFirestore(data);
    await setDoc(docRef, cleanData as any, { merge: true });
  }

  // Update document
  async updateDocument<T extends object>(path: string, id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(this.firestore, `${path}/${id}`);
    const cleanData = sanitizeForFirestore(data);
    await updateDoc(docRef, cleanData as any);
  }

  // Delete document
  async deleteDocument(path: string, id: string): Promise<void> {
    const docRef = doc(this.firestore, `${path}/${id}`);
    await deleteDoc(docRef);
  }
  // Query documents once
  async queryDocuments<T>(path: string, fieldPath: string, opStr: any, value: any): Promise<T[]> {
    const colRef = collection(this.firestore, path);
    const q = query(colRef, where(fieldPath, opStr, value));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as T));
  }
}
