import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Chess } from "chess.js";
import { chessOutcome, chooseAiMove, restoreChess } from "../lib/chess-core.ts";
import { CHESS_LEADERBOARD_QUERY } from "../lib/chess-leaderboard-query.ts";

test("legal rules reject illegal moves and preserve the board", () => {
  const chess = new Chess(); const before = chess.fen();
  assert.throws(() => chess.move({ from: "e2", to: "e5" }));
  assert.equal(chess.fen(), before);
  chess.move("f3"); chess.move("e5"); chess.move("g4"); chess.move("Qh4#");
  assert.deepEqual(chessOutcome(chess), { result: "0-1", reason: "checkmate" });
  assert.throws(() => chess.move("a3"));
});

test("PGN persistence preserves threefold repetition and turn state", () => {
  const chess = new Chess();
  for (const move of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]) chess.move(move);
  const restored = restoreChess(chess.pgn());
  assert.equal(restored.fen(), chess.fen());
  assert.deepEqual(restored.history(), chess.history());
  assert.deepEqual(chessOutcome(restored), { result: "1/2-1/2", reason: "threefold repetition" });
});

test("draw reasons distinguish stalemate, insufficient material and fifty-move rule", () => {
  assert.equal(chessOutcome(new Chess("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1"))?.reason, "stalemate");
  assert.equal(chessOutcome(new Chess("7k/8/8/8/8/8/8/K7 w - - 0 1"))?.reason, "insufficient material");
  assert.equal(chessOutcome(new Chess("7k/8/8/8/8/8/8/KR6 w - - 100 51"))?.reason, "fifty-move rule");
});

test("castling, en passant and underpromotion are retained by saved PGN", () => {
  const castle = new Chess();
  for (const move of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]) castle.move(move);
  assert.equal(restoreChess(castle.pgn()).get("g1")?.type, "k");
  assert.equal(restoreChess(castle.pgn()).get("f1")?.type, "r");
  const passant = new Chess();
  for (const move of ["e4", "a6", "e5", "d5", "exd6"]) passant.move(move);
  assert.equal(restoreChess(passant.pgn()).get("d5"), undefined);
  assert.equal(restoreChess(passant.pgn()).get("d6")?.type, "p");
  const promotion = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  promotion.move({ from: "a7", to: "a8", promotion: "n" });
  assert.equal(restoreChess(promotion.pgn()).get("a8")?.type, "n");
});

