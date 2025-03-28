import { createClient } from '@supabase/supabase-js';
import { getAccessToken } from '../utils/sendpulse-service-esm.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config();

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configuração do SendPulse
const SENDPULSE_CONFIG = {
  client_id: process.env.SENDPULSE_CLIENT_ID,
  client_secret: process.env.SENDPULSE_CLIENT_SECRET,
  sender_name: process.env.SENDPULSE_SENDER_NAME || 'Songmetrix',
  sender_email: process.env.SENDPULSE_SENDER_EMAIL || 'noreply@songmetrix.com.br'
};

// Verificar configuração do SendPulse
if (!SENDPULSE_CONFIG.client_id || !SENDPULSE_CONFIG.client_secret) {
  console.warn('[EMAIL] SendPulse API credentials not found. Email sending will not work.');
}

// Logs
console.log(`[EMAIL-SERVICE] Inicializando serviço de email SendPulse`);
console.log(`[EMAIL-SERVICE] Remetente: ${SENDPULSE_CONFIG.sender_name} <${SENDPULSE_CONFIG.sender_email}>`);

// Função para enviar email
export const sendEmail = async (to, subject, html, options = {}) => {
  try {
    console.log(`[EMAIL] Enviando email para ${to}`);
    console.log(`[EMAIL] Assunto: ${subject}`);
    
    if (!SENDPULSE_CONFIG.client_id || !SENDPULSE_CONFIG.client_secret) {
      throw new Error('SendPulse API credentials not configured');
    }
    
    // Obter token de acesso primeiro
    const accessToken = await getAccessToken();
    
    // Configurar dados do email
    const emailData = {
      email: {
        subject,
        html,
        from: {
          name: options.sender_name || SENDPULSE_CONFIG.sender_name,
          email: options.sender_email || SENDPULSE_CONFIG.sender_email
        },
        to: [
          {
            name: options.recipient_name || to.split('@')[0],
            email: to
          }
        ]
      }
    };
    
    // Adicionar CC se fornecido
    if (options.cc && Array.isArray(options.cc) && options.cc.length > 0) {
      emailData.email.cc = options.cc.map(email => ({
        name: email.split('@')[0],
        email
      }));
    }
    
    // Adicionar BCC se fornecido
    if (options.bcc && Array.isArray(options.bcc) && options.bcc.length > 0) {
      emailData.email.bcc = options.bcc.map(email => ({
        name: email.split('@')[0],
        email
      }));
    }
    
    // Enviar o email
    console.log(`[EMAIL] Enviando email com SendPulse para ${to} usando token: ${accessToken.substring(0, 10)}...`);
    console.log(`[EMAIL] Dados do email: ${JSON.stringify(emailData, null, 2)}`);
    
    // Função para tentar enviar com diferentes endpoints
    const tryEndpoints = async () => {
      // Lista de endpoints a serem tentados em ordem
      const endpoints = [
        'https://api.sendpulse.com/smtp/emails',
        'https://api.sendpulse.com/emails',
        'https://api.sendpulse.com/v2/email-service/smtp/emails'
      ];
      
      let lastError = null;
      let lastResponse = null;
      let lastResult = null;
      
      // Tentar cada endpoint até que um funcione
      for (const endpoint of endpoints) {
        try {
          console.log(`[EMAIL] Tentando endpoint: ${endpoint}`);
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
          });
          
          console.log(`[EMAIL] Resposta do SendPulse (${endpoint}): Status ${response.status}`);
          lastResponse = response;
          
          const result = await response.json();
          lastResult = result;
          console.log(`[EMAIL] Resposta completa de ${endpoint}: ${JSON.stringify(result)}`);
          
          if (response.ok) {
            console.log(`[EMAIL] Email enviado com sucesso usando endpoint: ${endpoint}`);
            return { response, result };
          }
          
          lastError = new Error(`SendPulse API error (${response.status}): ${result.message || response.statusText}`);
        } catch (error) {
          console.error(`[EMAIL] Erro ao tentar endpoint ${endpoint}:`, error.message);
          lastError = error;
        }
      }
      
      // Se chegamos aqui, todos os endpoints falharam
      throw lastError || new Error('Todos os endpoints do SendPulse falharam');
    };
    
    // Tentar enviar o email com diferentes endpoints
    const { response, result } = await tryEndpoints();
    
    if (!response.ok) {
      console.error(`[EMAIL] Erro ao enviar email via SendPulse: ${JSON.stringify(result)}`);
      throw new Error(`SendPulse API error: ${result.message || response.statusText}`);
    }
    
    console.log(`[EMAIL] Email enviado com sucesso: ${JSON.stringify(result)}`);
    
    // Gravar log de envio no banco de dados
    try {
      await supabaseAdmin
        .from('email_logs')
        .insert([{
          email_to: to,
          subject,
          status: 'SUCCESS',
          provider: 'SENDPULSE',
          sent_at: new Date().toISOString(),
          template_id: options.template_id || null,
          sequence_id: options.sequence_id || null,
          user_id: options.user_id || null
        }]);
    } catch (logError) {
      console.error('[EMAIL] Erro ao gravar log de email:', logError);
    }
    
    return {
      success: true,
      message: 'Email enviado com sucesso',
      data: result
    };
  } catch (error) {
    console.error(`[EMAIL] Erro ao enviar email: ${error.message}`);
    
    // Gravar log de erro no banco de dados
    try {
      await supabaseAdmin
        .from('email_logs')
        .insert([{
          email_to: to,
          subject,
          status: 'FAILED',
          error_message: error.message,
          provider: 'SENDPULSE',
          sent_at: new Date().toISOString(),
          template_id: options.template_id || null,
          sequence_id: options.sequence_id || null,
          user_id: options.user_id || null
        }]);
    } catch (logError) {
      console.error('[EMAIL] Erro ao gravar log de erro de email:', logError);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};

// Função para enviar email usando um template
export const sendEmailWithTemplate = async (params) => {
  try {
    const { to, templateId, variables = {}, options = {} } = params;
    
    console.log(`[EMAIL] Enviando email com template ${templateId} para ${to}`);
    
    // Buscar template no banco de dados
    const { data: template, error: templateError } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (templateError) {
      throw new Error(`Erro ao buscar template: ${templateError.message}`);
    }
    
    if (!template) {
      throw new Error(`Template com ID ${templateId} não encontrado`);
    }
    
    // Renderizar o template substituindo as variáveis
    let subject = template.subject;
    let html = template.body;
    
    // Substituir variáveis no assunto e corpo
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
    }
    
    // Adicionar template_id às opções
    const emailOptions = {
      ...options,
      template_id: templateId
    };
    
    // Enviar o email
    return await sendEmail(to, subject, html, emailOptions);
  } catch (error) {
    console.error(`[EMAIL] Erro ao enviar email com template: ${error.message}`);
    return {
      success: false,
      error: `Erro ao enviar email com template: ${error.message}`
    };
  }
};

