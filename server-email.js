// server-email.js - Servidor dedicado para o serviço de email
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Importar os serviços de email disponíveis
import emailJsService from './server/emailjs-service.js';
import smtpEmailService from './server/smtp-email-service.js';
import brevoEmailService from './server/brevo-email-service.js';
import sendPulseEmailService from './server/sendpulse-email-service.js';
import { createClient } from '@supabase/supabase-js';
import { logEmail, logError, logInfo, logDebug } from './server/logger.js';

// Obter o diretório atual em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Definição de porta modificada para evitar conflitos
const SERVER_PORT = process.env.SERVER_PORT || 3001;
const PORT = process.env.EMAIL_SERVER_PORT || 3003; // Porta alternativa para evitar conflito com o servidor principal

// Configurar cliente Supabase para verificação de autenticação
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001', 'https://songmetrix.com.br'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Adicionar middleware para lidar com OPTIONS preflight
app.options('*', cors());

// Middleware para logging de requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`[REQUEST] Headers: ${JSON.stringify(req.headers)}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`[REQUEST] Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

// Middleware para verificar autenticação básica (não admin)
const isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token de autenticação não fornecido' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verificar token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido ou expirado' 
      });
    }
    
    // Definir usuário autenticado para uso nas rotas
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar autenticação', 
      error: error.message 
    });
  }
};

// Variáveis de configuração
const EMAIL_SERVICE_TYPE = process.env.EMAIL_SERVICE_TYPE || 'SENDPULSE';

// Selecionar o serviço de email conforme a configuração
console.log(`[EMAIL] Usando serviço de email: ${EMAIL_SERVICE_TYPE}`);
let emailService;

switch (EMAIL_SERVICE_TYPE) {
  case 'BREVO':
    emailService = brevoEmailService;
    break;
  case 'SMTP':
    emailService = smtpEmailService;
    break;
  case 'EMAILJS':
    emailService = emailJsService;
    break;
  case 'SENDPULSE':
    emailService = sendPulseEmailService;
    break;
  default:
    // Padrão para SendPulse
    emailService = sendPulseEmailService;
    console.log(`[EMAIL] Serviço não reconhecido, usando SendPulse como padrão`);
}

// Verificar se o serviço foi configurado corretamente
if (!emailService) {
  console.error('[EMAIL] Nenhum serviço de email configurado!');
} else {
  console.log('[EMAIL] Serviço de email inicializado com sucesso');
}

// Rota de teste para verificar conexão
app.get('/api/email/test-connection', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor de email conectado com sucesso',
    timestamp: new Date().toISOString()
  });
});

// Rota para enviar email de boas-vindas
app.post('/api/email/send-welcome', isAuthenticated, async (req, res) => {
  console.log('[EMAIL] Requisição recebida para enviar email de boas-vindas');
  console.log('[EMAIL] Headers:', req.headers);
  console.log('[EMAIL] Body:', req.body);
  
  try {
    const { email, name, radioName } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email de destinatário não fornecido' 
      });
    }
    
    // Verificar se há um serviço de email configurado
    if (!emailService) {
      console.error('[EMAIL] Serviço de email não configurado');
      return res.status(500).json({
        success: false,
        message: 'Serviço de email não configurado'
      });
    }
    
    // Enviar email de boas-vindas
    const result = await emailService.sendWelcomeEmail({
      to: email,
      name: name || 'Usuário',
      radioName: radioName || 'sua rádio'
    });
    
    console.log('[EMAIL] Resultado do envio de email de boas-vindas:', result);
    
    res.status(200).json({
      success: true,
      message: 'Email de boas-vindas enviado com sucesso',
      result
    });
  } catch (error) {
    console.error('[EMAIL] Erro ao enviar email de boas-vindas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar email de boas-vindas',
      error: error.message
    });
  }
});

