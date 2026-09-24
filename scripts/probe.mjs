// A single bounded, anonymous probe; suitable for an external scheduler.
export async function probe(origin, { fetcher = fetch, timeout = 15_000 } = {}) {
  const target = new URL(origin);
  if (target.username || target.password || target.pathname !== "/" || target.search || target.hash || !["http:", "https:"].includes(target.protocol)) throw new Error("Probe requires an HTTP(S) origin without credentials or a path.");
  const health = await fetcher(new URL("/api/health", target), { redirect: "manual", signal: AbortSignal.timeout(timeout) });
  if (health.status !== 200 || (await health.json()).database !== "reachable") throw new Error("Health probe failed.");
  const page = await fetcher(target, { redirect: "manual", signal: AbortSignal.timeout(timeout) });
  if (page.status !== 200 || !page.headers.get("content-type")?.includes("text/html")) throw new Error("Page probe failed.");
  await page.body?.cancel();
  if (target.protocol === "https:" && !page.headers.get("strict-transport-security")) throw new Error("HTTPS response has no HSTS header.");
  if (!page.headers.get("content-security-policy") || page.headers.get("x-content-type-options") !== "nosniff") throw new Error("Page security headers missing.");
  return { status: "ok", checkedAt: new Date().toISOString() };
}
