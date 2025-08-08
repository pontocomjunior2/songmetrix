import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(dirname(__dirname)), '.env.production'),
  path.join(dirname(dirname(__dirname)), '.env'),
  path.join(__dirname, '.env')
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('[AdminInsightRoutes] Loaded environment variables from:', envPath);
    break;
  }
}

// Configuração do logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Required environment variables are missing: VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Middleware para verificar se o usuário é admin
 * Verifica se o uid do usuário existe na tabela public.admins
 */
export const checkAdminAuth = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user || !req.user.id) {
      logger.error('[AdminAuth] Usuário não autenticado');
      return res.status(401).json({ 
        error: 'Usuário não autenticado',
        code: 'UNAUTHENTICATED'
      });
    }

    const userId = req.user.id;
    logger.info(`[AdminAuth] Verificando permissões de admin para usuário: ${userId}`);

    // Verificar se o usuário existe na tabela admins
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', userId);

    if (adminError) {
      logger.error('[AdminAuth] Erro ao verificar admin na base de dados', {
        error: adminError.message,
        code: adminError.code
      });
      return res.status(500).json({ 
        error: 'Erro interno ao verificar permissões',
        code: 'INTERNAL_ERROR'
      });
    }

    // Verificar se o usuário é admin
    if (!adminData || adminData.length === 0) {
      logger.warn(`[AdminAuth] Acesso negado - usuário ${userId} não é admin`);
      return res.status(403).json({ 
        error: 'Acesso negado. Permissões de administrador necessárias.',
        code: 'ACCESS_DENIED'
      });
    }

    logger.info(`[AdminAuth] Acesso concedido - usuário ${userId} é admin`);
    next();

  } catch (error) {
    logger.error('[AdminAuth] Erro inesperado no middleware de admin', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Erro interno no middleware de administração',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Criar router para rotas de admin de insights
const adminInsightRouter = Router();

// Aplicar middleware de autenticação admin em todas as rotas
adminInsightRouter.use(checkAdminAuth);

/**
 * Endpoint 1: Iniciar a Geração de Insights
 * POST /api/admin/insights/generate
 */
adminInsightRouter.post('/generate', async (req, res) => {
  try {
    logger.info(`[AdminInsightRoutes] Iniciando geração de insights solicitada por admin ${req.user?.id}`);

    // Importação dos serviços JavaScript
    const { LlmService } = await import('../services/llmService.js');
    const { InsightGeneratorService } = await import('../services/insightGeneratorService.js');

    // Instanciar serviços
    const llmService = new LlmService();
    const insightGenerator = new InsightGeneratorService(llmService);

    logger.info('[AdminInsightRoutes] Serviços instanciados, iniciando processo em background');

    // Iniciar processo em background sem aguardar
    insightGenerator.generateInsightsForAllUsers()
      .then(async () => {
        logger.info('[AdminInsightRoutes] Processo de geração de insights concluído com sucesso');
        await insightGenerator.close();
      })
      .catch(async (err) => {
        logger.error('[AdminInsightRoutes] Falha no processo de geração de insights em background', {
          error: err.message,
          stack: err.stack,
          adminId: req.user?.id
        });
        await insightGenerator.close();
      });

    // Responder imediatamente com status 202 (Accepted)
    res.status(202).json({
      message: "O processo de geração de insights foi iniciado. Os rascunhos estarão disponíveis para revisão em breve.",
      status: "accepted",
      initiated_by: req.user?.id,
      initiated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[AdminInsightRoutes] Erro ao iniciar geração de insights', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao iniciar geração de insights',
      code: 'GENERATION_START_ERROR'
    });
  }
});

/**
 * Endpoint 2: Listar Rascunhos para Revisão
 * GET /api/admin/insights/drafts
 */
adminInsightRouter.get('/drafts', async (req, res) => {
  try {
    logger.info(`[AdminInsightRoutes] Buscando rascunhos de insights solicitado por admin ${req.user?.id}`);

    // Buscar rascunhos com join na tabela users
    const { data: drafts, error: draftsError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select(`
        *,
        users (
          email,
          full_name
        )
      `)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (draftsError) {
      logger.error('[AdminInsightRoutes] Erro ao buscar rascunhos', {
        error: draftsError.message,
        code: draftsError.code,
        adminId: req.user?.id
      });
      return res.status(500).json({
        error: 'Erro ao buscar rascunhos de insights',
        code: 'DRAFTS_FETCH_ERROR'
      });
    }

    logger.info(`[AdminInsightRoutes] Encontrados ${drafts?.length || 0} rascunhos`, {
      count: drafts?.length || 0,
      adminId: req.user?.id
    });

    // Retornar rascunhos com status 200
    res.status(200).json({
      drafts: drafts || [],
      count: drafts?.length || 0,
      fetched_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[AdminInsightRoutes] Erro inesperado ao buscar rascunhos', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao buscar rascunhos',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * Endpoint 3: Aprovar um E-mail
 * POST /api/admin/insights/:id/approve
 */
adminInsightRouter.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`[AdminInsightRoutes] Aprovando insight ${id} por admin ${req.user?.id}`);

    // Atualizar status para 'approved'
    const { data: updatedEmail, error: updateError } = await supabaseAdmin
      .from('generated_insight_emails')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: req.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error(`[AdminInsightRoutes] Erro ao aprovar insight ${id}`, {
        error: updateError.message,
        code: updateError.code,
        adminId: req.user?.id
      });
      return res.status(500).json({
        error: 'Erro ao aprovar insight',
        code: 'APPROVAL_ERROR'
      });
    }

    if (!updatedEmail) {
      logger.warn(`[AdminInsightRoutes] Insight ${id} não encontrado para aprovação`);
      return res.status(404).json({
        error: 'Insight não encontrado',
        code: 'INSIGHT_NOT_FOUND'
      });
    }

    logger.info(`[AdminInsightRoutes] Insight ${id} aprovado com sucesso por admin ${req.user?.id}`);

    // Retornar registro atualizado com status 200
    res.status(200).json({
      message: 'Insight aprovado com sucesso',
      insight: updatedEmail,
      approved_by: req.user?.id,
      approved_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[AdminInsightRoutes] Erro inesperado ao aprovar insight ${req.params.id}`, {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao aprovar insight',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * Endpoint 4: Enviar um E-mail Aprovado
 * POST /api/admin/insights/:id/send
 */
adminInsightRouter.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`[AdminInsightRoutes] Enviando insight ${id} solicitado por admin ${req.user?.id}`);

    // Primeiro, buscar o e-mail no banco de dados
    const { data: emailData, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select(`
        *,
        users (
          email,
          full_name
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !emailData) {
      logger.warn(`[AdminInsightRoutes] Insight ${id} não encontrado para envio`, {
        error: fetchError?.message,
        adminId: req.user?.id
      });
      return res.status(404).json({
        error: 'Insight não encontrado',
        code: 'INSIGHT_NOT_FOUND'
      });
    }

    // Verificar se o status é 'approved'
    if (emailData.status !== 'approved') {
      logger.warn(`[AdminInsightRoutes] Tentativa de envio de insight ${id} com status ${emailData.status}`, {
        currentStatus: emailData.status,
        adminId: req.user?.id
      });
      return res.status(400).json({
        error: 'Apenas insights aprovados podem ser enviados',
        code: 'INVALID_STATUS',
        current_status: emailData.status
      });
    }

    // Importar e usar o serviço de e-mail SMTP existente
    try {
      // Importação dinâmica do serviço SMTP
      const { sendEmail } = await import('../smtp-email-service.js');
      
      logger.info(`[AdminInsightRoutes] Enviando e-mail para ${emailData.users?.email}`, {
        recipient: emailData.users?.email,
        subject: emailData.subject,
        insightId: id
      });

      // Enviar e-mail
      const emailResult = await sendEmail({
        to: emailData.users?.email,
        subject: emailData.subject,
        html: emailData.content,
        user_id: emailData.user_id,
        email_type: 'insight',
        insight_id: id
      });

      if (emailResult.success) {
        // Atualizar status para 'sent'
        const { data: sentEmail, error: sentError } = await supabaseAdmin
          .from('generated_insight_emails')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_by: req.user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (sentError) {
          logger.error(`[AdminInsightRoutes] Erro ao atualizar status após envio do insight ${id}`, {
            error: sentError.message,
            adminId: req.user?.id
          });
          // Não retornar erro aqui pois o e-mail foi enviado com sucesso
        }

        logger.info(`[AdminInsightRoutes] Insight ${id} enviado com sucesso para ${emailData.users?.email}`, {
          recipient: emailData.users?.email,
          adminId: req.user?.id
        });

        res.status(200).json({
          message: 'E-mail enviado com sucesso',
          insight: sentEmail || emailData,
          recipient: emailData.users?.email,
          sent_by: req.user?.id,
          sent_at: new Date().toISOString()
        });

      } else {
        // Falha no envio
        logger.error(`[AdminInsightRoutes] Falha no envio do insight ${id}`, {
          error: emailResult.error,
          recipient: emailData.users?.email,
          adminId: req.user?.id
        });

        // Atualizar status para 'failed'
        await supabaseAdmin
          .from('generated_insight_emails')
          .update({ 
            status: 'failed',
            error_message: emailResult.error,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        res.status(500).json({
          error: 'Falha no envio do e-mail',
          code: 'EMAIL_SEND_ERROR',
          details: emailResult.error
        });
      }

    } catch (emailServiceError) {
      logger.error(`[AdminInsightRoutes] Erro no serviço de e-mail para insight ${id}`, {
        error: emailServiceError.message,
        stack: emailServiceError.stack,
        adminId: req.user?.id
      });

      res.status(500).json({
        error: 'Erro no serviço de e-mail',
        code: 'EMAIL_SERVICE_ERROR'
      });
    }

  } catch (error) {
    logger.error(`[AdminInsightRoutes] Erro inesperado ao enviar insight ${req.params.id}`, {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao enviar insight',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default adminInsightRouter;