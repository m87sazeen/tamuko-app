// Reports for every experience level:
//   Simple   — plain-language story of the day, no jargon (first-time owners)
//   Standard — key numbers, payment mix, best sellers, busy hours, expense categories
//   Advanced — date ranges, tax/net breakdown, daily table, prep times, staff, voids, CSV export, audit log
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import ReceiptView from '../components/ReceiptView';
import Accounting from './Accounting';
import Finance from './Finance';
import { Button, Card, Field, H2, IconButton, Note, Pill, Row, Screen, Segmented, Sheet, Stat, Txt, PageHeader } from '../components/ui';
import { toCsv, saveTextFile } from '../files';
import { useT } from '../i18n';
import { countryOf, formatMoney, parseMoney, usdEquivalent } from '../money';
import { clampText, maskPhone } from '../security';
import { ReportLevel, Sale, todayKey, useApp, paidBy } from '../store';
import { useTheme } from '../theme';

const EXPENSE_CATS = ['Stock / ingredients', 'Rent', 'Wages', 'Utilities', 'Transport', 'Other'];
const DAY = 86_400_000;
const startOfDay = (t: number) => new Date(new Date(t).toDateString()).getTime();

function Bars({ data, fmt }: { data: { label: string; value: number }[]; fmt: (n: number) => string }) {
  const th = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <Txt dim>No data yet.</Txt>;
  return (
    <View style={{ gap: 8 }}>
      {data.map((d) => (
        <View key={d.label} style={{ gap: 2 }} accessible accessibilityLabel={`${d.label}: ${fmt(d.value)}`}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt size={14} numberOfLines={1} style={{ flex: 1 }}>{d.label}</Txt>
            <Txt size={14} weight="700" mono>{fmt(d.value)}</Txt>
          </Row>
          <View style={{ height: 10, backgroundColor: th.inset, borderRadius: 5 }}>
            <View style={{ width: `${(d.value / max) * 100}%`, height: 10, borderRadius: 5, backgroundColor: th.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Reports() {
  const th = useTheme();
  const { t } = useT();
  const b = useApp((s) => s.business)!;
  const allSales = useApp((s) => s.sales);
  const allExp = useApp((s) => s.expenses);
  const tickets = useApp((s) => s.tickets);
  const users = useApp((s) => s.users);
  const audit = useApp((s) => s.audit);
  const level = useApp((s) => s.settings.reportLevel);
  const setSettings = useApp((s) => s.setSettings);
  const addExpense = useApp((s) => s.addExpense);
  const removeExpense = useApp((s) => s.removeExpense);
  const voidSale = useApp((s) => s.voidSale);
  const me = useApp((s) => s.users.find((u) => u.id === s.currentUserId));
  const items = useApp((s) => s.items);
  const ingredients = useApp((s) => s.ingredients);
  const unitCost = (itemId: string) =>
    (items.find((i) => i.id === itemId)?.recipe ?? []).reduce((a, r) => a + r.qty * (ingredients.find((g) => g.id === r.ingredientId)?.costMinor ?? 0), 0);
  const c = countryOf(b.country);
  const m = (n: number) => formatMoney(n, c);

  const [dayOffset, setDayOffset] = useState(0);
  const [range, setRange] = useState<'1' | '7' | '30' | 'all'>('1');
  const [expOpen, setExpOpen] = useState(false);
  const [view, setView] = useState<'sales' | 'finance' | 'accounting'>('finance');
  const [acctStart, setAcctStart] = useState<'settle' | 'tax' | undefined>(undefined);
  const [open, setOpen] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // period (anchored to when the screen opened; re-opening refreshes it)
  const [openedAt] = useState(() => Date.now());
  const [from, to] = (() => {
    if (level !== 'advanced') {
      const s = startOfDay(openedAt) - dayOffset * DAY;
      return [s, s + DAY];
    }
    if (range === 'all') return [0, openedAt + DAY];
    const end = startOfDay(openedAt) + DAY;
    return [end - Number(range) * DAY, end];
  })();

  const sales = allSales.filter((s) => s.createdAt >= from && s.createdAt < to);
  const valid = sales.filter((s) => !s.voided);
  const exps = allExp.filter((e) => e.createdAt >= from && e.createdAt < to);
  const revenue = valid.reduce((a, s) => a + s.totalMinor, 0);
  const tax = valid.reduce((a, s) => a + s.taxMinor, 0);
  const discounts = valid.reduce((a, s) => a + s.discountMinor, 0);
  const net = valid.reduce((a, s) => a + s.totalMinor - s.taxMinor, 0);
  const spent = exps.reduce((a, e) => a + e.amountMinor, 0);
  // Ingredients used (cost of goods) from recipes, priced at today's ingredient costs — an estimate.
  const cogs = valid.reduce((a, s) => a + s.lines.reduce((x, l) => x + l.qty * unitCost(l.itemId), 0), 0);
  const kept = net - spent - cogs;
  const paid = valid.map(paidBy);
  const cash = paid.reduce((a, p) => a + p.cash, 0);
  const qr = paid.reduce((a, p) => a + p.qr, 0);
  const link = paid.reduce((a, p) => a + p.link, 0);
  // Margin per item (price excl. tax vs recipe cost), for items that have a recipe.
  const margins = items
    .filter((i) => i.recipe?.length && i.active)
    .map((i) => {
      const ex = b.tax.enabled && b.tax.inclusive ? Math.round((i.priceMinor * 10000) / (10000 + b.tax.rateBp)) : i.priceMinor;
      const cost = unitCost(i.id);
      return { name: i.name, cost, pct: ex > 0 ? Math.round(((ex - cost) / ex) * 100) : 0 };
    })
    .sort((a, z) => a.pct - z.pct);
  const avg = valid.length ? Math.round(revenue / valid.length) : 0;

  const topItems = (() => {
    const map = new Map<string, { qty: number; value: number }>();
    valid.forEach((s) => s.lines.forEach((l) => {
      const r = map.get(l.name) ?? { qty: 0, value: 0 };
      r.qty += l.qty;
      r.value += l.qty * l.unitMinor;
      map.set(l.name, r);
    }));
    return [...map.entries()].sort((a, z) => z[1].value - a[1].value);
  })();

  const byHour = (() => {
    const h = new Array(24).fill(0);
    valid.forEach((s) => (h[new Date(s.createdAt).getHours()] += s.totalMinor));
    return h.map((v, i) => ({ label: `${String(i).padStart(2, '0')}:00`, value: v })).filter((x) => x.value > 0);
  })();

  const byCat = (() => {
    const map = new Map<string, number>();
    exps.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amountMinor));
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, z) => z.value - a.value);
  })();

  const periodLabel = level !== 'advanced'
    ? dayOffset === 0 ? t('today') : new Date(from).toLocaleDateString(c.locale, { weekday: 'long', day: 'numeric', month: 'short' })
    : range === 'all' ? 'All time' : range === '1' ? t('today') : `Last ${range} days`;

  // advanced extras
  const daily = (() => {
    const map = new Map<string, { n: number; rev: number; tax: number }>();
    valid.forEach((s) => {
      const k = todayKey(s.createdAt);
      const r = map.get(k) ?? { n: 0, rev: 0, tax: 0 };
      r.n++; r.rev += s.totalMinor; r.tax += s.taxMinor;
      map.set(k, r);
    });
    return [...map.entries()].sort((a, z) => z[0].localeCompare(a[0]));
  })();

  const prep = (() => {
    // wait = order taken → work starts; make = work starts → last work step finished.
    const done = tickets.filter((x) => !x.cancelled && x.createdAt >= from && x.createdAt < to && x.stageAt.length >= x.steps.length);
    if (!done.length) return null;
    const firstWork = (x: (typeof done)[number]) => Math.max(1, x.steps.findIndex((s) => s.kind === 'work'));
    const lastWork = (x: (typeof done)[number]) => Math.max(firstWork(x), x.steps.map((s) => s.kind).lastIndexOf('work'));
    const wait = done.reduce((a, x) => a + (x.stageAt[firstWork(x)] - x.stageAt[0]), 0) / done.length;
    const make = done.reduce((a, x) => a + (x.stageAt[lastWork(x)] - x.stageAt[firstWork(x)]), 0) / done.length;
    return { n: done.length, wait: Math.round(wait / 1000), make: Math.round(make / 1000) };
  })();

  const byStaff = (() => {
    const map = new Map<string, number>();
    valid.forEach((s) => {
      const u = users.find((x) => x.id === s.userId);
      const k = u ? u.name || u.email || (u.phone ? maskPhone(u.phone) : 'User') : 'Unknown';
      map.set(k, (map.get(k) ?? 0) + s.totalMinor);
    });
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  })();

  const exportCsv = async () => {
    const rows: (string | number)[][] = [['receipt_no', 'date', 'token', 'item', 'qty', 'unit', 'line_total', 'discount', 'tax_name', 'tax', 'sale_total', 'payment', 'payment_status', 'voided']];
    const f = (n: number) => (n / 10 ** c.decimals).toFixed(c.decimals);
    sales.forEach((s) => s.lines.forEach((l, i) => rows.push([
      s.receiptNo, new Date(s.createdAt).toISOString(), s.token ?? '', l.name, l.qty, f(l.unitMinor), f(l.unitMinor * l.qty),
      i === 0 ? f(s.discountMinor) : '', s.tax?.name ?? '', i === 0 ? f(s.taxMinor) : '', i === 0 ? f(s.totalMinor) : '', s.payment.method, s.payment.status, s.voided ? s.voided.reason : '',
    ])));
    await saveTextFile(`tamuko-sales-${todayKey()}.csv`, toCsv(rows), 'text/csv');
    const er: (string | number)[][] = [['date', 'category', 'note', 'amount']];
    exps.forEach((e) => er.push([new Date(e.createdAt).toISOString(), e.category, e.note, f(e.amountMinor)]));
    await saveTextFile(`tamuko-expenses-${todayKey()}.csv`, toCsv(er), 'text/csv');
  };

  if (view === 'accounting' && me?.role === 'owner')
    return (
      <Screen>
        <Accounting start={acctStart} onBack={() => { setAcctStart(undefined); setView('finance'); }} />
      </Screen>
    );
  if (view === 'finance')
    return (
      <Screen>
        <PageHeader kicker="Finance" title="Money" />
        <Segmented value={view} onChange={setView} options={[{ value: 'finance', label: 'Overview' }, { value: 'sales', label: 'Sales reports' }]} />
        <Finance onAccounting={(st) => { setAcctStart(st); setView('accounting'); }} onExpenses={() => { setView('sales'); setExpOpen(true); }} />
      </Screen>
    );

  return (
    <Screen>
      <Segmented value={view} onChange={setView} options={[{ value: 'finance', label: 'Overview' }, { value: 'sales', label: 'Sales reports' }]} />
      <PageHeader kicker="Finance" title={t('reports')} action={<Button size="sm" kind="secondary" icon="plus" label={t('expenses')} onPress={() => setExpOpen(true)} />} />
      <Segmented<ReportLevel>
        value={level}
        onChange={(v) => setSettings({ reportLevel: v })}
        options={[{ value: 'simple', label: 'Simple' }, { value: 'standard', label: 'Standard' }, { value: 'advanced', label: 'Advanced' }]}
      />

      {level !== 'advanced' ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton icon="back" a11y="Previous day" onPress={() => setDayOffset(dayOffset + 1)} />
          <Txt weight="700">{periodLabel}</Txt>
          {dayOffset > 0 ? <IconButton icon="forward" a11y="Next day" onPress={() => setDayOffset(dayOffset - 1)} /> : <View style={{ width: 44 }} />}
        </Row>
      ) : (
        <Segmented value={range} onChange={setRange} options={[{ value: '1', label: t('today') }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: 'all', label: 'All' }]} />
      )}

      {/* ---------------- SIMPLE ---------------- */}
      {level === 'simple' && (
        <>
          <Card style={{ gap: 10 }}>
            <Txt size={15} dim>{periodLabel}</Txt>
            <Txt size={22} weight="700">
              You sold <Txt size={22} weight="800" color={th.success}>{m(revenue)}</Txt> in {valid.length} {valid.length === 1 ? 'sale' : 'sales'}.
            </Txt>
            <Txt size={20}>You spent <Txt size={20} weight="800" color={th.error}>{m(spent)}</Txt> on costs.</Txt>
            {cogs > 0 && <Txt size={18}>Ingredients used cost about <Txt size={18} weight="800" color={th.error}>{m(cogs)}</Txt>.</Txt>}
            {tax > 0 && <Txt size={16} dim>{m(tax)} of your sales is {b.tax.name} — that money belongs to the government, not you.</Txt>}
            <View style={{ height: 1, backgroundColor: th.border }} />
            <Txt size={24} weight="800">
              {kept >= 0 ? 'You kept about ' : 'You are short by about '}
              <Txt size={24} weight="800" color={kept >= 0 ? th.success : th.error}>{m(Math.abs(kept))}</Txt>
            </Txt>
            {b.usd.show && b.usd.localPerUsd > 0 && <Txt dim>≈ {usdEquivalent(revenue, c, b.usd.localPerUsd)} in sales</Txt>}
          </Card>
          <Row style={{ flexWrap: 'wrap' }}>
            <Stat icon="cash" label={`${t('cash')} in drawer`} value={m(cash)} sub="Count your cash. It should match this." />
            <Stat icon="qr" label={t('qr')} value={m(qr + link)} sub="Check the amount has arrived in your bank app." />
          </Row>
          {topItems[0] && <Note tone="info" text={`Your best seller is ${topItems[0][0]} (${topItems[0][1].qty} sold). Keep it in stock.`} />}
          {spent === 0 && valid.length > 0 && <Note tone="warning" text="Add what you spent today (stock, rent, wages) so this number is right." />}
        </>
      )}

      {/* ---------------- STANDARD + ADVANCED ---------------- */}
      {level !== 'simple' && (
        <>
          <Row style={{ flexWrap: 'wrap' }}>
            <Stat label={t('sales')} value={m(revenue)} sub={`${valid.length} receipts`} />
            <Stat label="Average sale" value={m(avg)} />
            <Stat label={t('expenses')} value={m(spent)} tone="error" />
            {cogs > 0 && <Stat label="Ingredients used" value={m(cogs)} tone="error" sub="At today’s ingredient costs" />}
            <Stat label="Business surplus (estimate)" value={m(kept)} tone={kept >= 0 ? 'success' : 'error'} />
          </Row>
          <Card style={{ gap: 12 }}>
            <H2>Payment mix</H2>
            <Bars data={[{ label: `${t('cash')}`, value: cash }, { label: `${t('qr')} (operator-verified)`, value: qr }, ...(link ? [{ label: 'Payment link (operator-verified)', value: link }] : [])]} fmt={m} />
          </Card>
          {margins.length > 0 && (
            <Card style={{ gap: 10 }}>
              <H2>Margin per item</H2>
              {margins.map((x) => (
                <Row key={x.name} style={{ justifyContent: 'space-between' }}>
                  <Txt style={{ flex: 1 }} numberOfLines={1}>{x.name}</Txt>
                  <Txt size={13} dim mono>cost {m(x.cost)}</Txt>
                  <Pill tone={x.pct < 30 ? 'warning' : 'success'} text={`${x.pct}%`} />
                </Row>
              ))}
              <Txt size={12} dim>Price excluding tax minus recipe cost. Ingredient prices went up? Margins update — past receipts stay as they were.</Txt>
            </Card>
          )}
          <Card style={{ gap: 12 }}>
            <H2>Best sellers</H2>
            <Bars data={topItems.slice(0, level === 'advanced' ? 15 : 5).map(([label, r]) => ({ label: `${label} ×${r.qty}`, value: r.value }))} fmt={m} />
          </Card>
          <Card style={{ gap: 12 }}>
            <H2>Busy hours</H2>
            <Bars data={byHour} fmt={m} />
          </Card>
          <Card style={{ gap: 12 }}>
            <H2>{t('expenses')} by type</H2>
            <Bars data={byCat} fmt={m} />
          </Card>
        </>
      )}

      {/* ---------------- ADVANCED ONLY ---------------- */}
      {level === 'advanced' && (
        <>
          <Card style={{ gap: 8 }}>
            <H2>Tax & adjustments</H2>
            {[
              ['Gross sales (incl. tax)', revenue],
              [`${b.tax.name} collected`, tax],
              ['Net sales (excl. tax)', net],
              ['Discounts given', discounts],
              ['Voided receipts', sales.filter((s) => s.voided).reduce((a, s) => a + s.totalMinor, 0)],
            ].map(([l, v]) => (
              <Row key={l as string} style={{ justifyContent: 'space-between' }}>
                <Txt>{l}</Txt>
                <Txt weight="700" mono>{m(v as number)}</Txt>
              </Row>
            ))}
            <Txt size={12} dim>Estimates from recorded sales. Not a tax return — confirm with your accountant.</Txt>
          </Card>
          <Card style={{ gap: 8 }}>
            <H2>Daily breakdown</H2>
            {daily.length === 0 && <Txt dim>No sales in this period.</Txt>}
            {daily.map(([d, r]) => (
              <Row key={d} style={{ justifyContent: 'space-between' }}>
                <Txt mono>{d}</Txt>
                <Txt dim>{r.n} sales</Txt>
                <Txt weight="700" mono>{m(r.rev)}</Txt>
              </Row>
            ))}
          </Card>
          {prep && (
            <Card style={{ gap: 6 }}>
              <H2>Speed of service</H2>
              <Txt>Average wait before start: <Txt weight="800">{Math.floor(prep.wait / 60)}m {prep.wait % 60}s</Txt></Txt>
              <Txt>Average preparation: <Txt weight="800">{Math.floor(prep.make / 60)}m {prep.make % 60}s</Txt></Txt>
              <Txt size={12} dim>Based on {prep.n} orders that reached Ready.</Txt>
            </Card>
          )}
          <Card style={{ gap: 12 }}>
            <H2>Sales by staff</H2>
            <Bars data={byStaff} fmt={m} />
          </Card>
          <Button kind="secondary" icon="download" label="Export sales & expenses (CSV)" onPress={exportCsv} />
          <Card style={{ gap: 6 }}>
            <H2>Audit log (latest 30)</H2>
            {audit.slice(0, 30).map((a) => (
              <Txt key={a.id} size={12} mono dim>{new Date(a.at).toLocaleString(c.locale)} · {a.action} {a.detail}</Txt>
            ))}
          </Card>
        </>
      )}

      {/* receipts list — all levels */}
      <Card style={{ gap: 10 }}>
        <H2>Receipts</H2>
        {sales.length === 0 && <Txt dim>No sales in this period.</Txt>}
        {sales.slice(0, 50).map((s) => (
          <Pressable key={s.id} accessibilityRole="button" onPress={() => { setOpen(s); setVoidReason(''); }} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderBottomWidth: 1, borderColor: th.border }}>
            <View>
              <Txt weight="600">{s.token ? `#${s.token} · ` : ''}{new Date(s.createdAt).toLocaleTimeString(c.locale, { hour: '2-digit', minute: '2-digit' })}</Txt>
              <Txt size={12} dim>{s.receiptNo}</Txt>
            </View>
            <Row gap={8}>
              {s.voided ? <Pill tone="error" text="Void" /> : s.payment.method === 'cash' ? <Pill tone="success" text={t('cash')} /> : <Pill tone="warning" text={s.payment.method === 'qr' ? 'QR' : s.payment.method === 'link' ? 'Link' : 'Split'} />}
              <Txt weight="800" mono style={{ textDecorationLine: s.voided ? 'line-through' : 'none' }}>{m(s.totalMinor)}</Txt>
            </Row>
          </Pressable>
        ))}
      </Card>

      {exps.length > 0 && (
        <Card style={{ gap: 10 }}>
          <H2>{t('expenses')}</H2>
          {exps.map((e) => (
            <Row key={e.id} style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt weight="600">{e.category}</Txt>
                {!!e.note && <Txt size={12} dim>{e.note}</Txt>}
              </View>
              <Txt weight="700" mono>{m(e.amountMinor)}</Txt>
              <IconButton icon="close" a11y={`Delete expense ${e.category}`} onPress={() => removeExpense(e.id)} />
            </Row>
          ))}
        </Card>
      )}

      <ExpenseSheet visible={expOpen} onClose={() => setExpOpen(false)} onSave={(a, cat, note) => { addExpense(a, cat, note); setExpOpen(false); }} decimals={c.decimals} currency={c.currency} />

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={t('receipt')}>
        {open && (
          <>
            <ReceiptView sale={open} copy />
            {!open.voided && me?.role === 'owner' && (
              <Card style={{ gap: 8 }}>
                <Txt weight="700">Void this sale</Txt>
                <Field label="Reason (required)" value={voidReason} onChange={setVoidReason} maxLength={80} />
                <Button kind="danger" label="Void sale" disabled={voidReason.trim().length < 3} onPress={() => { voidSale(open.id, clampText(voidReason)); setOpen(null); }} />
                <Txt size={12} dim>Voids are kept in history and the audit log; the receipt is never deleted.</Txt>
              </Card>
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function ExpenseSheet({ visible, onClose, onSave, decimals, currency }: { visible: boolean; onClose: () => void; onSave: (a: number, c: string, n: string) => void; decimals: number; currency: string }) {
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [note, setNote] = useState('');
  const v = parseMoney(amt, decimals);
  return (
    <Sheet visible={visible} onClose={onClose} title="Add expense">
      <Field label={`Amount (${currency})`} value={amt} onChange={setAmt} keyboard="decimal-pad" autoFocus error={amt && v == null ? 'Invalid amount' : undefined} />
      <Row style={{ flexWrap: 'wrap' }} gap={8}>
        {EXPENSE_CATS.map((x) => <Button key={x} size="sm" kind={x === cat ? 'primary' : 'outline'} label={x} onPress={() => setCat(x)} />)}
      </Row>
      <Field label="Note (optional)" value={note} onChange={setNote} maxLength={80} />
      <Button size="lg" label="Save" disabled={!v} onPress={() => { onSave(v!, cat, clampText(note)); setAmt(''); setNote(''); }} />
    </Sheet>
  );
}
