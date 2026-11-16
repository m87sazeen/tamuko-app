import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Switch, View , Linking } from 'react-native';
import { Button, Card, Field, H2, Note, Pill, Row, Screen, Segmented, Sheet, Txt, PageHeader } from '../components/ui';
import { exportBackup, pickAndRestore } from '../files';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Legal } from './Legal';
import { LANGS, langOf, useT } from '../i18n';
import { CHANNELS } from '../integrations';
import { COUNTRY_PACK_VERSION, COUNTRIES, countryOf, fetchUsdRate, parsePercent, pctLabel, usdEquivalent } from '../money';
import { clampText, maskPhone } from '../security';
import { useApp } from '../store';
import { useTheme } from '../theme';
import { hashPin } from './Lock';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

async function pickImage(size: number): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
  if (r.canceled) return null;
  const out = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: size } }], { compress: 0.8, format: ImageManipulator.SaveFormat.PNG, base64: true });
  return out.base64 ? `data:image/png;base64,${out.base64}` : null;
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const th = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Txt weight="600">{label}</Txt>
        {hint ? <Txt size={12} dim>{hint}</Txt> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: th.primary, false: th.inset }} />
    </Row>
  );
}

export default function Settings() {
  const [legalOpen, setLegalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const th = useTheme();
  const { t, lang } = useT();
  const s = useApp();
  const b = s.business!;
  const c = countryOf(b.country);
  const me = s.users.find((u) => u.id === s.currentUserId);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [rateTxt, setRateTxt] = useState(b.usd.localPerUsd ? String(b.usd.localPerUsd) : '');
  const [taxTxt, setTaxTxt] = useState(String(b.tax.rateBp / 100));
  const [pin1, setPin1] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const owner = me?.role === 'owner';
  const regions = Array.from(new Set(LANGS.map((l) => l.region)));

  const changeCountry = (code: string) => {
    const nc = countryOf(code);
    // Auto-apply that country's currency, tax pack and language.
    s.updateBusiness({ country: code, tax: { ...b.tax, enabled: nc.tax.rateBp > 0, name: nc.tax.name, rateBp: nc.tax.rateBp, inclusive: nc.tax.inclusive }, usd: { ...b.usd, localPerUsd: 0, updatedAt: null } });
    s.setSettings({ language: nc.lang });
    setTaxTxt(String(nc.tax.rateBp / 100));
    setRateTxt('');
    setCountryOpen(false);
    setMsg({ tone: 'info', text: `Switched to ${nc.name}: ${nc.currency}, ${nc.tax.rateBp ? `${nc.tax.name} ${pctLabel(nc.tax.rateBp)}` : 'no tax'}. Existing item prices are NOT converted — review them in Items.` });
  };

  return (
    <Screen>
      <PageHeader kicker={b.name} title={t('settings')} />
      {msg && <Note tone={msg.tone} text={msg.text} />}

      {/* Account */}
      <Card style={{ gap: 8 }}>
        <H2>Account</H2>
        <Txt>{me?.email ?? (me?.phone ? maskPhone(me.phone) : '')} <Txt dim>· {me?.provider === 'google' ? 'Google' : 'Mobile'}</Txt></Txt>
        <Pill tone="info" text={me?.role === 'owner' ? 'Owner' : 'Cashier'} />
        <Button kind="outline" label="Sign out" onPress={s.signOut} />
      </Card>

      {/* Language */}
      <Card style={{ gap: 8 }}>
        <H2>{t('language')}</H2>
        <Button kind="outline" icon="globe" label={`${lang.native} · ${lang.name}`} onPress={() => setLangOpen(true)} />
        <Txt size={12} dim>Translations are drafts and need native-speaker review before launch.</Txt>
      </Card>

      {/* Business & branding */}
      <Card style={{ gap: 12 }}>
        <H2>Business & branding</H2>
        <Field label="Business name" value={b.name} onChange={(v) => s.updateBusiness({ name: clampText(v, 60) })} maxLength={60} />
        <Row>
          {b.logo ? <Image source={{ uri: b.logo }} style={{ width: 64, height: 64, borderRadius: 12 }} accessibilityLabel="Business logo" /> : <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: th.inset, alignItems: 'center', justifyContent: 'center' }}><Txt dim>Logo</Txt></View>}
          <View style={{ flex: 1, gap: 8 }}>
            <Button size="sm" kind="outline" label={b.logo ? 'Change logo' : 'Add logo'} onPress={async () => { const d = await pickImage(256); if (d) s.updateBusiness({ logo: d }); }} />
            {b.logo && <Button size="sm" kind="ghost" label="Remove logo" onPress={() => s.updateBusiness({ logo: null })} />}
          </View>
        </Row>
        <Field label="Receipt footer" value={b.receiptFooter} onChange={(v) => s.updateBusiness({ receiptFooter: clampText(v, 120) })} maxLength={120} />
        <Toggle label="Order rail & tokens" value={b.railEnabled} onChange={(v) => s.updateBusiness({ railEnabled: v })} hint="Kitchen / job tickets with pickup numbers" />
      </Card>

      {/* Payment QR */}
      <Card style={{ gap: 12 }}>
        <H2>Payment QR</H2>
        <Txt size={14} dim>Upload the QR your bank or wallet gave you (PromptPay, UPI, DuitNow, QRIS, VietQR, PayNow, etc.), or paste its text.</Txt>
        {b.qrImage && <Image source={{ uri: b.qrImage }} style={{ width: 160, height: 160, alignSelf: 'center', backgroundColor: '#fff' }} resizeMode="contain" accessibilityLabel="Payment QR" />}
        <Row>
          <Button size="sm" kind="outline" label={b.qrImage ? 'Replace QR image' : 'Upload QR image'} onPress={async () => { const d = await pickImage(512); if (d) s.updateBusiness({ qrImage: d }); }} style={{ flex: 1 }} />
          {b.qrImage && <Button size="sm" kind="ghost" label="Remove" onPress={() => s.updateBusiness({ qrImage: null })} />}
        </Row>
        <Field label="Or paste the QR text (optional)" value={b.qrPayload} onChange={(v) => s.updateBusiness({ qrPayload: v.slice(0, 512) })} placeholder="upi://pay?pa=… / 000201…" />
        <Field label="Label under the QR" value={b.qrLabel} onChange={(v) => s.updateBusiness({ qrLabel: clampText(v, 40) })} placeholder="e.g. Bank account name" />
        <Note tone="warning" text="Only use a QR that pays YOUR account. Customers' payments are confirmed manually by you until a payment gateway is connected." />
      </Card>

      {/* Payment link */}
      <Card style={{ gap: 12 }}>
        <H2>Payment link</H2>
        <Txt dim>Paste the payment page your bank, wallet or gateway gives you. At checkout, choose “Link” to send it with the amount by WhatsApp, SMS or any app.</Txt>
        <Field label="Your payment link" value={b.payLink ?? ''} onChange={(v) => s.updateBusiness({ payLink: v.trim().slice(0, 300) })} placeholder="https://pay.yourbank.com/…" error={b.payLink && !/^https:\/\/\S+$/.test(b.payLink) ? 'Use a link starting with https://' : undefined} />
      </Card>

      {/* Country, currency & tax */}
      <Card style={{ gap: 12 }}>
        <H2>Country, currency & tax</H2>
        <Button kind="outline" icon="globe" label={`${c.name} · ${c.currency}`} onPress={() => owner && setCountryOpen(true)} disabled={!owner} />
        <Toggle label={`Charge ${b.tax.name}`} value={b.tax.enabled} onChange={(v) => s.updateBusiness({ tax: { ...b.tax, enabled: v } })} />
        {b.tax.enabled && (
          <>
            <Field label="Tax name" value={b.tax.name} onChange={(v) => s.updateBusiness({ tax: { ...b.tax, name: clampText(v, 20) } })} />
            <Field
              label="Rate (%)"
              value={taxTxt}
              keyboard="decimal-pad"
              onChange={(v) => { setTaxTxt(v); const bp = parsePercent(v); if (bp != null) s.updateBusiness({ tax: { ...b.tax, rateBp: bp } }); }}
              error={parsePercent(taxTxt) == null ? 'Enter a percentage like 5 or 7.5' : undefined}
              hint={`Default for ${c.name}: ${c.tax.name} ${pctLabel(c.tax.rateBp)} (pack ${COUNTRY_PACK_VERSION})`}
            />
            <Segmented value={b.tax.inclusive ? 'in' : 'ex'} onChange={(v) => s.updateBusiness({ tax: { ...b.tax, inclusive: v === 'in' } })} options={[{ value: 'in', label: 'Prices include tax' }, { value: 'ex', label: 'Add tax at checkout' }]} />
            <Field label="Tax registration number (TRN / GSTIN / Tax ID)" value={b.tax.registrationNo} onChange={(v) => s.updateBusiness({ tax: { ...b.tax, registrationNo: clampText(v, 30) } })} />
          </>
        )}
        <Txt size={12} dim>Rates are applied automatically from your country but are defaults, not tax advice. Check with a local accountant.</Txt>
      </Card>

      {/* USD tourist view */}
      <Card style={{ gap: 12 }}>
        <H2>Show USD for tourists</H2>
        <Toggle label="Show USD equivalent on bills" value={b.usd.show} onChange={(v) => s.updateBusiness({ usd: { ...b.usd, show: v } })} hint="Reference only — customers still pay in local currency" />
        {b.usd.show && (
          <>
            <Field
              label={`1 USD = ? ${c.currency}`}
              value={rateTxt}
              keyboard="decimal-pad"
              onChange={(v) => { setRateTxt(v); const n = Number(v); if (/^\d+(\.\d+)?$/.test(v) && n > 0) s.updateBusiness({ usd: { ...b.usd, localPerUsd: n, updatedAt: Date.now(), source: 'manual' } }); }}
              hint={b.usd.updatedAt ? `Updated ${new Date(b.usd.updatedAt).toLocaleString(c.locale)} (${b.usd.source})` : 'Enter a rate or fetch today’s'}
            />
            <Button
              size="sm"
              kind="outline"
              label="Fetch today's rate (free)"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  const r = await fetchUsdRate(c.currency);
                  setRateTxt(String(r));
                  s.updateBusiness({ usd: { ...b.usd, localPerUsd: r, updatedAt: Date.now(), source: 'open.er-api.com' } });
                } catch (e: any) {
                  setMsg({ tone: 'error', text: e.message });
                } finally {
                  setBusy(false);
                }
              }}
            />
            {b.usd.localPerUsd > 0 && <Txt dim>Example: {countryOf(b.country).currency} 100 ≈ {usdEquivalent(100 * 10 ** c.decimals, c, b.usd.localPerUsd)}</Txt>}
          </>
        )}
      </Card>

      {/* Integrations */}
      <Card style={{ gap: 12 }}>
        <H2>Messaging apps</H2>
        <Txt size={14} dim>Turn on the apps your customers use. You can then send receipts and “order ready” messages with one tap.</Txt>
        {CHANNELS.map((ch) => {
          const cfg = b.integrations[ch.id] ?? { enabled: false, handle: '' };
          const set = (patch: Partial<typeof cfg>) => s.updateBusiness({ integrations: { ...b.integrations, [ch.id]: { ...cfg, ...patch } } });
          return (
            <View key={ch.id} style={{ gap: 6, borderTopWidth: 1, borderColor: th.border, paddingTop: 10 }}>
              <Toggle label={ch.name} value={cfg.enabled} onChange={(v) => set({ enabled: v })} hint={ch.regions} />
              {cfg.enabled && (
                <>
                  <Field label={ch.handleLabel} value={cfg.handle} onChange={(v) => set({ handle: clampText(v, 60) })} />
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Pill tone={ch.share ? 'success' : 'warning'} text={ch.share ? 'Share messages: ready' : 'Share: copy & paste'} />
                    <Pill tone="pending" text="Auto-send: needs cloud (Phase 2)" />
                  </Row>
                  <Txt size={12} dim>Automation: {ch.businessApi}</Txt>
                </>
              )}
            </View>
          );
        })}
      </Card>

      {/* Appearance */}
      <Card style={{ gap: 12 }}>
        <H2>Appearance</H2>
        <Segmented value={s.settings.themeMode} onChange={(v) => s.setSettings({ themeMode: v })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <Toggle label="Reduce motion" value={s.settings.reduceMotion} onChange={(v) => s.setSettings({ reduceMotion: v })} />
      </Card>

      {/* Security */}
      <Card style={{ gap: 12 }}>
        <H2>Security</H2>
        {s.pin ? (
          <>
            <Pill tone="success" text="PIN lock on" />
            <Segmented value={String(s.settings.autoLockMin)} onChange={(v) => s.setSettings({ autoLockMin: Number(v) })} options={[{ value: '1', label: '1 min' }, { value: '5', label: '5 min' }, { value: '15', label: '15 min' }]} />
            <Button kind="outline" label="Remove PIN" onPress={() => s.setPin(null)} disabled={!owner} />
          </>
        ) : (
          <>
            <Note tone="warning" text="Set a PIN so nobody else can open your sales on this phone." />
            <Field label="New PIN (4–8 digits)" value={pin1} onChange={(v) => setPin1(v.replace(/\D/g, '').slice(0, 8))} keyboard="number-pad" secure />
            <Button label="Set PIN" disabled={pin1.length < 4 || /^(\d)\1+$/.test(pin1) || pin1 === '1234'} onPress={async () => { s.setPin(await hashPin(pin1)); setPin1(''); setMsg({ tone: 'success', text: 'PIN set.' }); }} />
            <Txt size={12} dim>Avoid easy PINs like 1111 or 1234.</Txt>
          </>
        )}
      </Card>

      {/* Backup */}
      <Card style={{ gap: 12 }}>
        <H2>Backup</H2>
        <Note
          tone={s.settings.lastBackupAt && openedAt - s.settings.lastBackupAt < 7 * 86400000 ? 'success' : 'warning'}
          text={s.settings.lastBackupAt ? `Last backup ${new Date(s.settings.lastBackupAt).toLocaleString(c.locale)}.` : 'Your data lives only on this device. If the phone is lost, data is lost. Back up regularly.'}
        />
        <Button kind="secondary" icon="download" label="Export backup file" onPress={async () => { await exportBackup(); setMsg({ tone: 'success', text: 'Backup exported. Keep the file somewhere safe — it contains your sales data.' }); }} />
        <Button kind="outline" label="Restore from backup" disabled={!owner} onPress={async () => { try { setMsg({ tone: 'success', text: await pickAndRestore() }); } catch (e: any) { setMsg({ tone: 'error', text: e.message }); } }} />
      </Card>

      {/* Help & legal */}
      <Card style={{ gap: 12 }}>
        <H2>Help & legal</H2>
        <Button kind="outline" icon="document" label="Privacy, terms & credits" onPress={() => setLegalOpen(true)} />
        <Button kind="outline" icon="message" label="Contact support · hello@tamuko.app" onPress={() => Linking.openURL('mailto:hello@tamuko.app?subject=tamuko%20help').catch(() => {})} />
        <Txt size={12} dim>tamuko {APP_VERSION}</Txt>
      </Card>

      {/* Delete */}
      {owner && (
        <Card style={{ gap: 12, borderColor: th.error }}>
          <H2>Delete all data on this device</H2>
          <Txt dim>Removes your business, items, sales, customers, bookings and settings from this device and signs you out. Export a backup first if you might need it. This cannot be undone.</Txt>
          <Button kind="danger" icon="trash" label="Delete everything" onPress={() => { setConfirmText(''); setDeleteOpen(true); }} />
        </Card>
      )}
      <Legal visible={legalOpen} onClose={() => setLegalOpen(false)} />
      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete everything?">
        <Note tone="error" text="All data on this device will be removed. Type DELETE to confirm." />
        <Field label="Type DELETE" value={confirmText} onChange={setConfirmText} autoFocus />
        <Button kind="danger" size="lg" label="Delete all data" disabled={confirmText.trim() !== 'DELETE'} onPress={async () => { s.log('data.delete_all'); await AsyncStorage.clear(); s.resetAll(); }} />
      </Sheet>

      <Sheet visible={langOpen} onClose={() => setLangOpen(false)} title={t('language')}>
        {regions.map((r) => (
          <View key={r} style={{ gap: 8 }}>
            <Txt weight="800" dim>{r}</Txt>
            {LANGS.filter((l) => l.region === r).map((l) => (
              <Button key={l.code} kind={l.code === lang.code ? 'primary' : 'outline'} label={`${l.native} · ${l.name}${l.rtl ? ' (RTL)' : ''}`} onPress={() => { s.setSettings({ language: l.code }); setLangOpen(false); }} />
            ))}
          </View>
        ))}
      </Sheet>

      <Sheet visible={countryOpen} onClose={() => setCountryOpen(false)} title="Country">
        <Note tone="info" text="Changing country updates currency, tax and language. Past receipts keep their original values." />
        {COUNTRIES.map((x) => (
          <Button key={x.code} kind={x.code === b.country ? 'primary' : 'outline'} label={`${x.name} · ${x.currency} · ${x.tax.rateBp ? `${x.tax.name} ${pctLabel(x.tax.rateBp)}` : 'no tax'} · ${langOf(x.lang).native}`} onPress={() => changeCountry(x.code)} />
        ))}
      </Sheet>
    </Screen>
  );
}
