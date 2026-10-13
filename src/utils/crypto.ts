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
