// scripts/send-scheduled-emails.js - Script para envio de emails agendados
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

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

/**
 * Função principal para processar emails agendados
 */
async function processScheduledEmails() {
  try {
    console.log(`[${new Date().toISOString()}] Iniciando processamento de emails agendados...`);
    
    // Obter um admin para fazer a requisição
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('status', 'ADMIN')
      .limit(1)
      .single();
      
    if (adminError || !adminUser) {
      console.error('Erro ao obter usuário admin:', adminError || 'Nenhum admin encontrado');
      process.exit(1);
    }
    
    // Gerar token de acesso para o admin
    const { data: { session }, error: authError } = await supabase.auth.admin.createSession({
      user_id: adminUser.id,
      expires_in: 60 // 60 segundos, tempo suficiente para fazer a requisição
    });
    
    if (authError || !session) {
      console.error('Erro ao gerar token para admin:', authError || 'Nenhuma sessão criada');
      process.exit(1);
    }
    
    // Fazer requisição para a API
    const response = await fetch(`${API_BASE_URL}/api/email/process-scheduled`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`Processamento concluído: ${result.message}`);
    } else {
      console.error(`Erro ao processar emails: ${result.message}`, result.error);
    }
  } catch (error) {
    console.error('Erro não tratado:', error);
  } finally {
    process.exit(0);
  }
}

// Executar a função principal
processScheduledEmails(); 