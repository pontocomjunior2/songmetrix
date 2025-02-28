import { supabase } from './supabase-client';

export const UserStatus = {
  ATIVO: 'ATIVO',
  INATIVO: 'INATIVO',
  ADMIN: 'ADMIN',
  TRIAL: 'TRIAL'
} as const;

export type UserStatusType = typeof UserStatus[keyof typeof UserStatus];

export const refreshAuthToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.warn('Nenhum usuário autenticado para atualizar o token');
      return;
    }

    const { data: { user }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !user) {
      throw refreshError;
    }

    return session.access_token;
  } catch (error) {
    console.error('Erro ao atualizar token:', error);
    throw error;
  }
};

export const ensureValidToken = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    throw new Error('Usuário não autenticado');
  }

  const expirationTime = new Date(session.expires_at!).getTime() / 1000;
  const now = new Date().getTime() / 1000;

  // Se o token expira em menos de 5 minutos, atualiza
  if (expirationTime - now < 300) {
    return await refreshAuthToken();
  }

  return session.access_token;
};
