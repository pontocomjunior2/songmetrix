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
  console.log('Iniciando refresh do token...');
  try {
    if (!auth.currentUser) {
      console.warn('Nenhum usuário autenticado para atualizar o token');
      return;
    }

    console.log('Forçando refresh do token...');
    await auth.currentUser.getIdToken(true);

    // Aguarda 5 segundos para garantir a propagação do token
    console.log('Aguardando propagação do token (5 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Verificando claims do token...');
    const tokenResult = await auth.currentUser.getIdTokenResult();
    
    console.log('Token atualizado:', {
      claims: tokenResult.claims,
      isAdmin: tokenResult.claims.admin === true,
      token: {
        authTime: tokenResult.authTime,
        issuedAtTime: tokenResult.issuedAtTime,
        expirationTime: tokenResult.expirationTime,
        signInProvider: tokenResult.signInProvider
      }
    });

    if (!tokenResult.claims.admin) {
      console.warn('Alerta: Token não possui a claim admin!');
    }

    console.log('Claims disponíveis:', Object.keys(tokenResult.claims));

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
