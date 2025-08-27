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
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Erro ao atualizar token:', error);
      throw error;
    }

    if (!data.session) {
      throw new Error('Nenhuma sessão retornada após refresh');
    }

    return data.session.access_token;
  } catch (error) {
    console.error('Erro ao atualizar token:', error);
    throw error;
  }
};

export const ensureValidToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(`Erro ao obter sessão: ${error.message}`);
    }
    
    if (!session) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se o token está próximo do vencimento (15 minutos antes)
    const expirationTime = new Date(session.expires_at!).getTime();
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;
    
    // Se expira em menos de 15 minutos, fazer refresh
    if (timeUntilExpiry < 15 * 60 * 1000) {
      console.log('Token próximo do vencimento, fazendo refresh...');
      return await refreshAuthToken();
    }

    return session.access_token;
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    throw error;
  }
};
