CREATE TABLE chess_games (
  id TEXT PRIMARY KEY NOT NULL,
  campus_id TEXT NOT NULL REFERENCES campuses(id),
  white_user_id TEXT NOT NULL REFERENCES users(id),
  black_user_id TEXT REFERENCES users(id),
  mode TEXT NOT NULL CHECK (mode IN ('ai','multiplayer')),
  difficulty TEXT NOT NULL DEFAULT 'practice' CHECK (difficulty IN ('beginner','practice')),
  status TEXT NOT NULL CHECK (status IN ('waiting','active','completed','cancelled')),
  fen TEXT NOT NULL,
  pgn TEXT NOT NULL DEFAULT '',
  ply INTEGER NOT NULL DEFAULT 0 CHECK (ply >= 0),
  version INTEGER NOT NULL DEFAULT 0,
  result TEXT CHECK (result IN ('1-0','0-1','1/2-1/2')),
  result_reason TEXT,
  draw_offered_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  CHECK (black_user_id IS NULL OR black_user_id <> white_user_id),
  CHECK (mode = 'multiplayer' OR black_user_id IS NULL),
  CHECK (mode = 'ai' OR status IN ('waiting','cancelled') OR black_user_id IS NOT NULL)
);
CREATE INDEX chess_games_campus_status_idx ON chess_games(campus_id,status,created_at);
CREATE INDEX chess_games_white_idx ON chess_games(white_user_id,updated_at);
CREATE INDEX chess_games_black_idx ON chess_games(black_user_id,updated_at);
CREATE INDEX chess_games_completed_idx ON chess_games(mode,status,completed_at);
CREATE UNIQUE INDEX chess_games_waiting_owner_uq ON chess_games(white_user_id) WHERE status = 'waiting';

-- Keep the established administrative analytics connected to real multiplayer games.
CREATE TRIGGER chess_games_join_admin AFTER UPDATE OF black_user_id ON chess_games
WHEN NEW.mode = 'multiplayer' AND NEW.black_user_id IS NOT NULL AND OLD.black_user_id IS NULL
BEGIN
  INSERT INTO chess_matches (id,campus_id,white_user_id,black_user_id,status,result,suspicious,created_at,updated_at,completed_at)
  VALUES (NEW.id,NEW.campus_id,NEW.white_user_id,NEW.black_user_id,NEW.status,NEW.result,0,NEW.created_at,NEW.updated_at,NEW.completed_at);
END;
CREATE TRIGGER chess_games_update_admin AFTER UPDATE OF status,result ON chess_games
WHEN NEW.mode = 'multiplayer' AND NEW.black_user_id IS NOT NULL
BEGIN
  UPDATE chess_matches SET status = NEW.status,result = NEW.result,updated_at = NEW.updated_at,completed_at = NEW.completed_at WHERE id = NEW.id;
END;
