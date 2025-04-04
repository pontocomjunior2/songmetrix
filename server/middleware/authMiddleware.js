import { createAdminClient } from '../lib/supabaseAdmin.js';

/**
 * Middleware para verificar o token JWT e anexar dados do usuário ao req.
 */
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extrai o token 'Bearer <token>'

    if (!token) {
        return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
    }

    const supabaseAdmin = createAdminClient();

    try {
        // Verificar o token usando o Supabase Admin Client
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error) {
            console.error('[Auth Middleware] Erro ao verificar token:', error.message);
             // Tratar erros específicos do Supabase
             if (error.message.includes('invalid') || error.message.includes('expired')) {
                 return res.status(401).json({ message: 'Token inválido ou expirado.' });
             }
             return res.status(500).json({ message: 'Erro interno ao verificar autenticação.' });
        }

        if (!user) {
             return res.status(401).json({ message: 'Token inválido ou usuário não encontrado.' });
        }

        // Anexar usuário (com metadados) ao objeto req para uso nas rotas
        req.user = user;
        next(); // Passa para o próximo middleware ou rota

    } catch (err) {
        console.error('[Auth Middleware] Erro inesperado:', err);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
}

/**
 * Middleware para verificar se o usuário autenticado é admin.
 * DEVE ser usado *depois* do middleware authenticateToken.
 */
export function isAdmin(req, res, next) {
    if (!req.user) {
        // Isso não deveria acontecer se authenticateToken foi usado antes
        return res.status(401).json({ message: 'Não autenticado.' });
    }

    const userMetadata = req.user.user_metadata || {};
    const userRole = userMetadata.role; // Ajuste 'role' se o nome do campo for diferente

    if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }

    next(); // Usuário é admin, prossegue
} 