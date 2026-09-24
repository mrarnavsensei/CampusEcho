"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type PieceSymbol, type Square } from "chess.js";
import { ChevronLeft, Crown, RefreshCw, Swords } from "lucide-react";
import type { ChessRoom, ChessStanding } from "@/lib/chess-types";
import "./chess.css";

type Lobby = { mine: ChessRoom[]; waiting: ChessRoom[] };
const glyph: Record<PieceSymbol, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const pieceName: Record<PieceSymbol, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const payload = await response.json() as { data?: T; error?: { message: string } };
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "Unable to load chess. Please try again.");
  return payload.data as T;
}

function gameLabel(game: ChessRoom) {
  if (game.status === "waiting") return "Waiting for an opponent";
  if (game.status === "cancelled") return "Room cancelled";
  if (game.status === "completed") return `${game.result} · ${game.resultReason}`;
  return `${game.turn === game.yourColor ? "Your turn" : "Opponent's turn"}${game.inCheck ? " · Check" : ""}`;
}

export default function ChessHub() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [game, setGame] = useState<ChessRoom | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Connected");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState("q");
  const [difficulty, setDifficulty] = useState<"beginner" | "practice">("practice");
  const [period, setPeriod] = useState("weekly");
  const [scope, setScope] = useState("campus");
  const [standings, setStandings] = useState<ChessStanding[] | null>(null);
  const [standingsError, setStandingsError] = useState("");
  const [standingsRefresh, setStandingsRefresh] = useState(0);

  const refreshLobby = useCallback(async () => {
    try { setLobby(await api<Lobby>("/api/chess")); setConnection("Connected"); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load your games."); }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      try { const data = await api<Lobby>("/api/chess", { signal: controller.signal }); if (!stopped) { setLobby(data); setConnection("Connected"); } }
      catch (err) { if (!stopped) setError(err instanceof Error ? err.message : "Unable to load your games."); }
      if (!stopped) timer = setTimeout(load, 12_000);
    };
    void load();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, []);

  const gameId = game?.id;
  const gameStatus = game?.status;
  useEffect(() => {
    if (!gameId || !["active", "waiting"].includes(gameStatus ?? "")) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      if (stopped) return;
      if (!busyRef.current && !document.hidden) {
        try {
          const next = await api<ChessRoom>(`/api/chess/${gameId}`, { signal: controller.signal });
          if (!stopped) { setGame(current => current?.id === next.id && current.version <= next.version ? next : current); setConnection("Connected"); }
        } catch { if (!stopped) setConnection("Connection lost · reconnecting"); }
      }
      if (!stopped) timer = setTimeout(load, 2500);
    };
    void load();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [gameId, gameStatus]);

  useEffect(() => {
    const controller = new AbortController();
    api<ChessStanding[]>(`/api/chess/leaderboard?period=${period}&scope=${scope}`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setStandings(data); setStandingsError(""); } }).catch(err => { if (!controller.signal.aborted) setStandingsError(err.message); });
    return () => controller.abort();
  }, [period, scope, standingsRefresh, gameStatus]);

  const create = async (mode: "ai" | "multiplayer") => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setSelected(null);
    try { setGame(await api<ChessRoom>("/api/chess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, difficulty }) })); await refreshLobby(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to create game."); await refreshLobby(); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const act = async (action: string, target = game, move?: { from: string; to: string; promotion: string }) => {
    if (!target || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setSelected(null);
    try {
      const next = await api<ChessRoom>(`/api/chess/${target.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, version: target.version, ...move }) });
      setGame(current => current?.id === next.id && current.version > next.version ? current : next);
      setConnection("Connected"); void refreshLobby();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed. Please refresh.");
      // A lost response can still represent a committed move; refresh, never resend automatically.
      try { const next = await api<ChessRoom>(`/api/chess/${target.id}`); setGame(current => current?.id === next.id && current.version > next.version ? current : next); } catch { setConnection("Connection lost · reconnecting"); }
    } finally { busyRef.current = false; setBusy(false); }
  };

  const board = useMemo(() => game ? new Chess(game.fen) : null, [game]);
  const squares = useMemo(() => {
    const files = game?.yourColor === "b" ? "hgfedcba" : "abcdefgh";
    const ranks = game?.yourColor === "b" ? "12345678" : "87654321";
    return [...ranks].flatMap(rank => [...files].map(file => `${file}${rank}` as Square));
  }, [game?.yourColor]);
  const destinations = new Set(game?.legalMoves.filter(m => m.from === selected).map(m => m.to));
  const chooseSquare = (square: Square) => {
    if (!game || busy || game.status !== "active" || game.turn !== game.yourColor) return;
    if (selected && destinations.has(square)) { void act("move", game, { from: selected, to: square, promotion }); return; }
    const piece = board?.get(square);
    setSelected(piece?.color === game.yourColor && square !== selected ? square : null);
  };

  return <div className="chess-hub">
    <header className="chess-heading"><div><span className="eyebrow"><Crown /> Campus chess</span><h2>A good move starts here.</h2><p>Practice with AI or challenge a student from your college.</p></div><button className="secondary" disabled={busy} onClick={() => { setError(""); void refreshLobby(); setStandingsRefresh(v => v + 1); }} aria-label="Refresh games and standings"><RefreshCw size={16} /> Refresh</button></header>
    {error && <div className="chess-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss chess error">×</button></div>}
    {game ? <div className="chess-play-layout">
      <section className="chess-card chess-game" aria-label="Current chess game">
        <div className="chess-game-top"><button className="chess-text-button" disabled={busy} onClick={() => { setGame(null); setSelected(null); }}><ChevronLeft size={16} /> All games</button><span className="chess-sync">{connection} · checks every 2.5s</span></div>
        <div className="chess-player"><span>{game.yourColor === "b" ? game.white : game.black}</span><small>{game.yourColor === "b" ? "White" : "Black"}</small></div>
        <div className="chess-board" aria-label="Chess board. Select a piece, then a highlighted destination. Arrow keys move between squares.">
          {squares.map((square, index) => {
            const piece = board?.get(square);
            const light = (square.charCodeAt(0) + Number(square[1])) % 2 !== 0;
            return <button type="button" key={square} className={`chess-square ${light ? "light" : "dark"}${selected === square ? " selected" : ""}${destinations.has(square) ? " destination" : ""}`} onClick={() => chooseSquare(square)} aria-pressed={selected === square} aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${pieceName[piece.type]}` : ", empty"}${destinations.has(square) ? ", legal destination" : ""}`} onKeyDown={event => {
              const delta: Record<string, number> = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
              if (!(event.key in delta)) return;
              event.preventDefault();
              const targetIndex = index + delta[event.key];
              if (targetIndex >= 0 && targetIndex < 64) (event.currentTarget.parentElement?.children[targetIndex] as HTMLButtonElement)?.focus();
            }}>
              {piece && <span aria-hidden="true" className={`chess-piece-glyph ${piece.color === "w" ? "white-piece" : "black-piece"}`}>{glyph[piece.type]}</span>}
              <span className="chess-coordinate" aria-hidden="true">{square}</span>
            </button>;
          })}
        </div>
        <div className="chess-player"><span>{game.yourColor === "b" ? game.black : game.white}{game.yourColor ? " · You" : ""}</span><small>{game.yourColor === "b" ? "Black" : "White"}</small></div>
        <p className="chess-game-status" role="status" aria-live="polite">{busy ? "Saving your action…" : selected ? `Selected ${selected}. Choose a highlighted square.` : gameLabel(game)}</p>
        {game.status === "waiting" && <p className="chess-note">Your room is listed for students at your college. You can leave this screen and resume from Your games.</p>}
        {game.status === "active" && <div className="chess-game-actions"><label>Promote pawn to <select value={promotion} onChange={e => setPromotion(e.target.value)}><option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option></select></label><button className="secondary" disabled={busy} onClick={() => { if (window.confirm("Resign this game? Your opponent will win.")) void act("resign"); }}>Resign</button>{game.mode === "multiplayer" && <button className="secondary" disabled={busy || Boolean(game.drawOffer)} onClick={() => void act("offer_draw")}>{game.drawOffer === "yours" ? "Draw offered" : "Offer draw"}</button>}</div>}
        {game.drawOffer === "opponent" && <div className="chess-draw"><span>Your opponent offers a draw.</span><button className="primary" disabled={busy} onClick={() => void act("accept_draw")}>Accept</button><button className="secondary" disabled={busy} onClick={() => void act("decline_draw")}>Decline</button></div>}
        {game.status === "waiting" && game.yourColor === "w" && <button className="secondary" disabled={busy} onClick={() => void act("cancel")}>Cancel room</button>}
      </section>
      <aside className="chess-card chess-move-card"><h3>Move history</h3>{game.moves.length ? <ol className="chess-moves">{Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, i) => <li key={i}><span>{game.moves[i * 2]}</span><span>{game.moves[i * 2 + 1] ?? "—"}</span></li>)}</ol> : <p className="chess-note">Your opening move is waiting.</p>}<p className="chess-note">Untimed games. Every move is checked and saved by the server. Reopen a game to reconnect.</p></aside>
    </div> : <>
      <div className="chess-start-grid"><section className="chess-card"><span className="eyebrow">Build your confidence</span><h3>Play against AI</h3><p>A lightweight practice opponent. AI games never affect standings.</p><label className="chess-difficulty">Difficulty<select value={difficulty} onChange={e => setDifficulty(e.target.value as "beginner" | "practice")}><option value="beginner">Beginner · one move ahead</option><option value="practice">Practice · two moves ahead</option></select></label><button className="primary" disabled={busy} onClick={() => void create("ai")}>Start practice</button></section><section className="chess-card"><span className="eyebrow">Meet your next opponent</span><h3>Campus multiplayer</h3><p>Create an open room for your college. Play at your own pace with no clock.</p><button className="primary" disabled={busy} onClick={() => void create("multiplayer")}><Swords size={16} /> Create a room</button><p className="chess-note">Moves sync through short polling. A room stays available until joined or cancelled.</p></section></div>
      <div className="chess-lobby-grid"><section className="chess-card"><h3>Open campus rooms</h3>{!lobby ? <div className="chess-skeleton" aria-label="Loading available rooms" /> : !lobby.waiting.length ? <p className="chess-empty">No open rooms yet. Create one and invite a classmate to join from this screen.</p> : lobby.waiting.map(room => <div className="chess-room" key={room.id}><div><strong>{room.white}</strong><small>Looking for an opponent · You play Black</small></div><button className="secondary" disabled={busy} onClick={() => void act("join", room)}>Join</button></div>)}</section><section className="chess-card"><h3>Your games</h3>{!lobby ? <div className="chess-skeleton" aria-label="Loading your games" /> : !lobby.mine.length ? <p className="chess-empty">Your games will be saved here. Start with a practice match.</p> : lobby.mine.map(room => <button className="chess-room chess-resume" key={room.id} disabled={busy} onClick={() => { setGame(room); setSelected(null); setError(""); }}><div><strong>{room.white} vs {room.black}</strong><small>{gameLabel(room)} · {new Date(room.updatedAt).toLocaleDateString()}</small></div><span>{["active", "waiting"].includes(room.status) ? "Resume" : "Review"}</span></button>)}{lobby && lobby.mine.length >= 20 && <p className="chess-note">Showing your 20 most recently updated games.</p>}</section></div>
    </>}
    <section className="chess-card chess-standings"><div className="chess-standings-top"><div><h3>Community standings</h3><p>Win: 2 points · Draw: 1 point · AI games excluded</p></div><div className="chess-filters"><label className="sr-only" htmlFor="chess-scope">Leaderboard scope</label><select id="chess-scope" value={scope} onChange={e => setScope(e.target.value)}><option value="campus">My college</option><option value="global">All colleges</option></select><label className="sr-only" htmlFor="chess-period">Leaderboard period</label><select id="chess-period" value={period} onChange={e => setPeriod(e.target.value)}><option value="weekly">Last 7 days</option><option value="monthly">Last 30 days</option><option value="all">All time</option></select></div></div>{standingsError ? <div className="chess-error" role="alert">{standingsError}<button className="secondary" onClick={() => setStandingsRefresh(v => v + 1)}>Retry</button></div> : !standings ? <div className="chess-skeleton" aria-label="Loading standings" /> : !standings.length ? <p className="chess-empty">No qualifying games in this period. Complete a campus match to get started.</p> : <div className="chess-table-scroll"><table><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Points</th><th scope="col">W / D / L</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.displayName}</strong><small>@{row.handle}{scope === "global" ? ` · ${row.campusName}` : ""}</small></td><td>{row.points}</td><td>{row.wins} / {row.draws} / {row.losses}</td></tr>)}</tbody></table></div>}<details className="chess-rules"><summary>Game and standings rules</summary><p>Only completed multiplayer games with at least 8 moves (4 by each side) qualify. The first qualifying game with each opponent per UTC day counts. Rankings are community participation points, not official Elo or proof of fair play.</p><p>Checkmate, stalemate, insufficient material, threefold repetition and the fifty-move rule are detected automatically. Pawns promote to your selected piece. AI uses a bounded one- or two-ply search; it is a practice opponent, not a tournament engine. These games have no timer.</p></details></section>
  </div>;
}
