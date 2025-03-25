// server-email.js - Servidor dedicado para o serviço de email
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Importar o novo serviço de email do Brevo
import emailService from './server/brevo-email-service.js';
import { createClient } from '@supabase/supabase-js';
import { logEmail, logError, logInfo, logDebug } from './server/logger.js';

// Obter o diretório atual em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.EMAIL_SERVER_PORT || 3002; // Porta específica para o servidor de email

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
app.post('/api/email/send-test', isAuthenticated, async (req, res) => {
  console.log('[EMAIL-TEST] Requisição recebida para /api/email/send-test');
  console.log('[EMAIL-TEST] Headers:', JSON.stringify(req.headers));
  console.log('[EMAIL-TEST] Body:', JSON.stringify(req.body));
  
  try {
    const { email, templateId } = req.body;
    
    console.log(`[EMAIL-TEST] Dados da requisição: email=${email}, templateId=${templateId}`);
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email de destinatário não fornecido' 
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
}); 