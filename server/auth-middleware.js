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
      console.error('No Bearer token provided');
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Invalid token or user not found:', error);
      return res.status(401).json({ error: 'Token inválido' });
    }

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
      
      // Verificar se o usuário já tem um status nos metadados
      // Novos usuários sempre entram como TRIAL, exceto se já tiverem um status
      // definido nos metadados (possivelmente pelo ADMIN)
      let initialStatus = 'INATIVO';
      
      if (isNewUser) {
        initialStatus = 'TRIAL';
      }
      
      // Status predefinido nos metadados tem prioridade (pode ter sido definido pelo ADMIN)
      if (userStatus === 'ADMIN' || userStatus === 'ATIVO') {
        initialStatus = userStatus;
      }
      
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

    // Verificar se há inconsistência entre o status do banco e dos metadados
    const userStatus = user.user_metadata?.status;
    if (dbUser?.status && userStatus && dbUser.status !== userStatus) {
      console.log(`Inconsistência detectada: status metadata=${userStatus}, status db=${dbUser.status}`);
      
      // Adicionar à fila de sincronização se houver inconsistência
      const { error: insertError } = await supabaseAdmin
        .from('auth_sync_queue')
        .insert({
          user_id: user.id,
          status: dbUser.status, // Usar o status do banco como fonte da verdade
          processed: false,
          created_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        console.error('Error adding user to sync queue:', insertError);
      } else {
        console.log(`Usuário ${user.id} adicionado à fila de sincronização`);
      }
    }

    // Verificar se o usuário foi criado nos últimos 14 dias
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isNewUser = diffDays <= 14;
    
    console.log(`User ${user.id} created ${diffDays} days ago. Is new user: ${isNewUser}`);

    let finalStatus;
    
    // Se o usuário é ADMIN em qualquer lugar, deve permanecer ADMIN (prioridade máxima)
    if (userStatus === 'ADMIN' || dbUser?.status === 'ADMIN') {
      finalStatus = 'ADMIN';
      console.log('Usuário é ADMIN, status mantido:', user.id);
    }
    // Se o usuário é ATIVO em qualquer lugar, deve permanecer ATIVO (decisão do ADMIN deve ser respeitada)
    else if (userStatus === 'ATIVO' || dbUser?.status === 'ATIVO') {
      finalStatus = 'ATIVO';
      console.log('Usuário é ATIVO (definido pelo ADMIN), status mantido:', user.id);
    }
    // Verificar se o usuário é novo (< 14 dias) e não tem status específico, deve ser TRIAL
    else if (isNewUser && (!userStatus || userStatus === 'TRIAL' || userStatus === 'INATIVO')) {
      finalStatus = 'TRIAL';
      console.log('Novo usuário detectado. Definindo status como TRIAL:', user.id);
      console.log('Detalhes do usuário novo:', {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
        idade_em_dias: diffDays,
        status_banco: dbUser?.status,
        status_metadata: userStatus
      });
    }
    // Se o status do banco é INATIVO, deve permanecer INATIVO
    else if (dbUser?.status === 'INATIVO') {
      finalStatus = 'INATIVO';
    }
    // Se o status dos metadados é INATIVO, deve permanecer INATIVO
    else if (userStatus === 'INATIVO') {
      finalStatus = 'INATIVO';
    }
    // Em caso de inconsistência, priorizar o status mais permissivo
    else if (dbUser?.status && userStatus && dbUser.status !== userStatus) {
      if (dbUser.status === 'ADMIN' || userStatus === 'ADMIN') {
        finalStatus = 'ADMIN';
      } else if (dbUser.status === 'ATIVO' || userStatus === 'ATIVO') {
        finalStatus = 'ATIVO';
      } else if (dbUser.status === 'TRIAL' || userStatus === 'TRIAL') {
        finalStatus = 'TRIAL';
      } else {
        finalStatus = 'INATIVO';
      }
    } 
    // Usar o status existente se estiver definido
    else if (userStatus) {
      finalStatus = userStatus;
    } 
    // Usar o status do banco se o dos metadados não estiver definido
    else if (dbUser?.status) {
      finalStatus = dbUser.status;
    }
    // Padrão é INATIVO
    else {
      finalStatus = 'INATIVO';
    }

    console.log('Status final determinado:', finalStatus);

    // Atualizar imediatamente se for um novo usuário com status TRIAL
    if (isNewUser && finalStatus === 'TRIAL') {
      // Verificar se é necessário atualizar os metadados e o registro no banco
      const needsMetadataUpdate = !userStatus || userStatus !== 'TRIAL';
      const needsDbUpdate = !dbUser?.status || dbUser.status !== 'TRIAL';
      
      console.log(`Verificação de sincronização para usuário novo ${user.id}:`, {
        email: user.email,
        email_confirmado: user.email_confirmed_at ? 'Sim' : 'Não',
        needsMetadataUpdate,
        needsDbUpdate,
        status_atual_db: dbUser?.status || 'não definido',
        status_atual_metadata: userStatus || 'não definido',
        status_final: finalStatus
      });

      if (needsMetadataUpdate || needsDbUpdate) {
        console.log('Atualizando status para TRIAL em sistema e metadados para novo usuário:', user.id);
        
        const updatePromises = [];
        
        // Atualizar nos metadados se necessário
        if (needsMetadataUpdate) {
          updatePromises.push(
            supabaseAdmin.auth.admin.updateUserById(
              user.id,
              { user_metadata: { ...user.user_metadata, status: 'TRIAL' } }
            )
          );
        }
        
        // Atualizar no banco de dados se necessário
        if (needsDbUpdate) {
          updatePromises.push(
            supabaseAdmin
              .from('users')
              .upsert({
                id: user.id,
                email: user.email,
                status: 'TRIAL',
                updated_at: new Date().toISOString()
              })
          );
        }
        
        try {
          await Promise.all(updatePromises);
          console.log('Status atualizado com sucesso para TRIAL:', user.id);
        } catch (updateError) {
          console.error('Erro ao atualizar status para TRIAL:', updateError);
        }
      }
    }

    // Verificação estrita: rejeitar usuários com status INATIVO
    if (finalStatus === 'INATIVO') {
      console.log('Acesso negado para usuário inativo:', user.id);
      return res.status(403).json({ 
        error: 'Usuário inativo',
        code: 'inactive_user',
        redirect: '/plans'
      });
    }

    // Se o usuário está no período trial, mas ele expirou
    if (finalStatus === 'TRIAL' && !isNewUser) {
      console.log('Trial period expired for user', user.id);
      
      // Atualizar o status do usuário para INATIVO em ambos os lugares
      await Promise.all([
        // Atualizar nos metadados
        supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { user_metadata: { ...user.user_metadata, status: 'INATIVO' } }
        ),
        
        // Atualizar no banco de dados
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
    }
    
    // Adicionar informações ao objeto user para a solicitação
    req.user = {
      ...user,
      dbStatus: dbUser?.status,
      finalStatus: finalStatus
    };
    
    // Adicionar dias restantes do trial se aplicável
    if (finalStatus === 'TRIAL') {
      req.user.trial_days_remaining = Math.max(0, 14 - diffDays);
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Token inválido' });
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
      
      // Verificar se o usuário já tem um status nos metadados
      // Novos usuários sempre entram como TRIAL, exceto se já tiverem um status
      // definido nos metadados (possivelmente pelo ADMIN)
      let initialStatus = 'INATIVO';
      
      if (isNewUser) {
        initialStatus = 'TRIAL';
      }
      
      // Status predefinido nos metadados tem prioridade (pode ter sido definido pelo ADMIN)
      if (userStatus === 'ADMIN' || userStatus === 'ATIVO') {
        initialStatus = userStatus;
      }
      
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

    // Se o usuário é ADMIN em qualquer lugar, manter como ADMIN (prioridade máxima)
    if (userStatus === 'ADMIN' || dbUser?.status === 'ADMIN') {
      correctStatus = 'ADMIN';
      console.log('Usuário é ADMIN, mantendo status');
    }
    // Se o usuário é ATIVO em qualquer lugar, manter como ATIVO (decisão do ADMIN deve ser respeitada)
    else if (userStatus === 'ATIVO' || dbUser?.status === 'ATIVO') {
      correctStatus = 'ATIVO';
      console.log('Usuário é ATIVO, mantendo status (definido pelo ADMIN)');
    }
    // Se o usuário é novo e não tem status definido, ou é TRIAL e ainda está no período válido
    else if ((isNewUser && (!userStatus || !dbUser?.status)) || 
             ((userStatus === 'TRIAL' || dbUser?.status === 'TRIAL') && isNewUser)) {
      correctStatus = 'TRIAL';
      console.log('Usuário está no período TRIAL válido');
    }
    // Se o usuário tem status TRIAL mas o período expirou, mudar para INATIVO
    else if ((userStatus === 'TRIAL' || dbUser?.status === 'TRIAL') && !isNewUser) {
      correctStatus = 'INATIVO';
      console.log('Período TRIAL expirou, alterando para INATIVO');
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
