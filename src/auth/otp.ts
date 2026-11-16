// Pluggable SMS OTP providers.
//
//   dev       — FREE, no account. Generates a real one-time code locally and shows it in an
//               in-app "Dev SMS" banner. No SMS leaves the device. For local testing only.
//   textbelt  — FREE tier from textbelt.com (key "textbelt" = 1 SMS/day per IP). The code is
//               generated AND verified on Textbelt's server, so it never touches this device.
//               Buy a key for more volume; set EXPO_PUBLIC_TEXTBELT_KEY.
//
// Choose with EXPO_PUBLIC_SMS_PROVIDER=dev|textbelt (default: dev).
// Production path: move OTP to your own backend (or Firebase Auth / Supabase Auth) so verification
// issues a server-signed session — client-side checks alone are not a security boundary.
import { RateLimiter, newId, otpCode, randomSalt, safeEqual, sha256 } from '../security';

export const OTP_TTL_MS = 5 * 60_000;
export const RESEND_COOLDOWN_MS = 30_000;
const MAX_VERIFY_ATTEMPTS = 5;

const sendLimiter = new RateLimiter(3, 15 * 60_000); // 3 sends / 15 min / phone
const failLimiter = new RateLimiter(10, 60 * 60_000); // 10 failed checks / hour / phone → lockout

export type Challenge = { id: string; phone: string; expiresAt: number; resendAt: number };
export type VerifyResult = { ok: true } | { ok: false; reason: string };

export interface SmsOtpProvider {
  id: string;
  label: string;
  free: string;
  send(phone: string, appName: string): Promise<Challenge>;
  verify(challenge: Challenge, code: string): Promise<VerifyResult>;
}

// ---------- Dev inbox (only used by the dev provider) ----------
type DevMsg = { phone: string; text: string; at: number };
let devListeners: ((m: DevMsg | null) => void)[] = [];
export const onDevSms = (fn: (m: DevMsg | null) => void) => {
  devListeners.push(fn);
  return () => {
    devListeners = devListeners.filter((f) => f !== fn);
  };
};
const emitDev = (m: DevMsg | null) => devListeners.forEach((f) => f(m));

// ---------- dev provider ----------
type Stored = { hash: string; salt: string; attempts: number; expiresAt: number; used: boolean };
const pending = new Map<string, Stored>(); // memory only: never persisted to disk

const devProvider: SmsOtpProvider = {
  id: 'dev',
  label: 'Local dev SMS (no real SMS sent)',
  free: 'Free · offline',
  async send(phone, appName) {
    const code = otpCode(6);
    const salt = randomSalt();
    const id = newId();
    const expiresAt = Date.now() + OTP_TTL_MS;
    pending.set(id, { hash: await sha256(`${salt}:${phone}:${code}`), salt, attempts: 0, expiresAt, used: false });
    emitDev({ phone, text: `${code} is your ${appName} code. It expires in 5 minutes. Never share it.`, at: Date.now() });
    return { id, phone, expiresAt, resendAt: Date.now() + RESEND_COOLDOWN_MS };
  },
  async verify(ch, code) {
    const rec = pending.get(ch.id);
    if (!rec || rec.used) return { ok: false, reason: 'This code is no longer valid. Request a new one.' };
    if (Date.now() > rec.expiresAt) {
      pending.delete(ch.id);
      return { ok: false, reason: 'Code expired. Request a new one.' };
    }
    rec.attempts++;
    const ok = safeEqual(await sha256(`${rec.salt}:${ch.phone}:${code}`), rec.hash);
    if (ok) {
      rec.used = true; // single use
      pending.delete(ch.id);
      emitDev(null);
      return { ok: true };
    }
    if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
      pending.delete(ch.id);
      return { ok: false, reason: 'Too many wrong attempts. Request a new code.' };
    }
    return { ok: false, reason: `Wrong code. ${MAX_VERIFY_ATTEMPTS - rec.attempts} attempts left.` };
  },
};

// ---------- textbelt provider (server-side generate + verify) ----------
const TB_KEY = process.env.EXPO_PUBLIC_TEXTBELT_KEY || 'textbelt';
const tbAttempts = new Map<string, number>();

const textbeltProvider: SmsOtpProvider = {
  id: 'textbelt',
  label: 'Textbelt SMS',
  free: TB_KEY === 'textbelt' ? 'Free · 1 SMS/day' : 'Paid key',
  async send(phone, appName) {
    const userid = newId(); // opaque per-challenge id; Textbelt binds the OTP to it
    const body = new URLSearchParams({
      phone,
      userid,
      key: TB_KEY,
      message: `$OTP is your ${appName} code. It expires in 5 minutes. Never share it.`,
      lifetime: String(OTP_TTL_MS / 1000),
      length: '6',
    });
    const res = await fetch('https://textbelt.com/otp/generate', { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!json.success) throw new Error(json.error || 'SMS could not be sent. Try again later.');
    tbAttempts.set(userid, 0);
    return { id: userid, phone, expiresAt: Date.now() + OTP_TTL_MS, resendAt: Date.now() + RESEND_COOLDOWN_MS };
  },
  async verify(ch, code) {
    const n = (tbAttempts.get(ch.id) ?? 0) + 1;
    tbAttempts.set(ch.id, n);
    if (n > MAX_VERIFY_ATTEMPTS) return { ok: false, reason: 'Too many wrong attempts. Request a new code.' };
    const q = new URLSearchParams({ otp: code, userid: ch.id, key: TB_KEY });
    const res = await fetch(`https://textbelt.com/otp/verify?${q}`);
    const json = await res.json().catch(() => ({}));
    if (json.success && json.isValidOtp) {
      tbAttempts.delete(ch.id);
      return { ok: true };
    }
    return { ok: false, reason: 'Wrong or expired code.' };
  },
};

const PROVIDERS: Record<string, SmsOtpProvider> = { dev: devProvider, textbelt: textbeltProvider };
export const smsProvider: SmsOtpProvider = PROVIDERS[process.env.EXPO_PUBLIC_SMS_PROVIDER ?? 'dev'] ?? devProvider;

/** Rate-limited entry points used by the UI. */
export async function requestOtp(phone: string, appName = 'tamuko'): Promise<Challenge> {
  const r = sendLimiter.check(phone);
  if (!r.ok) throw new Error(`Too many codes requested. Try again in ${Math.ceil(r.retryInMs / 60000)} min.`);
  return smsProvider.send(phone, appName);
}

export async function checkOtp(ch: Challenge, code: string): Promise<VerifyResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'Enter the 6-digit code.' };
  const res = await smsProvider.verify(ch, code);
  if (!res.ok) {
    const lock = failLimiter.check(ch.phone);
    if (!lock.ok) return { ok: false, reason: 'This number is temporarily locked for safety. Try again in an hour.' };
  }
  return res;
}
