import { supabase } from './supabase-client';

export type UserStatus = 'ADMIN' | 'ATIVO' | 'INATIVO';

export interface User {
  id: string;
  email: string;
  status: UserStatus;
}

export async function updateUserStatus(userId: string, newStatus: UserStatus) {
  try {
    if (!userId) {
      throw new Error('ID do usuário não fornecido');
    }

    const validStatus = ['ADMIN', 'ATIVO', 'INATIVO'];
    if (!validStatus.includes(newStatus)) {
      throw new Error('Status inválido');
    }

    const { data, error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    throw new Error(`Erro ao atualizar status do usuário: ${error.message}`);
  }
}
