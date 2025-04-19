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
    const metadata = userData.user_metadata || {};
    const asaasCustomerId = metadata.asaas_customer_id;

    if (asaasCustomerId) {
        console.log(`Cliente Asaas encontrado no metadata para usuário ${userId}: ${asaasCustomerId}`);
        // Opcional: Verificar se o cliente ainda existe no Asaas? (GET /customers/{id})
        return asaasCustomerId;
    }

    console.log(`Cliente Asaas não encontrado no metadata para usuário ${userId}. Criando novo...`);

    // Preparar dados para criar cliente Asaas
    const customerPayload = {
        name: metadata.full_name || userData.email, 
        email: userData.email,
        cpfCnpj: metadata.cpfCnpj || '19540550000121', // CNPJ de teste
        // Adicionar mobilePhone, tentando pegar do whatsapp ou usar teste
        mobilePhone: metadata.whatsapp?.replace(/\D/g, '') || '27999999999' // Exemplo: 27999999999 
    };

    console.log('Payload para criar cliente Asaas:', customerPayload);

    try {
        // Obter a instância Axios configurada AQUI
        const api = getAsaasAPI();

        // Log detalhado ANTES da chamada Axios (usando a nova instância)
        const requestUrl = `${api.defaults.baseURL || 'URL_BASE_AUSENTE'}${'/api/v3/customers'}`; // Caminho completo necessário
        console.log(`[findOrCreateCustomer DEBUG] Tentando URL: ${requestUrl}`);
        console.log('[findOrCreateCustomer DEBUG] Headers Axios:', api.defaults.headers);
        console.log('[findOrCreateCustomer DEBUG] Payload para Enviar:', customerPayload);

        // Usar o caminho completo /api/v3/customers pois baseURL é só até .com/
        const response = await api.post('/api/v3/customers', customerPayload); 
        const newAsaasCustomerId = response.data.id;
        console.log(`Cliente Asaas criado com sucesso para usuário ${userId}: ${newAsaasCustomerId}`);

        // Atualizar user_metadata no Supabase Auth com o novo ID
        const updatedMetadata = { 
            ...metadata, 
            asaas_customer_id: newAsaasCustomerId 
        };
        
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: updatedMetadata }
        );

        if (updateError) {
            console.error(`Erro ao atualizar metadata do usuário ${userId} com Asaas ID:`, updateError);
            // Considerar como lidar com isso - o cliente Asaas foi criado, mas o ID não foi salvo.
            // Talvez tentar novamente? Logar para ação manual?
            return null; // Retornar null pois o processo não foi completo
        } else {
             console.log(`Metadata do usuário ${userId} atualizado com sucesso.`);
        }

        return newAsaasCustomerId;

    } catch (error) {
        console.error(`Erro ao criar cliente Asaas para usuário ${userId}:`, error.response?.data || error.message);
        // Logar detalhes do erro Axios se disponível
        if (error.response) {
            console.error('[findOrCreateCustomer ERROR] Status:', error.response.status);
            console.error('[findOrCreateCustomer ERROR] Headers:', error.response.headers);
        }
        if (error.request) {
            console.error('[findOrCreateCustomer ERROR] Request feita, mas sem resposta:', error.request);
        }
        return null;
    }
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