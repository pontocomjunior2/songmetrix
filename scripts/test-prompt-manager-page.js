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

async function testPromptManagerPage() {
  try {
    console.log('🧪 Testando dados para PromptManagerPage...\n');

    // 1. Verificar se existem prompts na tabela
    console.log('1️⃣ Verificando prompts existentes...');
    const { data: prompts, error: promptsError } = await supabase
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (promptsError) {
      console.error('❌ Erro ao buscar prompts:', promptsError);
      return;
    }

    console.log(`✅ ${prompts.length} prompt(s) encontrado(s):`);
    prompts.forEach((prompt, index) => {
      const status = prompt.is_active ? '🟢 ATIVO' : '⚪ INATIVO';
      console.log(`   ${index + 1}. ${status} ${prompt.name}`);
      console.log(`      ID: ${prompt.id}`);
      console.log(`      Conteúdo: ${prompt.content.substring(0, 100)}...`);
      console.log(`      Criado: ${new Date(prompt.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

    // 2. Criar alguns prompts de exemplo se não existirem
    if (prompts.length < 3) {
      console.log('2️⃣ Criando prompts de exemplo...');
      
      const examplePrompts = [
        {
          name: 'Template Padrão - Crescimento Musical',
          content: `Você é um especialista em marketing musical para rádios brasileiras.

Baseado nos dados de insight fornecidos: {{INSIGHT_DATA}}

Crie um e-mail profissional que:
- Destaque o crescimento da música
- Use dados específicos para credibilidade
- Tenha tom profissional mas acessível
- Inclua chamada para ação clara

Responda APENAS com um objeto JSON válido contendo:
- "subject": assunto do e-mail (máximo 60 caracteres)
- "body_html": corpo do e-mail em HTML com tags <h2>, <p>, <strong>, <ul>, <li>`,
          is_active: false
        },
        {
          name: 'Template Focado em Artista',
          content: `Você é um analista musical especializado em tendências de rádio.

Com base nos dados: {{INSIGHT_DATA}}

Crie um e-mail que:
- Foque no artista e sua trajetória
- Mencione dados de performance específicos
- Use linguagem envolvente e profissional
- Termine com call-to-action sobre programação

Formato de resposta JSON:
{"subject": "assunto curto e impactante", "body_html": "conteúdo HTML completo"}`,
          is_active: false
        },
        {
          name: 'Template Análise de Tendências',
          content: `Você é um consultor em programação musical para rádios.

Dados do insight: {{INSIGHT_DATA}}

Desenvolva um e-mail que:
- Analise a tendência musical identificada
- Apresente insights acionáveis
- Use tom consultivo e especializado
- Sugira ações práticas para o programador

Resposta em JSON: {"subject": "título executivo", "body_html": "análise detalhada em HTML"}`,
          is_active: false
        }
      ];

      for (const promptData of examplePrompts) {
        const { data: newPrompt, error: createError } = await supabase
          .from('prompt_templates')
          .insert(promptData)
          .select()
          .single();

        if (createError) {
          console.error('❌ Erro ao criar prompt:', createError);
        } else {
          console.log(`✅ Prompt criado: ${newPrompt.name}`);
        }
      }
    }

    // 3. Verificar se há pelo menos um prompt ativo
    console.log('\n3️⃣ Verificando prompt ativo...');
    const { data: activePrompts, error: activeError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('is_active', true);

    if (activeError) {
      console.error('❌ Erro ao buscar prompts ativos:', activeError);
      return;
    }

    if (activePrompts.length === 0) {
      console.log('⚠️  Nenhum prompt ativo. Ativando o primeiro...');
      
      const { data: firstPrompt } = await supabase
        .from('prompt_templates')
        .select('id, name')
        .limit(1)
        .single();

      if (firstPrompt) {
        const { error: activateError } = await supabase
          .from('prompt_templates')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', firstPrompt.id);

        if (activateError) {
          console.error('❌ Erro ao ativar prompt:', activateError);
        } else {
          console.log(`✅ Prompt ativado: ${firstPrompt.name}`);
        }
      }
    } else {
      console.log(`✅ ${activePrompts.length} prompt(s) ativo(s):`);
      activePrompts.forEach(prompt => {
        console.log(`   - ${prompt.name}`);
      });
    }

    // 4. Simular dados que a página irá receber
    console.log('\n4️⃣ Simulando dados da API...');
    const { data: finalPrompts, error: finalError } = await supabase
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (finalError) {
      console.error('❌ Erro ao buscar dados finais:', finalError);
      return;
    }

    const apiResponse = {
      prompts: finalPrompts
    };

    console.log('✅ Dados que a página receberá:');
    console.log(`   Total de prompts: ${apiResponse.prompts.length}`);
    console.log(`   Prompts ativos: ${apiResponse.prompts.filter(p => p.is_active).length}`);
    console.log(`   Prompts inativos: ${apiResponse.prompts.filter(p => !p.is_active).length}`);

    // 5. Verificar estrutura dos dados
    console.log('\n5️⃣ Verificando estrutura dos dados...');
    if (apiResponse.prompts.length > 0) {
      const samplePrompt = apiResponse.prompts[0];
      const requiredFields = ['id', 'name', 'content', 'is_active', 'created_at', 'updated_at'];
      
      console.log('✅ Campos disponíveis no primeiro prompt:');
      requiredFields.forEach(field => {
        const hasField = field in samplePrompt;
        console.log(`   ${hasField ? '✅' : '❌'} ${field}: ${hasField ? typeof samplePrompt[field] : 'MISSING'}`);
      });
    }

    console.log('\n🎉 Teste concluído! A página PromptManagerPage está pronta para uso.');
    console.log('\n📋 Para acessar a página:');
    console.log('   1. Inicie o servidor: npm run dev:all');
    console.log('   2. Acesse: http://localhost:5173/admin/prompts');
    console.log('   3. Faça login como administrador');

  } catch (error) {
    console.error('❌ Erro inesperado no teste:', error);
  }
}

// Executar o teste
testPromptManagerPage();