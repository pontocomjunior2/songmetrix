#!/usr/bin/env node

/**
 * Script para debugar o processo completo de geração de insights personalizados
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugCustomInsightProcess() {
  try {
    console.log('🔍 Debugando processo completo de insight personalizado...\n');

    // 1. Verificar usuário alvo
    const targetUserId = '59ad79e3-9510-440c-bfc2-d10f48c8e276';
    console.log('1️⃣ Verificando usuário alvo...');
    
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (userError || !targetUser) {
      console.error('❌ Usuário não encontrado:', userError?.message);
      return;
    }

    console.log(`✅ Usuário encontrado: ${targetUser.full_name || 'Sem nome'} (${targetUser.email})`);

    // 2. Verificar provedor LLM ativo
    console.log('\n2️⃣ Verificando provedor LLM ativo...');
    
    const { data: activeProvider, error: providerError } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (providerError || !activeProvider) {
      console.error('❌ Nenhum provedor LLM ativo:', providerError?.message);
      return;
    }

    console.log(`✅ Provedor ativo: ${activeProvider.provider_name} - ${activeProvider.model_name}`);

    // 3. Simular busca de dados do usuário
    console.log('\n3️⃣ Simulando busca de dados do usuário...');
    
    // Simular dados que seriam buscados
    const mockUserData = {
      topSong: { title: 'Teste Song', artist: 'Teste Artist', playCount: 10 },
      topArtist: { name: 'Teste Artist', playCount: 25 },
      totalPlays: 100,
      weeklyPlays: 15,
      monthlyPlays: 60,
      growthRate: '+20%',
      favoriteGenre: 'Rock',
      listeningHours: 5,
      discoveryCount: 3,
      peakHour: '14:00',
      weekendVsWeekday: 'Mais ativo durante a semana',
      moodAnalysis: 'Eclético'
    };

    console.log('✅ Dados do usuário simulados:', {
      topSong: mockUserData.topSong.title,
      totalPlays: mockUserData.totalPlays,
      weeklyPlays: mockUserData.weeklyPlays
    });

    // 4. Simular substituição de variáveis
    console.log('\n4️⃣ Simulando substituição de variáveis...');
    
    const originalPrompt = 'Olá {user_name}! Sua música favorita é {top_song} de {top_artist}. Você teve {weekly_plays} execuções esta semana.';
    
    let processedPrompt = originalPrompt
      .replace('{user_name}', targetUser.full_name || targetUser.email)
      .replace('{top_song}', mockUserData.topSong.title)
      .replace('{top_artist}', mockUserData.topArtist.name)
      .replace('{weekly_plays}', mockUserData.weeklyPlays.toString());

    console.log('📝 Prompt original:', originalPrompt);
    console.log('📝 Prompt processado:', processedPrompt);

    // 5. Tentar salvar diretamente no banco (sem LLM)
    console.log('\n5️⃣ Tentando salvar insight diretamente no banco...');
    
    const htmlContent = `<div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>🎵 Seu Insight Personalizado</h2>
      <p>${processedPrompt}</p>
      <p><strong>Este é um teste de debug do sistema.</strong></p>
    </div>`;

    const testInsight = {
      user_id: targetUserId,
      insight_type: 'custom_insight',
      subject: 'Teste Debug - Insight Personalizado',
      body_html: htmlContent,
      content: htmlContent,
      status: 'draft',
      insight_data: mockUserData,
      deep_link: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/dashboard`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: savedInsight, error: saveError } = await supabase
      .from('generated_insight_emails')
      .insert(testInsight)
      .select()
      .single();

    if (saveError) {
      console.error('❌ Erro ao salvar insight:', saveError.message);
      console.error('Detalhes do erro:', saveError);
      return;
    }

    console.log('✅ Insight salvo com sucesso!');
    console.log('📊 ID do insight:', savedInsight.id);
    console.log('📧 Assunto:', savedInsight.subject);
    console.log('👤 Usuário:', savedInsight.user_id);
    console.log('🏷️  Tipo:', savedInsight.insight_type);

    // 6. Verificar se aparece na lista de drafts
    console.log('\n6️⃣ Verificando se aparece na lista de drafts...');
    
    const { data: drafts, error: draftsError } = await supabase
      .from('generated_insight_emails')
      .select(`
        *,
        users (
          email,
          full_name
        )
      `)
      .eq('status', 'draft')
      .eq('insight_type', 'custom_insight')
      .order('created_at', { ascending: false });

    if (draftsError) {
      console.error('❌ Erro ao buscar drafts:', draftsError.message);
      return;
    }

    console.log(`✅ Drafts de insights personalizados encontrados: ${drafts?.length || 0}`);
    
    if (drafts && drafts.length > 0) {
      console.log('\n📋 Últimos insights personalizados:');
      drafts.slice(0, 3).forEach((draft, index) => {
        console.log(`${index + 1}. ${draft.subject}`);
        console.log(`   Para: ${draft.users?.email}`);
        console.log(`   ID: ${draft.id}`);
        console.log(`   Criado: ${new Date(draft.created_at).toLocaleString('pt-BR')}`);
      });
    }

    console.log('\n🎉 Teste de debug concluído!');
    console.log('💡 Se o insight apareceu aqui mas não no frontend, o problema pode ser:');
    console.log('   - Cache do frontend');
    console.log('   - Filtros na query do frontend');
    console.log('   - Problema na interface');

  } catch (error) {
    console.error('💥 Erro no debug:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar debug
debugCustomInsightProcess().then(() => {
  console.log('\n🏁 Debug concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});