#!/usr/bin/env node

/**
 * Script para testar a funcionalidade de busca nos rascunhos
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

async function testDraftsSearch() {
  try {
    console.log('🔍 Testando funcionalidade de busca nos rascunhos...\n');

    // Buscar todos os rascunhos
    const { data: allDrafts, error } = await supabase
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

    if (error) {
      console.error('❌ Erro ao buscar rascunhos:', error.message);
      return;
    }

    console.log(`📊 Total de rascunhos: ${allDrafts?.length || 0}\n`);

    if (!allDrafts || allDrafts.length === 0) {
      console.log('📭 Nenhum rascunho encontrado para testar');
      return;
    }

    // Estatísticas por tipo
    const customInsights = allDrafts.filter(d => d.insight_type === 'custom_insight');
    const autoInsights = allDrafts.filter(d => d.insight_type !== 'custom_insight');

    console.log('📈 Estatísticas:');
    console.log(`  ✨ Insights personalizados: ${customInsights.length}`);
    console.log(`  🤖 Insights automáticos: ${autoInsights.length}\n`);

    // Testar diferentes cenários de busca
    const testCases = [
      {
        name: 'Busca por e-mail',
        filter: (draft) => draft.users?.email?.includes('@'),
        description: 'Rascunhos com e-mail válido'
      },
      {
        name: 'Busca por tipo personalizado',
        filter: (draft) => draft.insight_type === 'custom_insight',
        description: 'Apenas insights personalizados'
      },
      {
        name: 'Busca por assunto com "crescimento"',
        filter: (draft) => 
          draft.subject?.toLowerCase().includes('crescimento') ||
          draft.email_subject?.toLowerCase().includes('crescimento'),
        description: 'Assuntos contendo "crescimento"'
      },
      {
        name: 'Busca por usuários com nome',
        filter: (draft) => draft.users?.full_name && draft.users.full_name.trim() !== '',
        description: 'Usuários com nome preenchido'
      }
    ];

    console.log('🧪 Testando cenários de busca:\n');

    testCases.forEach((testCase, index) => {
      const results = allDrafts.filter(testCase.filter);
      console.log(`${index + 1}. ${testCase.name}`);
      console.log(`   📝 ${testCase.description}`);
      console.log(`   📊 Resultados: ${results.length} de ${allDrafts.length}`);
      
      if (results.length > 0) {
        console.log('   📋 Exemplos:');
        results.slice(0, 3).forEach((result, i) => {
          console.log(`     ${i + 1}. ${result.users?.email} - ${result.subject || result.email_subject || 'Sem assunto'}`);
        });
      }
      console.log('');
    });

    // Mostrar alguns exemplos de dados para debug
    console.log('🔍 Exemplos de dados para debug:\n');
    allDrafts.slice(0, 3).forEach((draft, index) => {
      console.log(`${index + 1}. ID: ${draft.id}`);
      console.log(`   Usuário: ${draft.users?.full_name || 'N/A'} (${draft.users?.email})`);
      console.log(`   Assunto: ${draft.subject || draft.email_subject || 'N/A'}`);
      console.log(`   Tipo: ${draft.insight_type}`);
      console.log(`   Status: ${draft.status}`);
      console.log(`   Criado: ${new Date(draft.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
  }
}

// Executar teste
testDraftsSearch().then(() => {
  console.log('✅ Teste de busca concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});