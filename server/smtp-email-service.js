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
    
    // Buscar informações adicionais do usuário no auth.users
    console.log('[SMTP-SERVICE] Buscando dados de autenticação do usuário...');
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
                   
      console.log(`[SMTP-SERVICE] Nome de exibição do usuário: ${displayName}`);
      console.log(`[SMTP-SERVICE] fullName do usuário: ${fullName}`);
    } else {
      console.log('[SMTP-SERVICE] Dados de autenticação não encontrados, usando full_name do perfil');
    }
    
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
    // Incluir tanto name quanto fullName nas variáveis do template
    const htmlContent = processTemplate(template.body, { 
      name: displayName || userData.full_name || userData.email.split('@')[0],
      fullName: fullName || displayName || userData.full_name || userData.email.split('@')[0],
      email: userData.email,
      date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Enviar email com o assunto exato do template (sem prefixo [TESTE])
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
    // Obter hora atual no fuso horário local
    const currentHour = new Date().getHours();
    console.log(`[SMTP-SERVICE] Processando emails agendados para hora ${currentHour}`);
    
    // Consultar usuários com emails pendentes para a hora atual
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails', {
      p_current_hour: currentHour
    });
    
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
        // Buscar informações adicionais do usuário no auth.users para obter display_name
        let displayName = pending.full_name;
        let fullName = pending.full_name;
        
        if (pending.user_id) {
          console.log(`[SMTP-SERVICE] Buscando dados de autenticação para usuário ID: ${pending.user_id}`);
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
                        
            console.log(`[SMTP-SERVICE] Nome de exibição do usuário: ${displayName}`);
            console.log(`[SMTP-SERVICE] fullName do usuário: ${fullName}`);
          } else {
            console.log('[SMTP-SERVICE] Dados de autenticação não encontrados, usando full_name do perfil');
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

/**
 * Função para enviar email de teste utilizando um template específico
 * 
 * @param {object} options - Opções do email
 * @param {string} options.to - Email do destinatário
 * @param {string} options.templateId - ID do template a ser utilizado
 * @returns {Promise<object>} - Resultado do envio
 */
export const sendTestEmailWithTemplate = async ({ to, templateId }) => {
  try {
    console.log(`[SMTP-SERVICE] Iniciando envio de email de teste com template ID: ${templateId} para: ${to}`);
    
    // Obter dados do template
    console.log('[SMTP-SERVICE] Buscando template...');
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();
      
    if (templateError) {
      console.error(`[SMTP-SERVICE] Erro ao buscar template: ${templateError.message}`);
      throw templateError;
    }
    
    if (!template) {
      console.error('[SMTP-SERVICE] Template não encontrado');
      throw new Error(`Template com ID ${templateId} não encontrado`);
    }
    
    console.log(`[SMTP-SERVICE] Template encontrado: "${template.name}"`);
    
    // Buscar dados do usuário pelo email
    console.log(`[SMTP-SERVICE] Buscando dados do usuário com email: ${to}`);
    
    // Corrigindo para usar a forma correta de buscar usuário por email
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
      
      console.log(`[SMTP-SERVICE] Usuário encontrado com ID: ${userId}`);
      
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
                    
          console.log(`[SMTP-SERVICE] Nome de exibição do usuário: ${displayName}`);
          console.log(`[SMTP-SERVICE] fullName do usuário: ${fullName}`);
        }
      }
    } else {
      console.log('[SMTP-SERVICE] Usuário não encontrado na tabela users, usando valores padrão');
      
      // Tentativa alternativa: buscar diretamente na tabela auth.users
      try {
        // Esta é uma abordagem alternativa que pode exigir permissões específicas
        const { data: authUsers, error: authUsersError } = await supabase
          .from('auth.users')
          .select('id, email, raw_user_meta_data')
          .eq('email', to)
          .limit(1);
          
        if (!authUsersError && authUsers && authUsers.length > 0) {
          const user = authUsers[0];
          fullName = user.raw_user_meta_data?.fullName || 
                   user.raw_user_meta_data?.full_name || 
                   'Usuário de Teste';
          displayName = fullName;
          console.log(`[SMTP-SERVICE] Usuário encontrado diretamente na tabela auth: ${fullName}`);
        }
      } catch (authError) {
        console.log('[SMTP-SERVICE] Erro ao buscar na tabela auth.users, continuando com valores padrão');
      }
    }
    
    // Processar template
    console.log('[SMTP-SERVICE] Processando template de teste...');
    const htmlContent = processTemplate(template.body, { 
      name: displayName,
      fullName: fullName,
      email: to,
      date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Enviar email - sem o prefixo [TESTE]
    console.log(`[SMTP-SERVICE] Enviando email de teste para ${to}...`);
    const result = await sendEmail(
      to,
      template.subject,
      htmlContent
    );
    
    // Registrar log - sem incluir o prefixo [TESTE] no assunto
    console.log(`[SMTP-SERVICE] Resultado do envio de teste: ${result.success ? 'Sucesso' : 'Falha'}`);
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
    console.error('[SMTP-SERVICE] Erro ao enviar email de teste com template:', error);
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
    console.log(`[SMTP-SERVICE] Iniciando envio de email de teste simples para: ${to}`);
    
    // Criar conteúdo HTML simples para o teste
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #4a6ee0;">Teste de Email SongMetrix</h2>
        <p>Olá,</p>
        <p>Este é um email de teste enviado pelo sistema SongMetrix.</p>
        <p>Se você está recebendo este email, significa que a configuração do sistema de email está funcionando corretamente.</p>
        <p>Data e hora do teste: ${new Date().toLocaleString('pt-BR')}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #666;">Este é um email automático de teste. Por favor, não responda.</p>
      </div>
    `;
    
    // Enviar email - removido o prefixo [TESTE]
    const result = await sendEmail(
      to,
      'Email de teste do SongMetrix',
      htmlContent
    );
    
    // Registrar log - removido o prefixo [TESTE]
    console.log(`[SMTP-SERVICE] Resultado do envio de teste simples: ${result.success ? 'Sucesso' : 'Falha'}`);
    await logEmailSent({
      status: result.success ? 'SUCCESS' : 'FAILED',
      error_message: result.success ? null : result.error,
      email_to: to,
      subject: 'Email de teste do SongMetrix'
    });
    
    return result;
  } catch (error) {
    console.error('[SMTP-SERVICE] Erro ao enviar email de teste simples:', error);
    return { success: false, error: error.message, stack: error.stack };
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
    console.log(`[SMTP-SERVICE] Processando email de primeiro login para usuário ID: ${userId}`);
    
    // Obter dados do usuário
    console.log('[SMTP-SERVICE] Buscando dados do usuário...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at, first_login_at')
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
    
    // Buscar informações adicionais do usuário no auth.users
    console.log('[SMTP-SERVICE] Buscando dados de autenticação do usuário...');
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
                   
      console.log(`[SMTP-SERVICE] Nome de exibição do usuário: ${displayName}`);
      console.log(`[SMTP-SERVICE] fullName do usuário: ${fullName}`);
    } else {
      console.log('[SMTP-SERVICE] Dados de autenticação não encontrados, usando full_name do perfil');
    }
    
    // Buscar sequências de email configuradas para primeiro login (várias possibilidades de nome do campo)
    console.log('[SMTP-SERVICE] Buscando sequências de primeiro login...');
    console.log('[SMTP-SERVICE] Verificando sequências com diferentes configurações...');

    // Tentar com send_type = AFTER_FIRST_LOGIN (padrão)
    const { data: sequences1, error: seqError1 } = await supabase
      .from('email_sequences')
      .select('id, name, send_type, template_id')
      .eq('send_type', 'AFTER_FIRST_LOGIN')
      .eq('active', true);

    // Tentar com send_type = FIRST_LOGIN (alternativa)
    const { data: sequences2, error: seqError2 } = await supabase
      .from('email_sequences')
      .select('id, name, send_type, template_id')
      .eq('send_type', 'FIRST_LOGIN')
      .eq('active', true);

    // Tentar com trigger_type (alternativa)
    const { data: sequences3, error: seqError3 } = await supabase
      .from('email_sequences')
      .select('id, name, trigger_type, template_id')
      .eq('trigger_type', 'first_login')
      .eq('active', true);

    // Tentar diretamente pelo nome da sequência
    const { data: sequences4, error: seqError4 } = await supabase
      .from('email_sequences')
      .select('id, name, template_id')
      .ilike('name', '%primeiro login%')
      .eq('active', true);

    // Combinar os resultados das diferentes consultas
    const sequences = [
      ...(sequences1 || []),
      ...(sequences2 || []),
      ...(sequences3 || []),
      ...(sequences4 || [])
    ];

    // Remover possíveis duplicatas pelo ID
    const uniqueSequences = [...new Map(sequences.map(seq => [seq.id, seq])).values()];

    console.log(`[SMTP-SERVICE] Encontradas ${uniqueSequences.length} sequências de primeiro login`);

    if (seqError1 || seqError2 || seqError3 || seqError4) {
      console.error('[SMTP-SERVICE] Erros ao buscar sequências:');
      if (seqError1) console.error('- Erro em AFTER_FIRST_LOGIN:', seqError1.message);
      if (seqError2) console.error('- Erro em FIRST_LOGIN:', seqError2.message);
      if (seqError3) console.error('- Erro em trigger_type:', seqError3.message);
      if (seqError4) console.error('- Erro em busca por nome:', seqError4.message);
    }

    if (uniqueSequences.length === 0) {
      console.log('[SMTP-SERVICE] Nenhuma sequência de primeiro login ativa encontrada');
      return { success: true, count: 0, message: 'Nenhuma sequência de primeiro login ativa configurada' };
    }

    // Processar cada sequência
    let successCount = 0;
    let failCount = 0;
    
    for (const sequence of uniqueSequences) {
      try {
        console.log(`[SMTP-SERVICE] Processando sequência: ${sequence.name}`);
        
        // Buscar template associado à sequência
        const { data: template, error: templateError } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', sequence.template_id)
          .single();
          
        if (templateError) {
          console.error(`[SMTP-SERVICE] Erro ao buscar template para sequência ${sequence.id}: ${templateError.message}`);
          throw templateError;
        }
        
        if (!template) {
          console.error(`[SMTP-SERVICE] Template não encontrado para sequência ${sequence.id}`);
          throw new Error(`Template não encontrado para sequência ${sequence.id}`);
        }
        
        console.log(`[SMTP-SERVICE] Template encontrado: "${template.name}"`);
        
        // Verificar se já enviou email para este usuário nesta sequência
        const { data: existingLogs, error: logCheckError } = await supabase
          .from('email_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('sequence_id', sequence.id)
          .limit(1);
          
        if (logCheckError) {
          console.error(`[SMTP-SERVICE] Erro ao verificar logs: ${logCheckError.message}`);
          // Continuar mesmo com erro, para não bloquear o envio
        } else if (existingLogs && existingLogs.length > 0) {
          console.log(`[SMTP-SERVICE] Email já enviado anteriormente para este usuário na sequência ${sequence.id}`);
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
        console.log(`[SMTP-SERVICE] Enviando email para ${userData.email}...`);
        const result = await sendEmail(
          userData.email,
          template.subject,
          htmlContent
        );
        
        // Registrar log
        if (result.success) {
          successCount++;
          await logEmailSent({
            user_id: userId,
            template_id: template.id,
            sequence_id: sequence.id,
            status: 'SUCCESS',
            email_to: userData.email,
            subject: template.subject
          });
          console.log(`[SMTP-SERVICE] Email de primeiro login enviado com sucesso para ${userData.email}`);
        } else {
          failCount++;
          await logEmailSent({
            user_id: userId,
            template_id: template.id,
            sequence_id: sequence.id,
            status: 'FAILED',
            error_message: result.error,
            email_to: userData.email,
            subject: template.subject
          });
          console.error(`[SMTP-SERVICE] Falha ao enviar email de primeiro login para ${userData.email}: ${result.error}`);
        }
      } catch (sequenceError) {
        failCount++;
        console.error(`[SMTP-SERVICE] Erro ao processar sequência ${sequence.id}:`, sequenceError);
      }
    }
    
    return { 
      success: true, 
      count: sequences.length,
      successCount,
      failCount
    };
  } catch (error) {
    console.error('[SMTP-SERVICE] Erro ao processar email de primeiro login:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendEmail,
  processTemplate,
  logEmailSent,
  sendWelcomeEmail,
  processScheduledEmails,
  sendTestEmailWithTemplate,
  sendTestEmail,
  processFirstLoginEmail
}; 