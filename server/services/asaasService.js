// import dotenv from 'dotenv'; // Remover daqui
// // Corrigir caminho do dotenv: buscar a partir da raiz onde nodemon é executado
// dotenv.config({ path: './.env' }); // Remover daqui
import axios from 'axios'; // Usar import
import { createClient } from '@supabase/supabase-js'; // Usar import

// Configuração do Cliente Supabase Admin (usar variáveis de ambiente)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Erro: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas.");
    // Considerar lançar um erro ou sair, dependendo da sua estratégia de erro
}

// Inicializar cliente Supabase Admin APENAS se as chaves existirem
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

// Configuração do Asaas (variáveis lidas de process.env)
// const asaasApiUrl = process.env.ASAAS_API_URL; // Não precisa mais aqui
// const asaasApiKey = process.env.ASAAS_API_KEY; // Não precisa mais aqui

// REMOVER instância Axios pré-configurada global
// const asaasAPI = axios.create({ ... });

// FUNÇÃO GETTER para a instância Axios
const getAsaasAPI = () => {
    const apiUrl = process.env.ASAAS_API_URL;
    const apiKey = process.env.ASAAS_API_KEY;

    if (!apiUrl || !apiKey) {
        console.error("[getAsaasAPI] Erro: Variáveis de ambiente ASAAS_API_URL ou ASAAS_API_KEY não definidas NO MOMENTO DA CHAMADA.");
        // Lançar erro ou retornar null pode ser apropriado aqui
        throw new Error("Configuração da API Asaas ausente"); 
    }

    // Log para confirmar os valores usados pela instância
    console.log(`[getAsaasAPI] Criando/retornando instância Axios com baseURL: ${apiUrl} e API Key: ${apiKey ? 'Presente' : 'Ausente'}`);

    return axios.create({
        baseURL: apiUrl, // Deve ser https://api-sandbox.asaas.com/
        headers: {
            'Content-Type': 'application/json',
            'access_token': apiKey
        }
    });
};

/**
 * Encontra um cliente Asaas existente pelo ID armazenado no metadata do Supabase 
 * ou cria um novo cliente no Asaas se não encontrado.
 * Atualiza o metadata do usuário Supabase com o ID do cliente Asaas criado.
 *
 * @param {object} userData - O objeto de usuário do Supabase (incluindo user_metadata).
 * @returns {Promise<string|null>} O ID do cliente Asaas ou null em caso de erro.
 */
