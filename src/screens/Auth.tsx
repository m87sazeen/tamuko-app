import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Challenge, Channel, checkOtp, gatewayChannels, onDevSms, requestOtp, smsProvider } from '../auth/otp';
import { LineSignIn, lineConfigured } from '../auth/line';
import { GoogleSignIn, googleConfigured } from '../auth/google';
import { StackedLockup } from '../brand/Logo';
import { Accent, Button, Card, Field, H1, Note, Row, Screen, Segmented, Sheet, Txt } from '../components/ui';
import { COUNTRIES, countryOf } from '../money';
import { isE164, maskPhone, normalizePhone } from '../security';
import { useApp } from '../store';
import { useTheme } from '../theme';
import { Legal } from './Legal';
import { LanguageButton } from '../components/LanguageButton';

export default function AuthScreen() {
  const t = useTheme();
  const upsertUser = useApp((s) => s.upsertUser);
  // Phone sign-in is offered only when a real SMS provider is set up (or in development builds);
  // "This device" needs no account: data stays on the phone and a PIN protects it.
  const phoneReady = __DEV__ || smsProvider.id !== 'dev';
  const existingLocal = useApp((s) => s.users.find((u) => u.provider === 'local'));
  const [mode, setMode] = useState<'device' | 'phone' | 'google' | 'line'>('device');
  const [channel, setChannel] = useState<Channel>('sms');
  const [waReady, setWaReady] = useState(false);
  useEffect(() => {
    if (smsProvider.id === 'gateway') gatewayChannels().then((c) => setWaReady(c.whatsapp)).catch(() => {});
  }, []);
  const [legal, setLegal] = useState(false);
  const [cc, setCc] = useState('AE');
  const [pickCc, setPickCc] = useState(false);
  const [local, setLocal] = useState('');
  const [ch, setCh] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [dev, setDev] = useState<{ phone: string; text: string } | null>(null);

  useEffect(() => {
    const off = onDevSms((m) => setDev(m));
    return off;
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const country = countryOf(cc);
  const phone = normalizePhone(country.dial, local);

  const send = async () => {
    setErr('');
    if (!isE164(phone)) return setErr('Enter a valid mobile number.');
    setBusy(true);
    try {
      setCh(await requestOtp(phone, 'tamuko', channel));
      setCode('');
    } catch (e: any) {
      setErr(e.message ?? 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!ch || busy) return;
    setBusy(true);
    setErr('');
    const r = await checkOtp(ch, value.trim());
    setBusy(false);
    if (!r.ok) return setErr(r.reason);
    try {
      upsertUser({ provider: 'phone', phone: ch.phone, name: '' });
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const resendIn = ch ? Math.max(0, Math.floor((ch.resendAt - now) / 1000)) : 0;
  const expiresIn = ch ? Math.max(0, Math.floor((ch.expiresAt - now) / 1000)) : 0;

  return (
    <Screen style={{ maxWidth: 480, paddingTop: 16 }}>
      <View style={{ alignItems: 'flex-end' }}>
        <LanguageButton />
      </View>
      <View style={{ alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <StackedLockup height={76} variant={t.dark ? 'charcoal' : 'cream'} />
        <View style={{ alignItems: 'center' }}>
          <H1 size={30} style={{ textAlign: 'center' }}>Big business power.</H1>
          <Accent size={32}>Made simple.</Accent>
        </View>
      </View>

      {dev && smsProvider.id === 'dev' && (
        <Card style={{ borderColor: t.pending, borderWidth: 2, gap: 4 }}>
          <Txt size={12} weight="700" color={t.pending}>Test message · no SMS was sent · to {maskPhone(dev.phone)}</Txt>
          <Txt size={16} weight="600" mono>{dev.text}</Txt>
        </Card>
      )}

      <Card style={{ gap: 16 }}>
        {(phoneReady || googleConfigured || lineConfigured) && <H1>Sign in or sign up</H1>}
        {(phoneReady || googleConfigured || lineConfigured) && <Segmented
          value={mode}
          onChange={(v) => { setMode(v); setErr(''); }}
          options={[
            { value: 'device' as const, label: 'This device' },
            ...(phoneReady ? [{ value: 'phone' as const, label: 'Mobile' }] : []),
            ...(googleConfigured ? [{ value: 'google' as const, label: 'Google' }] : []),
            ...(lineConfigured ? [{ value: 'line' as const, label: 'LINE' }] : []),
          ]}
        />}

        {mode === 'device' && (
          existingLocal ? (
            <>
              <Button size="lg" label="Continue" onPress={() => { try { upsertUser({ provider: 'local', name: existingLocal.name }); } catch (e: any) { setErr(e.message); } }} />
            </>
          ) : (
            <>
              <Txt dim>No account needed. Everything stays on this device.</Txt>
              <Button size="lg" label="Get started" onPress={() => { try { upsertUser({ provider: 'local', name: 'Owner' }); } catch (e: any) { setErr(e.message); } }} />
            </>
          )
        )}

        {mode === 'phone' && !ch && (
          <>
            <View style={{ gap: 6 }}>
              <Txt size={14} weight="600">Country</Txt>
              <Pressable accessibilityRole="button" onPress={() => setPickCc(true)} style={{ minHeight: 50, borderRadius: 12, backgroundColor: t.inset, borderWidth: 1.5, borderColor: t.border, paddingHorizontal: 16, justifyContent: 'center' }}>
                <Txt>{country.name} <Txt mono>{country.dial}</Txt></Txt>
              </Pressable>
            </View>
            <Field label="Mobile number" value={local} onChange={(s) => setLocal(s.replace(/[^\d+ ]/g, ''))} keyboard="phone-pad" placeholder="50 123 4567" maxLength={18} autoComplete="tel" onSubmit={send} />
            {waReady && (
              <>
                <Txt size={14} weight="600">Send the code by</Txt>
                <Segmented value={channel} onChange={setChannel} options={[{ value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' }]} />
              </>
            )}
            <Button label={channel === 'whatsapp' ? 'Send code on WhatsApp' : 'Send code'} onPress={send} loading={busy} size="lg" />
            <Txt size={12} dim>We send a one-time 6-digit code by SMS. Standard SMS rates may apply. Provider: {smsProvider.label} ({smsProvider.free}).</Txt>
          </>
        )}

        {mode === 'phone' && ch && (
          <>
            <Txt>Code sent to <Txt weight="800">{maskPhone(ch.phone)}</Txt></Txt>
            <Field label="6-digit code" value={code} onChange={(s) => {
                const next = s.replace(/\D/g, '').slice(0, 6);
                setCode(next);
                if (next.length === 6 && code.length !== 6) verify(next); // no extra tap needed
              }} keyboard="number-pad" maxLength={6} autoFocus autoComplete="sms-otp" onSubmit={() => verify()} hint={expiresIn ? `Expires in ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}` : 'Code expired'} />
            <Button label="Check code" onPress={() => verify()} loading={busy} disabled={code.length !== 6 || !expiresIn} size="lg" />
            <Row style={{ justifyContent: 'space-between' }}>
              <Button kind="ghost" size="sm" label="Change number" onPress={() => { setCh(null); setErr(''); }} />
              <Button kind="ghost" size="sm" label={resendIn ? `Resend in ${resendIn}s` : 'Resend code'} disabled={!!resendIn} onPress={send} />
            </Row>
          </>
        )}

        {mode === 'line' && (
          <>
            <LineSignIn
              onProfile={(p) => {
                try {
                  upsertUser({ provider: 'line', lineId: p.sub, email: p.email || undefined, name: p.name });
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
            />
            <Txt size={12} dim>We only receive your LINE display name. We never see your LINE password.</Txt>
          </>
        )}

        {mode === 'google' && (
          <>
            <GoogleSignIn
              onProfile={(p) => {
                try {
                  upsertUser({ provider: 'google', email: p.email, name: p.name });
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
            />
            <Txt size={12} dim>We only read your name and verified email address. We never see your Google password.</Txt>
          </>
        )}

        {!!err && <Note tone="error" text={err} />}
      </Card>

      <Txt size={12} dim center>
        Your business data stays on this device. By continuing you agree to the terms and privacy notice.
      </Txt>
      <Button kind="ghost" size="sm" icon="document" label="Privacy & terms" onPress={() => setLegal(true)} />
      <Legal visible={legal} onClose={() => setLegal(false)} />

      <Sheet visible={pickCc} onClose={() => setPickCc(false)} title="Country">
        {COUNTRIES.map((c) => (
          <Button key={c.code} kind={c.code === cc ? 'primary' : 'outline'} label={`${c.name}  ${c.dial}`} onPress={() => { setCc(c.code); setPickCc(false); }} />
        ))}
      </Sheet>
    </Screen>
  );
}
