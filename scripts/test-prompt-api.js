import fetch from 'node-fetch';
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

const API_BASE = 'http://localhost:3001/api/admin';

// Token de admin (você precisa obter um token válido)
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'your-admin-token-here';

async function testPromptAPI() {
  try {
    console.log('🧪 Testando API de Prompts...\n');

    // 1. Listar prompts existentes
    console.log('1️⃣ Listando prompts existentes...');
    const listResponse = await fetch(`${API_BASE}/prompts`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      console.error('❌ Erro ao listar prompts:', await listResponse.text());
      return;
    }

    const { prompts } = await listResponse.json();
    console.log(`✅ ${prompts.length} prompt(s) encontrado(s):`);
    prompts.forEach((prompt, index) => {
      const status = prompt.is_active ? '🟢 ATIVO' : '⚪ INATIVO';
      console.log(`   ${index + 1}. ${status} ${prompt.name}`);
    });

    // 2. Criar novo prompt
    console.log('\n2️⃣ Criando novo prompt...');
    const newPromptData = {
      name: 'Prompt de Teste API',
      content: `Você é um especialista em análise musical para rádios.

Baseado nos dados: {{INSIGHT_DATA}}

Crie um e-mail que:
- Seja direto e objetivo
- Use dados para convencer
- Tenha call-to-action claro

Responda com JSON: {"subject": "...", "body_html": "..."}`
    };

    const createResponse = await fetch(`${API_BASE}/prompts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newPromptData)
    });

    if (!createResponse.ok) {
      console.error('❌ Erro ao criar prompt:', await createResponse.text());
      return;
    }

    const { prompt: newPrompt } = await createResponse.json();
    console.log('✅ Prompt criado:', newPrompt.name);
    console.log('   ID:', newPrompt.id);

    // 3. Atualizar prompt
    console.log('\n3️⃣ Atualizando prompt...');
    const updateData = {
      name: 'Prompt de Teste API - Atualizado',
      content: newPromptData.content + '\n\n[ATUALIZADO VIA API]'
    };

    const updateResponse = await fetch(`${API_BASE}/prompts/${newPrompt.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      console.error('❌ Erro ao atualizar prompt:', await updateResponse.text());
      return;
    }

    const { prompt: updatedPrompt } = await updateResponse.json();
    console.log('✅ Prompt atualizado:', updatedPrompt.name);

    // 4. Ativar prompt
    console.log('\n4️⃣ Ativando prompt...');
    const activateResponse = await fetch(`${API_BASE}/prompts/${newPrompt.id}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!activateResponse.ok) {
      console.error('❌ Erro ao ativar prompt:', await activateResponse.text());
      return;
    }

    const activateResult = await activateResponse.json();
    console.log('✅ Prompt ativado:', activateResult.message);

    // 5. Verificar se apenas este prompt está ativo
    console.log('\n5️⃣ Verificando prompts ativos...');
    const checkResponse = await fetch(`${API_BASE}/prompts`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const { prompts: updatedPrompts } = await checkResponse.json();
    const activePrompts = updatedPrompts.filter(p => p.is_active);
    
    console.log(`✅ ${activePrompts.length} prompt(s) ativo(s):`);
    activePrompts.forEach(prompt => {
      console.log(`   - ${prompt.name}`);
    });

    if (activePrompts.length === 1 && activePrompts[0].id === newPrompt.id) {
      console.log('✅ Sistema de ativação exclusiva funcionando corretamente!');
    } else {
      console.log('⚠️  Possível problema no sistema de ativação exclusiva');
    }

    console.log('\n🎉 Teste da API de prompts concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro inesperado no teste:', error.message);
  }
}

// Verificar se o servidor está rodando
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/check`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Servidor está rodando e token é válido');
      return true;
    } else {
      console.log('❌ Servidor não está acessível ou token inválido');
      console.log('💡 Certifique-se de que:');
      console.log('   1. O servidor está rodando: npm run server');
      console.log('   2. Você tem um token de admin válido');
      return false;
    }
  } catch (error) {
    console.log('❌ Não foi possível conectar ao servidor');
    console.log('💡 Execute: npm run server');
    return false;
  }
}

// Executar teste
async function main() {
  const serverOk = await checkServer();
  if (serverOk) {
    await testPromptAPI();
  }
}

main();