export const rankingQuery = `
  WITH adjusted_dates AS (
    SELECT 
      artist,
      song_title,
      genre,
      (date + INTERVAL '3 hours')::date as date,
      time,
      name
    FROM music_log
  ),
  execution_counts AS (
    SELECT 
      artist,
      song_title,
      genre,
      COUNT(*) as executions
    FROM adjusted_dates
    WHERE 1=1
`;

export const rankingQueryEnd = `
    GROUP BY artist, song_title, genre
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY executions DESC) as id,
    artist,
    song_title,
    genre,
    executions
  FROM execution_counts
  ORDER BY executions DESC
  LIMIT $${paramCount}
`;
