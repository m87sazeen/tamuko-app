// tamuko sign-in gateway — free, open source (MIT), self-hosted. No paid services.
//
//   POST /otp/send     { phone, channel: "sms" | "whatsapp" }   → { id, expiresAt, resendAt }
//   POST /otp/verify   { id, phone, code }                       → { ok, receipt }
//   POST /line/token   { code, codeVerifier, redirectUri }       → { sub, name, email, receipt }
//   GET  /health                                                  → which channels are ready
//
// Channels:
//   sms       Your own Android phone running "SMS Gateway for Android" (Apache-2.0). Free.
//   whatsapp  Baileys (MIT) links a WhatsApp number like WhatsApp Web. Free but UNOFFICIAL:
//             it breaks WhatsApp's terms of service and the number can be banned. Opt-in only.
//   line      Official LINE Login (free). The channel secret stays here, never in the app.
//
// Security: codes come from crypto.randomInt, are stored only as salted SHA-256 hashes in memory,
// expire after 5 minutes, allow 5 attempts, and sends are rate-limited per number and per IP.
// Run behind HTTPS (e.g. Caddy or a free Cloudflare Tunnel) when it is reachable from the internet.
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---------- config ----------
loadEnv(path.join(__dirname, '.env'));
const PORT = Number(process.env.PORT || 8787);
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SMS = { url: (process.env.SMS_GATEWAY_URL || '').replace(/\/$/, ''), user: process.env.SMS_GATEWAY_USER || '', pass: process.env.SMS_GATEWAY_PASS || '' };
const WA_ON = process.env.WHATSAPP_ENABLED === '1';
const LINE = { id: process.env.LINE_CHANNEL_ID || '', secret: process.env.LINE_CHANNEL_SECRET || '' };
const APP = 'tamuko';
const TTL = 5 * 60_000;
const RESEND = 30_000;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------- helpers ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isE164 = (p) => /^\+[1-9]\d{7,14}$/.test(p);
const mask = (p) => p.slice(0, 4) + '••••' + p.slice(-3);
const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`;
};

class Limiter {
  constructor(max, windowMs) { this.max = max; this.windowMs = windowMs; this.hits = new Map(); }
  take(key) {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) return false;
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
}
const perPhone = new Limiter(3, 15 * 60_000);
const perIp = new Limiter(20, 60 * 60_000);
const failures = new Limiter(10, 60 * 60_000);
const locked = new Map(); // phone → locked until

/** Pending codes: id → { phone, salt, hash, exp, attempts }. Memory only, never written to disk. */
const pending = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of pending) if (v.exp < now) pending.delete(k); }, 60_000).unref();

// ---------- channels ----------
async function sendSms(phone, text) {
  if (!SMS.url) throw new Error('SMS is not set up on this gateway.');
  const res = await fetch(`${SMS.url}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${SMS.user}:${SMS.pass}`).toString('base64') },
    body: JSON.stringify({ message: text, phoneNumbers: [phone] }),
  });
  if (!res.ok) throw new Error(`SMS phone answered ${res.status}. Is the SMS Gateway app running?`);
}

let wa = null; // Baileys socket when connected
let waReady = false;
async function startWhatsApp() {
  const baileys = require('@whiskeysockets/baileys');
  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, DisconnectReason } = baileys;
  const qr = require('qrcode-terminal');
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'wa-auth'));
  const sock = makeWASocket({ auth: state, printQRInTerminal: false, browser: ['tamuko', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    if (u.qr) {
      console.log('\nWhatsApp: scan this QR with the phone that will send codes (WhatsApp → Linked devices):');
      qr.generate(u.qr, { small: true });
    }
    if (u.connection === 'open') { waReady = true; console.log('WhatsApp: connected.'); }
    if (u.connection === 'close') {
      waReady = false;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) console.log('WhatsApp: logged out. Delete server/wa-auth and restart to link again.');
      else setTimeout(startWhatsApp, 5000);
    }
  });
  wa = sock;
}
async function sendWhatsApp(phone, text) {
  if (!WA_ON) throw new Error('WhatsApp is not enabled on this gateway.');
  if (!wa || !waReady) throw new Error('WhatsApp is reconnecting. Try SMS or try again in a minute.');
  const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
  const [exists] = await wa.onWhatsApp(jid);
  if (!exists?.exists) throw new Error('This number is not on WhatsApp. Use SMS instead.');
  await wa.sendMessage(jid, { text });
}

// ---------- routes ----------
async function otpSend(body, ip) {
  const phone = String(body.phone || '');
  const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'sms';
  if (!isE164(phone)) return [400, { error: 'Enter a valid mobile number.' }];
  if (!perIp.take(ip) || !perPhone.take(phone)) return [429, { error: 'Too many codes requested. Try again in 15 minutes.' }];
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  const id = crypto.randomUUID();
  const now = Date.now();
  pending.set(id, { phone, salt, hash: sha(`${salt}:${phone}:${code}`), exp: now + TTL, attempts: 0 });
  const text = `${code} is your ${APP} code. It expires in 5 minutes. Never share it.`;
  try {
    if (channel === 'whatsapp') await sendWhatsApp(phone, text);
    else await sendSms(phone, text);
  } catch (e) {
    pending.delete(id);
    return [502, { error: e.message }];
  }
  console.log(`code sent by ${channel} to ${mask(phone)}`);
  return [200, { id, phone, expiresAt: now + TTL, resendAt: now + RESEND }];
}

function otpVerify(body) {
  const rec = pending.get(String(body.id || ''));
  const phone = String(body.phone || '');
  const code = String(body.code || '');
  if (!rec || rec.phone !== phone || rec.exp < Date.now()) return [400, { ok: false, reason: 'Wrong or expired code.' }];
  if ((locked.get(phone) || 0) > Date.now()) return [429, { ok: false, reason: 'This number is locked for an hour after too many wrong codes.' }];
  rec.attempts += 1;
  if (rec.attempts > 5) { pending.delete(body.id); return [400, { ok: false, reason: 'Too many wrong attempts. Request a new code.' }]; }
  if (!/^\d{6}$/.test(code) || !safeEq(sha(`${rec.salt}:${phone}:${code}`), rec.hash)) {
    if (!failures.take(phone)) locked.set(phone, Date.now() + 60 * 60_000); // 10 wrong codes in an hour → lock
    return [400, { ok: false, reason: 'Wrong or expired code.' }];
  }
  pending.delete(body.id);
  return [200, { ok: true, receipt: sign({ sub: phone, kind: 'phone', iat: Date.now() }) }];
}

async function lineToken(body) {
  if (!LINE.id || !LINE.secret) return [501, { error: 'LINE sign-in is not set up on this gateway.' }];
  const form = new URLSearchParams({ grant_type: 'authorization_code', code: String(body.code || ''), redirect_uri: String(body.redirectUri || ''), client_id: LINE.id, client_secret: LINE.secret, code_verifier: String(body.codeVerifier || '') });
  const tok = await fetch('https://api.line.me/oauth2/v2.1/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form }).then((r) => r.json());
  if (!tok.id_token) return [400, { error: 'LINE sign-in was not completed.' }];
  const v = await fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id_token: tok.id_token, client_id: LINE.id }) }).then((r) => r.json());
  if (!v.sub) return [400, { error: 'Could not verify your LINE account.' }];
  return [200, { sub: v.sub, name: v.name || '', email: v.email || '', receipt: sign({ sub: v.sub, kind: 'line', iat: Date.now() }) }];
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const ip = (req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '').toString();
  const send = ([status, json]) => res.writeHead(status).end(JSON.stringify(json));
  try {
    if (req.method === 'GET' && req.url === '/health') return send([200, { ok: true, channels: { sms: !!SMS.url, whatsapp: WA_ON && waReady, line: !!(LINE.id && LINE.secret) } }]);
    if (req.method !== 'POST') return send([404, { error: 'Not found' }]);
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 4096) return send([413, { error: 'Too large' }]);
    }
    const body = raw ? JSON.parse(raw) : {};
    if (req.url === '/otp/send') return send(await otpSend(body, ip));
    if (req.url === '/otp/verify') return send(otpVerify(body));
    if (req.url === '/line/token') return send(await lineToken(body));
    return send([404, { error: 'Not found' }]);
  } catch (e) {
    console.error(e);
    return send([500, { error: 'Something went wrong. Try again.' }]);
  }
});

server.listen(PORT, () => {
  console.log(`tamuko sign-in gateway on :${PORT} — SMS ${SMS.url ? 'on' : 'off'}, WhatsApp ${WA_ON ? 'on (unofficial)' : 'off'}, LINE ${LINE.id ? 'on' : 'off'}`);
  if (!process.env.SESSION_SECRET) console.log('Note: SESSION_SECRET is not set; receipts change on every restart.');
  if (WA_ON) startWhatsApp().catch((e) => console.error('WhatsApp failed to start:', e.message));
});
