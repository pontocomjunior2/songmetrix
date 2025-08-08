#!/usr/bin/env node

/**
 * Script para testar se os dados reais do usuário estão sendo buscados do PostgreSQL
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

async function testRealUserData() {
  try {
    console.log('🔍 TESTANDO DADOS REAIS DO USUÁRIO\n');
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

    // 2. Buscar usuários com dados musicais
    console.log('2️⃣ BUSCANDO USUÁRIOS COM DADOS MUSICAIS...');
    
    // Primeiro, vamos verificar quais usuários têm dados no music_log
    const { LlmService } = await import('../server/services/llmService.js');
    const { InsightGeneratorService } = await import('../server/services/insightGeneratorService.js');

    const llmService = new LlmService();
    const insightGenerator = new InsightGeneratorService(llmService);

    // Buscar usuários do Supabase
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .limit(5);

    if (usersError || !users || users.length === 0) {
      console.error('❌ Erro ao buscar usuários:', usersError?.message);
      return;
    }

    console.log(`✅ ${users.length} usuários encontrados\n`);

    // 3. Testar busca de dados reais para cada usuário
    console.log('3️⃣ TESTANDO BUSCA DE DADOS REAIS...\n');
    
    for (const user of users) {
      console.log(`👤 USUÁRIO: ${user.full_name || user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      
      try {
        // Buscar dados reais do PostgreSQL
        const userData = await insightGenerator.fetchUserData(user.id);
        
        console.log('   📊 DADOS COLETADOS:');
        console.log(`      Top Song: ${userData.topSong?.title || 'N/A'} - ${userData.topSong?.artist || 'N/A'}`);
        console.log(`      Top Artist: ${userData.topArtist?.name || 'N/A'}`);
        console.log(`      Total Plays: ${userData.totalPlays || 0}`);
        console.log(`      Weekly Plays: ${userData.weeklyPlays || 0}`);
        console.log(`      Monthly Plays: ${userData.monthlyPlays || 0}`);
        console.log(`      Growth Rate: ${userData.growthRate || '0%'}`);
        console.log(`      Listening Hours: ${userData.listeningHours || 0}`);
        console.log(`      Discovery Count: ${userData.discoveryCount || 0}`);
        console.log(`      Peak Hour: ${userData.peakHour || 'N/A'}`);
        console.log(`      Weekend vs Weekday: ${userData.weekendVsWeekday || 'N/A'}`);
        
        // Verificar se tem dados reais
        const hasRealData = userData.totalPlays > 0 || userData.weeklyPlays > 0;
        console.log(`   🎯 STATUS: ${hasRealData ? '✅ TEM DADOS REAIS' : '⚠️  SEM DADOS MUSICAIS'}\n`);
        
      } catch (error) {
        console.log(`   ❌ ERRO: ${error.message}\n`);
      }
    }

    // 4. Testar geração de insight com dados reais
    console.log('4️⃣ TESTANDO GERAÇÃO COM DADOS REAIS...\n');
    
    const testUser = users[0]; // Usar primeiro usuário
    console.log(`🧪 Gerando insight para: ${testUser.full_name || testUser.email}`);
    
    const customPayload = {
      targetType: 'user',
      targetId: testUser.id,
      subject: 'Teste com Dados Reais do PostgreSQL',
      customPrompt: `Olá {user_name}! 

📊 SEUS DADOS MUSICAIS REAIS:
🎵 Sua música favorita: {top_song}
🎤 Seu artista preferido: {top_artist}
📈 Total de execuções: {total_plays}
📅 Execuções esta semana: {weekly_plays}
📆 Execuções este mês: {monthly_plays}
📊 Taxa de crescimento: {growth_rate}
⏰ Seu horário de pico: {peak_hour}
🗓️ Padrão de escuta: {weekend_vs_weekday}
🎧 Horas de escuta: {listening_hours}
🔍 Novas descobertas: {discovery_count}

Este insight foi gerado com seus dados REAIS do banco PostgreSQL!`,
      variables: ['user_name', 'top_song', 'top_artist', 'total_plays', 'weekly_plays', 'monthly_plays', 'growth_rate', 'peak_hour', 'weekend_vs_weekday', 'listening_hours', 'discovery_count']
    };

    const generateResponse = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customPayload)
    });

    console.log(`Status da geração: ${generateResponse.status}`);
    if (generateResponse.ok) {
      const generateData = await generateResponse.json();
      console.log('✅ Insight gerado com dados reais!');
      console.log(`   Usuários processados: ${generateData.targetUsers}`);
    } else {
      const errorText = await generateResponse.text();
      console.log('❌ Erro na geração:', errorText);
    }

    // 5. Verificar o insight gerado
    console.log('\n5️⃣ VERIFICANDO INSIGHT GERADO...\n');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos
    
    const draftsResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (draftsResponse.ok) {
      const draftsData = await draftsResponse.json();
      const latestInsight = draftsData.drafts?.find(d => d.subject === 'Teste com Dados Reais do PostgreSQL');
      
      if (latestInsight) {
        console.log('📧 INSIGHT GERADO ENCONTRADO:');
        console.log(`   ID: ${latestInsight.id}`);
        console.log(`   Assunto: ${latestInsight.subject}`);
        console.log(`   Usuário: ${latestInsight.users?.email}`);
        console.log('\n📝 CONTEÚDO GERADO:');
        console.log('-----------------------------------');
        // Extrair texto do HTML
        const textContent = latestInsight.content?.replace(/<[^>]*>/g, '') || 'Conteúdo não disponível';
        console.log(textContent);
        console.log('-----------------------------------\n');
        
        // Verificar se contém dados reais
        const hasRealNumbers = /\d+/.test(textContent) && !textContent.includes('Sua música favorita');
        console.log(`🎯 RESULTADO: ${hasRealNumbers ? '✅ CONTÉM DADOS REAIS!' : '⚠️  AINDA USANDO DADOS ESTÁTICOS'}`);
      } else {
        console.log('⚠️  Insight não encontrado nos drafts');
      }
    }

    // 6. Cleanup
    await insightGenerator.close();
    await supabase.auth.signOut();

    console.log('\n=====================================');
    console.log('🏁 TESTE DE DADOS REAIS CONCLUÍDO!');
    console.log('=====================================');

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testRealUserData().then(() => {
  console.log('\n🎯 Teste finalizado!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});