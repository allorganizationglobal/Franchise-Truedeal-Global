import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  resolveServerUserRole,
  ROLE_PERMISSIONS,
  AdminPermission,
  verifySessionToken
} from './authService.js';
import type { UserRole } from '../types/franchise.js';

/**
 * TRUEDEAL GLOBAL — Server-Side Firebase ID Token Verification
 *
 * Uses firebase-admin/auth initialized ONLY with projectId (requires ZERO IAM roles
 * and ZERO service account private keys — works safely on Google-hosted Starter Tier
 * projects as well as upgraded Google Cloud projects and Vercel serverless functions).
 *
 * NOTE: Server-side Firestore reads/writes via Admin SDK are intentionally NOT used
 * on a Google-hosted Starter Tier project. All Firestore persistence uses the client
 * SDK secured by hardened Eight-Pillar firestore.rules.
 */

const DEFAULT_FIREBASE_PROJECT_ID = 'rational-medium-x5wls';

function resolveFirebaseProjectId(): string {
  const envProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  return envProjectId || DEFAULT_FIREBASE_PROJECT_ID;
}

function getFirebaseAdminAuthApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    projectId: resolveFirebaseProjectId()
  });
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

  // 1. Primary path: Cryptographic Firebase ID token verification (no IAM required)
  try {
    const adminApp = getFirebaseAdminAuthApp();
    const decoded = await getAuth(adminApp).verifyIdToken(bearerToken);

    if (!decoded.uid || !decoded.email) {
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
      uid: decoded.uid,
      email,
      emailVerified: true,
      name: (decoded.name as string) || email.split('@')[0],
      role,
      permissions,
      isAdmin
    };
  } catch (firebaseErr: any) {
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
      error: firebaseErr?.code === 'auth/id-token-expired'
        ? 'Your authentication session expired. Please sign in again.'
        : 'Invalid or expired authentication token.'
    };
  }
}
