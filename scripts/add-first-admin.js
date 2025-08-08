import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(__dirname), '.env.production'),
  path.join(dirname(__dirname), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('Loaded environment variables from:', envPath);
    break;
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente necessárias não encontradas: VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addFirstAdmin() {
  try {
    console.log('🔍 Iniciando processo de adição do primeiro admin...');

    // Obter o user_id do primeiro argumento da linha de comando
    const userId = process.argv[2];
    
    if (!userId) {
      console.error('❌ Por favor, forneça o user_id como argumento:');
      console.error('   node scripts/add-first-admin.js SEU_USER_ID_AQUI');
      process.exit(1);
    }

    console.log(`📋 User ID fornecido: ${userId}`);

    // Verificar se o usuário existe no Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData.user) {
      console.error('❌ Usuário não encontrado no sistema de autenticação:', userError?.message);
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ${userData.user.email}`);

    // Verificar se a tabela admins existe
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('admins')
      .select('count', { count: 'exact', head: true });

    if (tableError && tableError.code === '42P01') {
      console.log('⚠️  Tabela admins não existe. Criando...');
      
      // Ler e executar o SQL de criação da tabela
      const fs = await import('fs');
      const createTableSQL = fs.readFileSync(
        path.join(dirname(__dirname), 'sql', 'create_admins_table.sql'), 
        'utf8'
      );
      
      // Remover a linha de INSERT do SQL para executar apenas a criação da tabela
      const sqlWithoutInsert = createTableSQL.replace(/INSERT INTO.*?;/gs, '');
      
      const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
        sql: sqlWithoutInsert
      });

      if (createError) {
        console.error('❌ Erro ao criar tabela admins:', createError);
        process.exit(1);
      }

      console.log('✅ Tabela admins criada com sucesso');
    }

    // Verificar se o usuário já é admin
    const { data: existingAdmin, error: checkError } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar admin existente:', checkError);
      process.exit(1);
    }

    if (existingAdmin) {
      console.log('ℹ️  Usuário já é administrador');
      return;
    }

    // Inserir o usuário como admin
    const { data: newAdmin, error: insertError } = await supabaseAdmin
      .from('admins')
      .insert({
        user_id: userId,
        created_by: userId
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao inserir admin:', insertError);
      process.exit(1);
    }

    console.log('🎉 Primeiro admin adicionado com sucesso!');
    console.log(`📧 Email: ${userData.user.email}`);
    console.log(`🆔 User ID: ${userId}`);
    console.log(`📅 Criado em: ${newAdmin.created_at}`);

    // Atualizar o status do usuário para ADMIN nos metadados
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { 
        ...userData.user.user_metadata,
        status: 'ADMIN',
        plan_id: 'ADMIN'
      }
    });

    if (updateError) {
      console.warn('⚠️  Erro ao atualizar metadados do usuário:', updateError);
    } else {
      console.log('✅ Metadados do usuário atualizados para ADMIN');
    }

    // Atualizar na tabela users se existir
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'ADMIN',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userUpdateError && userUpdateError.code !== '42P01') {
      console.warn('⚠️  Erro ao atualizar tabela users:', userUpdateError);
    } else if (!userUpdateError) {
      console.log('✅ Tabela users atualizada');
    }

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    process.exit(1);
  }
}

// Executar o script
addFirstAdmin();