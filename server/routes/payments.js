import express from 'express';
import { findOrCreateCustomer, createSubscription, getSubscriptionPayments, updateAsaasCustomer, createInstallmentWithToken } from '../services/asaasService.js';
import { authenticateUser } from '../auth-middleware.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Configuração Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY; // Chave Anon para buscar usuário logado
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Chave Service para atualizar tabela users

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error("Erro: Variáveis Supabase não definidas completamente para rota de pagamentos.");
}

// Cliente Admin para atualizações na tabela users
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

// ---> FONTE SEGURA DOS PLANOS NO BACKEND <---
const securePlans = {
    'mensal': {
        value: 1299.00,
        cycle: 'MONTHLY',
        description: 'Assinatura Songmetrix - Plano Mensal',
        // installmentCount: 1 // Não aplicável para assinatura
    },
    'semestral': {
        value: 5394.00,
        // cycle: 'SEMIANNUALLY', // Não usaremos cycle para installments
        description: 'Assinatura Songmetrix - Plano Semestral',
        installmentCount: 6 // Definir número de parcelas aqui
    },
    'anual': {
        value: 8994.00,
        // cycle: 'YEARLY',
        description: 'Assinatura Songmetrix - Plano Anual',
        installmentCount: 12 // Definir número de parcelas aqui
    }
    // Adicionar outros planos aqui se necessário
};

