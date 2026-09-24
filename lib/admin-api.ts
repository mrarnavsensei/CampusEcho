import { ApiError } from "@/lib/api";
import { enforceSameOrigin } from "@/lib/security";

export function requireSameOrigin(request: Request) {
  enforceSameOrigin(request);
}

export function adminPagination(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("pageSize") || 25);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ApiError(400, "invalid_pagination", "Use a valid page and a page size between 1 and 100.");
  return { params, page, pageSize, offset: (page - 1) * pageSize };
}

export function adminPage<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export function parseMetadata(value: string): Record<string, unknown> {
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
}

export function startOfDay(daysAgo = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}
