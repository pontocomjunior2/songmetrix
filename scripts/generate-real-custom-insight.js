#!/usr/bin/env node

/**
 * Script para gerar um insight personalizado real através da API
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

async function generateRealCustomInsight() {
  try {
    console.log('🎯 Gerando insight personalizado real...\n');

    // 1. Fazer login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024'
    });

    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }

    const token = loginData.session.access_token;

    // 2. Gerar insight personalizado
    console.log('🚀 Gerando insight personalizado...');
    
    const payload = {
      targetType: 'user',
      targetId: '59ad79e3-9510-440c-bfc2-d10f48c8e276', // Adelson Ferraz Junior
      subject: '🎵 Seu Relatório Musical Personalizado - SongMetrix',
      customPrompt: `
Olá {user_name}!

Preparamos um relatório especial sobre sua jornada musical:

🎵 **Sua música favorita**: {top_song} de {top_artist}
📊 **Estatísticas da semana**: {weekly_plays} execuções
📈 **Crescimento**: {growth_rate}
⏰ **Seu horário de pico**: {peak_hour}
🎧 **Total de horas ouvindo**: {listening_hours}h
🔍 **Novas descobertas**: {discovery_count} músicas

**Análise comportamental**: {weekend_vs_weekday}

Continue explorando sua paixão pela música!

Atenciosamente,
Equipe SongMetrix
      `.trim(),
      variables: [
        'user_name', 'top_song', 'top_artist', 'weekly_plays', 
        'growth_rate', 'peak_hour', 'listening_hours', 
        'discovery_count', 'weekend_vs_weekday'
      ]
    };

    console.log('📝 Payload:');
    console.log(`   Usuário: ${payload.targetId}`);
    console.log(`   Assunto: ${payload.subject}`);
    console.log(`   Variáveis: ${payload.variables.length}`);

    const response = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log(`\n📡 Status da resposta: ${response.status}`);

    const responseText = await response.text();
    console.log('📄 Resposta:', responseText);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('\n✅ Insight personalizado iniciado!');
      console.log(`👥 Usuários processados: ${result.targetUsers}`);
      console.log(`🆔 Iniciado por: ${result.initiated_by}`);
      console.log(`⏰ Iniciado em: ${result.initiated_at}`);

      // 3. Aguardar processamento
      console.log('\n⏳ Aguardando 15 segundos para processamento...');
      await new Promise(resolve => setTimeout(resolve, 15000));

      // 4. Verificar se foi salvo
      console.log('🔍 Verificando se foi salvo...');
      
      const draftsResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (draftsResponse.ok) {
        const draftsData = await draftsResponse.json();
        const customInsights = draftsData.drafts?.filter(d => d.insight_type === 'custom_insight') || [];
        
        console.log(`📊 Insights personalizados encontrados: ${customInsights.length}`);
        
        // Procurar pelo insight recém-criado
        const recentInsight = customInsights.find(insight => 
          insight.subject === payload.subject &&
          new Date(insight.created_at) > new Date(Date.now() - 20 * 60 * 1000) // Últimos 20 minutos
        );

        if (recentInsight) {
          console.log('\n🎉 Insight personalizado encontrado!');
          console.log(`📧 Assunto: ${recentInsight.subject}`);
          console.log(`👤 Para: ${recentInsight.users?.email}`);
          console.log(`🆔 ID: ${recentInsight.id}`);
          console.log(`📅 Criado: ${new Date(recentInsight.created_at).toLocaleString('pt-BR')}`);
          
          // Mostrar preview do conteúdo
          const content = recentInsight.body_html || recentInsight.content || '';
          if (content) {
            const preview = content.replace(/<[^>]*>/g, '').substring(0, 200);
            console.log(`📝 Preview: ${preview}...`);
          }
        } else {
          console.log('⚠️  Insight personalizado não encontrado nos drafts recentes');
        }
      }

    } else {
      console.log('❌ Erro na geração do insight');
    }

    // 5. Fazer logout
    await supabase.auth.signOut();

  } catch (error) {
    console.error('💥 Erro na geração:', error.message);
  }
}

// Executar geração
generateRealCustomInsight().then(() => {
  console.log('\n🏁 Geração concluída!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});