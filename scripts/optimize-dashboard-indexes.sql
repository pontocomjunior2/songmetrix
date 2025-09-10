-- Dashboard Query Optimization - Index Creation Script (Produção)
-- Execute comando por comando para evitar problemas de transação

-- 1. Remover índices problemáticos (se existirem)
DROP INDEX IF EXISTS idx_streams_status;

-- 2. Índices básicos para music_log (sem CONCURRENTLY para evitar transação)
CREATE INDEX IF NOT EXISTS idx_music_log_date ON music_log(date);
CREATE INDEX IF NOT EXISTS idx_music_log_name ON music_log(name);
CREATE INDEX IF NOT EXISTS idx_music_log_artist ON music_log(artist);
CREATE INDEX IF NOT EXISTS idx_music_log_genre ON music_log(genre) WHERE genre IS NOT NULL AND genre <> '';
CREATE INDEX IF NOT EXISTS idx_music_log_song_title ON music_log(song_title);

-- 3. Índices compostos
CREATE INDEX IF NOT EXISTS idx_music_log_date_name ON music_log(date, name);
CREATE INDEX IF NOT EXISTS idx_music_log_date_artist ON music_log(date, artist);
CREATE INDEX IF NOT EXISTS idx_music_log_date_genre ON music_log(date, genre) WHERE genre IS NOT NULL AND genre <> '';
CREATE INDEX IF NOT EXISTS idx_music_log_song_artist ON music_log(song_title, artist);

-- 4. Índices para streams
CREATE INDEX IF NOT EXISTS idx_streams_segmento ON streams(segmento);
CREATE INDEX IF NOT EXISTS idx_streams_name ON streams(name);
CREATE INDEX IF NOT EXISTS idx_streams_segmento_name ON streams(segmento, name);

-- 5. Índice para dados recentes (versão sem CURRENT_DATE)
CREATE INDEX IF NOT EXISTS idx_music_log_recent_date ON music_log(date, name, artist, song_title);

-- 6. Índices de cobertura
CREATE INDEX IF NOT EXISTS idx_music_log_artist_covering ON music_log(artist, date) INCLUDE (song_title);
CREATE INDEX IF NOT EXISTS idx_music_log_song_covering ON music_log(song_title, artist, date);

-- 7. Atualizar estatísticas
ANALYZE music_log;
ANALYZE streams;

-- 8. Verificar índices criados
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('music_log', 'streams')
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;