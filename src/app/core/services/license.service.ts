import { Injectable, inject, signal, computed } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { EventLogService } from './event-log.service';
import { Observable } from 'rxjs';

export interface AppLicensePayload {
  licenseId: string;
  issuedTo: string;
  licenseType: string;
  issuedAt: number;
  expiresAt: number;
  issuerEmail: string;
  issuerName?: string;
  notes?: string;
}

export interface AppActivationKeyFile {
  format: 'ONM_KEY_V1';
  payload: AppLicensePayload;
  signature: string;
  code?: string;
}

export interface AppLicenseRecord {
  id?: string;
  payload: AppLicensePayload;
  signature: string;
  activatedAt: number;
  activatedBy: string;
  rawKey?: string;
}

export type LicenseStatusType = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_ACTIVATED';

// Pure TypeScript/JavaScript SHA-256 implementation
// Ensures key generation & signature verification work seamlessly across both secure contexts
// (HTTPS/localhost) and insecure contexts (e.g. accessing via local network IP address http://192.168.x.x:4200)
function sha256Hex(ascii: string): string {
  const utf8 = unescape(encodeURIComponent(ascii));

  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const maxWord = Math.pow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = utf8.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let padded = utf8 + '\x80';
  while (padded.length % 64 - 56) padded += '\x00';
  for (i = 0; i < padded.length; i++) {
    j = padded.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = (asciiBitLength | 0);

  for (j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];

      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0
        );
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

@Injectable({
  providedIn: 'root'
})
export class LicenseService {
  private firestoreService = inject(FirestoreService);
  private eventLogService = inject(EventLogService);

  private readonly SECRET_SALT = 'ONM_PLATFORM_KEY_SIGNING_SALT_2026_#9182@SECURE_GOV';
  private readonly DOC_PATH = 'settings/activation_license';

  // Live state signal
  licenseRecord = signal<AppLicenseRecord | null>(null);
  isLoading = signal<boolean>(true);

  // Computed properties
  isActivated = computed(() => {
    const rec = this.licenseRecord();
    return !!rec && !!rec.payload && !!rec.signature;
  });

  daysRemaining = computed(() => {
    const rec = this.licenseRecord();
    if (!rec || !rec.payload) return 0;
    const diffMs = rec.payload.expiresAt - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  });

  isExpired = computed(() => {
    const rec = this.licenseRecord();
    if (!rec || !rec.payload) return false;
    return rec.payload.expiresAt <= Date.now();
  });

  isExpiringSoon = computed(() => {
    const days = this.daysRemaining();
    const expired = this.isExpired();
    return !expired && days > 0 && days <= 7;
  });

  status = computed<LicenseStatusType>(() => {
    if (!this.isActivated()) return 'NOT_ACTIVATED';
    if (this.isExpired()) return 'EXPIRED';
    if (this.isExpiringSoon()) return 'EXPIRING_SOON';
    return 'ACTIVE';
  });

  isLocked = computed(() => {
    if (this.isLoading()) return false;
    return !this.isActivated() || this.isExpired();
  });

  constructor() {
    this.initLicenseListener();
  }

  private initLicenseListener() {
    this.firestoreService.getDocument<AppLicenseRecord>(this.DOC_PATH).subscribe({
      next: async (record) => {
        if (record && record.payload && record.signature) {
          // Verify authenticity of stored record
          const valid = await this.verifySignature(record.payload, record.signature);
          if (valid) {
            this.licenseRecord.set(record);
          } else {
            console.warn('[LicenseService] Stored license signature is invalid or tampered!');
            this.licenseRecord.set(null);
          }
        } else {
          this.licenseRecord.set(null);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[LicenseService] Failed to load license record', err);
        this.isLoading.set(false);
      }
    });
  }



  // --- Cryptographic Signatures (SHA-256) ---
  async generateSignature(payload: AppLicensePayload): Promise<string> {
    const data = `${payload.licenseId}|${payload.issuedTo.trim()}|${payload.licenseType}|${payload.issuedAt}|${payload.expiresAt}|${payload.issuerEmail.trim()}|${this.SECRET_SALT}`;

    // If Web Crypto API is available (Secure Context: HTTPS or localhost), use subtle.digest
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
      try {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {
        // Fall through to pure JS SHA-256
      }
    }

    // Insecure contexts (e.g. accessing via http://<ip-address>:4200) where crypto.subtle is undefined
    return sha256Hex(data);
  }

  async verifySignature(payload: AppLicensePayload, signature: string): Promise<boolean> {
    try {
      const expected = await this.generateSignature(payload);
      return expected.toLowerCase() === signature.toLowerCase();
    } catch {
      return false;
    }
  }

  // --- Key Generator (Super Admin Only) ---
  async generateActivationKey(params: {
    issuedTo: string;
    licenseType?: string;
    expiresAt: number;
    notes?: string;
    issuerEmail: string;
    issuerName?: string;
  }): Promise<{ keyFile: AppActivationKeyFile; activationCode: string }> {
    const year = new Date().getFullYear();
    const randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const licenseId = `LIC-${year}-${randPart}`;

    const payload: AppLicensePayload = {
      licenseId,
      issuedTo: params.issuedTo.trim(),
      licenseType: params.licenseType || 'Government Edition',
      issuedAt: Date.now(),
      expiresAt: params.expiresAt,
      issuerEmail: params.issuerEmail.trim(),
      issuerName: params.issuerName || '',
      notes: params.notes || ''
    };

    const signature = await this.generateSignature(payload);

    // Build base64 activation code token
    const tokenObj = {
      id: payload.licenseId,
      to: payload.issuedTo,
      typ: payload.licenseType,
      iat: payload.issuedAt,
      exp: payload.expiresAt,
      iss: payload.issuerEmail,
      sig: signature
    };
    const jsonStr = JSON.stringify(tokenObj);
    const base64Token = btoa(unescape(encodeURIComponent(jsonStr)));
    const activationCode = `ONM-ACT-${base64Token}`;

    const keyFile: AppActivationKeyFile = {
      format: 'ONM_KEY_V1',
      payload,
      signature,
      code: activationCode
    };

    this.eventLogService.logAction(
      'SYSTEM',
      'settings',
      `Super Admin issued license key ${licenseId} for "${payload.issuedTo}" expiring on ${new Date(payload.expiresAt).toLocaleDateString()}`
    );

    return { keyFile, activationCode };
  }

  // --- Key Verification ---
  async verifyKeyStringOrFile(content: string): Promise<{
    valid: boolean;
    error?: string;
    keyFile?: AppActivationKeyFile;
    isExpired?: boolean;
  }> {
    try {
      const text = content.trim();
      let keyFile: AppActivationKeyFile | null = null;

      if (text.startsWith('{') && text.endsWith('}')) {
        // Parsed JSON key file
        const parsed = JSON.parse(text);
        if (parsed.format === 'ONM_KEY_V1' && parsed.payload && parsed.signature) {
          keyFile = parsed;
        } else if (parsed.licenseId && parsed.signature) {
          keyFile = {
            format: 'ONM_KEY_V1',
            payload: parsed,
            signature: parsed.signature
          };
        }
      } else if (text.includes('ONM-ACT-') || text.length > 30) {
        // Base64 Token
        const rawToken = text.replace(/^ONM-ACT-/, '').trim();
        const jsonStr = decodeURIComponent(escape(atob(rawToken)));
        const tokenObj = JSON.parse(jsonStr);

        keyFile = {
          format: 'ONM_KEY_V1',
          payload: {
            licenseId: tokenObj.id,
            issuedTo: tokenObj.to,
            licenseType: tokenObj.typ,
            issuedAt: tokenObj.iat,
            expiresAt: tokenObj.exp,
            issuerEmail: tokenObj.iss,
            notes: tokenObj.notes || ''
          },
          signature: tokenObj.sig,
          code: text
        };
      }

      if (!keyFile || !keyFile.payload || !keyFile.signature) {
        return { valid: false, error: 'Unrecognized key format. Please provide a valid .key file or ONM-ACT activation code.' };
      }

      // Check signature authenticity
      const isSigValid = await this.verifySignature(keyFile.payload, keyFile.signature);
      if (!isSigValid) {
        return { valid: false, error: 'Cryptographic signature mismatch! The key file has been altered or is unauthorized.' };
      }

      // Check expiry
      const isExpired = keyFile.payload.expiresAt <= Date.now();
      if (isExpired) {
        const expStr = new Date(keyFile.payload.expiresAt).toLocaleDateString();
        return {
          valid: false,
          isExpired: true,
          error: `This license expired on ${expStr}. A new activation key is required.`,
          keyFile
        };
      }

      return { valid: true, keyFile };
    } catch (e: any) {
      return { valid: false, error: 'Failed to parse activation key: ' + (e?.message || 'Invalid format') };
    }
  }

  // --- Apply & Activate ---
  async applyLicense(keyFile: AppActivationKeyFile, userEmail: string): Promise<void> {
    const record: AppLicenseRecord = {
      payload: keyFile.payload,
      signature: keyFile.signature,
      activatedAt: Date.now(),
      activatedBy: userEmail,
      rawKey: keyFile.code || JSON.stringify(keyFile)
    };

    await this.firestoreService.setDocument('settings', 'activation_license', record);
    this.licenseRecord.set(record);

    this.eventLogService.logAction(
      'SYSTEM',
      'settings',
      `Platform activated with license ${keyFile.payload.licenseId} (${keyFile.payload.issuedTo}) by ${userEmail}. Expires: ${new Date(keyFile.payload.expiresAt).toLocaleDateString()}`
    );
  }

  // --- Deactivate / Revoke ---
  async deactivateLicense(userEmail: string): Promise<void> {
    await this.firestoreService.deleteDocument('settings', 'activation_license');
    this.licenseRecord.set(null);

    this.eventLogService.logAction(
      'SYSTEM',
      'settings',
      `Platform license was deactivated/cleared by ${userEmail}`
    );
  }

  // --- Key File Download Utility ---
  downloadKeyFile(keyFile: AppActivationKeyFile) {
    const jsonStr = JSON.stringify(keyFile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const orgSlug = (keyFile.payload.issuedTo || 'platform').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `onm-license-${orgSlug}-${keyFile.payload.licenseId}.key`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
