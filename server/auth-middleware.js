import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load environment variables from multiple locations
const envPaths = [
  path.join(dirname(__dirname), '.env.production'),
  path.join(dirname(__dirname), '.env'),
  path.join(__dirname, '.env')
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('Loaded environment variables from:', envPath);
    break;
  }
}

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Required environment variables are missing: VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

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

// Simplified authentication middleware
export const authenticateBasicUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[AuthMiddleware] No Bearer token provided');
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[AuthMiddleware] Invalid token or user not found:', authError?.message);
      return res.status(401).json({ error: 'Token inválido ou usuário não encontrado' });
    }

    // Buscar usuário da tabela users usando plan_id
    const { data: dbUserData, error: dbError } = await supabaseAdmin
      .from('users')
      // Selecionar plan_id e outros campos necessários, remover status antigo
      .select('id, email, plan_id, trial_ends_at, created_at, updated_at') 
      .eq('id', user.id)
      .maybeSingle(); // Usar maybeSingle para tratar usuário não encontrado sem erro

    if (dbError) {
      // Logar erro mas não necessariamente bloquear, pode ser perfil não criado ainda
      console.error('[AuthMiddleware] Error fetching user profile from DB:', dbError);
      // Se for erro de permissão, etc., retornar erro.
      // Se for 'PGRST116' (not found), dbUserData será null.
      // Por enquanto, vamos permitir continuar e tratar dbUserData nulo.
      // return res.status(500).json({ error: 'Erro ao buscar perfil do usuário' });
    }

    let userPlanId = dbUserData?.plan_id; // Obter plan_id do banco
    let userTrialEndsAt = dbUserData?.trial_ends_at;

    // --- LÓGICA SIMPLIFICADA --- 
    // Se o perfil não existe no DB, tenta criar.
    if (!dbUserData) {
       console.warn(`[AuthMiddleware] User profile not found in DB for user ${user.id}. Attempting to create...`);
       try {
           const createdAt = new Date(user.created_at);
           const trialEndDate = new Date(createdAt); // Basear trial na data de criação do auth
           trialEndDate.setDate(trialEndDate.getDate() + 14);

           const { error: insertError } = await supabaseAdmin
             .from('users')
             .insert({
               id: user.id,
               email: user.email,
               plan_id: 'TRIAL', // Começa como TRIAL
               trial_ends_at: trialEndDate.toISOString(),
               created_at: user.created_at || new Date().toISOString(),
               updated_at: new Date().toISOString()
               // Adicionar full_name, whatsapp dos metadados se disponíveis e desejado
               // full_name: user.user_metadata?.full_name,
               // whatsapp: user.user_metadata?.whatsapp,
             });

           if (insertError) {
             console.error(`[AuthMiddleware] Failed to create profile for ${user.id}:`, insertError);
             // Continuar mesmo assim? Ou negar acesso? Vamos negar por enquanto.
             return res.status(500).json({ error: 'Falha ao inicializar perfil do usuário.' });
           } else {
             console.log(`[AuthMiddleware] Profile created successfully for ${user.id}.`);
             // Define os valores para continuar a verificação de acesso
             userPlanId = 'TRIAL'; 
             userTrialEndsAt = trialEndDate.toISOString();
             // Não precisa recarregar dbUserData, já temos os valores
           }
       } catch (creationError) {
           console.error(`[AuthMiddleware] Exception during profile creation for ${user.id}:`, creationError);
           return res.status(500).json({ error: 'Erro interno ao criar perfil do usuário.' });
       }
    } else {
       // Se perfil existe, usar os dados do banco
       userPlanId = dbUserData.plan_id;
       userTrialEndsAt = dbUserData.trial_ends_at;
    }
    
    // Verificar se o trial expirou (lógica movida para depois da criação/leitura)
    if (userPlanId === 'TRIAL' && userTrialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(userTrialEndsAt);
      if (trialEnd < now) {
        console.log(`[AuthMiddleware] Trial expired for user ${user.id}. Treating as expired_trial.`);
        userPlanId = 'expired_trial';
        // Opcional: Atualizar no banco (pode ser feito por job agendado)
        // supabaseAdmin.from('users').update({ plan_id: 'expired_trial' }).eq('id', user.id).then(...);
      }
    }

    console.log(`[AuthMiddleware] User: ${user.id}, Determined Plan ID: ${userPlanId}`);

    // --- DECISÃO DE ACESSO --- 
    const allowedPlans = ['ADMIN', 'ATIVO', 'TRIAL']; // TRIAL means non-expired trial
    const expiredTrialAllowedRoutes = [
        '/api/dashboard',          // Allow dashboard GET
        '/api/ranking',            // Allow ranking GET
        '/api/radios/status',      // Allow radio status GET
        '/api/cities',             // Allow cities GET for filters
        '/api/states',             // Allow states GET for filters
        '/api/radio-abbreviations' // <<< ADICIONAR ESTA ROTA
        // Adicionar outras rotas GET permitidas para trial expirado, se necessário
    ];

    // Anexar informações úteis ao request ANTES da decisão final
    req.user = { 
      id: user.id, 
      email: user.email,
      planId: userPlanId, // Passar o planId determinado (pode ser 'expired_trial')
      user_metadata: user.user_metadata || {},
      // Adicionar outros dados do dbUserData se necessário
    };

    // 1. Permitir acesso se plano for ADMIN, ATIVO ou TRIAL (não expirado)
    if (userPlanId && allowedPlans.includes(userPlanId)) {
      console.log(`[AuthMiddleware] Access GRANTED for user ${user.id} with plan ${userPlanId} to ${req.originalUrl}`);
      return next(); // Permitir acesso
    }

    // 2. Se for trial expirado, verificar rotas específicas permitidas (apenas GET)
    if (userPlanId === 'expired_trial') {
        const isAllowedRoute = expiredTrialAllowedRoutes.some(route => req.originalUrl.startsWith(route));

        if (isAllowedRoute && req.method === 'GET') {
            console.log(`[AuthMiddleware] Access GRANTED (read-only) for expired trial user ${user.id} to ${req.originalUrl}`);
            return next(); // Permitir acesso GET a rotas específicas
        } else {
            // Negar acesso a outras rotas ou métodos para trial expirado
            console.log(`[AuthMiddleware] Access DENIED for expired trial user ${user.id} to ${req.method} ${req.originalUrl} (Route/Method not allowed)`);
            return res.status(403).json({ 
                error: 'Assinatura expirada', 
                code: 'TRIAL_EXPIRED',
                planId: userPlanId
            });
        }
    }
    
    // 3. Negar acesso para outros casos (INATIVO, null, etc.)
    console.log(`[AuthMiddleware] Access DENIED for user ${user.id} with invalid/inactive plan ${userPlanId} to ${req.originalUrl}`);
    return res.status(403).json({ 
        error: 'Acesso negado. Plano inválido ou inativo.', 
        code: 'ACCESS_DENIED',
        planId: userPlanId 
    });

  } catch (error) {
    console.error('[AuthMiddleware] Unexpected error:', error);
    return res.status(500).json({ error: 'Erro interno no middleware de autenticação' });
  }
};

