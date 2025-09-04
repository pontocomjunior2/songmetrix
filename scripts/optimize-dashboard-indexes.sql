-- Dashboard Query Optimization - Index Creation Script
-- This script creates optimized indexes for dashboard queries

-- Drop existing problematic indexes if they exist
DROP INDEX IF EXISTS idx_streams_status;

-- 1. Core indexes for music_log table
-- Date index for time-based filtering (most important)
CREATE INDEX IF NOT EXISTS idx_music_log_date ON music_log(date);

-- Name index for radio filtering
CREATE INDEX IF NOT EXISTS idx_music_log_name ON music_log(name);

-- Artist index for artist aggregations
CREATE INDEX IF NOT EXISTS idx_music_log_artist ON music_log(artist);

-- Genre index for genre aggregations (with NULL handling)
CREATE INDEX IF NOT EXISTS idx_music_log_genre ON music_log(genre) WHERE genre IS NOT NULL AND genre <> '';

-- Song title index for song aggregations
CREATE INDEX IF NOT EXISTS idx_music_log_song_title ON music_log(song_title);

-- 2. Composite indexes for common query patterns
-- Date + Name composite for filtered date queries
CREATE INDEX IF NOT EXISTS idx_music_log_date_name ON music_log(date, name);

-- Date + Artist composite for artist trending
CREATE INDEX IF NOT EXISTS idx_music_log_date_artist ON music_log(date, artist);

-- Date + Genre composite for genre analysis
CREATE INDEX IF NOT EXISTS idx_music_log_date_genre ON music_log(date, genre) WHERE genre IS NOT NULL AND genre <> '';

-- Song + Artist composite for unique song identification
CREATE INDEX IF NOT EXISTS idx_music_log_song_artist ON music_log(song_title, artist);

-- 3. Optimized indexes for streams table
-- Segmento index for segment filtering
CREATE INDEX IF NOT EXISTS idx_streams_segmento ON streams(segmento);

-- Name index (already exists but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_streams_name ON streams(name);

-- Composite index for segment + name lookups
CREATE INDEX IF NOT EXISTS idx_streams_segmento_name ON streams(segmento, name);

-- 4. Partial indexes for performance
-- Index only for recent data (last 30 days) - most queries focus on recent data
CREATE INDEX IF NOT EXISTS idx_music_log_recent_date ON music_log(date, name, artist, song_title) 
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- Index for non-null genres only
CREATE INDEX IF NOT EXISTS idx_music_log_valid_genre ON music_log(genre, date) 
WHERE genre IS NOT NULL AND genre <> '';

-- 5. Covering indexes for dashboard aggregations
-- Covering index for artist counts
CREATE INDEX IF NOT EXISTS idx_music_log_artist_covering ON music_log(artist, date) 
INCLUDE (song_title);

-- Covering index for song counts
CREATE INDEX IF NOT EXISTS idx_music_log_song_covering ON music_log(song_title, artist, date);

-- 6. Update table statistics
ANALYZE music_log;
ANALYZE streams;

-- 7. Comments for documentation
COMMENT ON INDEX idx_music_log_date IS 'Primary date filtering index for dashboard queries';
COMMENT ON INDEX idx_music_log_name IS 'Radio name filtering index';
COMMENT ON INDEX idx_music_log_date_name IS 'Composite index for date + radio filtering';
COMMENT ON INDEX idx_music_log_recent_date IS 'Partial index for recent data queries (30 days)';
COMMENT ON INDEX idx_streams_segmento IS 'Segment filtering index for user preferences';

-- Display index creation results
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