#!/usr/bin/env node
/**
 * Script de monitoramento simplificado para testar conexão
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

console.log('🔍 MONITORAMENTO SIMPLIFICADO DE LOCKS');
console.log('=' .repeat(60));

// Verificar variáveis de ambiente
console.log('📋 Variáveis de ambiente:');
console.log(`   POSTGRES_HOST: ${process.env.POSTGRES_HOST || 'NÃO DEFINIDO'}`);
console.log(`   POSTGRES_DB: ${process.env.POSTGRES_DB || 'NÃO DEFINIDO'}`);
console.log(`   POSTGRES_USER: ${process.env.POSTGRES_USER || 'NÃO DEFINIDO'}`);
console.log(`   POSTGRES_PORT: ${process.env.POSTGRES_PORT || '5432'}`);

if (!process.env.POSTGRES_HOST || !process.env.POSTGRES_DB || !process.env.POSTGRES_USER) {
  console.error('❌ Variáveis de ambiente do banco não configuradas!');
  console.log('💡 Configure o arquivo .env com as credenciais do banco');
  process.exit(1);
}

// Configurar pool de conexão
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

// Função para verificar locks ativos
async function checkLocks() {
  try {
    console.log('\n🔒 Verificando locks ativos...');
    
    const locksQuery = `
      SELECT 
        l.pid,
        l.mode,
        l.granted,
        t.schemaname,
        t.tablename,
        p.usename,
        p.application_name,
        p.state,
        EXTRACT(EPOCH FROM (NOW() - p.query_start)) as query_duration_seconds
      FROM pg_locks l
      JOIN pg_stat_all_tables t ON l.relation = t.relid
      JOIN pg_stat_activity p ON l.pid = p.pid
      WHERE l.relation IS NOT NULL 
        AND t.schemaname = 'public'
      ORDER BY l.granted, l.mode, query_duration_seconds DESC
      LIMIT 10;
    `;
    
    const result = await pool.query(locksQuery);
    
    if (result.rows.length === 0) {
      console.log('✅ Nenhum lock ativo encontrado');
    } else {
      console.log(`📊 Encontrados ${result.rows.length} locks ativos:`);
      result.rows.forEach((lock, index) => {
        console.log(`\n   Lock ${index + 1}:`);
        console.log(`     PID: ${lock.pid}`);
        console.log(`     Tabela: ${lock.schemaname}.${lock.tablename}`);
        console.log(`     Modo: ${lock.mode}`);
        console.log(`     Concedido: ${lock.granted ? '✅ Sim' : '❌ Não'}`);
        console.log(`     Usuário: ${lock.usename}`);
        console.log(`     Aplicação: ${lock.application_name || 'N/A'}`);
        console.log(`     Estado: ${lock.state}`);
        console.log(`     Duração: ${Math.round(lock.query_duration_seconds || 0)}s`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar locks:', error.message);
  }
}

// Função para verificar transações longas
async function checkLongTransactions() {
  try {
    console.log('\n⏱️  Verificando transações longas...');
    
    const longTxQuery = `
      SELECT 
        pid,
        usename,
        application_name,
        state,
        EXTRACT(EPOCH FROM (NOW() - xact_start)) as transaction_duration_seconds,
        EXTRACT(EPOCH FROM (NOW() - query_start)) as query_duration_seconds,
        query
      FROM pg_stat_activity 
      WHERE state != 'idle' 
        AND xact_start IS NOT NULL
        AND xact_start < NOW() - INTERVAL '5 seconds'
      ORDER BY transaction_duration_seconds DESC
      LIMIT 5;
    `;
    
    const result = await pool.query(longTxQuery);
    
    if (result.rows.length === 0) {
      console.log('✅ Nenhuma transação longa encontrada');
    } else {
      console.log(`📊 Encontradas ${result.rows.length} transações longas:`);
      result.rows.forEach((tx, index) => {
        console.log(`\n   Transação ${index + 1}:`);
        console.log(`     PID: ${tx.pid}`);
        console.log(`     Usuário: ${tx.usename}`);
        console.log(`     Aplicação: ${tx.application_name || 'N/A'}`);
        console.log(`     Estado: ${tx.state}`);
        console.log(`     Duração da Transação: ${Math.round(tx.transaction_duration_seconds)}s`);
        console.log(`     Duração da Query: ${Math.round(tx.query_duration_seconds)}s`);
        if (tx.query) {
          console.log(`     Query: ${tx.query.substring(0, 100)}...`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar transações longas:', error.message);
  }
}

// Função para verificar estatísticas das tabelas
async function checkTableStats() {
  try {
    console.log('\n📈 Verificando estatísticas das tabelas...');
    
    const statsQuery = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables 
      WHERE tablename IN ('streams', 'executions', 'radio_suggestions')
      ORDER BY tablename;
    `;
    
    const result = await pool.query(statsQuery);
    
    if (result.rows.length === 0) {
      console.log('⚠️  Nenhuma tabela relevante encontrada');
    } else {
      console.log(`📊 Estatísticas de ${result.rows.length} tabelas:`);
      result.rows.forEach(table => {
        console.log(`\n   📋 ${table.schemaname}.${table.tablename}:`);
        console.log(`     Inserts: ${table.inserts || 0}`);
        console.log(`     Updates: ${table.updates || 0}`);
        console.log(`     Deletes: ${table.deletes || 0}`);
        console.log(`     Linhas ativas: ${table.live_rows || 0}`);
        console.log(`     Linhas mortas: ${table.dead_rows || 0}`);
        console.log(`     Último vacuum: ${table.last_vacuum || 'Nunca'}`);
        console.log(`     Último autovacuum: ${table.last_autovacuum || 'Nunca'}`);
        console.log(`     Último analyze: ${table.last_analyze || 'Nunca'}`);
        console.log(`     Último autoanalyze: ${table.last_autoanalyze || 'Nunca'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar estatísticas:', error.message);
  }
}

// Função principal
async function main() {
  try {
    console.log('🚀 Iniciando verificação...\n');
    
    // Verificar locks
    await checkLocks();
    
    // Verificar transações longas
    await checkLongTransactions();
    
    // Verificar estatísticas das tabelas
    await checkTableStats();
    
    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
