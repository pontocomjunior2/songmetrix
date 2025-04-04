import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente
// Certifique-se de que dotenv está configurado no seu server.js ou index.js
// require('dotenv').config(); // Descomente se necessário aqui ou no ponto de entrada

let adminClientInstance = null;

/**
 * Cria e/ou retorna uma instância singleton do cliente Supabase
 * configurado com a Service Role Key para operações administrativas.
 */
export function createAdminClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('Variáveis de ambiente Supabase (VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY) não definidas para Admin Client.');
        // Lançar um erro aqui impede o servidor de iniciar se as chaves estiverem faltando
        throw new Error('Variáveis de ambiente Supabase Admin ausentes.');
    }

    if (!adminClientInstance) {
        adminClientInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log('Supabase Admin Client Initialized (Backend)');
    }
    return adminClientInstance;
} 