import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

// Configurar transporte de email
const createTransporter = () => {
  console.log('[SMTP-SERVICE] Criando transporter SMTP...');
  
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.error('[SMTP-SERVICE] Configuração SMTP incompleta no arquivo .env');
    throw new Error('Configuração SMTP incompleta');
  }
  
  // Configuração SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Criar transporter uma única vez para reuso
let transporter;
try {
  transporter = createTransporter();
  console.log('[SMTP-SERVICE] Transporter SMTP criado com sucesso');
} catch (error) {
  console.error('[SMTP-SERVICE] Erro ao criar transporter SMTP:', error);
}

/**
 * Função para processar template de email com variáveis
 * 
 * @param {string} template - Template HTML com placeholders {{variavel}}
 * @param {object} data - Objeto com variáveis para substituir no template
 * @returns {string} - HTML processado
 */
export const processTemplate = (template, data) => {
  let processed = template;
  
  // Substituir todas as variáveis no formato {{variavel}}
  for (const key in data) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, data[key]);
  }
  
  return processed;
};

/**
 * Função para registrar log de email enviado
 * 
 * @param {object} logData - Dados do log
 * @returns {Promise<object>} - Resultado da inserção
 */
export const logEmailSent = async (logData) => {
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .insert([logData]);
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('[SMTP-SERVICE] Erro ao registrar log de email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Função para enviar email via SMTP
 * 
 * @param {string} to - Email do destinatário
 * @param {string} subject - Assunto do email
 * @param {string} html - Conteúdo HTML do email
 * @param {object} options - Opções adicionais (cc, bcc, etc)
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendEmail = async (to, subject, html, options = {}) => {
  if (!transporter) {
    try {
      transporter = createTransporter();
      console.log('[SMTP-SERVICE] Transporter SMTP recriado com sucesso');
    } catch (error) {
      console.error('[SMTP-SERVICE] Erro ao recriar transporter SMTP:', error);
      return { success: false, error: 'Não foi possível criar o transporter SMTP' };
    }
  }

  try {
    console.log(`[SMTP-SERVICE] Iniciando envio de email para ${to}`);
    console.log(`[SMTP-SERVICE] Assunto: ${subject}`);
    
    // Verificar configuração do transporte
    if (!transporter) {
      console.error('[SMTP-SERVICE] Transporter não configurado');
      return { success: false, error: 'Transporter não configurado' };
    }
    
    const from = process.env.SMTP_FROM || `SongMetrix <${process.env.SMTP_USER}>`;
    console.log(`[SMTP-SERVICE] Remetente: ${from}`);
    
    const mailOptions = {
      from,
      to,
      subject,
      html,
      ...options
    };

    // Verificar estado do transporter
    if (typeof transporter.verify === 'function') {
      try {
        const verifyResult = await transporter.verify();
        console.log(`[SMTP-SERVICE] Verificação do transporter: ${verifyResult ? 'OK' : 'Falha'}`);
        if (!verifyResult) {
          // Tentar recriar o transporter
          transporter = createTransporter();
        }
      } catch (verifyError) {
        console.error('[SMTP-SERVICE] Erro na verificação do transporter:', verifyError);
        // Tentar recriar o transporter
        transporter = createTransporter();
      }
    }
    
    console.log('[SMTP-SERVICE] Enviando email...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP-SERVICE] Email enviado com sucesso: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId, info };
  } catch (error) {
    console.error('[SMTP-SERVICE] Erro ao enviar email:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

/**
 * Função para enviar email de boas-vindas
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendWelcomeEmail = async (userId) => {
  try {
    console.log(`[SMTP-SERVICE] Iniciando envio de email de boas-vindas para usuário ID: ${userId}`);
    
    // Obter dados do usuário
    console.log('[SMTP-SERVICE] Buscando dados do usuário...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error(`[SMTP-SERVICE] Erro ao buscar usuário: ${userError.message}`);
      throw userError;
    }
    
    if (!userData) {
      console.error('[SMTP-SERVICE] Usuário não encontrado');
      throw new Error('Usuário não encontrado');
    }
    
    console.log(`[SMTP-SERVICE] Usuário encontrado: ${userData.full_name || userData.email}`);
    
    // Verificar se já enviou email anteriormente
    console.log('[SMTP-SERVICE] Verificando histórico de emails...');
    const { data: logData, error: logError } = await supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')
      .limit(1);
      
    if (logError) {
      console.error(`[SMTP-SERVICE] Erro ao verificar logs: ${logError.message}`);
      // Não interrompe o processo, apenas loga o erro
    } else if (logData && logData.length > 0) {
      console.log('[SMTP-SERVICE] Email já enviado anteriormente para este usuário');
      // Continuar mesmo assim, pois o usuário solicitou explicitamente
    }
    
    // Obter template de boas-vindas
    console.log('[SMTP-SERVICE] Buscando template de boas-vindas...');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'welcome_email')
      .eq('active', true)
      .single();
      
    if (templateError) {
      console.error(`[SMTP-SERVICE] Erro ao buscar template: ${templateError.message}`);
      throw templateError;
    }
    
    if (!template) {
      console.error('[SMTP-SERVICE] Template de boas-vindas não encontrado');
      throw new Error('Template de boas-vindas não encontrado');
    }
    
    console.log(`[SMTP-SERVICE] Template encontrado: "${template.name}"`);
    
    // Processar template
    console.log('[SMTP-SERVICE] Processando template...');
    const name = userData.full_name || userData.email.split('@')[0];
    const htmlContent = processTemplate(template.body, { 
      name,
      email: userData.email,
      date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Enviar email
    console.log(`[SMTP-SERVICE] Enviando email para ${userData.email}...`);
    const result = await sendEmail(
      userData.email,
      template.subject,
      htmlContent
    );
    
    // Registrar log
    console.log(`[SMTP-SERVICE] Resultado do envio: ${result.success ? 'Sucesso' : 'Falha'}`);
    if (result.success) {
      console.log('[SMTP-SERVICE] Registrando log de sucesso...');
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        status: 'SUCCESS',
        email_to: userData.email,
        subject: template.subject
      });
    } else {
      console.log('[SMTP-SERVICE] Registrando log de falha...');
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        status: 'FAILED',
        error_message: result.error,
        email_to: userData.email,
        subject: template.subject
      });
    }
    
    return result;
  } catch (error) {
    console.error('[SMTP-SERVICE] Erro ao enviar email de boas-vindas:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

/**
 * Função para processar emails pendentes nas sequências
 */
export const processScheduledEmails = async () => {
  try {
    // Consultar usuários com emails pendentes
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails');
    
    if (error) {
      console.error('[SMTP-SERVICE] Erro ao buscar emails pendentes:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`[SMTP-SERVICE] Processando ${pendingEmails?.length || 0} emails pendentes`);
    
    if (!pendingEmails || pendingEmails.length === 0) {
      return { success: true, count: 0 };
    }
    
    // Processar cada email pendente
    let successCount = 0;
    let failCount = 0;
    
    for (const pending of pendingEmails) {
      try {
        // Processar template
        const name = pending.full_name || pending.email.split('@')[0];
        const htmlContent = processTemplate(pending.body, { 
          name,
          email: pending.email,
          date: new Date().toLocaleDateString('pt-BR')
        });
        
        // Enviar email
        const result = await sendEmail(
          pending.email,
          pending.subject,
          htmlContent
        );
        
        // Registrar log
        if (result.success) {
          successCount++;
          await logEmailSent({
            user_id: pending.user_id,
            template_id: pending.template_id,
            sequence_id: pending.sequence_id,
            status: 'SUCCESS',
            email_to: pending.email,
            subject: pending.subject
          });
        } else {
          failCount++;
          await logEmailSent({
            user_id: pending.user_id,
            template_id: pending.template_id,
            sequence_id: pending.sequence_id,
            status: 'FAILED',
            error_message: result.error,
            email_to: pending.email,
            subject: pending.subject
          });
        }
        
        console.log(`[SMTP-SERVICE] Email processado para ${pending.email}: ${result.success ? 'Sucesso' : 'Falha'}`);
      } catch (emailError) {
        failCount++;
        console.error(`[SMTP-SERVICE] Erro ao processar email para ${pending.email}:`, emailError);
        
        // Registrar falha no log
        await logEmailSent({
          user_id: pending.user_id,
          template_id: pending.template_id,
          sequence_id: pending.sequence_id,
          status: 'FAILED',
          error_message: emailError.message,
          email_to: pending.email,
          subject: pending.subject
        });
      }
    }
    
    return { 
      success: true, 
      count: pendingEmails.length,
      successCount,
      failCount
    };
  } catch (error) {
    console.error('[SMTP-SERVICE] Erro ao processar emails agendados:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendEmail,
  processTemplate,
  logEmailSent,
  sendWelcomeEmail,
  processScheduledEmails
}; 