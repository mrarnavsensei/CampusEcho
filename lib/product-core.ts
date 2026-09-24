export type ModerationResult = { allowed: boolean; status: "approved" | "rejected" | "review"; categories: string[]; reason: string };
const threats = /\b(kill|murder|shoot|bomb|attack)\b/i;
const personalData = /(?:\b\d{10}\b|\b\d{3}-\d{2}-\d{4}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;
const harassment = /\b(slur|worthless|go die|hate you)\b/i;
const spam = /(https?:\/\/\S+.*){3,}|(.)\2{10,}/i;

export function moderateWithRules(input: string): ModerationResult {
  const text = input.trim();
  if (!text) return { allowed: false, status: "rejected", categories: ["empty"], reason: "Content cannot be empty." };
  if (text.length > 5000) return { allowed: false, status: "rejected", categories: ["length"], reason: "Content exceeds the allowed length." };
  const categories = [threats.test(text) && "threat", personalData.test(text) && "personal_data", harassment.test(text) && "harassment", spam.test(text) && "spam"].filter(Boolean) as string[];
  if (categories.includes("threat") || categories.includes("personal_data")) return { allowed: false, status: "rejected", categories, reason: "Content may contain a threat or private personal information." };
  if (categories.length) return { allowed: false, status: "review", categories, reason: "Content needs review before it can be published." };
  return { allowed: true, status: "approved", categories: [], reason: "Passed rule-based safety checks." };
}

export function calculateElo(ratingA: number, ratingB: number, scoreA: 0 | 0.5 | 1, k = 32) {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  return { ratingA: Math.round(ratingA + k * (scoreA - expectedA)), ratingB: Math.round(ratingB + k * ((1 - scoreA) - (1 - expectedA))) };
}

export function normalizedEmailDomain(email: string) { const parts = email.trim().toLowerCase().split("@"); return parts.length === 2 && parts[0] && parts[1]?.includes(".") ? parts[1] : null; }
export function campusAlias(userId: string, campusId: string, epoch = new Date()) { const a = ["Amber", "Brave", "Calm", "Cosmic", "Quiet", "Silver", "Violet", "Wise"]; const n = ["Falcon", "Fox", "Owl", "Panda", "Raven", "Tiger", "Turtle", "Wolf"]; let h = 2166136261; for (const c of `${userId}:${campusId}:${Math.floor(epoch.getTime() / 604800000)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h >>>= 0; return `${a[h % a.length]} ${n[Math.floor(h / a.length) % n.length]}`; }
export function parsePage(params: URLSearchParams, max = 50) { const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), max); const raw = params.get("cursor"); return { limit, cursor: raw && /^\d+$/.test(raw) ? Number(raw) : null }; }
