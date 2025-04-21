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

  try {
    console.log('[GET /api/users] Admin access granted. Fetching user list...');

    // 1. Listar usuários da Autenticação (inclui last_sign_in_at)
    // ATENÇÃO: listUsers pagina. Buscar a primeira página (até 100) por simplicidade.
    // Para mais de 100 usuários, implementar paginação ou buscar em loop.
    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ 
        page: 1, 
        perPage: 100 // Ajuste conforme necessário
    });

    if (authError) {
      console.error('[GET /api/users] Erro ao listar usuários da autenticação:', authError);
      throw authError;
    }

    const authUsers = authUsersData?.users || [];
    const totalAuthUsers = authUsersData?.total; // Obter o total se disponível na API
    if (totalAuthUsers && totalAuthUsers > authUsers.length) {
        console.warn(`[GET /api/users] Atenção: Existem ${totalAuthUsers} usuários, mas apenas ${authUsers.length} foram buscados (limite da paginação). Implementar busca completa se necessário.`);
    }

    console.log(`[GET /api/users] ${authUsers.length} usuários encontrados na autenticação.`);
    if(authUsers.length === 0) {
        return res.json([]); // Retorna array vazio se não houver usuários
    }

    // Extrair IDs dos usuários de autenticação
    const userIds = authUsers.map(u => u.id);

    // 2. Buscar dados complementares da tabela public.users
    const { data: dbUsersData, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, whatsapp, plan_id, updated_at') // Selecionar campos necessários
      .in('id', userIds);

    if (dbError) {
      console.error('[GET /api/users] Erro ao buscar dados da tabela users:', dbError);
      // Considerar retornar dados parciais ou erro
      throw dbError;
    }

    // Mapear dados do DB para fácil acesso
    const dbUsersMap = new Map(dbUsersData.map(dbUser => [dbUser.id, dbUser]));

    // 3. Combinar os dados
    const combinedUsers = authUsers.map(authUser => {
      const dbUser = dbUsersMap.get(authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at, // Data de criação da conta Auth
        last_sign_in_at: authUser.last_sign_in_at, // Último login da Auth
        full_name: dbUser?.full_name || null, // Da tabela users
        whatsapp: dbUser?.whatsapp || null, // Da tabela users
        plan_id: dbUser?.plan_id || 'INDEFINIDO', // Da tabela users (ou um padrão)
        updated_at: dbUser?.updated_at || null // Da tabela users (para cálculo de expiração)
        // Adicionar user_metadata se necessário, mas pode ser grande
        // user_metadata: authUser.user_metadata 
      };
    });

    console.log(`[GET /api/users] Retornando ${combinedUsers.length} usuários combinados.`);
    res.json(combinedUsers);

  } catch (error) {
    console.error('[GET /api/users] Erro inesperado:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar usuários', details: error.message });
  }
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

