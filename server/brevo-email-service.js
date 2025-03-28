import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { logEmail, logError, logInfo, logDebug, logWarn } from './logger.js';

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

// Configuração do transporte de email do Brevo via SMTP
const createTransporter = () => {
  logInfo('[BREVO] Criando transporter SMTP do Brevo...');
  
  // Verificar configurações do ambiente
  if (!process.env.BREVO_SENDER_EMAIL || !process.env.BREVO_SENDER_NAME) {
    logWarn('[BREVO] Configuração de remetente incompleta no .env. Usando valores padrão.');
  }
  
  // Usar variáveis do ambiente ou valores padrão
  const smtpConfig = {
    host: process.env.SMTP_SERVER || "smtp-relay.brevo.com", // SMTP do Brevo
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // Brevo recomenda TLS
    auth: {
      user: process.env.SMTP_USER, // Usando as mesmas credenciais SMTP configuradas
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  };
  
  logDebug('[BREVO] Configuração SMTP:', { 
    host: smtpConfig.host, 
    port: smtpConfig.port, 
    user: smtpConfig.auth.user,
    passwordLength: smtpConfig.auth.pass ? smtpConfig.auth.pass.length : 0
  });
  
  return nodemailer.createTransport(smtpConfig);
};

// Criar transporter uma única vez para reuso
let transporter;
try {
  transporter = createTransporter();
  logInfo('[BREVO] Transporter SMTP criado com sucesso');
} catch (error) {
  logError('[BREVO] Erro ao criar transporter SMTP', error);
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
    logError('[BREVO] Erro ao registrar log de email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Função para enviar email via SMTP do Brevo
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
      logInfo('[BREVO] Transporter SMTP recriado com sucesso');
    } catch (error) {
      logError('[BREVO] Erro ao recriar transporter SMTP', error);
      return { success: false, error: 'Não foi possível criar o transporter SMTP para o Brevo' };
    }
  }

  try {
    logEmail('[BREVO] Iniciando envio de email', { to, subject });
    
    // Verificar configuração do transporte
    if (!transporter) {
      logError('[BREVO] Transporter não configurado');
      return { success: false, error: 'Transporter do Brevo não configurado' };
    }
    
    // Configurar remetente conforme configurações do Brevo
    const from = `${process.env.SMTP_FROM_NAME || process.env.BREVO_SENDER_NAME || 'Songmetrix'} <${process.env.SMTP_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER}>`;
    logDebug('[BREVO] Configuração do remetente', { from });
    
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
        logDebug('[BREVO] Verificação do transporter', { success: verifyResult });
        if (!verifyResult) {
          // Tentar recriar o transporter
          transporter = createTransporter();
        }
      } catch (verifyError) {
        logError('[BREVO] Erro na verificação do transporter', verifyError);
        // Tentar recriar o transporter
        transporter = createTransporter();
      }
    }
    
    logEmail('[BREVO] Enviando email...', { to, subject });
    const info = await transporter.sendMail(mailOptions);
    logEmail('[BREVO] Email enviado com sucesso', { to, subject, messageId: info.messageId });
    
    return { 
      success: true, 
      messageId: info.messageId, 
      info,
      service: 'brevo'
    };
  } catch (error) {
    logError('[BREVO] Erro ao enviar email', error, { to, subject });
    return { 
      success: false, 
      error: error.message, 
      stack: error.stack,
      service: 'brevo'
    };
  }
};

