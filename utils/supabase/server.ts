import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Obtém as variáveis de ambiente para URL e chave do Supabase
const getSupabaseEnvVars = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  
  // Para funções server-side/webhooks, usamos a chave de serviço para acesso privilegiado
  const supabaseServiceKey = 
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Variáveis de ambiente de Supabase estão faltando. ' +
      'Verifique VITE_SUPABASE_URL/SUPABASE_URL e ' +
      'VITE_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY.'
    );
  }
  
  return { supabaseUrl, supabaseServiceKey };
};

/**
 * Cria um cliente Supabase para uso em componentes server-side e funções 
 * com acesso privilegiado usando a service role key
 */
export const createClient = () => {
  try {
    const { supabaseUrl, supabaseServiceKey } = getSupabaseEnvVars();
    
    // Criar cliente Supabase com chave de serviço para acesso privilegiado
    return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    console.error('Erro ao criar cliente Supabase:', error);
    throw error;
  }
}; 