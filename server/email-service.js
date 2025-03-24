import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;

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

// Configurar pool de conexão com Postgres
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT
});

// Configurar transporte de email
const configureTransport = () => {
  // Verificar configurações de SMTP no arquivo .env
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  // Caso não tenha SMTP configurado, usar Ethereal para testes
  // em ambiente de desenvolvimento
  console.warn('SMTP não configurado. Usando Ethereal para testes em DEV.');
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'ethereal.user@ethereal.email',
      pass: 'ethereal_pass'
    }
  });
};

const transporter = configureTransport();

/**
 * Função para enviar email
 * 
 * @param {string} to - Email do destinatário
 * @param {string} subject - Assunto do email
 * @param {string} html - Conteúdo HTML do email
 * @param {object} options - Opções adicionais (cc, bcc, etc)
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendEmail = async (to, subject, html, options = {}) => {
  try {
    console.log(`[EMAIL-SERVICE] Iniciando envio de email para ${to}`);
    console.log(`[EMAIL-SERVICE] Assunto: ${subject}`);
    
    // Verificar configuração do transporte
    if (!transporter) {
      console.error('[EMAIL-SERVICE] Transporter não configurado');
      return { success: false, error: 'Transporter não configurado' };
    }
    
    const from = process.env.SMTP_FROM || 'noreply@songmetrix.com.br';
    console.log(`[EMAIL-SERVICE] Remetente: ${from}`);
    
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
        console.log(`[EMAIL-SERVICE] Verificação do transporter: ${verifyResult ? 'OK' : 'Falha'}`);
      } catch (verifyError) {
        console.error('[EMAIL-SERVICE] Erro na verificação do transporter:', verifyError);
      }
    }
    
    console.log('[EMAIL-SERVICE] Enviando email...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL-SERVICE] Email enviado com sucesso: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId, info };
  } catch (error) {
    console.error('[EMAIL-SERVICE] Erro ao enviar email:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

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
    console.error('Erro ao registrar log de email:', error);
    return { success: false, error: error.message };
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
    console.log(`[EMAIL-SERVICE] Iniciando envio de email de boas-vindas para usuário ID: ${userId}`);
    
    // Obter dados do usuário
    console.log('[EMAIL-SERVICE] Buscando dados do usuário...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error(`[EMAIL-SERVICE] Erro ao buscar usuário: ${userError.message}`);
      throw userError;
    }
    
    if (!userData) {
      console.error('[EMAIL-SERVICE] Usuário não encontrado');
      throw new Error('Usuário não encontrado');
    }
    
    console.log(`[EMAIL-SERVICE] Usuário encontrado: ${userData.full_name || userData.email}`);
    
    // Verificar se já enviou email anteriormente
    console.log('[EMAIL-SERVICE] Verificando histórico de emails...');
    const { data: logData, error: logError } = await supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')
      .limit(1);
      
    if (logError) {
      console.error(`[EMAIL-SERVICE] Erro ao verificar logs: ${logError.message}`);
      // Não interrompe o processo, apenas loga o erro
    } else if (logData && logData.length > 0) {
      console.log('[EMAIL-SERVICE] Email já enviado anteriormente para este usuário');
      // Continuar mesmo assim, pois o usuário solicitou explicitamente
    }
    
    // Obter template de boas-vindas
    console.log('[EMAIL-SERVICE] Buscando template de boas-vindas...');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'welcome_email')
      .eq('active', true)
      .single();
      
    if (templateError) {
      console.error(`[EMAIL-SERVICE] Erro ao buscar template: ${templateError.message}`);
      throw templateError;
    }
    
    if (!template) {
      console.error('[EMAIL-SERVICE] Template de boas-vindas não encontrado');
      throw new Error('Template de boas-vindas não encontrado');
    }
    
    console.log(`[EMAIL-SERVICE] Template encontrado: "${template.name}"`);
    
    // Processar template
    console.log('[EMAIL-SERVICE] Processando template...');
    const name = userData.full_name || userData.email.split('@')[0];
    const htmlContent = processTemplate(template.body, { 
      name,
      email: userData.email,
      date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Enviar email
    console.log(`[EMAIL-SERVICE] Enviando email para ${userData.email}...`);
    const result = await sendEmail(
      userData.email,
      template.subject,
      htmlContent
    );
    
    // Registrar log
    console.log(`[EMAIL-SERVICE] Resultado do envio: ${result.success ? 'Sucesso' : 'Falha'}`);
    if (result.success) {
      console.log('[EMAIL-SERVICE] Registrando log de sucesso...');
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        status: 'SUCCESS',
        email_to: userData.email,
        subject: template.subject
      });
    } else {
      console.log('[EMAIL-SERVICE] Registrando log de falha...');
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
    console.error('[EMAIL-SERVICE] Erro ao enviar email de boas-vindas:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

/**
 * Função para processar emails pendentes nas sequências
 */
