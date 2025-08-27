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
    // Verificar se o token de autenticação está presente
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (process.env.NODE_ENV !== 'production') {
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
      if (process.env.NODE_ENV !== 'production') {
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
    
    // Adicionar o usuário à requisição (evitar logar dados sensíveis)
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação');
    
    if (process.env.NODE_ENV !== 'production') {
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
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    next();
  } catch (error) {
    console.error('Erro no middleware de verificação de admin');
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
    // Verificar se o token de autenticação está presente
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (process.env.NODE_ENV !== 'production') {
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
      if (process.env.NODE_ENV !== 'production') {
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
    return { authenticated: true, user };
  } catch (error) {
    console.error('Erro na verificação de autenticação');
    
    if (process.env.NODE_ENV !== 'production') {
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