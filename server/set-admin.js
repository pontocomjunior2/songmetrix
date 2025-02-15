import { auth, db, UserStatus } from './firebase-admin.js';

const setAdmin = async (email) => {
  try {
    // Busca o usuário pelo email
    const userRecord = await auth.getUserByEmail(email);
    
    // Define as custom claims para admin
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    
    // Atualiza o status no Firestore
    await db.collection('users').doc(userRecord.uid).update({
      status: UserStatus.ADMIN,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`Usuário ${email} definido como admin com sucesso`);
  } catch (error) {
    console.error('Erro ao definir admin:', error);
  }
};

// Pega o email do argumento da linha de comando
const email = process.argv[2];
if (!email) {
  console.error('Por favor, forneça o email do usuário');
  process.exit(1);
}

setAdmin(email);
