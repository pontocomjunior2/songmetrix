#!/usr/bin/env node

/**
 * Script para verificar usuários admin no sistema
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAdminUsers() {
  try {
    console.log('👥 Verificando usuários admin no sistema...\n');

    // 1. Verificar tabela admins
    console.log('1️⃣ Verificando tabela admins...');
    const { data: admins, error: adminsError } = await supabase
      .from('admins')
      .select('*');

    if (adminsError) {
      console.error('❌ Erro ao buscar admins:', adminsError.message);
    } else {
      console.log(`📊 Admins encontrados: ${admins?.length || 0}`);
      if (admins && admins.length > 0) {
        admins.forEach((admin, index) => {
          console.log(`${index + 1}. User ID: ${admin.user_id}`);
        });
      }
    }

    // 2. Verificar usuários na tabela users
    console.log('\n2️⃣ Verificando usuários na tabela users...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, status')
      .limit(10);

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError.message);
    } else {
      console.log(`📊 Usuários encontrados: ${users?.length || 0}`);
      if (users && users.length > 0) {
        console.log('\nPrimeiros usuários:');
        users.forEach((user, index) => {
          console.log(`${index + 1}. ${user.full_name || 'Sem nome'} (${user.email}) - Status: ${user.status || 'N/A'}`);
          console.log(`   ID: ${user.id}`);
        });
      }
    }

    // 3. Verificar se há usuários com email admin
    console.log('\n3️⃣ Buscando usuários com email admin...');
    const { data: adminUsers, error: adminUsersError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', '%admin%');

    if (adminUsersError) {
      console.error('❌ Erro ao buscar usuários admin:', adminUsersError.message);
    } else {
      console.log(`📊 Usuários com 'admin' no email: ${adminUsers?.length || 0}`);
      if (adminUsers && adminUsers.length > 0) {
        adminUsers.forEach((user, index) => {
          console.log(`${index + 1}. ${user.full_name || 'Sem nome'} (${user.email})`);
          console.log(`   ID: ${user.id}`);
          console.log(`   Status: ${user.status || 'N/A'}`);
        });
      }
    }

    // 4. Verificar usuários do Supabase Auth
    console.log('\n4️⃣ Verificando usuários no Supabase Auth...');
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('❌ Erro ao buscar usuários do Auth:', authError.message);
      } else {
        console.log(`📊 Usuários no Auth: ${authUsers.users?.length || 0}`);
        if (authUsers.users && authUsers.users.length > 0) {
          console.log('\nPrimeiros usuários do Auth:');
          authUsers.users.slice(0, 5).forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} - ID: ${user.id}`);
            console.log(`   Criado em: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
            console.log(`   Confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`);
          });
        }
      }
    } catch (authError) {
      console.error('❌ Erro ao acessar Auth:', authError.message);
    }

  } catch (error) {
    console.error('💥 Erro geral:', error.message);
  }
}

// Executar verificação
checkAdminUsers().then(() => {
  console.log('\n✅ Verificação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});