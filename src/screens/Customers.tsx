// Manage → Customers & rewards (tamuko Rewards).
// "After 10 purchases of Karak chai, give 1 free, valid 30 days" in plain words. Customers are found
// by name or phone at the till; each has a member pass (QR + stamp count) that can be sent by WhatsApp,
// so no app download is needed.
import React, { useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, Field, H2, IconButton, Kicker, Note, Pill, Row, Screen, Segmented, Sheet, Stat, Txt, PageHeader } from '../components/ui';
import { CHANNELS, openShare } from '../integrations';
import { countryOf, formatMoney } from '../money';
import { clampText, isE164, maskPhone, normalizePhone } from '../security';
import { Customer, useApp } from '../store';
import { useTheme } from '../theme';

export default function Customers({ onBack }: { onBack: () => void }) {
  const th = useTheme();
  const b = useApp((s) => s.business)!;
  const items = useApp((s) => s.items);
  const customers = useApp((s) => s.customers);
  const updateBusiness = useApp((s) => s.updateBusiness);
  const saveCustomer = useApp((s) => s.saveCustomer);
  const c = countryOf(b.country);
  const rule = b.rewards ?? { enabled: false, itemId: null, every: 10, validDays: 30 };
  const setRule = (patch: Partial<typeof rule>) => updateBusiness({ rewards: { ...rule, ...patch } });
  const [q, setQ] = useState('');
  const [pass, setPass] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const e164 = phone ? normalizePhone(c.dial, phone) : '';
  const rewardItem = items.find((i) => i.id === rule.itemId);
  const term = q.trim().toLowerCase();
  const list = customers
    .filter((x) => !term || x.name.toLowerCase().includes(term) || x.phone.includes(term.replace(/\D/g, '') || '§'))
    .sort((a, z) => z.lastVisitAt - a.lastVisitAt);
  const ready = customers.filter((x) => rule.enabled && x.stamps >= rule.every).length;
  const wa = CHANNELS.find((x) => x.id === 'whatsapp');

  const passText = (x: Customer) =>
    `${b.name} member pass\n${x.name}\n${rule.enabled ? `${x.stamps}/${rule.every} stamps — ${Math.max(0, rule.every - x.stamps)} more for a free ${rewardItem?.name ?? 'item'}` : `${x.visits} visits`}\nShow this at the counter. Member no. ${x.id.slice(0, 8).toUpperCase()}`;

  return (
    <Screen style={{ maxWidth: 720 }}>
      <PageHeader kicker="Rewards" title="Customers & rewards" onBack={onBack} />

      <Card style={{ gap: 12 }}>
        <H2 size={18}>Stamp card</H2>
        <Segmented value={rule.enabled ? 'on' : 'off'} onChange={(v) => setRule({ enabled: v === 'on' })} options={[{ value: 'on', label: 'On · count stamps' }, { value: 'off', label: 'Off' }]} />
        <Txt size={17} weight="600">
          After <Txt size={17} weight="700" mono>{rule.every}</Txt> purchases of <Txt size={17} weight="700">{rewardItem?.name ?? 'any item'}</Txt>, give <Txt size={17} weight="700">1 free</Txt>, valid <Txt size={17} weight="700" mono>{rule.validDays}</Txt> days.
        </Txt>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt weight="600">Purchases needed</Txt>
          <Row gap={8}>
            <IconButton icon="minus" a11y="Fewer purchases" onPress={() => setRule({ every: Math.max(2, rule.every - 1) })} />
            <Txt size={18} weight="700" mono style={{ minWidth: 30, textAlign: 'center' }}>{rule.every}</Txt>
            <IconButton icon="plus" a11y="More purchases" onPress={() => setRule({ every: Math.min(50, rule.every + 1) })} />
          </Row>
        </Row>
        <Txt size={14} weight="600">Counts purchases of</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button size="sm" kind={!rule.itemId ? 'secondary' : 'outline'} label="Any item" onPress={() => setRule({ itemId: null })} />
          {items.filter((i) => i.active).map((i) => (
            <Button key={i.id} size="sm" kind={rule.itemId === i.id ? 'secondary' : 'outline'} label={i.name} onPress={() => setRule({ itemId: i.id })} />
          ))}
        </View>
        <Txt size={14} weight="600">Reward valid for</Txt>
        <Segmented value={String(rule.validDays)} onChange={(v) => setRule({ validDays: Number(v) })} options={['14', '30', '60', '90'].map((d) => ({ value: d, label: `${d} days` }))} />
        <Txt size={13} dim>Stamps are added when a sale is paid. A voided sale does not remove stamps automatically — adjust by talking to the customer.</Txt>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat icon="users" label="Customers" value={String(customers.length)} />
        <Stat icon="star" label="Rewards ready" value={String(ready)} />
        <Stat icon="cash" label="Spent by members" value={formatMoney(customers.reduce((a, x) => a + x.spentMinor, 0), c)} />
      </View>

      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label="Search" value={q} onChange={setQ} placeholder="Name or phone" />
        </View>
        <Button icon="plus" label="Add" onPress={() => setAdding(true)} />
      </Row>
      {list.length === 0 && <Note tone="info" text="Customers appear here when you add them at the till or with Add." />}
      {list.map((x) => (
        <Card key={x.id} onPress={() => setPass(x)} a11y={`Member pass for ${x.name}`} style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt weight="700" style={{ flex: 1 }} numberOfLines={1}>{x.name || 'Customer'}</Txt>
            {rule.enabled && <Pill tone={x.stamps >= rule.every ? 'success' : 'info'} text={x.stamps >= rule.every ? 'Reward ready' : `${x.stamps}/${rule.every}`} />}
          </Row>
          <Txt size={13} dim>{x.phone ? maskPhone(x.phone) : 'No phone'} · {x.visits} visits · {formatMoney(x.spentMinor, c)}</Txt>
        </Card>
      ))}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="New customer">
        <Field label="Name" value={name} onChange={setName} maxLength={60} />
        <Field label={`Mobile (${c.dial})`} value={phone} onChange={setPhone} keyboard="phone-pad" error={phone && !isE164(e164) ? 'Check the number' : undefined} />
        <Button size="lg" label="Save" disabled={!name.trim() || (!!phone && !isE164(e164))} onPress={() => { saveCustomer({ name: clampText(name.trim(), 60), phone: phone ? e164 : '' }); setName(''); setPhone(''); setAdding(false); }} />
      </Sheet>

      <Sheet visible={!!pass} onClose={() => setPass(null)} title="Member pass">
        {pass && (
          <>
            <Card style={{ alignItems: 'center', gap: 10 }}>
              <Kicker>{b.name}</Kicker>
              <Txt size={22} weight="800" heading>{pass.name}</Txt>
              {rule.enabled && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {Array.from({ length: rule.every }, (_, i) => (
                    <View key={i} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: th.primary, backgroundColor: i < pass.stamps ? th.primary : 'transparent' }} />
                  ))}
                </View>
              )}
              <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16 }}>
                <QRCode value={`tamuko:member:${pass.id}`} size={150} />
              </View>
              <Txt size={13} dim mono>No. {pass.id.slice(0, 8).toUpperCase()}</Txt>
            </Card>
            <Row>
              {wa && pass.phone ? <Button kind="outline" icon="message" label="WhatsApp" onPress={() => openShare(wa, passText(pass), pass.phone)} style={{ flex: 1 }} /> : null}
              <Button kind="outline" icon="share" label="Share" onPress={() => Share.share({ message: passText(pass) }).catch(() => {})} style={{ flex: 1 }} />
            </Row>
          </>
        )}
      </Sheet>
    </Screen>
  );
}
