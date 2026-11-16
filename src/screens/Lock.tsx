import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, Logo, Note, Screen, Txt } from '../components/ui';
import { randomSalt, safeEqual, stretch } from '../security';
import { useApp } from '../store';

export async function hashPin(pin: string) {
  const salt = randomSalt();
  return { salt, hash: await stretch(pin, salt) };
}

let fails = 0;
let lockedUntil = 0;

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const pin = useApp((s) => s.pin);
  const signOut = useApp((s) => s.signOut);
  const log = useApp((s) => s.log);
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const wait = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const go = async () => {
    if (!pin || wait) return;
    setBusy(true);
    const ok = safeEqual(await stretch(v, pin.salt), pin.hash);
    setBusy(false);
    if (ok) {
      fails = 0;
      log('security.unlock');
      return onUnlock();
    }
    fails++;
    log('security.unlock_failed', String(fails));
    setV('');
    if (fails >= 5) {
      lockedUntil = Date.now() + Math.min(30_000 * 2 ** (fails - 5), 15 * 60_000); // escalating back-off
      setErr('Too many wrong PINs. Please wait.');
    } else setErr(`Wrong PIN. ${5 - fails} tries before a short lock.`);
  };

  return (
    <Screen style={{ maxWidth: 420, paddingTop: 80 }}>
      <View style={{ alignItems: 'center' }}><Logo size={40} /></View>
      <Card style={{ gap: 16 }}>
        <Txt size={20} weight="800">Locked</Txt>
        <Field label="Enter PIN" value={v} onChange={(s) => setV(s.replace(/\D/g, '').slice(0, 8))} keyboard="number-pad" secure autoFocus onSubmit={go} />
        <Button label={wait ? `Try again in ${wait}s` : 'Unlock'} onPress={go} disabled={v.length < 4 || !!wait} loading={busy} size="lg" />
        {!!err && <Note tone="error" text={err} />}
        <Button kind="ghost" label="Forgot PIN? Sign in again" onPress={signOut} />
      </Card>
    </Screen>
  );
}
