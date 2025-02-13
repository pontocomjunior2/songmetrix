import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

const serviceAccount = {
  type: "service_account",
  project_id: process.env.VITE_FIREBASE_PROJECT_ID,
  private_key_id: "80c8ca01639a85b223ace46943e8b6df6a375941",
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: "116930545188921634887",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-y55zb%40dataradio-823f1.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

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
  NOT_PAID: 'NOT_PAID',
  PAID: 'PAID',
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
    return userData.status === UserStatus.PAID || userData.status === UserStatus.ADMIN;
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
    
    // Se o status for PAID, adiciona claims personalizadas ao token do usuário
    if (status === UserStatus.PAID) {
      await auth.setCustomUserClaims(userId, { paid: true });
    } else {
      await auth.setCustomUserClaims(userId, { paid: false });
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
      status: UserStatus.NOT_PAID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return false;
  }
};
