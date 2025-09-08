import { createContext, useContext } from 'react';
import { User, AuthError } from '@supabase/supabase-js';

// Copiar erro customizado se ainda não estiver em um local central
class CustomAuthError extends AuthError {
  constructor(message: string) {
    super('Authentication error');
    this.name = 'AuthError';
    this.message = message;
    this.__isAuthError = true;
  }
}

// Copiar interface AuthContextType
export interface AuthContextType {
  currentUser: User | null;
  planId: string | null;
  trialEndsAt: string | null;
  favoriteSegments?: string[] | null;
  loading: boolean;
  error: string | null;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<{ error: CustomAuthError | null }>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<boolean>;
  signUp: (email: string, password: string, fullName?: string, whatsapp?: string) => Promise<{
    error: any,
    confirmation_sent?: boolean,
    should_redirect?: boolean,
    message?: string
  }>;
  updateFavoriteRadios: (radios: string[]) => Promise<void>;
  updateFavoriteSegments: (segments: string[]) => Promise<void>;
  userHasPreferences: () => Promise<boolean>;
  sendWelcomeEmail: () => Promise<boolean>;
  emergencyReset: () => void;
  clearPasswordResetCache: () => void;
}

// Criar e exportar o Contexto
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Criar e exportar o Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
} 