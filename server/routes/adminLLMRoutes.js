import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

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
    console.log('[AdminLLMRoutes] Loaded environment variables from:', envPath);
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
 */
export const checkAdminAuth = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user || !req.user.id) {
      logger.error('[AdminLLMAuth] Usuário não autenticado');
      return res.status(401).json({ 
        error: 'Usuário não autenticado',
        code: 'UNAUTHENTICATED'
      });
    }

    const userId = req.user.id;
    logger.info(`[AdminLLMAuth] Verificando permissões de admin para usuário: ${userId}`);

    // Verificar se o usuário existe na tabela admins
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', userId);

    if (adminError) {
      logger.error('[AdminLLMAuth] Erro ao verificar admin na base de dados', {
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
      logger.warn(`[AdminLLMAuth] Acesso negado - usuário ${userId} não é admin`);
      return res.status(403).json({ 
        error: 'Acesso negado. Permissões de administrador necessárias.',
        code: 'ACCESS_DENIED'
      });
    }

    logger.info(`[AdminLLMAuth] Acesso concedido - usuário ${userId} é admin`);
    next();

  } catch (error) {
    logger.error('[AdminLLMAuth] Erro inesperado no middleware de admin', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Erro interno no middleware de administração',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Criar router para rotas de admin de LLM
const adminLLMRouter = Router();

// Aplicar middleware de autenticação admin em todas as rotas
adminLLMRouter.use(checkAdminAuth);

/**
 * GET /api/admin/llm-settings
 * Listar todos os provedores LLM
 */
adminLLMRouter.get('/', async (req, res) => {
  try {
    logger.info(`[AdminLLMRoutes] Listando provedores LLM solicitado por admin ${req.user?.id}`);

    const { data: providers, error } = await supabaseAdmin
      .from('llm_provider_settings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[AdminLLMRoutes] Erro ao buscar provedores LLM', {
        error: error.message,
        code: error.code,
        adminId: req.user?.id
      });
      return res.status(500).json({
        error: 'Erro ao buscar provedores LLM',
        code: 'PROVIDERS_FETCH_ERROR'
      });
    }

    logger.info(`[AdminLLMRoutes] Encontrados ${providers?.length || 0} provedores`, {
      count: providers?.length || 0,
      adminId: req.user?.id
    });

    res.status(200).json(providers || []);

  } catch (error) {
    logger.error('[AdminLLMRoutes] Erro inesperado ao buscar provedores', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao buscar provedores',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/admin/llm-settings
 * Criar novo provedor LLM
 */
adminLLMRouter.post('/', async (req, res) => {
  try {
    const { provider_name, api_key, api_url, model_name, max_tokens, temperature, is_active } = req.body;

    logger.info(`[AdminLLMRoutes] Criando novo provedor LLM por admin ${req.user?.id}`, {
      provider_name,
      model_name,
      is_active
    });

    // Validar campos obrigatórios
    if (!provider_name || !api_key || !api_url || !model_name) {
      return res.status(400).json({
        error: 'Campos obrigatórios: provider_name, api_key, api_url, model_name',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Se este provedor está sendo marcado como ativo, desativar todos os outros
    if (is_active) {
      const { error: deactivateError } = await supabaseAdmin
        .from('llm_provider_settings')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

      if (deactivateError) {
        logger.error('[AdminLLMRoutes] Erro ao desativar outros provedores', {
          error: deactivateError.message,
          adminId: req.user?.id
        });
      }
    }

    // Criar novo provedor
    const { data: newProvider, error: createError } = await supabaseAdmin
      .from('llm_provider_settings')
      .insert({
        provider_name,
        api_key,
        api_url,
        model_name,
        max_tokens: max_tokens || 1000,
        temperature: temperature || 0.7,
        is_active: is_active || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      logger.error('[AdminLLMRoutes] Erro ao criar provedor LLM', {
        error: createError.message,
        code: createError.code,
        adminId: req.user?.id
      });
      return res.status(500).json({
        error: 'Erro ao criar provedor LLM',
        code: 'PROVIDER_CREATE_ERROR'
      });
    }

    logger.info(`[AdminLLMRoutes] Provedor LLM criado com sucesso`, {
      providerId: newProvider.id,
      provider_name,
      adminId: req.user?.id
    });

    res.status(201).json(newProvider);

  } catch (error) {
    logger.error('[AdminLLMRoutes] Erro inesperado ao criar provedor', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao criar provedor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/admin/llm-settings/:id
 * Atualizar provedor LLM existente
 */
adminLLMRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider_name, api_key, api_url, model_name, max_tokens, temperature, is_active } = req.body;

    logger.info(`[AdminLLMRoutes] Atualizando provedor LLM ${id} por admin ${req.user?.id}`);

    // Se este provedor está sendo marcado como ativo, desativar todos os outros
    if (is_active) {
      const { error: deactivateError } = await supabaseAdmin
        .from('llm_provider_settings')
        .update({ is_active: false })
        .neq('id', id);

      if (deactivateError) {
        logger.error('[AdminLLMRoutes] Erro ao desativar outros provedores', {
          error: deactivateError.message,
          adminId: req.user?.id
        });
      }
    }

    // Atualizar provedor
    const { data: updatedProvider, error: updateError } = await supabaseAdmin
      .from('llm_provider_settings')
      .update({
        provider_name,
        api_key,
        api_url,
        model_name,
        max_tokens,
        temperature,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error(`[AdminLLMRoutes] Erro ao atualizar provedor LLM ${id}`, {
        error: updateError.message,
        code: updateError.code,
        adminId: req.user?.id
      });
      return res.status(500).json({
        error: 'Erro ao atualizar provedor LLM',
        code: 'PROVIDER_UPDATE_ERROR'
      });
    }

    if (!updatedProvider) {
      logger.warn(`[AdminLLMRoutes] Provedor LLM ${id} não encontrado`);
      return res.status(404).json({
        error: 'Provedor não encontrado',
        code: 'PROVIDER_NOT_FOUND'
      });
    }

    logger.info(`[AdminLLMRoutes] Provedor LLM ${id} atualizado com sucesso por admin ${req.user?.id}`);

    res.status(200).json(updatedProvider);

  } catch (error) {
    logger.error(`[AdminLLMRoutes] Erro inesperado ao atualizar provedor ${req.params.id}`, {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao atualizar provedor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/admin/llm-settings/:id
 * Excluir provedor LLM
 */
adminLLMRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`[AdminLLMRoutes] Excluindo provedor LLM ${id} por admin ${req.user?.id}`);

    // Verificar se o provedor existe
    const { data: existingProvider, error: fetchError } = await supabaseAdmin
      .from('llm_provider_settings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingProvider) {
      logger.warn(`[AdminLLMRoutes] Provedor LLM ${id} não encontrado para exclusão`);
      return res.status(404).json({
        error: 'Provedor não encontrado',
        code: 'PROVIDER_NOT_FOUND'
      });
    }

    // Excluir provedor
    const { error: deleteError } = await supabaseAdmin
      .from('llm_provider_settings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error(`[AdminLLMRoutes] Erro ao excluir provedor LLM ${id}`, {
        error: deleteError.message,
        code: deleteError.code,
        adminId: req.user?.id
      });
      return res.status(500).json({
        error: 'Erro ao excluir provedor LLM',
        code: 'PROVIDER_DELETE_ERROR'
      });
    }

    logger.info(`[AdminLLMRoutes] Provedor LLM ${id} excluído com sucesso por admin ${req.user?.id}`);

    res.status(200).json({
      message: 'Provedor excluído com sucesso',
      deleted_provider: existingProvider
    });

  } catch (error) {
    logger.error(`[AdminLLMRoutes] Erro inesperado ao excluir provedor ${req.params.id}`, {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao excluir provedor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/admin/llm-settings/test-connection
 * Testar conexão e buscar modelos disponíveis
 */
adminLLMRouter.post('/test-connection', async (req, res) => {
  try {
    const { provider_name, api_key, api_url } = req.body;

    logger.info(`[AdminLLMRoutes] Testando conexão com ${provider_name} por admin ${req.user?.id}`);

    if (!provider_name || !api_key) {
      return res.status(400).json({
        error: 'Provedor e chave de API são obrigatórios',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    let models = [];

    try {
      switch (provider_name.toLowerCase()) {
        case 'openai':
          models = await fetchOpenAIModels(api_key);
          break;
        case 'anthropic':
          models = await fetchAnthropicModels(api_key);
          break;
        case 'google':
          models = await fetchGoogleModels(api_key);
          break;
        case 'cohere':
          models = await fetchCohereModels(api_key);
          break;
        default:
          return res.status(400).json({
            error: `Provedor ${provider_name} não suportado`,
            code: 'UNSUPPORTED_PROVIDER'
          });
      }

      logger.info(`[AdminLLMRoutes] Encontrados ${models.length} modelos para ${provider_name}`, {
        provider: provider_name,
        modelCount: models.length,
        adminId: req.user?.id
      });

      res.status(200).json({
        success: true,
        provider: provider_name,
        models: models,
        count: models.length
      });

    } catch (apiError) {
      logger.error(`[AdminLLMRoutes] Erro ao conectar com ${provider_name}`, {
        error: apiError.message,
        provider: provider_name,
        adminId: req.user?.id
      });

      res.status(400).json({
        error: `Erro ao conectar com ${provider_name}: ${apiError.message}`,
        code: 'CONNECTION_FAILED'
      });
    }

  } catch (error) {
    logger.error('[AdminLLMRoutes] Erro inesperado ao testar conexão', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });

    res.status(500).json({
      error: 'Erro interno ao testar conexão',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Funções auxiliares para buscar modelos de cada provedor
async function fetchOpenAIModels(apiKey) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Filtrar apenas modelos de chat/completions
  const chatModels = data.data
    .filter(model => 
      model.id.includes('gpt') || 
      model.id.includes('text-davinci') ||
      model.id.includes('text-curie')
    )
    .map(model => model.id)
    .sort();

  return chatModels;
}

async function fetchAnthropicModels(apiKey) {
  // Anthropic não tem endpoint público para listar modelos
  // Retornar modelos conhecidos
  return [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2'
  ];
}

async function fetchGoogleModels(apiKey) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    const models = data.models
      ?.filter(model => model.name.includes('gemini'))
      ?.map(model => model.name.replace('models/', ''))
      ?.sort() || [];

    return models;
  } catch (error) {
    // Fallback para modelos conhecidos
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro',
      'gemini-pro-vision'
    ];
  }
}

async function fetchCohereModels(apiKey) {
  // Cohere não tem endpoint público para listar modelos
  // Retornar modelos conhecidos
  return [
    'command-r-plus',
    'command-r',
    'command',
    'command-nightly',
    'command-light',
    'command-light-nightly'
  ];
}

export default adminLLMRouter;