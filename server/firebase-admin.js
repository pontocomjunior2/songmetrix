import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Log das variáveis de ambiente para debug
console.log('Verificando variáveis de ambiente do Firebase Admin:', {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key_exists: !!process.env.FIREBASE_PRIVATE_KEY
});

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: "googleapis.com"
};

// Log do objeto serviceAccount para debug (removendo a private_key por segurança)
const debugServiceAccount = { ...serviceAccount, private_key: '[REDACTED]' };
console.log('Service Account configurado:', debugServiceAccount);

// Inicializa o Firebase Admin se ainda não estiver inicializado
let app;
try {
  app = admin.app();
} catch {
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export const auth = app.auth();
export const db = app.firestore();

// Tipos de status do usuário
export const UserStatus = {
  INATIVO: 'INATIVO',
  ATIVO: 'ATIVO',
  ADMIN: 'ADMIN'
};

// Função para verificar o status de pagamento do usuário
export const checkUserPaymentStatus = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return false;
    }
    const userData = userDoc.data();
    return userData.status === UserStatus.ATIVO || userData.status === UserStatus.ADMIN;
  } catch (error) {
    console.error('Erro ao verificar status do usuário:', error);
    return false;
  }
};

// Função para atualizar o status do usuário
export const updateUserStatus = async (userId, status) => {
  try {
    await db.collection('users').doc(userId).update({
      status,
      updatedAt: new Date().toISOString()
    });
    
    // Configura as claims baseado no status
    if (status === UserStatus.ADMIN) {
      await auth.setCustomUserClaims(userId, { admin: true });
    } else {
      await auth.setCustomUserClaims(userId, { admin: false });
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    return false;
  }
};

// Função para criar um novo usuário
export const createUser = async (userId, email) => {
  try {
    await db.collection('users').doc(userId).set({
      email,
      status: UserStatus.INATIVO,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return false;
  }
};
