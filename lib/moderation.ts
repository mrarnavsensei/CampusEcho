import { env } from "cloudflare:workers";
import { moderateWithRules, type ModerationResult } from "./product-core";

type ModerationEnv = { MODERATION_API_URL?: string; MODERATION_API_KEY?: string; MODERATION_MODEL?: string };

export async function moderateText(text: string): Promise<ModerationResult & { provider: string }> {
  const fallback = moderateWithRules(text);
  if (!fallback.allowed) return { ...fallback, provider: "rules" };
  const config = env as ModerationEnv;
  if (!config.MODERATION_API_URL || !config.MODERATION_API_KEY) return { ...fallback, provider: "rules" };
  try {
    const response = await fetch(config.MODERATION_API_URL, { method: "POST", headers: { Authorization: `Bearer ${config.MODERATION_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.MODERATION_MODEL || "omni-moderation-latest", input: text }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`provider status ${response.status}`);
    const payload = await response.json() as { results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }> };
    const result = payload.results?.[0];
    if (!result || typeof result.flagged !== "boolean") throw new Error("invalid provider response");
    const categories = Object.entries(result?.categories || {}).filter(([, active]) => active).map(([name]) => name);
    return result?.flagged ? { allowed: false, status: "review", categories, reason: "Automated safety review flagged this content.", provider: "ai" } : { ...fallback, provider: "ai" };
  } catch {
    console.error("Moderation provider unavailable");
    return { allowed: false, status: "review", categories: ["provider_unavailable"], reason: "Content is queued for review because automated moderation is temporarily unavailable.", provider: "fail-closed" };
  }
}
