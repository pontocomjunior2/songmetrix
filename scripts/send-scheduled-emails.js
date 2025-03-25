#!/usr/bin/env node
/**
 * Script para processar emails programados para o horário atual
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { processScheduledEmails } from '../server/smtp-email-service.js';

// Carregar variáveis de ambiente
dotenv.config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Função principal
async function main() {
  try {
    console.log('[SCHEDULED-EMAILS] Iniciando processamento de emails agendados...');
    
    // Processar emails pendentes
    const result = await processScheduledEmails();
    
    console.log('[SCHEDULED-EMAILS] Resultado do processamento:', {
      total: result.count,
      sucessos: result.successCount,
      falhas: result.failCount
    });
    
    process.exit(0);
  } catch (error) {
    console.error('[SCHEDULED-EMAILS] Erro ao processar emails agendados:', error);
    process.exit(1);
  }
}

// Executar script
main(); 