import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { 
  auth, 
  db, 
  UserStatus,
  refreshAuthToken,
  ensureValidToken
} from '../lib/firebase';
import { UserStatusType, User as UserType } from '../types/components';

interface AuthContextType {
  currentUser: User | null;
  userStatus: UserStatusType | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserStatus: (uid: string, status: UserStatusType) => Promise<void>;
  getAllUsers: () => Promise<UserType[]>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatusType | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to check user status
  const checkUserStatus = async (user: User) => {
    try {
      console.log('Verificando status do usuário:', user.email);
      
      // Força atualização do token primeiro
      await refreshAuthToken();
      
      // Verifica claims atuais após atualização
      const currentToken = await user.getIdTokenResult(true);
      console.log('Claims atuais:', {
        claims: JSON.stringify(currentToken.claims, null, 2),
        isAdmin: currentToken.claims.admin === true
      });

      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        console.log('Dados do usuário no Firestore:', userData);
        
        // Define o status com base nas regras de negócio
        if (userData.status === UserStatus.ADMIN) {
          if (!currentToken.claims.admin) {
            console.log('Usuário é ADMIN no Firestore, forçando atualização do token...');
            await auth.currentUser?.getIdToken(true);
            await refreshAuthToken();
            const newToken = await user.getIdTokenResult(true);
            if (newToken.claims.admin) {
              setUserStatus(UserStatus.ADMIN);
            } else {
              console.warn('Usuário é ADMIN no Firestore mas não tem a claim admin no token!');
              setUserStatus(UserStatus.INATIVO);
            }
          } else {
            setUserStatus(UserStatus.ADMIN);
          }
        } else if (userData.status === UserStatus.ATIVO) {
          setUserStatus(UserStatus.ATIVO);
          // Remove admin claim if exists
          if (currentToken.claims.admin) {
            await auth.currentUser?.getIdToken(true);
            await refreshAuthToken();
          }
        } else {
          setUserStatus(UserStatus.INATIVO);
          // Remove admin claim if exists
          if (currentToken.claims.admin) {
            await auth.currentUser?.getIdToken(true);
            await refreshAuthToken();
          }
        }
      } else {
        console.log('Documento do usuário não existe, criando...');
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          status: UserStatus.INATIVO,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setUserStatus(UserStatus.INATIVO);
      }
    } catch (error) {
      console.error('Erro detalhado ao verificar status:', error);
      if (error instanceof Error) {
        const errorDetails: any = {
          message: error.message,
          name: error.name,
          stack: error.stack
        };
        
        // Adiciona código de erro se existir (Firebase Error)
        if ('code' in error) {
          errorDetails.code = (error as any).code;
        }
        
        console.error('Detalhes do erro:', JSON.stringify(errorDetails, null, 2));
      }
      setUserStatus(UserStatus.INATIVO);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await checkUserStatus(user);
      } else {
        setCurrentUser(null);
        setUserStatus(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log('Iniciando login com email:', email);
      await setPersistence(auth, browserLocalPersistence);
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login bem sucedido, atualizando token...');
      
      await refreshAuthToken();
      
      // Verifica as claims logo após o login
      const tokenResult = await result.user.getIdTokenResult();
      console.log('Claims após login:', {
        claims: tokenResult.claims,
        isAdmin: tokenResult.claims.admin === true,
        expirationTime: tokenResult.expirationTime
      });
      
      await checkUserStatus(result.user);
      console.log('Status do usuário atualizado');
    } catch (error: any) {
      console.error('Erro detalhado no login:', error);
      if (error.code === 'auth/invalid-credential') {
        throw new Error('Email ou senha inválidos');
      }
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await refreshAuthToken();
    await checkUserStatus(result.user);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    await refreshAuthToken();
    
    const userRef = doc(db, 'users', result.user.uid);
    await setDoc(userRef, {
      uid: result.user.uid,
      email,
      status: UserStatus.INATIVO,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    await refreshAuthToken();
    await checkUserStatus(result.user);
  };

  const updateUserStatus = async (uid: string, status: UserStatusType) => {
    try {
      console.log('Atualizando status do usuário:', { uid, status });
      
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        status,
        updatedAt: new Date().toISOString()
      });
      
      // Se o usuário atual está atualizando seu próprio status
      if (currentUser?.uid === uid) {
        console.log('Atualizando status do usuário atual');
        setUserStatus(status);
        
        // Se o status for alterado para ADMIN, força atualização do token
        if (status === UserStatus.ADMIN) {
          console.log('Status alterado para ADMIN, forçando atualização do token...');
          await refreshAuthToken();
          const tokenResult = await currentUser.getIdTokenResult(true);
          console.log('Novo token após atualização de status:', {
            claims: tokenResult.claims,
            isAdmin: tokenResult.claims.admin === true
          });
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar status do usuário:', error);
      throw error;
    }
  };

  const getAllUsers = async (): Promise<UserType[]> => {
    try {
      console.log('Iniciando busca de usuários...');
      
      if (!auth.currentUser) {
        console.error('Nenhum usuário logado');
        throw new Error('Usuário não autenticado');
      }

      // Primeiro, força a atualização do token
      console.log('Forçando atualização do token...');
      await refreshAuthToken();
      
      // Verifica claims após atualização
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      console.log('Claims após atualização:', {
        claims: tokenResult.claims,
        isAdmin: tokenResult.claims.admin === true
      });

      if (!tokenResult.claims.admin) {
        console.error('Usuário não tem claim de admin no token');
        throw new Error('Usuário não tem permissão de administrador');
      }

      // Verifica se o usuário é admin no Firestore
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists() || userDoc.data().status !== UserStatus.ADMIN) {
        throw new Error('Usuário não tem permissão de administrador no Firestore');
      }

      // Busca todos os usuários
      const usersRef = collection(db, 'users');
      console.log('Buscando usuários da coleção:', usersRef.path);

      try {
        const snapshot = await getDocs(usersRef);
        console.log('Número de documentos encontrados:', snapshot.size);
        
        return snapshot.docs.map((doc: any) => ({
          ...doc.data(),
          uid: doc.id
        })) as UserType[];
      } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        if (error instanceof Error && error.message.includes('permission')) {
          // Se o erro for de permissão, tenta atualizar o token novamente
          await refreshAuthToken();
          // Tenta buscar os usuários novamente
          const newSnapshot = await getDocs(usersRef);
          return newSnapshot.docs.map((doc: any) => ({
            ...doc.data(),
            uid: doc.id
          })) as UserType[];
        }
        throw error;
      }
    } catch (error) {
      console.error('Erro detalhado ao buscar usuários:', error);
      if (error instanceof Error) {
        console.error('Detalhes do erro:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    currentUser,
    userStatus,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    logout,
    updateUserStatus,
    getAllUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