export const findOrCreateCustomer = async (userData) => {
    if (!supabaseAdmin) {
        console.error('Supabase Admin client não inicializado.');
        return null;
    }
    if (!userData || !userData.id) {
        console.error('Dados de usuário inválidos fornecidos para findOrCreateCustomer.');
        return null;
    }

    const userId = userData.id;
    let customerId = null;
    let foundInDb = false;
    let foundInMeta = false;
    const metadata = userData.user_metadata || {}; // Metadados da autenticação

    // 1. Tentar buscar na tabela public.users primeiro
    try {
        const { data: dbUser, error: dbError } = await supabaseAdmin
            .from('users')
            .select('asaas_customer_id')
            .eq('id', userId)
            .maybeSingle(); // Usar maybeSingle para não dar erro se não achar

        if (dbError) {
            console.error(`Erro ao buscar usuário ${userId} na tabela users:`, dbError);
            // Não retornar null aqui, podemos tentar os metadados
        }

        if (dbUser?.asaas_customer_id) {
            customerId = dbUser.asaas_customer_id;
            foundInDb = true;
            console.log(`Cliente Asaas encontrado na tabela users para ${userId}: ${customerId}`);
        }
    } catch (e) {
         console.error(`Exceção ao buscar usuário ${userId} na tabela users:`, e);
    }

    // 2. Se não achou no DB, verificar metadados como fallback
    if (!customerId && metadata.asaas_customer_id) {
        customerId = metadata.asaas_customer_id;
        foundInMeta = true;
        console.log(`Cliente Asaas encontrado APENAS nos metadados para ${userId}: ${customerId}. Tentando salvar no DB.`);
        
        // CORRIGIR INCONSISTÊNCIA: Salvar ID dos metadados na tabela users
        const { error: updateDbError } = await supabaseAdmin
            .from('users')
            .update({ asaas_customer_id: customerId, updated_at: new Date().toISOString() })
            .eq('id', userId);
            
        if (updateDbError) {
            console.error(`Erro ao salvar ID Asaas dos metadados na tabela users para ${userId}:`, updateDbError);
            // Continuar mesmo assim, usando o ID dos metadados
        } else {
             console.log(`ID Asaas dos metadados salvo com sucesso na tabela users para ${userId}.`);
        }
    }

    // 3. Se encontrou no DB mas não nos metadados (menos provável, mas possível)
    if (customerId && foundInDb && !metadata.asaas_customer_id) {
        console.log(`Cliente Asaas encontrado no DB (${customerId}) mas não nos metadados para ${userId}. Atualizando metadados.`);
        const updatedMetadata = { ...metadata, asaas_customer_id: customerId };
        const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: updatedMetadata }
        );
        if (updateMetaError) {
            console.error(`Erro ao atualizar metadados com ID Asaas do DB para ${userId}:`, updateMetaError);
        }
    }

    // 4. Se ainda não tem ID, criar novo cliente Asaas
    if (!customerId) {
        console.log(`Cliente Asaas não encontrado para usuário ${userId}. Criando novo...`);

        // Preparar dados básicos
        const customerName = metadata.full_name || userData.email;
        const customerEmail = userData.email;
        const customerPhoneDigits = metadata.whatsapp?.replace(/\D/g, '') || '';

        // Construir o payload condicionalmente
        const customerPayload = {
            name: customerName,
            email: customerEmail,
            // Remover cpfCnpj
            // cpfCnpj: metadata.cpfCnpj || '19540550000121', 
        };

        // Adicionar mobilePhone apenas se existir e tiver dígitos
        if (customerPhoneDigits.length > 0) {
            customerPayload.mobilePhone = customerPhoneDigits;
        }

        console.log('Payload para criar cliente Asaas:', customerPayload);

        try {
            const api = getAsaasAPI();
            const response = await api.post('/api/v3/customers', customerPayload);
            customerId = response.data.id; // Obter o novo ID
            console.log(`Cliente Asaas criado com sucesso para usuário ${userId}: ${customerId}`);

            // 5. Salvar NOVO ID em AMBOS os lugares
            // 5a. Salvar nos Metadados
            const updatedMetadata = { ...metadata, asaas_customer_id: customerId };
            const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                { user_metadata: updatedMetadata }
            );
            if (updateMetaError) {
                console.error(`Erro ao atualizar metadata do usuário ${userId} com NOVO Asaas ID:`, updateMetaError);
            } else {
                console.log(`Metadata do usuário ${userId} atualizado com sucesso (novo ID).`);
            }

            // 5b. Salvar na Tabela users
            const { error: updateDbError } = await supabaseAdmin
                .from('users')
                .update({ asaas_customer_id: customerId, updated_at: new Date().toISOString() })
                .eq('id', userId);
            if (updateDbError) {
                console.error(`Erro ao atualizar tabela users para usuário ${userId} com NOVO Asaas ID:`, updateDbError);
            } else {
                console.log(`Tabela users do usuário ${userId} atualizada com sucesso (novo ID).`);
            }

        } catch (error) {
            console.error(`Erro ao criar cliente Asaas para usuário ${userId}:`, error.response?.data || error.message);
            if (error.response) {
                console.error('[findOrCreateCustomer ERROR] Status:', error.response.status);
                console.error('[findOrCreateCustomer ERROR] Headers:', error.response.headers);
            }
            return null; // Falha na criação
        }
    }

    // Retornar o ID do cliente (seja ele existente ou recém-criado)
    return customerId;
};

/**
 * Cria uma nova cobrança no Asaas.
 *
 * @param {string} customerId - O ID do cliente Asaas.
 * @param {object} chargeDetails - Detalhes da cobrança.
 * @param {number} chargeDetails.value - O valor da cobrança.
 * @param {string} chargeDetails.dueDate - Data de vencimento (YYYY-MM-DD).
 * @param {string} chargeDetails.description - Descrição da cobrança.
 * @param {string} [chargeDetails.billingType="UNDEFINED"] - Tipo de cobrança (BOLETO, CREDIT_CARD, PIX, UNDEFINED).
 * @returns {Promise<object|null>} Os dados da cobrança criada ou null em caso de erro.
 */
