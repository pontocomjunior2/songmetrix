// Load environment variables first
console.log("********* EXECUTANDO server.js (NOVA TENTATIVA DOTENV) *********", new Date().toISOString()); 

import dotenv from 'dotenv';

// Tentar carregar o .env e verificar o resultado
let dotenvResult;
try {
  // Usar path absoluto para garantir que ele encontre o arquivo
  // __dirname pode não funcionar como esperado em ES Modules puros sem ajustes
  // Vamos usar um caminho relativo mais direto
  dotenvResult = dotenv.config({ path: '../.env.production' }); 
  
  if (dotenvResult.error) {
    // Se dotenvResult.error existe, houve um erro ao carregar
    console.error('[ERROR] Erro ao carregar o arquivo .env da raiz:', dotenvResult.error);
  } else if (dotenvResult.parsed) {
    // Se dotenvResult.parsed existe, o arquivo foi carregado e parseado com sucesso
    console.log('[SUCCESS] Arquivo .env da raiz carregado e parseado com sucesso.');
    console.log('[DEBUG server.js] ASAAS_API_URL lido pelo dotenv:', process.env.ASAAS_API_URL);
    console.log('[DEBUG server.js] ASAAS_API_KEY lido pelo dotenv:', process.env.ASAAS_API_KEY ? 'Presente' : 'Ausente');
    console.log('[DEBUG server.js] POSTGRES_HOST lido:', process.env.POSTGRES_HOST);
    console.log('[DEBUG server.js] SUPABASE_SERVICE_ROLE_KEY lido:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Presente' : 'Ausente');
  } else {
    // Caso o arquivo exista mas esteja vazio ou algo inesperado ocorreu
    console.warn('[WARN] dotenv.config executado, mas não retornou erro nem dados parseados. Verifique o arquivo .env.production.');
  }

} catch (error) {
  // Capturar qualquer erro que possa ocorrer durante a execução do dotenv.config
  console.error('[FATAL ERROR] Exceção ao tentar carregar .env:', error);
  // Considerar sair do processo se o .env for crítico
  // process.exit(1);
}

// ===== CONTINUAÇÃO DO CÓDIGO =====
// Garantir que os imports necessários venham DEPOIS do dotenv
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto'; 
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import cors from 'cors';
import { format } from 'date-fns';
import { authenticateBasicUser, authenticateUser } from './auth-middleware.js';
import { createClient } from '@supabase/supabase-js';
import { reportQuery } from './report-query.js';
import registerRoutes from './index.js';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verify environment variables are loaded
console.log('Environment variables loaded (verificação posterior):', {
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_PORT: process.env.POSTGRES_PORT,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  NODE_ENV: process.env.NODE_ENV
});

// Log environment variables for debugging
console.log('Loading environment variables...');
console.log('Database configuration:', {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT
});

const app = express();

// CONFIGURAÇÃO CORS - ADICIONAR AQUI
const allowedOrigins = [
    'http://localhost:5173', // Seu frontend Vite
    // Adicione outras origens permitidas se necessário (ex: URL de produção)
    // 'https://app.songmetrix.com.br' // URL antiga
    'https://songmetrix.com.br' // URL de produção CORRETA
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (ex: Postman, curl) OU se a origem está na lista
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origem não permitida bloqueada: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeçalhos permitidos
  credentials: true // Se você precisar enviar cookies/auth headers
};

app.use(cors(corsOptions));
// FIM DA CONFIGURAÇÃO CORS

// ROTA TEMPORÁRIA - AGORA PARA RESETAR plan_id PARA TRIAL
app.post('/api/temp/reset-plan-trial', authenticateBasicUser, async (req, res) => { // Mudar nome da rota
    // Segurança básica: verificar se é admin ou usuário específico (ajuste conforme necessário)
    if (req.user?.planId !== 'ADMIN' && req.user?.id !== '81e7583f-bc8e-40e1-a916-019834dae7a8') {
         return res.status(403).json({ error: 'Acesso negado' });
    }

    const targetUserId = '81e7583f-bc8e-40e1-a916-019834dae7a8'; // ID do seu usuário de teste
    const newPlanId = 'TRIAL'; // Definir para TRIAL

    console.log(`[TEMP] Tentando definir plan_id='${newPlanId}' nos metadados do usuário ${targetUserId}`);

    try {
        // 1. Obter metadados atuais
        const { data: userData, error: getError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
        if (getError) throw getError;
        if (!userData || !userData.user) return res.status(404).json({ error: 'Usuário alvo não encontrado.' });

        const currentMetadata = userData.user.user_metadata || {};
        console.log('[TEMP] Metadados atuais:', currentMetadata);

        // 2. Verificar se já está TRIAL
        if (currentMetadata.plan_id === newPlanId) {
            console.log(`[TEMP] plan_id já é '${newPlanId}'. Nenhuma alteração necessária.`);
             return res.status(200).json({ success: true, message: `plan_id já é '${newPlanId}'.` });
        }

        // 3. Criar novos metadados com plan_id atualizado
        const newMetadata = { ...currentMetadata, plan_id: newPlanId };
        console.log('[TEMP] Novos metadados a serem salvos:', newMetadata);

        // 4. Atualizar metadados
        const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUserId,
            { user_metadata: newMetadata }
        );

        if (updateError) throw updateError;

        console.log(`[TEMP] Metadados atualizados com sucesso para ${targetUserId}. plan_id definido para '${newPlanId}'.`);
        res.status(200).json({ success: true, message: `plan_id definido para '${newPlanId}' com sucesso.`, metadata: updateData.user?.user_metadata });

    } catch (error) {
        console.error(`[TEMP] Erro ao definir plan_id='${newPlanId}' para ${targetUserId}:`, error);
        res.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
    }
});
// FIM DA ROTA TEMPORÁRIA

// MANTER O HANDLER COMPLETO DO WEBHOOK NO TOPO
console.log('[DEBUG] Definindo rota POST /webhook/asaas (HANDLER COMPLETO NO TOPO)'); 