// Rota para enviar email de teste
app.post('/api/email/send-test', /* isAuthenticated, */ async (req, res) => {
  console.log('[EMAIL-TEST] Requisição recebida para /api/email/send-test');
  console.log('[EMAIL-TEST] Headers:', JSON.stringify(req.headers));
  console.log('[EMAIL-TEST] Body:', JSON.stringify(req.body));
  
  try {
    const { email, templateId } = req.body;
    
    console.log(`[EMAIL-TEST] Dados da requisição: email=${email}, templateId=${templateId}`);
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email não fornecido' 
      });
    }
    
    console.log(`[EMAIL-TEST] Iniciando envio de email de teste para ${email}`);
    
    // Verificar se há um serviço de email configurado
    if (!emailService) {
      console.error('[EMAIL-TEST] Serviço de email não configurado');
      return res.status(500).json({
        success: false,
        message: 'Serviço de email não configurado'
      });
    }
    
    // Enviar email de teste
    let result;
    
    if (templateId) {
      // Enviar email usando template específico
      console.log(`[EMAIL-TEST] Enviando email com template ID ${templateId}`);
      result = await emailService.sendTestEmailWithTemplate({
        to: email,
        templateId: templateId
      });
    } else {
      // Enviar email de teste padrão
      console.log('[EMAIL-TEST] Enviando email de teste padrão');
      result = await emailService.sendTestEmail({
        to: email
      });
    }
    
    console.log('[EMAIL-TEST] Resultado do envio:', result);
    
    res.status(200).json({
      success: true,
      message: 'Email de teste enviado com sucesso',
      result
    });
  } catch (error) {
    console.error('[EMAIL-TEST] Erro ao enviar email de teste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar email de teste',
      error: error.message
    });
  }
});

// Rota para processar emails agendados
app.post('/api/email/process-scheduled', isAuthenticated, async (req, res) => {
  console.log('[EMAIL-SCHEDULED] Requisição recebida para processar emails agendados');
  
  try {
    // Verificar se há um serviço de email configurado
    if (!emailService) {
      return res.status(500).json({
        success: false,
        message: 'Serviço de email não configurado'
      });
    }
    
    // Processar emails agendados
    const result = await emailService.processScheduledEmails();
    
    res.status(200).json({
      success: true,
      message: 'Emails agendados processados com sucesso',
      result
    });
  } catch (error) {
    console.error('[EMAIL-SCHEDULED] Erro ao processar emails agendados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar emails agendados',
      error: error.message
    });
  }
});

// Rota para processar email de primeiro login
app.post('/api/email/process-first-login', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID do usuário não fornecido' 
      });
    }
    
    // Verificar se há um serviço de email configurado
    if (!emailService) {
      return res.status(500).json({
        success: false,
        message: 'Serviço de email não configurado'
      });
    }
    
    // Processar email de primeiro login
    const result = await emailService.processFirstLoginEmail(userId);
    
    res.status(200).json({
      success: true,
      message: 'Email de primeiro login processado com sucesso',
      result
    });
  } catch (error) {
    console.error('[EMAIL-FIRST-LOGIN] Erro ao processar email de primeiro login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar email de primeiro login',
      error: error.message
    });
  }
});

// Rota para criar/atualizar contato no Brevo
app.post('/api/email/create-contact', isAuthenticated, async (req, res) => {
  try {
    const { email, fullName, whatsapp, status, createdAt, listIds } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email do contato não fornecido' 
      });
    }
    
    // Verificar se há um serviço de email configurado
    if (!emailService) {
      return res.status(500).json({
        success: false,
        message: 'Serviço de email não configurado'
      });
    }
    
    // Valor padrão para listIds se não fornecido
    // ID da lista principal de contatos (deve ser configurado no .env)
    const mainListId = process.env.BREVO_MAIN_LIST_ID;
    const defaultListIds = mainListId ? [parseInt(mainListId)] : [];
    
    let result;
    
    // Se tiver status, usar a função de atualização baseada em status
    if (status) {
      // Primeiro criar/atualizar o contato
      const contactResult = await emailService.createOrUpdateContact({
        email,
        fullName,
        whatsapp,
        status,
        createdAt,
        listIds: [] // Não adicionar a nenhuma lista ainda
      });
      
      if (!contactResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Erro ao criar/atualizar contato no Brevo',
          error: contactResult.error
        });
      }
      
      // Atualizar as listas com base no status
      result = await emailService.updateContactListsByStatus(email, status);
    } else {
      // Sem status, usar a função padrão
      result = await emailService.createOrUpdateContact({
        email,
        fullName,
        whatsapp,
        status,
        createdAt,
        listIds: listIds || defaultListIds
      });
    }
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Contato criado/atualizado com sucesso no Brevo',
        result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erro ao criar/atualizar contato no Brevo',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[EMAIL-CREATE-CONTACT] Erro ao criar/atualizar contato:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar/atualizar contato no Brevo',
      error: error.message
    });
  }
});

