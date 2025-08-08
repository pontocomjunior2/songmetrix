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
    console.log('[DEBUG] Middleware checkAdminAuth executado');
    
    // Verificar se o usuário está autenticado
    if (!req.user || !req.user.id) {
      console.log('[DEBUG] Usuário não autenticado');
      return res.status(401).json({ 
        error: 'Usuário não autenticado',
        code: 'UNAUTHENTICATED'
      });
    }

    const userId = req.user.id;
    console.log(`[DEBUG] Verificando admin para usuário: ${userId}`);

    // Verificar se o usuário existe na tabela admins
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', userId);

    if (adminError) {
      console.error('[DEBUG] Erro ao verificar admin:', adminError);
      return res.status(500).json({ 
        error: 'Erro interno ao verificar permissões',
        code: 'INTERNAL_ERROR',
        details: adminError.message
      });
    }

    // Verificar se o usuário é admin
    if (!adminData || adminData.length === 0) {
      console.log(`[DEBUG] Usuário ${userId} não é admin`);
      return res.status(403).json({ 
        error: 'Acesso negado. Permissões de administrador necessárias.',
        code: 'ACCESS_DENIED'
      });
    }

    console.log(`[DEBUG] Usuário ${userId} é admin - acesso concedido`);
    next();

  } catch (error) {
    console.error('[DEBUG] Erro no middleware:', error);
    return res.status(500).json({ 
      error: 'Erro interno no middleware de administração',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
};

// Criar router para rotas de admin de insights
const adminInsightRouter = Router();

// Middleware para validar UUID nos parâmetros
const validateUUID = (req, res, next) => {
  const { id } = req.params;
  if (id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'ID inválido. Deve ser um UUID válido.',
        code: 'INVALID_UUID'
      });
    }
  }
  next();
};

// Rota de teste sem middleware
adminInsightRouter.get('/test', (req, res) => {
  res.json({ message: 'Rota de teste funcionando', timestamp: new Date().toISOString() });
});

// Middleware já aplicado no servidor principal (authenticateBasicUser)
// adminInsightRouter.use(checkAdminAuth);

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
/**
 * Rota para aprovar um insight
 */