// Middleware para o webhook do Asaas (precisa do corpo raw ANTES do express.json)
app.post('/webhook/asaas', express.raw({ type: 'application/json' }), async (req, res, next) => {
  console.log('[Webhook Asaas] Recebido - Headers:', req.headers);
  // Acessar corpo raw como Buffer: req.body
  const rawBody = req.body;
  
  // ---- VERIFICAÇÃO DO TOKEN ----
  const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook Asaas] Erro: ASAAS_WEBHOOK_SECRET não definido no .env');
    return res.status(500).send('Webhook secret configuration error');
  }

  let event;
  try {
    // 1. Obter o token do header (busca case-insensitive)
    const receivedToken = req.headers['asaas-access-token'] || req.headers['Asaas-Access-Token']; 
    if (!receivedToken) {
       console.warn("[Webhook Asaas] Header de autenticação 'asaas-access-token' ausente.");
       return res.status(400).send('Missing authentication token header');
    }

    // 2. Obter o token esperado do .env
    const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;

    // 3. Comparar os tokens
    if (receivedToken !== expectedToken) {
        console.warn(`[Webhook Asaas] Token inválido! Recebido (parcial): ${receivedToken.substring(0, 3)}..., Esperado (parcial): ${expectedToken ? expectedToken.substring(0, 3) + '...' : 'N/A'}`);
        return res.status(401).send('Invalid token'); // Usar 401 Unauthorized
    }

    console.log('[Webhook Asaas] Token verificado com sucesso!');

    // Se o token for válido, parseamos o corpo:
    event = JSON.parse(rawBody.toString());
    console.log('[Webhook Asaas] Evento parseado:', JSON.stringify(event, null, 2));

  } catch (err) {
    console.error('[Webhook Asaas] Erro ao verificar token ou parsear corpo:', err.message);
    // Usamos req.body aqui pois rawBody pode não estar definido se o erro ocorreu antes
    console.error('[Webhook Asaas] Corpo recebido (se disponível):', req.body ? req.body.toString() : 'N/A'); 
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ---- PASSO 4: Processar o Evento ----
  // Responder OK imediatamente para o Asaas é CRUCIAL
  res.status(200).send('OK');

  // Processar o evento em background (depois de responder OK)
  try {
    const eventType = event.event; 
    const paymentData = event.payment; 

    console.log(`[Webhook Asaas] Processando evento: ${eventType}`);

    // Focar em eventos de pagamento bem-sucedido
    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      const asaasCustomerId = paymentData?.customer;
      const paymentId = paymentData?.id;

      if (!asaasCustomerId) {
        console.warn('[Webhook Asaas] Evento de pagamento sem ID do cliente Asaas:', paymentId);
        return; // Não podemos prosseguir sem o ID do cliente
      }

      console.log(`[Webhook Asaas] Pagamento ${paymentId} recebido/confirmado para cliente Asaas ${asaasCustomerId}`);

      // Encontrar usuário Supabase pelo asaas_customer_id
      const { data: user, error: findError } = await supabaseAdmin
        .from('users')
        .select('id, status') 
        .eq('asaas_customer_id', asaasCustomerId)
        .single();

      if (findError) {
        console.error(`[Webhook Asaas] Erro ao buscar usuário com asaas_customer_id ${asaasCustomerId}:`, findError);
        return;
      }

      if (!user) {
        console.warn(`[Webhook Asaas] Usuário Supabase não encontrado para cliente Asaas ${asaasCustomerId}`);
        return;
      }

      const supabaseUserId = user.id;
      console.log(`[Webhook Asaas] Usuário Supabase encontrado: ${supabaseUserId}, Status atual: ${user.status}`);

      // Atualizar status se necessário -> AGORA ATUALIZAR plan_id
      // if (user.status !== 'ATIVO') { // Comentando a verificação antiga baseada no status do DB
        console.log(`[Webhook Asaas] Atualizando plan_id para ATIVO para usuário ${supabaseUserId}`);
        
        /* // Removendo atualização na tabela users, focaremos nos metadados
        // 1. Atualizar tabela 'users'
        const { data: updateDbData, error: updateDbError } = await supabaseAdmin 
          .from('users')
          .update({ status: 'ATIVO', updated_at: new Date().toISOString() })
          .eq('id', supabaseUserId)
          .select(); 

        if (updateDbError) {
          console.error(`[Webhook Asaas] Erro ao atualizar status na tabela users para ${supabaseUserId}:`, updateDbError);
    } else {
          console.log(`[Webhook Asaas] Resultado da atualização na tabela users:`, JSON.stringify(updateDbData)); 
        }
        */

        // 2. Atualizar metadados do Supabase Auth (plan_id e status para consistência temporária)
        const { data: authUser, error: authGetError } = await supabaseAdmin.auth.admin.getUserById(supabaseUserId);
        if (authGetError) {
           console.error(`[Webhook Asaas] Erro ao buscar usuário Auth ${supabaseUserId} para atualizar metadados:`, authGetError);
        } else if (authUser) {
            const currentMetadata = authUser.user.user_metadata || {};
            // Define o novo plan_id e também o status para manter consistência por enquanto
            // USAR 'ATIVO' EM MAIÚSCULAS PARA CONSISTÊNCIA
            const updatedMetadata = { ...currentMetadata, plan_id: 'ATIVO', status: 'ATIVO' }; 
            const { data: updateMetaData, error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById( 
              supabaseUserId,
              { user_metadata: updatedMetadata } 
            );
            if (updateMetaError) {
               console.error(`[Webhook Asaas] Erro ao atualizar metadados Auth para ${supabaseUserId}:`, updateMetaError);
            } else {
              console.log(`[Webhook Asaas] Resultado da atualização de metadados Auth:`, JSON.stringify(updateMetaData));
              
              // ADICIONAR: Atualizar plan_id também na tabela public.users
              const { error: updateDbPlanError } = await supabaseAdmin
                .from('users')
                .update({ plan_id: 'ATIVO', updated_at: new Date().toISOString() }) // Atualizar plan_id aqui
                .eq('id', supabaseUserId);

              if (updateDbPlanError) {
                  console.error(`Erro ao atualizar plan_id na tabela users para ${supabaseUserId}:`, updateDbPlanError);
              } else {
                  console.log(`plan_id ATIVO aplicado na tabela users para usuário ${supabaseUserId}.`);
              }
              // FIM DA ADIÇÃO
            }
        } 
        console.log(`[Webhook Asaas] plan_id ATIVO aplicado nos metadados para usuário ${supabaseUserId}`);
      /* // Fim do if antigo
      } else {
        console.log(`[Webhook Asaas] Usuário ${supabaseUserId} já está ATIVO.`);
      }
      */

      // Atualizar plano (Auth metadata e tabela users)
      if (newPlanId) {
        console.log(`[Webhook Asaas] Tentando ATIVAR/ATUALIZAR plano para ${newPlanId} para usuário ${supabaseUserId}`);
        try {
            await updateUserPlan(supabaseUserId, newPlanId);
            console.log(`[Webhook Asaas] Plano do usuário ${supabaseUserId} atualizado para ${newPlanId} com sucesso.`);
            // Sincronizar após atualização bem-sucedida
            await syncUserWithSendPulse({ id: supabaseUserId, email: userEmail, plan_id: newPlanId }); // Passar plan_id atualizado
        } catch (updateError) {
            console.error(`[Webhook Asaas] Erro ao atualizar plano para ${newPlanId} para usuário ${supabaseUserId}:`, updateError);
        }
      } else {
          console.warn(`[Webhook Asaas] Não foi possível determinar o novo plan_id para o pagamento ${paymentId}`);
      }

    // --- ADICIONAR LÓGICA PARA DESATIVAÇÃO ---
    } else if (
        // eventType === 'SUBSCRIPTION_EXPIRED' || // REMOVER ESTE
        eventType === 'SUBSCRIPTION_INACTIVATED' || // ADICIONAR ESTE
        eventType === 'PAYMENT_OVERDUE' ||        
        eventType === 'SUBSCRIPTION_DELETED' ||   
        eventType === 'PAYMENT_CHARGEBACK_REQUESTED' 
    ) {
        console.log(`[Webhook Asaas] Evento de DESATIVAÇÃO/INATIVAÇÃO recebido: ${eventType}`);

        // Extrair ID do cliente Asaas (pode variar ligeiramente por evento)
        let asaasCustomerId;
        if (event.payment) {
            asaasCustomerId = event.payment.customer;
        } else if (event.subscription) {
            asaasCustomerId = event.subscription.customer;
        } else if (event.chargeback) { // Para PAYMENT_CHARGEBACK_REQUESTED
             // Verificar estrutura exata do payload chargeback - pode ser event.payment.customer
             asaasCustomerId = event.chargeback.customer || event.payment?.customer; 
        } else {
             // Tentar obter de um campo genérico 'customer' se existir
             asaasCustomerId = event.customer;
        }

        if (!asaasCustomerId) {
            console.warn(`[Webhook Asaas - ${eventType}] Evento sem ID do cliente Asaas. Payload:`, JSON.stringify(event));
            return; // Não podemos prosseguir
        }

        console.log(`[Webhook Asaas - ${eventType}] Tentando DESATIVAR plano (definir como FREE) para cliente Asaas ${asaasCustomerId}`);

        // Encontrar usuário Supabase pelo asaas_customer_id
        const { data: user, error: findError } = await supabaseAdmin
            .from('users')
            .select('id, plan_id') // Selecionar plan_id atual para log
            .eq('asaas_customer_id', asaasCustomerId)
            .single();

        if (findError) {
            // Logar erro, mas não retornar erro 500 para Asaas (já respondemos 200)
            console.error(`[Webhook Asaas - ${eventType}] Erro ao buscar usuário com asaas_customer_id ${asaasCustomerId}:`, findError);
            return; // Parar processamento deste evento
        }

        if (!user) {
            console.warn(`[Webhook Asaas - ${eventType}] Usuário Supabase não encontrado para cliente Asaas ${asaasCustomerId}`);
            return; // Parar processamento deste evento
        }

        const supabaseUserId = user.id;
        const currentPlanId = user.plan_id;
        
        // Evitar downgrade desnecessário se já for FREE
        if (currentPlanId === 'FREE') {
            console.log(`[Webhook Asaas - ${eventType}] Usuário ${supabaseUserId} já está com plano 'FREE'. Nenhuma ação necessária.`);
            return;
        }

        console.log(`[Webhook Asaas - ${eventType}] Usuário Supabase ${supabaseUserId} encontrado. Plano atual: ${currentPlanId}. Definindo plano como 'FREE'.`);

        // Definir plano como 'FREE'
        const newPlanId = 'FREE';

        // Atualizar metadados do Auth e tabela 'users'
        try {
            await updateUserPlan(supabaseUserId, newPlanId); // Passar 'FREE'
            console.log(`[Webhook Asaas - ${eventType}] Plano do usuário ${supabaseUserId} definido como 'FREE' com sucesso.`);
            // NÃO sincronizar com SendPulse/Brevo em caso de desativação por padrão
        } catch (updateError) {
            console.error(`[Webhook Asaas - ${eventType}] Erro ao definir plano como 'FREE' para usuário ${supabaseUserId}:`, updateError);
        }

    } else {
        // Evento não tratado explicitamente
        console.log(`[Webhook Asaas] Evento ${eventType} recebido, mas não há ação definida para ele.`);
    }

  } catch (err) {
    // Logar erro no processamento do evento, mas não enviar erro 500 para Asaas
    console.error('[Webhook Asaas] Erro ao processar evento após resposta OK:', err);
  }
});

