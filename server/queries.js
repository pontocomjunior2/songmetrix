/* @ts-nocheck */
export const rankingQuery = "WITH adjusted_dates AS (\
SELECT \
  artist, \
  song_title, \
  genre, \
  (date + INTERVAL '3 hours')::date AS date, \
  time, \
  name \
FROM music_log\
), execution_counts AS (\
SELECT \
  artist, \
  song_title, \
  genre, \
  COUNT(*) AS executions \
FROM adjusted_dates \
WHERE ($3 = '' OR name IN (\
  SELECT DISTINCT TRIM(unnest) \
  FROM unnest(string_to_array($3, '||')) \
  WHERE TRIM(unnest) != ''\
)) \
GROUP BY artist, song_title, genre\
) \
SELECT \
  ROW_NUMBER() OVER (ORDER BY executions DESC) AS id, \
  artist, \
  song_title, \
  genre, \
  executions \
FROM execution_counts \
ORDER BY executions DESC \
LIMIT $4;";
