import crypto from 'crypto';
import {
  resolveServerUserRole,
  ROLE_PERMISSIONS,
  AdminPermission,
  verifySessionToken
} from './authService.js';
import type { UserRole } from '../types/franchise.js';

/**
 * TRUEDEAL GLOBAL — Lightweight Zero-Dependency Server-Side Firebase ID Token Verifier
 *
 * Implements Google's official Firebase ID Token RS256 JWT verification specification
 * using Node.js built-in `crypto` against Google's official Secure Token X.509 public
 * certificates:
 *   https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
 *
 * Why pure Node.js crypto instead of importing `firebase-admin`:
 * - Zero heavy native/gRPC dependencies — eliminates Vercel ESM cold-start crashes
 *   (`FUNCTION_INVOCATION_FAILED`) while preserving 100% identical RS256 cryptographic
 *   verification of Firebase Auth ID tokens (header alg/kid, exp, iat, auth_time, aud,
 *   iss, sub, and RSA-SHA256 signature against Google's rotating public certificates).
 * - Requires ZERO IAM roles and ZERO service account private keys.
 */

const DEFAULT_FIREBASE_PROJECT_ID = 'rational-medium-x5wls';
const GOOGLE_SECURETOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CachedGoogleCerts {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let cachedCerts: CachedGoogleCerts | null = null;

function resolveFirebaseProjectId(): string {
  const envProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  return envProjectId || DEFAULT_FIREBASE_PROJECT_ID;
}

function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) return 3600;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return 3600;
  const parsed = parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3600;
  return Math.min(parsed, 24 * 3600);
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCerts.expiresAtMs) {
    return cachedCerts.certs;
  }

  const res = await fetch(GOOGLE_SECURETOKEN_CERTS_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certificates (HTTP ${res.status})`);
  }

  const certs = (await res.json()) as Record<string, string>;
  if (!certs || typeof certs !== 'object' || Object.keys(certs).length === 0) {
    throw new Error('Google public certificates response was empty.');
  }

  const maxAgeSeconds = parseMaxAgeSeconds(res.headers.get('cache-control'));
  cachedCerts = {
    certs,
    expiresAtMs: now + maxAgeSeconds * 1000
  };
  return certs;
}

interface DecodedFirebaseJwtPayload {
  aud?: string;
  iss?: string;
  sub?: string;
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
}

async function verifyFirebaseIdTokenCrypto(
  token: string,
  expectedProjectId: string
): Promise<{ decoded?: DecodedFirebaseJwtPayload; code?: string; error?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { code: 'auth/argument-error', error: 'Malformed JWT token.' };
  }

  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) {
    return { code: 'auth/argument-error', error: 'Incomplete JWT segments.' };
  }

  let header: { alg?: string; kid?: string };
  let payload: DecodedFirebaseJwtPayload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { code: 'auth/argument-error', error: 'Unable to decode JWT header or payload.' };
  }

  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string' || !header.kid.trim()) {
    return { code: 'auth/argument-error', error: 'Unsupported JWT signing algorithm or missing key ID.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const clockSkewSec = 300;

  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { code: 'auth/id-token-expired', error: 'Your authentication session expired. Please sign in again.' };
  }

  if (typeof payload.iat !== 'number' || payload.iat > nowSec + clockSkewSec) {
    return { code: 'auth/argument-error', error: 'Token issued-at timestamp is invalid.' };
  }

  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + clockSkewSec) {
    return { code: 'auth/argument-error', error: 'Token auth_time is in the future.' };
  }

  if (payload.aud !== expectedProjectId) {
    return { code: 'auth/argument-error', error: 'Token audience does not match Firebase project.' };
  }

  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    return { code: 'auth/argument-error', error: 'Token issuer is invalid.' };
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
    return { code: 'auth/argument-error', error: 'Token subject (uid) is missing or invalid.' };
  }

  // Resolve Google X.509 certificate for `kid` (refresh once on cache miss for key rotation)
  let certs = await fetchGooglePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await fetchGooglePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    return { code: 'auth/argument-error', error: 'No matching Google signing certificate found for token.' };
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = Buffer.from(sigB64, 'base64url');
  const signatureValid = crypto.verify('RSA-SHA256', signingInput, certPem, signature);

  if (!signatureValid) {
    return { code: 'auth/invalid-id-token', error: 'Cryptographic token signature verification failed.' };
  }

  return { decoded: payload };
}

export interface VerifiedCallerIdentity {
  valid: boolean;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  role?: UserRole;
  permissions?: AdminPermission[];
  isAdmin?: boolean;
  error?: string;
}

/**
 * Verifies a Firebase Auth ID token (or server-signed fallback session token issued
 * strictly after Firebase ID token verification) from the Authorization Bearer header.
 */
export async function verifyFirebaseBearerToken(
  authHeader?: string | string[] | null,
  rawTokenOverride?: string
): Promise<VerifiedCallerIdentity> {
  const headerVal = Array.isArray(authHeader) ? authHeader[0] : authHeader || '';
  const bearerToken =
    rawTokenOverride?.trim() ||
    (headerVal.startsWith('Bearer ') ? headerVal.slice(7).trim() : headerVal.trim());

  if (!bearerToken) {
    return { valid: false, error: 'Missing Authorization Bearer token.' };
  }

  // 1. Primary path: Cryptographic Firebase ID token RS256 verification (zero external dependencies)
  try {
    const projectId = resolveFirebaseProjectId();
    const verification = await verifyFirebaseIdTokenCrypto(bearerToken, projectId);

    if (verification.decoded) {
      const decoded = verification.decoded;
      const uid = decoded.user_id || decoded.sub;

      if (!uid || !decoded.email) {
        return { valid: false, error: 'Firebase token is missing required uid or email claim.' };
      }

      if (decoded.email_verified === false) {
        return { valid: false, error: 'Email address must be verified before accessing protected actions.' };
      }

      const email = decoded.email.toLowerCase().trim();
      const role = resolveServerUserRole(email);
      const permissions = ROLE_PERMISSIONS[role] || [];
      const isAdmin =
        role === 'super_admin' ||
        role === 'director' ||
        role === 'franchise_manager' ||
        role === 'reviewer' ||
        role === 'support_staff';

      return {
        valid: true,
        uid,
        email,
        emailVerified: true,
        name: decoded.name || email.split('@')[0],
        role,
        permissions,
        isAdmin
      };
    }

    // 2. Secondary path: Verify short-lived HMAC session token previously minted by /api/auth/verify
    const sessionCheck = verifySessionToken(bearerToken);
    if (sessionCheck.valid && sessionCheck.session) {
      const s = sessionCheck.session;
      const isAdmin =
        s.role === 'super_admin' ||
        s.role === 'director' ||
        s.role === 'franchise_manager' ||
        s.role === 'reviewer' ||
        s.role === 'support_staff';
      return {
        valid: true,
        uid: s.uid,
        email: s.email,
        emailVerified: true,
        name: s.name,
        role: s.role,
        permissions: s.permissions,
        isAdmin
      };
    }

    return {
      valid: false,
      error:
        verification.code === 'auth/id-token-expired'
          ? 'Your authentication session expired. Please sign in again.'
          : 'Invalid or expired authentication token.'
    };
  } catch {
    // Fallback check for HMAC session token if network fetch to Google certs fails
    const sessionCheck = verifySessionToken(bearerToken);
    if (sessionCheck.valid && sessionCheck.session) {
      const s = sessionCheck.session;
      const isAdmin =
        s.role === 'super_admin' ||
        s.role === 'director' ||
        s.role === 'franchise_manager' ||
        s.role === 'reviewer' ||
        s.role === 'support_staff';
      return {
        valid: true,
        uid: s.uid,
        email: s.email,
        emailVerified: true,
        name: s.name,
        role: s.role,
        permissions: s.permissions,
        isAdmin
      };
    }

    return {
      valid: false,
      error: 'Invalid or expired authentication token.'
    };
  }
}
