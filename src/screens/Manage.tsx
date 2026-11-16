// Manage: the business from set-up to the end of each day, in one place.
//   Home      — the daily routine, a set-up checklist and shortcuts to every management task
//   Workflow  — ways of serving, tables, and the steps each order goes through (presets or custom)
//   Day       — open the day with a cash float, close it with a cash count
//   Items     — menu, prices and stock
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, IconName } from '../brand/Icon';
import { FlowEditor, FlowPreview, PresetPicker, Stepper } from '../components/Workflow';
import { Button, Card, Field, H2, Note, Pill, Row, Screen, Segmented, Stat, Tick, Txt, PageHeader, FadeIn } from '../components/ui';
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
  return (
    <FadeIn key={view} style={{ flex: 1 }} distance={6}>
      <ManageView_ view={view} />
    </FadeIn>
  );
}

function ManageView_({ view }: { view: ManageView }) {
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
  const low = s.items.filter((i) => i.active && i.stock != null && i.stock <= (i.lowAt ?? 0)).length + s.ingredients.filter((g) => g.stock <= g.lowAt).length;
  const rewardsReady = s.customers.filter((x) => b.rewards?.enabled && x.stamps >= b.rewards.every).length;
  const f = b.features ?? ALL_FEATURES;
  const todayStart = new Date(new Date().toDateString()).getTime();
  const bookedToday = s.bookings.filter((x) => x.status === 'booked' && x.at >= todayStart && x.at < todayStart + 86_400_000).length;

  // Only the next three things to do — no long checklist.
  const checklist: { label: string; done: boolean; onPress: () => void }[] = [
    { label: 'Add your logo and business name', done: !!b.brandSet, onPress: () => go('settings') },
    { label: 'Check your items and prices', done: s.audit.some((x) => x.action.startsWith('catalog.')) && s.items.length > 0 && s.sales.length > 0, onPress: () => open('items') },
    { label: 'Add your payment QR', done: !!(b.qrImage || b.qrPayload), onPress: () => go('settings') },
    { label: 'Make your first sale', done: s.sales.length > 0, onPress: () => go('sell') },
    { label: 'Set a PIN to lock the app', done: !!s.pin, onPress: () => go('settings') },
    { label: 'Back up your data', done: !!s.settings.lastBackupAt, onPress: () => go('settings') },
  ];
  const next = checklist.filter((x) => !x.done).slice(0, 3);
  const doneCount = checklist.filter((x) => x.done).length;

  const tile = (icon: IconName, title: string, sub: string, onPress: () => void, badge?: { tone: 'warning' | 'pending' | 'info' | 'success'; text: string }) => (
    <Card key={title} onPress={onPress} a11y={`${title}. ${sub}`} style={{ flexBasis: 160, flexGrow: 1, gap: 8, minHeight: 120 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: th.inset }}>
          <Icon name={icon} size={22} color={th.text} />
        </View>
        {badge ? <Pill tone={badge.tone} text={badge.text} /> : null}
      </Row>
      <Txt size={16} weight="800" heading>{title}</Txt>
      <Txt size={13} dim numberOfLines={2}>{sub}</Txt>
    </Card>
  );

  return (
    <Screen>
      <PageHeader kicker={b.name} title="Manage" />

      <Card onPress={() => open('day')} a11y={day ? 'Close the day' : 'Open the day'} style={{ padding: 16 }}>
        <Row gap={12}>
          <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: day ? th.primary : th.inset }}>
            <Icon name={day ? 'moon' : 'sun'} size={24} color={day ? th.onPrimary : th.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="700">{day ? 'Close the day' : 'Open the day'}</Txt>
            <Txt size={13} dim>{day ? 'Count the cash and see the difference.' : 'Start with the cash in the drawer.'}</Txt>
          </View>
          <Icon name="forward" size={20} color={th.textDim} />
        </Row>
      </Card>

      {next.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2 size={18}>Next steps</H2>
            <Txt size={13} dim mono>{doneCount}/{checklist.length}</Txt>
          </Row>
          {next.map((c) => (
            <Pressable key={c.label} accessibilityRole="button" onPress={c.onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1 })}>
              <Tick on={false} />
              <Txt weight="600" style={{ flex: 1 }}>{c.label}</Txt>
              <Icon name="forward" size={18} color={th.textDim} />
            </Pressable>
          ))}
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tile('list', 'Items', `${s.items.length} items`, () => open('items'), low ? { tone: 'warning', text: `${low} low` } : undefined)}
        {b.railEnabled && tile('rail', 'Workflow', b.service.tables.length ? `${b.service.tables.length} tables` : 'Your order steps', () => open('workflow'))}
        {f.bookings && tile('calendar', 'Bookings', bookedToday ? `${bookedToday} today` : 'Appointments & walk-ins', () => open('bookings'), bookedToday ? { tone: 'pending', text: String(bookedToday) } : undefined)}
        {(f.rewards || f.jobs) && tile('star', 'Customers', `${s.customers.length} customers`, () => open('customers'), rewardsReady ? { tone: 'success', text: `${rewardsReady} ready` } : undefined)}
        {f.recipes && tile('box', 'Ingredients', 'Cost per item', () => open('ingredients'))}
        {tile('print', 'Printers', s.printers.length ? s.printers.map((x) => x.name).join(', ') : 'Receipts & tickets', () => open('printers'))}
        {tile('tuning', 'Tools', 'Switch features on or off', () => open('features'))}
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
