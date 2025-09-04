import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

// Query para identificar locks ativos
const LOCKS_QUERY = `
SELECT 
    l.pid,
    l.mode,
    l.granted,
    l.fastpath,
    t.schemaname,
    t.tablename,
    p.usename,
    p.application_name,
    p.client_addr,
    p.client_hostname,
    p.backend_start,
    p.state,
    p.query_start,
    p.wait_event_type,
    p.wait_event,
    p.query,
    EXTRACT(EPOCH FROM (NOW() - p.query_start)) as query_duration_seconds
FROM pg_locks l
JOIN pg_stat_all_tables t ON l.relation = t.relid
JOIN pg_stat_activity p ON l.pid = p.pid
WHERE l.relation IS NOT NULL 
  AND t.schemaname = 'public'
  AND t.tablename IN ('streams', 'executions', 'radio_suggestions')
ORDER BY l.granted, l.mode, query_duration_seconds DESC;
`;

// Query para identificar transações longas
const LONG_TRANSACTIONS_QUERY = `
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    backend_start,
    xact_start,
    query_start,
    state,
    wait_event_type,
    wait_event,
    query,
    EXTRACT(EPOCH FROM (NOW() - xact_start)) as transaction_duration_seconds,
    EXTRACT(EPOCH FROM (NOW() - query_start)) as query_duration_seconds
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND xact_start IS NOT NULL
  AND xact_start < NOW() - INTERVAL '5 seconds'
ORDER BY transaction_duration_seconds DESC;
`;

// Query para identificar deadlocks
const DEADLOCKS_QUERY = `
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    backend_start,
    xact_start,
    query_start,
    state,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity 
WHERE wait_event_type = 'Lock'
  AND state = 'active'
ORDER BY query_start;
`;

async function monitorLocks() {
  try {
    console.log('🔍 Monitorando locks de tabela...\n');
    
    // Verificar locks ativos
    console.log('📊 LOCKS ATIVOS:');
    const locksResult = await pool.query(LOCKS_QUERY);
    if (locksResult.rows.length === 0) {
      console.log('✅ Nenhum lock ativo encontrado');
    } else {
      locksResult.rows.forEach((lock, index) => {
        console.log(`\n🔒 Lock ${index + 1}:`);
        console.log(`   PID: ${lock.pid}`);
        console.log(`   Tabela: ${lock.schemaname}.${lock.tablename}`);
        console.log(`   Modo: ${lock.mode}`);
        console.log(`   Concedido: ${lock.granted ? '✅ Sim' : '❌ Não'}`);
        console.log(`   Usuário: ${lock.usename}`);
        console.log(`   Aplicação: ${lock.application_name}`);
        console.log(`   Cliente: ${lock.client_addr || 'N/A'}`);
        console.log(`   Estado: ${lock.state}`);
        console.log(`   Duração da Query: ${Math.round(lock.query_duration_seconds)}s`);
        if (lock.query) {
          console.log(`   Query: ${lock.query.substring(0, 100)}...`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Verificar transações longas
    console.log('⏱️  TRANSAÇÕES LONGAS (>5s):');
    const longTxResult = await pool.query(LONG_TRANSACTIONS_QUERY);
    if (longTxResult.rows.length === 0) {
      console.log('✅ Nenhuma transação longa encontrada');
    } else {
      longTxResult.rows.forEach((tx, index) => {
        console.log(`\n🔄 Transação ${index + 1}:`);
        console.log(`   PID: ${tx.pid}`);
        console.log(`   Usuário: ${tx.usename}`);
        console.log(`   Aplicação: ${tx.application_name}`);
        console.log(`   Cliente: ${tx.client_addr || 'N/A'}`);
        console.log(`   Estado: ${tx.state}`);
        console.log(`   Duração da Transação: ${Math.round(tx.transaction_duration_seconds)}s`);
        console.log(`   Duração da Query: ${Math.round(tx.query_duration_seconds)}s`);
        if (tx.query) {
          console.log(`   Query: ${tx.query.substring(0, 100)}...`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Verificar deadlocks
    console.log('💀 POSSÍVEIS DEADLOCKS:');
    const deadlocksResult = await pool.query(DEADLOCKS_QUERY);
    if (deadlocksResult.rows.length === 0) {
      console.log('✅ Nenhum deadlock detectado');
    } else {
      deadlocksResult.rows.forEach((deadlock, index) => {
        console.log(`\n⚠️  Deadlock ${index + 1}:`);
        console.log(`   PID: ${deadlock.pid}`);
        console.log(`   Usuário: ${deadlock.usename}`);
        console.log(`   Aplicação: ${deadlock.application_name}`);
        console.log(`   Estado: ${deadlock.state}`);
        console.log(`   Evento de Espera: ${deadlock.wait_event_type} - ${deadlock.wait_event}`);
        if (deadlock.query) {
          console.log(`   Query: ${deadlock.query.substring(0, 100)}...`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao monitorar locks:', error);
  }
}

// Função para matar processos problemáticos
async function killProcess(pid) {
  try {
    await pool.query('SELECT pg_terminate_backend($1)', [pid]);
    console.log(`✅ Processo ${pid} terminado com sucesso`);
  } catch (error) {
    console.error(`❌ Erro ao terminar processo ${pid}:`, error);
  }
}

// Função para mostrar estatísticas de tabelas
async function showTableStats() {
  try {
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
    console.log('\n📈 ESTATÍSTICAS DAS TABELAS:');
    result.rows.forEach(table => {
      console.log(`\n📋 ${table.schemaname}.${table.tablename}:`);
      console.log(`   Inserts: ${table.inserts}`);
      console.log(`   Updates: ${table.updates}`);
      console.log(`   Deletes: ${table.deletes}`);
      console.log(`   Linhas ativas: ${table.live_rows}`);
      console.log(`   Linhas mortas: ${table.dead_rows}`);
      console.log(`   Último vacuum: ${table.last_vacuum || 'Nunca'}`);
      console.log(`   Último autovacuum: ${table.last_autovacuum || 'Nunca'}`);
      console.log(`   Último analyze: ${table.last_analyze || 'Nunca'}`);
      console.log(`   Último autoanalyze: ${table.last_autoanalyze || 'Nunca'}`);
    });
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
  }
}

// Função principal
async function main() {
  console.log('🚀 Iniciando monitoramento de locks do banco de dados...\n');
  
  // Monitorar uma vez
  await monitorLocks();
  await showTableStats();
  
  // Configurar monitoramento contínuo
  const interval = setInterval(async () => {
    console.log('\n' + '🔄'.repeat(20) + ' ATUALIZAÇÃO ' + new Date().toLocaleTimeString() + ' 🔄'.repeat(20));
    await monitorLocks();
  }, 30000); // Atualizar a cada 30 segundos
  
  // Permitir interrupção com Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Interrompendo monitoramento...');
    clearInterval(interval);
    await pool.end();
    process.exit(0);
  });
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { monitorLocks, killProcess, showTableStats };