// Rota para atualizar listas de um contato baseado no status
app.post('/api/email/update-contact-lists', isAuthenticated, async (req, res) => {
  try {
    const { email, status } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email do contato não fornecido' 
      });
    }
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status do usuário não fornecido' 
      });
    }
    
    // Verificar se há um serviço de email configurado
    if (!emailService) {
      return res.status(500).json({
        success: false,
        message: 'Serviço de email não configurado'
      });
    }
    
    // Atualizar as listas do contato com base no status
    const result = await emailService.updateContactListsByStatus(email, status);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Listas do contato atualizadas com sucesso',
        result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erro ao atualizar listas do contato',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[EMAIL-UPDATE-CONTACT-LISTS] Erro ao atualizar listas do contato:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar listas do contato',
      error: error.message
    });
  }
});

// Adicionar nova rota para processar sequências de email
app.post('/api/sendpulse/process-sequences', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID do usuário não fornecido' 
      });
    }
    
    // Verificar se o serviço do SendPulse está disponível
    if (!emailService || EMAIL_SERVICE_TYPE !== 'SENDPULSE') {
      return res.status(500).json({
        success: false,
        message: 'Serviço SendPulse não configurado'
      });
    }
    
    // Processar sequências de email para o usuário
    const result = await emailService.processFirstLoginEmail(userId);
    
    return res.status(200).json({
      success: true,
      message: 'Sequências de email processadas com sucesso',
      result
    });
  } catch (error) {
    console.error('[EMAIL] Erro ao processar sequências de email:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar sequências de email',
      error: error.message
    });
  }
});

// Rota para enviar email usando o SendPulse
app.post('/api/sendpulse/send-email', isAuthenticated, async (req, res) => {
  try {
    const { to, templateId, variables } = req.body;
    
    if (!to) {
      return res.status(400).json({ 
        success: false, 
        message: 'Destinatário não fornecido' 
      });
    }
    
    if (!templateId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID do template não fornecido' 
      });
    }
    
    // Verificar se o serviço do SendPulse está disponível
    if (!emailService || EMAIL_SERVICE_TYPE !== 'SENDPULSE') {
      return res.status(500).json({
        success: false,
        message: 'Serviço SendPulse não configurado'
      });
    }
    
    // Enviar email
    const result = await emailService.sendEmailWithTemplate({
      to,
      templateId,
      variables: variables || {}
    });
    
    return res.status(200).json({
      success: true,
      message: 'Email enviado com sucesso',
      result
    });
  } catch (error) {
    console.error('[EMAIL] Erro ao enviar email:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao enviar email',
      error: error.message
    });
  }
});

// Rota para enviar email de boas-vindas com o SendPulse
app.post('/api/sendpulse/send-welcome', isAuthenticated, async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email não fornecido' 
      });
    }
    
    // Verificar se o serviço do SendPulse está disponível
    if (!emailService || EMAIL_SERVICE_TYPE !== 'SENDPULSE') {
      return res.status(500).json({
        success: false,
        message: 'Serviço SendPulse não configurado'
      });
    }
    
    // Enviar email de boas-vindas
    const result = await emailService.sendWelcomeEmail({
      email,
      name: name || 'Usuário'
    });
    
    return res.status(200).json({
      success: true,
      message: 'Email de boas-vindas enviado com sucesso',
      result
    });
  } catch (error) {
    console.error('[EMAIL] Erro ao enviar email de boas-vindas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao enviar email de boas-vindas',
      error: error.message
    });
  }
});

