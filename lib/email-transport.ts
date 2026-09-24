export type MailConfiguration = { APP_URL?: string; EMAIL_API_KEY?: string; EMAIL_FROM?: string };

export function validEmailConfiguration(config: MailConfiguration): boolean {
  try {
    const url = new URL(config.APP_URL ?? "");
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash && !!config.EMAIL_API_KEY && !!config.EMAIL_FROM;
  } catch { return false; }
}

// Never pass provider errors/bodies to callers: they may contain personal data.
export async function deliverAccountEmail(config: MailConfiguration, email: string, token: string, purpose: "verify" | "reset", fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!validEmailConfiguration(config)) return false;
  const url = new URL("/", config.APP_URL);
  url.hash = `${purpose}=${token}`;
  const subject = purpose === "verify" ? "Verify your CampusCrate Echo email" : "Reset your CampusCrate Echo password";
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.EMAIL_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `echo-${purpose}-${token.slice(0, 32)}` },
      body: JSON.stringify({ from: config.EMAIL_FROM, to: [email], subject, text: `${subject}\n\nOpen this link within 30 minutes:\n${url.toString()}\n\nIf you did not request this, you can ignore this email.` }),
      signal: AbortSignal.timeout(10_000),
    });
    await response.body?.cancel();
    return response.ok;
  } catch { return false; }
}