// Protected routes middleware
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No Bearer token provided');
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Invalid token or user not found:', error);
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Get user status directly from metadata
    const userStatus = user.user_metadata?.status;
    console.log('User status from metadata:', userStatus);

    // Verificar se o usuário existe na tabela users
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (dbError && dbError.code !== 'PGRST116') {
      console.error('Error fetching user from database:', dbError);
    }

    // Se o usuário não existir no banco, mas existir na autenticação, criar no banco
    if (dbError && dbError.code === 'PGRST116') {
      console.log('Usuário não encontrado no banco. Criando registro:', user.id);
      
      // Verificar se é um usuário novo para determinar o status
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isNewUser = diffDays <= 14;
      const initialStatus = isNewUser ? 'TRIAL' : 'INATIVO';
      
      console.log(`Criando usuário com status ${initialStatus} (dias desde criação: ${diffDays})`);
      
      // Criar usuário no banco de dados
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          status: initialStatus,
          created_at: user.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Erro ao criar usuário no banco de dados:', insertError);
        return res.status(500).json({ error: 'Erro ao criar perfil de usuário' });
      }
      
      // Recarregar os dados do usuário
      const { data: refreshedDbUser, error: refreshDbError } = await supabaseAdmin
        .from('users')
        .select('id, email, status, created_at, updated_at')
        .eq('id', user.id)
        .single();
        
      if (!refreshDbError && refreshedDbUser) {
        console.log('Usuário criado com sucesso no banco:', refreshedDbUser);
        dbUser = refreshedDbUser;
      }
    }

    console.log('User status from database:', dbUser?.status);

    // Verificar se o usuário foi criado nos últimos 14 dias
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isNewUser = diffDays <= 14;
    
    console.log(`User ${user.id} created ${diffDays} days ago. Is new user: ${isNewUser}`);

    // Determinar o status correto
    let correctStatus;

    // Se o usuário é novo, deve ser TRIAL (prioridade máxima)
    if (isNewUser) {
      correctStatus = 'TRIAL';
      console.log('Usuário novo, definindo status como TRIAL');
    } 
    // Se o usuário é ADMIN em qualquer lugar, manter como ADMIN
    else if (userStatus === 'ADMIN' || dbUser?.status === 'ADMIN') {
      correctStatus = 'ADMIN';
      console.log('Usuário é ADMIN, mantendo status');
    }
    // Se o usuário é ATIVO em qualquer lugar, manter como ATIVO
    else if (userStatus === 'ATIVO' || dbUser?.status === 'ATIVO') {
      correctStatus = 'ATIVO';
      console.log('Usuário é ATIVO, mantendo status');
    }
    // Se o usuário tem status TRIAL em qualquer lugar e ainda está no período de trial, manter como TRIAL
    else if ((userStatus === 'TRIAL' || dbUser?.status === 'TRIAL') && isNewUser) {
      correctStatus = 'TRIAL';
      console.log('Usuário está no período TRIAL, mantendo status');
    }
    // Em todos os outros casos, o usuário é INATIVO
    else {
      correctStatus = 'INATIVO';
      console.log('Definindo status como INATIVO por padrão');
    }

    console.log('Status correto determinado:', correctStatus);

    // Verificar se há inconsistência entre o status determinado e os registros
    const needsMetadataUpdate = correctStatus !== userStatus;
    const needsDatabaseUpdate = dbUser && correctStatus !== dbUser.status;

    // Se o status correto for diferente do que está nos metadados, atualizar
    if (needsMetadataUpdate) {
      console.log('Atualizando status nos metadados de', userStatus, 'para', correctStatus);
      
      try {
        // Atualizar metadados
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { user_metadata: { ...user.user_metadata, status: correctStatus } }
        );

        if (updateError) {
          console.error('Erro ao atualizar metadados do usuário:', updateError);
        } else {
          console.log('Metadados atualizados com sucesso');
        }
      } catch (error) {
        console.error('Exceção ao atualizar metadados:', error);
      }
    }

    // Se o status correto for diferente do que está no banco, atualizar
    if (needsDatabaseUpdate) {
      console.log('Atualizando status no banco de dados de', dbUser.status, 'para', correctStatus);
      
      try {
        // Atualizar na tabela users
        const { error: updateDbError } = await supabaseAdmin
          .from('users')
          .update({
            status: correctStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
          
        if (updateDbError) {
          console.error('Erro ao atualizar status no banco de dados:', updateDbError);
        } else {
          console.log('Status no banco de dados atualizado com sucesso');
        }
      } catch (error) {
        console.error('Exceção ao atualizar banco de dados:', error);
      }
    }

    // Se houve inconsistência, adicionar à fila de sincronização para garantir
    if (needsMetadataUpdate || needsDatabaseUpdate) {
      try {
        const { error: queueError } = await supabaseAdmin
          .from('auth_sync_queue')
          .insert({
            user_id: user.id,
            status: correctStatus,
            processed: false,
            created_at: new Date().toISOString()
          })
          .select();
          
        if (queueError) {
          console.error('Erro ao adicionar usuário à fila de sincronização:', queueError);
        } else {
          console.log('Usuário adicionado à fila de sincronização');
        }
      } catch (error) {
        console.error('Exceção ao adicionar à fila de sincronização:', error);
      }
    }

    // Verificar se o usuário tem permissão para acessar (ADMIN, ATIVO ou TRIAL válido)
    if (correctStatus === 'INATIVO') {
      console.log('Acesso negado para usuário inativo:', user.id);
      return res.status(403).json({ 
        error: 'Assinatura necessária',
        code: 'subscription_required',
        redirect: '/plans'
      });
    }

    // Verificar se o usuário está no período trial e se ainda é válido
    if (correctStatus === 'TRIAL' && !isNewUser) {
      console.log('Período trial expirado para o usuário', user.id);
      
      try {
        // Atualizar o status do usuário para INATIVO
        await Promise.all([
          // Atualizar nos metadados
          supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { user_metadata: { ...user.user_metadata, status: 'INATIVO' } }
          ),
          
          // Atualizar na tabela users
          supabaseAdmin
            .from('users')
            .update({
              status: 'INATIVO',
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
        ]);
        
        return res.status(403).json({ 
          error: 'Período trial expirado',
          code: 'trial_expired',
          redirect: '/plans'
        });
      } catch (error) {
        console.error('Erro ao atualizar status após expiração do trial:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
    
    // Adicionar informações ao objeto user para a solicitação
    req.user = {
      ...user,
      dbStatus: dbUser?.status,
      correctStatus: correctStatus
    };
    
    // Adicionar dias restantes do trial se aplicável
    if (correctStatus === 'TRIAL') {
      req.user.trial_days_remaining = Math.max(0, 14 - diffDays);
    }
    
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};
