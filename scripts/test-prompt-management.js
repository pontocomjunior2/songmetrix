import { createClient } from '@supabase/supabase-js';
import { LlmService } from '../server/services/llmService.js';
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

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Required environment variables are missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testPromptManagement() {
  try {
    console.log('🧪 Testando gerenciamento de prompts...\n');

    // 1. Criar um prompt de teste
    console.log('1️⃣ Criando prompt de teste...');
    const { data: newPrompt, error: createError } = await supabase
      .from('prompt_templates')
      .insert({
        name: 'Prompt de Teste - Insights Musicais',
        content: `Você é um especialista em marketing musical e análise de dados para rádios brasileiras.

Baseado nos dados de insight fornecidos: {{INSIGHT_DATA}}

Crie um e-mail profissional e envolvente para um programador musical que:
- Destaque o crescimento da música
- Use dados específicos para criar credibilidade
- Tenha um tom profissional mas acessível
- Inclua uma chamada para ação clara

Responda APENAS com um objeto JSON válido contendo:
- "subject": assunto do e-mail (máximo 60 caracteres)
- "body_html": corpo do e-mail em HTML com tags <h2>, <p>, <strong>, <ul>, <li>`,
        is_active: false
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar prompt:', createError);
      return;
    }

    console.log('✅ Prompt criado:', newPrompt.name);
    console.log('   ID:', newPrompt.id);

    // 2. Ativar o prompt usando a API
    console.log('\n2️⃣ Ativando prompt...');
    
    // Simular chamada da API (desativar todos e ativar o específico)
    const { error: deactivateError } = await supabase
      .from('prompt_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .gt('created_at', '1900-01-01');

    if (deactivateError) {
      console.error('❌ Erro ao desativar prompts:', deactivateError);
      return;
    }

    const { data: activateResult, error: activateError } = await supabase
      .from('prompt_templates')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', newPrompt.id)
      .select()
      .single();

    if (activateError) {
      console.error('❌ Erro ao ativar prompt:', activateError);
      return;
    }

    console.log('✅ Prompt ativado com sucesso!');

    // 3. Verificar se apenas este prompt está ativo
    console.log('\n3️⃣ Verificando prompts ativos...');
    const { data: activePrompts, error: activeError } = await supabase
      .from('prompt_templates')
      .select('id, name, is_active')
      .eq('is_active', true);

    if (activeError) {
      console.error('❌ Erro ao buscar prompts ativos:', activeError);
      return;
    }

    console.log(`✅ ${activePrompts.length} prompt(s) ativo(s):`);
    activePrompts.forEach(prompt => {
      console.log(`   - ${prompt.name} (${prompt.id})`);
    });

    // 4. Testar o LlmService com o novo prompt
    console.log('\n4️⃣ Testando LlmService com prompt do banco...');
    
    const llmService = new LlmService();
    const testInsightData = {
      userId: 'test-user-123',
      insightType: 'trending_song',
      songTitle: 'Evidências',
      artist: 'Chitãozinho & Xororó',
      currentWeekPlays: 1250,
      previousWeekPlays: 890,
      growthRate: '1.4',
      radioStation: 'Rádio Teste FM',
      timeframe: 'última semana'
    };

    try {
      const emailContent = await llmService.generateEmailContent(testInsightData);
      
      console.log('✅ E-mail gerado com sucesso!');
      console.log('📧 Assunto:', emailContent.subject);
      console.log('📝 Corpo (primeiros 200 chars):', emailContent.body_html.substring(0, 200) + '...');
      
      // Verificar se o prompt foi usado corretamente
      if (emailContent.subject && emailContent.body_html) {
        console.log('✅ Estrutura do e-mail está correta');
      } else {
        console.log('❌ Estrutura do e-mail está incorreta');
      }

    } catch (llmError) {
      console.error('❌ Erro no LlmService:', llmError.message);
    }

    // 5. Listar todos os prompts
    console.log('\n5️⃣ Listando todos os prompts...');
    const { data: allPrompts, error: listError } = await supabase
      .from('prompt_templates')
      .select('id, name, is_active, created_at')
      .order('created_at', { ascending: false });

    if (listError) {
      console.error('❌ Erro ao listar prompts:', listError);
      return;
    }

    console.log(`✅ ${allPrompts.length} prompt(s) encontrado(s):`);
    allPrompts.forEach((prompt, index) => {
      const status = prompt.is_active ? '🟢 ATIVO' : '⚪ INATIVO';
      console.log(`   ${index + 1}. ${status} ${prompt.name}`);
      console.log(`      ID: ${prompt.id}`);
      console.log(`      Criado: ${new Date(prompt.created_at).toLocaleString('pt-BR')}`);
    });

    console.log('\n🎉 Teste de gerenciamento de prompts concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro inesperado no teste:', error);
  }
}

// Executar o teste
testPromptManagement();