test("bounded AI chooses a legal move without altering persisted history", () => {
  const chess = new Chess(); chess.move("e4");
  for (const difficulty of ["beginner", "practice"] as const) {
    const before = chess.pgn(); const fen = chess.fen();
    const move = chooseAiMove(chess, difficulty, 60);
    assert.ok(move);
    assert.equal(chess.pgn(), before);
    assert.equal(chess.fen(), fen);
    assert.ok(chess.moves().includes(move.san));
  }
  const mate = new Chess("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1");
  assert.equal(chooseAiMove(mate, "practice"), null);
});

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE campuses (id TEXT PRIMARY KEY,name TEXT DEFAULT 'College',status TEXT DEFAULT 'active');
    CREATE TABLE users (id TEXT PRIMARY KEY,campus_id TEXT DEFAULT 'campus',status TEXT DEFAULT 'active',deleted_at INTEGER);
    CREATE TABLE profiles(user_id TEXT PRIMARY KEY,handle TEXT,display_name TEXT);
    CREATE TABLE chess_matches (id TEXT PRIMARY KEY,campus_id TEXT,white_user_id TEXT,black_user_id TEXT,status TEXT,result TEXT,suspicious INTEGER,created_at INTEGER,updated_at INTEGER,completed_at INTEGER);
    INSERT INTO campuses(id) VALUES ('campus'); INSERT INTO users(id) VALUES ('white'),('black'),('other');
    INSERT INTO profiles VALUES ('white','white','White'),('black','black','Black'),('other','other','Other');`);
  db.exec(readFileSync(new URL("../drizzle/0008_chess.sql", import.meta.url), "utf8"));
  db.prepare("INSERT INTO chess_games(id,campus_id,white_user_id,mode,status,fen,created_at,updated_at) VALUES('game','campus','white','multiplayer','waiting',?,1,1)").run(new Chess().fen());
  return db;
}

test("D1-compatible compare-and-swap prevents competing joins and replayed writes", () => {
  const db = database();
  try {
    const join = db.prepare("UPDATE chess_games SET black_user_id=?,status='active',version=version+1 WHERE id='game' AND version=0 RETURNING id");
    assert.ok(join.get("black"));
    assert.equal(join.get("other"), undefined);
    assert.equal(db.prepare("SELECT black_user_id FROM chess_games WHERE id='game'").get()?.black_user_id, "black");
    const move = db.prepare("UPDATE chess_games SET version=version+1,ply=ply+1 WHERE id='game' AND version=1 RETURNING id");
    assert.ok(move.get()); assert.equal(move.get(), undefined);
    assert.equal(db.prepare("SELECT ply FROM chess_games WHERE id='game'").get()?.ply, 1);
  } finally { db.close(); }
});

test("multiplayer completion reaches admin metadata and database rejects self play", () => {
  const db = database();
  try {
    assert.throws(() => db.exec("UPDATE chess_games SET black_user_id='white',status='active' WHERE id='game'"));
    db.exec("UPDATE chess_games SET black_user_id='black',status='active',version=1 WHERE id='game'");
    assert.equal(db.prepare("SELECT status FROM chess_matches WHERE id='game'").get()?.status, "active");
    db.exec("UPDATE chess_games SET status='completed',result='1-0',completed_at=100,updated_at=100 WHERE id='game'");
    const metadata = db.prepare("SELECT status,result,completed_at FROM chess_matches WHERE id='game'").get();
    assert.equal(metadata?.status, "completed"); assert.equal(metadata?.result, "1-0"); assert.equal(metadata?.completed_at, 100);
  } finally { db.close(); }
});

test("only one waiting room can be created per player", () => {
  const db = database();
  try {
    assert.throws(() => db.prepare("INSERT INTO chess_games(id,campus_id,white_user_id,mode,status,fen,created_at,updated_at) VALUES('duplicate','campus','white','multiplayer','waiting',?,1,1)").run(new Chess().fen()));
  } finally { db.close(); }
});

test("standings count server results once per opponent/day and exclude practice, short and flagged games", () => {
  const db = database();
  try {
    db.exec("UPDATE chess_games SET black_user_id='black',status='active',version=1 WHERE id='game'");
    db.exec("UPDATE chess_games SET status='completed',result='1-0',ply=8,completed_at=100 WHERE id='game'");
    const insert = db.prepare("INSERT INTO chess_games(id,campus_id,white_user_id,black_user_id,mode,status,fen,result,ply,created_at,updated_at,completed_at) VALUES(?,'campus',?,?,'multiplayer','completed',?,'1-0',?,1,1,?)");
    insert.run("rematch", "black", "white", new Chess().fen(), 12, 200);
    insert.run("early", "white", "other", new Chess().fen(), 2, 250);
    insert.run("tomorrow", "white", "black", new Chess().fen(), 12, 86_400_100);
    insert.run("flagged", "white", "other", new Chess().fen(), 12, 86_400_200);
    db.exec("INSERT INTO chess_matches(id,suspicious) VALUES('flagged',1)");
    db.prepare("INSERT INTO chess_games(id,campus_id,white_user_id,mode,status,fen,result,ply,created_at,updated_at,completed_at) VALUES('ai','campus','white','ai','completed',?,'1-0',12,1,1,100)").run(new Chess().fen());
    const standings = db.prepare(CHESS_LEADERBOARD_QUERY).all(0, "campus", "campus");
    assert.equal(standings.length, 2);
    assert.equal(standings[0].id, "white"); assert.equal(standings[0].points, 4); assert.equal(standings[0].games, 2);
    assert.equal(standings[1].id, "black"); assert.equal(standings[1].losses, 2);
    assert.equal(db.prepare(CHESS_LEADERBOARD_QUERY).all(500, null, null)[0].points, 2);
    assert.equal(db.prepare(CHESS_LEADERBOARD_QUERY).all(0, "another-campus", "another-campus").length, 0);
  } finally { db.close(); }
});
