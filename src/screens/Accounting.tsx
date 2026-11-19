// Professional accounting workspace (owners): journal, general ledger, statements, manual entries, period lock.
// Posted entries are never edited — corrections are reversals, so the audit trail stays intact.
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../brand/Icon';
import {
  ACCOUNTS, type Entry, type Line, TEMPLATES, type TemplateId, balanceSheet, cashFlow, generalLedger, isLocked,
  profitAndLoss, templateLines, trialBalance, validate,
} from '../accounting/ledger.ts';
import { useLedger } from '../accounting/useLedger';
import { Dropdown } from '../components/Dropdown';
import { Button, Card, Field, Note, PageHeader, Pill, Row, Segmented, Sheet, Txt } from '../components/ui';
import { countryOf, formatMoney, parseMoney } from '../money';
import { useApp } from '../store';
import { useTheme } from '../theme';

type Tab = 'journal' | 'ledger' | 'statements' | 'books';
type Stmt = 'pl' | 'bs' | 'cf' | 'tb';
type Period = 'month' | 'last' | 'year' | 'all';
const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parseYmd = (s: string) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return null; const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12); return isNaN(d.getTime()) ? null : d.getTime(); };
const SOURCE: Record<Entry['source']['kind'], string> = { sale: 'Sale', void: 'Void', expense: 'Expense', day_close: 'Day close', manual: 'Journal', reversal: 'Reversal' };

function rangeOf(p: Period, now: number): [number, number, string] {
  const d = new Date(now);
  if (p === 'month') return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), Infinity, 'This month'];
  if (p === 'last') return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime(), 'Last month'];
  if (p === 'year') return [new Date(d.getFullYear(), 0, 1).getTime(), Infinity, 'This year'];
  return [-Infinity, Infinity, 'All time'];
}

function Line2({ label, value, bold, indent, dim }: { label: string; value: string; bold?: boolean; indent?: boolean; dim?: boolean }) {
  const th = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: bold ? 1 : 0, borderTopColor: th.border }}>
      <Txt size={15} weight={bold ? '700' : '400'} dim={dim} style={{ flex: 1, paddingLeft: indent ? 12 : 0 }}>{label}</Txt>
      <Txt size={15} weight={bold ? '800' : '500'} mono>{value}</Txt>
    </Row>
  );
}

