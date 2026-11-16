// tamuko POS — the till.
// Tap items (with modifiers: size, sugar, add-ons), attach a customer for stamp rewards, then either
// charge now (pay-first workflows) or send the order to the rail (pay later). Checkout takes cash,
// QR, the merchant's payment link, or a split across several payments. Receipts and kitchen tickets
// print automatically on the printers set up in Manage → Printers.
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Share, TextInput, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ReceiptView from '../components/ReceiptView';
import { Icon } from '../brand/Icon';
import { Button, Card, Field, H2, IconButton, Note, Pill, Row, Segmented, Sheet, Tick, Txt } from '../components/ui';
import { useT } from '../i18n';
import { computeTax, countryOf, formatMoney, parseMoney, pctLabel, usdEquivalent } from '../money';
import { printSale, printTicket } from '../print';
import { clampText, isE164, maskPhone, newId, normalizePhone } from '../security';
import { CatalogItem, Customer, PayPart, PaymentMethod, Sale, SaleLine, Ticket, isUnpaid, stampsFor, useApp } from '../store';
import { ServiceMode, activeModes, modeLabel, payIndex, paysFirst } from '../workflow';
import { FlowPreview } from '../components/Workflow';
import { Scanner } from '../components/Scanner';
import { ALL_FEATURES } from '../catalogue';
import { nativePrinting } from '../print/transports';
import { useTheme } from '../theme';

type CartLine = SaleLine & { key: string };
type CheckoutReq = { lines: SaleLine[]; ticketIds?: string[]; table: string | null; mode: ServiceMode; customerId?: string | null; rewardMinor?: number; job?: { customerId?: string | null; note?: string; dueAt?: number | null } };
const DAY_MS = 86_400_000;
const endOfDay = (d: number) => { const x = new Date(Date.now() + d * DAY_MS); x.setHours(18, 0, 0, 0); return x.getTime(); };

const toSale = (l: CartLine): SaleLine => ({ itemId: l.itemId, name: l.name, unitMinor: l.unitMinor, qty: l.qty, ...(l.mods?.length ? { mods: l.mods } : {}) });

/** Value of the free item a customer can redeem with the current cart, or 0. */
function rewardValue(lines: SaleLine[], rule?: { enabled: boolean; itemId: string | null }) {
  if (!rule?.enabled || !lines.length) return 0;
  const eligible = lines.filter((l) => !rule.itemId || l.itemId === rule.itemId);
  if (!eligible.length) return 0;
  return Math.min(...eligible.map((l) => l.unitMinor));
}

