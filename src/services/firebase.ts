import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, setDoc, getDocs, collection } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { FranchiseApplication } from '../types/franchise';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore (support custom databaseId if configured)
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Sign in with Google
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      // Sync user profile to Firestore
      try {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          displayName: result.user.displayName || 'Authorized Partner',
          email: result.user.email || '',
          photoURL: result.user.photoURL || '',
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      } catch (dbErr) {
        console.warn('Could not sync user profile to Firestore:', dbErr);
      }
      return result.user;
    }
    return null;
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';

    // Gracefully handle intentional user cancellation/closure without throwing fatal errors
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
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
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
  collections: [
    { name: 'applications', desc: 'Franchise Partner Applications' },
    { name: 'audit_logs', desc: 'Immutable Security Audit Logs' },
    { name: 'users', desc: 'Authorized Administrator & User Accounts' },
    { name: 'test', desc: 'Heartbeat & Connection Probes' }
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
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      latencyMs,
      message: msg.includes('offline') ? 'Database client offline (resilient cache active)' : msg,
      databaseId: firestoreInfo.databaseId,
      projectId: firestoreInfo.projectId
    };
  }
}

// Connection test on boot as required by Firebase integration guidelines
export async function testConnection(): Promise<boolean> {
  const result = await pingFirestoreDatabase();
  return result.success;
}

// Helper to check if email is an authorized administrator
export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === 'allorganizationglobal@gmail.com' ||
    normalized === 'director@truedealglobal.com' ||
    normalized.endsWith('@truedealglobal.com')
  );
}

// Background sync to Firestore for applications
export async function syncApplicationToFirestore(application: FranchiseApplication): Promise<boolean> {
  try {
    const docRef = doc(db, 'applications', application.id);
    await setDoc(docRef, {
      ...application,
      _syncedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to sync application to Firestore:', err);
    return false;
  }
}

// Background sync to Firestore for audit logs
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
  try {
    const docRef = doc(db, 'audit_logs', log.id);
    await setDoc(docRef, {
      ...log,
      _syncedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.warn('Could not sync audit log to Firestore:', err);
    return false;
  }
}

// Fetch all applications from Firestore (Authorized Admin)
export async function fetchApplicationsFromFirestore(): Promise<FranchiseApplication[]> {
  try {
    const snapshot = await getDocs(collection(db, 'applications'));
    const items: FranchiseApplication[] = [];
    snapshot.forEach((d) => {
      items.push(d.data() as FranchiseApplication);
    });
    return items;
  } catch (err) {
    console.warn('Could not fetch from Firestore (permission or offline):', err);
    return [];
  }
}

// Trigger connection test non-blockingly
testConnection().catch(() => {});
