export const reportQuery = `
  WITH RankedSongs AS (
    SELECT 
      song_title,
      artist,
      name,
      COUNT(*) as executions
    FROM music_log
    WHERE 
      date BETWEEN $1 AND $2
      AND name = ANY($3)
    GROUP BY song_title, artist, name
  ),
  TotalExecutions AS (
    SELECT 
      song_title,
      artist,
      jsonb_object_agg(name, executions) as radio_executions,
      SUM(executions) as total_executions
    FROM RankedSongs
    GROUP BY song_title, artist
  )
  SELECT 
    song_title as title,
    artist,
    radio_executions as executions,
    total_executions as total
  FROM TotalExecutions
  ORDER BY total_executions DESC
  LIMIT $4;
`;
