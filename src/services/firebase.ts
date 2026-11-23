import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  FirestoreSettings,
  doc,
  getDocFromServer,
  setDoc,
  getDocs,
  collection,
  query,
  where
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { FranchiseApplication } from '../types/franchise';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const firestoreDatabaseId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

/**
 * Initialize Cloud Firestore with forced long-polling in browser environments.
 * Prevents the 10-second WebChannel streaming timeout ("Could not reach Cloud Firestore backend")
 * behind buffering proxies, corporate firewalls, and sandboxed preview iframes.
 */
function initFirestoreDb(): Firestore {
  if (typeof window !== 'undefined') {
    const settings: FirestoreSettings = {
      experimentalForceLongPolling: true,
      experimentalLongPollingOptions: { timeoutSeconds: 15 }
    };
    try {
      return firestoreDatabaseId
        ? initializeFirestore(app, settings, firestoreDatabaseId)
        : initializeFirestore(app, settings);
    } catch {
      // Firestore instance already initialized on this app (e.g., module reload)
    }
  }
  return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
}

// Initialize Firestore (support custom databaseId if configured)
export const db = initFirestoreDb();

// Initialize Firebase Authentication & Storage
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// =========================================================================
// Structured Firestore Error Handling (per Firebase SDK guidelines)
// =========================================================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Returns a fresh Firebase Auth ID token for authenticating server-side API calls
 * (e.g., Razorpay order creation, payment verification, admin payment reconciliation).
 */
export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.warn('Could not obtain Firebase ID token:', err);
    return null;
  }
}

// Sign in with Google
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      // Sync user profile to Firestore (respecting hardened rules: no role escalation)
      try {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(
          userRef,
          {
            uid: result.user.uid,
            displayName: result.user.displayName || 'Authorized Partner',
            email: result.user.email || '',
            photoURL: result.user.photoURL || '',
            lastLoginAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, `users/${result.user.uid}`);
      }
      return result.user;
    }
    return null;
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';

    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorMessage.includes('popup-closed-by-user') ||
      errorMessage.includes('cancelled-popup-request')
    ) {
      console.info('Google sign-in dialog was closed or cancelled by the user.');
      return null;
    }

    if (errorCode === 'auth/popup-blocked') {
      console.warn('Google sign-in popup was blocked by the browser.');
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site and try again, or proceed directly with Razorpay Checkout using your Name, Email, and Mobile Number.');
    }

    if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized-domain')) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      console.warn(`Firebase Google Sign-In unauthorized domain: ${host}`);
      throw new Error(
        `Google Sign-In is not yet authorized for "${host}". Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains. You can still pay immediately via Razorpay Checkout below using your Name, Email, and Mobile Number.`
      );
    }

    if (errorCode === 'auth/operation-not-allowed') {
      console.warn('Google sign-in provider is not enabled in Firebase Authentication.');
      throw new Error(
        'Google Sign-In is not currently enabled for this domain. You can still complete Razorpay Checkout directly using your Name, Email, and Mobile Number.'
      );
    }

    console.warn('Firebase Google Sign-In warning:', error);
    throw error;
  }
}

// Sign out
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// Database Metadata & Configuration
export const firestoreInfo = {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  collections: [
    { name: 'franchise_applications', desc: 'Authorized Franchise Partner Applications' },
    { name: 'franchise_payments', desc: 'Server-Verified Razorpay Payment Ledger' },
    { name: 'franchise_plans', desc: 'Published Franchise Plan Catalog' },
    { name: 'franchise_documents', desc: 'Private KYC Document Metadata' },
    { name: 'payment_webhook_events', desc: 'Idempotent Razorpay Webhook Event Logs' },
    { name: 'admin_audit_logs', desc: 'Immutable Security & Payment Audit Logs' },
    { name: 'applications', desc: 'Legacy Franchise Applications Collection' },
    { name: 'audit_logs', desc: 'Legacy Security Audit Logs' },
    { name: 'users', desc: 'Authorized User Profiles' }
  ]
};

// Ping Firestore Database with latency measurement
export async function pingFirestoreDatabase(): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  databaseId: string;
  projectId: string;
}> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Browser is offline (local resilient cache active)',
      databaseId: firestoreInfo.databaseId,
      projectId: firestoreInfo.projectId
    };
  }

  const startTime = Date.now();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      message: `Database connection verified (${latencyMs}ms)`,
      databaseId: firestoreInfo.databaseId,
      projectId: firestoreInfo.projectId
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const code = typeof error?.code === 'string' ? error.code : '';
    const msg = error instanceof Error ? error.message : String(error);

    // A permission-denied error comes directly from the live Cloud Firestore server, proving reachability
    if (code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
      return {
        success: true,
        latencyMs,
        message: `Database reachable & security rules active (${latencyMs}ms)`,
        databaseId: firestoreInfo.databaseId,
        projectId: firestoreInfo.projectId
      };
    }

    return {
      success: false,
      latencyMs,
      message:
        code === 'unavailable' || msg.includes('offline')
          ? 'Database client offline (resilient cache active)'
          : msg,
      databaseId: firestoreInfo.databaseId,
      projectId: firestoreInfo.projectId
    };
  }
}

// Connection test on boot
export async function testConnection(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const result = await pingFirestoreDatabase();
  return result.success;
}

