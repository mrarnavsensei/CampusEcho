import { env } from "cloudflare:workers";

export async function GET() {
  try {
    if (!env.DB) throw new Error("missing database");
    await env.DB.prepare("SELECT 1 FROM users LIMIT 1").all();
    await env.DB.prepare("SELECT 1 FROM chess_games LIMIT 1").all();
    return Response.json({ status: "ok", service: "campuscrate-echo", database: "reachable", timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", service: "campuscrate-echo" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
