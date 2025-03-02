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
      console.log('Token de autenticação ausente ou inválido');
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificar o token com o Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Erro ao verificar token:', error);
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Adicionar o usuário à requisição
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
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