# tamuko sign-in gateway (free, self-hosted)

A tiny open-source server (MIT, one file, Node 18+) that lets people sign in to tamuko with:

| Method | Cost | How |
|---|---|---|
| **SMS code** | Free — uses your own phone plan | A spare Android phone running **SMS Gateway for Android** (open source, Apache-2.0) sends the codes |
| **WhatsApp code** | Free — **unofficial** | **Baileys** (MIT) links one WhatsApp number like WhatsApp Web |
| **Sign in with LINE** | Free, official | LINE Login; the channel secret stays on this server |
| **Sign in with Google** | Free, official | Runs in the app — no server needed (see the main README) |

> **WhatsApp warning.** Sending codes through Baileys is not an official WhatsApp API and breaks WhatsApp's terms of service. The linked number can be restricted or banned at any time. Use a separate number you can afford to lose, keep volumes low, and leave SMS on as the fallback. The only fully supported route is Meta's WhatsApp Cloud API, which charges per authentication message.
>
> **Viber** no longer offers free messaging for businesses, so it is not included.

## 1. Run it

```bash
cd server
cp .env.example .env      # then fill it in
npm install
npm start                 # listens on PORT (default 8787)
```

Free places to run it: an always-on home computer or Raspberry Pi with a free **Cloudflare Tunnel** for HTTPS, or the Oracle Cloud "Always Free" VM. The app must reach it over **HTTPS** in production.

Put the public URL in the app's `.env` as `EXPO_PUBLIC_OTP_GATEWAY_URL=https://your-gateway.example.com` and rebuild the app.

## 2. SMS from your Android phone

1. Install **SMS Gateway for Android** (github.com/capcom6/android-sms-gateway, also on Google Play) on a spare Android phone with a SIM.
2. Either turn on **Local server** (same Wi-Fi as the gateway) and set `SMS_GATEWAY_URL=http://<phone-ip>:8080`, or use its free **Cloud server** relay and set `SMS_GATEWAY_URL=https://api.sms-gate.app/3rdparty/v1`.
3. Copy the username and password the app shows into `SMS_GATEWAY_USER` / `SMS_GATEWAY_PASS`.
4. Keep the phone charging and the app allowed to run in the background.

## 3. WhatsApp (optional, unofficial)

1. Set `WHATSAPP_ENABLED=1` and restart.
2. A QR code appears in the terminal. On the phone with the WhatsApp number that will send codes: **WhatsApp → Settings → Linked devices → Link a device**, then scan it.
3. The login is saved in `server/wa-auth/` (never commit it). The app shows a **SMS | WhatsApp** choice only while WhatsApp is connected.

## 4. Sign in with LINE (optional)

1. developers.line.biz → **Create a provider** → **Create a LINE Login channel** (free).
2. Callback URL: `tamuko://line` for the iPhone/Android app (and your web address + `/line` for web).
3. Put the **Channel ID** in the app's `.env` as `EXPO_PUBLIC_LINE_CHANNEL_ID`, and both the ID and the **Channel secret** in `server/.env`.

## Security

- Codes: `crypto.randomInt`, stored only as salted SHA-256 hashes in memory, 5-minute expiry, single use, 5 attempts, 3 sends per number per 15 minutes, 20 per IP per hour, 10 wrong codes lock a number for an hour.
- Successful sign-ins return an HMAC-signed receipt (`SESSION_SECRET`) for when you add cloud sync.
- Nothing is written to disk except the WhatsApp login folder. Logs show masked numbers only.
