// Privacy notice, terms of use and credits. Plain language, matching what the app actually does.
// Review with a lawyer for each launch country before publishing (store listings link to the same text).
import React, { useState } from 'react';
import { Kicker, Segmented, Sheet, Txt } from '../components/ui';

const PRIVACY: [string, string][] = [
  ['What tamuko stores', 'Your business details, items, sales, orders, customers you add, bookings, expenses and settings. They are stored on this phone, tablet or browser only. tamuko has no server that receives your business data in this version.'],
  ['Customers’ details', 'If you add a customer’s name or phone number for rewards, bookings or ready messages, you are responsible for having their permission. Remove a customer’s details on request.'],
  ['Sign-in', 'If you sign in with a mobile number, the number is sent to the SMS provider you configured to deliver the one-time code. If you sign in with Google, we receive only your name and verified email. “This device” sign-in sends nothing anywhere.'],
  ['Services we contact', 'USD exchange rates (only when you press “Fetch rate”): open.er-api.com. Messages you send open WhatsApp, LINE, Telegram, Viber, SMS or email on your device — tamuko does not send them for you. Printers you connect receive only the receipts you print.'],
  ['Camera and Bluetooth', 'The camera is used only to read barcodes; nothing is recorded or uploaded. Bluetooth and the local network are used only to reach the receipt printers you add.'],
  ['Security', 'Set a PIN to lock the app. PINs and sign-in codes are stored only as salted hashes. Make regular backups (Settings → Backup); if you lose the device without a backup, the data cannot be recovered.'],
  ['Your choices', 'Export your data any time (Settings → Backup, Reports → CSV). Delete everything with Settings → Delete all data on this device.'],
  ['Children', 'tamuko is a business tool and is not intended for children.'],
  ['Contact', 'hello@tamuko.app'],
];

const TERMS: [string, string][] = [
  ['Using tamuko', 'tamuko is provided to help you run your business. You are responsible for your prices, taxes, receipts, permits and the records you keep.'],
  ['Tax and money', 'Tax rates are defaults for each country and may be out of date. Check them with your tax adviser. Reports are estimates, not tax returns or accounts.'],
  ['Payments', 'tamuko does not move money. QR and payment-link sales are marked paid only when you confirm that the money arrived. Always check your bank or wallet app.'],
  ['Availability', 'The app works offline on your device. We do not guarantee it is free of errors; keep backups of your data.'],
  ['Changes', 'We may update these terms with new versions of the app. Continuing to use tamuko means you accept the current terms.'],
];

const CREDITS: [string, string][] = [
  ['Icons', 'Solar Icons Set by 480 Design — CC BY 4.0 (figma.com/community/file/1166831539721848736).'],
  ['Fonts', 'Bricolage Grotesque, Instrument Serif, Inter, JetBrains Mono, Fredoka, Vazirmatn and Noto fonts — SIL Open Font License 1.1.'],
  ['Software', 'Built with Expo and React Native (MIT) and other open-source libraries listed in the app’s package manifest.'],
];

export function Legal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'privacy' | 'terms' | 'credits'>('privacy');
  const rows = tab === 'privacy' ? PRIVACY : tab === 'terms' ? TERMS : CREDITS;
  return (
    <Sheet visible={visible} onClose={onClose} title="Privacy & terms">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'privacy', label: 'Privacy' }, { value: 'terms', label: 'Terms' }, { value: 'credits', label: 'Credits' }]} />
      {rows.map(([h, body]) => (
        <React.Fragment key={h}>
          <Kicker>{h}</Kicker>
          <Txt>{body}</Txt>
        </React.Fragment>
      ))}
      <Txt size={12} dim>Version 1.0 · Last updated November 2026</Txt>
    </Sheet>
  );
}
