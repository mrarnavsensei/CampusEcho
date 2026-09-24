// Vinext reads the request CSP nonce and applies it to hydration/RSC script tags.
export function proxy(request: Request) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const localDevelopment = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
  const policy = [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src 'self'${localDevelopment ? " ws: wss:" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}'${localDevelopment ? " 'unsafe-eval'" : ""}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  // Use the standard middleware protocol without importing the complete next/server
  // compatibility module during the development Worker's export discovery.
  const responseHeaders = new Headers({
    "x-middleware-next": "1",
    "Content-Security-Policy": policy,
    "Cache-Control": "private, no-store",
  });
  const overrides: string[] = [];
  requestHeaders.forEach((value, name) => {
    overrides.push(name);
    responseHeaders.set(`x-middleware-request-${name}`, value);
  });
  responseHeaders.set("x-middleware-override-headers", overrides.join(","));
  return new Response(null, { headers: responseHeaders });
}

export const config = {
  matcher: ["/((?!api|assets|_next|@|favicon|manifest|sw\\.js|offline\\.html).*)"],
};
