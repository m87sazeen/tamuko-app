# tamuko — store listing & release checklist (v1.0.0)

## Listing

- **App name:** tamuko — POS & Business
- **Subtitle (iOS, 30):** Sell, track orders, get paid
- **Short description (Play, 80):** Point of sale, order rail and profit for any small business — on one phone.
- **Category:** Business (secondary: Finance)
- **Age rating:** 4+ / Everyone (no user content, no ads)
- **Price:** Free

### Description

Big business power. Made simple.

tamuko runs your shop, stall, café, laundry, salon or gym from the phone in your pocket — no special hardware, no internet needed.

- **Sell in seconds** — tap items, add options like size or sugar, take cash or your bank QR, split the bill, print or share the receipt.
- **Every order on a rail** — tokens and tickets move from Received to Ready to Collected. Pay first or pay later, take away or dine in, or your own steps.
- **Built for your kind of business** — 31 business types, from street stalls and kirana stores to laundries, garages, salons and studios, each with the right tools switched on.
- **Know your profit** — daily close, expenses, ingredient costs and margin per item, in plain words or full detail.
- **Customers come back** — "buy 10, get 1 free" stamp cards and member passes by WhatsApp.
- **Stock and bookings** — low-stock alerts, recipes that deduct ingredients, appointments and walk-in queues.
- **Your printer** — Bluetooth and Wi-Fi receipt printers, kitchen tickets and cash drawers.
- **Your country** — 33 countries with currency and VAT/GST set for you, 23 languages including Arabic, Urdu, Hindi, Thai and Chinese.
- **Private by design** — your data stays on your device. Lock it with a PIN and export backups any time.

### Keywords (iOS, 100)

pos,point of sale,cash register,receipt,inventory,restaurant,cafe,shop,laundry,salon,vat,gst,qr

### Screenshots to capture (6.9" iPhone, 13" iPad, Android phone + 10" tablet)

1. Till with items and the cart (café, AED)
2. Order rail with tickets on the metal rail
3. Pickup screen (tablet, landscape)
4. Reports — Simple view ("You kept about …")
5. Onboarding — "What do you run?" business types
6. Receipt on paper + printer setup
7. Rewards — stamp card and member pass
8. Arabic (RTL) till

## App privacy (App Store "nutrition label" / Play Data safety)

- **Data collected by the developer:** none. All business data is stored on the device.
- **Data shared with third parties:** none by the app. Optional: SMS provider receives the phone number for sign-in codes (only if configured); Google sign-in returns name + email to the device; exchange-rate lookups contact open.er-api.com without personal data.
- **Tracking:** none. **Ads:** none.
- **Permissions:** Camera (barcode scanning), Bluetooth (receipt printers), Local network (Wi-Fi printers), Photos (logo and payment QR). Android ≤ 11 asks for location only because Bluetooth scanning requires it.
- **Account deletion:** Settings → Delete all data on this device (no server account exists).

## Review notes (App Review / Play)

- Sign in with **"This device"** — enter any name, no account or code needed.
- Choose any country and business type; sample items are filled in.
- Bluetooth/Wi-Fi printing needs a real ESC/POS printer; "Print dialog" works without one.

## Release checklist

- [ ] Replace placeholder support email (hello@tamuko.app) and publish the privacy policy and terms at a public URL (same text as Settings → Help & legal); have them reviewed for each launch country.
- [ ] Buy the Molen Friend licence (wordmark) or keep Fredoka (OFL).
- [ ] Optional sign-in methods: add Google OAuth client IDs; set up a paid SMS provider and `EXPO_PUBLIC_SMS_PROVIDER` (store builds ship with SMS sign-in off).
- [ ] Native-speaker review of translations, especially payment and tax wording.
- [ ] Test on a real Android phone and a real BLE + Wi-Fi printer.
- [ ] `npx eas-cli@latest build --profile production --platform all`, then `npx eas-cli@latest submit --platform ios|android`.
- [ ] Apple Developer Program ($99/yr) and Google Play Console ($25 once) accounts.
