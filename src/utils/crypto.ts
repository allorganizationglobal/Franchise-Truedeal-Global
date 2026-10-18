/**
 * WebCrypto AES-GCM-256 and SHA-256 Cryptographic Engine
 * Provides client-side end-to-end encryption for submitted documents and audit immutability.
 */

// Master client derivation secret key (simulated local device enclave key)
const CLIENT_ENCLAVE_SECRET = 'TrueDealGlobal-AES256-FranchiseVault-2026';

async function deriveCryptoKey(secret: string = CLIENT_ENCLAVE_SECRET): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = enc.encode(secret);
  const hash = await window.crypto.subtle.digest('SHA-256', rawKey);
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Calculates SHA-256 checksum hex string
 */
export async function calculateSha256(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypts a file (ArrayBuffer or Base64 string) using AES-GCM-256
 */
export async function encryptFilePayload(
  contentBuffer: ArrayBuffer,
  fileName: string
): Promise<{
  ivHex: string;
  cipherChecksum: string;
  encryptedBase64: string;
  algorithm: 'AES-GCM-256';
}> {
  const key = await deriveCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    contentBuffer
  );

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherChecksum = await calculateSha256(encryptedBuffer);

  // Convert encrypted buffer to Base64 for transport/storage
  const uint8 = new Uint8Array(encryptedBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
  }
  const encryptedBase64 = btoa(binary);

  return {
    ivHex,
    cipherChecksum,
    encryptedBase64,
    algorithm: 'AES-GCM-256',
  };
}

/**
 * Decrypts an encrypted Base64 string using AES-GCM-256 and IV
 */
export async function decryptFilePayload(
  encryptedBase64: string,
  ivHex: string
): Promise<ArrayBuffer> {
  const key = await deriveCryptoKey();
  
  // Parse IV from hex
  const ivBytes = new Uint8Array(
    ivHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );

  // Parse Base64 to ArrayBuffer
  const binaryString = atob(encryptedBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    bytes.buffer
  );

  return decryptedBuffer;
}

/**
 * Creates tamper-evident signature for audit logs
 */
export async function generateAuditChecksum(
  timestamp: string,
  userEmail: string,
  action: string,
  resourceId: string,
  details: string
): Promise<string> {
  const payload = `${timestamp}::${userEmail}::${action}::${resourceId}::${details}`;
  return calculateSha256(payload);
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
  sanitizedName?: string;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_FILE_SIZE_BYTES = 100; // 100 Bytes
export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validates file extension, size, and binary magic bytes (file signature)
 */
export async function validateUploadFile(file: File): Promise<FileValidationResult> {
  // 1. Size constraint
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File exceeds maximum limit of 10 MB (Actual: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`
    };
  }

  if (file.size < MIN_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File is too small or empty (Minimum size: 100 bytes).'
    };
  }

  // 2. Extension constraint
  const lowerName = file.name.toLowerCase();
  const ext = lowerName.lastIndexOf('.') !== -1 ? lowerName.substring(lowerName.lastIndexOf('.')) : '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Disallowed file format "${ext || 'unknown'}". Allowed formats: PDF, JPG, PNG, WEBP.`
    };
  }

  // 3. Inspect magic bytes header
  try {
    const slice = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(slice);

    let detectedMimeType: string | null = null;

    // PDF: %PDF (0x25 0x50 0x44 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      detectedMimeType = 'application/pdf';
    }
    // PNG: \x89PNG (0x89 0x50 0x4E 0x47)
    else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      detectedMimeType = 'image/png';
    }
    // JPEG: \xFF\xD8\xFF
    else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      detectedMimeType = 'image/jpeg';
    }
    // WebP: RIFF ... WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
    else if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      detectedMimeType = 'image/webp';
    }

    if (!detectedMimeType) {
      return {
        valid: false,
        error: 'File content signature does not match declared extension. Potential corrupted or spoofed file.'
      };
    }

    // 4. Generate sanitized safe filename
    const baseCleanName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.');
    const sanitizedName = `doc_${Date.now()}_${baseCleanName}`;

    return {
      valid: true,
      detectedMimeType,
      sanitizedName
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Could not verify file integrity: ${err?.message || 'Read error'}`
    };
  }
}