// Renomear rota para refletir a criação de assinatura
router.post('/create-subscription', authenticateUser, async (req, res) => {
    // Verificar se clientes supabase foram inicializados
    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Configuração do servidor (Supabase Admin) incompleta.' });
    }
    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'Configuração do servidor (Supabase Client) incompleta.' });
    }

    // Inicializar Supabase client para buscar dados do usuário logado
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.authorization } } // Passar token do usuário
    });

    // Receber dados do frontend - AGORA INCLUINDO dados do cartão (token) se aplicável
    const {
        planId,
        billingType, // Será 'CREDIT_CARD' para Semestral/Anual, 'UNDEFINED' para Mensal
        creditCardToken, // <-- Novo: Token do cartão
        creditCardHolderInfo // <-- Novo: Info do titular (necessário para installments com token)
    } = req.body;
    const userId = req.user.id;

    // Validações básicas
    if (!planId || !securePlans[planId]) {
        return res.status(400).json({ success: false, error: 'Plano (planId) inválido ou não especificado.' });
    }
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }
    // Validar billingType
    const validBillingTypes = ['CREDIT_CARD', 'UNDEFINED']; // Tipos permitidos agora
    if (!billingType || !validBillingTypes.includes(billingType)) {
      return res.status(400).json({ success: false, error: 'Tipo de cobrança (billingType) inválido ou não especificado.' });
    }
    // Validar dados do cartão SE for plano Semestral ou Anual (que exigem CREDIT_CARD)
    if ((planId === 'semestral' || planId === 'anual') && billingType === 'CREDIT_CARD') {
        if (!creditCardToken || !creditCardHolderInfo) {
            return res.status(400).json({ success: false, error: 'Token do cartão e informações do titular são obrigatórios para este plano.'});
        }
        // Validar campos obrigatórios dentro de creditCardHolderInfo
        if (!creditCardHolderInfo.name || !creditCardHolderInfo.email || !creditCardHolderInfo.cpfCnpj) {
             return res.status(400).json({ success: false, error: 'Nome, Email e CPF/CNPJ do titular do cartão são obrigatórios.'});
        }
    }
    // Se for mensal, billingType DEVE ser UNDEFINED
    if (planId === 'mensal' && billingType !== 'UNDEFINED') {
         return res.status(400).json({ success: false, error: 'Plano mensal deve usar billingType UNDEFINED.' });
    }

    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            console.error('Erro ao buscar dados do usuário autenticado:', userError);
            return res.status(500).json({ success: false, error: 'Falha ao obter informações do usuário.' });
        }

        const customerId = await findOrCreateCustomer(userData.user);
        if (!customerId) {
            return res.status(500).json({ success: false, error: 'Falha ao processar cliente no gateway de pagamento.' });
        }

        // Obter detalhes seguros do plano
        const planDetails = securePlans[planId];
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + 1);
        const dueDateString = nextDueDate.toISOString().split('T')[0];

        // ---- LÓGICA CONDICIONAL ----
        if (planId === 'mensal') {
            // --- Lógica para Assinatura Recorrente (Mensal) ---
            console.log(`[Route /create-subscription] Criando ASSINATURA para plano ${planId}`);
            const subscriptionDetails = {
                billingType: 'UNDEFINED',
                value: planDetails.value,
                cycle: planDetails.cycle,
                description: planDetails.description,
                nextDueDate: dueDateString,
                externalReference: planId,
            };

            const subscriptionResponse = await createSubscription(customerId, subscriptionDetails);
            if (!subscriptionResponse || !subscriptionResponse.id) {
                console.error("Resposta da API Asaas (createSubscription):", subscriptionResponse);
                return res.status(500).json({ success: false, error: 'Falha ao criar assinatura no gateway de pagamento.' });
            }
            const subscriptionId = subscriptionResponse.id;

            // Salvar ID da ASSINATURA
            await saveAsaasId(userId, subscriptionId, 'subscription');

            // Buscar primeira cobrança (para URL de pagamento)
            const firstPaymentDetails = await getFirstPaymentDetails(subscriptionId);

            res.json({
                success: true,
                message: 'Assinatura mensal iniciada com sucesso!',
                type: 'subscription',
                details: subscriptionResponse,
                firstPayment: firstPaymentDetails // Para redirecionamento no frontend
            });

        } else if (planId === 'semestral' || planId === 'anual') {
            // --- Lógica para Cobrança Parcelada (Semestral/Anual) ---
             console.log(`[Route /create-subscription] Criando PARCELAMENTO para plano ${planId}`);
             if (billingType !== 'CREDIT_CARD') {
                 // Tecnicamente, poderíamos permitir Boleto/Pix aqui, mas exigiria outro fluxo.
                 // Por ora, forçamos Cartão para parcelado.
                 return res.status(400).json({ success: false, error: 'Planos Semestral e Anual atualmente requerem pagamento com Cartão de Crédito.' });
             }

            const installmentDetails = {
                value: planDetails.value,
                installmentCount: planDetails.installmentCount,
                description: planDetails.description,
                dueDate: dueDateString,
                creditCardToken,
                creditCardHolderInfo,
                externalReference: planId,
            };

            const installmentResponse = await createInstallmentWithToken(customerId, installmentDetails);

            // Checar se a resposta do serviço indicou erro
            if (installmentResponse?.error) {
                 console.error("Erro da API Asaas (createInstallmentWithToken):", installmentResponse.details);
                 // Mapear erros comuns do Asaas para mensagens mais amigáveis, se possível
                 const apiErrors = installmentResponse.details?.errors;
                 let errorMessage = 'Falha ao processar pagamento parcelado.';
                 if (apiErrors && apiErrors.length > 0) {
                     errorMessage = apiErrors.map(e => e.description).join(' ');
                 }
                 return res.status(400).json({ success: false, error: errorMessage }); // Usar 400 para erros de cartão/processamento
            }
            
            if (!installmentResponse || !installmentResponse.id) {
                console.error("Resposta inesperada da API Asaas (createInstallmentWithToken):", installmentResponse);
                return res.status(500).json({ success: false, error: 'Falha ao criar cobrança parcelada no gateway de pagamento.' });
            }
            const installmentId = installmentResponse.id;

             // Salvar ID do PARCELAMENTO
            await saveAsaasId(userId, installmentId, 'installment');

            // Para parcelamento direto com cartão, não há redirecionamento
            res.json({
                success: true,
                message: `Plano ${planId} ativado com sucesso (parcelado em ${planDetails.installmentCount}x).`,
                type: 'installment',
                details: installmentResponse // Retorna detalhes do parcelamento
                // Sem firstPayment/URL aqui
            });

        } else {
            // Caso algum planId futuro não seja tratado
            console.error(`[Route /create-subscription] Lógica não implementada para planId: ${planId}`);
            return res.status(500).json({ success: false, error: 'Lógica interna do servidor não implementada para este plano.' });
        }

    } catch (error) {
        console.error('[Route /create-subscription] Erro inesperado:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor ao processar plano.' });
    }
});

