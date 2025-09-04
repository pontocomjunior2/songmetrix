#!/usr/bin/env node
/**
 * Script para aplicar configurações otimizadas do PostgreSQL
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

console.log('🗄️  APLICANDO CONFIGURAÇÕES OTIMIZADAS DO POSTGRESQL');
console.log('=' .repeat(70));

// Verificar variáveis de ambiente
if (!process.env.POSTGRES_HOST || !process.env.POSTGRES_DB || !process.env.POSTGRES_USER) {
  console.error('❌ Variáveis de ambiente do banco não configuradas!');
  process.exit(1);
}

// Configurar pool de conexão com privilégios elevados
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

// Configurações otimizadas para evitar locks
const OPTIMIZATIONS = [
  // 1. CONFIGURAÇÕES DE LOCKS E TIMEOUTS
  "ALTER SYSTEM SET lock_timeout = '10s';",
  "ALTER SYSTEM SET deadlock_timeout = '1s';",
  "ALTER SYSTEM SET statement_timeout = '30s';",
  "ALTER SYSTEM SET log_lock_waits = 'on';",
  "ALTER SYSTEM SET log_statement = 'mod';",
  
  // 2. CONFIGURAÇÕES DE CONEXÕES
  "ALTER SYSTEM SET max_connections = '200';",
  
  // 3. CONFIGURAÇÕES DE MEMÓRIA E PERFORMANCE
  "ALTER SYSTEM SET shared_buffers = '256MB';",
  "ALTER SYSTEM SET effective_cache_size = '1GB';",
  "ALTER SYSTEM SET work_mem = '4MB';",
  "ALTER SYSTEM SET maintenance_work_mem = '64MB';",
  
  // 4. CONFIGURAÇÕES DE WAL
  "ALTER SYSTEM SET wal_buffers = '16MB';",
  "ALTER SYSTEM SET checkpoint_completion_target = '0.9';",
  "ALTER SYSTEM SET checkpoint_timeout = '5min';",
  
  // 5. CONFIGURAÇÕES DE AUTOVACUUM
  "ALTER SYSTEM SET autovacuum = 'on';",
  "ALTER SYSTEM SET autovacuum_max_workers = '3';",
  "ALTER SYSTEM SET autovacuum_naptime = '1min';",
  "ALTER SYSTEM SET autovacuum_vacuum_threshold = '50';",
  "ALTER SYSTEM SET autovacuum_analyze_threshold = '50';",
  
  // 6. CONFIGURAÇÕES DE LOG
  "ALTER SYSTEM SET log_min_duration_statement = '1000';",
  "ALTER SYSTEM SET log_checkpoints = 'on';",
  "ALTER SYSTEM SET log_connections = 'on';",
  "ALTER SYSTEM SET log_disconnections = 'on';",
  
  // 7. CONFIGURAÇÕES DE QUERY PLANNER
  "ALTER SYSTEM SET random_page_cost = '1.1';",
  "ALTER SYSTEM SET effective_io_concurrency = '200';"
];

// Função para aplicar configurações
async function applyOptimizations() {
  try {
    console.log('🔧 Aplicando configurações otimizadas...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const optimization of OPTIMIZATIONS) {
      try {
        console.log(`   Aplicando: ${optimization}`);
        await pool.query(optimization);
        console.log(`   ✅ Sucesso: ${optimization}`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Erro: ${optimization}`);
        console.log(`      Motivo: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 RESUMO:`);
    console.log(`   ✅ Sucessos: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    
    if (successCount > 0) {
      console.log('\n🔄 Recarregando configurações...');
      try {
        await pool.query('SELECT pg_reload_conf();');
        console.log('✅ Configurações recarregadas com sucesso');
      } catch (error) {
        console.log('⚠️  Não foi possível recarregar configurações automaticamente');
        console.log('💡 Execute manualmente: SELECT pg_reload_conf();');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao aplicar otimizações:', error.message);
  }
}

// Função para verificar configurações atuais
async function checkCurrentSettings() {
  try {
    console.log('\n📋 Verificando configurações atuais...\n');
    
    const settingsQuery = `
      SELECT name, setting, unit, context, category 
      FROM pg_settings 
      WHERE name IN (
        'lock_timeout', 'deadlock_timeout', 'statement_timeout',
        'max_connections', 'shared_buffers', 'work_mem',
        'autovacuum', 'log_lock_waits'
      )
      ORDER BY category, name;
    `;
    
    const result = await pool.query(settingsQuery);
    
    if (result.rows.length === 0) {
      console.log('⚠️  Nenhuma configuração relevante encontrada');
    } else {
      console.log(`📊 Configurações encontradas (${result.rows.length}):`);
      result.rows.forEach(setting => {
        console.log(`   ${setting.name}: ${setting.setting}${setting.unit ? ' ' + setting.unit : ''} (${setting.context})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar configurações:', error.message);
  }
}

// Função para criar índices otimizados
async function createOptimizedIndexes() {
  try {
    console.log('\n🔍 Criando índices otimizados...\n');
    
    const indexes = [
      // Índices para tabela streams
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_name ON streams(name);",
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_segmento ON streams(segmento);",
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_cidade ON streams(cidade);",
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_estado ON streams(estado);"
    ];
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const index of indexes) {
      try {
        console.log(`   Criando: ${index}`);
        await pool.query(index);
        console.log(`   ✅ Sucesso: ${index}`);
        successCount++;
      } catch (error) {
        console.log(`   ❌ Erro: ${index}`);
        console.log(`      Motivo: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 RESUMO DOS ÍNDICES:`);
    console.log(`   ✅ Sucessos: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar índices:', error.message);
  }
}

// Função para analisar tabelas
async function analyzeTables() {
  try {
    console.log('\n📊 Analisando tabelas para otimizar estatísticas...\n');
    
    const tables = ['streams']; // Adicione outras tabelas conforme necessário
    
    for (const table of tables) {
      try {
        console.log(`   Analisando tabela: ${table}`);
        await pool.query(`ANALYZE ${table};`);
        console.log(`   ✅ Análise concluída: ${table}`);
      } catch (error) {
        console.log(`   ❌ Erro ao analisar ${table}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao analisar tabelas:', error.message);
  }
}

// Função principal
async function main() {
  try {
    console.log('🚀 Iniciando otimização do PostgreSQL...\n');
    
    // Verificar configurações atuais
    await checkCurrentSettings();
    
    // Aplicar otimizações
    await applyOptimizations();
    
    // Criar índices otimizados
    await createOptimizedIndexes();
    
    // Analisar tabelas
    await analyzeTables();
    
    // Verificar configurações finais
    await checkCurrentSettings();
    
    console.log('\n🎉 OTIMIZAÇÃO DO POSTGRESQL CONCLUÍDA!');
    console.log('💡 Reinicie o servidor PostgreSQL para aplicar todas as mudanças');
    
  } catch (error) {
    console.error('❌ Erro na otimização:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
