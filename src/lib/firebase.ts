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
  INATIVO: 'INATIVO',
  ATIVO: 'ATIVO',
  ADMIN: 'ADMIN'
} as const;

// Function to refresh auth token
export const refreshAuthToken = async (): Promise<string | null> => {
  try {
    console.log('Iniciando refresh do token...');
    const user = auth.currentUser;
    if (!user) {
      console.log('Nenhum usuário logado');
      return null;
    }

    console.log('Forçando refresh do token...');
    const token = await user.getIdToken(true);
    
    // Wait longer for token propagation (5 seconds)
    console.log('Aguardando propagação do token (5 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify if admin claim is present
    console.log('Verificando claims do token...');
    const decodedToken = await user.getIdTokenResult(true);
    
    // Log detalhado do token
    const tokenInfo = {
      claims: decodedToken.claims,
      isAdmin: decodedToken.claims.admin === true,
      token: {
        authTime: decodedToken.authTime,
        issuedAtTime: decodedToken.issuedAtTime,
        expirationTime: decodedToken.expirationTime,
        signInProvider: decodedToken.signInProvider,
      }
    };
    console.log('Token atualizado:', JSON.stringify(tokenInfo, null, 2));
    
    // Verifica se as claims admin estão presentes
    if (!decodedToken.claims.admin) {
      console.warn('Alerta: Token não possui a claim admin!');
      console.log('Claims disponíveis:', Object.keys(decodedToken.claims));
    }
    
    return token;
  } catch (error) {
    console.error('Erro detalhado ao atualizar token:', error);
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
