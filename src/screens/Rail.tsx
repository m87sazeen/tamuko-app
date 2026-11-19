// Tamuko Flow — animated work-ticket rail (KAV-RAIL-001/004/009).
// Brand §07: paper tickets with a metal clip and torn edge hang from a brushed-metal rail.
// Timers derive from persisted timestamps; reduced motion is honoured.
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutAnimation, Modal, Platform, ScrollView, UIManager, useWindowDimensions, View } from 'react-native';
import { printTicket } from '../print';
import { Icon } from '../brand/Icon';
import { Button, IconButton, MetalRail, Note, Paper, Pill, Row, Txt, PageHeader } from '../components/ui';
import { useT } from '../i18n';
import { CHANNELS, openShare } from '../integrations';
import { maskPhone } from '../security';
import { Ticket, isOpen, isUnpaid, useApp } from '../store';
import { activeModes, doneIndex, laneNames, modeLabel } from '../workflow';
import { Checkout } from './Sell';
import { useTheme } from '../theme';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

const LATE_MS = 10 * 60_000;
const INK = '#141F38';
const LATE = '#A63838';

function useReduceMotion() {
  const pref = useApp((s) => s.settings.reduceMotion);
  const [os, setOs] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOs).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOs);
    return () => sub.remove();
  }, []);
  return pref || os;
}

const lastWorkIndex = (t: Ticket) => t.steps.map((x) => x.kind).lastIndexOf('work');

const elapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function TicketCard({ tk, now, reduce, onPay, onPrint }: { tk: Ticket; now: number; reduce: boolean; onPay: (tk: Ticket) => void; onPrint?: (tk: Ticket) => void }) {
  const { stage } = useT();
  const b = useApp((s) => s.business)!;
  const advance = useApp((s) => s.advanceTicket);
  const recall = useApp((s) => s.recallTicket);
  const [enter] = useState(() => new Animated.Value(reduce ? 1 : 0));

  useEffect(() => {
    if (!reduce) Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const total = now - tk.createdAt;
  const nextStep = tk.steps[tk.stage + 1];
  const cur = tk.steps[tk.stage];
  const unpaid = isUnpaid(tk);
  const needsPay = nextStep?.kind === 'pay' && unpaid;
  // Late = still being worked on after 10 minutes (waiting to pay or collect is not "late").
  const lastWork = tk.steps.map((x) => x.kind).lastIndexOf('work');
  const late = tk.stage < lastWork && total > LATE_MS;
  const handover = cur.kind === 'work' && (nextStep?.kind === 'done' || nextStep?.kind === 'pay');
  const notify = CHANNELS.filter((c) => b.integrations[c.id]?.enabled && c.share);
  const cust = useApp((s) => (tk.job?.customerId ? s.customers.find((x) => x.id === tk.job!.customerId) : null));
  const wa = CHANNELS.find((c) => c.id === 'whatsapp');
  const overdue = !!tk.job?.dueAt && now > tk.job.dueAt && tk.stage < lastWorkIndex(tk);

  const move = (fn: () => void) => {
    if (!reduce) LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    fn();
  };

  return (
    <Animated.View
      accessible
      accessibilityLabel={`Order ${tk.token}, ${stage(cur.name)}, ${unpaid ? 'not paid yet' : 'paid'}, ${elapsed(total)} elapsed${late ? ', late' : ''}`}
      style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }}
    >
      <Paper clip style={{ borderWidth: late ? 3 : 0, borderBottomWidth: 0, borderColor: LATE }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Txt size={28} weight="800" mono color={INK}>{tk.token}</Txt>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt size={17} weight="800" mono color={late ? LATE : INK}>{elapsed(total)}</Txt>
            {late && (
              <Row gap={4}>
                <Icon name="clock" size={14} color={LATE} />
                <Txt size={12} weight="700" color={LATE}>Late</Txt>
              </Row>
            )}
          </View>
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <View style={{ borderRadius: 6, backgroundColor: '#F2E8D5', paddingHorizontal: 7, paddingVertical: 2 }}>
            <Txt size={12} weight="600" color={INK}>{modeLabel(tk.mode, b.template)}{tk.table ? ` · ${tk.table}` : ''}</Txt>
          </View>
          <View style={{ borderRadius: 6, borderWidth: 1.5, borderColor: unpaid ? '#705EA5' : '#236B52', paddingHorizontal: 7, paddingVertical: 1 }}>
            <Txt size={12} weight="700" color={unpaid ? '#705EA5' : '#236B52'}>{unpaid ? 'Not paid yet' : 'Paid'}</Txt>
          </View>
        </Row>
        <Txt size={13} weight="700" mono color={INK} numberOfLines={4} style={{ textTransform: 'uppercase' }}>{tk.summary}</Txt>
        {(tk.job?.note || cust || tk.job?.dueAt) ? (
          <View style={{ gap: 2, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#999', paddingTop: 6 }}>
            {cust ? <Txt size={13} weight="600" color={INK}>{cust.name}{cust.phone ? ` · ${maskPhone(cust.phone)}` : ''}</Txt> : null}
            {tk.job?.note ? <Txt size={13} color={INK}>{tk.job.note}</Txt> : null}
            {tk.job?.dueAt ? <Txt size={12} weight="700" mono color={overdue ? LATE : INK}>DUE {new Date(tk.job.dueAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{overdue ? ' · OVERDUE' : ''}</Txt> : null}
          </View>
        ) : null}
        <Row style={{ marginTop: 4 }}>
          {tk.stage > 0 && cur.kind !== 'pay' && <IconButton icon="undo" a11y="Move back one step" onPress={() => move(() => recall(tk.id))} />}
          {onPrint && <IconButton icon="print" a11y={`Print ticket ${tk.token}`} onPress={() => onPrint(tk)} />}
          {needsPay ? (
            <Button kind="primary" icon="cash" label="Take payment" onPress={() => onPay(tk)} style={{ flex: 1 }} />
          ) : nextStep ? (
            <Button kind={nextStep.kind === 'done' ? 'success' : 'primary'} icon={nextStep.kind === 'done' ? 'check' : 'forward'} label={stage(nextStep.name)} onPress={() => move(() => advance(tk.id))} style={{ flex: 1 }} />
          ) : null}
        </Row>
        {handover && cust?.phone && wa ? (
          <Button size="sm" kind="outline" icon="message" label={`Tell ${cust.name.split(' ')[0] || 'customer'} it's ready`} onPress={() => openShare(wa, `${b.name}: your order ${tk.token} is ready to collect.`, cust.phone)} />
        ) : null}
        {handover && notify.length > 0 && (
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {notify.map((c) => (
              <Button key={c.id} size="sm" kind="outline" icon="message" label={c.name} onPress={() => openShare(c, `${b.name}: your order ${tk.token} is ready to collect.`)} />
            ))}
          </Row>
        )}
      </Paper>
    </Animated.View>
  );
}

export default function Rail() {
  const th = useTheme();
  const { t, stage } = useT();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const b = useApp((s) => s.business)!;
  const tickets = useApp((s) => s.tickets);
  const reduce = useReduceMotion();
  const [now, setNow] = useState(() => Date.now());
  const [lane, setLane] = useState('');
  const [paying, setPaying] = useState<Ticket[] | null>(null);
  const [board, setBoard] = useState(false);
  const [msg, setMsg] = useState('');
  const hasKitchenPrinter = useApp((s) => s.printers.some((p) => p.kitchen && p.kind !== 'system'));
  const reprint = async (tk: Ticket) => {
    const r = await printTicket(tk, { reprint: true });
    setMsg(r.ok ? `Printed ${tk.token}.` : r.error);
  };

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!b.railEnabled)
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: th.bg }}>
        <Note tone="info" text="The order rail is off for this business. Turn it on in Settings if you prepare orders or jobs." />
      </View>
    );

  const active = tickets.filter(isOpen).sort((a, z) => a.createdAt - z.createdAt);
  const today = new Date(now).toDateString();
  const doneToday = tickets.filter((x) => !x.cancelled && x.stage === doneIndex(x.steps) && new Date(x.stageAt[x.stageAt.length - 1]).toDateString() === today).length;
  // Lanes: the workflow steps in use, plus any step an older open ticket is still sitting in.
  // Every workflow's first step shares one lane, named after the main workflow's order step.
  const orderLane = b.service.flows[b.service.defaultMode][0].name;
  const norm = (steps: Ticket['steps']) => steps.map((x, i) => (i === 0 ? { ...x, name: orderLane } : x));
  const lanes = laneNames([...activeModes(b.service).map((m0) => norm(b.service.flows[m0])), ...active.map((x) => norm(x.steps))]);
  const laneOf = (x: Ticket) => (x.stage === 0 ? orderLane : x.steps[x.stage].name);
  const curLane = lanes.includes(lane) ? lane : lanes[0] ?? '';
  const tone = (name: string, i: number) => (i === lanes.length - 1 ? 'success' : name === 'Paid' ? 'success' : i === 0 ? 'info' : 'pending') as 'success' | 'pending' | 'info';
  const pay = (tk: Ticket) => setPaying(tk.table ? tickets.filter((x) => isUnpaid(x) && x.table === tk.table) : [tk]);

  const renderLane = (name: string, i: number) => {
    const list = active.filter((x) => laneOf(x) === name);
    return (
      <View style={{ gap: 0 }}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 }}>
          <Txt size={17} weight="800" heading>{stage(name)}</Txt>
          <Pill tone={tone(name, i)} text={String(list.length)} />
        </Row>
        <MetalRail />
        <View style={{ paddingHorizontal: 8, gap: 16 }}>
          {list.length === 0 && <Txt dim style={{ paddingTop: 16 }}>Nothing here.</Txt>}
          {list.map((tk) => <TicketCard key={tk.id} tk={tk} now={now} reduce={reduce} onPay={pay} onPrint={hasKitchenPrinter ? reprint : undefined} />)}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <PageHeader kicker={`${active.length} open · ${doneToday} done today`} title={t('rail')} action={<Button size="sm" kind="outline" icon="monitor" label="Pickup screen" onPress={() => setBoard(true)} />} />
        {!!msg && <Note tone={msg.startsWith('Printed') ? 'success' : 'warning'} text={msg} />}
        {!wide && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {lanes.map((n) => (
              <Button key={n} size="sm" kind={curLane === n ? 'secondary' : 'outline'} label={`${stage(n)} · ${active.filter((x) => laneOf(x) === n).length}`} onPress={() => setLane(n)} />
            ))}
          </ScrollView>
        )}
      </View>
      {wide ? (
        <ScrollView horizontal contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 20, flexGrow: 1 }}>
          {lanes.map((n, i) => (
            <ScrollView key={n} style={{ flex: 1, minWidth: 260 }} contentContainerStyle={{ paddingBottom: 100 }}>
              {renderLane(n, i)}
            </ScrollView>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 120 }}>{renderLane(curLane, lanes.indexOf(curLane))}</ScrollView>
      )}
      <Modal visible={board} animationType="fade" supportedOrientations={['portrait', 'landscape']} onRequestClose={() => setBoard(false)}>
        <PickupBoard tickets={active} onClose={() => setBoard(false)} />
      </Modal>
      {paying && (
        <Checkout
          lines={paying.flatMap((x) => x.lines)}
          ticketIds={paying.map((x) => x.id)}
          table={paying[0].table}
          mode={paying[0].mode}
          onClose={() => setPaying(null)}
        />
      )}
    </View>
  );
}

