import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(__dirname), '.env.production'),
  path.join(dirname(__dirname), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('✅ Loaded environment variables from:', envPath);
    break;
  }
}

// Force localhost for testing, regardless of environment
const API_BASE_URL = 'http://localhost:3001';

async function testAdminInsightRoutes() {
  try {
    console.log('🧪 Teste das Rotas de Admin de Insights - SongMetrix\n');
    console.log(`🔗 Using API Base URL: ${API_BASE_URL}`);

    // Configurar Supabase para obter token de admin
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variáveis de ambiente do Supabase não configuradas');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar um admin para teste
    const { data: admins, error: adminError } = await supabase
      .from('admins')
      .select('user_id')
      .limit(1);

    if (adminError || !admins || admins.length === 0) {
      console.error('❌ Nenhum admin encontrado. Execute: npm run add-admin USER_ID');
      return;
    }

    const adminUserId = admins[0].user_id;
    console.log(`👤 Usando admin: ${adminUserId}`);

    // Obter dados do usuário admin
    const { data: adminUser, error: userError } = await supabase.auth.admin.getUserById(adminUserId);
    
    if (userError || !adminUser.user) {
      console.error('❌ Erro ao obter dados do admin:', userError);
      return;
    }

    // Simular token JWT (em um teste real, você obteria isso do login)
    // Para este teste, vamos usar um token fictício
    const mockToken = 'mock-admin-token';
    console.log('⚠️  Usando token fictício para teste. Em produção, use token real do login.\n');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mockToken}`
    };

    // Teste 1: Iniciar geração de insights
    console.log('🚀 Teste 1: Iniciar geração de insights');
    console.log(`POST ${API_BASE_URL}/api/admin/insights/generate`);
    
    try {
      const generateResponse = await fetch(`${API_BASE_URL}/api/admin/insights/generate`, {
        method: 'POST',
        headers
      });

      const generateResult = await generateResponse.json();
      
      if (generateResponse.status === 202) {
        console.log('✅ Geração iniciada com sucesso');
        console.log(`   Status: ${generateResponse.status}`);
        console.log(`   Mensagem: ${generateResult.message}`);
        console.log(`   Iniciado por: ${generateResult.initiated_by}`);
      } else {
        console.log(`❌ Erro na geração: ${generateResponse.status}`);
        console.log(`   Erro: ${generateResult.error}`);
      }
    } catch (error) {
      console.log(`❌ Erro de conexão: ${error.message}`);
    }

    console.log('');

    // Aguardar um pouco para a geração processar
    console.log('⏳ Aguardando 3 segundos para processamento...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Teste 2: Listar rascunhos
    console.log('📋 Teste 2: Listar rascunhos');
    console.log(`GET ${API_BASE_URL}/api/admin/insights/drafts`);
    
    try {
      const draftsResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
        method: 'GET',
        headers
      });

      const draftsResult = await draftsResponse.json();
      
      if (draftsResponse.status === 200) {
        console.log('✅ Rascunhos obtidos com sucesso');
        console.log(`   Status: ${draftsResponse.status}`);
        console.log(`   Quantidade: ${draftsResult.count}`);
        
        if (draftsResult.drafts && draftsResult.drafts.length > 0) {
          console.log('   📧 Primeiros rascunhos:');
          draftsResult.drafts.slice(0, 3).forEach((draft, index) => {
            console.log(`     ${index + 1}. ID: ${draft.id}`);
            console.log(`        Usuário: ${draft.users?.email || 'N/A'}`);
            console.log(`        Assunto: "${draft.subject}"`);
            console.log(`        Tipo: ${draft.insight_type}`);
            console.log(`        Status: ${draft.status}`);
            console.log(`        Criado: ${new Date(draft.created_at).toLocaleString()}`);
          });

          // Teste 3: Aprovar um rascunho
          const firstDraft = draftsResult.drafts[0];
          console.log(`\n✅ Teste 3: Aprovar rascunho ${firstDraft.id}`);
          console.log(`POST ${API_BASE_URL}/api/admin/insights/${firstDraft.id}/approve`);
          
          try {
            const approveResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${firstDraft.id}/approve`, {
              method: 'POST',
              headers
            });

            const approveResult = await approveResponse.json();
            
            if (approveResponse.status === 200) {
              console.log('✅ Rascunho aprovado com sucesso');
              console.log(`   Status: ${approveResponse.status}`);
              console.log(`   Mensagem: ${approveResult.message}`);
              console.log(`   Aprovado por: ${approveResult.approved_by}`);

              // Teste 4: Enviar e-mail aprovado
              console.log(`\n📧 Teste 4: Enviar e-mail aprovado ${firstDraft.id}`);
              console.log(`POST ${API_BASE_URL}/api/admin/insights/${firstDraft.id}/send`);
              
              try {
                const sendResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${firstDraft.id}/send`, {
                  method: 'POST',
                  headers
                });

                const sendResult = await sendResponse.json();
                
                if (sendResponse.status === 200) {
                  console.log('✅ E-mail enviado com sucesso');
                  console.log(`   Status: ${sendResponse.status}`);
                  console.log(`   Mensagem: ${sendResult.message}`);
                  console.log(`   Destinatário: ${sendResult.recipient}`);
                  console.log(`   Enviado por: ${sendResult.sent_by}`);
                } else {
                  console.log(`❌ Erro no envio: ${sendResponse.status}`);
                  console.log(`   Erro: ${sendResult.error}`);
                  console.log(`   Detalhes: ${sendResult.details || 'N/A'}`);
                }
              } catch (error) {
                console.log(`❌ Erro de conexão no envio: ${error.message}`);
              }

            } else {
              console.log(`❌ Erro na aprovação: ${approveResponse.status}`);
              console.log(`   Erro: ${approveResult.error}`);
            }
          } catch (error) {
            console.log(`❌ Erro de conexão na aprovação: ${error.message}`);
          }

        } else {
          console.log('   ℹ️  Nenhum rascunho encontrado');
          console.log('   💡 Execute primeiro: npm run test-insight-generator');
        }
      } else {
        console.log(`❌ Erro ao buscar rascunhos: ${draftsResponse.status}`);
        console.log(`   Erro: ${draftsResult.error}`);
      }
    } catch (error) {
      console.log(`❌ Erro de conexão: ${error.message}`);
    }

    console.log('\n🎉 Testes das rotas de admin concluídos!');
    console.log('\n💡 Notas importantes:');
    console.log('   - Este teste usa token fictício. Em produção, use token real.');
    console.log('   - Verifique se o servidor está rodando na porta correta.');
    console.log('   - Confirme se as migrações SQL foram executadas.');
    console.log('   - Para testes reais, configure um admin válido.');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar o teste
testAdminInsightRoutes();