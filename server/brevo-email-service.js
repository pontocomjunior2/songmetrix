import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import SibApiV3Sdk from 'sib-api-v3-sdk';
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

// Configurar cliente Brevo (Sendinblue)
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

if (!process.env.BREVO_API_KEY) {
  throw new Error('API Key do Brevo não configurada no arquivo .env');
}

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const senderName = process.env.BREVO_SENDER_NAME || 'Songmetrix';
const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@songmetrix.com.br';

/**
 * Função para processar template com variáveis
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
    logError('Erro ao registrar log de email', error);
    return { success: false, error: error.message };
  }
};

/**
 * Função para enviar email via Brevo
 * 
 * @param {string} to - Email do destinatário
 * @param {string} subject - Assunto do email
 * @param {string} html - Conteúdo HTML do email
 * @param {object} options - Opções adicionais (cc, bcc, etc)
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendEmail = async (to, subject, html, options = {}) => {
  try {
    logEmail('Iniciando envio de email via Brevo', { to, subject });
    
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    // Configurar email
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = { name: senderName, email: senderEmail };
    sendSmtpEmail.to = [{ email: to }];
    
    // Adicionar CC se fornecido
    if (options.cc) {
      sendSmtpEmail.cc = Array.isArray(options.cc) 
        ? options.cc.map(email => ({ email })) 
        : [{ email: options.cc }];
    }
    
    // Adicionar BCC se fornecido
    if (options.bcc) {
      sendSmtpEmail.bcc = Array.isArray(options.bcc)
        ? options.bcc.map(email => ({ email }))
        : [{ email: options.bcc }];
    }
    
    // Enviar email
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    logEmail('Email enviado com sucesso via Brevo', { to, subject, messageId: result.messageId });
    
    return { 
      success: true, 
      messageId: result.messageId,
      info: result
    };
  } catch (error) {
    logError('Erro ao enviar email via Brevo', error, { to, subject });
    return { 
      success: false, 
      error: error.message,
      stack: error.stack
    };
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
    logInfo('Enviando email de boas-vindas', { userId });
    
    // Obter dados do usuário
    logDebug('Buscando dados do usuário', { userId });
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('id', userId)
      .single();
      
    if (userError) {
      logError('Erro ao buscar usuário', userError, { userId });
      throw userError;
    }
    
    if (!userData) {
      logError('Usuário não encontrado', null, { userId });
      throw new Error('Usuário não encontrado');
    }
    
    logDebug('Usuário encontrado', { email: userData.email, fullName: userData.full_name });
    
    // Buscar informações adicionais do usuário no auth.users
    logDebug('Buscando dados de autenticação do usuário', { userId });
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
                   
      logDebug('Dados de usuário obtidos da autenticação', { displayName, fullName });
    } else {
      logWarn('Dados de autenticação não encontrados, usando full_name do perfil', { userId });
    }
    
    // Obter template de boas-vindas
    logDebug('Buscando template de boas-vindas');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'welcome_email')
      .eq('active', true)
      .single();
      
    if (templateError) {
      logError('Erro ao buscar template de boas-vindas', templateError);
      throw templateError;
    }
    
    if (!template) {
      logError('Template de boas-vindas não encontrado');
      throw new Error('Template de boas-vindas não encontrado');
    }
    
    logDebug('Template encontrado', { templateName: template.name, templateId: template.id });
    
    // Processar template
    logDebug('Processando template');
    // Incluir tanto name quanto fullName nas variáveis do template
    const htmlContent = processTemplate(template.body, { 
      name: displayName || userData.full_name || userData.email.split('@')[0],
      fullName: fullName || displayName || userData.full_name || userData.email.split('@')[0],
      email: userData.email,
      date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Enviar email
    logEmail('Enviando email de boas-vindas', { to: userData.email, subject: template.subject });
    const result = await sendEmail(
      userData.email,
      template.subject,
      htmlContent
    );
    
    // Registrar log
    if (result.success) {
      logEmail('Email de boas-vindas enviado com sucesso', { to: userData.email });
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        status: 'SUCCESS',
        email_to: userData.email,
        subject: template.subject
      });
    } else {
      logError('Falha ao enviar email de boas-vindas', null, { to: userData.email, error: result.error });
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
    logError('Erro ao enviar email de boas-vindas', error, { userId });
    return { success: false, error: error.message };
  }
};

/**
 * Função para processar emails pendentes nas sequências
 */
