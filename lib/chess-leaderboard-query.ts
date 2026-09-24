// Bound parameters: cutoff timestamp, optional campus ID, optional campus ID.
// Kept as one query so ranking rules can be exercised against SQLite in tests.
export const CHESS_LEADERBOARD_QUERY = `
  WITH ranked AS (
    SELECT g.*, row_number() OVER (
      PARTITION BY min(g.white_user_id,g.black_user_id), max(g.white_user_id,g.black_user_id), cast(g.completed_at/86400000 as integer)
      ORDER BY g.completed_at,g.id
    ) AS pair_game
    FROM chess_games g
    WHERE g.mode = 'multiplayer' AND g.status = 'completed' AND g.ply >= 8
      AND g.result IS NOT NULL AND g.completed_at >= ? AND (? IS NULL OR g.campus_id = ?)
      AND NOT EXISTS (SELECT 1 FROM chess_matches m WHERE m.id=g.id AND m.suspicious=1)
  ), scores AS (
    SELECT white_user_id AS user_id, CASE result WHEN '1-0' THEN 2 WHEN '1/2-1/2' THEN 1 ELSE 0 END AS points,
      CASE WHEN result='1-0' THEN 1 ELSE 0 END AS wins, CASE WHEN result='0-1' THEN 1 ELSE 0 END AS losses,
      CASE WHEN result='1/2-1/2' THEN 1 ELSE 0 END AS draws FROM ranked WHERE pair_game=1
    UNION ALL
    SELECT black_user_id, CASE result WHEN '0-1' THEN 2 WHEN '1/2-1/2' THEN 1 ELSE 0 END,
      CASE WHEN result='0-1' THEN 1 ELSE 0 END, CASE WHEN result='1-0' THEN 1 ELSE 0 END,
      CASE WHEN result='1/2-1/2' THEN 1 ELSE 0 END FROM ranked WHERE pair_game=1
  )
  SELECT u.id, p.handle, p.display_name AS displayName, c.name AS campusName,
    sum(s.points) AS points, sum(s.wins) AS wins, sum(s.losses) AS losses, sum(s.draws) AS draws, count(*) AS games
  FROM scores s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.user_id=u.id JOIN campuses c ON c.id=u.campus_id
  WHERE u.status='active' AND u.deleted_at IS NULL AND c.status='active'
  GROUP BY u.id,p.handle,p.display_name,c.name ORDER BY points DESC,wins DESC,games ASC,p.handle ASC LIMIT 100
`;
