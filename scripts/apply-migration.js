#!/usr/bin/env node
/**
 * Script para aplicar migrações no banco de dados Supabase
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Carregar variáveis de ambiente
dotenv.config();

// Obter caminho do diretório atual
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Verificar variáveis de ambiente
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Erro: Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Executar SQL diretamente
async function executeSql(sql) {
  // Dividir SQL em comandos individuais separados por ponto e vírgula
  const commands = sql
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0);
  
  for (const cmd of commands) {
    try {
      // Usar RPC para executar SQL
      const { error } = await supabase.rpc('exec_sql', { sql: cmd });
      
      if (error) {
        console.warn(`Aviso ao executar SQL: ${error.message}`);
        console.log(`SQL com problema: ${cmd}`);
      }
    } catch (error) {
      console.error(`Erro ao executar SQL: ${error.message}`);
      console.log(`SQL com problema: ${cmd}`);
    }
  }
}

// Função principal
async function applyMigration() {
  console.log('Aplicando migrações...');
  
  try {
    // SQL para adicionar os novos campos na tabela email_sequences
    const emailSequencesSQL = `
      -- Adicionar campo send_type a email_sequences
      ALTER TABLE public.email_sequences 
      ADD COLUMN IF NOT EXISTS send_type VARCHAR NOT NULL DEFAULT 'DAYS_AFTER_SIGNUP';
      
      -- Adicionar campo send_hour a email_sequences
      ALTER TABLE public.email_sequences 
      ADD COLUMN IF NOT EXISTS send_hour INTEGER DEFAULT 8;
      
      -- Adicionar comentários
      COMMENT ON COLUMN public.email_sequences.send_type IS 'Tipo de envio: DAYS_AFTER_SIGNUP ou AFTER_FIRST_LOGIN';
      COMMENT ON COLUMN public.email_sequences.send_hour IS 'Hora do dia para enviar o email (0-23)';
    `;
    
    // SQL para adicionar o campo first_login_at na tabela users
    const usersSQL = `
      -- Adicionar campo first_login_at à tabela users
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMP WITH TIME ZONE;
      
      -- Adicionar comentário
      COMMENT ON COLUMN public.users.first_login_at IS 'Data e hora do primeiro login após confirmação de email';
    `;
    
    // SQL para atualizar a função get_pending_emails para considerar os novos campos
    const functionSQL = `
      -- Atualizar função para obter emails pendentes
      CREATE OR REPLACE FUNCTION public.get_pending_emails(p_current_hour INTEGER DEFAULT NULL)
      RETURNS TABLE (
        user_id UUID,
        email VARCHAR,
        full_name VARCHAR,
        first_login_at TIMESTAMPTZ,
        sequence_id UUID,
        template_id UUID,
        subject VARCHAR,
        body TEXT,
        send_type VARCHAR
      ) LANGUAGE sql SECURITY DEFINER
      AS $$
        WITH active_sequences AS (
          SELECT 
            seq.id as sequence_id,
            seq.template_id,
            seq.days_after_signup,
            seq.send_hour,
            seq.send_type,
            temp.subject,
            temp.body
          FROM 
            public.email_sequences seq
            JOIN public.email_templates temp ON seq.template_id = temp.id
          WHERE 
            seq.active = true 
            AND temp.active = true
            AND (
              (seq.send_type = 'DAYS_AFTER_SIGNUP' AND (p_current_hour IS NULL OR seq.send_hour = p_current_hour))
              OR
              seq.send_type = 'AFTER_FIRST_LOGIN'
            )
        )
        SELECT 
          u.id as user_id,
          u.email,
          u.full_name,
          u.first_login_at,
          s.sequence_id,
          s.template_id,
          s.subject,
          s.body,
          s.send_type
        FROM 
          public.users u
          CROSS JOIN active_sequences s
        WHERE 
          u.status IN ('ATIVO', 'TRIAL', 'ADMIN')
          AND u.email_confirmed_at IS NOT NULL
          AND (
            (s.send_type = 'DAYS_AFTER_SIGNUP' AND EXTRACT(DAY FROM NOW() - u.created_at) >= s.days_after_signup)
            OR
            (s.send_type = 'AFTER_FIRST_LOGIN' AND u.first_login_at IS NOT NULL AND (NOW() - u.first_login_at) < INTERVAL '1 day')
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.email_logs l
            WHERE l.user_id = u.id
            AND l.sequence_id = s.sequence_id
          )
        LIMIT 100;
      $$;
      
      -- Atualizar permissões
      REVOKE ALL ON FUNCTION public.get_pending_emails(INTEGER) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.get_pending_emails(INTEGER) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.get_pending_emails(INTEGER) TO service_role;
    `;
    
    // Executar as migrações
    console.log('Adicionando campos à tabela email_sequences...');
    await executeSql(emailSequencesSQL);
    
    console.log('Adicionando campo first_login_at à tabela users...');
    await executeSql(usersSQL);
    
    console.log('Atualizando função get_pending_emails...');
    await executeSql(functionSQL);
    
    console.log('Migrações aplicadas com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar migrações:', error);
  }
}

// Executar função principal
applyMigration()
  .catch(error => {
    console.error('Erro não tratado:', error);
  })
  .finally(() => {
    process.exit(0);
  });