/**
 * Função para enviar email de boas-vindas usando o Brevo
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendWelcomeEmail = async (userId) => {
  try {
    logInfo(`[BREVO] Iniciando envio de email de boas-vindas para usuário ID: ${userId}`);
    
    // Obter dados do usuário
    logInfo('[BREVO] Buscando dados do usuário...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('id', userId)
      .single();
      
    if (userError) {
      logError(`[BREVO] Erro ao buscar usuário: ${userError.message}`);
      throw userError;
    }
    
    if (!userData) {
      logError('[BREVO] Usuário não encontrado');
      throw new Error('Usuário não encontrado');
    }
    
    logInfo(`[BREVO] Usuário encontrado: ${userData.full_name || userData.email}`);
    
    // Buscar informações adicionais do usuário no auth.users
    logInfo('[BREVO] Buscando dados de autenticação do usuário...');
    const { data: authData, error: authError } = await supabase
      .auth.admin.getUserById(userId);
      
    let displayName = userData.full_name;
    let fullName = userData.full_name;
    
    if (!authError && authData?.user) {
      // Extrair display_name e fullName do user_metadata
      displayName = authData.user.user_metadata?.display_name || 
                   authData.user.user_metadata?.full_name || 
                   authData.user.user_metadata?.name || 
                   userData.full_name;

      // Extrair fullName diretamente do raw_user_meta_data
      fullName = authData.user.raw_user_meta_data?.fullName || 
                authData.user.user_metadata?.fullName || 
                authData.user.user_metadata?.full_name || 
                displayName;
                   
      logInfo(`[BREVO] Nome de exibição do usuário: ${displayName}`);
      logInfo(`[BREVO] fullName do usuário: ${fullName}`);
    } else {
      logInfo('[BREVO] Dados de autenticação não encontrados, usando full_name do perfil');
    }
    
    // Obter template de boas-vindas
    logInfo('[BREVO] Buscando template de boas-vindas...');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'welcome_email')
      .eq('active', true)
      .single();
      
    if (templateError) {
      logError(`[BREVO] Erro ao buscar template: ${templateError.message}`);
      throw templateError;
    }
    
    if (!template) {
      logError('[BREVO] Template de boas-vindas não encontrado ou inativo');
      throw new Error('Template de boas-vindas não encontrado ou inativo');
    }
    
    logInfo(`[BREVO] Template encontrado: ${template.name}`);
    
    // Preparar variáveis para o template
    const variables = {
      name: displayName || fullName || 'Usuário',
      email: userData.email,
      radioName: 'Sua Rádio',
      appUrl: process.env.VITE_APP_URL || 'https://app.songmetrix.com.br',
      currentDate: new Date().toLocaleDateString('pt-BR'),
      supportEmail: 'suporte@songmetrix.com.br'
    };
    
    // Processar o template
    logInfo('[BREVO] Processando template...');
    const htmlContent = processTemplate(template.body, variables);
    
    // Enviar o email
    logInfo('[BREVO] Enviando email de boas-vindas...');
    const result = await sendEmail(
      userData.email,
      template.subject,
      htmlContent
    );
    
    // Registrar o envio no log
    if (result.success) {
      logInfo('[BREVO] Email de boas-vindas enviado com sucesso. Registrando log...');
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        sequence_id: null,
        status: 'SUCCESS',
        error_message: null,
        email_to: userData.email,
        subject: template.subject
      });
    } else {
      logError('[BREVO] Falha ao enviar email de boas-vindas', { error: result.error });
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        sequence_id: null,
        status: 'FAILED',
        error_message: result.error,
        email_to: userData.email,
        subject: template.subject
      });
    }
    
    return result;
  } catch (error) {
    logError('[BREVO] Erro ao enviar email de boas-vindas', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

/**
 * Função para enviar email de teste com template específico
 * 
 * @param {object} options - Opções do email
 * @param {string} options.to - Email do destinatário
 * @param {string} options.templateId - ID do template
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendTestEmailWithTemplate = async ({ to, templateId }) => {
  try {
    logInfo(`[BREVO] Iniciando envio de email de teste com template ID ${templateId} para: ${to}`);
    
    // Verificar parâmetros
    if (!to) {
      throw new Error('Email de destino não fornecido');
    }
    
    if (!templateId) {
      throw new Error('ID do template não fornecido');
    }
    
    // Obter template
    logInfo(`[BREVO] Buscando template ID: ${templateId}`);
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();
      
    if (templateError) {
      logError(`[BREVO] Erro ao buscar template: ${templateError.message}`);
      throw templateError;
    }
    
    if (!template) {
      logError('[BREVO] Template não encontrado');
      throw new Error('Template não encontrado');
    }
    
    logInfo(`[BREVO] Template encontrado: ${template.name}`);
    
    // Variáveis para teste
    const variables = {
      name: 'Usuário de Teste',
      email: to,
      radioName: 'Rádio Teste',
      appUrl: process.env.VITE_APP_URL || 'https://app.songmetrix.com.br',
      currentDate: new Date().toLocaleDateString('pt-BR'),
      supportEmail: 'suporte@songmetrix.com.br'
    };
    
    // Processar o template
    logInfo('[BREVO] Processando template para teste...');
    const htmlContent = processTemplate(template.body, variables);
    
    // Enviar email
    logInfo('[BREVO] Enviando email de teste...');
    const result = await sendEmail(
      to,
      template.subject,
      htmlContent
    );
    
    // Registrar o envio no log
    logInfo(`[BREVO] Resultado do envio de teste: ${result.success ? 'Sucesso' : 'Falha'}`);
    
    // Extrair userId do token se disponível
    let userId = null;
    try {
      // Tentar extrair userId do localStorage via cabeçalhos
      userId = 'TESTE';
    } catch (err) {
      logWarn('[BREVO] Não foi possível determinar o userId para o log');
    }
    
    await logEmailSent({
      user_id: userId,
      template_id: template.id,
      status: result.success ? 'SUCCESS' : 'FAILED',
      error_message: result.success ? null : result.error,
      email_to: to,
      subject: template.subject
    });
    
    return result;
  } catch (error) {
    logError('[BREVO] Erro ao enviar email de teste com template:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

/**
 * Função para enviar email de teste simples
 * 
 * @param {object} options - Opções do email
 * @param {string} options.to - Email do destinatário
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendTestEmail = async ({ to }) => {
  try {
    logInfo(`[BREVO] Iniciando envio de email de teste simples para: ${to}`);
    
    // Criar conteúdo HTML simples para o teste
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #4a6ee0;">Teste de Email SongMetrix (Brevo)</h2>
        <p>Olá,</p>
        <p>Este é um email de teste enviado pelo sistema SongMetrix usando o serviço Brevo.</p>
        <p>Se você está recebendo este email, significa que a configuração do sistema de email está funcionando corretamente.</p>
        <p>Data e hora do teste: ${new Date().toLocaleString('pt-BR')}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #666;">Este é um email automático de teste. Por favor, não responda.</p>
      </div>
    `;
    
    // Enviar email
    const result = await sendEmail(
      to,
      'Email de teste do SongMetrix via Brevo',
      htmlContent
    );
    
    // Registrar log
    logInfo(`[BREVO] Resultado do envio de teste simples: ${result.success ? 'Sucesso' : 'Falha'}`);
    await logEmailSent({
      status: result.success ? 'SUCCESS' : 'FAILED',
      error_message: result.success ? null : result.error,
      email_to: to,
      subject: 'Email de teste do SongMetrix via Brevo'
    });
    
    return result;
  } catch (error) {
    logError('[BREVO] Erro ao enviar email de teste simples:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};

// Exportar objeto com todas as funções do serviço
const emailService = {
  sendEmail,
  processTemplate,
  logEmailSent,
  sendWelcomeEmail,
  sendTestEmailWithTemplate,
  sendTestEmail
};

export default emailService;
