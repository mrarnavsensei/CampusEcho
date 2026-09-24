import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { base, cleanupFixture, createFixture, db, request, sqlValue } from "./integration-helpers.mjs";

// Deliberately restricted to a local preview: these disposable fixtures never run in production.
const target = new URL(base);
if (!["localhost", "127.0.0.1"].includes(target.hostname)) throw new Error("Chess integration fixtures require a localhost TEST_BASE_URL.");

let fixture;
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function expectStatus(response, expected, message) {
  assert.equal(response.status, expected, `${message}: ${response.error?.message ?? JSON.stringify(response.payload)}`); checks++;
  return response.data;
}
const post = (path, student, body) => request(path, { token: student.token, method: "POST", body });
try {
  fixture = createFixture("qa_chess");
  const [white, contenderA, contenderB, outsider] = fixture.students;
  expectStatus(await request("/api/chess"), 401, "Unauthenticated chess is rejected");
  const crossOrigin = await fetch(`${base}/api/chess`, { method: "POST", headers: { Cookie: `echo_session=${white.token}`, Origin: "https://cross-origin.invalid", "Content-Type": "application/json" }, body: JSON.stringify({ mode: "multiplayer" }) });
  check(crossOrigin.status === 403, "Cross-origin room creation is rejected by the framework or route");
  expectStatus(await post("/api/chess", white, { mode: "multiplayer", result: "1-0" }), 422, "Client cannot choose game result");
  const room = expectStatus(await post("/api/chess", white, { mode: "multiplayer" }), 201, "Create campus room");
  expectStatus(await post(`/api/chess/${room.id}`, outsider, { action: "join", version: 0 }), 404, "Other-campus join is rejected");
  const joinResults = await Promise.all([contenderA, contenderB].map(student => post(`/api/chess/${room.id}`, student, { action: "join", version: 0 })));
  check(joinResults.filter(r => r.status === 200).length === 1, "Exactly one concurrent join wins");
  check(joinResults.filter(r => [404, 409].includes(r.status)).length === 1, "Losing join fails without overwriting opponent");
  const black = joinResults[0].status === 200 ? contenderA : contenderB;
  const nonparticipant = black.id === contenderA.id ? contenderB : contenderA;
  expectStatus(await request(`/api/chess/${room.id}`, { token: nonparticipant.token }), 404, "Nonparticipant cannot inspect active game");
  let state = expectStatus(await request(`/api/chess/${room.id}`, { token: white.token }), 200, "Host reconnects to persisted state");
  check(state.version === 1 && state.yourColor === "w" && state.status === "active", "Joined state persisted");
  expectStatus(await post(`/api/chess/${room.id}`, black, { action: "move", version: state.version, from: "e7", to: "e5" }), 409, "Out-of-turn move rejected");
  expectStatus(await post(`/api/chess/${room.id}`, white, { action: "move", version: state.version, from: "e2", to: "e5" }), 422, "Illegal move rejected");
  const unchanged = expectStatus(await request(`/api/chess/${room.id}`, { token: white.token }), 200, "Read after illegal moves");
  check(unchanged.fen === state.fen && unchanged.version === state.version, "Rejected moves leave state unchanged");
  const initialVersion = state.version;
  const moves = [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"], ["d2", "d3"], ["f8", "c5"]];
  for (let i = 0; i < moves.length; i++) {
    state = expectStatus(await post(`/api/chess/${room.id}`, i % 2 === 0 ? white : black, { action: "move", version: state.version, from: moves[i][0], to: moves[i][1] }), 200, `Legal move ${i + 1} saved`);
  }
  check(state.moves.length === 8 && state.version === initialVersion + 8, "History and version reflect exactly eight legal moves");
  expectStatus(await post(`/api/chess/${room.id}`, white, { action: "move", version: initialVersion, from: "e2", to: "e4" }), 409, "Stale replay rejected");
  const reconnect = expectStatus(await request(`/api/chess/${room.id}`, { token: black.token }), 200, "Opponent reconnects");
  check(reconnect.fen === state.fen && reconnect.moves.length === 8, "Both sessions see identical persisted game");
  state = expectStatus(await post(`/api/chess/${room.id}`, white, { action: "resign", version: state.version }), 200, "Resignation completes game");
  check(state.status === "completed" && state.result === "0-1", "Server assigns correct winner");
  expectStatus(await post(`/api/chess/${room.id}`, black, { action: "resign", version: state.version }), 409, "Completed result cannot be overwritten");
  const adminRows = db(`SELECT result,status FROM chess_matches WHERE id=${sqlValue(room.id)}`);
  const mirror = adminRows.flatMap(result => result.results ?? [])[0];
  check(mirror?.result === "0-1" && mirror?.status === "completed", "Existing admin metadata receives final result");
  const standings = expectStatus(await request("/api/chess/leaderboard?period=weekly&scope=campus", { token: white.token }), 200, "Read real campus standings");
  check(standings.find(row => row.id === black.id)?.points === 2 && standings.find(row => row.id === white.id)?.losses === 1, "Only computed game results feed standings");
  const ai = expectStatus(await post("/api/chess", white, { mode: "ai", difficulty: "beginner" }), 201, "Create practice game");
  const aiState = expectStatus(await post(`/api/chess/${ai.id}`, white, { action: "move", version: ai.version, from: "e2", to: "e4" }), 200, "AI makes a legal server reply");
  check(aiState.moves.length === 2 && aiState.turn === "w", "Human and AI moves are persisted together");
  const drawRoom = expectStatus(await post("/api/chess", white, { mode: "multiplayer" }), 201, "Create draw test game");
  let drawState = expectStatus(await post(`/api/chess/${drawRoom.id}`, black, { action: "join", version: drawRoom.version }), 200, "Join draw test game");
  drawState = expectStatus(await post(`/api/chess/${drawRoom.id}`, white, { action: "offer_draw", version: drawState.version }), 200, "Offer draw");
  expectStatus(await post(`/api/chess/${drawRoom.id}`, white, { action: "accept_draw", version: drawState.version }), 409, "Cannot accept own draw");
  drawState = expectStatus(await post(`/api/chess/${drawRoom.id}`, black, { action: "accept_draw", version: drawState.version }), 200, "Opponent accepts draw");
  check(drawState.result === "1/2-1/2" && drawState.status === "completed", "Draw result persisted");
  db(`UPDATE users SET status='suspended' WHERE id=${sqlValue(white.id)}`);
  expectStatus(await post(`/api/chess/${ai.id}`, white, { action: "resign", version: aiState.version }), 403, "Suspended student cannot mutate chess");
  console.log(`Chess integration: ${checks} assertions passed against ${base}.`);
} finally {
  if (fixture) {
    const userIds = fixture.students.map(student => sqlValue(student.id)).join(",");
    const rateKeys = fixture.students.flatMap(student => ["chess:create:", "chess:action:"].map(prefix => sqlValue(createHash("sha256").update(prefix + student.id).digest("hex"))));
    db(`DELETE FROM chess_matches WHERE white_user_id IN (${userIds}) OR black_user_id IN (${userIds});
      DELETE FROM chess_games WHERE white_user_id IN (${userIds}) OR black_user_id IN (${userIds});
      DELETE FROM security_rate_limits WHERE key IN (${rateKeys.join(",")});`);
    cleanupFixture(fixture);
    console.log("Removed temporary chess fixtures and their session/rate-limit records.");
  }
}
