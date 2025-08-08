import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

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
  console.error('❌ Required environment variables are missing: VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupPromptSystem() {
  try {
    console.log('🚀 Configurando sistema de prompts...');

    // Verificar se existem prompts na tabela
    const { data: prompts, error: promptsError } = await supabase
      .from('prompt_templates')
      .select('id, name, is_active')
      .limit(1);

    if (promptsError) {
      console.error('❌ Erro ao buscar prompts:', promptsError);
      return;
    }

    if (!prompts || prompts.length === 0) {
      console.log('⚠️  Nenhum prompt encontrado. Criando prompt padrão...');
      
      const { data: newPrompt, error: createError } = await supabase
        .from('prompt_templates')
        .insert({
          name: 'Prompt Padrão - Insights Musicais',
          content: `Você é um especialista em marketing e análise de dados para a indústria de rádio no Brasil.

Sua tarefa é criar um e-mail curto e impactante para um programador musical baseado nos seguintes dados de insight: {{INSIGHT_DATA}}

O e-mail deve:
- Despertar curiosidade sobre o crescimento da música
- Usar dados específicos para criar credibilidade  
- Ter um tom profissional mas acessível
- Incluir uma chamada para ação clara

Responda APENAS com um objeto JSON válido contendo duas chaves:
- "subject": o assunto do e-mail (máximo 60 caracteres)
- "body_html": o corpo do e-mail em HTML (use tags como <h2>, <p>, <strong>, <ul>, <li>)`,
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erro ao criar prompt padrão:', createError);
        return;
      }

      console.log('✅ Prompt padrão criado e ativado:', newPrompt.name);
      console.log('   ID:', newPrompt.id);
    } else {
      console.log(`✅ ${prompts.length} prompt(s) já existente(s) na tabela`);
      
      // Verificar se há algum prompt ativo
      const activePrompts = prompts.filter(p => p.is_active);
      if (activePrompts.length === 0) {
        console.log('⚠️  Nenhum prompt ativo encontrado. Ativando o primeiro...');
        
        const { data: activatedPrompt, error: activateError } = await supabase
          .from('prompt_templates')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', prompts[0].id)
          .select()
          .single();

        if (activateError) {
          console.error('❌ Erro ao ativar prompt:', activateError);
          return;
        }

        console.log('✅ Prompt ativado:', activatedPrompt.name);
      } else {
        console.log('✅ Prompt ativo encontrado:', activePrompts[0].name);
      }
    }

    // Testar busca de prompt ativo
    console.log('\n🧪 Testando busca de prompt ativo...');
    const { data: activePrompt, error: activeError } = await supabase
      .from('prompt_templates')
      .select('id, name, content')
      .eq('is_active', true)
      .single();

    if (activeError) {
      console.error('❌ Erro ao buscar prompt ativo:', activeError);
      return;
    }

    console.log('✅ Prompt ativo encontrado:', activePrompt.name);
    console.log('   Conteúdo (primeiros 100 chars):', activePrompt.content.substring(0, 100) + '...');

    console.log('\n🎉 Sistema de prompts configurado com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Execute: npm run test-prompt-management');
    console.log('   2. Acesse: http://localhost:5173/admin/llm-settings');
    console.log('   3. Teste a geração: npm run test-llm');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

// Executar o script
setupPromptSystem();