export const processScheduledEmails = async () => {
  try {
    // Obter hora atual no fuso horário local
    const currentHour = new Date().getHours();
    logEmail('Processando emails agendados via Brevo', { currentHour });
    
    // Consultar usuários com emails pendentes para a hora atual
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails', {
      p_current_hour: currentHour
    });
    
    if (error) {
      logError('Erro ao buscar emails pendentes', error);
      return { success: false, error: error.message };
    }
    
    logEmail('Emails pendentes encontrados', { count: pendingEmails?.length || 0 });
    
    if (!pendingEmails || pendingEmails.length === 0) {
      return { success: true, count: 0 };
    }
    
    // Processar cada email pendente
    let successCount = 0;
    let failCount = 0;
    
    for (const pending of pendingEmails) {
      try {
        // Buscar informações adicionais do usuário no auth.users para obter display_name
        let displayName = pending.full_name;
        let fullName = pending.full_name;
        
        if (pending.user_id) {
          logDebug('Buscando dados de autenticação para usuário', { userId: pending.user_id });
          const { data: authData, error: authError } = await supabase
            .auth.admin.getUserById(pending.user_id);
            
          if (!authError && authData?.user) {
            // Extrair display_name do user_metadata
            displayName = authData.user.user_metadata?.display_name || 
                        authData.user.user_metadata?.full_name || 
                        authData.user.user_metadata?.name || 
                        pending.full_name;
                        
            // Extrair fullName diretamente do raw_user_meta_data
            fullName = authData.user.raw_user_meta_data?.fullName || 
                     authData.user.user_metadata?.fullName || 
                     authData.user.user_metadata?.full_name || 
                     displayName;
                        
            logDebug('Dados de usuário obtidos da autenticação', { 
              userId: pending.user_id,
              displayName,
              fullName
            });
          } else {
            logWarn('Dados de autenticação não encontrados, usando full_name do perfil', { userId: pending.user_id });
          }
        }
        
        // Processar template
        const htmlContent = processTemplate(pending.body, { 
          name: displayName || pending.full_name || pending.email.split('@')[0],
          fullName: fullName || displayName || pending.full_name || pending.email.split('@')[0],
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
          logEmail('Email processado com sucesso', { 
            to: pending.email,
            sequenceId: pending.sequence_id,
            templateId: pending.template_id
          });
          
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
          logError('Falha ao processar email', result.error, {
            to: pending.email,
            sequenceId: pending.sequence_id,
            templateId: pending.template_id
          });
          
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
      } catch (emailError) {
        failCount++;
        logError('Erro ao processar email', emailError, {
          to: pending.email,
          sequenceId: pending.sequence_id,
          templateId: pending.template_id
        });
      }
    }
    
    logEmail('Processamento de emails agendados concluído', {
      total: pendingEmails.length,
      successCount,
      failCount
    });
    
    return { 
      success: true, 
      count: pendingEmails.length,
      successCount,
      failCount
    };
  } catch (error) {
    logError('Erro ao processar emails agendados', error);
    return { success: false, error: error.message };
  }
};

/**
 * Função para processar email de primeiro login
 * 
 * @param {string} userId - ID do usuário que fez o primeiro login
 * @returns {Promise<object>} - Resultado do processamento
 */
