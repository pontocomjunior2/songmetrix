#!/usr/bin/env node
/**
 * Script para processar emails programados para o horário atual
 */
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

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
 * Processa diretamente os emails agendados sem chamar a API
 */
async function processEmails() {
  try {
    const currentHour = new Date().getHours();
    console.log(`[${new Date().toISOString()}] Processando emails para hora atual: ${currentHour}h`);
    
    // Buscar emails pendentes para a hora atual
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails', { 
      p_current_hour: currentHour 
    });
    
    if (error) {
      console.error('Erro ao buscar emails pendentes:', error);
      return;
    }
    
    console.log(`Encontrados ${pendingEmails?.length || 0} emails para processamento`);
    
    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('Nenhum email para processar neste momento.');
      return;
    }
    
    // Processar cada email
    let successCount = 0;
    let failCount = 0;
    
    for (const email of pendingEmails) {
      try {
        // Processar o template (substituir variáveis)
        const name = email.full_name || email.email.split('@')[0];
        const templateData = {
          name,
          email: email.email,
          date: new Date().toLocaleDateString('pt-BR')
        };
        
        let htmlContent = email.body;
        
        // Substituir variáveis no template
        Object.entries(templateData).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          htmlContent = htmlContent.replace(regex, value);
        });
        
        // Configurar os dados do email
        const emailData = {
          to: email.email,
          subject: email.subject,
          html: htmlContent
        };
        
        // Enviar email via SMTP
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email', {
          body: emailData
        });
        
        // Registrar resultado no log
        if (sendError) {
          failCount++;
          console.error(`Erro ao enviar email para ${email.email}:`, sendError);
          
          await supabase.from('email_logs').insert({
            user_id: email.user_id,
            template_id: email.template_id,
            sequence_id: email.sequence_id,
            status: 'FAILED',
            error_message: sendError.message,
            email_to: email.email,
            subject: email.subject
          });
        } else {
          successCount++;
          console.log(`Email enviado com sucesso para ${email.email}`);
          
          await supabase.from('email_logs').insert({
            user_id: email.user_id,
            template_id: email.template_id,
            sequence_id: email.sequence_id,
            status: 'SUCCESS',
            email_to: email.email,
            subject: email.subject
          });
        }
      } catch (error) {
        failCount++;
        console.error(`Erro ao processar email para ${email.email}:`, error);
        
        await supabase.from('email_logs').insert({
          user_id: email.user_id,
          template_id: email.template_id,
          sequence_id: email.sequence_id,
          status: 'FAILED',
          error_message: error.message,
          email_to: email.email,
          subject: email.subject
        });
      }
    }
    
    console.log(`Processamento concluído. ${successCount} enviados com sucesso, ${failCount} falhas.`);
  } catch (error) {
    console.error('Erro não tratado:', error);
  } finally {
    process.exit(0);
  }
}

// Execute a função
processEmails(); 