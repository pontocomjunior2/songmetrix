import express from 'express';
import { findOrCreateCustomer, createCharge } from '../services/asaasService.js';
import { authenticateUser } from '../auth-middleware.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Configuração Supabase (pode ser movida para um config)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY; // Usar a chave anon para buscar dados do usuário no contexto da requisição

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Erro: Variáveis Supabase não definidas para rota de pagamentos.");
}

// Mapa de planos e preços (poderia vir de uma config ou DB)
const plans = {
    'mensal': {
        price: 1499.00,
        description: 'Assinatura Songmetrix - Plano Mensal'
    },
    'semestral': {
        price: 5394.00, // 899 * 6
        description: 'Assinatura Songmetrix - Plano Semestral'
    },
    'anual': {
        price: 8994.00, // 749.50 * 12
        description: 'Assinatura Songmetrix - Plano Anual'
    }
};

// Rota para criar uma cobrança Asaas
router.post('/create-charge', authenticateUser, async (req, res) => {
    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
    }
    // Inicializar Supabase client para esta requisição
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.authorization } } // Passar token do usuário
    });

    const { planId } = req.body; // ID do plano ('mensal', 'semestral', 'anual')
    const userId = req.user.id; // ID do usuário vindo do middleware authenticateUser

    if (!planId || !plans[planId]) {
        return res.status(400).json({ error: 'Plano inválido ou não especificado.' });
    }

    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    try {
        // Buscar dados completos do usuário autenticado (incluindo metadata)
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData || !userData.user) {
            console.error('Erro ao buscar dados do usuário autenticado:', userError);
            return res.status(500).json({ error: 'Falha ao obter informações do usuário.' });
        }

        // 1. Encontrar ou criar cliente Asaas
        const customerId = await findOrCreateCustomer(userData.user);
        if (!customerId) {
            return res.status(500).json({ error: 'Falha ao processar cliente no gateway de pagamento.' });
        }

        // 2. Definir detalhes da cobrança
        const planDetails = plans[planId];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); // Vencimento em 7 dias (ajustar conforme necessário)

        const chargeDetails = {
            value: planDetails.price,
            dueDate: dueDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
            description: planDetails.description
            // billingType: 'UNDEFINED' // Padrão no asaasService
        };

        // 3. Criar a cobrança no Asaas
        const chargeResponse = await createCharge(customerId, chargeDetails);
        if (!chargeResponse || !chargeResponse.invoiceUrl) {
            return res.status(500).json({ error: 'Falha ao criar cobrança no gateway de pagamento.' });
        }

        // 4. Retornar a URL de pagamento para o frontend
        res.json({ invoiceUrl: chargeResponse.invoiceUrl });

    } catch (error) {
        console.error('Erro inesperado ao criar cobrança:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao processar pagamento.' });
    }
});

export default router; 