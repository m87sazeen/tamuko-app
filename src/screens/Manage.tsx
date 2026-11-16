// Manage: the business from set-up to the end of each day, in one place.
//   Home      — the daily routine, a set-up checklist and shortcuts to every management task
//   Workflow  — ways of serving, tables, and the steps each order goes through (presets or custom)
//   Day       — open the day with a cash float, close it with a cash count
//   Items     — menu, prices and stock
import React, { useState } from 'react';
import { View } from 'react-native';
import { Icon, IconName } from '../brand/Icon';
import { FlowEditor, FlowPreview, PresetPicker, Stepper } from '../components/Workflow';
import { Button, Card, Eyebrow, Field, H2, Note, Pill, Row, Screen, Segmented, Stat, Tick, Txt, PageHeader } from '../components/ui';
import { countryOf, formatMoney, parseMoney } from '../money';
import { ManageView, useNav } from '../nav';
import { isOpen, isUnpaid, paidBy, useApp } from '../store';
import { useTheme } from '../theme';
import { MODE_LABEL, PRESETS_FOR, ServiceMode, Step, activeModes, clone, modeLabel, tableNames } from '../workflow';
import Items from './Items';
import Printers from './Printers';
import Ingredients from './Ingredients';
import Customers from './Customers';
import Bookings from './Bookings';
import { ALL_FEATURES, FEATURE_INFO, Features, typeById } from '../catalogue';

export default function Manage() {
  const view = useNav((s) => s.view);
  const go = useNav((s) => s.go);
  const open = (v: ManageView) => go('manage', v);
  if (view === 'workflow') return <WorkflowPage onBack={() => open('home')} />;
  if (view === 'day') return <DayPage onBack={() => open('home')} />;
  if (view === 'items') return <Items onBack={() => open('home')} />;
  if (view === 'printers') return <Printers onBack={() => open('home')} />;
  if (view === 'ingredients') return <Ingredients onBack={() => open('home')} />;
  if (view === 'customers') return <Customers onBack={() => open('home')} />;
  if (view === 'bookings') return <Bookings onBack={() => open('home')} />;
  if (view === 'features') return <FeaturesPage onBack={() => open('home')} />;
  return <Home open={open} />;
}

function Back({ onBack, title, kicker }: { onBack: () => void; title: string; kicker: string }) {
  return <PageHeader kicker={kicker} title={title} onBack={onBack} />;
}

/** Today's open day, if any. */
function useOpenDay() {
  return useApp((s) => s.days.find((d) => !d.closedAt) ?? null);
}

