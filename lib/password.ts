// Portable Web Crypto helpers. Compatible with existing administrator hashes.
const encoder = new TextEncoder();
export function hex(buffer: ArrayBuffer | Uint8Array): string {
  return Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");
}
export function generateToken(): string { return hex(crypto.getRandomValues(new Uint8Array(32))); }
export async function hashToken(value: string): Promise<string> { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(plain), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" }, key, 256);
  return `pbkdf2:sha256:600000:${hex(salt)}:${hex(result)}`;
}
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const match = /^pbkdf2:sha256:(600000):([a-f0-9]{32}):([a-f0-9]{64})$/.exec(stored);
  if (!match || plain.length > 256) return false;
  const salt = Uint8Array.from(match[2].match(/../g)!, value => parseInt(value, 16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(plain), "PBKDF2", false, ["deriveBits"]);
  const actual = hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(match[1]), hash: "SHA-256" }, key, 256));
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ match[3].charCodeAt(i);
  return mismatch === 0;
}