export const processScheduledEmails = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Consultar usuários com emails pendentes
    const { rows: pendingEmails } = await client.query(`
      WITH active_sequences AS (
        SELECT 
          seq.id as sequence_id,
          seq.template_id,
          seq.days_after_signup,
          temp.subject,
          temp.body
        FROM 
          public.email_sequences seq
          JOIN public.email_templates temp ON seq.template_id = temp.id
        WHERE 
          seq.active = true 
          AND temp.active = true
      )
      SELECT 
        u.id as user_id,
        u.email,
        u.full_name,
        u.created_at,
        s.sequence_id,
        s.template_id,
        s.subject,
        s.body
      FROM 
        public.users u
        CROSS JOIN active_sequences s
      WHERE 
        u.status IN ('ATIVO', 'TRIAL', 'ADMIN')
        AND u.email_confirmed_at IS NOT NULL
        AND EXTRACT(DAY FROM NOW() - u.created_at) >= s.days_after_signup
        AND NOT EXISTS (
          SELECT 1 FROM public.email_logs l
          WHERE l.user_id = u.id
          AND l.sequence_id = s.sequence_id
        )
      LIMIT 100
    `);
    
    console.log(`Processando ${pendingEmails.length} emails pendentes`);
    
    // Processar cada email pendente
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
          await client.query(`
            INSERT INTO public.email_logs 
              (user_id, template_id, sequence_id, status, email_to, subject)
            VALUES 
              ($1, $2, $3, $4, $5, $6)
          `, [
            pending.user_id,
            pending.template_id,
            pending.sequence_id,
            'SUCCESS',
            pending.email,
            pending.subject
          ]);
        } else {
          await client.query(`
            INSERT INTO public.email_logs 
              (user_id, template_id, sequence_id, status, error_message, email_to, subject)
            VALUES 
              ($1, $2, $3, $4, $5, $6, $7)
          `, [
            pending.user_id,
            pending.template_id,
            pending.sequence_id,
            'FAILED',
            result.error,
            pending.email,
            pending.subject
          ]);
        }
        
        console.log(`Email processado para ${pending.email}: ${result.success ? 'Sucesso' : 'Falha'}`);
      } catch (emailError) {
        console.error(`Erro ao processar email para ${pending.email}:`, emailError);
        
        // Registrar falha no log
        await client.query(`
          INSERT INTO public.email_logs 
            (user_id, template_id, sequence_id, status, error_message, email_to, subject)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7)
        `, [
          pending.user_id,
          pending.template_id,
          pending.sequence_id,
          'FAILED',
          emailError.message,
          pending.email,
          pending.subject
        ]);
      }
    }
    
    await client.query('COMMIT');
    return { success: true, count: pendingEmails.length };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao processar emails agendados:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
};

export default {
  sendEmail,
  processTemplate,
  logEmailSent,
  sendWelcomeEmail,
  processScheduledEmails
}; 