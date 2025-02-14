import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Inicializa o Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.VITE_FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Função para definir um usuário como admin
async function setUserAsAdmin(email) {
  try {
    // Busca o usuário pelo email
    const user = await admin.auth().getUserByEmail(email);
    
    // Define as custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
      paid: true
    });

    // Atualiza o documento do usuário no Firestore
    await admin.firestore().collection('users').doc(user.uid).update({
      status: 'ADMIN',
      updatedAt: new Date().toISOString()
    });

    console.log(`Usuário ${email} definido como admin com sucesso!`);
  } catch (error) {
    console.error('Erro ao definir usuário como admin:', error);
  } finally {
    process.exit();
  }
}

// Email do usuário que você quer tornar admin
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('Por favor, forneça o email do usuário como argumento.');
  process.exit(1);
}

setUserAsAdmin(userEmail);
