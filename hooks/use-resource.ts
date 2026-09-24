"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";

export function useResource<T>(url: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; url?: string; data?: T; error?: unknown }>({ key: "" });
  const key = `${url ?? ""}:${version}`;
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    api<T>(url, { signal: controller.signal }).then(data => setResult({ key, url, data })).catch(error => {
      if (!controller.signal.aborted) setResult({ key, url, error });
    });
    return () => controller.abort();
  }, [url, key]);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  return { data: result.url === url ? result.data : undefined, error: result.url === url ? result.error : undefined, loading: !!url && result.url !== url, refreshing: result.key !== key, refresh };
}