// Função auxiliar para salvar ID Asaas (Subscription ou Installment)
async function saveAsaasId(userId, asaasId, type) {
    if (!supabaseAdmin || !userId || !asaasId) return;
    console.log(`Salvando ID Asaas (${type}: ${asaasId}) para usuário ${userId}`);
    const { error } = await supabaseAdmin
      .from('users')
      // Usar o mesmo campo asaas_subscription_id, sabendo que pode conter installment_id
      .update({ asaas_subscription_id: asaasId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
        console.error(`Erro ao salvar asaas_subscription_id (${asaasId}) para usuário ${userId}:`, error);
    }
}

// Função auxiliar para buscar detalhes da primeira cobrança de uma assinatura
async function getFirstPaymentDetails(subscriptionId) {
    if (!subscriptionId) return null;
    const payments = await getSubscriptionPayments(subscriptionId);
    if (payments && payments.length > 0) {
        console.log(`Detalhes da primeira cobrança (${payments[0].id}) encontrados para assinatura ${subscriptionId}.`);
        return payments[0];
    } else {
        console.warn(`Nenhuma cobrança inicial encontrada imediatamente para assinatura ${subscriptionId}.`);
        return null;
    }
}

// Rota para atualizar o CPF/CNPJ do cliente Asaas
router.post('/update-customer', authenticateUser, async (req, res) => {
    const { cpfCnpj } = req.body;
    const userId = req.user?.id;

    // Validações
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }
    if (!cpfCnpj || typeof cpfCnpj !== 'string') {
        return res.status(400).json({ success: false, error: 'CPF/CNPJ inválido ou não fornecido.' });
    }
    const cleanedCpfCnpj = cpfCnpj.replace(/\D/g, '');
    if (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14) {
      return res.status(400).json({ success: false, error: 'Formato do CPF/CNPJ inválido.' });
    }

    console.log(`[Route /update-customer] Recebido pedido para atualizar CPF/CNPJ para usuário ${userId}`);

    try {
        // Chamar o serviço para atualizar no Asaas
        const success = await updateAsaasCustomer(userId, { cpfCnpj: cleanedCpfCnpj });

        if (success) {
            console.log(`[Route /update-customer] CPF/CNPJ atualizado com sucesso no Asaas para usuário ${userId}.`);
            // Atualizar também nos metadados do Supabase Auth para consistência
            try {
                const { data: authUser, error: authGetError } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (authGetError) throw authGetError;
                const currentMetadata = authUser.user.user_metadata || {};
                const updatedMetadata = { ...currentMetadata, cpfCnpj: cleanedCpfCnpj };
                const { error: metaUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
                    userId,
                    { user_metadata: updatedMetadata }
                );
                if (metaUpdateError) throw metaUpdateError;
                console.log(`[Route /update-customer] CPF/CNPJ atualizado também nos metadados Supabase Auth para ${userId}.`);
            } catch(metaError) {
                 console.error(`[Route /update-customer] Falha ao atualizar CPF/CNPJ nos metadados Supabase para ${userId}:`, metaError);
                 // Não retornar erro para o cliente, apenas logar.
            }
            
            res.json({ success: true, message: 'Dados do cliente atualizados com sucesso.' });
        } else {
            console.error(`[Route /update-customer] Falha ao atualizar CPF/CNPJ no Asaas para usuário ${userId} (retorno do serviço foi false).`);
            // O serviço já logou o erro do Asaas, retornar erro genérico
            res.status(500).json({ success: false, error: 'Falha ao atualizar dados no gateway de pagamento.' });
        }
    } catch (error) {
        console.error('[Route /update-customer] Erro inesperado:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor ao atualizar dados do cliente.' });
    }
});

export default router; 