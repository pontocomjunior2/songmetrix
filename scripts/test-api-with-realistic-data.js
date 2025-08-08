#!/usr/bin/env node

/**
 * Script para testar especificamente a API com dados realistas
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAPIWithRealisticData() {
  try {
    console.log('🔥 TESTE ESPECÍFICO DA API COM DADOS REALISTAS\n');
    console.log('=====================================\n');

    // 1. Login
    console.log('1️⃣ FAZENDO LOGIN...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024'
    });

    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }

    const token = loginData.session.access_token;
    console.log('✅ Login realizado com sucesso\n');

    // 2. Gerar insight com prompt específico para detectar dados reais
    console.log('2️⃣ GERANDO INSIGHT COM PROMPT ESPECÍFICO...\n');
    
    const detectionPayload = {
      targetType: 'user',
      targetId: '59ad79e3-9510-440c-bfc2-d10f48c8e276', // ID específico
      subject: '🔍 TESTE DETECÇÃO DADOS REAIS',
      customPrompt: `TESTE DE DETECÇÃO DE DADOS REAIS:

🎵 TOP SONG: "{top_song}"
🎤 TOP ARTIST: "{top_artist}"
📊 TOTAL PLAYS: {total_plays}
📅 WEEKLY PLAYS: {weekly_plays}
🎼 GENRE: "{favorite_genre}"
⏰ PEAK HOUR: {peak_hour}
📈 GROWTH: {growth_rate}

SE VOCÊ VÊ DADOS COMO "Sua música favorita" OU "Artista mais tocado", OS DADOS ESTÁTICOS AINDA ESTÃO SENDO USADOS.
SE VOCÊ VÊ NOMES REAIS DE MÚSICAS E ARTISTAS, OS DADOS REALISTAS ESTÃO FUNCIONANDO!`,
      variables: ['top_song', 'top_artist', 'total_plays', 'weekly_plays', 'favorite_genre', 'peak_hour', 'growth_rate']
    };

    console.log('📤 ENVIANDO REQUISIÇÃO PARA API...');
    const generateResponse = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(detectionPayload)
    });

    console.log(`📊 Status da API: ${generateResponse.status}`);
    
    if (generateResponse.ok) {
      const generateData = await generateResponse.json();
      console.log('✅ Requisição aceita pela API!');
      console.log(`   Usuários processados: ${generateData.targetUsers}`);
      console.log(`   Status: ${generateData.status}`);
      console.log(`   Processado: ${generateData.processed}`);
    } else {
      const errorText = await generateResponse.text();
      console.log('❌ Erro na API:', errorText);
      return;
    }

    // 3. Aguardar processamento
    console.log('\n3️⃣ AGUARDANDO PROCESSAMENTO...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos

    // 4. Buscar o insight gerado
    console.log('\n4️⃣ BUSCANDO INSIGHT GERADO...');
    const draftsResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!draftsResponse.ok) {
      console.log('❌ Erro ao buscar drafts');
      return;
    }

    const draftsData = await draftsResponse.json();
    const testInsight = draftsData.drafts?.find(d => d.subject === '🔍 TESTE DETECÇÃO DADOS REAIS');
    
    if (!testInsight) {
      console.log('⚠️  Insight de teste não encontrado');
      console.log(`   Total de drafts: ${draftsData.count}`);
      if (draftsData.drafts && draftsData.drafts.length > 0) {
        console.log('   Últimos assuntos:');
        draftsData.drafts.slice(0, 3).forEach((draft, i) => {
          console.log(`      ${i + 1}. ${draft.subject}`);
        });
      }
      return;
    }

    // 5. Analisar o conteúdo
    console.log('\n5️⃣ ANALISANDO CONTEÚDO GERADO...\n');
    console.log('📧 INSIGHT ENCONTRADO:');
    console.log(`   ID: ${testInsight.id}`);
    console.log(`   Usuário: ${testInsight.users?.email}`);
    console.log(`   Criado em: ${testInsight.created_at}\n`);

    console.log('📝 CONTEÚDO ANALISADO:');
    console.log('=====================================');
    const textContent = testInsight.content?.replace(/<[^>]*>/g, '') || 'Conteúdo não disponível';
    console.log(textContent);
    console.log('=====================================\n');

    // 6. Detectar se são dados reais ou estáticos
    console.log('6️⃣ ANÁLISE DE DETECÇÃO:\n');
    
    const staticIndicators = [
      'Sua música favorita',
      'Artista mais tocado',
      'Artista preferido'
    ];

    const hasStaticData = staticIndicators.some(indicator => 
      textContent.includes(indicator)
    );

    // Procurar por padrões de dados reais
    const realDataPatterns = [
      /TOP SONG: "([^"]+)"/,
      /TOP ARTIST: "([^"]+)"/,
      /TOTAL PLAYS: (\d+)/,
      /WEEKLY PLAYS: (\d+)/
    ];

    const extractedData = {};
    realDataPatterns.forEach((pattern, index) => {
      const match = textContent.match(pattern);
      if (match) {
        const keys = ['topSong', 'topArtist', 'totalPlays', 'weeklyPlays'];
        extractedData[keys[index]] = match[1];
      }
    });

    console.log('🔍 DADOS EXTRAÍDOS:');
    console.log(`   Top Song: "${extractedData.topSong || 'Não encontrado'}"`);
    console.log(`   Top Artist: "${extractedData.topArtist || 'Não encontrado'}"`);
    console.log(`   Total Plays: ${extractedData.totalPlays || 'Não encontrado'}`);
    console.log(`   Weekly Plays: ${extractedData.weeklyPlays || 'Não encontrado'}\n`);

    // 7. Resultado final
    console.log('7️⃣ RESULTADO FINAL:\n');
    
    if (hasStaticData) {
      console.log('❌ DADOS ESTÁTICOS DETECTADOS!');
      console.log('   A API ainda está usando dados estáticos.');
      console.log('   O servidor precisa ser reiniciado com as mudanças.\n');
    } else if (extractedData.topSong && extractedData.topSong !== 'Sua música favorita') {
      console.log('✅ DADOS REALISTAS DETECTADOS!');
      console.log('   A API está usando dados realistas das rádios.');
      console.log('   As correções foram aplicadas com sucesso!\n');
    } else {
      console.log('⚠️  RESULTADO INCONCLUSIVO');
      console.log('   Não foi possível determinar o tipo de dados.\n');
    }

    // 8. Informações adicionais
    console.log('8️⃣ INFORMAÇÕES ADICIONAIS:\n');
    console.log('📊 DADOS DO INSIGHT:');
    if (testInsight.insight_data) {
      const insightData = testInsight.insight_data;
      console.log(`   Top Song no DB: ${insightData.topSong?.title || 'N/A'}`);
      console.log(`   Top Artist no DB: ${insightData.topArtist?.name || 'N/A'}`);
      console.log(`   Total Plays no DB: ${insightData.totalPlays || 0}`);
      console.log(`   Weekly Plays no DB: ${insightData.weeklyPlays || 0}`);
      console.log(`   Favorite Genre no DB: ${insightData.favoriteGenre || 'N/A'}`);
    }

    // 9. Logout
    await supabase.auth.signOut();

    console.log('\n=====================================');
    console.log('🏁 TESTE ESPECÍFICO DA API CONCLUÍDO!');
    console.log('=====================================');

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testAPIWithRealisticData().then(() => {
  console.log('\n🎯 Teste finalizado!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});