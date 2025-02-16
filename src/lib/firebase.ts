import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { UserStatusType } from '../types/components';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  app = initializeApp(firebaseConfig, 'default');
}

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Set language and persistence
auth.useDeviceLanguage();
auth.setPersistence(browserLocalPersistence);

// User status constants
export const UserStatus: { [key: string]: UserStatusType } = {
  NOT_PAID: 'NOT_PAID',
  PAID: 'PAID',
  ADMIN: 'ADMIN'
} as const;

// Function to refresh auth token
export const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    // Force token refresh
    const token = await user.getIdToken(true);
    
    // Wait for token propagation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return token;
  } catch (error) {
    console.error('Error refreshing auth token:', error);
    return null;
  }
};

// Function to check if token is valid
export const isTokenValid = async (): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const decodedToken = await user.getIdTokenResult();
    const expirationTime = new Date(decodedToken.expirationTime).getTime() / 1000;
    const now = Date.now() / 1000;
    
    return expirationTime > now;
  } catch (error) {
    console.error('Error checking token validity:', error);
    return false;
  }
};

// Function to ensure valid token before operations
export const ensureValidToken = async (): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const isValid = await isTokenValid();
    if (!isValid) {
      const newToken = await refreshAuthToken();
      return !!newToken;
    }

    return true;
  } catch (error) {
    console.error('Error ensuring valid token:', error);
    return false;
  }
};
