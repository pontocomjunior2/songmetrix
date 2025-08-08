#!/usr/bin/env node

/**
 * Script para testar o fluxo completo de insights personalizados
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

async function testCompleteFlow() {
  try {
    console.log('🧪 Testando fluxo completo de insights personalizados...\n');

    // 1. Fazer login
    console.log('1️⃣ Fazendo login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@songmetrix.com',
      password: 'Admin@@2024'
    });

    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }

    const token = loginData.session.access_token;
    console.log('✅ Login bem-sucedido!');

    // 2. Gerar insight personalizado
    console.log('\n2️⃣ Gerando insight personalizado...');
    
    const payload = {
      targetType: 'user',
      targetId: '59ad79e3-9510-440c-bfc2-d10f48c8e276',
      subject: '🎵 Teste Completo - Insight Personalizado',
      customPrompt: `
Olá {user_name}!

Este é um teste completo do sistema de insights personalizados.

🎵 Sua música favorita: {top_song}
👨‍🎤 Artista preferido: {top_artist}
📊 Execuções da semana: {weekly_plays}
📈 Crescimento: {growth_rate}

Obrigado por usar o SongMetrix!

Equipe SongMetrix
      `.trim(),
      variables: ['user_name', 'top_song', 'top_artist', 'weekly_plays', 'growth_rate']
    };

    const generateResponse = await fetch(`${API_BASE_URL}/api/admin/insights/generate-custom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${generateResponse.status}`);
    const generateResult = await generateResponse.text();
    console.log('Resposta:', generateResult);

    if (!generateResponse.ok) {
      console.error('❌ Erro na geração');
      return;
    }

    console.log('✅ Insight gerado!');

    // 3. Aguardar um pouco
    console.log('\n3️⃣ Aguardando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Buscar drafts
    console.log('\n4️⃣ Buscando drafts...');
    
    const draftsResponse = await fetch(`${API_BASE_URL}/api/admin/insights/drafts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!draftsResponse.ok) {
      console.error('❌ Erro ao buscar drafts:', draftsResponse.status);
      return;
    }

    const draftsData = await draftsResponse.json();
    const customInsights = draftsData.drafts?.filter(d => d.insight_type === 'custom_insight') || [];
    
    console.log(`✅ Drafts encontrados: ${customInsights.length}`);

    if (customInsights.length === 0) {
      console.log('⚠️  Nenhum insight personalizado encontrado');
      return;
    }

    // 5. Testar aprovação
    const latestInsight = customInsights[0];
    console.log(`\n5️⃣ Testando aprovação do insight: ${latestInsight.id}`);

    const approveResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${latestInsight.id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status da aprovação: ${approveResponse.status}`);

    if (approveResponse.ok) {
      console.log('✅ Insight aprovado!');

      // 6. Testar envio
      console.log('\n6️⃣ Testando envio...');

      const sendResponse = await fetch(`${API_BASE_URL}/api/admin/insights/${latestInsight.id}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      console.log(`Status do envio: ${sendResponse.status}`);
      
      if (sendResponse.ok) {
        const sendResult = await sendResponse.json();
        console.log('✅ E-mail enviado!');
        console.log('Destinatário:', sendResult.recipient);
      } else {
        const sendError = await sendResponse.text();
        console.log('❌ Erro no envio:', sendError);
      }
    } else {
      const approveError = await approveResponse.text();
      console.log('❌ Erro na aprovação:', approveError);
    }

    // 7. Fazer logout
    await supabase.auth.signOut();
    console.log('\n7️⃣ Logout realizado');

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
  }
}

// Executar teste
testCompleteFlow().then(() => {
  console.log('\n🏁 Teste completo concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});