export const processFirstLoginEmail = async (userId) => {
  try {
    logEmail('Processando email de primeiro login via Brevo', { userId });
    
    // Obter dados do usuário
    logDebug('Buscando dados do usuário', { userId });
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at, first_login_at')
      .eq('id', userId)
      .single();
      
    if (userError) {
      logError('Erro ao buscar usuário', userError, { userId });
      throw userError;
    }
    
    if (!userData) {
      logError('Usuário não encontrado', null, { userId });
      throw new Error('Usuário não encontrado');
    }
    
    logDebug('Usuário encontrado', { email: userData.email, fullName: userData.full_name });
    
    // Buscar informações adicionais do usuário no auth.users
    logDebug('Buscando dados de autenticação do usuário', { userId });
    const { data: authData, error: authError } = await supabase
      .auth.admin.getUserById(userId);
      
    let displayName = userData.full_name;
    let fullName = userData.full_name;
    
    if (!authError && authData?.user) {
      // Extrair display_name do user_metadata
      displayName = authData.user.user_metadata?.display_name || 
                   authData.user.user_metadata?.full_name || 
                   authData.user.user_metadata?.name || 
                   userData.full_name;
                   
      // Extrair fullName diretamente do raw_user_meta_data
      fullName = authData.user.raw_user_meta_data?.fullName || 
               authData.user.user_metadata?.fullName || 
               authData.user.user_metadata?.full_name || 
               displayName;
                   
      logDebug('Dados de usuário obtidos da autenticação', { displayName, fullName });
    } else {
      logWarn('Dados de autenticação não encontrados, usando full_name do perfil', { userId });
    }
    
    // Buscar sequências de email configuradas para primeiro login
    logDebug('Buscando sequências de primeiro login');
    const { data: sequences, error: seqError } = await supabase
      .from('email_sequences')
      .select('id, name, template_id')
      .eq('send_type', 'AFTER_FIRST_LOGIN')
      .eq('active', true);
      
    if (seqError) {
      logError('Erro ao buscar sequências de primeiro login', seqError);
      throw seqError;
    }
    
    if (!sequences || sequences.length === 0) {
      logWarn('Nenhuma sequência de primeiro login ativa encontrada');
      return { success: true, count: 0, message: 'Nenhuma sequência de primeiro login ativa configurada' };
    }
    
    logInfo(`Encontradas ${sequences.length} sequências de primeiro login`, { sequenceCount: sequences.length });
    
    // Processar cada sequência
    let successCount = 0;
    let failCount = 0;
    
    for (const sequence of sequences) {
      try {
        logDebug('Processando sequência de primeiro login', { sequenceName: sequence.name, sequenceId: sequence.id });
        
        // Buscar template associado à sequência
        const { data: template, error: templateError } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', sequence.template_id)
          .single();
          
        if (templateError) {
          logError('Erro ao buscar template para sequência', templateError, { sequenceId: sequence.id });
          throw templateError;
        }
        
        if (!template) {
          logError('Template não encontrado para sequência', null, { sequenceId: sequence.id });
          throw new Error(`Template não encontrado para sequência ${sequence.id}`);
        }
        
        logDebug('Template encontrado', { templateName: template.name, templateId: template.id });
        
        // Verificar se já enviou email para este usuário nesta sequência
        const { data: existingLogs, error: logCheckError } = await supabase
          .from('email_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('sequence_id', sequence.id)
          .eq('status', 'SUCCESS')
          .limit(1);
          
        if (logCheckError) {
          logError('Erro ao verificar logs de envio', logCheckError, { userId, sequenceId: sequence.id });
          // Continuar mesmo com erro, para não bloquear o envio
        } else if (existingLogs && existingLogs.length > 0) {
          logDebug('Email já enviado anteriormente para este usuário nesta sequência', { userId, sequenceId: sequence.id });
          continue; // Pular para a próxima sequência
        }
        
        // Processar template
        const htmlContent = processTemplate(template.body, { 
          name: displayName || userData.full_name || userData.email.split('@')[0],
          fullName: fullName || displayName || userData.full_name || userData.email.split('@')[0],
          email: userData.email,
          date: new Date().toLocaleDateString('pt-BR')
        });
        
        // Enviar email
        logEmail('Enviando email de primeiro login', { to: userData.email, subject: template.subject });
        const result = await sendEmail(
          userData.email,
          template.subject,
          htmlContent
        );
        
        // Registrar log
        if (result.success) {
          successCount++;
          logEmail('Email de primeiro login enviado com sucesso', { to: userData.email, sequenceId: sequence.id });
          await logEmailSent({
            user_id: userId,
            template_id: template.id,
            sequence_id: sequence.id,
            status: 'SUCCESS',
            email_to: userData.email,
            subject: template.subject
          });
        } else {
          failCount++;
          logError('Falha ao enviar email de primeiro login', null, { to: userData.email, error: result.error });
          await logEmailSent({
            user_id: userId,
            template_id: template.id,
            sequence_id: sequence.id,
            status: 'FAILED',
            error_message: result.error,
            email_to: userData.email,
            subject: template.subject
          });
        }
      } catch (sequenceError) {
        failCount++;
        logError('Erro ao processar sequência de primeiro login', sequenceError, { sequenceId: sequence.id });
      }
    }
    
    logEmail('Processamento de emails de primeiro login concluído', {
      userId,
      email: userData.email,
      total: sequences.length,
      successCount,
      failCount
    });
    
    return { 
      success: true, 
      count: sequences.length,
      successCount,
      failCount
    };
  } catch (error) {
    logError('Erro ao processar email de primeiro login', error, { userId });
    return { success: false, error: error.message };
  }
};

/**
 * Função para enviar email de teste usando um template
 * 
 * @param {object} options - Opções do email
 * @param {string} options.to - Email do destinatário
 * @param {string} options.templateId - ID do template a ser utilizado
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendTestEmailWithTemplate = async ({ to, templateId }) => {
  try {
    logInfo('Enviando email de teste com template via Brevo', { to, templateId });
    
    // Obter dados do template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();
      
    if (templateError) {
      logError('Erro ao buscar template', templateError, { templateId });
      throw templateError;
    }
    
    if (!template) {
      logError('Template não encontrado', null, { templateId });
      throw new Error(`Template com ID ${templateId} não encontrado`);
    }
    
    logDebug('Template encontrado', { templateName: template.name });
    
    // Buscar dados do usuário pelo email
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', to)
      .limit(1);
      
    let displayName = 'Usuário de Teste';
    let fullName = 'Usuário de Teste';
    let userId = null;
    
    if (!usersError && users && users.length > 0) {
      userId = users[0].id;
      displayName = users[0].full_name || 'Usuário';
      fullName = users[0].full_name || 'Usuário';
      
      logDebug('Usuário encontrado', { userId });
      
      // Se encontrou o usuário, busca os metadados de autenticação
      if (userId) {
        const { data: authData, error: authError } = await supabase
          .auth.admin.getUserById(userId);
          
        if (!authError && authData?.user) {
          // Extrair display_name e fullName
          displayName = authData.user.user_metadata?.display_name || 
                      authData.user.user_metadata?.full_name || 
                      authData.user.user_metadata?.name || 
                      displayName;
          
          // Extrair fullName diretamente do raw_user_meta_data
          fullName = authData.user.raw_user_meta_data?.fullName || 
                   authData.user.user_metadata?.fullName || 
                   authData.user.user_metadata?.full_name || 
                   displayName;
        }
      }
    } else {
      logDebug('Usuário não encontrado, usando valores padrão para teste');
    }
    
    // Processar template
    logDebug('Processando template de teste');
    const htmlContent = processTemplate(template.body, { 
      name: displayName,
      fullName: fullName,
      email: to,
      date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Enviar email
    logEmail('Enviando email de teste', { to, subject: template.subject });
    const result = await sendEmail(
      to,
      template.subject,
      htmlContent
    );
    
    // Registrar log
    if (result.success) {
      logEmail('Email de teste enviado com sucesso', { to });
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        status: 'SUCCESS',
        email_to: to,
        subject: template.subject
      });
    } else {
      logError('Falha ao enviar email de teste', null, { to, error: result.error });
      await logEmailSent({
        user_id: userId,
        template_id: template.id,
        status: 'FAILED',
        error_message: result.error,
        email_to: to,
        subject: template.subject
      });
    }
    
    return result;
  } catch (error) {
    logError('Erro ao enviar email de teste com template', error, { to, templateId });
    return { success: false, error: error.message };
  }
};

/**
 * Função para criar ou atualizar um contato no Brevo
 * 
 * @param {object} contactData - Dados do contato a ser criado/atualizado
 * @param {string} contactData.email - Email do contato
 * @param {string} [contactData.fullName] - Nome completo do contato
 * @param {string} [contactData.whatsapp] - Número de WhatsApp do contato
 * @param {string} [contactData.status] - Status do usuário (TRIAL, ATIVO, INATIVO, etc)
 * @param {string} [contactData.createdAt] - Data de criação do contato
 * @param {Array<number>} [contactData.listIds] - IDs das listas para adicionar o contato
 * @returns {Promise<object>} - Resultado da criação/atualização
 */
export const createOrUpdateContact = async (contactData) => {
  try {
    logInfo('Criando/atualizando contato no Brevo', { email: contactData.email });
    
    // Instanciar API de contatos
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    
    // Preparar atributos do contato
    const attributes = {};
    
    if (contactData.fullName) {
      // Dividir nome completo em primeiro nome e sobrenome
      const nameParts = contactData.fullName.split(' ');
      attributes.FNAME = nameParts[0] || '';
      attributes.LNAME = nameParts.slice(1).join(' ') || '';
      attributes.NOME = contactData.fullName;
    }
    
    if (contactData.whatsapp) {
      // Remover caracteres não numéricos e adicionar prefixo se necessário
      let whatsapp = contactData.whatsapp.replace(/\D/g, '');
      if (!whatsapp.startsWith('+')) {
        // Se não começar com +, adicionar código do Brasil
        if (!whatsapp.startsWith('55')) {
          whatsapp = '55' + whatsapp;
        }
      }
      attributes.SMS = whatsapp;
      attributes.WHATSAPP = whatsapp;
    }
    
    if (contactData.status) {
      attributes.STATUS = contactData.status;
    }
    
    if (contactData.createdAt) {
      attributes.DATA_CADASTRO = new Date(contactData.createdAt).toISOString().split('T')[0];
    }
    
    // Definir parâmetros para criar/atualizar contato
    const createContactParams = new SibApiV3Sdk.CreateContact();
    createContactParams.email = contactData.email;
    createContactParams.attributes = attributes;
    createContactParams.listIds = contactData.listIds || [];
    createContactParams.updateEnabled = true; // Atualizar se já existir
    
    // Enviar requisição para criar/atualizar contato
    const result = await contactsApi.createContact(createContactParams);
    
    logInfo('Contato criado/atualizado com sucesso no Brevo', { 
      email: contactData.email, 
      id: result.id 
    });
    
    return { 
      success: true, 
      id: result.id,
      email: contactData.email
    };
  } catch (error) {
    logError('Erro ao criar/atualizar contato no Brevo', error, { email: contactData.email });
    return { 
      success: false, 
      error: error.message,
      email: contactData.email
    };
  }
};

/**
 * Função para adicionar um contato existente a uma lista
 * 
 * @param {string} email - Email do contato
 * @param {number} listId - ID da lista
 * @returns {Promise<object>} - Resultado da operação
 */
export const addContactToList = async (email, listId) => {
  try {
    logInfo('Adicionando contato a lista no Brevo', { email, listId });
    
    // Instanciar API de contatos
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    
    // Preparar dados para adicionar à lista
    const contactEmails = new SibApiV3Sdk.AddContactToList();
    contactEmails.emails = [email];
    
    // Enviar requisição para adicionar contato à lista
    const result = await contactsApi.addContactToList(listId, contactEmails);
    
    logInfo('Contato adicionado à lista com sucesso', { 
      email, 
      listId,
      contacts: result.contacts
    });
    
    return { 
      success: true, 
      contacts: result.contacts,
      email
    };
  } catch (error) {
    logError('Erro ao adicionar contato à lista no Brevo', error, { email, listId });
    return { 
      success: false, 
      error: error.message,
      email
    };
  }
};

/**
 * Função para gerenciar a associação de um contato às listas baseado no status
 * 
 * @param {string} email - Email do contato
 * @param {string} status - Status do usuário (TRIAL, ATIVO, INATIVO)
 * @returns {Promise<object>} - Resultado da operação
 */
export const updateContactListsByStatus = async (email, status) => {
  try {
    logInfo('Gerenciando listas do contato baseado no status', { email, status });
    
    // IDs das listas conforme solicitado
    const listIds = {
      TRIAL: 7,   // Lista para usuários Trial
      ATIVO: 8,   // Lista para usuários Ativos
      INATIVO: 9, // Lista para usuários Inativos
    };
    
    // Validar se o status é válido
    if (!status || !listIds[status]) {
      logWarn('Status inválido para gerenciamento de listas', { email, status });
      return { 
        success: false, 
        error: `Status inválido: ${status}`,
        email
      };
    }
    
    // Instanciar API de contatos
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    
    // Primeiro verificar se o contato existe
    try {
      const contactInfo = await contactsApi.getContactInfo(email);
      logInfo('Contato encontrado no Brevo', { email, id: contactInfo.id });
      
      // Remover o contato de todas as listas de status primeiro
      const allStatusLists = Object.values(listIds);
      for (const listId of allStatusLists) {
        try {
          const removeContactFromList = new SibApiV3Sdk.RemoveContactFromList();
          removeContactFromList.emails = [email];
          
          await contactsApi.removeContactFromList(listId, removeContactFromList);
          logInfo('Contato removido da lista', { email, listId });
        } catch (removeError) {
          // Ignorar erros ao remover da lista (pode não estar na lista)
          logWarn('Erro ao remover contato da lista (ignorando)', { 
            email, 
            listId,
            error: removeError.message
          });
        }
      }
      
      // Adicionar o contato à lista correta para seu status atual
      const targetListId = listIds[status];
      const contactEmails = new SibApiV3Sdk.AddContactToList();
      contactEmails.emails = [email];
      
      const result = await contactsApi.addContactToList(targetListId, contactEmails);
      
      logInfo('Contato adicionado à lista correspondente ao status', { 
        email, 
        status,
        listId: targetListId,
        contacts: result.contacts
      });
      
      return { 
        success: true, 
        contacts: result.contacts,
        email,
        status,
        listId: targetListId
      };
    } catch (contactError) {
      // Se o contato não existir, criar primeiro
      logWarn('Contato não encontrado, criando novo contato', { email, error: contactError.message });
      
      // Criar o contato com o status correto
      const createResult = await createOrUpdateContact({
        email,
        status,
        listIds: [listIds[status]]
      });
      
      if (!createResult.success) {
        throw new Error(`Erro ao criar contato: ${createResult.error}`);
      }
      
      return { 
        success: true, 
        message: 'Contato criado e adicionado à lista correspondente',
        email,
        status,
        listId: listIds[status]
      };
    }
  } catch (error) {
    logError('Erro ao gerenciar listas do contato', error, { email, status });
    return { 
      success: false, 
      error: error.message,
      email,
      status
    };
  }
};

// Exportar objeto com todas as funções do serviço
const emailService = {
  sendEmail,
  processTemplate,
  logEmailSent,
  sendWelcomeEmail,
  processScheduledEmails,
  processFirstLoginEmail,
  sendTestEmail: sendTestEmailWithTemplate,
  sendTestEmailWithTemplate,
  createOrUpdateContact,
  addContactToList,
  updateContactListsByStatus
};

export default emailService; 