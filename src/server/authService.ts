import crypto from 'crypto';
import { UserRole } from '../types/franchise';

/**
 * TRUEDEAL GLOBAL - Server-Side Authentication & Authorization Service
 *
 * Enforces server-side verification, RBAC permissions matrix,
 * tamper-proof HMAC session signatures, and Super Admin allowlists.
 */

export interface VerifiedAuthSession {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: AdminPermission[];
  issuedAt: number;
  expiresAt: number;
}

export type AdminPermission =
  | 'view_all_applications'
  | 'edit_application'
  | 'approve_application'
  | 'reject_application'
  | 'assign_reviewer'
  | 'review_documents'
  | 'verify_payments'
  | 'view_analytics'
  | 'export_reports'
  | 'view_audit_logs'
  | 'manage_team_roles'
  | 'manage_portal_settings';

// Verified Super Admin & Staff Allowlists
export const SUPER_ADMIN_EMAILS = new Set([
  'allorganizationglobal@gmail.com',
  'director@truedealglobal.com'
]);

export const FRANCHISE_MANAGER_EMAILS = new Set([
  'manager@truedealglobal.com',
  'franchise@truedealglobal.com'
]);

export const REVIEWER_EMAILS = new Set([
  'compliance@truedealglobal.com',
  'legal@truedealglobal.com',
  'audit@truedealglobal.com'
]);

export const SUPPORT_STAFF_EMAILS = new Set([
  'support@truedealglobal.com',
  'info@truedealglobal.com',
  'helpdesk@truedealglobal.com'
]);

// Permissions matrix for least-privilege role-based access control
export const ROLE_PERMISSIONS: Record<UserRole, AdminPermission[]> = {
  super_admin: [
    'view_all_applications',
    'edit_application',
    'approve_application',
    'reject_application',
    'assign_reviewer',
    'review_documents',
    'verify_payments',
    'view_analytics',
    'export_reports',
    'view_audit_logs',
    'manage_team_roles',
    'manage_portal_settings'
  ],
  franchise_manager: [
    'view_all_applications',
    'edit_application',
    'approve_application',
    'reject_application',
    'assign_reviewer',
    'review_documents',
    'verify_payments',
    'view_analytics',
    'export_reports',
    'view_audit_logs'
  ],
  director: [
    'view_all_applications',
    'edit_application',
    'approve_application',
    'reject_application',
    'assign_reviewer',
    'review_documents',
    'verify_payments',
    'view_analytics',
    'export_reports',
    'view_audit_logs',
    'manage_team_roles'
  ],
  reviewer: [
    'view_all_applications',
    'review_documents',
    'edit_application',
    'view_audit_logs'
  ],
  compliance: [
    'view_all_applications',
    'review_documents',
    'edit_application',
    'view_audit_logs'
  ],
  territory_manager: [
    'view_all_applications',
    'edit_application',
    'view_analytics'
  ],
  support_staff: [
    'view_all_applications',
    'view_analytics'
  ],
  applicant: []
};

// In-memory runtime role assignments overrides (persisted to database when configured)
const runtimeRoleOverrides = new Map<string, UserRole>();

/**
 * Derives the server-enforced role for an authenticated email
 */
export function resolveServerUserRole(email?: string | null): UserRole {
  if (!email) return 'applicant';
  const normalized = email.toLowerCase().trim();

  // 1. Runtime override set by Super Admin
  if (runtimeRoleOverrides.has(normalized)) {
    return runtimeRoleOverrides.get(normalized)!;
  }

  // 2. Verified Super Admin Allowlist
  if (SUPER_ADMIN_EMAILS.has(normalized)) {
    return 'super_admin';
  }

  // 3. Verified Manager Allowlist
  if (FRANCHISE_MANAGER_EMAILS.has(normalized)) {
    return 'franchise_manager';
  }

  // 4. Verified Reviewer Allowlist
  if (REVIEWER_EMAILS.has(normalized)) {
    return 'reviewer';
  }

  // 5. Verified Support Allowlist
  if (SUPPORT_STAFF_EMAILS.has(normalized)) {
    return 'support_staff';
  }

  // 6. Corporate domain default
  if (normalized.endsWith('@truedealglobal.com')) {
    return 'franchise_manager';
  }

  // Regular public visitors / applicants
  return 'applicant';
}

/**
 * Allows Super Admin to assign or revoke roles
 */
export function setRuntimeRoleOverride(
  targetEmail: string,
  newRole: UserRole,
  actorEmail: string
): { success: boolean; message: string } {
  const actorRole = resolveServerUserRole(actorEmail);
  if (actorRole !== 'super_admin' && actorRole !== 'director') {
    return { success: false, message: 'Only Super Admins can modify team role assignments.' };
  }

  const normalized = targetEmail.toLowerCase().trim();
  runtimeRoleOverrides.set(normalized, newRole);
  return { success: true, message: `Role for ${normalized} successfully set to ${newRole}.` };
}

export function getAllRuntimeRoleOverrides(): Record<string, UserRole> {
  const result: Record<string, UserRole> = {};
  runtimeRoleOverrides.forEach((val, key) => {
    result[key] = val;
  });
  return result;
}

/**
 * Creates a signed tamper-proof session token using server-side HMAC
 */
export function createSignedSessionToken(payload: {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
}): string {
  const secret = process.env.SESSION_SECRET || 'truedeal_franchise_vault_session_key_2026';
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 8 * 60 * 60 * 1000; // 8 hours expiry

  const sessionData = {
    uid: payload.uid,
    email: payload.email.toLowerCase().trim(),
    name: payload.name || 'Authorized User',
    role: payload.role,
    issuedAt,
    expiresAt
  };

  const jsonStr = JSON.stringify(sessionData);
  const base64Data = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');

  return `${base64Data}.${signature}`;
}

/**
 * Verifies a signed session token and returns the verified session
 */
export function verifySessionToken(token: string): {
  valid: boolean;
  session?: VerifiedAuthSession;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Session token missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed session token' };
  }

  const [base64Data, providedSignature] = parts;
  const secret = process.env.SESSION_SECRET || 'truedeal_franchise_vault_session_key_2026';

  const expectedSignature = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
  if (providedSignature !== expectedSignature) {
    return { valid: false, error: 'Invalid session signature' };
  }

  try {
    const rawJson = Buffer.from(base64Data, 'base64url').toString('utf8');
    const sessionData = JSON.parse(rawJson);

    // Check expiration
    if (Date.now() > sessionData.expiresAt) {
      return { valid: false, error: 'Session expired. Please sign in again.' };
    }

    // Always re-resolve role dynamically against server allowlist to avoid stale privileges
    const serverEnforcedRole = resolveServerUserRole(sessionData.email);
    const permissions = ROLE_PERMISSIONS[serverEnforcedRole] || [];

    return {
      valid: true,
      session: {
        uid: sessionData.uid,
        email: sessionData.email,
        name: sessionData.name,
        role: serverEnforcedRole,
        permissions,
        issuedAt: sessionData.issuedAt,
        expiresAt: sessionData.expiresAt
      }
    };
  } catch {
    return { valid: false, error: 'Failed to decode session data' };
  }
}

/**
 * Checks if a session has a required permission
 */
export function hasPermission(session: VerifiedAuthSession, permission: AdminPermission): boolean {
  if (!session || !session.permissions) return false;
  return session.permissions.includes(permission);
}
