# tamuko. — Phase 1 MVP

*Big business power. Made simple.*

One codebase for **iPhone, iPad, Android and web**, built with Expo SDK 58 (React Native + react-native-web, TypeScript).
It implements Phase 1 (phone-first MVP) of `Tamuko_Business_OS_Master_Product_Blueprint.md`. The colours come from the Tamuko design system.

## Run it

Always run commands from the **tamuko-app** folder (not Downloads):

```bash
cd ~/Downloads/tamuko-app
npm install
cp .env.example .env        # optional: SMS / Google settings
npx expo start              # press w = web, i = iOS simulator, a = Android emulator
```

## Native builds (iPhone / iPad / Android)

The app uses a **development build** (`expo-dev-client`) because Google sign-in and some modules need native code. `ios/` and `android/` are generated from `app.json` (Continuous Native Generation), so never edit them by hand. They are git-ignored.

**iOS simulator (local, this Mac):** needs Xcode and CocoaPods (`brew install cocoapods`).

```bash
npx expo run:ios                       # builds, installs and opens on a simulator
npx expo run:ios --device "iPad mini (A20 Pro)"
```

**Real iPhone/iPad:** connect the device, then `npx expo run:ios --device`. You need an Apple ID set as the signing team in Xcode. TestFlight/App Store needs an Apple Developer account ($99/yr).

**Android (local):** needs JDK 17 and the Android SDK/emulator (install Android Studio). Then:

```bash
npx expo run:android
```

**Cloud builds (no local SDKs needed):** EAS Build, free tier available, needs an Expo account.