// Função para enviar email de teste
export const sendTestEmail = async (params) => {
  try {
    const { to, templateId } = params;
    
    if (!to) {
      throw new Error('Destinatário não fornecido');
    }
    
    // Se o templateId for fornecido, usar o template específico
    if (templateId) {
      // Variáveis de teste
      const variables = {
        name: 'Usuário de Teste',
        email: to,
        radioName: 'Rádio Teste',
        appUrl: process.env.VITE_APP_URL || 'https://app.songmetrix.com.br',
        currentDate: new Date().toLocaleDateString('pt-BR'),
        supportEmail: 'suporte@songmetrix.com.br'
      };
      
      return await sendEmailWithTemplate({
        to,
        templateId,
        variables
      });
    } else {
      // Enviar email de teste genérico
      const subject = 'Songmetrix - Email de teste';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #2563eb;">Songmetrix - Email de Teste</h2>
          <p>Olá,</p>
          <p>Este é um email de teste enviado pelo sistema Songmetrix.</p>
          <p>Se você está recebendo este email, significa que a configuração de envio de email está funcionando corretamente.</p>
          <p>Data e hora do envio: ${new Date().toLocaleString('pt-BR')}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">Este é um email automático, por favor não responda.</p>
        </div>
      `;
      
      return await sendEmail(to, subject, html);
    }
  } catch (error) {
    console.error(`[EMAIL] Erro ao enviar email de teste: ${error.message}`);
    return {
      success: false,
      error: `Erro ao enviar email de teste: ${error.message}`
    };
  }
};

// Função para enviar email de boas-vindas
export const sendWelcomeEmail = async (userData, options = {}) => {
  try {
    const { email, name, radioName } = userData;
    
    console.log(`[EMAIL] Enviando email de boas-vindas para ${email}`);
    
    // Buscar template de boas-vindas
    const { data: template, error: templateError } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('name', 'welcome_email')
      .eq('active', true)
      .single();
    
    if (templateError) {
      throw new Error(`Erro ao buscar template de boas-vindas: ${templateError.message}`);
    }
    
    if (!template) {
      throw new Error('Template de boas-vindas não encontrado');
    }
    
    // Variáveis para o template
    const variables = {
      name: name || 'Usuário',
      email,
      radioName: radioName || 'sua rádio',
      appUrl: process.env.VITE_APP_URL || 'https://app.songmetrix.com.br',
      currentDate: new Date().toLocaleDateString('pt-BR'),
      supportEmail: 'suporte@songmetrix.com.br'
    };
    
    // Adicionar user_id às opções
    const emailOptions = {
      ...options,
      template_id: template.id,
      user_id: userData.id
    };
    
    // Registrar no log que estamos enviando um email de boas-vindas
    if (options.verbose) {
      console.log(`[EMAIL] Enviando email de boas-vindas usando template ID ${template.id}`);
      console.log(`[EMAIL] Variáveis: ${JSON.stringify(variables)}`);
    }
    
    // Enviar o email
    return await sendEmailWithTemplate({
      to: email,
      templateId: template.id,
      variables,
      options: emailOptions
    });
  } catch (error) {
    console.error(`[EMAIL] Erro ao enviar email de boas-vindas: ${error.message}`);
    return {
      success: false,
      error: `Erro ao enviar email de boas-vindas: ${error.message}`
    };
  }
};

// Função para processar emails agendados
export const processScheduledEmails = async () => {
  try {
    console.log('[EMAIL] Processando emails agendados...');
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Buscar sequências de email ativas com send_hour = currentHour
    const { data: sequences, error: sequencesError } = await supabaseAdmin
      .from('email_sequences')
      .select(`
        *,
        template:template_id (*)
      `)
      .eq('active', true)
      .eq('send_hour', currentHour);
    
    if (sequencesError) {
      throw new Error(`Erro ao buscar sequências de email: ${sequencesError.message}`);
    }
    
    console.log(`[EMAIL] Encontradas ${sequences.length} sequências para processar na hora ${currentHour}`);
    
    if (sequences.length === 0) {
      return {
        success: true,
        message: 'Nenhuma sequência encontrada para a hora atual',
        processedCount: 0
      };
    }
    
    // Para cada sequência, encontrar usuários elegíveis
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const sequence of sequences) {
      console.log(`[EMAIL] Processando sequência: ${sequence.name}`);
      
      if (!sequence.template) {
        console.error(`[EMAIL] Template não encontrado para sequência: ${sequence.id}`);
        errors.push(`Template não encontrado para sequência: ${sequence.id}`);
        continue;
      }
      
      // Buscar usuários que atendem aos critérios da sequência
      let usersQuery = supabaseAdmin
        .from('users')
        .select('*')
        .not('email', 'is', null);
      
      if (sequence.send_type === 'DAYS_AFTER_SIGNUP') {
        // Calcular a data para comparação (hoje - dias da sequência)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - sequence.days_after_signup);
        const targetDateString = targetDate.toISOString().split('T')[0];
        
        // Encontrar usuários criados nesse dia
        usersQuery = usersQuery.like('created_at', `${targetDateString}%`);
      } else if (sequence.send_type === 'AFTER_FIRST_LOGIN') {
        // Buscar usuários que fizeram login pela primeira vez há X dias
        // Esta lógica pode precisar ser adaptada conforme seu banco de dados
        // Aqui presumimos que existe um campo 'first_login_at'
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - sequence.days_after_signup);
        const targetDateString = targetDate.toISOString().split('T')[0];
        
        usersQuery = usersQuery.like('first_login_at', `${targetDateString}%`);
      }
      
      // Obter os usuários
      const { data: users, error: usersError } = await usersQuery;
      
      if (usersError) {
        console.error(`[EMAIL] Erro ao buscar usuários para sequência ${sequence.name}: ${usersError.message}`);
        errors.push(`Erro ao buscar usuários para sequência ${sequence.name}: ${usersError.message}`);
        continue;
      }
      
      console.log(`[EMAIL] Encontrados ${users.length} usuários para sequência: ${sequence.name}`);
      
      // Para cada usuário, verificar se o email já foi enviado
      for (const user of users) {
        processedCount++;
        
        try {
          // Verificar se o email já foi enviado para este usuário nesta sequência
          const { data: existingLogs, error: logsError } = await supabaseAdmin
            .from('email_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('sequence_id', sequence.id)
            .eq('status', 'SUCCESS');
          
          if (logsError) {
            throw new Error(`Erro ao verificar logs de email: ${logsError.message}`);
          }
          
          // Se já enviamos, pular este usuário
          if (existingLogs && existingLogs.length > 0) {
            console.log(`[EMAIL] Email da sequência ${sequence.name} já enviado para ${user.email}, pulando`);
            continue;
          }
          
          // Preparar variáveis para o template
          const variables = {
            name: user.full_name || 'Usuário',
            email: user.email,
            radioName: 'sua rádio', // Buscar o nome da rádio se necessário
            appUrl: process.env.VITE_APP_URL || 'https://app.songmetrix.com.br',
            currentDate: new Date().toLocaleDateString('pt-BR'),
            supportEmail: 'suporte@songmetrix.com.br'
          };
          
          // Enviar o email
          const emailResult = await sendEmailWithTemplate({
            to: user.email,
            templateId: sequence.template_id,
            variables,
            options: {
              user_id: user.id,
              sequence_id: sequence.id
            }
          });
          
          if (emailResult.success) {
            successCount++;
            console.log(`[EMAIL] Email da sequência ${sequence.name} enviado com sucesso para ${user.email}`);
          } else {
            errorCount++;
            console.error(`[EMAIL] Erro ao enviar email da sequência ${sequence.name} para ${user.email}: ${emailResult.error}`);
            errors.push(`Erro ao enviar email para ${user.email}: ${emailResult.error}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`[EMAIL] Exceção ao processar email para ${user.email}: ${error.message}`);
          errors.push(`Exceção ao processar email para ${user.email}: ${error.message}`);
        }
      }
    }
    
    return {
      success: true,
      message: `Processamento de emails agendados concluído`,
      processedCount,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error(`[EMAIL] Erro ao processar emails agendados: ${error.message}`);
    return {
      success: false,
      error: `Erro ao processar emails agendados: ${error.message}`
    };
  }
};