export const createCharge = async (customerId, chargeDetails) => {
    const { 
        value, 
        dueDate, 
        description, 
        billingType = 'UNDEFINED' // Permite Boleto, Pix, etc., definidos pelo Asaas
    } = chargeDetails;

    if (!customerId || !value || !dueDate || !description) {
        console.error('Dados incompletos para criar cobrança Asaas:', { customerId, value, dueDate, description });
        return null;
    }

    const chargePayload = {
        customer: customerId,
        billingType,
        value,
        dueDate,
        description,
        // Adicionar outros campos se necessário (ex: externalReference)
    };

    console.log('Criando cobrança Asaas com payload:', chargePayload);

    try {
        // Obter a instância Axios configurada AQUI
        const api = getAsaasAPI(); 
        // A baseURL (https://api-sandbox.asaas.com/) não inclui /api/v3
        // O endpoint de pagamentos é /v3/payments, então precisamos do caminho completo
        const response = await api.post('/api/v3/payments', chargePayload); 
        console.log('Cobrança Asaas criada com sucesso:', response.data.id);
        return response.data; // Retorna o objeto completo da cobrança
    } catch (error) {
        console.error('Erro ao criar cobrança Asaas:', error.response?.data || error.message);
         if (error.response) {
            console.error('[createCharge ERROR] Status:', error.response.status);
            console.error('[createCharge ERROR] Headers:', error.response.headers);
        }
        return null;
    }
};

/**
 * Atualiza dados de um cliente existente no Asaas.
 *
 * @param {string} userId - O ID do usuário Supabase.
 * @param {object} customerData - Objeto contendo os dados a serem atualizados (ex: { cpfCnpj: '...' }).
 * @returns {Promise<boolean>} True se a atualização foi bem-sucedida, false caso contrário.
 */
export const updateAsaasCustomer = async (userId, customerData) => {
    if (!supabaseAdmin) {
        console.error('[updateAsaasCustomer] Supabase Admin client não inicializado.');
        return false;
    }
    if (!userId || !customerData || Object.keys(customerData).length === 0) {
        console.error('[updateAsaasCustomer] ID do usuário ou dados para atualização inválidos.');
        return false;
    }

    let asaasCustomerId = null;

    // 1. Buscar Asaas Customer ID (priorizando tabela users)
    try {
        const { data: dbUser, error: dbError } = await supabaseAdmin
            .from('users')
            .select('asaas_customer_id')
            .eq('id', userId)
            .maybeSingle();

        if (dbError) {
            console.error(`[updateAsaasCustomer] Erro ao buscar usuário ${userId} na tabela users:`, dbError);
            // Tentar buscar nos metadados como fallback
        } else if (dbUser?.asaas_customer_id) {
            asaasCustomerId = dbUser.asaas_customer_id;
        }

        // Fallback para metadados se não encontrou no DB
        if (!asaasCustomerId) {
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!authError && authUser?.user?.user_metadata?.asaas_customer_id) {
                asaasCustomerId = authUser.user.user_metadata.asaas_customer_id;
                console.warn(`[updateAsaasCustomer] ID Asaas encontrado apenas nos metadados para ${userId}. Considerar sincronizar.`);
            } else if (authError) {
                 console.error(`[updateAsaasCustomer] Erro ao buscar usuário Auth ${userId}:`, authError);
            }
        }

    } catch (e) {
        console.error(`[updateAsaasCustomer] Exceção ao buscar ID Asaas para ${userId}:`, e);
        return false;
    }

    if (!asaasCustomerId) {
        console.error(`[updateAsaasCustomer] Não foi possível encontrar o Asaas Customer ID para o usuário ${userId}.`);
        return false;
    }

    console.log(`[updateAsaasCustomer] Atualizando cliente Asaas ${asaasCustomerId} para usuário ${userId} com dados:`, customerData);

    // 2. Chamar API Asaas para atualizar
    try {
        const api = getAsaasAPI();
        // O endpoint de atualização é /v3/customers/{id}
        const response = await api.put(`/api/v3/customers/${asaasCustomerId}`, customerData);
        console.log(`[updateAsaasCustomer] Cliente Asaas ${asaasCustomerId} atualizado com sucesso.`);
        return true; // Sucesso

    } catch (error) {
        console.error(`[updateAsaasCustomer] Erro ao atualizar cliente Asaas ${asaasCustomerId}:`, error.response?.data || error.message);
        if (error.response) {
            console.error('[updateAsaasCustomer ERROR] Status:', error.response.status);
            console.error('[updateAsaasCustomer ERROR] Headers:', error.response.headers);
        }
        return false; // Falha
    }
}; 