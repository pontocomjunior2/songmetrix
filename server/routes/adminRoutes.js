import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
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

    break;
  }
}

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
      console.error('[AdminAuth] Usuário não autenticado');
      return res.status(401).json({ 
        error: 'Usuário não autenticado',
        code: 'UNAUTHENTICATED'
      });
    }

    const userId = req.user.id;


    // Verificar se o usuário existe na tabela admins
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', userId);

    if (adminError) {
      console.error('[AdminAuth] Erro ao verificar admin na base de dados:', adminError);
      return res.status(500).json({ 
        error: 'Erro interno ao verificar permissões',
        code: 'INTERNAL_ERROR'
      });
    }

    // Verificar se o usuário é admin
    if (!adminData || adminData.length === 0) {
      console.log(`[AdminAuth] Acesso negado - usuário ${userId} não é admin`);
      return res.status(403).json({ 
        error: 'Acesso negado. Permissões de administrador necessárias.',
        code: 'ACCESS_DENIED'
      });
    }


    next();

  } catch (error) {
    console.error('[AdminAuth] Erro inesperado no middleware de admin:', error);
    return res.status(500).json({ 
      error: 'Erro interno no middleware de administração',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Criar router para rotas de admin
const adminRouter = Router();

/**
 * Rota para gerenciar emails de insights
 * GET /admin/insight-emails - Listar emails de insights
 * POST /admin/insight-emails - Criar novo email de insight
 * PUT /admin/insight-emails/:id - Atualizar email de insight
 * DELETE /admin/insight-emails/:id - Deletar email de insight
 */
adminRouter.get('/insight-emails', checkAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('generated_insight_emails')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: emails, error, count } = await query;

    if (error) {
      console.error('[AdminRoutes] Erro ao buscar emails de insights:', error);
      return res.status(500).json({ error: 'Erro ao buscar emails de insights' });
    }

    res.json({ 
      emails,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao buscar emails:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.post('/insight-emails', checkAdminAuth, async (req, res) => {
  try {
    const { user_id, insight_type, email_subject, email_content, metrics } = req.body;

    if (!user_id || !insight_type || !email_subject || !email_content) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: user_id, insight_type, email_subject, email_content' 
      });
    }

    const { data: newEmail, error } = await supabaseAdmin
      .from('generated_insight_emails')
      .insert({
        user_id,
        insight_type,
        email_subject,
        email_content,
        metrics: metrics || {},
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[AdminRoutes] Erro ao criar email de insight:', error);
      return res.status(500).json({ error: 'Erro ao criar email de insight' });
    }

    console.log(`[AdminRoutes] Email de insight criado por admin ${req.user.id}:`, newEmail.id);
    res.status(201).json({ email: newEmail });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao criar email:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.put('/insight-emails/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, email_subject, email_content, metrics } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (status) updateData.status = status;
    if (email_subject) updateData.email_subject = email_subject;
    if (email_content) updateData.email_content = email_content;
    if (metrics) updateData.metrics = metrics;

    const { data: updatedEmail, error } = await supabaseAdmin
      .from('generated_insight_emails')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[AdminRoutes] Erro ao atualizar email de insight:', error);
      return res.status(500).json({ error: 'Erro ao atualizar email de insight' });
    }

    console.log(`[AdminRoutes] Email de insight ${id} atualizado por admin ${req.user.id}`);
    res.json({ email: updatedEmail });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao atualizar email:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.delete('/insight-emails/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('generated_insight_emails')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[AdminRoutes] Erro ao deletar email de insight:', error);
      return res.status(500).json({ error: 'Erro ao deletar email de insight' });
    }

    console.log(`[AdminRoutes] Email de insight ${id} deletado por admin ${req.user.id}`);
    res.json({ message: 'Email de insight deletado com sucesso' });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao deletar email:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// LLM settings routes have been moved to adminLLMRoutes.js
// This avoids route conflicts and keeps LLM functionality centralized

/**
 * Rota para gerenciar usuários (admin)
 * GET /admin/users - Listar usuários
 * PUT /admin/users/:id/status - Atualizar status do usuário
 */
adminRouter.get('/users', checkAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', status = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('users')
      .select('id, email, status, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (search) {
      query = query.ilike('email', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('[AdminRoutes] Erro ao buscar usuários:', error);
      return res.status(500).json({ error: 'Erro ao buscar usuários' });
    }

    res.json({ 
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.put('/users/:id/status', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['ADMIN', 'ATIVO', 'TRIAL', 'FREE', 'INATIVO'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Status inválido. Valores permitidos: ${validStatuses.join(', ')}` 
      });
    }

    // Atualizar na tabela users
    const { data: updatedUser, error: dbError } = await supabaseAdmin
      .from('users')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError) {
      console.error('[AdminRoutes] Erro ao atualizar usuário no banco:', dbError);
      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }

    // Atualizar nos metadados do Auth
    try {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { status }
      });

      if (authError) {
        console.error('[AdminRoutes] Erro ao atualizar metadados do usuário:', authError);
      }
    } catch (authError) {
      console.error('[AdminRoutes] Erro ao atualizar auth metadata:', authError);
    }

    console.log(`[AdminRoutes] Status do usuário ${id} atualizado para ${status} por admin ${req.user?.id}`);

    res.json({ 
      message: 'Status do usuário atualizado com sucesso',
      user: updatedUser 
    });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao atualizar status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota para estatísticas do sistema (admin)
 * GET /admin/stats - Obter estatísticas gerais
 */
adminRouter.get('/stats', checkAdminAuth, async (req, res) => {
  try {
    // Buscar estatísticas básicas
    const [usersResult, emailsResult, adminsResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('status', { count: 'exact' }),
      supabaseAdmin
        .from('generated_insight_emails')
        .select('status', { count: 'exact' }),
      supabaseAdmin
        .from('admins')
        .select('user_id', { count: 'exact' })
    ]);

    const usersByStatus = {};
    if (usersResult.data) {
      usersResult.data.forEach(user => {
        usersByStatus[user.status] = (usersByStatus[user.status] || 0) + 1;
      });
    }

    const emailsByStatus = {};
    if (emailsResult.data) {
      emailsResult.data.forEach(email => {
        emailsByStatus[email.status] = (emailsByStatus[email.status] || 0) + 1;
      });
    }

    const stats = {
      users: {
        total: usersResult.count || 0,
        by_status: usersByStatus
      },
      emails: {
        total: emailsResult.count || 0,
        by_status: emailsByStatus
      },
      admins: {
        total: adminsResult.count || 0
      },
      generated_at: new Date().toISOString()
    };

    res.json({ stats });
  } catch (error) {
    console.error('[AdminRoutes] Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rotas para gerenciar templates de prompt
 * GET /admin/prompts - Listar todos os templates de prompt
 * POST /admin/prompts - Criar novo template de prompt
 * PUT /admin/prompts/:id - Atualizar template de prompt
 * POST /admin/prompts/:id/activate - Ativar template específico
 */
adminRouter.get('/prompts', checkAdminAuth, async (req, res) => {
  try {
    const { data: prompts, error } = await supabaseAdmin
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminRoutes] Erro ao buscar templates de prompt:', error);
      return res.status(500).json({ error: 'Erro ao buscar templates de prompt' });
    }

    console.log(`[AdminRoutes] ${prompts.length} templates de prompt encontrados`);
    res.json({ prompts });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao buscar prompts:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.post('/prompts', checkAdminAuth, async (req, res) => {
  try {
    const { name, content } = req.body;

    if (!name || !content) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: name, content' 
      });
    }

    const { data: newPrompt, error } = await supabaseAdmin
      .from('prompt_templates')
      .insert({
        name: name.trim(),
        content: content.trim(),
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[AdminRoutes] Erro ao criar template de prompt:', error);
      return res.status(500).json({ error: 'Erro ao criar template de prompt' });
    }

    console.log(`[AdminRoutes] Template de prompt criado por admin ${req.user.id}:`, newPrompt.id);
    res.status(201).json({ prompt: newPrompt });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao criar prompt:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.put('/prompts/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content } = req.body;

    if (!name && !content) {
      return res.status(400).json({ 
        error: 'Pelo menos um campo deve ser fornecido: name ou content' 
      });
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (name) updateData.name = name.trim();
    if (content) updateData.content = content.trim();

    const { data: updatedPrompt, error } = await supabaseAdmin
      .from('prompt_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[AdminRoutes] Erro ao atualizar template de prompt:', error);
      return res.status(500).json({ error: 'Erro ao atualizar template de prompt' });
    }

    if (!updatedPrompt) {
      return res.status(404).json({ error: 'Template de prompt não encontrado' });
    }

    console.log(`[AdminRoutes] Template de prompt ${id} atualizado por admin ${req.user.id}`);
    res.json({ prompt: updatedPrompt });
  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao atualizar prompt:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.post('/prompts/:id/activate', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[AdminRoutes] Iniciando ativação do template ${id}...`);

    // Primeiro, verificar se o prompt existe
    const { data: existingPrompt, error: checkError } = await supabaseAdmin
      .from('prompt_templates')
      .select('id, name')
      .eq('id', id)
      .single();

    if (checkError || !existingPrompt) {
      console.error('[AdminRoutes] Template não encontrado:', checkError);
      return res.status(404).json({ error: 'Template de prompt não encontrado' });
    }

    // Desativar todos os prompts primeiro
    console.log('[AdminRoutes] Desativando todos os templates...');
    const { error: deactivateError } = await supabaseAdmin
      .from('prompt_templates')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .gt('created_at', '1900-01-01'); // condição que sempre será verdadeira

    if (deactivateError) {
      console.error('[AdminRoutes] Erro ao desativar prompts:', deactivateError);
      return res.status(500).json({ error: 'Erro ao desativar templates existentes' });
    }

    // Ativar o prompt específico
    console.log(`[AdminRoutes] Ativando template ${id}...`);
    const { data: activatedPrompt, error: activateError } = await supabaseAdmin
      .from('prompt_templates')
      .update({ 
        is_active: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (activateError) {
      console.error('[AdminRoutes] Erro ao ativar prompt específico:', activateError);
      return res.status(500).json({ error: 'Erro ao ativar template de prompt' });
    }

    console.log(`[AdminRoutes] Template de prompt "${activatedPrompt.name}" ativado por admin ${req.user.id}`);
    
    res.json({ 
      message: 'Template de prompt ativado com sucesso',
      prompt: activatedPrompt 
    });

  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao ativar prompt:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

adminRouter.delete('/prompts/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[AdminRoutes] Iniciando exclusão do template ${id}...`);

    // Verificar se o prompt existe
    const { data: existingPrompt, error: checkError } = await supabaseAdmin
      .from('prompt_templates')
      .select('id, name, is_active')
      .eq('id', id)
      .single();

    if (checkError || !existingPrompt) {
      console.error('[AdminRoutes] Template não encontrado:', checkError);
      return res.status(404).json({ error: 'Template de prompt não encontrado' });
    }

    // Verificar se é o único prompt ativo
    if (existingPrompt.is_active) {
      const { data: activePrompts, error: activeError } = await supabaseAdmin
        .from('prompt_templates')
        .select('id')
        .eq('is_active', true);

      if (activeError) {
        console.error('[AdminRoutes] Erro ao verificar prompts ativos:', activeError);
        return res.status(500).json({ error: 'Erro ao verificar prompts ativos' });
      }

      if (activePrompts && activePrompts.length === 1) {
        return res.status(400).json({ 
          error: 'Não é possível excluir o único template ativo. Ative outro template primeiro.' 
        });
      }
    }

    // Excluir o prompt
    const { error: deleteError } = await supabaseAdmin
      .from('prompt_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[AdminRoutes] Erro ao excluir template:', deleteError);
      return res.status(500).json({ error: 'Erro ao excluir template de prompt' });
    }

    console.log(`[AdminRoutes] Template de prompt "${existingPrompt.name}" excluído por admin ${req.user.id}`);
    
    res.json({ 
      message: 'Template de prompt excluído com sucesso'
    });

  } catch (error) {
    console.error('[AdminRoutes] Erro inesperado ao excluir prompt:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Rota para testar se o usuário é admin
 * GET /admin/check - Verificar se o usuário atual é admin
 */
adminRouter.get('/check', checkAdminAuth, async (req, res) => {
  try {
    res.json({ 
      isAdmin: true,
      user: {
        id: req.user.id,
        email: req.user.email
      },
      message: 'Usuário tem permissões de administrador'
    });
  } catch (error) {
    console.error('[AdminRoutes] Erro ao verificar admin:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default adminRouter;