// Rota para enviar email de teste via Brevo
app.post('/api/email/send-brevo', /* isAuthenticated, */ async (req, res) => {
  console.log('[BREVO-TEST] Requisição recebida para /api/email/send-brevo');
  console.log('[BREVO-TEST] Headers:', JSON.stringify(req.headers));
  console.log('[BREVO-TEST] Body:', JSON.stringify(req.body));
  
  try {
    const { email, templateId, variables } = req.body;
    
    console.log(`[BREVO-TEST] Dados da requisição: email=${email}, templateId=${templateId}`);
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email não fornecido' 
      });
    }
    
    console.log(`[BREVO-TEST] Iniciando envio de email de teste para ${email} usando Brevo`);
    
    // Verificar se o serviço Brevo está disponível
    if (!brevoEmailService) {
      console.error('[BREVO-TEST] Serviço Brevo não disponível');
      return res.status(500).json({
        success: false,
        message: 'Serviço Brevo não configurado'
      });
    }
    
    // Enviar email de teste
    let result;
    
    if (templateId) {
      // Enviar email usando template específico
      console.log(`[BREVO-TEST] Enviando email com template ID ${templateId} via Brevo`);
      result = await brevoEmailService.sendTestEmailWithTemplate({
        to: email,
        templateId: templateId,
        variables
      });
    } else {
      // Enviar email de teste padrão
      console.log('[BREVO-TEST] Enviando email de teste padrão via Brevo');
      result = await brevoEmailService.sendTestEmail({
        to: email
      });
    }
    
    console.log('[BREVO-TEST] Resultado do envio:', result);
    
    res.status(200).json({
      success: true,
      message: 'Email de teste enviado com sucesso via Brevo',
      result
    });
  } catch (error) {
    console.error('[BREVO-TEST] Erro ao enviar email de teste via Brevo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar email de teste via Brevo',
      error: error.message
    });
  }
});

// Rota para enviar email de boas-vindas via Brevo
app.post('/api/email/send-welcome-brevo', /* isAuthenticated, */ async (req, res) => {
  console.log('[BREVO] Requisição recebida para enviar email de boas-vindas via Brevo');
  console.log('[BREVO] Headers:', req.headers);
  console.log('[BREVO] Body:', req.body);
  
  try {
    const { email, name, userId } = req.body;
    
    if (!email && !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou ID de usuário deve ser fornecido' 
      });
    }
    
    // Verificar se há serviço Brevo configurado
    if (!brevoEmailService) {
      console.error('[BREVO] Serviço Brevo não configurado');
      return res.status(500).json({
        success: false,
        message: 'Serviço Brevo não configurado'
      });
    }
    
    let result;
    
    // Se tiver userId, usar a função completa
    if (userId) {
      console.log(`[BREVO] Enviando email de boas-vindas para usuário ID: ${userId}`);
      result = await brevoEmailService.sendWelcomeEmail(userId);
    } else {
      // Se não, buscar template e enviar email diretamente
      console.log(`[BREVO] Enviando email de boas-vindas para: ${email}`);
      
      // Buscar template de boas-vindas
      console.log('[BREVO] Buscando template de boas-vindas...');
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('name', 'welcome_email')
        .eq('active', true)
        .single();
        
      if (templateError) {
        console.error(`[BREVO] Erro ao buscar template: ${templateError.message}`);
        throw templateError;
      }
      
      if (!template) {
        console.error('[BREVO] Template de boas-vindas não encontrado ou inativo');
        throw new Error('Template de boas-vindas não encontrado ou inativo');
      }
      
      // Preparar variáveis para o template
      const variables = {
        name: name || 'Usuário',
        email: email,
        radioName: 'Sua Rádio',
        appUrl: process.env.VITE_APP_URL || 'https://app.songmetrix.com.br',
        currentDate: new Date().toLocaleDateString('pt-BR'),
        supportEmail: 'suporte@songmetrix.com.br'
      };
      
      // Processar o template
      console.log('[BREVO] Processando template...');
      const htmlContent = brevoEmailService.processTemplate(template.body, variables);
      
      // Enviar o email
      console.log('[BREVO] Enviando email de boas-vindas...');
      result = await brevoEmailService.sendEmail(
        email,
        template.subject,
        htmlContent
      );
      
      // Registrar o envio no log se bem-sucedido
      if (result.success) {
        console.log('[BREVO] Email de boas-vindas enviado com sucesso. Registrando log...');
        await brevoEmailService.logEmailSent({
          user_id: null,
          template_id: template.id,
          sequence_id: null,
          status: 'SUCCESS',
          error_message: null,
          email_to: email,
          subject: template.subject
        });
      } else {
        console.error('[BREVO] Falha ao enviar email de boas-vindas', { error: result.error });
        await brevoEmailService.logEmailSent({
          user_id: null,
          template_id: template.id,
          sequence_id: null,
          status: 'FAILED',
          error_message: result.error,
          email_to: email,
          subject: template.subject
        });
      }
    }
    
    console.log('[BREVO] Resultado do envio de email de boas-vindas:', result);
    
    res.status(200).json({
      success: true,
      message: 'Email de boas-vindas enviado com sucesso via Brevo',
      result
    });
  } catch (error) {
    console.error('[BREVO] Erro ao enviar email de boas-vindas via Brevo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar email de boas-vindas via Brevo',
      error: error.message
    });
  }
});

