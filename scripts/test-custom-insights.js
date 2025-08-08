#!/usr/bin/env node

/**
 * Script para testar a funcionalidade de insights personalizados
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Função para fazer login e obter token
async function getAuthToken() {
  try {
    console.log('🔐 Fazendo login para obter token de autenticação...');
    
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@songmetrix.com.br',
        password: 'admin123'
      })
    });

    if (!response.ok) {
      throw new Error(`Erro no login: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('❌ Erro ao fazer login:', error.message);
    return null;
  }
}

// Função para buscar usuários
async function fetchUsers(token) {
  try {
    console.log('👥 Buscando usuários disponíveis...');
    
    const response = await fetch(`${API_BASE_URL}/api/admin/users?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar usuários: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Encontrados ${data.users?.length || 0} usuários`);
    
    if (data.users && data.users.length > 0) {
      console.log('📋 Primeiros usuários:');
      data.users.slice(0, 3).forEach(user => {
        console.log(`  - ${user.full_name || 'Nome não informado'} (${user.email}) - Status: ${user.status || 'N/A'}`);
      });
    }
    
    return data.users || [];
  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error.message);
    return [];
  }
}

// Função para testar geração de insight personalizado para usuário específico
async function testCustomInsightForUser(token, userId) {
  try {
    console.log(`\n🎯 Testando insight personalizado para usuário ${userId}...`);
    
    const customPrompt = `
Olá {user_name}!

Aqui está seu relatório musical personalizado:

🎵 **Sua música favorita**: {top_song} de {top_artist}
📊 **Estatísticas da semana**: {weekly_plays} execuções
📈 **Crescimento**: {growth_rate}
⏰ **Seu horário de pico**: {peak_hour}
🎧 **Total de horas ouvindo**: {listening_hours}h
🔍 **Novas descobertas**: {discovery_count} músicas

**Análise comportamental**: {weekend_vs_weekday}

Continue explorando sua paixão pela música!

Equipe SongMetrix
    `.trim();

    const payload = {
      targetType: 'user',
      targetId: userId,
      subject: 'Seu Relatório Musical Personalizado - SongMetrix',
      customPrompt: customPrompt,
      variables: [
        'user_name', 'top_song', 'top_artist', 'weekly_plays', 
        'growth_rate', 'peak_hour', 'listening_hours', 
        'discovery_count', 'weekend_vs_weekday'
      ]
    };

    console.log('📝 Payload do insight personalizado:');
    console.log('  - Tipo:', payload.targetType);
    console.log('  - Target:', payload.targetId);
    console.log('  - Assunto:', payload.subject);
    console.log('  - Variáveis:', payload.variables.length);

    const response = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro na geração: ${response.status} ${response.statusText}\n${errorData}`);
    }

    const result = await response.json();
    console.log('✅ Insight personalizado iniciado com sucesso!');
    console.log('📊 Resultado:', {
      status: result.status,
      targetUsers: result.targetUsers,
      initiated_by: result.initiated_by,
      initiated_at: result.initiated_at
    });

    return result;
  } catch (error) {
    console.error('❌ Erro ao gerar insight personalizado:', error.message);
    return null;
  }
}

// Função para testar geração de insight para grupo
async function testCustomInsightForGroup(token, groupId) {
  try {
    console.log(`\n👥 Testando insight personalizado para grupo ${groupId}...`);
    
    const customPrompt = `
Olá {user_name}!

Este é um relatório especial para usuários {group_name}:

🎵 **Destaque da semana**: {top_song} de {top_artist}
📊 **Suas execuções**: {weekly_plays} músicas
📈 **Seu crescimento**: {growth_rate}
🎧 **Tempo de escuta**: {listening_hours} horas

**Análise do seu perfil musical**: {mood_analysis}

Continue aproveitando a melhor experiência musical!

Equipe SongMetrix
    `.trim();

    const payload = {
      targetType: 'group',
      targetId: groupId,
      subject: `Relatório Musical - Usuários ${groupId.toUpperCase()}`,
      customPrompt: customPrompt,
      variables: [
        'user_name', 'top_song', 'top_artist', 'weekly_plays', 
        'growth_rate', 'listening_hours', 'mood_analysis'
      ]
    };

    console.log('📝 Payload do insight para grupo:');
    console.log('  - Tipo:', payload.targetType);
    console.log('  - Grupo:', payload.targetId);
    console.log('  - Assunto:', payload.subject);

    const response = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro na geração: ${response.status} ${response.statusText}\n${errorData}`);
    }

    const result = await response.json();
    console.log('✅ Insight para grupo iniciado com sucesso!');
    console.log('📊 Resultado:', {
      status: result.status,
      targetUsers: result.targetUsers,
      initiated_by: result.initiated_by
    });

    return result;
  } catch (error) {
    console.error('❌ Erro ao gerar insight para grupo:', error.message);
    return null;
  }
}

// Função para verificar rascunhos gerados
async function checkDrafts(token) {
  try {
    console.log('\n📋 Verificando rascunhos gerados...');
    
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar rascunhos: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Encontrados ${data.count || 0} rascunhos`);
    
    if (data.drafts && data.drafts.length > 0) {
      console.log('📝 Últimos rascunhos:');
      data.drafts.slice(0, 3).forEach(draft => {
        console.log(`  - ${draft.subject} (${draft.users?.email}) - Tipo: ${draft.insight_type}`);
      });
    }
    
    return data.drafts || [];
  } catch (error) {
    console.error('❌ Erro ao verificar rascunhos:', error.message);
    return [];
  }
}

// Função principal
async function main() {
  console.log('🚀 Iniciando teste de insights personalizados...\n');

  // 1. Fazer login
  const token = await getAuthToken();
  if (!token) {
    console.log('❌ Não foi possível obter token de autenticação. Encerrando teste.');
    return;
  }

  // 2. Buscar usuários
  const users = await fetchUsers(token);
  if (users.length === 0) {
    console.log('❌ Nenhum usuário encontrado. Encerrando teste.');
    return;
  }

  // 3. Testar insight para usuário específico
  const firstUser = users[0];
  await testCustomInsightForUser(token, firstUser.id);

  // 4. Aguardar um pouco
  console.log('\n⏳ Aguardando 5 segundos...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 5. Testar insight para grupo
  await testCustomInsightForGroup(token, 'ativo');

  // 6. Aguardar um pouco mais
  console.log('\n⏳ Aguardando 10 segundos para verificar rascunhos...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 7. Verificar rascunhos gerados
  await checkDrafts(token);

  console.log('\n🎉 Teste de insights personalizados concluído!');
  console.log('\n💡 Próximos passos:');
  console.log('  1. Acesse o painel de insights no admin');
  console.log('  2. Revise os rascunhos gerados');
  console.log('  3. Aprove e envie os insights');
}

// Executar teste
main().catch(error => {
  console.error('💥 Erro fatal no teste:', error);
  process.exit(1);
});