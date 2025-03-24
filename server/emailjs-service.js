import emailjs from '@emailjs/browser';
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

// Inicializar EmailJS
const initEmailJS = () => {
  if (!process.env.EMAILJS_PUBLIC_KEY) {
    console.error('ERRO: Chave pública do EmailJS não configurada no .env');
    throw new Error('Chave pública do EmailJS não configurada');
  }
  
  emailjs.init(process.env.EMAILJS_PUBLIC_KEY);
  console.log('[EMAILJS-SERVICE] Inicializado com sucesso');
};

// Inicializar EmailJS
try {
  initEmailJS();
} catch (error) {
  console.error('[EMAILJS-SERVICE] Erro na inicialização:', error);
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
    console.error('[EMAILJS-SERVICE] Erro ao registrar log de email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Função para enviar email via EmailJS
 * 
 * @param {string} to - Email do destinatário
 * @param {string} subject - Assunto do email
 * @param {string} html - Conteúdo HTML do email
 * @param {object} options - Opções adicionais (cc, bcc, etc)
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendEmail = async (to, subject, html, options = {}) => {
  try {
    console.log(`[EMAILJS-SERVICE] Iniciando envio de email para ${to}`);
    console.log(`[EMAILJS-SERVICE] Assunto: ${subject}`);
    
    if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID) {
      console.error('[EMAILJS-SERVICE] IDs do serviço ou template não configurados');
      return { success: false, error: 'Configuração incompleta do EmailJS' };
    }
    
    // Montar parâmetros do template
    const templateParams = {
      to_email: to,
      to_name: options.name || to.split('@')[0],
      subject: subject,
      message_html: html, // O conteúdo HTML processado do nosso template
      // Incluir todos os parâmetros adicionais
      ...options
    };
    
    console.log('[EMAILJS-SERVICE] Enviando email...');
    
    // Enviar email via EmailJS
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      templateParams
    );
    
    console.log(`[EMAILJS-SERVICE] Email enviado com sucesso: ${response.status}`);
    
    return { 
      success: true, 
      messageId: `${response.status}-${new Date().getTime()}`,
      info: response 
    };
  } catch (error) {
    console.error('[EMAILJS-SERVICE] Erro ao enviar email:', error);
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
    console.log(`[EMAILJS-SERVICE] Iniciando envio de email de boas-vindas para usuário ID: ${userId}`);
    
    // Obter dados do usuário
    console.log('[EMAILJS-SERVICE] Buscando dados do usuário...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error(`[EMAILJS-SERVICE] Erro ao buscar usuário: ${userError.message}`);
      throw userError;
    }
    
    if (!userData) {
      console.error('[EMAILJS-SERVICE] Usuário não encontrado');
      throw new Error('Usuário não encontrado');
    }
    
    console.log(`[EMAILJS-SERVICE] Usuário encontrado: ${userData.full_name || userData.email}`);
    
    // Verificar se já enviou email anteriormente
    console.log('[EMAILJS-SERVICE] Verificando histórico de emails...');
    const { data: logData, error: logError } = await supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')
      .limit(1);
      
    if (logError) {
      console.error(`[EMAILJS-SERVICE] Erro ao verificar logs: ${logError.message}`);
      // Não interrompe o processo, apenas loga o erro
    } else if (logData && logData.length > 0) {
      console.log('[EMAILJS-SERVICE] Email já enviado anteriormente para este usuário');
      // Continuar mesmo assim, pois o usuário solicitou explicitamente
    }
    
    // Obter template de boas-vindas
    console.log('[EMAILJS-SERVICE] Buscando template de boas-vindas...');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'welcome_email')
      .eq('active', true)
      .single();
      
    if (templateError) {
      console.error(`[EMAILJS-SERVICE] Erro ao buscar template: ${templateError.message}`);
      throw templateError;
    }
    
    if (!template) {
      console.error('[EMAILJS-SERVICE] Template de boas-vindas não encontrado');
      throw new Error('Template de boas-vindas não encontrado');
    }
    
    console.log(`[EMAILJS-SERVICE] Template encontrado: "${template.name}"`);
    
    // Processar template
    console.log('[EMAILJS-SERVICE] Processando template...');
    const name = userData.full_name || userData.email.split('@')[0];
    const htmlContent = processTemplate(template.body, { 
      name,
      email: userData.email,
      date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Enviar email
    console.log(`[EMAILJS-SERVICE] Enviando email para ${userData.email}...`);
    const result = await sendEmail(
      userData.email,
      template.subject,
      htmlContent,
      { name }
    );
    
    // Registrar log
    console.log(`[EMAILJS-SERVICE] Resultado do envio: ${result.success ? 'Sucesso' : 'Falha'}`);
    if (result.success) {
      console.log('[EMAILJS-SERVICE] Registrando log de sucesso...');
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        status: 'SUCCESS',
        email_to: userData.email,
        subject: template.subject
      });
    } else {
      console.log('[EMAILJS-SERVICE] Registrando log de falha...');
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
    console.error('[EMAILJS-SERVICE] Erro ao enviar email de boas-vindas:', error);
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
      console.error('[EMAILJS-SERVICE] Erro ao buscar emails pendentes:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`[EMAILJS-SERVICE] Processando ${pendingEmails?.length || 0} emails pendentes`);
    
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
          htmlContent,
          { name }
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
        
        console.log(`[EMAILJS-SERVICE] Email processado para ${pending.email}: ${result.success ? 'Sucesso' : 'Falha'}`);
      } catch (emailError) {
        failCount++;
        console.error(`[EMAILJS-SERVICE] Erro ao processar email para ${pending.email}:`, emailError);
        
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
    console.error('[EMAILJS-SERVICE] Erro ao processar emails agendados:', error);
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