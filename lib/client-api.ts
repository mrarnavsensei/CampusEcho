export class ClientError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }, signal: options.signal ?? AbortSignal.timeout(15_000) });
  let payload: { data?: T; error?: { message?: string; code?: string } };
  try { payload = await response.json(); } catch { throw new ClientError("The server returned an unexpected response. Please try again.", response.status, "invalid_response"); }
  if (!response.ok || payload.error) throw new ClientError(payload.error?.message ?? "The request could not be completed.", response.status, payload.error?.code ?? "request_failed");
  return payload.data as T;
}
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
export function jsonBody(body: unknown): string { return JSON.stringify(body); }
