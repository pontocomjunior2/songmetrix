import pkg from '@supabase/supabase-js';
const { createClient } = pkg;

// Criar cliente Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Middleware para verificar se o usuário está autenticado
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 * @param {Function} next - Função next do Express
 */
export const requireAuth = async (req, res, next) => {
  try {
    console.log('Iniciando verificação de autenticação');
    
    // Verificar se o token de autenticação está presente
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token de autenticação ausente ou inválido');
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Ambiente de desenvolvimento: permitindo acesso sem autenticação');
        req.user = { 
          id: 'temp-dev-user', 
          email: 'dev@example.com',
          user_metadata: {
            status: 'ADMIN',
            favorite_radios: [] // Em ambiente dev sem token, usamos array vazio
          }
        };
        return next();
      }
      
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificar o token com o Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Erro ao verificar token:', error);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Permitindo acesso temporário após erro de token');
        req.user = { 
          id: 'temp-user-after-error', 
          email: 'temp-error@example.com',
          user_metadata: {
            status: 'ADMIN',
            favorite_radios: []
          }
        };
        return next();
      }
      
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Adicionar o usuário à requisição
    console.log('Usuário autenticado com sucesso:', user.email);
    console.log('Dados de metadados do usuário:', JSON.stringify(user.user_metadata, null, 2));
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Permitindo acesso temporário após erro de autenticação');
      req.user = { 
        id: 'temp-user-after-exception', 
        email: 'temp-exception@example.com',
        user_metadata: {
          status: 'ADMIN',
          favorite_radios: []
        }
      };
      return next();
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Middleware para verificar se o usuário é administrador
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 * @param {Function} next - Função next do Express
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // Verificar se o usuário existe na requisição (deve ser chamado após requireAuth)
    if (!req.user) {
      console.log('Usuário não encontrado na requisição');
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Usuário não é administrador:', req.user.id);
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    next();
  } catch (error) {
    console.error('Erro no middleware de verificação de admin:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Função para verificar a autenticação sem bloquear a requisição
 * @param {Object} req - Requisição Express
 * @returns {Object} - Resultado da verificação com authenticated e user
 */
export const verifyAuth = async (req) => {
  try {
    console.log('Iniciando verificação de autenticação');
    
    // Verificar se o token de autenticação está presente
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token de autenticação ausente ou inválido');
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Ambiente de desenvolvimento: permitindo acesso sem autenticação');
        return { 
          authenticated: true, 
          user: { 
            id: 'temp-dev-user', 
            email: 'dev@example.com',
            user_metadata: {
              status: 'ADMIN',
              favorite_radios: []
            }
          }
        };
      }
      
      return { authenticated: false, error: 'Não autorizado' };
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificar o token com o Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Erro ao verificar token:', error);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Permitindo acesso temporário após erro de token');
        return { 
          authenticated: true, 
          user: { 
            id: 'temp-user-after-error', 
            email: 'temp-error@example.com',
            user_metadata: {
              status: 'ADMIN',
              favorite_radios: []
            }
          }
        };
      }
      
      return { authenticated: false, error: 'Não autorizado' };
    }
    
    // Retornar o resultado da autenticação
    console.log('Usuário autenticado com sucesso:', user.email);
    console.log('Dados de metadados do usuário:', JSON.stringify(user.user_metadata, null, 2));
    return { authenticated: true, user };
  } catch (error) {
    console.error('Erro na verificação de autenticação:', error);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Permitindo acesso temporário após erro de autenticação');
      return { 
        authenticated: true, 
        user: { 
          id: 'temp-user-after-exception', 
          email: 'temp-exception@example.com',
          user_metadata: {
            status: 'ADMIN',
            favorite_radios: []
          }
        }
      };
    }
    
    return { authenticated: false, error: 'Erro interno do servidor' };
  }
}; 