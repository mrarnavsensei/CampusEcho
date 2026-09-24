import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { platformSettings } from "@/db/schema";
import { ApiError } from "./api-error";
import { resolveStudent } from "./student-auth";
import { enforceSameOrigin } from "./security";
export { ApiError } from "./api-error";

export type ApiUser = { id: string; campusId: string; email: string; role: string };

export function jsonOk<T>(data: T, init?: ResponseInit) { return Response.json({ data }, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } }); }
export function jsonError(error: unknown) {
  const known = error instanceof ApiError ? error : new ApiError(500, "internal_error", "The request could not be completed.");
  // Drizzle error messages may contain bound query values, including private content.
  // Do not serialize the error/cause/stack into shared provider logs.
  const incidentId = !(error instanceof ApiError) ? crypto.randomUUID() : undefined;
  if (incidentId) console.error(JSON.stringify({ event: "api_failure", incidentId, status: 500 }));
  return Response.json({ error: { code: known.code, message: known.message, details: known.details, ...(incidentId ? { incidentId } : {}) } }, { status: known.status, headers: { "Cache-Control": "no-store", ...(incidentId ? { "X-Incident-ID": incidentId } : {}) } });
}

export async function requireApiUser(request?: Request): Promise<ApiUser> {
  if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method)) enforceSameOrigin(request);
  const user = await resolveStudent(request);
  if (!user) throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  const [maintenance] = await getDb().select().from(platformSettings).where(eq(platformSettings.key, "maintenance_mode")).limit(1);
  if (maintenance?.value === "true") throw new ApiError(503, "maintenance", "CampusCrate Echo is undergoing maintenance. Please try again later.");
  return user;
}

export async function readJson<T>(request: Request, maxBytes = 16_384): Promise<T> {
  enforceSameOrigin(request);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "json_required", "Send application/json.");
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new ApiError(413, "payload_too_large", "The request body is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "invalid_json", "Send a valid JSON request body.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > maxBytes) { await reader.cancel(); throw new ApiError(413, "payload_too_large", "The request body is too large."); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError(400, "invalid_json", "Send a valid JSON request body."); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new ApiError(422, "invalid_json_object", "Send a JSON object with the required fields.");
  return parsed as T;
}

export function requireRole(user: ApiUser, roles: string[]) { if (!roles.includes(user.role)) throw new ApiError(403, "forbidden", "You do not have access to this resource."); }
