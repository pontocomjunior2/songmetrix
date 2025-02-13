import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { UserStatusType } from '../types/components';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias de auth e firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// Constantes para status do usuário
export const UserStatus: { [key: string]: UserStatusType } = {
  NOT_PAID: 'NOT_PAID',
  PAID: 'PAID',
  ADMIN: 'ADMIN'
} as const;

// Função para verificar se o usuário tem acesso
export const checkUserAccess = async (userId: string): Promise<boolean> => {
  try {
    // Força a atualização do token para receber as claims mais recentes
    const user = auth.currentUser;
    if (user) {
      await user.getIdToken(true);
    }

    // Verifica o token atual
    const idTokenResult = await user?.getIdTokenResult();
    if (idTokenResult?.claims.paid === true || idTokenResult?.claims.admin === true) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Erro ao verificar acesso do usuário:', error);
    return false;
  }
};

// Função para obter o status atual do usuário
export const getUserStatus = async (userId: string): Promise<UserStatusType | null> => {
  try {
    const idTokenResult = await auth.currentUser?.getIdTokenResult();
    if (idTokenResult?.claims.admin) return UserStatus.ADMIN;
    if (idTokenResult?.claims.paid) return UserStatus.PAID;
    return UserStatus.NOT_PAID;
  } catch (error) {
    console.error('Erro ao obter status do usuário:', error);
    return null;
  }
};
