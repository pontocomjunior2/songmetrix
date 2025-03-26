import { supabase } from '../lib/supabase-client';

/**
 * Interface para a resposta de atualização de status
 */
interface UpdateStatusResponse {
  success: boolean;
  message?: string;
  error?: string;
  userId?: string;
  newStatus?: string;
  oldStatus?: string;
  brevoSync?: {
    success: boolean;
    message?: string;
    error?: string;
  };
}

/**
 * Tipos de status válidos para os usuários
 */
export type UserStatus = 'TRIAL' | 'ATIVO' | 'INATIVO' | 'ADMIN';

/**
 * Interface para representar um usuário
 */
export interface User {
  id: string;
  email: string;
  full_name?: string;
  whatsapp?: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Atualiza o status de um usuário e sincroniza com o Brevo
 * @param userId - ID do usuário a ser atualizado
 * @param newStatus - Novo status do usuário
 * @returns Resultado da operação
 */
export async function updateUserStatus(userId: string, newStatus: UserStatus): Promise<UpdateStatusResponse> {
  try {
    // Obter o token de autenticação atual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        success: false,
        error: 'Usuário não autenticado'
      };
    }
    
    const token = session.access_token;
    
    // Chamar o endpoint de atualização
    const response = await fetch('/api/users/update-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId, newStatus })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || `Erro ${response.status} ao atualizar status`
      };
    }
    
    return {
      success: true,
      message: result.message || 'Status atualizado com sucesso',
      userId: result.userId,
      newStatus: result.newStatus,
      oldStatus: result.oldStatus,
      brevoSync: result.brevoSync
    };
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Obtém uma lista de todos os usuários
 * @returns Lista de usuários
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return [];
  }
}

/**
 * Obtém os detalhes de um usuário específico
 * @param userId - ID do usuário a ser buscado
 * @returns Detalhes do usuário ou null se não encontrado
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error(`Erro ao buscar usuário ${userId}:`, error);
    return null;
  }
} 