function Home({ open }: { open: (v: ManageView) => void }) {
  const th = useTheme();
  const go = useNav((s) => s.go);
  const s = useApp();
  const b = s.business!;
  const day = useOpenDay();
  const unpaid = s.tickets.filter(isUnpaid).length;
  const onRail = s.tickets.filter(isOpen).length;
  const low = s.items.filter((i) => i.active && i.stock != null && i.stock <= (i.lowAt ?? 0)).length + s.ingredients.filter((g) => g.stock <= g.lowAt).length;
  const today = new Date().toDateString();
  const soldToday = s.sales.some((x) => new Date(x.createdAt).toDateString() === today);
  const rewardsReady = s.customers.filter((x) => b.rewards?.enabled && x.stamps >= b.rewards.every).length;
  const f = b.features ?? ALL_FEATURES;
  const todayStart = new Date(new Date().toDateString()).getTime();
  const bookedToday = s.bookings.filter((x) => x.status === 'booked' && x.at >= todayStart && x.at < todayStart + 86_400_000).length;

  // The business journey, start to finish. Each step links to where it happens.
  const routine: { icon: IconName; label: string; done: boolean; onPress: () => void }[] = [
    { icon: 'sun', label: 'Open the day', done: !!day, onPress: () => open('day') },
    { icon: 'bag', label: 'Take orders', done: soldToday, onPress: () => go('sell') },
    ...(b.railEnabled ? [{ icon: 'rail' as IconName, label: 'Prepare & hand over', done: soldToday && onRail === 0, onPress: () => go('rail') }] : []),
    { icon: 'cash', label: 'Get paid', done: soldToday && unpaid === 0, onPress: () => go('sell') },
    { icon: 'moon', label: 'Close the day', done: false, onPress: () => open('day') },
    { icon: 'chart', label: 'Review', done: false, onPress: () => go('reports') },
  ];

  const checklist: { label: string; done: boolean; onPress: () => void }[] = [
    { label: 'Business name and country', done: !!b.name, onPress: () => go('settings') },
    { label: 'Check your workflow and tables', done: !b.railEnabled || s.audit.some((a) => a.action === 'workflow.update'), onPress: () => open('workflow') },
    { label: 'At least 3 items with prices', done: s.items.length >= 3, onPress: () => open('items') },
    { label: 'Logo on receipts', done: !!b.logo, onPress: () => go('settings') },
    { label: 'Payment QR', done: !!(b.qrImage || b.qrPayload), onPress: () => go('settings') },
    { label: `${b.tax.name || 'Tax'} registration number`, done: !b.tax.enabled || !!b.tax.registrationNo, onPress: () => go('settings') },
    { label: 'Device PIN', done: !!s.pin, onPress: () => go('settings') },
    { label: 'Connect a receipt printer (optional)', done: s.printers.length > 0, onPress: () => open('printers') },
    { label: 'First sale', done: s.sales.length > 0, onPress: () => go('sell') },
    { label: 'First backup', done: !!s.settings.lastBackupAt, onPress: () => go('settings') },
  ];
  const doneCount = checklist.filter((x) => x.done).length;

  const tile = (icon: IconName, title: string, sub: string, onPress: () => void, badge?: { tone: 'warning' | 'pending' | 'info' | 'success'; text: string }) => (
    <Card key={title} onPress={onPress} a11y={`${title}. ${sub}`} style={{ flexBasis: 240, flexGrow: 1, gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Icon name={icon} size={24} color={th.text} />
        {badge ? <Pill tone={badge.tone} text={badge.text} /> : null}
      </Row>
      <Txt size={17} weight="800" heading>{title}</Txt>
      <Txt size={14} dim>{sub}</Txt>
    </Card>
  );

  return (
    <Screen>
      <PageHeader kicker={b.name} title="Manage" />

      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2 size={18}>Your day</H2>
          <Eyebrow live={!!day} text={day ? 'Day open' : 'Day not open'} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {routine.map((r, i) => (
            <Button key={r.label} size="sm" kind={r.done ? 'secondary' : 'outline'} icon={r.done ? 'check' : r.icon} label={`${i + 1}. ${r.label}`} onPress={r.onPress} />
          ))}
        </View>
      </Card>

      {doneCount < checklist.length && (
        <Card style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 size={18}>Getting started</H2>
            <Txt mono weight="700">{doneCount}/{checklist.length}</Txt>
          </Row>
          <View style={{ height: 8, borderRadius: 99, backgroundColor: th.inset }}>
            <View style={{ width: `${(doneCount / checklist.length) * 100}%`, height: 8, borderRadius: 99, backgroundColor: th.primary }} />
          </View>
          {checklist.map((c) => (
            <Card key={c.label} onPress={c.onPress} a11y={`${c.label}${c.done ? ', done' : ''}`} style={{ padding: 14, borderRadius: 14, backgroundColor: th.surface, boxShadow: 'none', shadowOpacity: 0, elevation: 0 } as any}>
              <Row gap={10}>
                <Tick on={c.done} />
                <Txt style={{ flex: 1 }} weight={c.done ? '400' : '600'} dim={c.done}>{c.label}</Txt>
                <Icon name="forward" size={18} color={th.textDim} />
              </Row>
            </Card>
          ))}
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tile('sun', day ? 'Close the day' : 'Open the day', day ? 'Count the cash and see the difference.' : 'Start with the cash in the drawer.', () => open('day'), day ? { tone: 'success', text: 'Open' } : undefined)}
        {b.railEnabled && tile('rail', 'Workflow', activeModes(b.service).map((m) => modeLabel(m, b.template)).join(' · ') + (b.service.tables.length ? ` · ${b.service.tables.length} tables` : ''), () => open('workflow'))}
        {tile('list', 'Items & stock', `${s.items.length} items · options, recipes, stock`, () => open('items'), low ? { tone: 'warning', text: `${low} low` } : undefined)}
        {f.bookings && tile('calendar', 'Bookings & queue', bookedToday ? `${bookedToday} booked today` : 'Appointments, classes and walk-ins.', () => open('bookings'), bookedToday ? { tone: 'pending', text: String(bookedToday) } : undefined)}
        {f.recipes && tile('box', 'Ingredients', s.ingredients.length ? `${s.ingredients.length} ingredients · real cost per item` : 'Track ingredients and food cost.', () => open('ingredients'))}
        {(f.rewards || f.jobs) && tile('star', 'Customers & rewards', b.rewards?.enabled ? `Stamp card on · ${s.customers.length} customers` : '“Buy 10, get 1 free” in plain words.', () => open('customers'), rewardsReady ? { tone: 'success', text: `${rewardsReady} ready` } : undefined)}
        {tile('print', 'Printers', s.printers.length ? s.printers.map((x) => x.name).join(', ') : 'Bluetooth, Wi-Fi or AirPrint receipts and kitchen tickets.', () => open('printers'))}
        {tile('receipt', 'Open bills', unpaid ? 'Orders waiting for payment.' : 'Everything is paid.', () => go('sell'), unpaid ? { tone: 'pending', text: String(unpaid) } : undefined)}
        {tile('cash', 'Expenses', 'Log rent, stock and wages to see real profit.', () => go('reports'))}
        {tile('tuning', 'Business type & tools', `${typeById(b.typeId ?? '')?.label ?? 'Your business'} · switch tools on or off`, () => open('features'))}
        {tile('settings', 'Branding & payments', 'Logo, payment QR, tax, USD for tourists.', () => go('settings'))}
        {tile('users', 'Team', 'Staff logins and roles arrive with cloud sync.', () => {}, { tone: 'info', text: 'Soon' })}
        {tile('globe', 'Branches & online orders', 'Multi-branch, suppliers and QR ordering arrive with cloud sync.', () => {}, { tone: 'info', text: 'Soon' })}
      </View>
    </Screen>
  );
}

function WorkflowPage({ onBack }: { onBack: () => void }) {
  const b = useApp((s) => s.business)!;
  const setService = useApp((s) => s.setService);
  const updateBusiness = useApp((s) => s.updateBusiness);
  const sv = b.service;
  const [editing, setEditing] = useState<ServiceMode | null>(null);
  const [tableName, setTableName] = useState('');
  const canDine = PRESETS_FOR[b.template].dinein.length > 0;
  const modes = activeModes(sv);

  const toggleMode = (m: ServiceMode) => {
    const on = sv.modes.includes(m);
    const next = on ? sv.modes.filter((x) => x !== m) : [...sv.modes, m];
    if (!next.length) return;
    setService({ modes: next, defaultMode: next.includes(sv.defaultMode) ? sv.defaultMode : next[0], tables: m === 'dinein' && !on && !sv.tables.length ? tableNames(6) : sv.tables });
  };
  const setFlow = (m: ServiceMode, steps: Step[], presetId: string) => setService({ flows: { ...sv.flows, [m]: steps }, presetIds: { ...sv.presetIds, [m]: presetId } });

  if (editing)
    return (
      <Screen style={{ maxWidth: 640 }}>
        <Back onBack={() => setEditing(null)} kicker="Custom workflow" title={modeLabel(editing, b.template)} />
        <FlowEditor steps={sv.flows[editing]} onCancel={() => setEditing(null)} onSave={(steps) => { setFlow(editing, steps, 'custom'); setEditing(null); }} />
      </Screen>
    );

  return (
    <Screen style={{ maxWidth: 720 }}>
      <Back onBack={onBack} kicker="Manage" title="Workflow" />
      {!b.railEnabled && <Note tone="info" text="The order rail is off, so sales finish at the till. Turn it on to track orders step by step." />}
      <Card style={{ gap: 12 }}>
        <H2 size={18}>Order rail</H2>
        <Segmented value={b.railEnabled ? 'on' : 'off'} onChange={(v) => updateBusiness({ railEnabled: v === 'on' })} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        <Txt size={13} dim>{b.railEnabled ? 'Every order gets a token and a ticket that moves through your steps.' : 'Sales finish at the till. Good for shops that hand items over straight away.'}</Txt>
      </Card>

      {b.railEnabled && canDine && (
        <Card style={{ gap: 12 }}>
          <H2 size={18}>How you serve</H2>
          <Row gap={8}>
            {(['takeaway', 'dinein'] as ServiceMode[]).map((m) => (
              <Button key={m} kind={sv.modes.includes(m) ? 'secondary' : 'outline'} icon={m === 'dinein' ? 'table' : 'bag'} label={MODE_LABEL[m]} onPress={() => toggleMode(m)} style={{ flex: 1 }} />
            ))}
          </Row>
          {modes.length > 1 && (
            <>
              <Txt size={14} weight="600">The till starts on</Txt>
              <Segmented value={sv.defaultMode} onChange={(v) => setService({ defaultMode: v })} options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
            </>
          )}
        </Card>
      )}

      {b.railEnabled && sv.modes.includes('dinein') && (
        <Card style={{ gap: 12 }}>
          <H2 size={18}>Tables</H2>
          {!sv.tables.length && <Note tone="info" text="No tables, so every order is take away. Add tables to offer dine in." />}
          <Stepper label="Number of tables" value={sv.tables.length} max={100} onChange={(n) => setService({ tables: resizeTables(sv.tables, n) })} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sv.tables.map((tb) => (
              <Button key={tb} size="sm" kind="outline" icon="close" label={tb} a11y={`Remove table ${tb}`} onPress={() => setService({ tables: sv.tables.filter((x) => x !== tb) })} />
            ))}
          </View>
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field label="Add a named table" value={tableName} onChange={setTableName} placeholder="e.g. Terrace 1" maxLength={16} />
            </View>
            <Button icon="plus" label="Add" disabled={!tableName.trim() || sv.tables.includes(tableName.trim())} onPress={() => { setService({ tables: [...sv.tables, tableName.trim()] }); setTableName(''); }} />
          </Row>
        </Card>
      )}

      {b.railEnabled &&
        modes.map((m) => (
          <Card key={m} style={{ gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2 size={18}>{modeLabel(m, b.template)} steps</H2>
              {sv.presetIds[m] === 'custom' && <Pill tone="info" text="Custom" />}
            </Row>
            <FlowPreview steps={sv.flows[m]} />
            <PresetPicker tpl={b.template} mode={m} value={sv.presetIds[m]} onPick={(p) => setFlow(m, clone(p.steps), p.id)} />
            <Button kind="outline" icon="edit" label="Customise steps" onPress={() => setEditing(m)} />
          </Card>
        ))}
    </Screen>
  );
}

/** Grow with the next free T-numbers, or drop tables from the end. */
function resizeTables(list: string[], n: number) {
  if (n <= list.length) return list.slice(0, n);
  const out = [...list];
  for (let i = 1; out.length < n; i++) if (!out.includes(`T${i}`)) out.push(`T${i}`);
  return out;
}

function DayPage({ onBack }: { onBack: () => void }) {
  const th = useTheme();
  const b = useApp((s) => s.business)!;
  const sales = useApp((s) => s.sales);
  const expenses = useApp((s) => s.expenses);
  const tickets = useApp((s) => s.tickets);
  const days = useApp((s) => s.days);
  const openDay = useApp((s) => s.openDay);
  const closeDay = useApp((s) => s.closeDay);
  const c = countryOf(b.country);
  const m = (n: number) => formatMoney(n, c);
  const day = days.find((d) => !d.closedAt) ?? null;
  const [float, setFloat] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [fromTill, setFromTill] = useState<'yes' | 'no'>('yes');

  const floatMinor = float ? parseMoney(float, c.decimals) : 0;
  const since = day?.openedAt ?? 0;
  const daySales = sales.filter((x) => !x.voided && x.createdAt >= since);
  const cash = daySales.reduce((a, x) => a + paidBy(x).cash, 0);
  const qr = daySales.reduce((a, x) => a + paidBy(x).qr + paidBy(x).link, 0);
  const spent = expenses.filter((e) => e.createdAt >= since).reduce((a, e) => a + e.amountMinor, 0);
  const expected = (day?.floatMinor ?? 0) + cash - (fromTill === 'yes' ? spent : 0);
  const countedMinor = counted ? parseMoney(counted, c.decimals) : null;
  const diff = countedMinor != null ? countedMinor - expected : null;
  const unpaid = tickets.filter(isUnpaid).length;
  const onRail = tickets.filter(isOpen).length;
  const history = days.filter((d) => d.closedAt).slice(0, 7);

  return (
    <Screen style={{ maxWidth: 640 }}>
      <Back onBack={onBack} kicker="Daily routine" title={day ? 'Close the day' : 'Open the day'} />
      {!day ? (
        <Card style={{ gap: 12 }}>
          <Txt>Count the cash in the drawer before the first sale. This is your opening float.</Txt>
          <Field label={`Opening cash (${c.currency})`} value={float} onChange={setFloat} keyboard="decimal-pad" mono placeholder="0" error={float && floatMinor == null ? 'Invalid amount' : undefined} />
          <Button size="lg" icon="sun" label="Open the day" disabled={floatMinor == null} onPress={() => { openDay(floatMinor ?? 0); setFloat(''); }} />
        </Card>
      ) : (
        <>
          <Txt dim>Opened {new Date(day.openedAt).toLocaleString()} with {m(day.floatMinor)}.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Stat icon="cash" label="Cash sales" value={m(cash)} sub={`${daySales.filter((x) => paidBy(x).cash > 0).length} sales`} />
            <Stat icon="qr" label="QR & links (checked by staff)" value={m(qr)} />
            <Stat icon="receipt" label="Expenses" value={m(spent)} />
          </View>
          {unpaid > 0 && <Note tone="warning" text={`${unpaid} order${unpaid > 1 ? 's are' : ' is'} not paid yet. Take payment or cancel ${unpaid > 1 ? 'them' : 'it'} before closing.`} />}
          {unpaid === 0 && onRail > 0 && <Note tone="info" text={`${onRail} paid order${onRail > 1 ? 's are' : ' is'} still on the rail.`} />}
          <Card style={{ gap: 12 }}>
            <Txt size={14} weight="600">Were today’s expenses paid from the till?</Txt>
            <Segmented value={fromTill} onChange={setFromTill} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt weight="600">Cash that should be in the drawer</Txt>
              <Txt size={18} weight="700" mono>{m(expected)}</Txt>
            </Row>
            <Field label={`Cash you counted (${c.currency})`} value={counted} onChange={setCounted} keyboard="decimal-pad" mono error={counted && countedMinor == null ? 'Invalid amount' : undefined} />
            {diff != null && (
              <Note tone={diff === 0 ? 'success' : 'warning'} text={diff === 0 ? 'The drawer matches.' : diff > 0 ? `${m(diff)} more than expected.` : `${m(-diff)} short.`} />
            )}
            <Field label="Note (optional)" value={note} onChange={setNote} maxLength={140} placeholder="e.g. paid the gas delivery in cash" />
            <Button size="lg" icon="moon" label="Close the day" disabled={countedMinor == null || unpaid > 0} onPress={() => { closeDay(countedMinor!, expected, note.trim()); setCounted(''); setNote(''); }} />
          </Card>
        </>
      )}

      {history.length > 0 && (
        <Card style={{ gap: 8 }}>
          <H2 size={18}>Recent days</H2>
          {history.map((d) => {
            const dd = (d.countedMinor ?? 0) - (d.expectedMinor ?? 0);
            return (
              <Row key={d.id} style={{ justifyContent: 'space-between' }}>
                <Txt>{new Date(d.openedAt).toLocaleDateString()}</Txt>
                <Txt mono weight="700" color={dd === 0 ? th.success : th.warning}>{dd === 0 ? 'matched' : `${dd > 0 ? '+' : '−'}${m(Math.abs(dd))}`}</Txt>
              </Row>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

function FeaturesPage({ onBack }: { onBack: () => void }) {
  const b = useApp((s) => s.business)!;
  const setFeatures = useApp((s) => s.setFeatures);
  const f = b.features ?? ALL_FEATURES;
  const t = typeById(b.typeId ?? '');
  return (
    <Screen style={{ maxWidth: 640 }}>
      <PageHeader kicker={t?.label ?? 'Your business'} title="Business type & tools" onBack={onBack} sub="Switch on only what you use — the till and Manage stay simple. Your data is kept when a tool is off." />
      {(Object.keys(FEATURE_INFO) as (keyof Features)[]).map((k) => (
        <Card key={k} onPress={() => setFeatures({ [k]: !f[k] })} a11y={`${FEATURE_INFO[k].label}${f[k] ? ', on' : ', off'}`} style={{ padding: 16 }}>
          <Row gap={12}>
            <Tick on={f[k]} />
            <View style={{ flex: 1 }}>
              <Txt weight="700">{FEATURE_INFO[k].label}</Txt>
              <Txt size={13} dim>{FEATURE_INFO[k].hint}</Txt>
            </View>
          </Row>
        </Card>
      ))}
      {f.tables && !b.service.tables.length && <Note tone="info" text="Tables are on but none are set up yet. Add them in Manage → Workflow." />}
    </Screen>
  );
}