/** Customer-facing pickup board (website: Flow "Pickup board"). No names on screen — just tokens. */
function PickupBoard({ tickets, onClose }: { tickets: Ticket[]; onClose: () => void }) {
  const b = useApp((s) => s.business)!;
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const isReady = (tk: Ticket) => tk.stage >= tk.steps.map((x) => x.kind).lastIndexOf('work') && tk.steps[tk.stage].kind !== 'order';
  const ready = tickets.filter(isReady);
  const preparing = tickets.filter((tk) => !isReady(tk));
  const big = Math.min(72, Math.max(40, width / (landscape ? 14 : 8)));
  const col = (title: string, list: Ticket[], hot: boolean) => (
    <View style={{ flex: 1, gap: 16, padding: 20, borderRadius: 24, backgroundColor: hot ? '#236B52' : '#1B2A4A' }}>
      <Txt size={22} weight="700" mono color={hot ? '#F2E8D5' : '#C9B896'} style={{ letterSpacing: 3, textTransform: 'uppercase' }}>{title}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {list.length === 0 ? <Txt size={20} color="#C9B896">—</Txt> : null}
        {list.map((tk) => (
          <View key={tk.id} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: hot ? '#F2E8D5' : '#141F38' }}>
            <Txt size={big} weight="800" mono color={hot ? '#141F38' : '#F2E8D5'}>{tk.token}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#141F38', padding: 20, paddingTop: 48, gap: 16 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={26} weight="800" heading color="#F2E8D5">{b.name}</Txt>
        <Button size="sm" kind="secondary" icon="close" label="Close" onPress={onClose} />
      </Row>
      <View style={{ flex: 1, flexDirection: landscape ? 'row' : 'column', gap: 16 }}>
        {col('Preparing', preparing, false)}
        {col('Ready · please collect', ready, true)}
      </View>
      <Txt size={14} color="#C9B896" center>Show your token at the counter.</Txt>
    </View>
  );
}
