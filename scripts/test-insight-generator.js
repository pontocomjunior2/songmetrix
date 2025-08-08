import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

async function testInsightGenerator() {
  try {
    console.log('🧪 Teste do InsightGeneratorService - SongMetrix\n');

    // Importar os serviços
    const { LlmService } = await import('../server/services/llmService.js');
    const { InsightGeneratorService } = await import('../server/services/insightGeneratorService.js');

    console.log('📦 Serviços importados com sucesso');

    // Criar instância do LlmService
    const llmService = new LlmService();
    console.log('🤖 LlmService instanciado');

    // Criar instância do InsightGeneratorService com injeção de dependência
    const insightGenerator = new InsightGeneratorService(llmService);
    console.log('📊 InsightGeneratorService instanciado com injeção de dependência');

    // Verificar se existem usuários na tabela
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(5);

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️  Nenhum usuário encontrado na tabela users');
      console.log('💡 Para testar, adicione alguns usuários na tabela public.users');
      return;
    }

    console.log(`👥 Encontrados ${users.length} usuários para teste:`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.id})`);
    });

    console.log('\n🚀 Iniciando processo de geração de insights...');

    // Executar o processo principal
    const startTime = Date.now();
    await insightGenerator.generateInsightsForAllUsers();
    const endTime = Date.now();

    console.log(`✅ Processo concluído em ${endTime - startTime}ms`);

    // Verificar resultados
    const { data: generatedEmails, error: emailsError } = await supabase
      .from('generated_insight_emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (emailsError) {
      console.error('❌ Erro ao buscar e-mails gerados:', emailsError);
      return;
    }

    console.log(`\n📧 E-mails gerados recentemente: ${generatedEmails?.length || 0}`);
    
    if (generatedEmails && generatedEmails.length > 0) {
      generatedEmails.forEach((email, index) => {
        console.log(`\n📨 E-mail ${index + 1}:`);
        console.log(`   👤 Usuário: ${email.user_id}`);
        console.log(`   📝 Assunto: "${email.subject}"`);
        console.log(`   🎵 Tipo: ${email.insight_type}`);
        console.log(`   🔗 Deep Link: ${email.deep_link}`);
        console.log(`   📊 Status: ${email.status}`);
        console.log(`   📅 Criado: ${new Date(email.created_at).toLocaleString()}`);
        
        if (email.insight_data) {
          console.log(`   🎶 Dados: ${email.insight_data.songTitle} - ${email.insight_data.artist}`);
          console.log(`   📈 Crescimento: ${email.insight_data.previousWeekPlays} → ${email.insight_data.currentWeekPlays} (${email.insight_data.growthRate}x)`);
        }
      });
    }

    // Fechar conexões
    await insightGenerator.close();
    console.log('\n🔒 Conexões fechadas');

    console.log('\n🎉 Teste concluído com sucesso!');
    console.log('\n💡 Próximos passos:');
    console.log('   - Verifique os logs para detalhes do processamento');
    console.log('   - Confirme se os e-mails foram salvos corretamente');
    console.log('   - Teste o envio dos e-mails em draft');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('Stack:', error.stack);
  }
}

// Executar o teste
testInsightGenerator();