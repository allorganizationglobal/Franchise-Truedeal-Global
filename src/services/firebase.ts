import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, setDoc, getDocs, collection } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { FranchiseApplication } from '../types/franchise';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore (support custom databaseId if configured)
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Connection test on boot as required by Firebase integration guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline. Operating in resilient offline cache mode.');
    }
    return false;
  }
}

// Background sync to Firestore
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

// Fetch all applications from Firestore
export async function fetchApplicationsFromFirestore(): Promise<FranchiseApplication[]> {
  try {
    const snapshot = await getDocs(collection(db, 'applications'));
    const items: FranchiseApplication[] = [];
    snapshot.forEach((d) => {
      items.push(d.data() as FranchiseApplication);
    });
    return items;
  } catch (err) {
    console.warn('Could not fetch from Firestore, falling back to local storage:', err);
    return [];
  }
}

// Trigger connection test non-blockingly
testConnection().catch(() => {});