// Função auxiliar para atualizar o plano do usuário (Metadados + Tabela)
async function updateUserPlan(userId, newPlanId) {
    if (!supabaseAdmin || !userId || !newPlanId) {
        throw new Error('updateUserPlan: Parâmetros inválidos.');
    }

    console.log(`[updateUserPlan] Atualizando plano para '${newPlanId}' para usuário ${userId}`);

    // 1. Atualizar Metadados do Auth
    console.log(`[updateUserPlan] Buscando metadados atuais do Auth para ${userId}`);
    const { data: authUserData, error: getAuthError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getAuthError) {
        console.error(`[updateUserPlan] Erro ao buscar usuário no Auth ${userId}:`, getAuthError);
        throw new Error(`Falha ao buscar dados de autenticação do usuário: ${getAuthError.message}`);
    }
    if (!authUserData || !authUserData.user) {
         console.error(`[updateUserPlan] Usuário ${userId} não encontrado no Auth.`);
        throw new Error('Usuário não encontrado na autenticação.');
    }

    const currentMetadata = authUserData.user.user_metadata || {};
    const newMetadata = { ...currentMetadata, plan_id: newPlanId };
    console.log(`[updateUserPlan] Atualizando metadados do Auth para ${userId}:`, newMetadata);
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { user_metadata: newMetadata }
    );
    if (updateAuthError) {
        console.error(`[updateUserPlan] Erro ao atualizar metadados do Auth para ${userId}:`, updateAuthError);
        throw new Error(`Falha ao atualizar metadados de autenticação: ${updateAuthError.message}`);
    }
    console.log(`[updateUserPlan] Metadados do Auth atualizados para ${userId}.`);

    // 2. Atualizar Tabela 'users'
    console.log(`[updateUserPlan] Atualizando tabela 'users' para ${userId}`);
    const { error: updateTableError } = await supabaseAdmin
        .from('users')
        .update({ plan_id: newPlanId, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (updateTableError) {
        console.error(`[updateUserPlan] Erro ao atualizar tabela 'users' para ${userId}:`, updateTableError);
        throw new Error(`Falha ao atualizar tabela de usuários: ${updateTableError.message}`);
    }
    console.log(`[updateUserPlan] Tabela 'users' atualizada para ${userId}.`);
    console.log(`[updateUserPlan] Plano para usuário ${userId} atualizado com sucesso para '${newPlanId}' em ambos os locais.`);
}

// Configurar body parser DEPOIS do handler do webhook e DEPOIS do CORS
app.use(express.json());

// Log de todas as requisições (pode vir depois do express.json)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Configurar middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
console.log('Diretório de arquivos estáticos:', path.join(__dirname, 'public'));

// Verificar se o diretório de uploads existe
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Diretório de uploads criado:', uploadsDir);
} else {
  console.log('Diretório de uploads existente:', uploadsDir);
  // Listar arquivos no diretório de uploads
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log('Arquivos no diretório de uploads:', files);
  } catch (error) {
    console.error('Erro ao listar arquivos no diretório de uploads:', error);
  }
}

// Registrar as rotas DEPOIS do CORS e body-parser
registerRoutes(app);

// Proxy para redirecionar requisições de email para o servidor de email
// Em desenvolvimento, a aplicação client aponta diretamente para o servidor de email
// Em produção, as requisições passam por este proxy
if (process.env.NODE_ENV === 'production') {
  const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
  
  console.log(`Configurando proxy para servidor de email: ${emailServerUrl}`);
  
  app.use('/api/email', createProxyMiddleware({
    target: emailServerUrl,
    changeOrigin: true,
    pathRewrite: {
      '^/api/email': '/api/email'
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxy email request to: ${emailServerUrl}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
      console.error('Proxy email error:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        error: 'Proxy email error',
        message: err.message
      }));
    }
  }));
}

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
});

// Initialize database pool
console.log('Initializing database pool with:', {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT
});

// Create Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null; // Inicializar como null

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(
      supabaseUrl, 
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('[SUCCESS] Cliente Supabase Admin inicializado.');
  } catch (error) {
    console.error('[FATAL ERROR] Falha ao inicializar cliente Supabase Admin:', error);
  }
} else {
  console.error('[FATAL ERROR] Variáveis VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas no ambiente. Cliente Supabase Admin não inicializado.');
  // Você pode querer impedir o servidor de continuar se o Supabase Admin for essencial
  // process.exit(1);
}

// Test database connection (usará o pool importado)
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Conexão com o banco de dados estabelecida com sucesso');
    client.release();
  } catch (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    console.log('Tentando reconectar em 5 segundos...');
    setTimeout(testConnection, 5000);
  }
};

testConnection();

// Helper function to safely execute database queries (usará o pool importado)
const safeQuery = async (query, params = []) => {
  if (!pool) {
    console.error('Pool de conexões não disponível');
    return { rows: [] };
  }

  try {
    console.log('Executing query with params:', { query, params });
    const result = await pool.query(query, params);
    console.log('Query executed successfully:', result);
    return result;
  } catch (error) {
    console.error('Erro ao executar query:', error);
    console.error('Query details:', { query, params });
    console.error('Error stack:', error.stack);
    return { rows: [] };
  }
};


// Rotas públicas
// Remove Stripe route
// app.post('/api/create-checkout-session', createCheckoutSession);

