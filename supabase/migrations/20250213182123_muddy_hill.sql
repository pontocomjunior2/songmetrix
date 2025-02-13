/*
  # Create executions table for music logs

  1. New Tables
    - `executions`
      - `id` (bigint, primary key)
      - `date` (date, not null)
      - `time` (time, not null)
      - `radio_name` (text, not null)
      - `artist` (text, not null)
      - `song_title` (text, not null)
      - `isrc` (text)
      - `city` (text)
      - `state` (text)
      - `genre` (text)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `executions` table
    - Add policy for authenticated users to read data
*/

CREATE TABLE IF NOT EXISTS executions (
  id bigint PRIMARY KEY,
  date date NOT NULL,
  time time NOT NULL,
  radio_name text NOT NULL,
  artist text NOT NULL,
  song_title text NOT NULL,
  isrc text,
  city text,
  state text,
  genre text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users"
  ON executions
  FOR SELECT
  TO authenticated
  USING (true);