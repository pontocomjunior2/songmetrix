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

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Required environment variables are missing: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Create Supabase admin client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
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

    // Obter dados diretamente do user_metadata retornado por getUser
    const userMetadata = user.user_metadata || {};
    let userPlanId = userMetadata.plan_id;
    let userTrialEndsAt = userMetadata.trial_ends_at;


    // Verificar se o trial expirou (usando dados do metadata)
    if (userPlanId?.trim().toUpperCase() === 'TRIAL' && userTrialEndsAt) { 
      const now = new Date();
      const trialEnd = new Date(userTrialEndsAt);
      if (trialEnd < now) {
        console.log(`[AuthMiddleware] Trial expired for user ${user.id}. Setting planId to FREE.`);
        userPlanId = 'FREE';
      }
    }

    // Garantir que userPlanId não seja null/undefined e REMOVER ESPAÇOS EXTRAS E CONVERTER PARA MAIÚSCULAS
    if (!userPlanId) {
        console.warn(`[AuthMiddleware] 'plan_id' not found in user_metadata for ${user.id}. Treating as INATIVO.`);
        userPlanId = 'INATIVO';
    } else {
        userPlanId = userPlanId.trim().toUpperCase();
    }



    // --- DECISÃO DE ACESSO --- 
    const allowedPlans = ['ADMIN', 'ATIVO', 'TRIAL', 'FREE'];
    
    // Anexar informações úteis ao request ANTES da decisão final
    req.user = { 
      id: user.id, 
      email: user.email,
      planId: userPlanId, // Usar o planId ajustado (obtido de plan_id, trimmed, uppercase)
      user_metadata: userMetadata
    };

    // Lógica de verificação (agora baseada em plan_id novamente)
    if (allowedPlans.includes(userPlanId)) { 
      next();
    } else {
      // Acesso negado apenas se não for um dos planos permitidos (Ex: INATIVO)
      return res.status(403).json({ 
          error: 'Acesso negado. Plano inválido ou inativo.', 
          code: 'ACCESS_DENIED'
      });
    }

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
      
      // Ler plan_id dos metadados, se houver
      const initialPlanIdFromMeta = user.user_metadata?.plan_id;
      
      // Verificar se é um usuário novo para determinar o plan_id inicial
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isNewUser = diffDays <= 14;
      
      // Definir plan_id inicial: Usar dos metadados se existir, senão TRIAL para novos, FREE para antigos
      let initialPlanId = initialPlanIdFromMeta?.trim().toUpperCase() || 
                          (isNewUser ? 'TRIAL' : 'FREE');
      
      console.log(`Criando usuário com plan_id ${initialPlanId} (dias desde criação: ${diffDays}, meta: ${initialPlanIdFromMeta || 'N/A'})`);
      
      // Criar usuário no banco de dados com plan_id
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          plan_id: initialPlanId, // Inserir plan_id
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

    // Determinar o status correto -> AGORA plan_id correto
    let correctPlanId; // Renomear variável

    // Se o usuário é novo, deve ser TRIAL (prioridade máxima)
    if (isNewUser) {
      correctPlanId = 'TRIAL';
      console.log('Usuário novo, definindo plan_id como TRIAL');
    } 
    // Se o usuário é ADMIN em qualquer lugar, manter como ADMIN
    else if (userStatus === 'ADMIN' || dbUser?.status === 'ADMIN') {
      correctPlanId = 'ADMIN';
      console.log('Usuário é ADMIN, mantendo plan_id');
    }
    // Se o usuário é ATIVO em qualquer lugar, manter como ATIVO
    else if (userStatus === 'ATIVO' || dbUser?.status === 'ATIVO') {
      correctPlanId = 'ATIVO';
      console.log('Usuário é ATIVO, mantendo plan_id');
    }
    // Se o usuário tem status TRIAL em qualquer lugar e ainda está no período de trial, manter como TRIAL
    else if ((userStatus === 'TRIAL' || dbUser?.status === 'TRIAL') && isNewUser) {
      correctPlanId = 'TRIAL';
      console.log('Usuário está no período TRIAL, mantendo plan_id');
    }
    // Em todos os outros casos, o usuário é FREE (não mais INATIVO automaticamente)
    else {
      correctPlanId = 'FREE'; // Mudar default para FREE
      console.log('Definindo plan_id como FREE por padrão'); // Mensagem ajustada
    }



    // Verificar se há inconsistência entre o plan_id determinado e os registros
    const needsMetadataUpdate = correctPlanId !== userStatus;
    const needsDatabaseUpdate = dbUser && correctPlanId !== dbUser.status;

    // Se o plan_id correto for diferente do que está nos metadados, atualizar
    if (needsMetadataUpdate) {
      console.log('Atualizando plan_id nos metadados de', userStatus, 'para', correctPlanId);
      
      try {
        // Atualizar metadados
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { user_metadata: { ...user.user_metadata, status: correctPlanId } }
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

    // Se o plan_id correto for diferente do que está no banco, atualizar
    if (needsDatabaseUpdate) {
      console.log('Atualizando plan_id no banco de dados de', dbUser.status, 'para', correctPlanId);
      
      try {
        // Atualizar na tabela users
        const { error: updateDbError } = await supabaseAdmin
          .from('users')
          .update({
            status: correctPlanId,
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
            status: correctPlanId,
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

    // Permitir acesso à rota de criação de cobrança independentemente do status/plano
    if (req.originalUrl === '/api/payments/create-charge' && req.method === 'POST') {
        req.user = {
          id: user.id, 
          email: user.email,
          planId: correctPlanId,
          user_metadata: user.user_metadata
        };
        return next(); 
    }

    // Verificar se o usuário tem permissão para acessar

    // --- Verificações de Status para OUTRAS rotas ---
    /* // REMOVER ESTE BLOCO - Usuário não se torna INATIVO automaticamente
    if (correctStatus === 'INATIVO') {
      console.log('Acesso negado para usuário inativo:', user.id);
      return res.status(403).json({ 
        error: 'Assinatura necessária',
        code: 'subscription_required',
        redirect: '/plans'
      });
    }
    */

    /* // REMOVER ESTE BLOCO - A expiração para FREE é tratada em authenticateBasicUser
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
    */
    
    // Adicionar informações ao objeto user para a solicitação
    req.user = {
      id: user.id, 
      email: user.email,
      planId: correctPlanId, // Usar o plan_id determinado
      user_metadata: user.user_metadata, // Incluir metadata original
      dbStatus: dbUser?.status, // Incluir status do DB se necessário para outras rotas
      correctPlanId: correctPlanId // Incluir plan_id final se necessário para outras rotas
    };
    
    // Adicionar dias restantes do trial se aplicável
    if (correctPlanId === 'TRIAL') {
      req.user.trial_days_remaining = Math.max(0, 14 - diffDays);
    }
    
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};
