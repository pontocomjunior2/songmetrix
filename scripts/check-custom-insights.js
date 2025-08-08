#!/usr/bin/env node

/**
 * Script para verificar insights personalizados no banco de dados
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

async function checkCustomInsights() {
  try {
    console.log('🔍 Verificando insights personalizados no banco...\n');

    // Buscar todos os rascunhos
    const { data: allDrafts, error: allError } = await supabase
      .from('generated_insight_emails')
      .select(`
        *,
        users (
          email,
          full_name
        )
      `)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Erro ao buscar rascunhos:', allError.message);
      return;
    }

    console.log(`📊 Total de rascunhos encontrados: ${allDrafts?.length || 0}\n`);

    if (allDrafts && allDrafts.length > 0) {
      // Separar insights personalizados dos automáticos
      const customInsights = allDrafts.filter(draft => draft.insight_type === 'custom_insight');
      const autoInsights = allDrafts.filter(draft => draft.insight_type !== 'custom_insight');

      console.log(`🎯 Insights personalizados: ${customInsights.length}`);
      console.log(`🤖 Insights automáticos: ${autoInsights.length}\n`);

      if (customInsights.length > 0) {
        console.log('📝 Últimos insights personalizados:');
        customInsights.slice(0, 5).forEach((insight, index) => {
          console.log(`\n${index + 1}. ID: ${insight.id}`);
          console.log(`   Usuário: ${insight.users?.full_name || 'N/A'} (${insight.users?.email})`);
          console.log(`   Assunto: ${insight.email_subject || insight.subject}`);
          console.log(`   Tipo: ${insight.insight_type}`);
          console.log(`   Status: ${insight.status}`);
          console.log(`   Criado em: ${new Date(insight.created_at).toLocaleString('pt-BR')}`);
          
          // Mostrar preview do conteúdo
          const content = insight.email_content || insight.content || '';
          const preview = content.replace(/<[^>]*>/g, '').substring(0, 100);
          console.log(`   Preview: ${preview}${content.length > 100 ? '...' : ''}`);
        });
      } else {
        console.log('⚠️  Nenhum insight personalizado encontrado');
      }

      if (autoInsights.length > 0) {
        console.log('\n🤖 Últimos insights automáticos:');
        autoInsights.slice(0, 3).forEach((insight, index) => {
          console.log(`\n${index + 1}. ID: ${insight.id}`);
          console.log(`   Usuário: ${insight.users?.full_name || 'N/A'} (${insight.users?.email})`);
          console.log(`   Assunto: ${insight.email_subject || insight.subject}`);
          console.log(`   Tipo: ${insight.insight_type}`);
          console.log(`   Criado em: ${new Date(insight.created_at).toLocaleString('pt-BR')}`);
        });
      }
    } else {
      console.log('📭 Nenhum rascunho encontrado no banco de dados');
    }

    // Verificar insights recentes (últimos 30 minutos)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: recentDrafts, error: recentError } = await supabase
      .from('generated_insight_emails')
      .select(`
        *,
        users (
          email,
          full_name
        )
      `)
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (!recentError && recentDrafts && recentDrafts.length > 0) {
      console.log(`\n🕐 Insights criados nos últimos 30 minutos: ${recentDrafts.length}`);
      recentDrafts.forEach((insight, index) => {
        console.log(`\n${index + 1}. ${insight.email_subject || insight.subject}`);
        console.log(`   Para: ${insight.users?.email}`);
        console.log(`   Tipo: ${insight.insight_type}`);
        console.log(`   Status: ${insight.status}`);
        console.log(`   Há: ${Math.round((Date.now() - new Date(insight.created_at).getTime()) / 60000)} minutos`);
      });
    }

  } catch (error) {
    console.error('💥 Erro ao verificar insights:', error.message);
  }
}

// Executar verificação
checkCustomInsights().then(() => {
  console.log('\n✅ Verificação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});