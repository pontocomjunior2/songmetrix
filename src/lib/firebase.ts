import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const UserStatus = {
  ATIVO: 'ATIVO',
  INATIVO: 'INATIVO',
  ADMIN: 'ADMIN'
} as const;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const refreshAuthToken = async () => {
  try {
    if (!auth.currentUser) {
      console.warn('Nenhum usuário autenticado para atualizar o token');
      return;
    }

    await auth.currentUser.getIdToken(true);
    const tokenResult = await auth.currentUser.getIdTokenResult();
    
    if (!tokenResult.claims.admin) {
      console.warn('Token não possui a claim admin');
    }

  } catch (error) {
    console.error('Erro ao atualizar token:', error);
    throw error;
  }
};

export const ensureValidToken = async () => {
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado');
  }

  const tokenResult = await auth.currentUser.getIdTokenResult();
  const now = new Date().getTime() / 1000;
  const expirationTime = new Date(tokenResult.expirationTime).getTime() / 1000;

  // Se o token expira em menos de 5 minutos, atualiza
  if (expirationTime - now < 300) {
    await refreshAuthToken();
  }

  return auth.currentUser.getIdToken();
};
