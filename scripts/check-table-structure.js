#!/usr/bin/env node

/**
 * Script para verificar a estrutura da tabela generated_insight_emails
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

async function checkTableStructure() {
  try {
    console.log('🔍 Verificando estrutura da tabela generated_insight_emails...\n');

    // Buscar um registro existente para ver as colunas disponíveis
    const { data: sampleRecord, error: sampleError } = await supabase
      .from('generated_insight_emails')
      .select('*')
      .limit(1)
      .single();

    if (sampleError) {
      console.error('❌ Erro ao buscar registro de exemplo:', sampleError.message);
      return;
    }

    if (!sampleRecord) {
      console.log('⚠️  Nenhum registro encontrado na tabela');
      return;
    }

    console.log('📊 Colunas disponíveis na tabela:');
    const columns = Object.keys(sampleRecord);
    columns.forEach((column, index) => {
      const value = sampleRecord[column];
      const type = typeof value;
      const preview = value ? (typeof value === 'string' ? value.substring(0, 50) + '...' : value) : 'null';
      
      console.log(`${index + 1}. ${column} (${type}): ${preview}`);
    });

    console.log(`\n📈 Total de colunas: ${columns.length}`);

    // Verificar se as colunas esperadas existem
    const expectedColumns = ['email_content', 'content', 'body_html', 'email_subject', 'subject'];
    console.log('\n🔍 Verificando colunas esperadas:');
    
    expectedColumns.forEach(col => {
      const exists = columns.includes(col);
      console.log(`   ${col}: ${exists ? '✅ Existe' : '❌ Não existe'}`);
    });

    // Mostrar estrutura de um registro completo
    console.log('\n📋 Estrutura completa de um registro:');
    console.log(JSON.stringify(sampleRecord, null, 2));

  } catch (error) {
    console.error('💥 Erro ao verificar estrutura:', error.message);
  }
}

// Executar verificação
checkTableStructure().then(() => {
  console.log('\n🏁 Verificação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});