adminInsightRouter.post('/:id/approve', validateUUID, async (req, res) => {
  const { id } = req.params;

  try {
    logger.info(`[AdminInsightRoutes] Aprovando insight ${id} por admin ${req.user?.id}`);

    // Verificar se o insight existe primeiro
    const { data: existingInsight, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingInsight) {
      logger.warn(`[AdminInsightRoutes] Insight ${id} não encontrado`, { error: fetchError?.message });
      return res.status(404).json({
        error: 'Insight não encontrado',
        code: 'INSIGHT_NOT_FOUND'
      });
    }

    // Verificar se já está aprovado
    if (existingInsight.status === 'approved') {
      logger.info(`[AdminInsightRoutes] Insight ${id} já estava aprovado`);
      return res.json({
        message: 'Insight já estava aprovado',
        insight: existingInsight,
        status: 'already_approved'
      });
    }

    // Atualizar status para 'approved'
    const { data: updatedInsight, error: updateError } = await supabaseAdmin
      .from('generated_insight_emails')
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error(`[AdminInsightRoutes] Erro ao aprovar insight ${id}`, { 
        error: updateError.message,
        code: updateError.code 
      });
      return res.status(500).json({
        error: 'Erro ao aprovar insight',
        code: 'UPDATE_ERROR',
        details: updateError.message
      });
    }

    logger.info(`[AdminInsightRoutes] Insight ${id} aprovado com sucesso`);

    res.json({
      message: 'Insight aprovado com sucesso',
      insight: updatedInsight,
      status: 'approved'
    });

  } catch (error) {
    logger.error(`[AdminInsightRoutes] Erro inesperado ao aprovar insight ${id}`, {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * Endpoint 4: Gerar Insight Personalizado
 * POST /api/admin/insights/generate-custom
 */
adminInsightRouter.post('/generate-custom', async (req, res) => {
  try {
    const { targetType, targetId, subject, customPrompt, variables } = req.body;

    logger.info(`[AdminInsightRoutes] Gerando insight personalizado por admin ${req.user?.id}`, {
      targetType,
      targetId,
      subject: subject?.substring(0, 50) + '...',
      variablesCount: variables?.length || 0
    });

    // Validar campos obrigatórios
    if (!targetType || !targetId || !subject || !customPrompt) {
      return res.status(400).json({
        error: 'Campos obrigatórios: targetType, targetId, subject, customPrompt',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Importar serviços
    const { LlmService } = await import('../services/llmService.js');
    const { InsightGeneratorService } = await import('../services/insightGeneratorService.js');

    const llmService = new LlmService();
    const insightGenerator = new InsightGeneratorService(llmService);

    // Buscar usuários baseado no tipo de target
    let targetUsers = [];
    
    if (targetType === 'user') {
      // Buscar usuário específico
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', targetId)
        .single();

      if (userError || !user) {
        logger.warn(`[AdminInsightRoutes] Usuário ${targetId} não encontrado`);
        return res.status(404).json({
          error: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        });
      }

      targetUsers = [user];
    } else if (targetType === 'group') {
      // Buscar usuários do grupo
      let query = supabaseAdmin.from('users').select('*');
      
      if (targetId !== 'all') {
        query = query.eq('status', targetId.toUpperCase());
      }
      
      const { data: users, error: usersError } = await query;
      
      if (usersError) {
        logger.error('[AdminInsightRoutes] Erro ao buscar usuários do grupo', {
          error: usersError.message,
          group: targetId
        });
        return res.status(500).json({
          error: 'Erro ao buscar usuários do grupo',
          code: 'GROUP_FETCH_ERROR'
        });
      }

      targetUsers = users || [];
    }

    if (targetUsers.length === 0) {
      return res.status(400).json({
        error: 'Nenhum usuário encontrado para o target especificado',
        code: 'NO_USERS_FOUND'
      });
    }

    logger.info(`[AdminInsightRoutes] Processando ${targetUsers.length} usuários para insight personalizado`);

    // Processar cada usuário em background
    const processUsers = async () => {
      for (const user of targetUsers) {
        try {
          logger.info(`[AdminInsightRoutes] Processando usuário ${user.id} (${user.email})`);

          // Gerar dados realistas baseados nos dados reais das rádios
          logger.info(`[AdminInsightRoutes] Gerando dados realistas para usuário ${user.email}`);
          const realisticUserData = await insightGenerator.generateRealisticUserData(user.id);
          
          // Usar dados realistas gerados
          const userData = {
            topSong: realisticUserData.topSong || { title: 'Nenhuma música registrada', artist: 'Artista desconhecido' },
            topArtist: realisticUserData.topArtist || { name: 'Nenhum artista registrado' },
            totalPlays: realisticUserData.totalPlays || 0,
            weeklyPlays: realisticUserData.weeklyPlays || 0,
            monthlyPlays: realisticUserData.monthlyPlays || 0,
            growthRate: realisticUserData.growthRate || '0%',
            favoriteGenre: realisticUserData.favoriteGenre || 'Variado',
            listeningHours: realisticUserData.listeningHours || 0,
            discoveryCount: realisticUserData.discoveryCount || 0,
            peakHour: realisticUserData.peakHour || 'N/A',
            weekendVsWeekday: realisticUserData.weekendVsWeekday || 'Padrão não identificado',
            moodAnalysis: realisticUserData.moodAnalysis || 'Eclético'
          };

          logger.info(`[AdminInsightRoutes] Dados realistas gerados para usuário ${user.email}`, {
            topSong: userData.topSong?.title,
            topArtist: userData.topArtist?.name,
            totalPlays: userData.totalPlays,
            weeklyPlays: userData.weeklyPlays,
            hasRealisticData: userData.totalPlays > 0
          });
          
          // Substituir variáveis no prompt com dados reais
          let processedPrompt = customPrompt
            .replace(/\{user_name\}/g, user.full_name || user.email)
            .replace(/\{user_email\}/g, user.email)
            .replace(/\{top_song\}/g, userData.topSong?.title || 'Nenhuma música registrada')
            .replace(/\{top_artist\}/g, userData.topArtist?.name || 'Nenhum artista registrado')
            .replace(/\{total_plays\}/g, userData.totalPlays.toString())
            .replace(/\{weekly_plays\}/g, userData.weeklyPlays.toString())
            .replace(/\{monthly_plays\}/g, userData.monthlyPlays.toString())
            .replace(/\{growth_rate\}/g, userData.growthRate)
            .replace(/\{favorite_genre\}/g, userData.favoriteGenre)
            .replace(/\{listening_hours\}/g, userData.listeningHours.toString())
            .replace(/\{discovery_count\}/g, userData.discoveryCount.toString())
            .replace(/\{peak_hour\}/g, userData.peakHour)
            .replace(/\{weekend_vs_weekday\}/g, userData.weekendVsWeekday)
            .replace(/\{mood_analysis\}/g, userData.moodAnalysis);

          logger.info(`[AdminInsightRoutes] Prompt processado com dados reais para usuário ${user.id}`);

          // Criar HTML formatado
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #2563eb; margin: 0; font-size: 24px;">🎵 SongMetrix</h1>
                  <p style="color: #6b7280; margin: 5px 0 0 0;">Seu Insight Musical Personalizado</p>
                </div>
                
                <div style="line-height: 1.6; color: #374151; white-space: pre-line;">
                  ${processedPrompt}
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">
                    Gerado automaticamente pelo SongMetrix<br>
                    <a href="${process.env.VITE_APP_URL || 'https://songmetrix.com.br'}/dashboard" style="color: #2563eb; text-decoration: none;">Acesse seu dashboard</a>
                  </p>
                </div>
              </div>
            </div>
          `.trim();
          
          // Salvar no banco como draft com dados reais
          const { error: insertError } = await supabaseAdmin
            .from('generated_insight_emails')
            .insert({
              user_id: user.id,
              insight_type: 'custom_insight',
              subject: subject,
              body_html: htmlContent,
              content: htmlContent,
              status: 'draft',
              insight_data: userData, // Usar dados reais em vez de basicUserData
              deep_link: `${process.env.VITE_APP_URL || 'https://songmetrix.com.br'}/dashboard`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            logger.error(`[AdminInsightRoutes] Erro ao salvar insight para usuário ${user.id}`, {
              error: insertError.message,
              userId: user.id
            });
          } else {
            logger.info(`[AdminInsightRoutes] Insight personalizado salvo com sucesso para usuário ${user.email}`);
          }

        } catch (userError) {
          logger.error(`[AdminInsightRoutes] Erro ao processar usuário ${user.id}`, {
            error: userError.message,
            stack: userError.stack,
            userId: user.id
          });
        }
      }
    };

    // Executar processamento imediatamente (não em background)
    try {
      await processUsers();
      
      // Responder após processamento completo
      res.status(200).json({
        message: 'Insight personalizado gerado com sucesso',
        status: 'success',
        targetUsers: targetUsers.length,
        processed: true,
        initiated_by: req.user?.id,
        completed_at: new Date().toISOString()
      });
    } catch (processError) {
      logger.error('[AdminInsightRoutes] Erro no processamento de insights', {
        error: processError.message,
        stack: processError.stack
      });
      
      res.status(500).json({
        error: 'Erro ao processar insights personalizados',
        code: 'PROCESSING_ERROR',
        details: processError.message
      });
    }

  } catch (error) {
    logger.error('[AdminInsightRoutes] Erro ao gerar insight personalizado', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao gerar insight personalizado',
      code: 'CUSTOM_GENERATION_ERROR'
    });
  }
});

/**
 * Função auxiliar para substituir variáveis no prompt
 */
async function replaceVariablesInPrompt(prompt, userData, user) {
  let processedPrompt = prompt;
  
  // Mapeamento de variáveis para dados
  const variableMap = {
    user_name: user.full_name || user.email,
    user_email: user.email,
    top_song: userData.topSong?.title || 'N/A',
    top_artist: userData.topArtist?.name || 'N/A',
    total_plays: userData.totalPlays || 0,
    weekly_plays: userData.weeklyPlays || 0,
    monthly_plays: userData.monthlyPlays || 0,
    growth_rate: userData.growthRate || '0%',
    favorite_genre: userData.favoriteGenre || 'N/A',
    listening_hours: userData.listeningHours || 0,
    discovery_count: userData.discoveryCount || 0,
    peak_hour: userData.peakHour || 'N/A',
    weekend_vs_weekday: userData.weekendVsWeekday || 'N/A',
    mood_analysis: userData.moodAnalysis || 'N/A'
  };

  // Substituir cada variável
  for (const [key, value] of Object.entries(variableMap)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    processedPrompt = processedPrompt.replace(regex, value);
  }

  return processedPrompt;
}

/**
 * Endpoint 5: Enviar um E-mail Aprovado
 * POST /api/admin/insights/:id/send
 */
/**
 * Rota para enviar um insight por e-mail
 */
adminInsightRouter.post('/:id/send', validateUUID, async (req, res) => {
  const { id } = req.params;

  try {
    logger.info(`[AdminInsightRoutes] Enviando insight ${id} por admin ${req.user?.id}`);

    // Buscar o insight com dados do usuário
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
      logger.warn(`[AdminInsightRoutes] Insight ${id} não encontrado para envio`, { error: fetchError?.message });
      return res.status(404).json({
        error: 'Insight não encontrado',
        code: 'INSIGHT_NOT_FOUND'
      });
    }

    // Verificar se o usuário tem e-mail
    if (!emailData.users?.email) {
      logger.error(`[AdminInsightRoutes] Usuário do insight ${id} não tem e-mail válido`);
      return res.status(400).json({
        error: 'Usuário não possui e-mail válido',
        code: 'INVALID_EMAIL'
      });
    }

    // Auto-aprovar se necessário
    if (emailData.status === 'draft') {
      logger.info(`[AdminInsightRoutes] Auto-aprovando insight ${id} antes do envio`);
      const { error: approveError } = await supabaseAdmin
        .from('generated_insight_emails')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (approveError) {
        logger.error(`[AdminInsightRoutes] Erro ao auto-aprovar insight ${id}`, { error: approveError.message });
        return res.status(500).json({
          error: 'Erro ao aprovar insight antes do envio',
          code: 'AUTO_APPROVE_ERROR'
        });
      }
    }

    // Verificar se pode enviar
    if (emailData.status !== 'approved' && emailData.status !== 'draft') {
      logger.warn(`[AdminInsightRoutes] Tentativa de envio de insight ${id} com status inválido: ${emailData.status}`);
      return res.status(400).json({
        error: 'Apenas insights aprovados podem ser enviados',
        current_status: emailData.status,
        code: 'INVALID_STATUS'
      });
    }

    // Verificar se já foi enviado
    if (emailData.status === 'sent') {
      logger.info(`[AdminInsightRoutes] Insight ${id} já foi enviado anteriormente`);
      return res.json({
        message: 'E-mail já foi enviado anteriormente',
        recipient: emailData.users?.email,
        status: 'already_sent'
      });
    }

    // Importar serviço de e-mail
    const { sendEmail } = await import('../smtp-email-service.js');

    logger.info(`[AdminInsightRoutes] Enviando e-mail para ${emailData.users.email}`);

    // Enviar e-mail
    const emailResult = await sendEmail({
      to: emailData.users.email,
      subject: emailData.subject,
      html: emailData.body_html || emailData.content || '<p>Conteúdo não disponível</p>',
      user_id: emailData.user_id,
      email_type: 'insight',
      insight_id: id
    });

    if (emailResult.success) {
      // Atualizar status para 'sent'
      const { error: updateError } = await supabaseAdmin
        .from('generated_insight_emails')
        .update({ 
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        logger.error(`[AdminInsightRoutes] Erro ao atualizar status para 'sent' do insight ${id}`, { error: updateError.message });
      }

      logger.info(`[AdminInsightRoutes] E-mail enviado com sucesso para ${emailData.users.email}`);

      res.json({
        message: 'E-mail enviado com sucesso',
        recipient: emailData.users.email,
        status: 'sent'
      });

    } else {
      // Marcar como falha
      const { error: failError } = await supabaseAdmin
        .from('generated_insight_emails')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (failError) {
        logger.error(`[AdminInsightRoutes] Erro ao atualizar status para 'failed' do insight ${id}`, { error: failError.message });
      }

      logger.error(`[AdminInsightRoutes] Falha no envio do e-mail para insight ${id}`, { 
        error: emailResult.error,
        recipient: emailData.users.email 
      });

      res.status(500).json({
        error: 'Falha no envio do e-mail',
        details: emailResult.error,
        code: 'EMAIL_SEND_ERROR'
      });
    }

  } catch (error) {
    logger.error(`[AdminInsightRoutes] Erro inesperado ao enviar insight ${id}`, {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default adminInsightRouter;