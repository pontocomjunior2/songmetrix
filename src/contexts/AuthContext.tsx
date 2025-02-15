import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  auth, 
  db, 
  UserStatus,
  refreshAuthToken,
  ensureValidToken
} from '../lib/firebase';
import { UserStatusType } from '../types/components';

interface AuthContextType {
  currentUser: User | null;
  userStatus: UserStatusType | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  redirectToStripeCheckout: () => Promise<void>;
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
      // Ensure we have a valid token
      const hasValidToken = await ensureValidToken();
      if (!hasValidToken) {
        console.error('Failed to ensure valid token');
        setUserStatus(UserStatus.NOT_PAID);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        setUserStatus(docSnap.data().status as UserStatusType);
      } else {
        // Create document if it doesn't exist
        await setDoc(userRef, {
          email: user.email,
          status: UserStatus.NOT_PAID,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setUserStatus(UserStatus.NOT_PAID);
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      setUserStatus(UserStatus.NOT_PAID);
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
    const result = await signInWithEmailAndPassword(auth, email, password);
    await refreshAuthToken();
    await checkUserStatus(result.user);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await refreshAuthToken();
    await checkUserStatus(result.user);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Get fresh token
    await refreshAuthToken();
    
    const userRef = doc(db, 'users', result.user.uid);
    await setDoc(userRef, {
      email,
      status: UserStatus.NOT_PAID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Refresh token again after document creation
    await refreshAuthToken();
    await checkUserStatus(result.user);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const redirectToStripeCheckout = async () => {
    if (!currentUser) return;

    // Ensure we have a valid token
    const hasValidToken = await ensureValidToken();
    if (!hasValidToken) {
      throw new Error('Failed to ensure valid token');
    }

    const userRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists() && userDoc.data().status === UserStatus.PAID) {
      window.location.href = '/dashboard';
      return;
    }

    // Get fresh token for API request
    const token = await refreshAuthToken();
    if (!token) {
      throw new Error('Failed to get fresh token');
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${API_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: currentUser.uid,
        email: currentUser.email,
        priceId: import.meta.env.VITE_SUBSCRIPTION_PRICE_ID,
      }),
    });

    if (!response.ok) {
      throw new Error('Error creating checkout session');
    }

    const { url } = await response.json();
    window.location.href = url;
  };

  const value = {
    currentUser,
    userStatus,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    logout,
    redirectToStripeCheckout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
