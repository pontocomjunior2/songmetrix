#!/usr/bin/env node

/**
 * Script para testar a geração de insights personalizados
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function testCustomInsightGeneration() {
  try {
    console.log('🧪 Testando geração de insight personalizado...\n');

    // Dados de teste
    const testPayload = {
      targetType: 'user',
      targetId: '59ad79e3-9510-440c-bfc2-d10f48c8e276', // ID do usuário do debug
      subject: 'Teste de Insight Personalizado',
      customPrompt: `
Olá {user_name}!

Este é um teste do sistema de insights personalizados.

🎵 Sua música favorita: {top_song}
👨‍🎤 Artista preferido: {top_artist}
📊 Execuções da semana: {weekly_plays}
📈 Crescimento: {growth_rate}

Obrigado por usar o SongMetrix!

Equipe SongMetrix
      `.trim(),
      variables: ['user_name', 'top_song', 'top_artist', 'weekly_plays', 'growth_rate']
    };

    console.log('📝 Payload de teste:');
    console.log(JSON.stringify(testPayload, null, 2));

    // Fazer requisição direta para a API
    const response = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Usar um token de teste - em produção seria um token real
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`\n📡 Status da resposta: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log('📄 Resposta da API:');
    console.log(responseText);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('\n✅ Teste bem-sucedido!');
      console.log('📊 Resultado:', result);
    } else {
      console.log('\n❌ Teste falhou');
      if (response.status === 401) {
        console.log('🔐 Problema de autenticação - isso é esperado no teste');
      }
    }

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
  }
}

// Executar teste
testCustomInsightGeneration().then(() => {
  console.log('\n🏁 Teste concluído!');
}).catch(error => {
  console.error('💥 Erro fatal:', error);
});