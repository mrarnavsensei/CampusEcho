import { performance } from "node:perf_hooks";
import { readDeployment, validateDeployment } from "./deployment-config.mjs";

try {
  const [origin = "http://localhost:5173", concurrencyInput = "2", countInput = "20", stagingFile] = process.argv.slice(2);
  const target = new URL(origin), concurrency = Number(concurrencyInput), count = Number(countInput);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10 || !Number.isInteger(count) || count < 1 || count > 200) throw new Error("Use concurrency 1-10 and request count 1-200.");
  if (target.username || target.password || target.pathname !== "/" || target.search || target.hash || !["http:", "https:"].includes(target.protocol)) throw new Error("Use a clean HTTP(S) origin.");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    if (!stagingFile) throw new Error("Remote load checks require a staging configuration as the fourth argument.");
    const deployment = validateDeployment(readDeployment(stagingFile), { file: stagingFile, artifacts: false });
    if (deployment.config.vars.APP_ENV !== "staging" || deployment.origin !== target.origin) throw new Error("Only the explicitly configured staging origin can be load-tested remotely.");
  }
  let next = 0, failed = 0;
  const durations = [], started = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (next < count) {
      next++; const before = performance.now();
      try {
        const response = await fetch(new URL("/api/health", target), { redirect: "manual", signal: AbortSignal.timeout(10_000) });
        if (response.status !== 200 || (await response.json()).database !== "reachable") failed++;
      } catch { failed++; }
      durations.push(performance.now() - before);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }));
  durations.sort((a, b) => a - b);
  console.log(JSON.stringify({ requests: count, concurrency, failed, elapsedMs: Math.round(performance.now() - started), p50Ms: Math.round(durations[Math.ceil(count * .5) - 1]), p95Ms: Math.round(durations[Math.ceil(count * .95) - 1]), scope: "Anonymous health endpoint only; not application capacity certification." }, null, 2));
  if (failed) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
