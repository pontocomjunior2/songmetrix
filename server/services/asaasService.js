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

    // ---- DEBUG TEMPORÁRIO ----
    console.log('[DEBUG getAsaasAPI] Tentando usar URL:', apiUrl);
    // Cuidado ao logar a chave completa em produção! Use apenas para debug rápido.
    console.log('[DEBUG getAsaasAPI] Tentando usar Key (parcial):', apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}` : 'NÃO DEFINIDA');
    // ---- FIM DEBUG ----

    if (!apiUrl || !apiKey) {
        console.error("[getAsaasAPI] Erro: Variáveis de ambiente ASAAS_API_URL ou ASAAS_API_KEY não definidas NO MOMENTO DA CHAMADA.");
        // Lançar erro ou retornar null pode ser apropriado aqui
        throw new Error("Configuração da API Asaas ausente");
    }

    // Log para confirmar os valores usados pela instância
    // REMOVER /api/v3 DA BASE URL
    console.log(`[getAsaasAPI] Criando/retornando instância Axios com baseURL: ${apiUrl} e API Key: ${apiKey ? 'Presente' : 'Ausente'}`);

    return axios.create({
        baseURL: apiUrl, // Ex: https://api.asaas.com ou https://sandbox.asaas.com
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
            const response = await api.post('/v3/customers', customerPayload);
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

    // Buscar a URL base da variável de ambiente VITE_BASE_URL
    const baseUrl = process.env.VITE_BASE_URL; 
    const successRedirectUrl = baseUrl ? `${baseUrl}/dashboard?pagamento=sucesso` : null;

    const chargePayload = {
        customer: customerId,
        billingType,
        value,
        dueDate,
        description,
        // Adicionar outros campos se necessário (ex: externalReference)
        // ADICIONAR CALLBACK AQUI
        callback: {
            // Usar a URL base ou um fallback (ajuste o fallback se necessário)
            // Adicionar o parâmetro ?pagamento=sucesso
            successUrl: successRedirectUrl || 'https://www.songmetrix.com.br/dashboard?pagamento=sucesso', // Usar a variável construída
            autoRedirect: true
        }
    };

    // Logar um aviso se a URL base não estiver definida
    if (!successRedirectUrl) { // Verificar a variável construída
      console.warn('Variável de ambiente VITE_BASE_URL não definida. Usando URL de fallback para redirecionamento Asaas.');
      // Considerar logar de forma mais crítica ou lançar um erro se a URL for essencial
    }

    console.log('Criando cobrança Asaas com payload:', chargePayload);

    try {
        // Obter a instância Axios configurada AQUI
        const api = getAsaasAPI(); 
        // A baseURL já está correta (sem /api/v3)
        // O endpoint de pagamentos é /v3/payments
        const response = await api.post('/v3/payments', chargePayload); 
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
 * Cria uma nova assinatura no Asaas.
 *
 * @param {string} customerId - O ID do cliente Asaas.
 * @param {object} subscriptionDetails - Detalhes da assinatura.
 * @param {number} subscriptionDetails.value - O valor a ser cobrado por ciclo.
 * @param {string} subscriptionDetails.cycle - O ciclo da assinatura (e.g., MONTHLY, SEMIANNUALLY, YEARLY).
 * @param {string} subscriptionDetails.description - Descrição da assinatura.
 * @param {string} [subscriptionDetails.billingType="UNDEFINED"] - Tipo de cobrança (BOLETO, CREDIT_CARD, PIX, UNDEFINED).
 * @param {string} [subscriptionDetails.externalReference=null] - Referência externa.
 * @param {string} [subscriptionDetails.nextDueDate=null] - Data do próximo vencimento (calculada pelo Asaas se null).
 * @param {object} [subscriptionDetails.discount=null] - Detalhes do desconto (opcional).
 * @param {object} [subscriptionDetails.fine=null] - Detalhes da multa (opcional).
 * @param {object} [subscriptionDetails.interest=null] - Detalhes dos juros (opcional).
 * @returns {Promise<object|null>} Os dados da assinatura criada ou null em caso de erro.
 */
export const createSubscription = async (customerId, subscriptionDetails) => {
    const {
        value,
        cycle,
        description,
        billingType = 'UNDEFINED',
        externalReference = null,
        nextDueDate = null,
        discount = null,
        fine = null,
        interest = null
    } = subscriptionDetails;

    if (!customerId || !value || !cycle || !description) {
        console.error('[AsaasService] Dados incompletos para criar assinatura:', {
            customerId,
            value,
            cycle,
            description
        });
        return null;
    }

    const subscriptionPayload = {
        customer: customerId,
        value,
        cycle,
        description,
        billingType,
        ...(externalReference && { externalReference }),
        ...(nextDueDate && { nextDueDate }),
        ...(discount && { discount }),
        ...(fine && { fine }),
        ...(interest && { interest })
    };

    console.log('[AsaasService] Criando assinatura Asaas com payload:', JSON.stringify(subscriptionPayload, null, 2));

    try {
        const api = getAsaasAPI();
        // Endpoint para assinaturas é /v3/subscriptions
        const response = await api.post('/v3/subscriptions', subscriptionPayload);
        console.log('Assinatura Asaas criada com sucesso:', response.data.id);
        return response.data; // Retorna o objeto completo da assinatura
    } catch (error) {
        console.error('Erro ao criar assinatura Asaas:', error.response?.data || error.message);
        if (error.response) {
            console.error('[createSubscription ERROR] Status:', error.response.status);
            console.error('[createSubscription ERROR] Headers:', error.response.headers);
        }
        return null;
    }
};

/**
 * Busca as cobranças associadas a uma assinatura no Asaas.
 *
 * @param {string} subscriptionId - O ID da assinatura Asaas.
 * @returns {Promise<object[]|null>} Um array com os objetos das cobranças ou null em caso de erro.
 */
export const getSubscriptionPayments = async (subscriptionId) => {
  if (!subscriptionId) {
    console.error('ID da assinatura não fornecido para buscar cobranças.');
    return null;
  }

  console.log(`Buscando cobranças para a assinatura Asaas ID: ${subscriptionId}`);

  try {
    const api = getAsaasAPI();
    // Endpoint para listar cobranças de uma assinatura
    // CORRIGIR CAMINHO: Remover /api
    const response = await api.get(`/v3/subscriptions/${subscriptionId}/payments`);
    console.log(`Cobranças encontradas para assinatura ${subscriptionId}:`, response.data?.data?.length || 0);
    return response.data?.data || []; // Retorna o array 'data' da resposta
  } catch (error) {
    console.error(`Erro ao buscar cobranças para assinatura ${subscriptionId}:`, error.response?.data || error.message);
    if (error.response) {
      console.error('[getSubscriptionPayments ERROR] Status:', error.response.status);
      console.error('[getSubscriptionPayments ERROR] Headers:', error.response.headers);
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

    // PREPARAR PAYLOAD CORRETO: Apenas os dados a serem atualizados
    // Remover quaisquer chaves extras como 'customerId' se vierem em customerData
    const updatePayload = { ...customerData };
    delete updatePayload.customerId; // Garantir que não estamos enviando o ID no corpo

    console.log(`[updateAsaasCustomer] Atualizando cliente Asaas ${asaasCustomerId} para usuário ${userId} com payload:`, updatePayload); // Logar o payload correto

    // 2. Chamar API Asaas para atualizar
    try {
        const api = getAsaasAPI();
        const requestUrl = `/v3/customers/${asaasCustomerId}`;
        // LOG DETALHADO DA URL FINAL
        console.log(`[updateAsaasCustomer DEBUG] Chamando PUT para: ${api.defaults.baseURL}${requestUrl}`);
        
        // O endpoint de atualização é /v3/customers/{id}
        // A baseURL já está correta (sem /api/v3), então o caminho relativo é /v3/customers/{id}
        const response = await api.put(requestUrl, updatePayload); // Usar requestUrl e updatePayload
        console.log(`[updateAsaasCustomer] Cliente Asaas ${asaasCustomerId} atualizado com sucesso.`);
        return true; // Sucesso

    } catch (error) {
        // Log mais detalhado do erro
        console.error(`[updateAsaasCustomer] Erro DETALHADO ao atualizar cliente Asaas ${asaasCustomerId}:`);
        if (error.response) {
            console.error('[updateAsaasCustomer ERROR] Status:', error.response.status);
            console.error('[updateAsaasCustomer ERROR] Headers:', error.response.headers);
            // Tentar logar o corpo da resposta de erro, se houver
            console.error('[updateAsaasCustomer ERROR] Data:', error.response.data);
        } else if (error.request) {
            // A requisição foi feita mas nenhuma resposta foi recebida
            console.error('[updateAsaasCustomer ERROR] Nenhuma resposta recebida:', error.request);
        } else {
            // Algo aconteceu ao configurar a requisição que acionou um erro
            console.error('[updateAsaasCustomer ERROR] Erro na configuração da requisição:', error.message);
        }
        // Logar o objeto de erro completo para análise
        console.error('[updateAsaasCustomer ERROR] Objeto de Erro Completo:', error);
        return false; // Falha
    }
};

/**
 * Cria uma nova cobrança parcelada via cartão de crédito (usando token) no Asaas.
 *
 * @param {string} customerId - O ID do cliente Asaas.
 * @param {object} installmentDetails - Detalhes do parcelamento.
 * @param {number} installmentDetails.value - O valor TOTAL da compra.
 * @param {number} installmentDetails.installmentCount - O número de parcelas desejado.
 * @param {string} installmentDetails.description - Descrição do parcelamento.
 * @param {string} installmentDetails.dueDate - Data de vencimento da primeira parcela (YYYY-MM-DD).
 * @param {string} installmentDetails.creditCardToken - O token do cartão obtido via API de tokenização.
 * @param {object} installmentDetails.creditCardHolderInfo - Informações do titular do cartão.
 * @param {string} installmentDetails.creditCardHolderInfo.name - Nome do titular.
 * @param {string} installmentDetails.creditCardHolderInfo.email - Email do titular.
 * @param {string} installmentDetails.creditCardHolderInfo.cpfCnpj - CPF/CNPJ do titular.
 * @param {string} [installmentDetails.creditCardHolderInfo.postalCode] - CEP.
 * @param {string} [installmentDetails.creditCardHolderInfo.addressNumber] - Número do endereço.
 * @param {string} [installmentDetails.creditCardHolderInfo.addressComplement] - Complemento.
 * @param {string} [installmentDetails.creditCardHolderInfo.phone] - Telefone.
 * @param {string} [installmentDetails.creditCardHolderInfo.mobilePhone] - Celular.
 * @param {string} [installmentDetails.externalReference=null] - Referência externa.
 * @returns {Promise<object|null>} Os dados do parcelamento criado ou null em caso de erro.
 */
export const createInstallmentWithToken = async (customerId, installmentDetails) => {
    const {
        value,
        installmentCount,
        description,
        dueDate,
        creditCardToken,
        creditCardHolderInfo,
        externalReference = null,
    } = installmentDetails;

    // Validações essenciais
    if (!customerId || !value || !installmentCount || !description || !dueDate || !creditCardToken || !creditCardHolderInfo) {
        console.error('[AsaasService] Dados incompletos para criar parcelamento com token:', {
            customerId, value, installmentCount, description, dueDate, creditCardToken, creditCardHolderInfo
        });
        return null;
    }
    if (!creditCardHolderInfo.name || !creditCardHolderInfo.email || !creditCardHolderInfo.cpfCnpj) {
        console.error('[AsaasService] Dados do titular do cartão incompletos (Nome, Email, CPF/CNPJ são obrigatórios).');
        return null;
    }

    const payload = {
        customer: customerId,
        billingType: 'CREDIT_CARD', // Obrigatório para este fluxo
        totalValue: value, // API de installments usa totalValue para > 1 parcela
        installmentCount,
        dueDate, // Vencimento da *primeira* parcela
        description,
        creditCardToken,
        creditCardHolderInfo,
        ...(externalReference && { externalReference }),
        // chargeType: 'AUTHORIZATION', // Remover para captura imediata
        // installmentValue: ... // Deixar Asaas calcular
        // remoteIp: ... // Opcional, mas recomendado se tiver
    };

    console.log('[AsaasService] Criando parcelamento Asaas com Token:', JSON.stringify(payload, null, 2));

    try {
        const api = getAsaasAPI();
        // Usar o endpoint /v3/installments 
        // CORRIGIR CAMINHO: Remover /api
        const response = await api.post('/v3/installments', payload);
        console.log('[AsaasService] Parcelamento Asaas com token criado com sucesso:', response.data?.id);
        return response.data; // Retorna o objeto completo do parcelamento
    } catch (error) {
        console.error('[AsaasService] Erro ao criar parcelamento Asaas com token:', error.response?.data || error.message);
        if (error.response) {
            console.error('[createInstallmentWithToken ERROR] Status:', error.response.status);
            console.error('[createInstallmentWithToken ERROR] Headers:', error.response.headers);
            console.error('[createInstallmentWithToken ERROR] Data:', error.response.data);
        }
        // Retornar o objeto de erro do Asaas para a rota poder tratar
        return { error: true, details: error.response?.data || { message: error.message } }; 
    }
}; 