import { auth, db, UserStatus } from './firebase-admin.js';

const setAdmin = async (email) => {
  try {
    console.log('Iniciando processo de definição de admin para:', email);
    
    // Busca o usuário pelo email
    const userRecord = await auth.getUserByEmail(email);
    console.log('Usuário encontrado:', {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      customClaims: userRecord.customClaims
    });
    
    // Define as custom claims para admin
    console.log('Definindo custom claims...');
    await auth.setCustomUserClaims(userRecord.uid, { 
      admin: true,
      name: userRecord.displayName || email,
      picture: userRecord.photoURL || ''
    });
    
    // Verifica se as claims foram definidas
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log('Claims após atualização:', updatedUser.customClaims);
    
    if (!updatedUser.customClaims?.admin) {
      throw new Error('Falha ao definir claim admin');
    }
    
    // Atualiza o status no Firestore
    console.log('Atualizando status no Firestore...');
    const userRef = db.collection('users').doc(userRecord.uid);
    await userRef.update({
      status: UserStatus.ADMIN,
      updatedAt: new Date().toISOString(),
      name: userRecord.displayName || email,
      picture: userRecord.photoURL || ''
    });
    
    // Verifica o documento atualizado
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    console.log('Documento do usuário após atualização:', userData);
    
    if (userData.status !== UserStatus.ADMIN) {
      throw new Error('Falha ao atualizar status no Firestore');
    }
    
    console.log(`Usuário ${email} definido como admin com sucesso`);
    console.log('Claims definidas:', updatedUser.customClaims);
    console.log('Status no Firestore:', userData.status);
    console.log('Por favor faça logout e login novamente para atualizar as permissões');
  } catch (error) {
    console.error('Erro detalhado ao definir admin:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
};

// Pega o email do argumento da linha de comando
const email = process.argv[2];
if (!email) {
  console.error('Por favor, forneça o email do usuário');
  process.exit(1);
}

setAdmin(email);
