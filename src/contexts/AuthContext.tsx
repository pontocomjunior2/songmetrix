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
  setPersistence,
  deleteUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
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
  removeUser: (uid: string) => Promise<void>;
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
      
      await refreshAuthToken();
      
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
        
        const updateData: any = {};
        if (user.photoURL && user.photoURL !== userData.photoURL) {
          updateData.photoURL = user.photoURL;
        }
        if (user.displayName && user.displayName !== userData.displayName) {
          updateData.displayName = user.displayName;
        }
        if (Object.keys(updateData).length > 0) {
          updateData.updatedAt = new Date().toISOString();
          await updateDoc(userRef, updateData);
        }
        
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
          if (currentToken.claims.admin) {
            await auth.currentUser?.getIdToken(true);
            await refreshAuthToken();
          }
        } else {
          setUserStatus(UserStatus.INATIVO);
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
          displayName: user.displayName,
          photoURL: user.photoURL,
          status: UserStatus.INATIVO,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setUserStatus(UserStatus.INATIVO);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
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
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await refreshAuthToken();
      await checkUserStatus(result.user);
    } catch (error: any) {
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
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        status,
        updatedAt: new Date().toISOString()
      });
      
      if (currentUser?.uid === uid) {
        setUserStatus(status);
        if (status === UserStatus.ADMIN) {
          await refreshAuthToken();
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  };

  const getAllUsers = async (): Promise<UserType[]> => {
    try {
      if (!auth.currentUser) {
        throw new Error('Usuário não autenticado');
      }

      await refreshAuthToken();
      const tokenResult = await auth.currentUser.getIdTokenResult(true);

      if (!tokenResult.claims.admin) {
        throw new Error('Usuário não tem permissão de administrador');
      }

      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists() || userDoc.data().status !== UserStatus.ADMIN) {
        throw new Error('Usuário não tem permissão de administrador');
      }

      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      return snapshot.docs.map((doc) => ({
        ...doc.data(),
        uid: doc.id
      })) as UserType[];
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw error;
    }
  };

  const removeUser = async (uid: string) => {
    try {
      if (!auth.currentUser) {
        throw new Error('Usuário não autenticado');
      }

      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      if (!tokenResult.claims.admin) {
        throw new Error('Usuário não tem permissão de administrador');
      }

      // Remove o documento do usuário no Firestore
      const userRef = doc(db, 'users', uid);
      await deleteDoc(userRef);

      console.log('Usuário removido com sucesso');
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
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
    getAllUsers,
    removeUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
