import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { platformSettings } from "@/db/schema";
import { ApiError } from "./api-error";
import { hashToken } from "./password";

export function enforceSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new ApiError(403, "invalid_origin", "This action must be performed from CampusCrate Echo.");
  }
  // Browsers send Origin on fetch mutations. Headerless scripts may use cookie credentials;
  // SameSite=Strict and JSON-only bodies still prohibit cross-site browser forms.
  if (!origin && site && site !== "same-origin" && site !== "none") {
    throw new ApiError(403, "invalid_origin", "This action must be performed from CampusCrate Echo.");
  }
}

export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "Please try again shortly.");
  const now = Date.now();
  const digest = await hashToken(key);
  const row = await env.DB.prepare(`INSERT INTO security_rate_limits (key, attempts, resets_at)
    VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET
    attempts = CASE WHEN resets_at <= ? THEN 1 ELSE attempts + 1 END,
    resets_at = CASE WHEN resets_at <= ? THEN excluded.resets_at ELSE resets_at END
    RETURNING attempts`).bind(digest, now + windowMs, now, now).first<{ attempts: number }>();
  if (!row || row.attempts > limit) throw new ApiError(429, "rate_limited", "Too many attempts. Please try again later.");
  // Bounded, probabilistic cleanup; authorization does not depend on isolate-local memory.
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 3) {
    await env.DB.prepare("DELETE FROM security_rate_limits WHERE key IN (SELECT key FROM security_rate_limits WHERE resets_at < ? LIMIT 100)").bind(now).run();
  }
}

export async function requireFeature(key: string): Promise<void> {
  const [setting] = await getDb().select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  if (setting?.value === "false") throw new ApiError(403, "feature_disabled", "This feature is currently disabled by your campus administrator.");
}
export function requestAddress(request: Request): string {
  // CF strips/replaces this header at production ingress. Do not trust forwarded-for.
  return request.headers.get("cf-connecting-ip") ?? "local";
}