// Rota para processar emails de usuários TRIAL recém-criados
app.post('/api/email/welcome-new-trial', async (req, res) => {
  console.log('[BREVO] Requisição recebida para processar email de boas-vindas para novos usuários TRIAL');
  
  try {
    // Verificar autenticação básica para esta rota sensível
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.EMAIL_API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado'
      });
    }
    
    // Buscar usuários TRIAL criados nas últimas 24 horas que ainda não receberam email
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoISOString = oneDayAgo.toISOString();
    
    console.log(`[BREVO] Buscando novos usuários TRIAL criados após ${oneDayAgoISOString}`);
    
    // Buscar usuários recém-criados com status TRIAL
    const { data: newUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('status', 'TRIAL')
      .gt('created_at', oneDayAgoISOString)
      .order('created_at', { ascending: false });
      
    if (usersError) {
      console.error('[BREVO] Erro ao buscar novos usuários:', usersError);
      throw usersError;
    }
    
    console.log(`[BREVO] Encontrados ${newUsers?.length || 0} novos usuários TRIAL`);
    
    if (!newUsers || newUsers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Nenhum novo usuário TRIAL encontrado para envio de email',
        processedCount: 0
      });
    }
    
    // Verificar quais usuários já receberam email de boas-vindas
    const userIds = newUsers.map(user => user.id);
    const { data: existingLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'SUCCESS');
      
    if (logsError) {
      console.error('[BREVO] Erro ao verificar logs de email:', logsError);
      // Continuar mesmo com erro, assumindo que nenhum usuário recebeu email
    }
    
    // Filtrar usuários que ainda não receberam emails
    const processedUserIds = existingLogs?.map(log => log.user_id) || [];
    const unprocessedUsers = newUsers.filter(user => !processedUserIds.includes(user.id));
    
    console.log(`[BREVO] ${unprocessedUsers.length} usuários ainda não receberam email de boas-vindas`);
    
    // Enviar emails para usuários não processados
    const emailResults = [];
    for (const user of unprocessedUsers) {
      try {
        console.log(`[BREVO] Enviando email de boas-vindas para usuário: ${user.id} (${user.email})`);
        const result = await brevoEmailService.sendWelcomeEmail(user.id);
        emailResults.push({
          userId: user.id,
          email: user.email,
          success: result.success,
          error: result.error
        });
      } catch (error) {
        console.error(`[BREVO] Erro ao enviar email para usuário ${user.id}:`, error);
        emailResults.push({
          userId: user.id,
          email: user.email,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = emailResults.filter(r => r.success).length;
    
    res.status(200).json({
      success: true,
      message: `Processamento de emails concluído. ${successCount} de ${unprocessedUsers.length} emails enviados com sucesso.`,
      processedCount: unprocessedUsers.length,
      successCount,
      results: emailResults
    });
  } catch (error) {
    console.error('[BREVO] Erro ao processar emails de boas-vindas para novos usuários TRIAL:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar emails de novos usuários TRIAL',
      error: error.message
    });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor de email rodando na porta ${PORT}`);
  console.log('Rotas disponíveis:');
  console.log('- /api/email/test-connection (GET)');
  console.log('- /api/email/send-welcome (POST)');
  console.log('- /api/email/send-test (POST)');
  console.log('- /api/email/process-scheduled (POST)');
  console.log('- /api/email/process-first-login (POST)');
  console.log('- /api/email/create-contact (POST)');
  console.log('- /api/email/update-contact-lists (POST)');
  console.log('- /api/sendpulse/process-sequences (POST)');
  console.log('- /api/sendpulse/send-email (POST)');
  console.log('- /api/sendpulse/send-welcome (POST)');
  console.log('- /api/email/send-brevo (POST)');
  console.log('- /api/email/send-welcome-brevo (POST)');
  console.log('- /api/email/welcome-new-trial (POST)');
}); 