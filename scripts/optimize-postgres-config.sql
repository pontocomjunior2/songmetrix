-- Script para otimizar configurações do PostgreSQL e evitar locks
-- Execute como superusuário (postgres)

-- 1. CONFIGURAÇÕES DE LOCKS E TIMEOUTS
ALTER SYSTEM SET lock_timeout = '10s';                    -- Timeout para locks
ALTER SYSTEM SET deadlock_timeout = '1s';                 -- Timeout para deadlocks
ALTER SYSTEM SET statement_timeout = '30s';               -- Timeout para statements
ALTER SYSTEM SET log_lock_waits = 'on';                   -- Log de esperas por locks
ALTER SYSTEM SET log_statement = 'mod';                   -- Log de statements modificadores

-- 2. CONFIGURAÇÕES DE CONEXÕES
ALTER SYSTEM SET max_connections = '200';                 -- Máximo de conexões simultâneas
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'; -- Estatísticas de queries

-- 3. CONFIGURAÇÕES DE MEMÓRIA E PERFORMANCE
ALTER SYSTEM SET shared_buffers = '256MB';                -- Buffer compartilhado (25% da RAM)
ALTER SYSTEM SET effective_cache_size = '1GB';            -- Cache efetivo (50% da RAM)
ALTER SYSTEM SET work_mem = '4MB';                        -- Memória por operação
ALTER SYSTEM SET maintenance_work_mem = '64MB';           -- Memória para manutenção

-- 4. CONFIGURAÇÕES DE WAL (Write-Ahead Log)
ALTER SYSTEM SET wal_buffers = '16MB';                    -- Buffers do WAL
ALTER SYSTEM SET checkpoint_completion_target = '0.9';    -- Alvo de conclusão do checkpoint
ALTER SYSTEM SET checkpoint_timeout = '5min';             -- Timeout do checkpoint

-- 5. CONFIGURAÇÕES DE AUTOVACUUM
ALTER SYSTEM SET autovacuum = 'on';                       -- Habilitar autovacuum
ALTER SYSTEM SET autovacuum_max_workers = '3';            -- Máximo de workers
ALTER SYSTEM SET autovacuum_naptime = '1min';             -- Intervalo entre execuções
ALTER SYSTEM SET autovacuum_vacuum_threshold = '50';      -- Threshold para vacuum
ALTER SYSTEM SET autovacuum_analyze_threshold = '50';     -- Threshold para analyze

-- 6. CONFIGURAÇÕES DE LOG
ALTER SYSTEM SET log_min_duration_statement = '1000';     -- Log queries > 1s
ALTER SYSTEM SET log_checkpoints = 'on';                  -- Log de checkpoints
ALTER SYSTEM SET log_connections = 'on';                  -- Log de conexões
ALTER SYSTEM SET log_disconnections = 'on';               -- Log de desconexões

-- 7. CONFIGURAÇÕES DE QUERY PLANNER
ALTER SYSTEM SET random_page_cost = '1.1';                -- Custo de páginas aleatórias
ALTER SYSTEM SET effective_io_concurrency = '200';        -- Concorrência de I/O

-- 8. RECARREGAR CONFIGURAÇÕES
SELECT pg_reload_conf();

-- 9. VERIFICAR CONFIGURAÇÕES ATUAIS
SELECT name, setting, unit, context, category 
FROM pg_settings 
WHERE name IN (
    'lock_timeout', 'deadlock_timeout', 'statement_timeout',
    'max_connections', 'shared_buffers', 'work_mem',
    'autovacuum', 'log_lock_waits'
)
ORDER BY category, name;

-- 10. CRIAR ÍNDICES PARA EVITAR SCANS SEQUENCIAIS
-- (Execute apenas se as tabelas existirem)

-- Índice para tabela streams
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_name ON streams(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_segmento ON streams(segmento);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_cidade ON streams(cidade);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_estado ON streams(estado);

-- Índice para tabela executions (se existir)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_radio_name ON executions(radio_name);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_date ON executions(date);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_artist ON executions(artist);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_song_title ON executions(song_title);

-- 11. ANALISAR TABELAS PARA OTIMIZAR ESTATÍSTICAS
ANALYZE streams;
-- ANALYZE executions; -- Descomente se a tabela existir

-- 12. VERIFICAR ESTATÍSTICAS DAS TABELAS
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

-- 13. VERIFICAR CONEXÕES ATIVAS
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    backend_start,
    state,
    query_start,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity 
WHERE state != 'idle'
ORDER BY query_start;

-- 14. VERIFICAR LOCKS ATIVOS
SELECT 
    l.pid,
    l.mode,
    l.granted,
    t.schemaname,
    t.tablename,
    p.usename,
    p.application_name,
    p.state,
    p.query
FROM pg_locks l
JOIN pg_stat_all_tables t ON l.relation = t.relid
JOIN pg_stat_activity p ON l.pid = p.pid
WHERE l.relation IS NOT NULL 
  AND t.schemaname = 'public'
ORDER BY l.granted, l.mode;