// Helper to check if email is an authorized administrator (UI visibility hint only; server/rules enforce authorization)
export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === 'allorganizationglobal@gmail.com' ||
    normalized === 'director@truedealglobal.com' ||
    normalized.endsWith('@truedealglobal.com')
  );
}

/**
 * Private KYC document upload to Firebase Storage + metadata record in `franchise_documents`.
 * Validates file type and size strictly before upload.
 */
const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);
const MIN_DOC_BYTES = 100;
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadFranchiseDocumentToStorage(params: {
  file: File;
  applicationId: string;
  documentType: string;
  documentId: string;
  cipherChecksum?: string;
}): Promise<{
  uploaded: boolean;
  storagePath?: string;
  downloadUrl?: string;
  error?: string;
}> {
  const user = auth.currentUser;
  if (!user) {
    return { uploaded: false, error: 'Sign in with Google to store KYC files in private cloud storage.' };
  }

  if (!ALLOWED_DOC_MIMES.has(params.file.type)) {
    return { uploaded: false, error: 'Only PDF, JPG, PNG, and WEBP documents are accepted.' };
  }

  if (params.file.size < MIN_DOC_BYTES || params.file.size > MAX_DOC_BYTES) {
    return { uploaded: false, error: 'Document size must be between 100 bytes and 10 MB.' };
  }

  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storagePath = `franchise_documents/${user.uid}/${params.applicationId}/${params.documentId}_${safeName}`;

  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, params.file, {
      contentType: params.file.type,
      customMetadata: {
        ownerUid: user.uid,
        applicationId: params.applicationId,
        documentType: params.documentType
      }
    });
    const downloadUrl = await getDownloadURL(storageRef);

    // Record private metadata in Firestore `franchise_documents`
    await setDoc(doc(db, 'franchise_documents', params.documentId), {
      documentId: params.documentId,
      applicationId: params.applicationId,
      userId: user.uid,
      documentType: params.documentType,
      fileName: safeName,
      mimeType: params.file.type,
      sizeBytes: params.file.size,
      storagePath,
      verificationStatus: 'pending_audit',
      cipherChecksum: params.cipherChecksum || '',
      uploadedAt: new Date().toISOString()
    });

    return { uploaded: true, storagePath, downloadUrl };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `franchise_documents/${params.documentId}`);
    return { uploaded: false, error: err?.message || 'Cloud storage upload failed.' };
  }
}

// Background sync to Firestore for applications (writes to both canonical `franchise_applications` and legacy `applications`)
export async function syncApplicationToFirestore(application: FranchiseApplication): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const ownerUid = application.userId || user.uid;
  const nowIso = new Date().toISOString();

  // Canonical blueprint record in `franchise_applications`
  const canonicalPayload = {
    applicationId: application.id,
    userId: ownerUid,
    applicantName: application.applicant.fullName,
    email: application.applicant.email.toLowerCase(),
    phone: application.applicant.phone,
    city: application.applicant.city,
    state: application.applicant.stateProvince,
    country: application.applicant.country,
    franchisePlanId: application.planId,
    planId: application.planId,
    status: application.status,
    paymentStatus: application.paymentStatus || 'PAYMENT_PENDING',
    amount: typeof application.amount === 'number' ? application.amount : 0,
    territoryRequested: application.territoryRequested,
    createdAt: application.createdAt || nowIso,
    updatedAt: nowIso
  };

  let ok = false;
  try {
    await setDoc(doc(db, 'franchise_applications', application.id), canonicalPayload, { merge: true });
    ok = true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `franchise_applications/${application.id}`);
  }

  // Legacy collection sync for backward compatibility
  try {
    await setDoc(
      doc(db, 'applications', application.id),
      {
        ...application,
        userId: ownerUid,
        _syncedAt: nowIso
      },
      { merge: true }
    );
    ok = true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `applications/${application.id}`);
  }

  return ok;
}

// Background sync to Firestore for audit logs (immutable create-only)
export async function syncAuditLogToFirestore(log: {
  id: string;
  timestamp: string;
  action: string;
  resourceId?: string;
  details: string;
  userRole?: string;
  userEmail?: string;
  checksum?: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    await setDoc(doc(db, 'admin_audit_logs', log.id), {
      logId: log.id,
      actorUid: user.uid,
      actorEmail: log.userEmail || user.email || '',
      action: log.action,
      resourceId: log.resourceId || '',
      details: log.details,
      timestamp: log.timestamp
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `admin_audit_logs/${log.id}`);
    return false;
  }
}

// Fetch ONLY the authenticated applicant's own applications (strictly matches Firestore `allow list` rules)
export async function fetchMyApplicationsFromFirestore(uid: string): Promise<FranchiseApplication[]> {
  if (!uid) return [];
  try {
    const q = query(collection(db, 'applications'), where('userId', '==', uid));
    const snapshot = await getDocs(q);
    const items: FranchiseApplication[] = [];
    snapshot.forEach((d) => {
      items.push(d.data() as FranchiseApplication);
    });
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'applications');
    return [];
  }
}

// Fetch all applications from Firestore (Strictly Verified Admin)
export async function fetchApplicationsFromFirestore(): Promise<FranchiseApplication[]> {
  try {
    const snapshot = await getDocs(collection(db, 'applications'));
    const items: FranchiseApplication[] = [];
    snapshot.forEach((d) => {
      items.push(d.data() as FranchiseApplication);
    });
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'applications');
    return [];
  }
}

// Trigger connection test non-blockingly
testConnection().catch(() => {});
