import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Criar cliente Supabase com chave de serviço para acesso admin
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Tipos de status do usuário
export const UserStatus = {
  INATIVO: 'INATIVO',
  ATIVO: 'ATIVO',
  ADMIN: 'ADMIN'
};

// Função para configurar claims iniciais do usuário
export const setInitialUserClaims = async (userId) => {
  try {
    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      throw error || new Error('Usuário não encontrado');
    }

    // No Supabase, podemos usar RLS policies em vez de claims
    // Mas também podemos atualizar metadados do usuário se necessário
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          admin: userData.status === UserStatus.ADMIN,
          paid: userData.status === UserStatus.ATIVO || userData.status === UserStatus.ADMIN,
          status: userData.status
        }
      }
    );

    if (updateError) throw updateError;

    return userData;
  } catch (error) {
    console.error('Erro ao configurar claims iniciais:', error);
    throw error;
  }
};

// Função para verificar o status de pagamento do usuário
export const checkUserPaymentStatus = async (userId) => {
  try {
    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      return false;
    }

    return userData.status === UserStatus.ATIVO || userData.status === UserStatus.ADMIN;
  } catch (error) {
    console.error('Erro ao verificar status do usuário:', error);
    return false;
  }
};

// Função para atualizar o status do usuário
export const updateUserStatus = async (userId, status) => {
  try {
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Atualizar metadados do usuário
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          admin: status === UserStatus.ADMIN,
          paid: status === UserStatus.ATIVO || status === UserStatus.ADMIN,
          status
        }
      }
    );

    if (authError) throw authError;

    return true;
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    return false;
  }
};

// Função para criar um novo usuário
export const createUser = async (userId, email) => {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .insert([{
        id: userId,
        email,
        status: UserStatus.INATIVO,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        favorite_radios: []
      }]);

    if (error) throw error;

    // Configurar metadados iniciais
    await setInitialUserClaims(userId);

    return true;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return false;
  }
};

// Função para verificar e atualizar metadados do usuário
export const verifyAndUpdateClaims = async (userId) => {
  try {
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw userError || new Error('Usuário não encontrado');
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError) throw authError;

    const currentMetadata = user?.user_metadata || {};
    const newMetadata = {
      admin: userData.status === UserStatus.ADMIN,
      paid: userData.status === UserStatus.ATIVO || userData.status === UserStatus.ADMIN,
      status: userData.status
    };

    // Verificar se os metadados precisam ser atualizados
    if (JSON.stringify(currentMetadata) !== JSON.stringify(newMetadata)) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { user_metadata: newMetadata }
      );

      if (updateError) throw updateError;
      return newMetadata;
    }

    return currentMetadata;
  } catch (error) {
    console.error('Erro ao verificar/atualizar metadados:', error);
    throw error;
  }
};

export default supabaseAdmin;
