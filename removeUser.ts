import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';

const removeUser = async (userId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const isAdmin = user.user_metadata?.status === 'ADMIN';
    if (!isAdmin) {
      throw new Error('Usuário não tem permissão de administrador');
    }

    // Delete user using admin API endpoint
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_SERVICE_KEY
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao remover usuário');
    }

    // Refresh the users list to update the UI
    await supabase
      .from('users')
      .select()
      .limit(1)
      .single();

  } catch (error) {
    console.error('Error in removeUser:', error);
    throw error;
  }
};

export default removeUser;