// Função para processar email de primeiro login
export const processFirstLoginEmail = async (userId) => {
  try {
    console.log(`[EMAIL] Processando email de primeiro login para usuário ${userId}`);
    
    // Buscar informações do usuário
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError) {
      throw new Error(`Erro ao buscar usuário: ${userError.message}`);
    }
    
    if (!user) {
      throw new Error(`Usuário não encontrado: ${userId}`);
    }
    
    // Buscar sequências de email do tipo AFTER_FIRST_LOGIN com days_after_signup = 0
    const { data: sequences, error: sequencesError } = await supabaseAdmin
      .from('email_sequences')
      .select(`
        *,
        template:template_id (*)
      `)
      .eq('active', true)
      .eq('send_type', 'AFTER_FIRST_LOGIN')
      .eq('days_after_signup', 0);
    
    if (sequencesError) {
      throw new Error(`Erro ao buscar sequências de primeiro login: ${sequencesError.message}`);
    }
    
    console.log(`[EMAIL] Encontradas ${sequences.length} sequências de primeiro login`);
    
    if (sequences.length === 0) {
      return {
        success: true,
        message: 'Nenhuma sequência de primeiro login encontrada',
        processedCount: 0
      };
    }
    
    // Para cada sequência, enviar o email
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const sequence of sequences) {
      console.log(`[EMAIL] Processando sequência de primeiro login: ${sequence.name}`);
      
      if (!sequence.template) {
        console.error(`[EMAIL] Template não encontrado para sequência: ${sequence.id}`);
        errors.push(`Template não encontrado para sequência: ${sequence.id}`);
        continue;
      }
      
      try {
        // Verificar se o email já foi enviado para este usuário nesta sequência
        const { data: existingLogs, error: logsError } = await supabaseAdmin
          .from('email_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('sequence_id', sequence.id)
          .eq('status', 'SUCCESS');
        
        if (logsError) {
          throw new Error(`Erro ao verificar logs de email: ${logsError.message}`);
        }
        
        // Se já enviamos, pular esta sequência
        if (existingLogs && existingLogs.length > 0) {
          console.log(`[EMAIL] Email da sequência ${sequence.name} já enviado para ${user.email}, pulando`);
          continue;
        }
        
        // Preparar variáveis para o template
        const variables = {
          name: user.full_name || 'Usuário',
          email: user.email,
          radioName: 'sua rádio', // Buscar o nome da rádio se necessário
          appUrl: process.env.VITE_APP_URL || 'https://app.songmetrix.com.br',
          currentDate: new Date().toLocaleDateString('pt-BR'),
          supportEmail: 'suporte@songmetrix.com.br'
        };
        
        // Enviar o email
        const emailResult = await sendEmailWithTemplate({
          to: user.email,
          templateId: sequence.template_id,
          variables,
          options: {
            user_id: user.id,
            sequence_id: sequence.id
          }
        });
        
        if (emailResult.success) {
          successCount++;
          console.log(`[EMAIL] Email da sequência ${sequence.name} enviado com sucesso para ${user.email}`);
        } else {
          errorCount++;
          console.error(`[EMAIL] Erro ao enviar email da sequência ${sequence.name} para ${user.email}: ${emailResult.error}`);
          errors.push(`Erro ao enviar email para ${user.email}: ${emailResult.error}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[EMAIL] Exceção ao processar email para ${user.email}: ${error.message}`);
        errors.push(`Exceção ao processar email para ${user.email}: ${error.message}`);
      }
    }
    
    // Atualizar o campo first_login_at do usuário
    try {
      await supabaseAdmin
        .from('users')
        .update({ first_login_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (updateError) {
      console.error(`[EMAIL] Erro ao atualizar first_login_at do usuário: ${updateError.message}`);
    }
    
    return {
      success: true,
      message: `Processamento de emails de primeiro login concluído`,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error(`[EMAIL] Erro ao processar email de primeiro login: ${error.message}`);
    return {
      success: false,
      error: `Erro ao processar email de primeiro login: ${error.message}`
    };
  }
};

// Exportar todas as funções
export default {
  sendEmail,
  sendEmailWithTemplate,
  sendTestEmail,
  sendWelcomeEmail,
  processScheduledEmails,
  processFirstLoginEmail
};