export default function Sell() {
  const th = useTheme();
  const { t, stage } = useT();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const b = useApp((s) => s.business)!;
  const items = useApp((s) => s.items);
  const customers = useApp((s) => s.customers);
  const lastSale = useApp((s) => s.sales.find((x) => !x.voided) ?? null);
  const c = countryOf(b.country);
  const m = (n: number) => formatMoney(n, c);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState('');
  const [checkout, setCheckout] = useState<CheckoutReq | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);
  const [sent, setSent] = useState<Ticket | null>(null);
  const [picking, setPicking] = useState<CatalogItem | null>(null);
  const [custOpen, setCustOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [redeem, setRedeem] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  const [printMsg, setPrintMsg] = useState('');
  const [weighing, setWeighing] = useState<CatalogItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [jobNote, setJobNote] = useState('');
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [due, setDue] = useState<number | null>(null);
  const features = b.features ?? ALL_FEATURES;
  const placeOrder = useApp((s) => s.placeOrder);
  const tickets = useApp((s) => s.tickets);
  const modes = activeModes(b.service);
  const [modeSel, setMode] = useState<ServiceMode>(b.service.defaultMode);
  const mode: ServiceMode = modes.includes(modeSel) ? modeSel : modes[0]; // no tables → take away
  const [table, setTable] = useState<string | null>(null);
  const flow = b.service.flows[mode];
  const payNow = !b.railEnabled || paysFirst(flow);
  const unpaid = b.railEnabled ? tickets.filter(isUnpaid) : [];
  const needTable = mode === 'dinein' && !table;
  const customer = customers.find((x) => x.id === customerId) ?? null;
  const rule = b.rewards;

  const active = useMemo(
    () => items.filter((i) => i.active && (i.name.toLowerCase().includes(q.trim().toLowerCase()) || (!!q.trim() && i.barcode === q.trim()))).sort((a, z) => Number(z.favorite) - Number(a.favorite)),
    [items, q],
  );
  const lines = cart.filter((l) => l.qty > 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.unitMinor, 0);
  const canRedeem = !!customer && !!rule?.enabled && customer.stamps >= rule.every;
  const reward = canRedeem && redeem ? rewardValue(lines, rule) : 0;
  const preview = computeTax(subtotal - reward, b.tax.enabled ? b.tax.rateBp : 0, b.tax.inclusive);
  const inCart = (itemId: string) => lines.filter((l) => l.itemId === itemId).reduce((a, l) => a + l.qty, 0);

  const addLine = (it: CatalogItem, mods: string[] = [], extra = 0, qty = 1) => {
    const key = `${it.id}|${mods.join('|')}`;
    setCart((cs) => {
      const hit = cs.find((l) => l.key === key);
      if (hit) return cs.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      return [...cs, { key, itemId: it.id, name: it.name, unitMinor: it.priceMinor + extra, qty, mods }];
    });
  };
  const bump = (key: string, d: number) => setCart((cs) => cs.map((l) => (l.key === key ? { ...l, qty: Math.max(0, l.qty + d) } : l)).filter((l) => l.qty > 0));
  const tapItem = (it: CatalogItem) => (it.unit && it.unit !== 'each' ? setWeighing(it) : it.modifiers?.length ? setPicking(it) : addLine(it));
  /** Weighed items become one line with the weight in the name, so money stays in whole minor units. */
  const addWeighed = (it: CatalogItem, amount: number) => {
    const label = `${it.name} ${amount} ${it.unit}`;
    setCart((cs) => [...cs, { key: newId(), itemId: it.id, name: label, unitMinor: Math.round(it.priceMinor * amount), qty: 1 }]);
  };
  const onScan = (code: string) => {
    const it = items.find((i) => i.active && i.barcode === code);
    if (it) { tapItem(it); setPrintMsg(`Added ${it.name}.`); }
    else setPrintMsg(`No item has barcode ${code}. Add it in Manage → Items & stock.`);
  };
  const job = features.jobs ? { customerId, note: jobNote.trim() || undefined, dueAt: due } : customerId ? { customerId } : undefined;
  const clear = () => {
    setCart([]);
    setTable(null);
    setCustomerId(null);
    setRedeem(false);
    setJobNote('');
    setDue(null);
    setExtrasOpen(false);
  };

  const report = (r: { ok: boolean; error?: string; printed: string[] }) => setPrintMsg(r.ok ? (r.printed.length ? `Printed on ${r.printed.join(', ')}.` : '') : `${(r as any).error} The order is saved.`);

  const primary = async () => {
    setCartOpen(false);
    const sl = lines.map(toSale);
    if (payNow) return setCheckout({ lines: sl, table: mode === 'dinein' ? table : null, mode, customerId, rewardMinor: reward, job });
    const tk = placeOrder({ lines: sl, mode, table: mode === 'dinein' ? table : null, job });
    clear();
    setSent(tk);
    report(await printTicket(tk, { auto: true }));
  };
  const primaryLabel = needTable ? 'Choose a table' : payNow ? `${t('charge')} ${m(preview.totalMinor)}` : `Send order · ${m(preview.totalMinor)}`;

  const ModePicker =
    b.railEnabled && (modes.length > 1 || mode === 'dinein') ? (
      <View style={{ gap: 8 }}>
        {modes.length > 1 && (
          <Segmented value={mode} onChange={(v) => { setMode(v); if (v !== 'dinein') setTable(null); }} options={modes.map((x) => ({ value: x, label: modeLabel(x, b.template) }))} />
        )}
        {mode === 'dinein' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {b.service.tables.map((tb) => {
              const busy = unpaid.some((x) => x.table === tb);
              return <Button key={tb} size="sm" kind={table === tb ? 'secondary' : 'outline'} label={busy ? `${tb} · open` : tb} a11y={`Table ${tb}${busy ? ', has an open bill' : ''}`} onPress={() => setTable(tb)} />;
            })}
          </ScrollView>
        )}
      </View>
    ) : null;

  const JobPanel = features.jobs ? (
    <View style={{ gap: 8 }}>
      <Field label={b.template === 'service' ? 'Job notes' : 'Order notes'} value={jobNote} onChange={setJobNote} maxLength={160} placeholder={b.typeId === 'carwash' || b.typeId === 'garage' ? 'Plate number, car model' : b.typeId === 'repair' || b.typeId === 'electronics' ? 'Device, IMEI, fault' : b.typeId === 'tailoring' ? 'Measurements, fabric' : 'e.g. 5 shirts, 1 blue jacket'} />
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {[['Ready today', 0], ['Tomorrow', 1], ['In 3 days', 3]].map(([l, d]) => (
          <Button key={l as string} size="sm" kind={due === endOfDay(d as number) ? 'secondary' : 'outline'} icon="calendar" label={l as string} onPress={() => setDue(due === endOfDay(d as number) ? null : endOfDay(d as number))} />
        ))}
      </Row>
    </View>
  ) : null;

  const CustomerRow = features.rewards || features.jobs || customers.length ? (
    customer ? (
      <Card style={{ padding: 12, gap: 8, borderRadius: 16 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt weight="600" numberOfLines={1}>{customer.name || maskPhone(customer.phone)}</Txt>
            {rule?.enabled ? <Txt size={13} dim mono>{customer.stamps}/{rule.every} stamps{stampsFor(lines, rule) ? ` · +${stampsFor(lines, rule)} with this sale` : ''}</Txt> : null}
          </View>
          <IconButton icon="close" size={40} a11y="Remove customer" onPress={() => { setCustomerId(null); setRedeem(false); }} />
        </Row>
        {canRedeem && (
          rewardValue(lines, rule) > 0 ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: redeem }} onPress={() => setRedeem(!redeem)}>
              <Row gap={8}><Tick on={redeem} /><Txt weight="600">Use reward: 1 free {rule?.itemId ? items.find((i) => i.id === rule.itemId)?.name : 'item'}</Txt></Row>
            </Pressable>
          ) : (
            <Note tone="info" text={`Reward ready. Add ${rule?.itemId ? items.find((i) => i.id === rule.itemId)?.name ?? 'the reward item' : 'an item'} to give it free.`} />
          )
        )}
      </Card>
    ) : (
      <Button kind="outline" size="sm" icon="users" label="Add customer · stamps" onPress={() => setCustOpen(true)} />
    )
  ) : null;

  const CartPanel = (
    <View style={{ gap: 10 }}>
      {wide ? <H2>{t('newSale')}</H2> : null}
      {ModePicker}
      {extrasOpen || customer || jobNote || due ? (
        <>
          {CustomerRow}
          {JobPanel}
        </>
      ) : (features.rewards || features.jobs) && lines.length > 0 ? (
        <Button kind="ghost" size="sm" icon="plus" label={features.jobs ? 'Add customer or note' : 'Add customer'} onPress={() => setExtrasOpen(true)} />
      ) : null}
      {lines.length === 0 && <Txt dim>Tap items to add them.</Txt>}
      {lines.map((l) => (
        <Row key={l.key} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt weight="600" numberOfLines={1}>{l.name}</Txt>
            {l.mods?.length ? <Txt size={12} dim numberOfLines={2}>+ {l.mods.join(', ')}</Txt> : null}
            <Txt size={13} dim mono>{m(l.unitMinor)}</Txt>
          </View>
          <Row gap={4}>
            <IconButton icon="minus" a11y={`Remove one ${l.name}`} onPress={() => bump(l.key, -1)} />
            <Txt weight="800" mono style={{ minWidth: 28, textAlign: 'center' }}>{l.qty}</Txt>
            <IconButton icon="plus" a11y={`Add one ${l.name}`} onPress={() => bump(l.key, 1)} />
          </Row>
        </Row>
      ))}
      {lines.length > 0 && (
        <>
          <View style={{ height: 1, backgroundColor: th.border }} />
          {reward > 0 && (
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt dim>Reward (free item)</Txt>
              <Txt dim mono>-{m(reward)}</Txt>
            </Row>
          )}
          {b.tax.enabled && b.tax.rateBp > 0 && (
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt dim>{b.tax.name} {pctLabel(b.tax.rateBp)} {b.tax.inclusive ? '(incl.)' : ''}</Txt>
              <Txt dim mono>{m(preview.taxMinor)}</Txt>
            </Row>
          )}
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt size={20} weight="800" heading>{t('total')}</Txt>
            <Txt size={20} weight="700" mono>{m(preview.totalMinor)}</Txt>
          </Row>
          <Button label={primaryLabel} size="lg" disabled={needTable} onPress={primary} />
          {!payNow && <Txt size={13} dim center>Goes to the rail now. Take payment after “{stage(flow[Math.max(0, payIndex(flow) - 1)].name)}”.</Txt>}
          <Button kind="ghost" size="sm" label="Clear" onPress={clear} />
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: th.bg }}>
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
          {unpaid.length > 0 && <Button kind="outline" icon="receipt" label={`${unpaid.length} not paid yet · open bills`} onPress={() => setBillsOpen(true)} />}
          {!!printMsg && <Note tone={printMsg.startsWith('Printed') || printMsg.startsWith('Added') ? 'success' : 'warning'} text={printMsg} />}
          {!wide && ModePicker}
          <Row gap={8}>
            <TextInput
              accessibilityLabel={t('search')}
              placeholder={`${t('search')}…`}
              placeholderTextColor={th.textDim}
              value={q}
              onChangeText={setQ}
              style={{ flex: 1, minHeight: 48, borderRadius: 999, backgroundColor: th.inset, paddingHorizontal: 20, fontSize: 17, color: th.text, borderWidth: 1, borderColor: th.border }}
            />
            {features.barcode && nativePrinting && <IconButton icon="scan" size={48} a11y="Scan a barcode" onPress={() => setScanning(true)} />}
            {lastSale && <IconButton icon="print" size={48} a11y="Last receipt" onPress={() => setLastOpen(true)} />}
          </Row>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 140 }}>
          {active.length === 0 && <Txt dim>No items. Add some in Manage → Items & stock.</Txt>}
          {active.map((it) => {
            const n = inCart(it.id);
            const out = it.stock != null && it.stock - n <= 0;
            return (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                accessibilityLabel={`${it.name}, ${m(it.priceMinor)}${n ? `, ${n} in cart` : ''}${it.modifiers?.length ? ', has options' : ''}`}
                onPress={() => !out && tapItem(it)}
                disabled={out && n === 0}
                style={({ pressed }) => ({
                  width: wide ? 170 : '47%',
                  minHeight: 96,
                  borderRadius: 18,
                  padding: 14,
                  justifyContent: 'space-between',
                  backgroundColor: n ? th.raised : th.surface,
                  borderWidth: 2,
                  borderColor: n ? th.select : th.border,
                  opacity: out && n === 0 ? 0.5 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Row gap={6} style={{ alignItems: 'flex-start' }}>{it.favorite ? <Icon name="star" size={16} color={th.text} label="Favourite" /> : null}<Txt weight="600" numberOfLines={2} style={{ flex: 1 }}>{it.name}</Txt></Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt dim mono>{it.stock != null && it.stock <= 0 ? 'Out of stock' : m(it.priceMinor)}{it.unit && it.unit !== 'each' ? ` /${it.unit}` : ''}{it.modifiers?.length ? ' +' : ''}</Txt>
                  {n > 0 && (
                    <View style={{ backgroundColor: th.select, borderRadius: 999, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt size={14} weight="700" mono color={th.onSelect}>{n}</Txt>
                    </View>
                  )}
                </Row>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {wide ? (
        <View style={{ width: 360, borderLeftWidth: 1, borderColor: th.border, backgroundColor: th.surface }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>{CartPanel}</ScrollView>
        </View>
      ) : (
        count > 0 && (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
            <Button size="lg" label={`${count} · ${payNow ? t('charge') : 'Send'} ${m(preview.totalMinor)}`} onPress={() => setCartOpen(true)} />
          </View>
        )
      )}

      <Sheet visible={cartOpen} onClose={() => setCartOpen(false)} title={t('newSale')}>{CartPanel}</Sheet>
      {weighing && <WeighSheet item={weighing} onClose={() => setWeighing(null)} onAdd={(amount) => { addWeighed(weighing, amount); setWeighing(null); }} />}
      <Scanner visible={scanning} onClose={() => setScanning(false)} onCode={onScan} />
      {picking && <ModifierPicker item={picking} onClose={() => setPicking(null)} onAdd={(mods, extra, qty) => { addLine(picking, mods, extra, qty); setPicking(null); }} />}
      <CustomerPicker visible={custOpen} onClose={() => setCustOpen(false)} onPick={(cu) => { setCustomerId(cu.id); setRedeem(false); setCustOpen(false); }} />
      {checkout && (
        <Checkout
          {...checkout}
          onClose={(done) => {
            const fromCart = !checkout.ticketIds;
            setCheckout(null);
            if (done && fromCart) clear();
          }}
        />
      )}
      <OpenBills visible={billsOpen} onClose={() => setBillsOpen(false)} onPay={(c0) => { setBillsOpen(false); setCheckout(c0); }} />
      <Sheet visible={lastOpen} onClose={() => setLastOpen(false)} title="Last receipt">
        {lastSale && <ReceiptView sale={lastSale} copy />}
      </Sheet>
      <Sheet visible={!!sent} onClose={() => setSent(null)} title="Order sent">
        {sent && (
          <>
            <Card style={{ alignItems: 'center', gap: 4 }}>
              <Txt dim>{t('token')}</Txt>
              <Txt size={44} weight="800" mono>{sent.token}</Txt>
              <Txt dim>{modeLabel(sent.mode, b.template)}{sent.table ? ` · ${sent.table}` : ''}</Txt>
            </Card>
            <Note tone="pending" text="Waiting · not paid yet. Take payment from Open bills or from the ticket on the rail." />
            <FlowPreview steps={sent.steps} compact />
            <Button size="lg" label={t('newSale')} onPress={() => setSent(null)} />
          </>
        )}
      </Sheet>
    </View>
  );
}

/** Enter the weight or length for items sold per kg, g, metre or litre. */
function WeighSheet({ item, onClose, onAdd }: { item: CatalogItem; onClose: () => void; onAdd: (amount: number) => void }) {
  const b = useApp((s) => s.business)!;
  const c = countryOf(b.country);
  const [v, setV] = useState('');
  const amount = /^\d+(\.\d{1,3})?$/.test(v.trim()) ? Number(v.trim()) : null;
  const quick = item.unit === 'g' ? [50, 100, 250, 500] : item.unit === 'm' ? [1, 2, 5, 10] : [0.25, 0.5, 1, 2];
  return (
    <Sheet visible onClose={onClose} title={item.name}>
      <Txt dim>{formatMoney(item.priceMinor, c)} per {item.unit}</Txt>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {quick.map((x) => <Button key={x} size="sm" kind={amount === x ? 'secondary' : 'outline'} label={`${x} ${item.unit}`} onPress={() => setV(String(x))} />)}
      </Row>
      <Field label={`Amount (${item.unit})`} value={v} onChange={setV} keyboard="decimal-pad" mono autoFocus placeholder="e.g. 1.25" />
      <Button size="lg" label={amount ? `Add · ${formatMoney(Math.round(item.priceMinor * amount), c)}` : 'Enter an amount'} disabled={!amount} onPress={() => amount && onAdd(amount)} />
    </Sheet>
  );
}

/** Choose options for an item: one choice per single group, any number for add-on groups. */
function ModifierPicker({ item, onClose, onAdd }: { item: CatalogItem; onClose: () => void; onAdd: (mods: string[], extraMinor: number, qty: number) => void }) {
  const b = useApp((s) => s.business)!;
  const c = countryOf(b.country);
  const groups = item.modifiers ?? [];
  const [sel, setSel] = useState<Record<string, number[]>>(() => Object.fromEntries(groups.map((g) => [g.id, g.multi || !g.options.length ? [] : [0]])));
  const [qty, setQty] = useState(1);
  const toggle = (gid: string, i: number, multi: boolean) =>
    setSel((s) => ({ ...s, [gid]: multi ? (s[gid].includes(i) ? s[gid].filter((x) => x !== i) : [...s[gid], i]) : [i] }));
  const chosen = groups.flatMap((g) => sel[g.id].map((i) => g.options[i]));
  const extra = chosen.reduce((a, o) => a + o.priceMinor, 0);
  return (
    <Sheet visible onClose={onClose} title={item.name}>
      {groups.map((g) => (
        <View key={g.id} style={{ gap: 8 }}>
          <Txt weight="600">{g.name}{g.multi ? ' · choose any' : ''}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {g.options.map((o, i) => (
              <Button
                key={i}
                size="sm"
                kind={sel[g.id].includes(i) ? 'secondary' : 'outline'}
                label={o.priceMinor ? `${o.name} +${formatMoney(o.priceMinor, c)}` : o.name}
                onPress={() => toggle(g.id, i, g.multi)}
              />
            ))}
          </View>
        </View>
      ))}
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt weight="600">Quantity</Txt>
        <Row gap={8}>
          <IconButton icon="minus" a11y="One less" onPress={() => setQty(Math.max(1, qty - 1))} />
          <Txt size={20} weight="700" mono style={{ minWidth: 30, textAlign: 'center' }}>{qty}</Txt>
          <IconButton icon="plus" a11y="One more" onPress={() => setQty(qty + 1)} />
        </Row>
      </Row>
      <Button size="lg" label={`Add · ${formatMoney((item.priceMinor + extra) * qty, c)}`} onPress={() => onAdd(chosen.map((o) => o.name), extra, qty)} />
    </Sheet>
  );
}

/** Find a customer by name or phone, or add a new one in two fields. */
function CustomerPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (c: Customer) => void }) {
  const customers = useApp((s) => s.customers);
  const saveCustomer = useApp((s) => s.saveCustomer);
  const b = useApp((s) => s.business)!;
  const c = countryOf(b.country);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const term = q.trim().toLowerCase();
  const found = term ? customers.filter((x) => x.name.toLowerCase().includes(term) || x.phone.includes(term.replace(/\D/g, '') || '§')) : customers.slice(-8).reverse();
  const e164 = phone ? normalizePhone(c.dial, phone) : '';
  const phoneOk = !phone || isE164(e164);
  return (
    <Sheet visible={visible} onClose={onClose} title="Customer">
      <Field label="Search name or phone" value={q} onChange={setQ} placeholder="e.g. Sara or 050…" />
      {found.map((x) => (
        <Card key={x.id} onPress={() => onPick(x)} a11y={`Choose ${x.name}`} style={{ padding: 12, borderRadius: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt weight="600">{x.name || 'Customer'}</Txt>
              <Txt size={13} dim>{x.phone ? maskPhone(x.phone) : 'No phone'} · {x.visits} visits</Txt>
            </View>
            {b.rewards?.enabled ? <Pill tone={x.stamps >= b.rewards.every ? 'success' : 'info'} text={`${x.stamps}/${b.rewards.every}`} /> : null}
          </Row>
        </Card>
      ))}
      <View style={{ height: 1, backgroundColor: '#0002' }} />
      <Txt weight="600">New customer</Txt>
      <Field label="Name" value={name} onChange={setName} maxLength={60} />
      <Field label={`Mobile (${c.dial})`} value={phone} onChange={setPhone} keyboard="phone-pad" error={!phoneOk ? 'Check the number' : undefined} />
      <Button label="Add and choose" disabled={!name.trim() || !phoneOk} onPress={() => onPick(saveCustomer({ name: clampText(name.trim(), 60), phone: phone ? e164 : '' }))} />
    </Sheet>
  );
}

/** Unpaid orders, grouped so a table pays one bill for everything it ordered. */
function OpenBills({ visible, onClose, onPay }: { visible: boolean; onClose: () => void; onPay: (c: CheckoutReq & { ticketIds: string[] }) => void }) {
  const b = useApp((s) => s.business)!;
  const tickets = useApp((s) => s.tickets);
  const cancelOrder = useApp((s) => s.cancelOrder);
  const { stage } = useT();
  const c = countryOf(b.country);
  const groups = new Map<string, Ticket[]>();
  tickets.filter(isUnpaid).forEach((tk) => {
    const k = tk.table ? `table:${tk.table}` : `tk:${tk.id}`;
    groups.set(k, [...(groups.get(k) ?? []), tk]);
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="Open bills">
      {groups.size === 0 && <Txt dim>Every order is paid.</Txt>}
      {[...groups.values()].map((g) => {
        const lines = g.flatMap((x) => x.lines);
        const sum = lines.reduce((a, l) => a + l.qty * l.unitMinor, 0);
        const head = g[0];
        return (
          <Card key={head.id} style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={20} weight="800" mono>{head.table ?? head.token}</Txt>
              <Txt size={18} weight="700" mono>{formatMoney(sum, c)}</Txt>
            </Row>
            <Txt size={13} dim>{g.map((x) => `${x.token} · ${stage(x.steps[x.stage].name)}`).join('  ·  ')}</Txt>
            <Txt size={14} numberOfLines={3}>{lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</Txt>
            <Row>
              {g.length === 1 && <Button kind="ghost" size="sm" label="Cancel order" onPress={() => cancelOrder(head.id, 'Cancelled before payment')} />}
              <Button kind="primary" icon="cash" label="Take payment" onPress={() => onPay({ lines, ticketIds: g.map((x) => x.id), table: head.table, mode: head.mode })} style={{ flex: 1 }} />
            </Row>
          </Card>
        );
      })}
    </Sheet>
  );
}

type Method = 'cash' | 'qr' | 'link' | 'split';
const PART_LABEL: Record<PayPart['method'], string> = { cash: 'Cash', qr: 'QR', link: 'Link' };

export function Checkout({ lines, onClose, ticketIds, table, mode, customerId, rewardMinor = 0, job }: CheckoutReq & { onClose: (done: boolean) => void }) {
  const th = useTheme();
  const { t } = useT();
  const b = useApp((s) => s.business)!;
  const completeSale = useApp((s) => s.completeSale);
  const tickets = useApp((s) => s.tickets);
  const c = countryOf(b.country);
  const m = (n: number) => formatMoney(n, c);
  const [saleId] = useState(newId); // idempotency key fixed for this checkout
  const [method, setMethod] = useState<Method>('cash');
  const [disc, setDisc] = useState('');
  const [tendered, setTendered] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [parts, setParts] = useState<PayPart[]>([]);
  const [partAmt, setPartAmt] = useState('');
  const [partMethod, setPartMethod] = useState<PayPart['method']>('cash');
  const [ways, setWays] = useState(2);
  const [printMsg, setPrintMsg] = useState('');

  const subtotal = lines.reduce((a, l) => a + l.qty * l.unitMinor, 0);
  const discMinor = disc ? parseMoney(disc, c.decimals) : 0;
  const totalDiscount = (discMinor ?? 0) + rewardMinor;
  const discOk = discMinor != null && totalDiscount <= subtotal;
  const { totalMinor, taxMinor } = computeTax(subtotal - (discOk ? totalDiscount : 0), b.tax.enabled ? b.tax.rateBp : 0, b.tax.inclusive);
  const tenderedMinor = tendered ? parseMoney(tendered, c.decimals) : totalMinor;
  const cashOk = tenderedMinor != null && tenderedMinor >= totalMinor;
  const unit = 10 ** c.decimals;
  const quick = Array.from(new Set([totalMinor, ...[1, 5, 10, 50, 100].map((s) => Math.ceil(totalMinor / (s * unit)) * s * unit)])).filter((v) => v >= totalMinor).slice(0, 4);
  const hasQr = !!(b.qrImage || b.qrPayload);
  const usd = b.usd.show ? usdEquivalent(totalMinor, c, b.usd.localPerUsd) : null;
  const linkOk = !!b.payLink && /^https:\/\/\S+$/.test(b.payLink);
  const paidSoFar = parts.reduce((a, p) => a + p.amountMinor, 0);
  const remaining = Math.max(0, totalMinor - paidSoFar);
  const share = Math.ceil(totalMinor / ways);
  const partMinor = partAmt ? parseMoney(partAmt, c.decimals) : Math.min(share, remaining);
  const partOk = partMinor != null && partMinor > 0 && partMinor <= remaining;

  const confirm = async () => {
    const s = completeSale({
      id: saleId,
      lines,
      discountMinor: discOk ? totalDiscount : 0,
      method: method as PaymentMethod,
      tenderedMinor: method === 'cash' ? tenderedMinor ?? totalMinor : undefined,
      parts: method === 'split' ? parts : undefined,
      ticketIds,
      table,
      mode,
      customerId,
      redeem: rewardMinor > 0,
      job,
    });
    setSale(s);
    // Auto-print: receipt, plus a kitchen ticket for pay-first orders that just went on the rail.
    const r = await printSale(s, { auto: true });
    const tk = !ticketIds?.length ? useApp.getState().tickets.find((x) => x.saleId === s.id) : undefined;
    const k = tk ? await printTicket(tk, { auto: true }) : { ok: true as const, printed: [] as string[] };
    const printed = [...r.printed, ...k.printed];
    if (!r.ok || !k.ok) setPrintMsg(`${!r.ok ? r.error : (k as any).error} The sale is saved.`);
    else if (printed.length) setPrintMsg(`Printed on ${printed.join(', ')}.`);
  };
  void tickets;

  const sendLink = async () => {
    const text = `${b.name}: please pay ${m(totalMinor)}${table ? ` (${table})` : ''} here: ${b.payLink}`;
    try {
      await Share.share({ message: text });
    } catch {}
  };

  if (sale)
    return (
      <Sheet visible onClose={() => onClose(true)} title="Sale saved">
        <Note tone="success" text={ticketIds?.length ? `Paid${sale.table ? ` · ${sale.table}` : ` · ${sale.token}`}. The rail is updated.` : sale.token ? `Order ${sale.token} is on the rail.` : 'The sale is saved.'} />
        {!!printMsg && <Note tone={printMsg.startsWith('Printed') ? 'success' : 'warning'} text={printMsg} />}
        <ReceiptView sale={sale} />
        <Button size="lg" label={t('newSale')} onPress={() => onClose(true)} />
      </Sheet>
    );

  const methods: { value: Method; label: string }[] = [
    { value: 'cash', label: t('cash') },
    { value: 'qr', label: t('qr') },
    ...(linkOk ? [{ value: 'link' as Method, label: 'Link' }] : []),
    { value: 'split', label: 'Split' },
  ];

  return (
    <Sheet visible onClose={() => onClose(false)} title={t('charge')}>
      <Card style={{ alignItems: 'center', gap: 2 }}>
        <Txt dim>{t('total')}</Txt>
        {table ? <Txt size={14} weight="600">{table}</Txt> : null}
        <Txt size={40} weight="700" mono>{m(totalMinor)}</Txt>
        {usd && <Txt dim>≈ {usd} (reference)</Txt>}
        {rewardMinor > 0 && <Txt size={13} dim>Reward applied: -{m(rewardMinor)}</Txt>}
        {b.tax.enabled && b.tax.rateBp > 0 && <Txt size={13} dim>{b.tax.name} {pctLabel(b.tax.rateBp)} {b.tax.inclusive ? 'included' : 'added'}: {m(taxMinor)}</Txt>}
      </Card>
      <Field label={`${t('discount')} (${c.currency})`} value={disc} onChange={setDisc} keyboard="decimal-pad" placeholder="0" mono error={!discOk ? 'Discount must be a valid amount not above the subtotal' : undefined} />
      <Segmented value={method} onChange={(v) => { setMethod(v); setParts([]); setPartAmt(''); }} options={methods} />

      {method === 'cash' && (
        <>
          <Row style={{ flexWrap: 'wrap' }} gap={8}>
            {quick.map((v) => (
              <Button key={v} size="sm" kind={tenderedMinor === v ? 'secondary' : 'outline'} label={m(v)} onPress={() => setTendered(String(v / unit))} />
            ))}
          </Row>
          <Field label="Cash received" value={tendered} onChange={setTendered} keyboard="decimal-pad" mono placeholder={String(totalMinor / unit)} error={!cashOk ? 'Less than the total' : undefined} />
          {cashOk && <Txt size={22} weight="700" mono color={th.success}>{t('change')}: {m((tenderedMinor ?? 0) - totalMinor)}</Txt>}
          <Button size="lg" kind="success" label="Cash received · complete" disabled={!cashOk || !discOk} onPress={confirm} />
        </>
      )}

      {method === 'qr' && (
        <>
          {hasQr ? (
            <View style={{ alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 24 }}>
              {b.qrImage ? <Image source={{ uri: b.qrImage }} style={{ width: 240, height: 240 }} resizeMode="contain" accessibilityLabel="Payment QR code" /> : <QRCode value={b.qrPayload} size={220} />}
              <Txt color="#202326" weight="700">{b.qrLabel || b.name}</Txt>
              <Txt color="#202326" size={22} weight="700" mono>{m(totalMinor)}</Txt>
            </View>
          ) : (
            <Note tone="warning" text="No payment QR yet. Add your bank or wallet QR in Settings → Payment QR." />
          )}
          <Note tone="warning" text="Check the amount has arrived in your bank app before confirming. A screenshot from the customer is not proof of payment." />
          <Button size="lg" kind="success" label="It has arrived · confirm" disabled={!discOk} onPress={confirm} />
        </>
      )}

      {method === 'link' && (
        <>
          <Note tone="info" text="Send your payment link with the amount. The sale stays unconfirmed until you see the money arrive." />
          <Button kind="outline" icon="share" label="Send payment link" onPress={sendLink} />
          <Button size="lg" kind="success" label="It has arrived · confirm" disabled={!discOk} onPress={confirm} />
        </>
      )}

      {method === 'split' && (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt weight="600">Split equally</Txt>
            <Row gap={8}>
              <IconButton icon="minus" a11y="Fewer people" onPress={() => setWays(Math.max(2, ways - 1))} />
              <Txt size={18} weight="700" mono style={{ minWidth: 28, textAlign: 'center' }}>{ways}</Txt>
              <IconButton icon="plus" a11y="More people" onPress={() => setWays(Math.min(20, ways + 1))} />
            </Row>
          </Row>
          <Txt dim>Each pays about <Txt weight="700" mono>{m(share)}</Txt></Txt>
          {parts.map((p, i) => (
            <Row key={i} style={{ justifyContent: 'space-between' }}>
              <Txt>{i + 1}. {PART_LABEL[p.method]}</Txt>
              <Row gap={8}>
                <Txt weight="700" mono>{m(p.amountMinor)}</Txt>
                <IconButton icon="close" size={36} a11y="Remove this payment" onPress={() => setParts(parts.filter((_, j) => j !== i))} />
              </Row>
            </Row>
          ))}
          {remaining > 0 ? (
            <>
              <Segmented value={partMethod} onChange={setPartMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'qr', label: 'QR' }, ...(linkOk ? [{ value: 'link' as const, label: 'Link' }] : [])]} />
              <Field label={`Amount · ${m(remaining)} left`} value={partAmt} onChange={setPartAmt} keyboard="decimal-pad" mono placeholder={String(Math.min(share, remaining) / unit)} error={partAmt && !partOk ? 'More than what is left' : undefined} />
              <Button kind="secondary" icon="plus" label={`Add ${partOk ? m(partMinor!) : ''} ${PART_LABEL[partMethod]}`} disabled={!partOk} onPress={() => { setParts([...parts, { method: partMethod, amountMinor: partMinor! }]); setPartAmt(''); }} />
            </>
          ) : (
            <Note tone="success" text="Fully covered. Check any QR or link payments arrived before completing." />
          )}
          <Button size="lg" kind="success" label="Complete split payment" disabled={remaining > 0 || !discOk || !parts.length} onPress={confirm} />
        </>
      )}
    </Sheet>
  );
}
