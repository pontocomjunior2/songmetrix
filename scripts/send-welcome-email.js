// scripts/send-welcome-email.js - Script para envio manual de email de boas-vindas
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

// Carregar variáveis de ambiente
dotenv.config();

// Obter variáveis do ambiente
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Erro: variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Criar interface para leitura de input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Função para listar usuários disponíveis
 */
async function listUsers() {
  try {
    console.log('Buscando lista de usuários...');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) throw error;
    
    console.log('\nUsuários recentes:');
    console.log('-------------------');
    
    users.forEach((user, index) => {
      const date = new Date(user.created_at).toLocaleDateString('pt-BR');
      console.log(`${index + 1}. ${user.full_name || 'Sem nome'} (${user.email}) - ${user.status} - Criado em: ${date}`);
    });
    
    return users;
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return [];
  }
}

/**
 * Função para enviar email de boas-vindas
 */
async function sendWelcomeEmail(userId) {
  try {
    console.log(`\nEnviando email de boas-vindas para o usuário ID: ${userId}...`);
    
    // Obter um admin para fazer a requisição
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('status', 'ADMIN')
      .limit(1)
      .single();
      
    if (adminError || !adminUser) {
      console.error('Erro ao obter usuário admin:', adminError || 'Nenhum admin encontrado');
      return false;
    }
    
    // Gerar token de acesso para o admin
    const { data: { session }, error: authError } = await supabase.auth.admin.createSession({
      user_id: adminUser.id,
      expires_in: 60 // 60 segundos, tempo suficiente para fazer a requisição
    });
    
    if (authError || !session) {
      console.error('Erro ao gerar token para admin:', authError || 'Nenhuma sessão criada');
      return false;
    }
    
    // Fazer requisição para a API
    const response = await fetch(`${API_BASE_URL}/api/email/send-welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ userId })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('\nEmail de boas-vindas enviado com sucesso!');
      return true;
    } else {
      console.error(`\nErro ao enviar email: ${result.message}`, result.error);
      return false;
    }
  } catch (error) {
    console.error('Erro não tratado:', error);
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  try {
    console.log('\n=== ENVIO MANUAL DE EMAIL DE BOAS-VINDAS ===\n');
    
    const users = await listUsers();
    
    if (users.length === 0) {
      console.log('Nenhum usuário encontrado.');
      process.exit(0);
    }
    
    rl.question('\nDigite o número do usuário ou o ID completo: ', async (answer) => {
      let userId;
      
      // Verificar se é um número (índice na lista) ou um ID
      if (/^\d+$/.test(answer) && parseInt(answer) <= users.length) {
        const index = parseInt(answer) - 1;
        userId = users[index].id;
        console.log(`\nSelecionado: ${users[index].email}`);
      } else {
        userId = answer;
        console.log(`\nID informado: ${userId}`);
      }
      
      const result = await sendWelcomeEmail(userId);
      
      if (result) {
        console.log('\nOperação concluída com sucesso!');
      } else {
        console.log('\nOperação falhou.');
      }
      
      rl.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Erro não tratado:', error);
    rl.close();
    process.exit(1);
  }
}

// Executar função principal
main(); 