// Rota para obter o planId do usuário logado
router.get('/my-plan', authenticateBasicUser, async (req, res) => {
  console.log(`[${new Date().toISOString()}] [ROUTE ENTRY users.js] GET /my-plan for user: ${req.user?.id}`);
  if (!req.user?.id) {
    console.error(`[${new Date().toISOString()}] [users.js /my-plan] Erro: ID do usuário não encontrado na requisição após autenticação.`);
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  const userId = req.user.id;

  try {
    // 1. Buscar metadados do Auth (tentativa primária, pode ter delay)
    let authPlanId = null;
    try {
        const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (getUserError) throw getUserError; // Propaga o erro para o catch principal
        if (!userData?.user) throw new Error('Usuário não encontrado na API de Auth Admin.');
        authPlanId = userData.user.user_metadata?.plan_id;
        console.log(`[${new Date().toISOString()}] [users.js /my-plan] PlanId from Auth metadata: ${authPlanId}`);
    } catch (authError) {
        // Logar erro do Auth mas continuar para verificar DB
        console.error(`[${new Date().toISOString()}] [users.js /my-plan] Erro ao buscar metadados Auth para usuário ${userId} (continuando para DB check):`, authError);
        // Não retorna erro ainda, vamos tentar o DB
    }

    // 2. Buscar plan_id diretamente da tabela 'users' (fonte potencialmente mais rápida)
    let dbPlanId = null;
    try {
        const { data: dbUserData, error: dbUserError } = await supabaseAdmin
          .from('users')
          .select('plan_id')
          .eq('id', userId)
          .maybeSingle(); // Usar maybeSingle para não dar erro se usuário não existir na tabela ainda

        if (dbUserError) throw dbUserError; // Propaga erro do DB

        if (dbUserData) {
            dbPlanId = dbUserData.plan_id;
            console.log(`[${new Date().toISOString()}] [users.js /my-plan] PlanId from DB table 'users': ${dbPlanId}`);
        } else {
            console.warn(`[${new Date().toISOString()}] [users.js /my-plan] Usuário ${userId} não encontrado na tabela 'users'.`);
            // Se não existe na tabela users, authPlanId (se existir) é a melhor aposta
        }
    } catch (dbError) {
        console.error(`[${new Date().toISOString()}] [users.js /my-plan] Erro ao buscar plan_id da tabela 'users' para ${userId}:`, dbError);
        // Se o DB falhar, ainda podemos ter o authPlanId
        if (authPlanId === null) {
           // Se ambos falharam, retorna erro
           return res.status(500).json({ error: 'Erro ao buscar dados do plano do usuário.', details: dbError.message });
        }
    }

    // 3. Determinar o planId final (priorizar DB)
    const finalPlanId = dbPlanId || authPlanId || 'trial'; // Prioriza DB, depois Auth, depois fallback

    // Log de comparação se forem diferentes
    if (dbPlanId !== null && authPlanId !== null && dbPlanId !== authPlanId) {
        console.warn(`[${new Date().toISOString()}] [users.js /my-plan] Discrepância encontrada para usuário ${userId}: DB plan='${dbPlanId}', Auth plan='${authPlanId}'. Usando DB.`);
    }

    console.log(`[${new Date().toISOString()}] [users.js /my-plan] Retornando finalPlanId '${finalPlanId}' para usuário ${userId}.`);
    res.status(200).json({ planId: finalPlanId });

  } catch (error) {
    // Catch para erros não tratados nas tentativas (ex: erro fatal no getUserById que foi propagado)
    console.error(`[${new Date().toISOString()}] [users.js /my-plan] Erro GERAL ao buscar plano para usuário ${userId}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar plano.', details: error.message });
  }
});

// Rota para atualizar last_sign_in (ADMIN)
router.post('/update-last-sign-in', authenticateBasicUser, async (req, res) => {
  console.log(`[${new Date().toISOString()}] [ROUTE ENTRY users.js] POST /update-last-sign-in`);
  // Verificar se o requisitante é ADMIN (já feito pelo middleware, mas boa prática confirmar)
  if (req.user?.planId !== 'ADMIN') {
    console.log(`[${new Date().toISOString()}] [users.js] Erro: Rota /update-last-sign-in acessada por não-admin? PlanId: ${req.user?.planId}`);
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }

  console.log(`[${new Date().toISOString()}] [users.js /update-last-sign-in] Admin OK. Chamando RPC update_users_last_sign_in...`);

  try {
    // Executar a atualização do campo last_sign_in_at chamando a função RPC
    const { data, error: updateError } = await supabaseAdmin.rpc('update_users_last_sign_in');

    if (updateError) {
      console.error(`[${new Date().toISOString()}] [users.js /update-last-sign-in] Erro ao executar RPC:`, updateError);
      return res.status(500).json({ error: `Erro ao atualizar dados via RPC: ${updateError.message}` });
    }

    console.log(`[${new Date().toISOString()}] [users.js /update-last-sign-in] RPC executado com sucesso. Resposta RPC:`, data);

    // Opcional: Re-contar no backend para confirmar (embora a função RPC possa já retornar isso)
    // Contar quantos registros foram atualizados na tabela public.users
    const { count, error: countError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .not('last_sign_in_at', 'is', null);

    if (countError) {
      console.error(`[${new Date().toISOString()}] [users.js /update-last-sign-in] Erro ao re-contar registros atualizados:`, countError);
      // Ainda retornar sucesso, pois a atualização principal (RPC) funcionou
      return res.status(200).json({ success: true, message: 'Dados de último acesso atualizados com sucesso (contagem falhou)' });
    }

    console.log(`[${new Date().toISOString()}] [users.js /update-last-sign-in] Re-contagem indica ${count} usuários com último login.`);

    return res.status(200).json({
      success: true,
      message: 'Dados de último acesso atualizados com sucesso',
      count: count
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [users.js /update-last-sign-in] Erro GERAL no catch block:`, error);
    return res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
  }
});

export default router; 