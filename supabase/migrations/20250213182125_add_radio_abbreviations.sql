-- Drop existing table if it exists
DROP TABLE IF EXISTS radio_abbreviations;

-- Create radio_abbreviations table
CREATE TABLE radio_abbreviations (
    radio_name TEXT PRIMARY KEY,
    abbreviation VARCHAR(3) NOT NULL UNIQUE CHECK (abbreviation ~ '^[A-Z]{1,3}$'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on abbreviation for faster lookups
CREATE INDEX idx_radio_abbreviations_abbreviation ON radio_abbreviations(abbreviation);

-- Migrate data from old radios table if it exists
INSERT INTO radio_abbreviations (radio_name, abbreviation)
SELECT DISTINCT name, UPPER(SUBSTRING(name, 1, 3))
FROM music_log m
WHERE NOT EXISTS (
    SELECT 1 FROM radio_abbreviations ra 
    WHERE ra.radio_name = m.name
)
ON CONFLICT (radio_name) DO NOTHING;

-- Add foreign key constraint after data migration
ALTER TABLE radio_abbreviations 
ADD CONSTRAINT fk_radio_name 
FOREIGN KEY (radio_name) 
REFERENCES music_log(name)
ON DELETE CASCADE;

-- Add comment to table
COMMENT ON TABLE radio_abbreviations IS 'Stores abbreviations for radio names used in reports';

-- Add comments to columns
COMMENT ON COLUMN radio_abbreviations.radio_name IS 'The full name of the radio station (references music_log.name)';
COMMENT ON COLUMN radio_abbreviations.abbreviation IS 'The 3-character abbreviation used in reports';
COMMENT ON COLUMN radio_abbreviations.created_at IS 'When the abbreviation was first created';
COMMENT ON COLUMN radio_abbreviations.updated_at IS 'When the abbreviation was last updated';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_radio_abbreviations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_radio_abbreviations_updated_at
    BEFORE UPDATE ON radio_abbreviations
    FOR EACH ROW
    EXECUTE FUNCTION update_radio_abbreviations_updated_at();
