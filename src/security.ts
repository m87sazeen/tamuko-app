// Security primitives used across the app.
// - CSPRNG ids and OTP codes (never Math.random)
// - Secrets stored only as salted hashes (OTP codes, device PIN)
// - Constant-time comparison, attempt limits, expiry, resend cooldown, per-identity rate limits
import * as Crypto from 'expo-crypto';

export const newId = () => Crypto.randomUUID();

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const randomSalt = (n = 16) => hex(Crypto.getRandomBytes(n));

export const sha256 = (s: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);

/** Iterated salted SHA-256 key stretching for short secrets (PIN). Server-side production should use Argon2id. */
export async function stretch(secret: string, salt: string, rounds = 2000): Promise<string> {
  let h = await sha256(`${salt}:${secret}`);
  for (let i = 1; i < rounds; i++) h = await sha256(`${salt}:${h}`);
  return h;
}

/** Constant-time string comparison (avoids timing side channels on equal-length hashes). */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Unbiased 6-digit numeric code from the CSPRNG (rejection sampling). */
export function otpCode(digits = 6): string {
  const max = 10 ** digits;
  const limit = Math.floor(0xffffffff / max) * max;
  for (;;) {
    const b = Crypto.getRandomBytes(4);
    const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (n < limit) return String(n % max).padStart(digits, '0');
  }
}

/** E.164: + then 8–15 digits, no leading zero in country code. */
export const isE164 = (p: string) => /^\+[1-9]\d{7,14}$/.test(p);

export function normalizePhone(dial: string, local: string): string {
  const digits = local.replace(/[^\d]/g, '').replace(/^0+/, '');
  if (local.trim().startsWith('+')) return '+' + local.replace(/[^\d]/g, '');
  return dial + digits;
}

export const maskPhone = (p: string) => (p.length > 6 ? p.slice(0, 4) + ' •••• ' + p.slice(-3) : p);

export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/** Sliding-window rate limiter kept in memory (per identity). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}
  check(key: string): { ok: boolean; retryInMs: number } {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, list);
    if (list.length >= this.max) return { ok: false, retryInMs: this.windowMs - (now - list[0]) };
    list.push(now);
    return { ok: true, retryInMs: 0 };
  }
}

/** Minimal input sanitiser for free text that ends up in receipts/HTML. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const clampText = (s: string, max = 80) => s.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max);
