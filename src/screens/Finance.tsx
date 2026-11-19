// Finance Overview — the everyday owner's view. Narrative first (what is happening, why, what to do),
// numbers second. Every insight is labelled Fact / Estimate / Pending and can show its evidence.
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../brand/Icon';
import { balances, normal, profitAndLoss } from '../accounting/ledger.ts';
import { type Insight, tellStory } from '../accounting/story.ts';
import { useLedger } from '../accounting/useLedger';
import { Button, Card, Pill, Row, Stat, Txt, type Tone } from '../components/ui';
import { countryOf, formatMoney } from '../money';
import { useApp } from '../store';
import { useTheme } from '../theme';

const KIND: Record<Insight['kind'], { label: string; tone: Tone }> = {
  fact: { label: 'Fact', tone: 'info' },
  estimate: { label: 'Estimate', tone: 'warning' },
  pending: { label: 'Pending', tone: 'pending' },
};
const TONE: Record<Insight['tone'], Tone> = { good: 'success', warn: 'warning', bad: 'error', neutral: 'info' };

function InsightCard({ i, hero, onAction }: { i: Insight; hero?: boolean; onAction?: (t: NonNullable<Insight['action']>['target']) => void }) {
  const th = useTheme();
  const [open, setOpen] = useState(false);
  const accent = th[TONE[i.tone]];
  return (
    <Card style={{ gap: 10, borderLeftWidth: 4, borderLeftColor: accent }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={12} weight="700" dim>{i.role.toUpperCase()}</Txt>
        <Pill tone={KIND[i.kind].tone} text={KIND[i.kind].label} />
      </Row>
      <Txt size={hero ? 26 : 18} weight="800" heading>{i.title}</Txt>
      <Txt dim>{i.body}</Txt>
      {i.evidence.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}>
          <Row gap={6}>
            <Icon name={open ? 'up' : 'down'} size={16} color={th.accentText} />
            <Txt size={14} weight="600" color={th.accentText}>{open ? 'Hide evidence' : 'Show evidence'}</Txt>
          </Row>
        </Pressable>
      )}
      {open && (
        <View style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: th.inset }}>
          {i.evidence.map((e) => (
            <Row key={e.label} style={{ justifyContent: 'space-between' }}>
              <Txt size={14} dim>{e.label}</Txt>
              <Txt size={14} weight="700" mono>{String(e.value)}</Txt>
            </Row>
          ))}
        </View>
      )}
      {i.action && onAction && <Button size="sm" kind="secondary" label={i.action.label} onPress={() => onAction(i.action!.target)} style={{ alignSelf: 'flex-start' }} />}
    </Card>
  );
}

export default function Finance({ onAccounting, onExpenses }: { onAccounting: (start?: 'settle' | 'tax') => void; onExpenses: () => void }) {
  const b = useApp((s) => s.business)!;
  const me = useApp((s) => s.users.find((u) => u.id === s.currentUserId));
  const c = countryOf(b.country);
  const fmt = (n: number) => formatMoney(n, c);
  const entries = useLedger();
  const [now] = useState(() => Date.now());
  const story = useMemo(() => tellStory({ entries, now, fmt, taxName: b.tax.name || 'Tax' }), [entries, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const bal = balances(entries);
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const pl = profitAndLoss(entries, monthStart, Infinity);
  const owner = me?.role === 'owner';
  const th = useTheme();
  const act = (t: NonNullable<Insight['action']>['target']) => {
    if (t === 'expenses') onExpenses();
    else if (t === 'settle' || t === 'tax') owner && onAccounting(t);
    else if (t === 'accounting') owner && onAccounting();
  };
  const [hero, ...rest] = story.filter((i) => i.role !== 'confidence' && i.role !== 'action');
  const action = story.find((i) => i.role === 'action');
  const confidence = story.find((i) => i.role === 'confidence')!;

  return (
    <View style={{ gap: 14 }}>
      {hero && <InsightCard i={hero} hero onAction={act} />}
      {action && (
        <Card style={{ gap: 8 }}>
          <Txt size={12} weight="700" dim>NEXT STEP</Txt>
          <Txt weight="700">{action.body}</Txt>
          {action.action && <Button label={action.action.label} onPress={() => act(action.action!.target)} />}
        </Card>
      )}

      <Txt size={12} weight="700" dim>WHERE YOUR MONEY IS</Txt>
      <Row style={{ flexWrap: 'wrap' }}>
        <Stat label="Cash on hand" value={fmt(normal(bal, '1000'))} icon="cash" />
        <Stat label="Bank" value={fmt(normal(bal, '1100'))} icon="wallet" sub="From recorded entries" />
        <Stat label="Waiting to settle" value={fmt(normal(bal, '1010'))} icon="pending" tone="pending" sub="QR / link, not yet in bank" />
        <Stat label={`${b.tax.name || 'Tax'} owed`} value={fmt(normal(bal, '2100'))} icon="document" sub="Not your money" />
      </Row>

      <Txt size={12} weight="700" dim>THIS MONTH</Txt>
      <Row style={{ flexWrap: 'wrap' }}>
        <Stat label="Net sales" value={fmt(pl.netSales)} icon="chart" />
        <Stat label="Profit" value={fmt(pl.netProfit)} tone={pl.netProfit >= 0 ? 'success' : 'error'} sub="After all costs" />
        <Stat label="EBITDA" value={fmt(pl.ebitda)} sub="Before depreciation, interest & tax — not cash in the bank" />
      </Row>

      {rest.map((i) => <InsightCard key={i.id} i={i} onAction={act} />)}

      <Row gap={8}>
        <Icon name="shield" size={18} color={th.textDim} />
        <Txt size={13} dim style={{ flex: 1 }}>{confidence.title}. {confidence.body}</Txt>
      </Row>
      {owner && <Button kind="outline" icon="document" label="Open accounting" onPress={() => onAccounting()} />}
    </View>
  );
}
