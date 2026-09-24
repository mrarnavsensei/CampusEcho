export async function adminRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const payload = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || payload.error) throw new Error(payload.error?.message || "The request could not be completed. Please try again.");
  return payload.data as T;
}

export type AdminPage<T> = { items: T[]; page: number; pageSize: number; total: number; hasMore: boolean };