// Rota para verificar status do usuário
app.post('/api/users/status', authenticateBasicUser, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Checking status for user:', userId);

    const query = `
      SELECT status
      FROM users
      WHERE id = $1
    `;

    const result = await safeQuery(query, [userId]);
    console.log('Query result:', result);
    
    if (!result.rows || result.rows.length === 0) {
      console.log('User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User status:', result.rows[0].status);
    res.json({ status: result.rows[0].status });
  } catch (error) {
    console.error('POST /api/users/status - Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Rotas com autenticação básica (sem verificação de paid/admin)
// A definição de /api/radios/status foi movida para server/routes/radios.js
// app.get('/api/radios/status', async (req, res) => { ... antiga definição removida ...

app.post('/api/radios/favorite', authenticateBasicUser, async (req, res) => {
  try {
    const { radioName, favorite } = req.body;
    
    if (!radioName) {
      return res.status(400).json({ error: 'Nome da rádio não fornecido' });
    }

    // Get current favorite radios from metadata
    let favoriteRadios = req.user.user_metadata?.favorite_radios || [];

    if (favorite && !favoriteRadios.includes(radioName)) {
      favoriteRadios.push(radioName);
    } else if (!favorite) {
      favoriteRadios = favoriteRadios.filter(radio => radio !== radioName);
    }

    // Update user metadata with new favorite radios
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      {
        user_metadata: {
          ...req.user.user_metadata,
          favorite_radios: favoriteRadios
        }
      }
    );

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }

    // Buscar status atualizado das rádios
    const query = `
      WITH latest_entries AS (
        SELECT 
          name,
          MAX(date + time::time) as last_update
        FROM music_log
        GROUP BY name
      )
      SELECT 
        name,
        last_update
      FROM latest_entries
      WHERE name = ANY($1::text[])
      ORDER BY name
    `;

    const result = await safeQuery(query, [favoriteRadios]);
    
    const currentTime = new Date();
    const radiosStatus = result.rows.map(row => {
      const lastUpdate = new Date(row.last_update);
      const timeDiff = currentTime.getTime() - lastUpdate.getTime();
      const isOnline = timeDiff <= 10 * 60 * 1000; // 10 minutos

      return {
        name: row.name,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        lastUpdate: row.last_update,
        isFavorite: favoriteRadios.includes(row.name)
      };
    });

    res.json({ 
      success: true, 
      favoriteRadios,
      radiosStatus
    });
  } catch (error) {
    console.error('POST /api/radios/favorite - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rotas de abreviações de rádios
app.get('/api/radio-abbreviations', authenticateBasicUser, async (req, res) => {
  try {
    console.log('[GET /api/radio-abbreviations] Iniciando busca de abreviações');
    
    // Verificar se a tabela radio_abbreviations existe
    let hasAbbreviationsTable = false;
    try {
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'radio_abbreviations'
        )
      `;
      
      const tableExists = await safeQuery(checkTableQuery);
      hasAbbreviationsTable = tableExists.rows[0].exists;
    } catch (error) {
      console.log('Erro ao verificar tabela radio_abbreviations:', error);
    }
    
    // Consulta SQL para obter todas as rádios da tabela music_log
    const query = `
      SELECT DISTINCT 
        name as radio_name
      FROM music_log 
      ORDER BY name
    `;
    
    console.log('[GET /api/radio-abbreviations] Executando consulta SQL:', query);
    
    // Executar a consulta no banco de dados
    const result = await safeQuery(query);
    
    console.log('[GET /api/radio-abbreviations] Resultado da consulta SQL. Linhas retornadas:', result.rows.length);
    console.log(`[GET /api/radio-abbreviations] Primeiras 5 rádios: ${JSON.stringify(result.rows.slice(0, 5))}`);
    
    // Buscar abreviações da tabela radio_abbreviations se ela existir
    let abbreviationsMap = {};
    if (hasAbbreviationsTable) {
      try {
        const abbrevQuery = `SELECT radio_name, abbreviation FROM radio_abbreviations`;
        const abbrevResult = await safeQuery(abbrevQuery);
        
        // Criar um mapa de abreviações
        abbreviationsMap = abbrevResult.rows.reduce((map, row) => {
          map[row.radio_name] = row.abbreviation;
          return map;
        }, {});
      } catch (error) {
        console.log('Erro ao buscar abreviações da tabela:', error);
      }
    }
    
    // Processar o resultado para gerar abreviações
    let abbreviations = result.rows.map(row => ({
      radio_name: row.radio_name,
      abbreviation: abbreviationsMap[row.radio_name] || row.radio_name.substring(0, 3).toUpperCase()
    }));
    
    // Buscar abreviação personalizada do Spotify da tabela específica
    let spotifyAbbreviation = 'SFY';
    try {
      const spotifyQuery = 'SELECT abbreviation FROM spotify_abbreviation LIMIT 1';
      const spotifyResult = await safeQuery(spotifyQuery);
      if (spotifyResult.rows.length > 0) {
        spotifyAbbreviation = spotifyResult.rows[0].abbreviation;
      }
    } catch (error) {
      // Se a tabela não existir, usar o valor padrão
      console.log('Tabela spotify_abbreviation não encontrada, usando abreviação padrão');
    }
    
    // Verificar se já existe uma abreviação para o Spotify
    const spotifyExists = abbreviations.some(abbr => abbr.radio_name === 'Spotify');
    
    // Se não existir, adicionar a abreviação do Spotify
    if (!spotifyExists) {
      abbreviations.push({
        radio_name: 'Spotify',
        abbreviation: spotifyAbbreviation
      });
    }
    
    // Buscar abreviação personalizada do YouTube da tabela específica
    let youtubeAbbreviation = 'YTB';
    try {
      const youtubeQuery = 'SELECT abbreviation FROM youtube_abbreviation LIMIT 1';
      const youtubeResult = await safeQuery(youtubeQuery);
      if (youtubeResult.rows.length > 0) {
        youtubeAbbreviation = youtubeResult.rows[0].abbreviation;
      }
    } catch (error) {
      // Se a tabela não existir, usar o valor padrão
      console.log('Tabela youtube_abbreviation não encontrada, usando abreviação padrão');
    }
    
    // Verificar se já existe uma abreviação para o YouTube
    const youtubeExists = abbreviations.some(abbr => abbr.radio_name === 'Youtube');
    
    // Se não existir, adicionar a abreviação do YouTube
    if (!youtubeExists) {
      abbreviations.push({
        radio_name: 'Youtube',
        abbreviation: youtubeAbbreviation
      });
    }
    
    res.json(abbreviations);
    
    console.log(`[GET /api/radio-abbreviations] Total de abreviações enviadas: ${abbreviations.length}`);
    console.log(`[GET /api/radio-abbreviations] Inclui Spotify: ${abbreviations.some(abbr => abbr.radio_name === 'Spotify')}`);
    console.log(`[GET /api/radio-abbreviations] Inclui Youtube: ${abbreviations.some(abbr => abbr.radio_name === 'Youtube')}`);
  } catch (error) {
    console.error('GET /api/radio-abbreviations - Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar abreviações' });
  }
});

app.post('/api/radio-abbreviations', authenticateBasicUser, async (req, res) => {
  try {
    // Permissão apenas para administradores
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Permissão negada. Apenas administradores podem editar abreviações.' });
    }
    
    const { radioName, abbreviation } = req.body;
    
    if (!radioName || !abbreviation) {
      return res.status(400).json({ error: 'Nome da rádio e abreviação são obrigatórios' });
    }
    
    if (!/^[A-Z0-9]{1,3}$/.test(abbreviation)) {
      return res.status(400).json({ error: 'Abreviação deve conter de 1 a 3 caracteres (letras maiúsculas ou números)' });
    }
    
    // Caso especial para o Spotify (armazenar em uma tabela separada)
    if (radioName === 'Spotify') {
      // Verificar se já existe uma abreviação para o Spotify em uma tabela especial
      const checkSpotifyQuery = `
        SELECT * FROM spotify_abbreviation LIMIT 1
      `;
      
      try {
        const spotifyResult = await safeQuery(checkSpotifyQuery);
        
        if (spotifyResult.rows.length > 0) {
          // Atualizar a abreviação existente
          const updateSpotifyQuery = `
            UPDATE spotify_abbreviation
            SET abbreviation = $1
          `;
          await safeQuery(updateSpotifyQuery, [abbreviation]);
        } else {
          // Inserir nova abreviação
          const insertSpotifyQuery = `
            INSERT INTO spotify_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertSpotifyQuery, [abbreviation]);
        }
        
        return res.json({
          radio_name: radioName,
          abbreviation: abbreviation
        });
      } catch (error) {
        // Se a tabela não existir, criar a tabela e inserir o valor padrão
        if (error.code === '42P01') {  // Código de erro para "tabela não existe"
          const createTableQuery = `
            CREATE TABLE spotify_abbreviation (
              abbreviation VARCHAR(3) NOT NULL
            )
          `;
          await safeQuery(createTableQuery);
          
          const insertSpotifyQuery = `
            INSERT INTO spotify_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertSpotifyQuery, [abbreviation]);
          
          return res.json({
            radio_name: radioName,
            abbreviation: abbreviation
          });
        } else {
          throw error;
        }
      }
    }
    
    // Caso especial para o YouTube (armazenar em uma tabela separada)
    if (radioName === 'Youtube') {
      // Verificar se já existe uma abreviação para o YouTube em uma tabela especial
      const checkYoutubeQuery = `
        SELECT * FROM youtube_abbreviation LIMIT 1
      `;
      
      try {
        const youtubeResult = await safeQuery(checkYoutubeQuery);
        
        if (youtubeResult.rows.length > 0) {
          // Atualizar a abreviação existente
          const updateYoutubeQuery = `
            UPDATE youtube_abbreviation
            SET abbreviation = $1
          `;
          await safeQuery(updateYoutubeQuery, [abbreviation]);
        } else {
          // Inserir nova abreviação
          const insertYoutubeQuery = `
            INSERT INTO youtube_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertYoutubeQuery, [abbreviation]);
        }
        
        return res.json({
          radio_name: radioName,
          abbreviation: abbreviation
        });
      } catch (error) {
        // Se a tabela não existir, criar a tabela e inserir o valor padrão
        if (error.code === '42P01') {  // Código de erro para "tabela não existe"
          const createTableQuery = `
            CREATE TABLE youtube_abbreviation (
              abbreviation VARCHAR(3) NOT NULL
            )
          `;
          await safeQuery(createTableQuery);
          
          const insertYoutubeQuery = `
            INSERT INTO youtube_abbreviation (abbreviation)
            VALUES ($1)
          `;
          await safeQuery(insertYoutubeQuery, [abbreviation]);
          
          return res.json({
            radio_name: radioName,
            abbreviation: abbreviation
          });
        } else {
          throw error;
        }
      }
    }
    
    // Para as rádios normais, usar a tabela radio_abbreviations
    try {
      // Verificar se a tabela radio_abbreviations existe
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'radio_abbreviations'
        )
      `;
      
      const tableExists = await safeQuery(checkTableQuery);
      
      // Se a tabela não existir, criar
      if (!tableExists.rows[0].exists) {
        const createTableQuery = `
          CREATE TABLE radio_abbreviations (
            radio_name VARCHAR(255) PRIMARY KEY,
            abbreviation VARCHAR(3) NOT NULL
          )
        `;
        await safeQuery(createTableQuery);
      }
      
      // Verificar se já existe uma abreviação para esta rádio
      const checkQuery = `
        SELECT * FROM radio_abbreviations
        WHERE radio_name = $1
      `;
      
      const checkResult = await safeQuery(checkQuery, [radioName]);
      
      if (checkResult.rows.length > 0) {
        // Atualizar a abreviação existente
        const updateQuery = `
          UPDATE radio_abbreviations
          SET abbreviation = $2
          WHERE radio_name = $1
        `;
        await safeQuery(updateQuery, [radioName, abbreviation]);
      } else {
        // Inserir nova abreviação
        const insertQuery = `
          INSERT INTO radio_abbreviations (radio_name, abbreviation)
          VALUES ($1, $2)
        `;
        await safeQuery(insertQuery, [radioName, abbreviation]);
      }
      
      return res.json({
        radio_name: radioName,
        abbreviation: abbreviation
      });
    } catch (error) {
      console.error('Erro ao salvar abreviação:', error);
      throw error;
    }
  } catch (error) {
    console.error('POST /api/radio-abbreviations - Erro:', error);
    res.status(500).json({ error: 'Erro ao atualizar abreviação' });
  }
});

// Rotas protegidas (requerem paid ou admin)
app.post('/api/executions', authenticateBasicUser, async (req, res) => {
  const { filters, page = 0 } = req.body;
  const offset = page * 100;

  try {
    console.log('POST /api/executions - Corpo da requisição:', req.body);
    let query = `
      WITH adjusted_dates AS (
        SELECT 
          id,
          (date + INTERVAL '3 hours')::date as date,
          time::text,
          name as radio_name,
          artist,
          song_title,
          isrc,
          cidade as city,
          estado as state,
          genre,
          regiao as region,
          segmento as segment,
          label
        FROM music_log
      )
      SELECT * FROM adjusted_dates
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (filters.radio) {
      query += ` AND radio_name = $${paramCount}`;
      params.push(filters.radio);
      paramCount++;
    }

    if (filters.artist) {
      query += ` AND artist ILIKE $${paramCount}`;
      params.push(`%${filters.artist}%`);
      paramCount++;
    }

    if (filters.song) {
      query += ` AND song_title ILIKE $${paramCount}`;
      params.push(`%${filters.song}%`);
      paramCount++;
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.startDate, filters.endDate);
      paramCount += 2;
    }

    if (filters.startTime && filters.endTime) {
      query += ` AND time BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(filters.startTime, filters.endTime);
      paramCount += 2;
    }

    query += ` ORDER BY date DESC, time DESC LIMIT 100 OFFSET $${paramCount}`;
    params.push(offset);

    console.log('POST /api/executions - Query:', query);
    console.log('POST /api/executions - Parâmetros:', params);

    const result = await safeQuery(query, params);
    console.log('POST /api/executions - Linhas encontradas:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    console.error('POST /api/executions - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para o dashboard
// app.get('/api/dashboard', authenticateBasicUser, async (req, res) => { ... });

// Rotas para cidades e estados
app.get('/api/cities', authenticateBasicUser, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT cidade as city
      FROM music_log
      WHERE cidade IS NOT NULL
      ORDER BY cidade
    `;

    const result = await safeQuery(query);
    const cities = result.rows.map(row => row.city);
    res.json(cities);
  } catch (error) {
    console.error('GET /api/cities - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/validate-location', authenticateBasicUser, async (req, res) => {
  try {
    const { city, state } = req.query;
    
    if (!city || !state) {
      return res.status(400).json({ error: 'Cidade e estado são obrigatórios' });
    }

    const query = `
      SELECT COUNT(*) as count
      FROM (
        SELECT DISTINCT cidade, estado
        FROM music_log
        WHERE cidade = $1 AND estado = $2
      ) as location
    `;
    
    const result = await safeQuery(query, [city, state]);
    const isValid = result.rows[0].count > 0;
    
    res.json({ isValid });
  } catch (error) {
    console.error('GET /api/validate-location - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/radios/by-location', authenticateBasicUser, async (req, res) => {
  try {
    const { city, state } = req.query;
    
    if (!city && !state) {
      return res.status(400).json({ error: 'Cidade ou estado é obrigatório' });
    }

    let query = `
      SELECT DISTINCT name
      FROM music_log
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (city) {
      query += ` AND cidade = $${paramCount}`;
      params.push(city);
      paramCount++;
    }

    if (state) {
      query += ` AND estado = $${paramCount}`;
      params.push(state);
      paramCount++;
    }

    query += ` ORDER BY name`;

    const result = await safeQuery(query, params);
    const radios = result.rows.map(row => row.name);
    res.json(radios);
  } catch (error) {
    console.error('GET /api/radios/by-location - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Atualizar status do usuário (Admin)
app.put('/admin/users/:userId/status', authenticateBasicUser, async (req, res) => {
  // A verificação de ADMIN deve ser feita DENTRO da rota agora
  if (req.user?.planId !== 'ADMIN') {
      return res.status(403).json({ message: 'Acesso negado. Somente administradores.' });
  }
  const { userId } = req.params;
  const { status } = req.body;

  try {
    // Validar o status
    if (!['ADMIN', 'ATIVO', 'INATIVO', 'TRIAL'].includes(status)) {

      return res.status(400).json({ message: 'Status inválido' });
    }

    // Verificar se o usuário que faz a requisição é um admin
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', req.user.id)
      .single();

    if (adminError || adminUser?.status !== 'ADMIN') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Verificar se o usuário a ser atualizado existe e atualizar em uma única operação
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, status, updated_at')
      .maybeSingle();

    if (updateError) {
      console.error('Erro detalhado:', updateError);
      throw updateError;
    }

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    res.status(500).json({ 
      message: `Erro ao atualizar status do usuário: ${error.message}`,
      details: error
    });
  }
});

app.get('/api/states', authenticateBasicUser, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT estado as state
      FROM music_log
      WHERE estado IS NOT NULL
      ORDER BY estado
    `;

    const result = await safeQuery(query);
    const states = result.rows.map(row => row.state);
    res.json(states);
  } catch (error) {
    console.error('GET /api/states - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/report', authenticateBasicUser, async (req, res) => {
  try {
    const { startDate, endDate, radios, limit, city, state } = req.query;
    
    // Verifica se pelo menos data início e fim foram fornecidos
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Período (data início e fim) é obrigatório' });
    }

    // Verifica se há cidade ou estado selecionado
    const hasLocationFilter = city || state;

    // Se não há filtro de localização, então rádios é obrigatório
    if (!hasLocationFilter && !radios) {
      return res.status(400).json({ error: 'Selecione rádios ou um filtro de localização (cidade/estado)' });
    }

    // Prepara a query base
    let query = `
      WITH filtered_logs AS (
        SELECT 
          song_title as title,
          artist,
          name,
          date
        FROM music_log
        WHERE date BETWEEN $1 AND $2
    `;

    const params = [startDate, endDate];
    let paramCount = 2;

    // Adiciona filtros de localização se fornecidos
    if (city) {
      query += ` AND cidade = $${++paramCount}`;
      params.push(city);
    }
    if (state) {
      query += ` AND estado = $${++paramCount}`;
      params.push(state);
    }

    // Adiciona filtro de rádios se fornecido
    if (radios) {
      const radiosList = radios.split('||').map(r => r.trim());
      query += ` AND name = ANY($${++paramCount}::text[])`;
      params.push(radiosList);
    }

    // Completa a query com a contagem de execuções
    query += `
      ),
      executions_by_radio AS (
        SELECT 
          title,
          artist,
          name,
          COUNT(*) as count
        FROM filtered_logs
        GROUP BY title, artist, name
      ),
      total_executions AS (
        SELECT 
          title,
          artist,
          jsonb_object_agg(name, count) as executions,
          SUM(count) as total
        FROM executions_by_radio
        GROUP BY title, artist
      )
      SELECT *
      FROM total_executions
      ORDER BY total DESC
      LIMIT $${++paramCount}
    `;

    params.push(parseInt(limit || '100'));

    const result = await safeQuery(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/report - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.get('/api/ranking', authenticateBasicUser, async (req, res) => {
  try {
    const { startDate, endDate, startTime, endTime, radio, rankingSize = '10' } = req.query;
    const limit = parseInt(rankingSize, 10);

    let query = `
      WITH adjusted_dates AS (
        SELECT 
          artist,
          song_title,
          genre,
          (date + INTERVAL '3 hours')::date as date,
          time,
          name
        FROM music_log
      ),
      execution_counts AS (
        SELECT 
          artist,
          song_title,
          genre,
          COUNT(*) as executions
        FROM adjusted_dates
        WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (startDate && endDate) {
      query += ` AND date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    }

    if (startTime && endTime) {
      query += ` AND time BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startTime, endTime);
      paramCount += 2;
    }

    if (radio) {
      const radios = radio.split('||').map(r => r.trim()).filter(Boolean);
      if (radios.length > 0) {
        const placeholders = radios.map((_, i) => `$${paramCount + i}`).join(',');
        query += ` AND name IN (${placeholders})`;
        params.push(...radios);
        paramCount += radios.length;
      }
    }

    query += `
        GROUP BY artist, song_title, genre
      )
      SELECT 
        ROW_NUMBER() OVER (ORDER BY executions DESC) as id,
        artist,
        song_title,
        genre,
        executions
      FROM execution_counts
      ORDER BY executions DESC
      LIMIT $${paramCount}
    `;

    params.push(limit);

    console.log('GET /api/ranking - Query:', query);
    console.log('GET /api/ranking - Parâmetros:', params);

    const result = await safeQuery(query, params);
    console.log('GET /api/ranking - Linhas encontradas:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/ranking - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para simular o fim do período trial de um usuário (Admin)
app.post('/api/simulate-trial-end', authenticateBasicUser, async (req, res) => {
  // A verificação de ADMIN deve ser feita DENTRO da rota agora
  if (req.user?.planId !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    console.log(`Simulando fim do período trial para o usuário ${userId}`);

    // Obter os metadados do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error(`Erro ao obter metadados do usuário ${userId}:`, userError);
      return res.status(500).json({ error: 'Erro ao obter metadados do usuário', details: userError });
    }

    if (!userData || !userData.user) {
      console.error(`Usuário ${userId} não encontrado`);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se o usuário está em período trial
    const currentStatus = userData.user.user_metadata?.status;
    console.log(`Status atual do usuário ${userId}: ${currentStatus}`);
    
    if (currentStatus !== 'TRIAL') {
      console.log(`Usuário ${userId} não está em período trial (status: ${currentStatus}`);
      return res.status(400).json({ 
        error: 'Usuário não está em período trial',
        currentStatus 
      });
    }

    // Registrar metadados atuais
    console.log(`Metadados atuais do usuário ${userId}:`, userData.user.user_metadata);

    // Atualizar o status na tabela users
    const { error: updateDbError } = await supabaseAdmin
      .from('users')
      .update({
        status: 'INATIVO',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (updateDbError) {
      console.error(`Erro ao atualizar status do usuário ${userId} no banco:`, updateDbError);
      return res.status(500).json({ error: 'Erro ao atualizar status no banco de dados', details: updateDbError });
    }

    console.log(`Status do usuário ${userId} atualizado no banco de dados para INATIVO`);

    // Criar um novo objeto de metadados preservando os existentes
    const updatedMetadata = { ...userData.user.user_metadata, status: 'INATIVO' };
    console.log(`Novos metadados para o usuário ${userId}:`, updatedMetadata);

    // Atualizar os metadados
    const { data: updateMetaData, error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: updatedMetadata }
    );
    
    if (updateMetaError) {
      console.error(`Erro ao atualizar metadados do usuário ${userId}:`, updateMetaError);
      return res.status(500).json({ 
        error: 'Erro ao atualizar metadados do usuário', 
        details: updateMetaError,
        note: 'O status foi atualizado no banco de dados, mas não nos metadados'
      });
    }

    console.log(`Metadados do usuário ${userId} atualizados com sucesso:`, updateMetaData);

    // Verificar se o metadados foi realmente atualizado
    const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (verifyError) {
      console.error(`Erro ao verificar metadados do usuário ${userId} após atualização:`, verifyError);
    } else {
      console.log(`Metadados verificados do usuário ${userId} após atualização:`, verifyData.user.user_metadata);
      
      // Verificar se o status foi realmente atualizado
      const updatedStatus = verifyData.user.user_metadata?.status;
      if (updatedStatus !== 'INATIVO') {
        console.error(`ATENÇÃO: Status do usuário ${userId} nos metadados não foi atualizado corretamente. Esperado: INATIVO, Atual: ${updatedStatus}`);
        
        // Tentar uma abordagem alternativa para atualizar os metadados
        try {
          console.log(`Tentando abordagem alternativa para atualizar metadados do usuário ${userId}`);
          
          // Atualizar apenas o campo status nos metadados
          const { error: updateMetaRetryError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: { status: 'INATIVO' } }
          );
          
          if (updateMetaRetryError) {
            console.error(`Segunda tentativa de atualizar metadados falhou:`, updateMetaRetryError);
          } else {
            console.log(`Segunda tentativa de atualização de metadados concluída. Verificando resultado...`);
            
            // Verificar novamente
            const { data: verifyRetryData, error: verifyRetryError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!verifyRetryError && verifyRetryData.user.user_metadata?.status === 'INATIVO') {
              console.log(`Status atualizado com sucesso na segunda tentativa: ${verifyRetryData.user.user_metadata?.status}`);
            } else {
              console.error(`ALERTA: Segunda tentativa de atualizar status nos metadados também falhou`);
            }
          }
        } catch (retryError) {
          console.error(`Erro na segunda tentativa de atualizar metadados:`, retryError);
        }
      } else {
        console.log(`Status nos metadados atualizado com sucesso para: ${updatedStatus}`);
      }
    }

    // Tentar forçar invalidação de sessões (para garantir que o novo status seja aplicado)
    try {
      if (updatedStatus === 'INATIVO') {
        // Para status INATIVO, forçamos o logout
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId);
        if (signOutError) {
          console.error(`Erro ao invalidar sessões do usuário ${userId}:`, signOutError);
        } else {
          console.log(`Sessões do usuário ${userId} invalidadas com sucesso`);
        }
      } else {
        // Para outros status, o usuário precisará fazer logout e login novamente
        console.log(`O usuário ${userId} precisará fazer logout e login novamente para que o novo status (${updatedStatus}) seja aplicado completamente.`);
      }
    } catch (error) {
      console.error(`Erro ao processar sessões do usuário ${userId}:`, error);
    }

    console.log(`Simulação de fim do período trial concluída com sucesso para o usuário ${userId}`);

    res.status(200).json({ 
      message: 'Simulação de fim do período trial concluída com sucesso',
      userId,
      oldStatus: currentStatus,
      newStatus: 'INATIVO',
      oldMetadata: userData.user.user_metadata,
      newMetadata: updatedMetadata
    });
  } catch (error) {
    console.error('Erro ao simular fim do período trial:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para sincronizar status de usuários (Admin)
app.post('/api/users/sync-status', authenticateBasicUser, async (req, res) => {
  // A verificação de ADMIN deve ser feita DENTRO da rota agora
  if (req.user?.planId !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
  }
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    // Obter todos os usuários da tabela users
    const { data: usersList, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, status, created_at, updated_at');

    if (fetchError) {
      return res.status(500).json({ error: 'Erro ao obter lista de usuários', details: fetchError });
    }

    const updates = [];

    // Para cada usuário, verificar e sincronizar o status
    for (const user of usersList) {
      try {
        // Obter os metadados do usuário
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user.id);
        
        if (userError) {
          console.error(`Erro ao obter metadados do usuário ${user.id}:`, userError);
          continue;
        }
        
        const metadataStatus = userData?.user?.user_metadata?.status;
        
        // Determinar o status correto - Agora respeitamos o status do banco de dados
        // Não forçamos mais usuários recém-criados a terem status TRIAL
        let correctStatus = user.status;
        
        // Se o metadados tem um status diferente do banco, usamos o do banco
        if (metadataStatus !== correctStatus) {
          // Atualizar os metadados
          const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { user_metadata: { ...userData.user.user_metadata, status: correctStatus } }
          );
          
          if (updateMetaError) {
            console.error(`Erro ao atualizar metadados do usuário ${user.id}:`, updateMetaError);
            continue;
          }
          
          updates.push({
            id: user.id,
            email: user.email,
            oldStatus: metadataStatus,
            newStatus: correctStatus,
            metadataStatus: metadataStatus
          });
        }
      } catch (error) {
        console.error(`Erro ao processar usuário ${user.id}:`, error);
      }
    }

    res.status(200).json({ 
      message: 'Sincronização de status concluída',
      updates
    });
  } catch (error) {
    console.error('Erro ao sincronizar status dos usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar o status de um usuário específico (Admin)
app.post('/api/users/update-status', authenticateBasicUser, async (req, res) => {
  // A verificação de ADMIN deve ser feita DENTRO da rota agora
  if (req.user?.planId !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
  }
  try {
    // Verificar se o usuário é administrador
    if (req.user.user_metadata?.status !== 'ADMIN') {
      console.log('Tentativa não autorizada de atualizar status:', req.user.id);
      return res.status(403).json({ error: 'Apenas administradores podem usar esta função' });
    }

    const { userId, newStatus } = req.body;
    let currentStatus = 'INATIVO';

    if (!userId || !newStatus) {
      return res.status(400).json({ error: 'ID do usuário e novo status são obrigatórios' });
    }

    // Validar o status
    const validStatuses = ['INATIVO', 'ATIVO', 'ADMIN', 'TRIAL'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    console.log(`Atualizando status do usuário ${userId} para ${newStatus}`);

    // Obter os metadados do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error(`Erro ao obter metadados do usuário ${userId}:`, userError);
      return res.status(500).json({ error: 'Erro ao obter metadados do usuário', details: userError });
    }

    // Verificar se o usuário existe
    if (!userData || !userData.user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Registrar metadados atuais
    console.log(`Metadados atuais do usuário ${userId}:`, userData.user.user_metadata);
    currentStatus = userData.user.user_metadata?.status || 'INATIVO';
    console.log(`Status atual nos metadados: ${currentStatus}, Novo status: ${newStatus}`);

    // Obter dados completos do usuário para sincronização com Brevo
    const { data: userDetails, error: userDetailsError } = await supabaseAdmin
      .from('users')
      .select('email, full_name, whatsapp')
      .eq('id', userId)
      .single();

    if (userDetailsError || !userDetails) {
      console.error(`Erro ao obter detalhes do usuário ${userId}:`, userDetailsError);
      return res.status(500).json({ error: 'Erro ao obter detalhes do usuário', details: userDetailsError });
    }

    // Atualizar na tabela users
    const { error: updateDbError } = await supabaseAdmin
      .from('users')
      .update({
        plan_id: newStatus, // Atualizar plan_id
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (updateDbError) {
      console.error(`Erro ao atualizar status do usuário ${userId} no banco:`, updateDbError);
      return res.status(500).json({ error: 'Erro ao atualizar status no banco de dados', details: updateDbError });
    }

    console.log(`Status do usuário ${userId} atualizado no banco de dados para ${newStatus}`);

    // Certificar-se de que os metadados incluem o plan_id correto
    // Criamos um novo objeto com todos os metadados existentes + o novo plan_id
    const currentMetadata = userData.user.user_metadata || {};
    const updatedMetadata = { ...currentMetadata, plan_id: newStatus }; // Usar plan_id aqui
    console.log(`Novos metadados para o usuário ${userId}:`, updatedMetadata);

    // Utilizar a API direta do Supabase para atualização completa dos metadados
    const { data: updateMetaData, error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: updatedMetadata } // Enviar metadados com plan_id atualizado
    );
    
    if (updateMetaError) {
      console.error(`Erro ao atualizar metadados do usuário ${userId}:`, updateMetaError);
      return res.status(500).json({ 
        error: 'Erro ao atualizar metadados do usuário', 
        details: updateMetaError,
        note: 'O status foi atualizado no banco de dados, mas não nos metadados'
      });
    }

    console.log(`Metadados do usuário ${userId} atualizados com sucesso:`, updateMetaData);

    // Tentar forçar invalidação de sessões (para garantir que o novo status seja aplicado)
    try {
      if (newStatus === 'INATIVO') {
        // Para status INATIVO, forçamos o logout
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId);
        if (signOutError) {
          console.error(`Erro ao invalidar sessões do usuário ${userId}:`, signOutError);
        } else {
          console.log(`Sessões do usuário ${userId} invalidadas com sucesso`);
        }
      } else {
        // Para outros status, o usuário precisará fazer logout e login novamente
        console.log(`O usuário ${userId} precisará fazer logout e login novamente para que o novo status (${newStatus}) seja aplicado completamente.`);
      }
    } catch (error) {
      console.error(`Erro ao processar sessões do usuário ${userId}:`, error);
    }

    // ===== SINCRONIZAR COM SENDPULSE USANDO O NOVO SERVIÇO =====
    try {
      console.log(`Iniciando sincronização com SendPulse para usuário ${userId} (${userDetails.email})`);

      // Usar o novo serviço do SendPulse para sincronizar o usuário
      sendPulseSyncResult = await syncUserWithSendPulse({
        id: userId,
        email: userDetails.email,
        name: userDetails.full_name,
        status: newStatus,
        whatsapp: userDetails.whatsapp
      });

      if (sendPulseSyncResult.success) {
        console.log(`Sincronização com SendPulse concluída com sucesso: ${sendPulseSyncResult.message}`);
      } else {
        console.error(`Erro na sincronização com SendPulse: ${sendPulseSyncResult.error}`);
      }
    } catch (sendPulseError) {
      console.error(`Exceção ao sincronizar com SendPulse:`, sendPulseError);
      sendPulseSyncResult = {
        success: false,
        error: sendPulseError.message || 'Erro desconhecido ao sincronizar com SendPulse'
      };
    }

    console.log(`Status do usuário ${userId} atualizado com sucesso para ${newStatus}`);

    // Retornar resposta ANTES de sair do handler da rota /api/users/update-status
    res.status(200).json({
      message: `Status do usuário ${userId} atualizado com sucesso para ${newStatus}`,
      userId,
      oldStatus: currentStatus,
      newStatus: newStatus
    });

  } catch (error) {
    console.error(`Erro ao atualizar status do usuário ${userId}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor ao atualizar status' });
  }
}); // <-- FECHAR O HANDLER DA ROTA /api/users/update-status AQUI

// ===== ROTAS MOVIDAS PARA FORA DO HANDLER ANTERIOR =====

// Rota para buscar segmentos/formatos únicos das rádios
app.get('/api/segments', authenticateBasicUser, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT segmento as segment
      FROM music_log
      WHERE segmento IS NOT NULL
      ORDER BY segmento
    `;
    const result = await safeQuery(query);
    const segments = result.rows.map(row => row.segment);
    res.json(segments);
  } catch (error) {
    console.error('GET /api/segments - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Rota para mapear nomes de rádios para seus segmentos/formatos únicos
app.post('/api/radios/segments-map', authenticateBasicUser, async (req, res) => {
  try {
    const { radioNames } = req.body; // Espera um array de nomes de rádio
    if (!Array.isArray(radioNames) || radioNames.length === 0) {
      return res.status(400).json({ error: 'Lista de nomes de rádio é obrigatória.' });
    }

    // Usa ANY para buscar segmentos para múltiplos nomes de rádio de uma vez
    const query = `
      SELECT name, ARRAY_AGG(DISTINCT segmento) as segments
      FROM music_log
      WHERE name = ANY($1::text[]) AND segmento IS NOT NULL
      GROUP BY name;
    `;

    const result = await safeQuery(query, [radioNames]);
    const segmentsMap = result.rows.reduce((acc, row) => {
      acc[row.name] = row.segments; // Mapeia nome da rádio para array de segmentos
      return acc;
    }, {});

    // Para rádios que não foram encontradas, retorna um array vazio
    radioNames.forEach(name => {
      if (!segmentsMap[name]) {
        segmentsMap[name] = [];
      }
    });

    res.json(segmentsMap);
  } catch (error) {
    console.error('POST /api/radios/segments-map - Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ROTA PARA ATUALIZAR PLANO (ADMIN)
app.put('/api/admin/users/:userId/plan', authenticateBasicUser, async (req, res) => {
  // ADICIONAR verificação de admin AQUI
  if (req.user?.planId !== 'ADMIN') {
    console.warn(`[API PUT /admin/users/:userId/plan] Tentativa de acesso não autorizada por usuário ${req.user?.id} (plano: ${req.user?.planId})`);
    return res.status(403).json({ error: 'Acesso negado. Somente administradores.' });
  }

  const { userId } = req.params;
  const { planId: newPlanId } = req.body;

  console.log(`[API PUT /admin/users/:userId/plan] Recebido para User ${userId}, Novo Plano: ${newPlanId} por Admin ${req.user.id}`); // Logar admin ID

  const ALLOWED_PLANS_FOR_ADMIN_SET = ['FREE', 'TRIAL', 'ATIVO', 'INATIVO', 'ADMIN'];
  if (!newPlanId || !ALLOWED_PLANS_FOR_ADMIN_SET.includes(newPlanId.toUpperCase())) {
    console.warn('[API PUT /admin/users/:userId/plan] Tentativa de definir plano inválido:', newPlanId);
    return res.status(400).json({ error: 'Plano inválido fornecido.' });
  }

  try {
    // ** REUTILIZAR A FUNÇÃO updateUserPlan **
    await updateUserPlan(userId, newPlanId.toUpperCase()); // Garante que está em maiúsculas
    console.log(`[API PUT /admin/users/:userId/plan] Plano atualizado com sucesso via updateUserPlan para ${userId}. Novo plano: ${newPlanId}`);

    // Buscar o usuário atualizado para retornar dados consistentes
    const { data: updatedUserData, error: fetchUpdatedError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (fetchUpdatedError || !updatedUserData?.user) {
        console.warn(`[API PUT /admin/users/:userId/plan] Não foi possível re-buscar usuário ${userId} após atualização.`);
        // Mesmo assim, retornar sucesso pois a atualização principal funcionou
        return res.status(200).json({
            success: true,
            message: 'Plano atualizado com sucesso (usuário não re-encontrado após update).'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Plano atualizado com sucesso.',
        user: { id: updatedUserData.user.id, plan_id: updatedUserData.user.user_metadata?.plan_id }
    });

  } catch (error) {
    console.error(`[API PUT /admin/users/:userId/plan] Erro ao atualizar plano para usuário ${userId}:`, error.message || error);
    // Verificar se o erro veio da função auxiliar updateUserPlan
    if (error.message.includes('Usuário não encontrado')) {
        return res.status(404).json({ error: 'Usuário não encontrado.', details: error.message });
    }
    res.status(500).json({ error: 'Erro interno do servidor ao atualizar plano.', details: error.message || String(error) });
  }
});

// Middleware de tratamento de erros genérico (manter no final)
app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err.stack);
  res.status(500).send('Algo deu errado!');
});

// Inicialização do servidor (manter no final)
// RE-ADICIONAR A DEFINIÇÃO DE PORT
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
