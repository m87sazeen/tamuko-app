// Story Engine — deterministic, evidence-linked narrative from the ledger. No AI, no guessing.
// Every insight says what kind of statement it is:
//   fact      computed from posted entries
//   estimate  a projection or a number with known gaps (labelled, with its basis)
//   pending   something waiting on a person or an outside party (e.g. bank settlement) — never shown as done
import { type Entry, balances, normal, profitAndLoss } from './ledger.ts';

export type Kind = 'fact' | 'estimate' | 'pending';
export type Role = 'state' | 'trend' | 'insight' | 'action' | 'confidence';
export type Insight = {
  id: string;
  role: Role;
  kind: Kind;
  title: string;
  body: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  evidence: { label: string; value: number | string; entryIds?: string[] }[];
  action?: { label: string; target: 'expenses' | 'day' | 'accounting' | 'settle' | 'tax' };
};

const DAY = 86_400_000;
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export type StoryInput = { entries: Entry[]; now: number; fmt: (minor: number) => string; taxName?: string };

/** Ordered narrative: STATE → TREND → INSIGHT(s) → ACTION → CONFIDENCE. */
export function tellStory({ entries, now, fmt, taxName = 'Tax' }: StoryInput): Insight[] {
  const out: Insight[] = [];
  const today = startOfDay(now);
  const salesIds = (from: number, to: number) => entries.filter((e) => e.source.kind === 'sale' && e.date >= from && e.date < to).map((e) => e.id);
  const net = (from: number, to: number) => profitAndLoss(entries, from, to).netSales;

  // STATE — today
  const todayNet = net(today, today + DAY);
  const todayIds = salesIds(today, today + DAY);
  out.push({
    id: 'state.today',
    role: 'state',
    kind: 'fact',
    tone: todayNet > 0 ? 'good' : 'neutral',
    title: todayIds.length ? `${fmt(todayNet)} in sales today` : 'No sales yet today',
    body: todayIds.length ? `${todayIds.length} ${todayIds.length === 1 ? 'sale' : 'sales'}, after discounts and before ${taxName.toLowerCase()}.` : 'Your first sale of the day will show here.',
    evidence: [{ label: 'Sales entries today', value: todayIds.length, entryIds: todayIds }],
  });

  // TREND — last 7 days vs the 7 before (only if both weeks have data)
  const w1 = net(today - 6 * DAY, today + DAY);
  const w0 = net(today - 13 * DAY, today - 6 * DAY);
  const activeDays = new Set(entries.filter((e) => e.source.kind === 'sale').map((e) => startOfDay(e.date))).size;
  if (w0 > 0 && w1 >= 0) {
    const pct = Math.round(((w1 - w0) / w0) * 100);
    out.push({
      id: 'trend.week',
      role: 'trend',
      kind: 'fact',
      tone: pct >= 5 ? 'good' : pct <= -5 ? 'bad' : 'neutral',
      title: pct === 0 ? 'Same as last week' : `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% on last week`,
      body: `${fmt(w1)} in the last 7 days against ${fmt(w0)} the week before.`,
      evidence: [{ label: 'Last 7 days', value: fmt(w1) }, { label: 'Previous 7 days', value: fmt(w0) }],
    });
  }

  // INSIGHTS — month to date
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const pl = profitAndLoss(entries, monthStart, today + DAY);
  if (pl.netSales > 0 || pl.opex > 0 || pl.cogs > 0) {
    out.push({
      id: 'insight.profit',
      role: 'insight',
      kind: 'fact',
      tone: pl.netProfit >= 0 ? 'good' : 'bad',
      title: pl.netProfit >= 0 ? `${fmt(pl.netProfit)} profit this month` : `${fmt(-pl.netProfit)} loss this month`,
      body: `Sales ${fmt(pl.netSales)} − costs ${fmt(pl.cogs + pl.opex + pl.depreciation + pl.interest)}. Profit is not the same as cash: check Cash on hand and Bank for what you can spend.`,
      evidence: [{ label: 'Net sales', value: fmt(pl.netSales) }, { label: 'Cost of sales', value: fmt(pl.cogs) }, { label: 'Running costs', value: fmt(pl.opex) }, { label: 'EBITDA', value: fmt(pl.ebitda) }],
    });
    const top = [...pl.opexLines].sort((a, z) => z.amount - a.amount)[0];
    const costs = pl.opex + pl.cogs;
    if (top && costs > 0 && top.amount / costs >= 0.4) {
      out.push({
        id: 'insight.topcost',
        role: 'insight',
        kind: 'fact',
        tone: 'warn',
        title: `${top.account.name} is ${Math.round((top.amount / costs) * 100)}% of your costs`,
        body: `${fmt(top.amount)} this month.`,
        evidence: [{ label: top.account.name, value: fmt(top.amount) }, { label: 'All costs', value: fmt(costs) }],
        action: { label: 'See expenses', target: 'expenses' },
      });
    }
  }

  const b = balances(entries, -Infinity, today + DAY);
  // PENDING — QR / link money not yet matched to the bank
  const clearing = normal(b, '1010');
  if (clearing > 0) {
    const ids = entries.filter((e) => e.lines.some((l) => l.account === '1010')).map((e) => e.id);
    out.push({
      id: 'pending.clearing',
      role: 'insight',
      kind: 'pending',
      tone: 'warn',
      title: `${fmt(clearing)} from QR / link is waiting to settle`,
      body: 'Staff marked these as paid. They count as money only once your bank or payment app shows them — match them when they arrive.',
      evidence: [{ label: 'Waiting to settle', value: fmt(clearing), entryIds: ids }],
      action: { label: 'Record money that arrived', target: 'settle' },
    });
  }
  // Tax owed
  const tax = normal(b, '2100');
  if (tax > 0) {
    out.push({
      id: 'insight.tax',
      role: 'insight',
      kind: 'fact',
      tone: 'neutral',
      title: `${fmt(tax)} ${taxName} collected is owed`,
      body: 'This is customers’ money held for the tax authority. Keep it aside — it is not profit.',
      evidence: [{ label: `${taxName} owed`, value: fmt(tax) }],
      action: { label: 'Record a tax payment', target: 'tax' },
    });
  }
  // Cash short
  const short = entries.filter((e) => e.source.kind === 'day_close' && e.date >= monthStart && e.lines.some((l) => l.account === '6950' && l.debit > 0));
  if (short.length) {
    const amt = short.reduce((s, e) => s + e.lines.filter((l) => l.account === '6950').reduce((a, l) => a + l.debit, 0), 0);
    out.push({
      id: 'insight.short',
      role: 'insight',
      kind: 'fact',
      tone: 'bad',
      title: `Cash was short ${short.length} ${short.length === 1 ? 'time' : 'times'} this month`,
      body: `${fmt(amt)} in total at day close.`,
      evidence: [{ label: 'Short closes', value: short.length, entryIds: short.map((e) => e.id) }],
      action: { label: 'Review day closes', target: 'day' },
    });
  }

  // PROJECTION — month end at current pace (estimate, only with a week of data)
  const daysIn = Math.max(1, Math.round((today + DAY - monthStart) / DAY));
  const daysInMonth = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 0).getDate();
  if (activeDays >= 7 && pl.netSales > 0) {
    const proj = Math.round((pl.netSales / daysIn) * daysInMonth);
    out.push({
      id: 'estimate.month',
      role: 'trend',
      kind: 'estimate',
      tone: 'neutral',
      title: `On pace for about ${fmt(proj)} in sales this month`,
      body: `If the next ${daysInMonth - daysIn} days are like the first ${daysIn}. A projection, not a promise.`,
      evidence: [{ label: 'Month to date', value: fmt(pl.netSales) }, { label: 'Days counted', value: daysIn }],
    });
  }

  // ACTION — the single most useful next step
  const next = out.find((i) => i.action && (i.tone === 'bad' || i.kind === 'pending')) ?? out.find((i) => i.action);
  if (next?.action) out.push({ id: 'action.next', role: 'action', kind: 'fact', tone: 'neutral', title: next.action.label, body: next.title, evidence: [], action: next.action });

  // CONFIDENCE — how much to trust this story
  const level = activeDays >= 28 ? 'High' : activeDays >= 7 ? 'Medium' : 'Low';
  out.push({
    id: 'confidence',
    role: 'confidence',
    kind: 'fact',
    tone: 'neutral',
    title: `Confidence: ${level}`,
    body: `Based on ${activeDays} ${activeDays === 1 ? 'day' : 'days'} of sales and ${entries.length} ledger entries.${activeDays < 7 ? ' Trends appear after a week of sales.' : ''}`,
    evidence: [{ label: 'Trading days', value: activeDays }, { label: 'Entries', value: entries.length }],
  });
  return out;
}
