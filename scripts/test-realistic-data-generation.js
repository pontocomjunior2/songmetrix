#!/usr/bin/env node

/**
 * Script para testar a geração de dados realistas
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testRealisticDataGeneration() {
  try {
    console.log('🎯 TESTANDO GERAÇÃO DE DADOS REALISTAS\n');
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

    // 2. Testar função generateRealisticUserData diretamente
    console.log('2️⃣ TESTANDO FUNÇÃO DIRETAMENTE...\n');
    
    const { LlmService } = await import('../server/services/llmService.js');
    const { InsightGeneratorService } = await import('../server/services/insightGeneratorService.js');

    const llmService = new LlmService();
    const insightGenerator = new InsightGeneratorService(llmService);

    // Buscar um usuário de teste
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .limit(1);

    if (!users || users.length === 0) {
      console.error('❌ Nenhum usuário encontrado');
      return;
    }

    const testUser = users[0];
    console.log(`👤 USUÁRIO DE TESTE: ${testUser.full_name || testUser.email}`);
    console.log(`   ID: ${testUser.id}`);
    console.log(`   Email: ${testUser.email}\n`);

    // Testar geração de dados realistas
    console.log('🎲 GERANDO DADOS REALISTAS...');
    const realisticData = await insightGenerator.generateRealisticUserData(testUser.id);
    
    console.log('📊 DADOS REALISTAS GERADOS:');
    console.log(`   🎵 Top Song: ${realisticData.topSong?.title || 'N/A'} - ${realisticData.topSong?.artist || 'N/A'}`);
    console.log(`   🎤 Top Artist: ${realisticData.topArtist?.name || 'N/A'} (${realisticData.topArtist?.playCount || 0} plays)`);
    console.log(`   📈 Total Plays: ${realisticData.totalPlays || 0}`);
    console.log(`   📅 Weekly Plays: ${realisticData.weeklyPlays || 0}`);
    console.log(`   📆 Monthly Plays: ${realisticData.monthlyPlays || 0}`);
    console.log(`   📊 Growth Rate: ${realisticData.growthRate || '0%'}`);
    console.log(`   🎼 Favorite Genre: ${realisticData.favoriteGenre || 'N/A'}`);
    console.log(`   🎧 Listening Hours: ${realisticData.listeningHours || 0}`);
    console.log(`   🔍 Discovery Count: ${realisticData.discoveryCount || 0}`);
    console.log(`   ⏰ Peak Hour: ${realisticData.peakHour || 'N/A'}`);
    console.log(`   🗓️ Weekend vs Weekday: ${realisticData.weekendVsWeekday || 'N/A'}`);
    console.log(`   🎭 Mood Analysis: ${realisticData.moodAnalysis || 'N/A'}\n`);

    // Verificar se os dados são realistas
    const hasRealisticData = realisticData.totalPlays > 0 && 
                            realisticData.topSong && 
                            realisticData.topArtist;
    
    console.log(`🎯 STATUS: ${hasRealisticData ? '✅ DADOS REALISTAS GERADOS!' : '❌ FALHA NA GERAÇÃO'}\n`);

    // 3. Testar múltiplas gerações para verificar variação
    console.log('3️⃣ TESTANDO VARIAÇÃO DOS DADOS...\n');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`🎲 GERAÇÃO ${i}:`);
      const variation = await insightGenerator.generateRealisticUserData(testUser.id);
      console.log(`   Música: ${variation.topSong?.title} - ${variation.topSong?.artist}`);
      console.log(`   Artista: ${variation.topArtist?.name}`);
      console.log(`   Total Plays: ${variation.totalPlays}`);
      console.log(`   Gênero: ${variation.favoriteGenre}`);
      console.log(`   Crescimento: ${variation.growthRate}\n`);
    }

    // 4. Testar geração via API
    console.log('4️⃣ TESTANDO VIA API...\n');
    
    const customPayload = {
      targetType: 'user',
      targetId: testUser.id,
      subject: 'Teste Dados Realistas via API',
      customPrompt: `Olá {user_name}! 

🎵 Sua música favorita é: {top_song}
🎤 Seu artista preferido é: {top_artist}
📈 Você tem {total_plays} execuções totais
📅 Esta semana: {weekly_plays} execuções
📆 Este mês: {monthly_plays} execuções
📊 Crescimento: {growth_rate}
🎼 Gênero favorito: {favorite_genre}
⏰ Horário de pico: {peak_hour}
🗓️ {weekend_vs_weekday}
🎧 {listening_hours} horas de escuta
🔍 {discovery_count} novas descobertas
🎭 Perfil: {mood_analysis}`,
      variables: ['user_name', 'top_song', 'top_artist', 'total_plays', 'weekly_plays', 'monthly_plays', 'growth_rate', 'favorite_genre', 'peak_hour', 'weekend_vs_weekday', 'listening_hours', 'discovery_count', 'mood_analysis']
    };

    const generateResponse = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customPayload)
    });

    console.log(`Status da geração via API: ${generateResponse.status}`);
    if (generateResponse.ok) {
      const generateData = await generateResponse.json();
      console.log('✅ Insight gerado via API!');
      console.log(`   Usuários processados: ${generateData.targetUsers}\n`);
    } else {
      const errorText = await generateResponse.text();
      console.log('❌ Erro na geração via API:', errorText);
    }

    // 5. Verificar o insight gerado
    console.log('5️⃣ VERIFICANDO INSIGHT GERADO...\n');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos
    
    const draftsResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (draftsResponse.ok) {
      const draftsData = await draftsResponse.json();
      const latestInsight = draftsData.drafts?.find(d => d.subject === 'Teste Dados Realistas via API');
      
      if (latestInsight) {
        console.log('📧 INSIGHT ENCONTRADO:');
        console.log(`   ID: ${latestInsight.id}`);
        console.log(`   Assunto: ${latestInsight.subject}`);
        console.log(`   Usuário: ${latestInsight.users?.email}\n`);
        
        console.log('📝 CONTEÚDO GERADO:');
        console.log('-----------------------------------');
        const textContent = latestInsight.content?.replace(/<[^>]*>/g, '') || 'Conteúdo não disponível';
        console.log(textContent);
        console.log('-----------------------------------\n');
        
        // Verificar se contém dados realistas
        const hasRealSongs = !textContent.includes('Sua música favorita') && 
                            !textContent.includes('Artista mais tocado') &&
                            /[A-Za-z]+ - [A-Za-z]+/.test(textContent); // Padrão "Música - Artista"
        
        console.log(`🎯 RESULTADO FINAL: ${hasRealSongs ? '✅ CONTÉM DADOS REALISTAS!' : '⚠️  AINDA USANDO DADOS ESTÁTICOS'}`);
      } else {
        console.log('⚠️  Insight não encontrado nos drafts');
      }
    }

    // 6. Cleanup
    await insightGenerator.close();
    await supabase.auth.signOut();

    console.log('\n=====================================');
    console.log('🏁 TESTE DE DADOS REALISTAS CONCLUÍDO!');
    console.log('=====================================');

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testRealisticDataGeneration().then(() => {
  console.log('\n🎯 Teste finalizado!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});