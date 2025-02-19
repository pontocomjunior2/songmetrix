ALTER TABLE music_log
ADD COLUMN IF NOT EXISTS abbreviation varchar(3);

CREATE INDEX IF NOT EXISTS idx_music_log_name 
ON music_log(name);
