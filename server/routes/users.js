import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateBasicUser } from '../auth-middleware.js';

const router = express.Router();

// Create Supabase admin client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Rota para registrar usuário (criação ou atualização na tabela users)
router.post('/register', async (req, res) => {
  try {
    const { id, email, status, full_name, whatsapp } = req.body;
    
    if (!id || !email) {
      return res.status(400).json({ error: 'ID e email são obrigatórios' });
    }
    
    // Criar ou atualizar o registro na tabela users usando o cliente admin
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        id,
        email,
        status: status || 'TRIAL',
        full_name,
        whatsapp,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao criar/atualizar registro do usuário:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Registro do usuário criado/atualizado com sucesso na tabela users');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erro no processamento da requisição:', error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Rota para obter todos os usuários (ADMIN)
router.get('/', authenticateBasicUser, async (req, res) => {
  // Verificar se o usuário é ADMIN
  if (req.user?.planId !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  // ... (lógica existente)
});

// Rota para atualizar status/plano do usuário (ADMIN)
router.put('/:id/status', authenticateBasicUser, async (req, res) => {
  // Verificar se o requisitante é ADMIN
  if (req.user?.planId !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  // ... (lógica existente - usar { plan_id: newStatus } na atualização)
});

// Rota para remover usuário (ADMIN) - Caminho relativo: POST /remove
router.post('/remove', authenticateBasicUser, async (req, res) => {
  // Log de entrada na rota específica do router
  console.log(`[${new Date().toISOString()}] [ROUTE ENTRY users.js] POST /remove`);

  // A verificação de ADMIN já foi feita implicitamente pelo middleware que deixou passar
  // Mas podemos adicionar uma verificação extra aqui por segurança, usando o req.user populado pelo middleware
  if (req.user?.planId !== 'ADMIN') {
      console.log(`[${new Date().toISOString()}] [users.js] Erro: Rota /remove acessada por não-admin? PlanId: ${req.user?.planId}`); // Log de segurança
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }

  console.log(`[${new Date().toISOString()}] [users.js] Verificação de Admin OK (planId: ${req.user?.planId}).`);

  try {
    console.log(`[${new Date().toISOString()}] [users.js] Dentro do try block`);
    const { userId } = req.body;
    console.log(`[${new Date().toISOString()}] [users.js] User ID recebido: ${userId}`);

    if (!userId) {
      console.log(`[${new Date().toISOString()}] [users.js] Erro: ID do usuário não fornecido.`);
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    if (userId === req.user.id) {
      console.log(`[${new Date().toISOString()}] [users.js] Erro: Tentativa de auto-remoção.`);
      return res.status(400).json({ error: 'Você não pode remover seu próprio usuário' });
    }

    console.log(`[${new Date().toISOString()}] [users.js] Preparando para chamar supabaseAdmin.auth.admin.deleteUser para: ${userId}`);

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    console.log(`[${new Date().toISOString()}] [users.js] Chamada a deleteUser concluída. Erro:`, deleteAuthError);

    if (deleteAuthError) {
      console.error(`[${new Date().toISOString()}] [users.js] Erro DETECTADO ao remover usuário ${userId} do Auth:`, deleteAuthError);
      return res.status(500).json({
        error: 'Erro ao remover usuário do Auth',
        details: deleteAuthError.message
      });
    }

    console.log(`[${new Date().toISOString()}] [users.js] Usuário ${userId} removido com sucesso do Auth.`);

    // Tentar remover da tabela 'users' (opcional se CASCADE está OK)
    const { error: deleteDbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteDbError) {
       console.error(`[${new Date().toISOString()}] [users.js] Erro ao remover usuário ${userId} do banco (ignorar se CASCADE OK):`, deleteDbError);
       if (deleteDbError.code === '23503') {
         console.log(`[${new Date().toISOString()}] [users.js] Nota: Erro na tabela 'users' provavelmente devido a CASCADE.`);
       }
    } else {
       console.log(`[${new Date().toISOString()}] [users.js] Remoção (ou tentativa) da tabela 'users' concluída sem erro explícito.`);
    }

    console.log(`[${new Date().toISOString()}] [users.js] Usuário ${userId} processado com sucesso para remoção.`);
    res.status(200).json({
      message: 'Usuário removido com sucesso',
      userId
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [users.js] Erro GERAL capturado no catch block ao remover usuário:`, error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para atualizar last_sign_in (ADMIN)
router.post('/update-last-sign-in', authenticateBasicUser, async (req, res) => {
  // Verificar se o requisitante é ADMIN
  if (req.user?.planId !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  // ... (lógica existente)
});

export default router; 