export default function Accounting({ onBack, start }: { onBack: () => void; start?: 'settle' | 'tax' }) {
  const th = useTheme();
  const b = useApp((s) => s.business)!;
  const lockedThrough = useApp((s) => s.settings.lockedThrough ?? null);
  const setLock = useApp((s) => s.setLock);
  const postJournal = useApp((s) => s.postJournal);
  const reverseJournal = useApp((s) => s.reverseJournal);
  const deleteDraft = useApp((s) => s.deleteDraft);
  const journals = useApp((s) => s.journals);
  const drafts = useMemo(() => journals.filter((j) => j.status === 'draft'), [journals]);
  const c = countryOf(b.country);
  const fmt = (n: number) => formatMoney(n, c);
  const entries = useLedger();
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>('journal');
  const [stmt, setStmt] = useState<Stmt>('pl');
  const [period, setPeriod] = useState<Period>('month');
  const [acct, setAcct] = useState('1000');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<TemplateId | null>(start === 'settle' ? 'settle_clearing' : start === 'tax' ? 'tax_pay' : null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [from, to, periodLabel] = rangeOf(period, now);
  const tb = useMemo(() => trialBalance(entries), [entries]);
  const shown = [...drafts, ...entries.filter((e) => e.date >= from && e.date < to).reverse()];

  const say = (err: string | null, ok: string) => setMsg(err ? { tone: 'error', text: err } : { tone: 'success', text: ok });

  return (
    <View style={{ gap: 14 }}>
      <PageHeader kicker="Finance" title="Accounting" onBack={onBack} action={<Button size="sm" icon="plus" label="New entry" onPress={() => setEditor('owner_in')} />} />
      <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: 'journal', label: 'Journal' }, { value: 'ledger', label: 'Ledger' }, { value: 'statements', label: 'Reports' }, { value: 'books', label: 'Books' }]} />
      {!tb.balanced && <Note tone="error" text="Trial balance does not balance. Check manual entries." />}
      {msg && <Note tone={msg.tone} text={msg.text} />}
      {tab !== 'books' && <Segmented<Period> value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Month' }, { value: 'last', label: 'Last month' }, { value: 'year', label: 'Year' }, { value: 'all', label: 'All' }]} />}

      {tab === 'journal' && (
        <View style={{ gap: 10 }}>
          {shown.length === 0 && <Txt dim>No entries in {periodLabel.toLowerCase()}.</Txt>}
          {shown.slice(0, 200).map((e) => {
            const total = e.lines.reduce((s, l) => s + l.debit, 0);
            const open = openId === e.id;
            const manual = e.source.kind === 'manual';
            return (
              <Card key={e.id} style={{ gap: 8, padding: 14 }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpenId(open ? null : e.id)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt weight="700" numberOfLines={1}>{e.memo}</Txt>
                      <Txt size={13} dim>{ymd(e.date)} · {SOURCE[e.source.kind]}{e.source.ref ? ` · ${e.source.ref}` : ''}</Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Txt weight="700" mono>{fmt(total)}</Txt>
                      {e.status === 'draft' ? <Pill tone="warning" text="Draft" /> : e.reversedBy ? <Pill tone="info" text="Reversed" /> : e.reversalOf ? <Pill tone="info" text="Reversal" /> : null}
                    </View>
                  </Row>
                </Pressable>
                {open && (
                  <View style={{ gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: th.border }}>
                    {e.lines.map((l, i) => (
                      <Row key={i} style={{ justifyContent: 'space-between' }}>
                        <Txt size={14} style={{ flex: 1, paddingLeft: l.credit ? 16 : 0 }}>{l.account} {ACCOUNTS.find((a) => a.code === l.account)?.name}</Txt>
                        <Txt size={14} mono>{l.debit ? `Dr ${fmt(l.debit)}` : `Cr ${fmt(l.credit)}`}</Txt>
                      </Row>
                    ))}
                    {e.status === 'draft' && (
                      <Row gap={8} style={{ marginTop: 6 }}>
                        <Button size="sm" label="Post" onPress={() => say(postJournal(e.id), 'Posted.')} />
                        <Button size="sm" kind="outline" label="Delete draft" onPress={() => deleteDraft(e.id)} />
                      </Row>
                    )}
                    {manual && e.status === 'posted' && !e.reversedBy && !e.reversalOf && (
                      <Button size="sm" kind="outline" icon="undo" label="Reverse" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => say(reverseJournal(e.id, ''), 'Reversed. The original stays in the journal.')} />
                    )}
                    {!manual && e.status === 'posted' && <Txt size={12} dim>Created automatically from the {SOURCE[e.source.kind].toLowerCase()}. Correct it there (e.g. void the sale) or with a journal.</Txt>}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {tab === 'ledger' && (() => {
        const gl = generalLedger(entries, acct, from, to);
        return (
          <View style={{ gap: 10 }}>
            <Dropdown label="Account" value={acct} onChange={setAcct} options={ACCOUNTS.map((a) => ({ value: a.code, label: `${a.code} ${a.name}`, hint: a.type }))} />
            <Card style={{ gap: 2 }}>
              <Line2 label="Opening balance" value={fmt(gl.opening)} dim />
              {gl.rows.slice(-300).map((r, i) => (
                <Row key={`${r.entry.id}-${i}`} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Txt size={14} numberOfLines={1}>{r.entry.memo}</Txt>
                    <Txt size={12} dim>{ymd(r.entry.date)}</Txt>
                  </View>
                  <Txt size={14} mono style={{ width: 110, textAlign: 'right' }}>{r.line.debit ? `+${fmt(r.line.debit)}` : `−${fmt(r.line.credit)}`}</Txt>
                  <Txt size={14} weight="700" mono style={{ width: 110, textAlign: 'right' }}>{fmt(r.balance)}</Txt>
                </Row>
              ))}
              <Line2 label="Closing balance" value={fmt(gl.closing)} bold />
            </Card>
          </View>
        );
      })()}

      {tab === 'statements' && (
        <View style={{ gap: 10 }}>
          <Segmented<Stmt> value={stmt} onChange={setStmt} options={[{ value: 'pl', label: 'Profit & loss' }, { value: 'bs', label: 'Balance' }, { value: 'cf', label: 'Cash flow' }, { value: 'tb', label: 'Trial' }]} />
          <Card style={{ gap: 2 }}>
            {stmt === 'pl' && (() => {
              const p = profitAndLoss(entries, from, to);
              return (
                <>
                  <Txt size={13} dim>{periodLabel}</Txt>
                  <Line2 label="Sales" value={fmt(p.sales)} />
                  <Line2 label="Discounts given" value={`−${fmt(p.discounts)}`} indent />
                  <Line2 label="Net sales" value={fmt(p.netSales)} bold />
                  <Line2 label="Cost of sales" value={`−${fmt(p.cogs)}`} />
                  <Line2 label="Gross profit" value={fmt(p.grossProfit)} bold />
                  {p.otherIncome !== 0 && <Line2 label="Other income" value={fmt(p.otherIncome)} />}
                  {p.opexLines.map((x) => <Line2 key={x.account.code} label={x.account.name} value={`−${fmt(x.amount)}`} indent />)}
                  <Line2 label="EBITDA" value={fmt(p.ebitda)} bold />
                  <Txt size={12} dim>Earnings before interest, tax, depreciation & amortisation. A performance measure — not cash available.</Txt>
                  <Line2 label="Depreciation" value={`−${fmt(p.depreciation)}`} />
                  <Line2 label="Interest" value={`−${fmt(p.interest)}`} />
                  <Line2 label="Income tax" value={`−${fmt(p.incomeTax)}`} />
                  <Line2 label="Net profit" value={fmt(p.netProfit)} bold />
                </>
              );
            })()}
            {stmt === 'bs' && (() => {
              const s = balanceSheet(entries, to);
              return (
                <>
                  <Txt size={13} dim>As at {to === Infinity ? 'today' : ymd(to - 1)}</Txt>
                  <Txt weight="700">Assets</Txt>
                  {s.assets.map((x) => <Line2 key={x.account.code} label={x.account.name} value={fmt(x.amount)} indent />)}
                  <Line2 label="Total assets" value={fmt(s.totalAssets)} bold />
                  <Txt weight="700" style={{ marginTop: 8 }}>Liabilities</Txt>
                  {s.liabilities.map((x) => <Line2 key={x.account.code} label={x.account.name} value={fmt(x.amount)} indent />)}
                  <Line2 label="Total liabilities" value={fmt(s.totalLiabilities)} bold />
                  <Txt weight="700" style={{ marginTop: 8 }}>Owner’s equity</Txt>
                  {s.equity.map((x) => <Line2 key={x.label} label={x.label} value={fmt(x.amount)} indent />)}
                  <Line2 label="Total equity" value={fmt(s.totalEquity)} bold />
                  <Pill tone={s.balanced ? 'success' : 'error'} text={s.balanced ? 'Assets = liabilities + equity' : 'Does not balance'} />
                </>
              );
            })()}
            {stmt === 'cf' && (() => {
              const f = cashFlow(entries, from, to);
              return (
                <>
                  <Txt size={13} dim>{periodLabel} · cash on hand + bank</Txt>
                  <Line2 label="Opening cash" value={fmt(f.opening)} />
                  <Line2 label="From trading (operating)" value={fmt(f.operating)} indent />
                  <Line2 label="Equipment (investing)" value={fmt(f.investing)} indent />
                  <Line2 label="Owner & loans (financing)" value={fmt(f.financing)} indent />
                  <Line2 label="Net change" value={fmt(f.net)} bold />
                  <Line2 label="Closing cash" value={fmt(f.closing)} bold />
                  <Txt size={12} dim>QR / link payments count as cash only after you record them arriving in the bank.</Txt>
                </>
              );
            })()}
            {stmt === 'tb' && (() => {
              const t = trialBalance(entries, to);
              return (
                <>
                  {t.rows.map((r) => (
                    <Row key={r.account.code} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                      <Txt size={14} style={{ flex: 1 }}>{r.account.code} {r.account.name}</Txt>
                      <Txt size={14} mono style={{ width: 100, textAlign: 'right' }}>{r.debit ? fmt(r.debit) : ''}</Txt>
                      <Txt size={14} mono style={{ width: 100, textAlign: 'right' }}>{r.credit ? fmt(r.credit) : ''}</Txt>
                    </Row>
                  ))}
                  <Row style={{ justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 1, borderTopColor: th.border }}>
                    <Txt weight="700" style={{ flex: 1 }}>Total</Txt>
                    <Txt weight="800" mono style={{ width: 100, textAlign: 'right' }}>{fmt(t.debit)}</Txt>
                    <Txt weight="800" mono style={{ width: 100, textAlign: 'right' }}>{fmt(t.credit)}</Txt>
                  </Row>
                  <Pill tone={t.balanced ? 'success' : 'error'} text={t.balanced ? 'Balanced' : 'Not balanced'} />
                </>
              );
            })()}
          </Card>
        </View>
      )}

      {tab === 'books' && (
        <View style={{ gap: 10 }}>
          <Card style={{ gap: 10 }}>
            <Row gap={8}><Icon name="lock" size={20} color={th.text} /><Txt weight="700">Period lock</Txt></Row>
            <Txt dim>{lockedThrough ? `Books are locked through ${ymd(lockedThrough)}. Entries on or before that date cannot be added, removed or reversed.` : 'Nothing is locked. Lock a month once it is checked, so it cannot change.'}</Txt>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {(() => {
                const d = new Date(now);
                const endLast = new Date(d.getFullYear(), d.getMonth(), 1).getTime() - 1;
                return <Button size="sm" label={`Lock through ${ymd(endLast)}`} onPress={() => setLock(endLast)} disabled={lockedThrough === endLast} />;
              })()}
              {lockedThrough && <Button size="sm" kind="outline" label="Unlock" onPress={() => setLock(null)} />}
            </Row>
          </Card>
          <Card style={{ gap: 4 }}>
            <Txt weight="700">Chart of accounts</Txt>
            {ACCOUNTS.map((a) => (
              <Row key={a.code} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
                <Txt size={14} style={{ flex: 1 }}>{a.code} {a.name}</Txt>
                <Txt size={12} dim>{a.type}</Txt>
              </Row>
            ))}
          </Card>
        </View>
      )}

      <EntryEditor
        key={editor ?? 'closed'}
        template={editor}
        onClose={() => setEditor(null)}
        fmtDecimals={c.decimals}
        lockedThrough={lockedThrough}
        onDone={(text) => { setEditor(null); setTab('journal'); setPeriod('month'); setMsg({ tone: 'success', text }); }}
      />
    </View>
  );
}

function EntryEditor({ template, onClose, onDone, fmtDecimals, lockedThrough }: { template: TemplateId | null; onClose: () => void; onDone: (msg: string) => void; fmtDecimals: number; lockedThrough: number | null }) {
  const saveJournal = useApp((s) => s.saveJournal);
  const postJournal = useApp((s) => s.postJournal);
  const [tpl, setTpl] = useState<TemplateId>(template ?? 'owner_in');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [paidFrom, setPaidFrom] = useState<'1000' | '1100'>('1100');
  const [expense, setExpense] = useState('5000');
  const [date, setDate] = useState(() => ymd(Date.now()));
  const [memo, setMemo] = useState('');
  const [custom, setCustom] = useState<{ account: string; dr: string; cr: string }[]>([{ account: '1000', dr: '', cr: '' }, { account: '3000', dr: '', cr: '' }]);
  const [err, setErr] = useState('');
  const t = TEMPLATES.find((x) => x.id === tpl)!;
  const amt = parseMoney(amount, fmtDecimals) ?? 0;
  const lines: Line[] = tpl === 'custom'
    ? custom.map((l) => ({ account: l.account, debit: parseMoney(l.dr, fmtDecimals) ?? 0, credit: parseMoney(l.cr, fmtDecimals) ?? 0 }))
    : templateLines(tpl, amt, { paidFrom, fee: parseMoney(fee, fmtDecimals) ?? 0, expense });
  const when = parseYmd(date);
  const problems = validate({ lines });
  const save = (post: boolean) => {
    if (!when) return setErr('Date must be YYYY-MM-DD.');
    if (isLocked(when, lockedThrough)) return setErr('That date is in a locked period.');
    if (problems.length) return setErr(problems[0]);
    const before = useApp.getState().journals.map((j) => j.id);
    const e1 = saveJournal({ date: when, memo: memo.trim() || t.label, lines: lines.filter((l) => l.debit || l.credit) });
    if (e1) return setErr(e1);
    const id = useApp.getState().journals.find((j) => !before.includes(j.id))?.id;
    if (post && id) { const e2 = postJournal(id); if (e2) return setErr(e2); }
    setAmount(''); setFee(''); setMemo(''); setErr('');
    onDone(post ? 'Entry posted.' : 'Saved as draft. Post it from the journal.');
  };
  const expenseAccounts = ACCOUNTS.filter((a) => a.type === 'expense');
  return (
    <Sheet visible={template != null} onClose={onClose} title="New entry">
      <View style={{ gap: 12 }}>
        <Dropdown label="What happened?" value={tpl} onChange={setTpl} searchable={false} options={TEMPLATES.map((x) => ({ value: x.id, label: x.label, hint: x.hint }))} />
        <Txt size={14} dim>{t.hint}</Txt>
        {tpl !== 'custom' ? (
          <>
            <Field label="Amount" value={amount} onChange={setAmount} keyboard="decimal-pad" mono />
            {tpl === 'settle_clearing' && <Field label="Fee the provider kept (optional)" value={fee} onChange={setFee} keyboard="decimal-pad" mono />}
            {tpl === 'supplier_bill' && <Dropdown label="For" value={expense} onChange={setExpense} options={expenseAccounts.map((a) => ({ value: a.code, label: a.name }))} />}
            {!['depreciation', 'bank_deposit', 'settle_clearing', 'supplier_bill'].includes(tpl) && (
              <Segmented value={paidFrom} onChange={setPaidFrom} options={[{ value: '1100', label: 'Bank' }, { value: '1000', label: 'Cash' }]} />
            )}
          </>
        ) : (
          <View style={{ gap: 8 }}>
            {custom.map((l, i) => (
              <View key={i} style={{ gap: 6 }}>
                <Dropdown label={`Line ${i + 1}`} value={l.account} onChange={(v) => setCustom(custom.map((x, j) => (j === i ? { ...x, account: v } : x)))} options={ACCOUNTS.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))} />
                <Row gap={8}>
                  <View style={{ flex: 1 }}><Field label="Debit" value={l.dr} onChange={(v) => setCustom(custom.map((x, j) => (j === i ? { ...x, dr: v } : x)))} keyboard="decimal-pad" mono /></View>
                  <View style={{ flex: 1 }}><Field label="Credit" value={l.cr} onChange={(v) => setCustom(custom.map((x, j) => (j === i ? { ...x, cr: v } : x)))} keyboard="decimal-pad" mono /></View>
                </Row>
              </View>
            ))}
            <Button size="sm" kind="outline" icon="plus" label="Add line" onPress={() => setCustom([...custom, { account: '6900', dr: '', cr: '' }])} />
          </View>
        )}
        <Field label="Date" value={date} onChange={setDate} placeholder="YYYY-MM-DD" mono />
        <Field label="Note" value={memo} onChange={setMemo} maxLength={140} placeholder={t.label} />
        {amt > 0 || tpl === 'custom' ? (
          <View style={{ gap: 2 }}>
            {lines.filter((l) => l.debit || l.credit).map((l, i) => (
              <Txt key={i} size={13} mono dim>{l.debit ? 'Dr' : '   Cr'} {l.account} {ACCOUNTS.find((a) => a.code === l.account)?.name}</Txt>
            ))}
          </View>
        ) : null}
        {!!err && <Note tone="error" text={err} />}
        <Row gap={8}>
          <View style={{ flex: 1 }}><Button kind="outline" label="Save draft" onPress={() => save(false)} /></View>
          <View style={{ flex: 1 }}><Button label="Post" onPress={() => save(true)} disabled={problems.length > 0} /></View>
        </Row>
      </View>
    </Sheet>
  );
}