| Profile | Use |
|---|---|
| `development` | Dev client. iOS simulator build + Android APK, dev SMS provider |
| `preview` | Installable test build for testers (APK / ad-hoc iOS), Textbelt SMS |
| `production` | Store builds (AAB / App Store), auto-increments build numbers |

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform all
```

Icons and splash screens are in `assets/` (the "t." mark). Splash uses cream in light mode and charcoal in dark mode.

## Business types

31 types from the website in 4 groups — Food & drink (street stall, food truck, kiosk, café, juice bar, bakery, restaurant, cloud kitchen, catering), Shops (grocery, fruit & veg, fashion, electronics, beauty, jewellery, pharmacy, hardware, books), Services (laundry, salon, repair, tailoring, car wash, garage, pet grooming, printing, cleaning) and Fitness & activities (gym, studio, tutoring, kids play) — plus local names per country (kirana store, sari-sari store, warung …). Each type sets its workflow steps, starter price list (scaled to the local currency) and tools (`src/catalogue.ts`). Owners switch tools on or off in Manage → Business type & tools.

## Release

See `store/STORE_LISTING.md` for the listing text, privacy answers, review notes and checklist. Store builds ship with **"This device"** sign-in (no account) and Gmail when Google client IDs are set; mobile-number sign-in is off until a paid SMS provider is configured.

## What's in the MVP

| Area | What it does |
|---|---|
| Sign-up / sign-in | Mobile number + 6-digit SMS OTP, or Google (Gmail) via OAuth 2.0 PKCE |
| Onboarding | Business name → country (sets currency, VAT/GST and language automatically) → business type → first items |
| Sell (POS) | Text-first item grid, cart, discount, cash with change calculator, payment by QR with manual confirmation |
| Workflows | Business types (street stall, café, restaurant, shop, laundry/services) start with a fitting workflow. Take away and/or dine in; with no tables everything is take away. Preset flows such as *Pay first* (Order → Paid → Preparing → Ready → Collected), *Pay on pickup* and *Pay at the end* (Order → Preparing → Served → Paid → Closed), or a custom flow: rename, add, remove and reorder steps and move the payment step |
| Order rail | Lanes follow the workflows in use; tickets show mode, table and paid / not paid yet; the payment step opens checkout; a table pays one bill for all its orders; daily tokens, late warnings, reduced motion |
| Manage | Daily routine (open day → take orders → prepare → get paid → close day → review), set-up checklist, workflow and tables editor, day open/close with cash count and difference, items with stock tracking, low-stock warnings and restock |
| Receipts | 58 mm layout with logo, tax line, tax registration number and optional USD amount; print, PDF or share |
| Reports | **Simple** (plain words, for first-time owners) · **Standard** (payment mix, best sellers, busy hours, expense types) · **Advanced** (date ranges, tax/net breakdown, daily table, speed of service, staff, voids, CSV export, audit log) |
| Expenses | Quick add by category; used in the "You kept" / profit figures |
| Options (modifiers) | Size, sugar, add-ons per item: "pick one" or "pick any", with extra prices. Typed as "Small, Large +2, Extra shot +1.5" |
| Split bills & payment links | Split equally or across cash / QR / link parts; send your own bank or gateway payment link with the amount (still confirmed by staff) |
| Rewards | Stamp card ("After 10 Karak chai, 1 free, valid 30 days"), customers by name or phone, reward redeemed at the till, member pass with QR shared by WhatsApp |
| Stock & costing | Ingredients with unit cost and stock, recipes per item deduct as you sell, low-stock warnings, restock, cost and margin per item |
| Finance | Ingredients used, expenses and real profit; margin per item; daily cash close with difference |
| Pickup screen | Customer-facing board of Preparing / Ready tokens for a second tablet or screen |
| Printers | Bluetooth (BLE) and Wi-Fi/LAN (port 9100) 58 / 80 mm ESC/POS receipt printers, plus AirPrint / Android print / browser. Auto-print receipts and kitchen tickets, cash drawer kick, test print, reprint last receipt |
| Regions | 33 countries from the Gulf to Japan/Korea, each with currency, default tax rate, inclusive/exclusive tax mode and dial code |
| Languages | 23 UI languages: Arabic, Persian, Urdu (all right-to-left), Turkish, Russian, Hindi, Bengali, Tamil, Sinhala, Nepali, Thai, Vietnamese, Indonesian, Malay, Filipino, Khmer, Lao, Burmese, Chinese (Simplified and Traditional), Japanese, Korean and English |
| Tourist USD | Optional USD amount on checkout and receipts; enter the rate yourself or fetch it from open.er-api.com (free, no key) |
| Branding | Business name, logo, receipt footer, and a payment QR (upload the bank/wallet QR image or paste its text) |
| Messaging | WhatsApp, LINE, Telegram, Viber, SMS and Email open with a pre-filled receipt or "order ready" message. Messenger, Zalo, KakaoTalk and WeChat have setup slots, but auto-sending through their business APIs needs the cloud backend (Phase 2) |
| Backup | Export/restore a JSON backup (the file is checked before restoring); reminder when no recent backup |

## Brand

Built strictly to **tamuko. brand guidelines v1.0** (`src/brand/`):

- **Logo**: rail-monogram symbol + wordmark (`Logo.tsx`) reproduced from the supplied artwork, in the six colour versions. Thermal receipts use the one-colour black version. The wordmark uses **Fredoka 700 as the stand-in for Molen Friend**. Buy the Molen Friend commercial licence and outline the wordmark before final artwork.
- **Type (matched to the tamuko.app website)**: Bricolage Grotesque 800 headings with tight tracking, Instrument Serif italic for highlight words ("Made simple."), Inter 400/500/600 for the interface, JetBrains Mono for tickets, figures and uppercase kickers. Each non-Latin script gets its Noto font (Vazirmatn for Persian), loaded only when that language is chosen. CJK uses the platform font.
- **Components (matched to the website)**: pill buttons with a peach glow on the main action, raised cards with 24 px corners and soft shadows, 14 px inputs that lift on focus, pill segmented controls and chips, tinted status tags, peach check ticks.
- **Colour**: brand tokens in `theme.ts`. Peach is reserved for the next action, with charcoal text on it (never white). Status colours never change with a theme. All text pairs pass 4.5:1.
- **Icons**: [Solar Icons Set](https://www.figma.com/community/file/1166831539721848736/solar-icons-set) by 480 Design (Linear style, CC BY 4.0), generated into `src/brand/solar.ts` by `node scripts/gen-icons.cjs`. No emoji.
- **Materials**: paper tickets and receipts with a torn edge, brushed metal for the Flow rail only, and glass for the tab bar and sheets.
- **Voice**: plain and honest about money ("Check the amount has arrived in your bank app", "Printer not found. The sale is saved.", "Business surplus (estimate)").
- **App icon**: peach tile with charcoal strokes. **Splash**: the symbol on cream (light mode) or charcoal (dark mode).

## Printers

Manage → **Printers**:

- **Bluetooth**: tap *Find printers*, pick yours, choose 58 or 80 mm. Works with BLE receipt printers on iPhone, iPad and Android. Classic-Bluetooth-only printers: use Wi-Fi, or the print dialog.
- **Wi-Fi / LAN**: enter the printer's IP (from its self-test page); port 9100.
- **Print dialog**: AirPrint, Android printing or the browser — the only option on web, and the best for non-Latin scripts (ESC/POS printers print Latin letters).
- Each printer can print receipts and/or kitchen tickets, automatically or on demand, and can open a cash drawer.

Bluetooth and Wi-Fi printing need the installed app (a development or release build), not Expo Go or the web.

## Sign-in — all free

- **This device** — no account; always available.
- **SMS or WhatsApp code** — through the self-hosted gateway in `server/` (SMS from your own Android phone; WhatsApp is unofficial and can get the number banned). Set `EXPO_PUBLIC_OTP_GATEWAY_URL`. See `server/README.md`.
- **Google** — free OAuth client IDs (below).
- **LINE** — free LINE Login channel; secret kept on the gateway (`EXPO_PUBLIC_LINE_CHANNEL_ID`).
- Viber has no free business messaging, so it isn't offered.

## Google sign-in

1. In Google Cloud Console → Credentials, create OAuth client IDs (free) for Web, iOS (`com.tamuko.app`) and Android (`com.tamuko.app` + your SHA-1).
2. Put them in `.env` as `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`. Only public client IDs go in the app, never a client secret.
3. Native Google sign-in needs a development build (`npx expo run:ios` / `run:android`), not Expo Go.

## Security measures

- OTP codes come from a secure random generator (rejection sampling, so every code is equally likely), are stored only as salted SHA-256 hashes in memory, expire after 5 minutes, work once, allow 5 attempts, have a 30-second resend cooldown, and are limited to 3 sends per 15 minutes per number. 10 failures in an hour lock that number for an hour. Codes are compared in constant time.
- Device PIN: stored as a salted hash with 2,000 SHA-256 rounds. After 5 wrong PINs, waits grow (30 s up to 15 min). The app locks itself after 1/5/15 minutes in the background. Trivial PINs are rejected.
- Once a device has an owner, an unknown phone number or Gmail account cannot sign in and read the data.
- Owner-only actions: void, restore, changing country, removing the PIN.
- Money is stored as integer minor units, and tax is calculated with integer maths. Each sale keeps a fixed copy of its items, prices, tax and USD rate.
- Checkout is idempotent: double taps and retries never create duplicate sales.
- An append-only audit log records sign-ins, sales, voids, ticket moves, setting changes and backups.
- Showing a QR is never treated as proof of payment. QR sales are labelled "verified by operator", not "provider confirmed".
- Text is escaped before going into receipt HTML, CSV exports are protected against formula injection, input lengths are capped, and the logo is checked to be a real data URI.
- Phone numbers are masked in the interface. No secrets are kept in client code.

## Known limits / next steps (Phase 2)

- Staff logins, multi-device sync, branches, suppliers, QR ordering at the table, bookings and online order tracking need the cloud backend; they show as "Soon" in Manage.
- Data is local-only (AsyncStorage). Next: an encrypted SQLite store, cloud sync, multi-device use and staff invitations.
- Translations cover the most visible UI strings; everything else falls back to English. **Native speakers must review all of it**, especially payment and tax wording.
- Tax rates are 2026 defaults, editable per business. They are not tax advice. Pushing updated rates remotely (`COUNTRY_PACK_VERSION`) needs the cloud backend.
- Printing uses the system print dialog (AirPrint / Android print service / browser). Direct Bluetooth ESC/POS printing for 58 mm printers needs a native module in a development build.
- Navigation is a custom tab shell. It can move to Expo Router once deep-link routes (such as hosted ordering) are needed.

## Finance & accounting

- **Reports → Overview**: a plain-language story of your money (Fact / Estimate / Pending labels, evidence on tap), where the money is (cash, bank, waiting to settle, tax owed) and this month's profit and EBITDA.
- **Open accounting** (owners): double-entry journal, general ledger, profit & loss, balance sheet, cash flow, trial balance, guided entries (owner money in/out, loans, equipment, depreciation, bank deposits, QR settlement, supplier bills, tax payments), custom journals, draft → post → reverse, and period locks.
- Sales, voids, expenses and day-close differences post automatically. QR/link payments sit in *waiting to settle* until you record them arriving in the bank.
- Tests: `npm run test:accounting`. Gap analysis vs the TNDL spec: [docs/TNDL-GAP-ANALYSIS.md](docs/TNDL-GAP-ANALYSIS.md).
