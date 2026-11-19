// Double-entry ledger — pure functions, no React, no storage. Integer minor units only.
//
// Journal entries come from two places:
//   1. Posting rules that derive entries from operational records (sales, voids, expenses, day close).
//      They are deterministic: the same records always give the same entries with the same ids,
//      so the ledger can be rebuilt at any time and every line links back to its source (evidence).
//   2. Manual journals the owner or accountant enters (owner investment, loans, assets, bills …),
//      stored as draft → posted, and corrected only by reversal — never edited after posting.

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
/** Where an account sits in statements. */
export type AccountGroup =
  | 'cash' | 'clearing' | 'receivable' | 'inventory' | 'fixed' | 'contra_fixed'
  | 'payable' | 'tax' | 'loan'
  | 'capital' | 'drawings' | 'retained'
  | 'sales' | 'contra_sales' | 'other_income'
  | 'cogs' | 'opex' | 'depreciation' | 'interest' | 'income_tax';

export type Account = { code: string; name: string; type: AccountType; group: AccountGroup; system?: boolean };

export const ACCOUNTS: Account[] = [
  { code: '1000', name: 'Cash on hand', type: 'asset', group: 'cash', system: true },
  { code: '1010', name: 'Card / QR / link — waiting to settle', type: 'asset', group: 'clearing', system: true },
  { code: '1100', name: 'Bank', type: 'asset', group: 'cash', system: true },
  { code: '1200', name: 'Customers owe you (receivable)', type: 'asset', group: 'receivable', system: true },
  { code: '1300', name: 'Stock on hand', type: 'asset', group: 'inventory' },
  { code: '1500', name: 'Equipment', type: 'asset', group: 'fixed' },
  { code: '1590', name: 'Accumulated depreciation', type: 'asset', group: 'contra_fixed' },
  { code: '2000', name: 'You owe suppliers (payable)', type: 'liability', group: 'payable', system: true },
  { code: '2100', name: 'Tax collected — owed', type: 'liability', group: 'tax', system: true },
  { code: '2200', name: 'Loans', type: 'liability', group: 'loan' },
  { code: '3000', name: 'Owner capital', type: 'equity', group: 'capital', system: true },
  { code: '3100', name: 'Owner drawings', type: 'equity', group: 'drawings', system: true },
  { code: '3900', name: 'Retained earnings', type: 'equity', group: 'retained', system: true },
  { code: '4000', name: 'Sales', type: 'revenue', group: 'sales', system: true },
  { code: '4100', name: 'Discounts given', type: 'revenue', group: 'contra_sales', system: true },
  { code: '4900', name: 'Other income', type: 'revenue', group: 'other_income' },
  { code: '5000', name: 'Cost of sales (stock & ingredients)', type: 'expense', group: 'cogs', system: true },
  { code: '6100', name: 'Rent', type: 'expense', group: 'opex' },
  { code: '6200', name: 'Wages', type: 'expense', group: 'opex' },
  { code: '6300', name: 'Utilities', type: 'expense', group: 'opex' },
  { code: '6400', name: 'Transport', type: 'expense', group: 'opex' },
  { code: '6600', name: 'Bank & payment fees', type: 'expense', group: 'opex' },
  { code: '6900', name: 'Other expenses', type: 'expense', group: 'opex' },
  { code: '6950', name: 'Cash over / short', type: 'expense', group: 'opex', system: true },
  { code: '6700', name: 'Depreciation', type: 'expense', group: 'depreciation' },
  { code: '7000', name: 'Interest', type: 'expense', group: 'interest' },
  { code: '7500', name: 'Income tax', type: 'expense', group: 'income_tax' },
];

const BY_CODE = new Map(ACCOUNTS.map((a) => [a.code, a]));
export const accountOf = (code: string): Account => BY_CODE.get(code) ?? { code, name: `Account ${code}`, type: 'expense', group: 'opex' };
/** Debit-normal accounts grow with debits. Contra accounts follow their own sign naturally. */
export const debitNormal = (a: Account) => a.type === 'asset' || a.type === 'expense' || a.group === 'drawings' || a.group === 'contra_sales';

export const EXPENSE_ACCOUNT: Record<string, string> = {
  'Stock / ingredients': '5000',
  Rent: '6100',
  Wages: '6200',
  Utilities: '6300',
  Transport: '6400',
  Other: '6900',
};

export type Line = { account: string; debit: number; credit: number; memo?: string };
export type SourceKind = 'sale' | 'void' | 'expense' | 'day_close' | 'manual' | 'reversal';
export type Entry = {
  id: string;
  date: number; // ms timestamp
  memo: string;
  lines: Line[];
  source: { kind: SourceKind; id: string; ref?: string };
  status: 'draft' | 'posted';
  reversedBy?: string;
  reversalOf?: string;
  createdBy?: string | null;
};

// ---------- operational inputs (structural, so this module never imports the app store) ----------
export type PayPartIn = { method: 'cash' | 'qr' | 'link'; amountMinor: number };
export type SaleIn = {
  id: string;
  receiptNo: string;
  createdAt: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  payment: { method: 'cash' | 'qr' | 'link' | 'split'; parts?: PayPartIn[] };
  voided?: { at: number; reason: string } | null;
};
export type ExpenseIn = { id: string; amountMinor: number; category: string; note: string; createdAt: number };
export type DayIn = { id: string; closedAt?: number; expectedMinor?: number; countedMinor?: number };

// ---------- validation ----------
export type Problem = string;
export function validate(e: Pick<Entry, 'lines'>): Problem[] {
  const p: Problem[] = [];
  if (e.lines.length < 2) p.push('An entry needs at least two lines.');
  let dr = 0;
  let cr = 0;
  for (const l of e.lines) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit)) p.push('Amounts must be whole minor units.');
    if (l.debit < 0 || l.credit < 0) p.push('Amounts cannot be negative.');
    if (l.debit > 0 && l.credit > 0) p.push('A line is either a debit or a credit, not both.');
    if (l.debit === 0 && l.credit === 0) p.push('Remove empty lines.');
    if (!BY_CODE.has(l.account)) p.push(`Unknown account ${l.account}.`);
    dr += l.debit;
    cr += l.credit;
  }
  if (dr !== cr) p.push(`Debits (${dr}) and credits (${cr}) must be equal.`);
  return [...new Set(p)];
}
export const isBalanced = (e: Pick<Entry, 'lines'>) => validate(e).length === 0;

const dr = (account: string, amount: number, memo?: string): Line => ({ account, debit: amount, credit: 0, memo });
const cr = (account: string, amount: number, memo?: string): Line => ({ account, debit: 0, credit: amount, memo });
/** Drop zero lines and merge duplicates so derived entries stay tidy. */
function tidy(lines: Line[]): Line[] {
  const out = new Map<string, Line>();
  for (const l of lines) {
    if (!l.debit && !l.credit) continue;
    const k = `${l.account}|${l.debit ? 'd' : 'c'}`;
    const prev = out.get(k);
    if (prev) { prev.debit += l.debit; prev.credit += l.credit; } else out.set(k, { ...l });
  }
  return [...out.values()];
}

// ---------- posting rules ----------
/** What was received, by account: cash → Cash on hand, QR/link → clearing (staff-confirmed, not bank-confirmed). */
export function receiptsOf(s: SaleIn): { cash: number; clearing: number } {
  let cash = 0;
  let clearing = 0;
  if (s.payment.parts?.length) for (const p of s.payment.parts) {
      if (p.method === 'cash') cash += p.amountMinor;
      else clearing += p.amountMinor;
    }
  else if (s.payment.method === 'cash') cash = s.totalMinor;
  else clearing = s.totalMinor;
  // Split parts that don't add up exactly: the difference sits in cash so the entry still balances and shows up on the cash count.
  const diff = s.totalMinor - cash - clearing;
  return { cash: cash + diff, clearing };
}

/** Sale: Dr cash/clearing (gross), Dr discounts; Cr sales (net of tax, before discount), Cr tax owed. */
export function postSale(s: SaleIn): Entry {
  const { cash, clearing } = receiptsOf(s);
  const sales = s.totalMinor - s.taxMinor + s.discountMinor;
  return {
    id: `sale:${s.id}`,
    date: s.createdAt,
    memo: `Sale ${s.receiptNo}`,
    source: { kind: 'sale', id: s.id, ref: s.receiptNo },
    status: 'posted',
    lines: tidy([dr('1000', cash), dr('1010', clearing), dr('4100', s.discountMinor), cr('4000', sales), cr('2100', s.taxMinor)]),
  };
}

export function reverse(e: Entry, at: number, kind: SourceKind, id: string, memo: string): Entry {
  return {
    id,
    date: at,
    memo,
    source: { kind, id: e.source.id, ref: e.source.ref },
    status: 'posted',
    reversalOf: e.id,
    lines: e.lines.map((l) => ({ account: l.account, debit: l.credit, credit: l.debit, memo: l.memo })),
  };
}

export function postExpense(x: ExpenseIn): Entry {
  const acct = EXPENSE_ACCOUNT[x.category] ?? '6900';
  return {
    id: `expense:${x.id}`,
    date: x.createdAt,
    memo: x.note ? `${x.category} — ${x.note}` : x.category,
    source: { kind: 'expense', id: x.id },
    status: 'posted',
    lines: [dr(acct, x.amountMinor), cr('1000', x.amountMinor)],
  };
}

/** Day close: the difference between counted and expected cash. */
export function postDayClose(d: DayIn): Entry | null {
  if (d.closedAt == null || d.expectedMinor == null || d.countedMinor == null) return null;
  const diff = d.countedMinor - d.expectedMinor;
  if (diff === 0) return null;
  return {
    id: `day:${d.id}`,
    date: d.closedAt,
    memo: diff > 0 ? 'Cash over at day close' : 'Cash short at day close',
    source: { kind: 'day_close', id: d.id },
    status: 'posted',
    lines: diff > 0 ? [dr('1000', diff), cr('6950', diff)] : [dr('6950', -diff), cr('1000', -diff)],
  };
}

/** Every posted entry, derived + manual, sorted by date. Drafts are excluded. */
export function buildJournal(input: { sales: SaleIn[]; expenses: ExpenseIn[]; days: DayIn[]; manual: Entry[] }): Entry[] {
  const out: Entry[] = [];
  for (const s of input.sales) {
    const e = postSale(s);
    if (s.voided) {
      e.reversedBy = `void:${s.id}`;
      out.push(e, reverse(e, s.voided.at, 'void', `void:${s.id}`, `Void ${s.receiptNo}: ${s.voided.reason}`));
    } else out.push(e);
  }
  for (const x of input.expenses) out.push(postExpense(x));
  for (const d of input.days) { const e = postDayClose(d); if (e) out.push(e); }
  for (const m of input.manual) if (m.status === 'posted') out.push(m);
  return out.sort((a, z) => a.date - z.date || a.id.localeCompare(z.id));
}

// ---------- period lock ----------
/** lockedThrough: end-of-day timestamp; nothing dated on or before it may be posted, reversed or removed. */
export const isLocked = (date: number, lockedThrough: number | null | undefined) => lockedThrough != null && date <= lockedThrough;

// ---------- balances ----------
export type Balances = Map<string, { debit: number; credit: number }>;
export function balances(entries: Entry[], from = -Infinity, to = Infinity): Balances {
  const b: Balances = new Map();
  for (const e of entries) {
    if (e.date < from || e.date >= to) continue;
    for (const l of e.lines) {
      const r = b.get(l.account) ?? { debit: 0, credit: 0 };
      r.debit += l.debit;
      r.credit += l.credit;
      b.set(l.account, r);
    }
  }
  return b;
}
/** Signed balance in the account's normal direction (assets/expenses: debit − credit; others: credit − debit). */
export function normal(b: Balances, code: string): number {
  const r = b.get(code);
  if (!r) return 0;
  return debitNormal(accountOf(code)) ? r.debit - r.credit : r.credit - r.debit;
}
const sumGroup = (b: Balances, groups: AccountGroup[]) => ACCOUNTS.filter((a) => groups.includes(a.group)).reduce((s, a) => s + normal(b, a.code), 0);

// ---------- statements ----------
export type TBRow = { account: Account; debit: number; credit: number };
export function trialBalance(entries: Entry[], to = Infinity): { rows: TBRow[]; debit: number; credit: number; balanced: boolean } {
  const b = balances(entries, -Infinity, to);
  const rows: TBRow[] = [];
  for (const a of ACCOUNTS) {
    const r = b.get(a.code);
    if (!r) continue;
    const net = r.debit - r.credit;
    if (net === 0) continue;
    rows.push({ account: a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  }
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, debit, credit, balanced: debit === credit };
}

export type PnL = {
  sales: number; discounts: number; netSales: number; otherIncome: number;
  cogs: number; grossProfit: number; opex: number; opexLines: { account: Account; amount: number }[];
  ebitda: number; depreciation: number; interest: number; incomeTax: number; netProfit: number;
};
export function profitAndLoss(entries: Entry[], from = -Infinity, to = Infinity): PnL {
  const b = balances(entries, from, to);
  const sales = normal(b, '4000');
  const discounts = normal(b, '4100'); // debit-normal contra: positive = discounts given
  const netSales = sales - discounts;
  const otherIncome = sumGroup(b, ['other_income']);
  const cogs = sumGroup(b, ['cogs']);
  const grossProfit = netSales - cogs;
  const opexLines = ACCOUNTS.filter((a) => a.group === 'opex').map((a) => ({ account: a, amount: normal(b, a.code) })).filter((x) => x.amount !== 0);
  const opex = opexLines.reduce((s, x) => s + x.amount, 0);
  const ebitda = grossProfit + otherIncome - opex;
  const depreciation = sumGroup(b, ['depreciation']);
  const interest = sumGroup(b, ['interest']);
  const incomeTax = sumGroup(b, ['income_tax']);
  return { sales, discounts, netSales, otherIncome, cogs, grossProfit, opex, opexLines, ebitda, depreciation, interest, incomeTax, netProfit: ebitda - depreciation - interest - incomeTax };
}

export type BalanceSheet = {
  assets: { account: Account; amount: number }[]; totalAssets: number;
  liabilities: { account: Account; amount: number }[]; totalLiabilities: number;
  equity: { label: string; amount: number }[]; totalEquity: number;
  balanced: boolean;
};
/** As at `to`. Profit to date is shown as current earnings until a year-end close moves it to retained earnings. */
export function balanceSheet(entries: Entry[], to = Infinity): BalanceSheet {
  const b = balances(entries, -Infinity, to);
  const pick = (t: AccountType) => ACCOUNTS.filter((a) => a.type === t).map((a) => ({ account: a, amount: normal(b, a.code) })).filter((x) => x.amount !== 0);
  // contra-fixed is credit-heavy: show it as a negative asset
  const assets = ACCOUNTS.filter((a) => a.type === 'asset').map((a) => {
    const r = b.get(a.code);
    return { account: a, amount: r ? r.debit - r.credit : 0 };
  }).filter((x) => x.amount !== 0);
  const liabilities = pick('liability');
  const capital = normal(b, '3000');
  const drawings = b.get('3100') ? b.get('3100')!.debit - b.get('3100')!.credit : 0;
  const retained = normal(b, '3900');
  const earnings = profitAndLoss(entries, -Infinity, to).netProfit;
  const equity = [
    { label: 'Owner capital', amount: capital },
    { label: 'Owner drawings', amount: -drawings },
    { label: 'Retained earnings', amount: retained },
    { label: 'Profit to date', amount: earnings },
  ].filter((x) => x.amount !== 0);
  const totalAssets = assets.reduce((s, x) => s + x.amount, 0);
  const totalLiabilities = liabilities.reduce((s, x) => s + x.amount, 0);
  const totalEquity = equity.reduce((s, x) => s + x.amount, 0);
  return { assets, totalAssets, liabilities, totalLiabilities, equity, totalEquity, balanced: totalAssets === totalLiabilities + totalEquity };
}

export type CashFlow = { opening: number; operating: number; investing: number; financing: number; closing: number; net: number };
const CASH = new Set(ACCOUNTS.filter((a) => a.group === 'cash').map((a) => a.code));
/** Direct method on Cash on hand + Bank. Clearing is not cash until it settles to the bank. */
export function cashFlow(entries: Entry[], from = -Infinity, to = Infinity): CashFlow {
  const cashOf = (e: Entry) => e.lines.reduce((s, l) => s + (CASH.has(l.account) ? l.debit - l.credit : 0), 0);
  let opening = 0;
  let operating = 0;
  let investing = 0;
  let financing = 0;
  for (const e of entries) {
    if (e.date >= to) continue;
    const delta = cashOf(e);
    if (!delta) continue;
    if (e.date < from) { opening += delta; continue; }
    const others = e.lines.filter((l) => !CASH.has(l.account)).map((l) => accountOf(l.account).group);
    if (others.some((g) => g === 'capital' || g === 'drawings' || g === 'loan')) financing += delta;
    else if (others.some((g) => g === 'fixed' || g === 'contra_fixed')) investing += delta;
    else operating += delta;
  }
  const net = operating + investing + financing;
  return { opening, operating, investing, financing, net, closing: opening + net };
}

export type GLRow = { entry: Entry; line: Line; balance: number };
export function generalLedger(entries: Entry[], code: string, from = -Infinity, to = Infinity): { opening: number; rows: GLRow[]; closing: number } {
  const a = accountOf(code);
  const sign = debitNormal(a) ? 1 : -1;
  let bal = 0;
  let opening = 0;
  const rows: GLRow[] = [];
  for (const e of entries) {
    if (e.date >= to) continue;
    for (const l of e.lines) {
      if (l.account !== code) continue;
      bal += sign * (l.debit - l.credit);
      if (e.date < from) opening = bal;
      else rows.push({ entry: e, line: l, balance: bal });
    }
  }
  return { opening, rows, closing: bal };
}

// ---------- manual entry templates ----------
export type TemplateId =
  | 'owner_in' | 'owner_out' | 'loan_in' | 'loan_repay' | 'equipment' | 'depreciation'
  | 'bank_deposit' | 'settle_clearing' | 'supplier_bill' | 'supplier_pay' | 'tax_pay' | 'custom';
export type Template = { id: TemplateId; label: string; hint: string; build?: (amount: number, opts: { paidFrom: '1000' | '1100'; fee?: number; expense?: string }) => Line[] };
export const TEMPLATES: Template[] = [
  { id: 'owner_in', label: 'Owner puts money in', hint: 'Your own money into the business. This is capital — never sales.', build: (a, o) => [dr(o.paidFrom, a), cr('3000', a)] },
  { id: 'owner_out', label: 'Owner takes money out', hint: 'Drawings for personal use. Not an expense of the business.', build: (a, o) => [dr('3100', a), cr(o.paidFrom, a)] },
  { id: 'loan_in', label: 'Loan received', hint: 'Money borrowed. It is owed back, so it is a liability — not income.', build: (a, o) => [dr(o.paidFrom, a), cr('2200', a)] },
  { id: 'loan_repay', label: 'Loan repayment', hint: 'Repaying the amount borrowed (put interest in its own entry).', build: (a, o) => [dr('2200', a), cr(o.paidFrom, a)] },
  { id: 'equipment', label: 'Buy equipment', hint: 'Fridge, oven, scale, POS hardware … kept as an asset, then depreciated.', build: (a, o) => [dr('1500', a), cr(o.paidFrom, a)] },
  { id: 'depreciation', label: 'Depreciation', hint: 'The part of equipment value used up this period. No cash moves.', build: (a) => [dr('6700', a), cr('1590', a)] },
  { id: 'bank_deposit', label: 'Deposit cash to bank', hint: 'Cash from the drawer paid into the bank.', build: (a) => [dr('1100', a), cr('1000', a)] },
  { id: 'settle_clearing', label: 'QR / card money arrived in bank', hint: 'Match money the bank actually received. Fees go to bank & payment fees.', build: (a, o) => [dr('1100', a - (o.fee ?? 0)), dr('6600', o.fee ?? 0), cr('1010', a)] },
  { id: 'supplier_bill', label: 'Supplier bill (pay later)', hint: 'A bill you will pay later.', build: (a, o) => [dr(o.expense ?? '5000', a), cr('2000', a)] },
  { id: 'supplier_pay', label: 'Pay a supplier', hint: 'Paying a bill entered earlier.', build: (a, o) => [dr('2000', a), cr(o.paidFrom, a)] },
  { id: 'tax_pay', label: 'Pay tax to the authority', hint: 'Paying the tax you collected on sales.', build: (a, o) => [dr('2100', a), cr(o.paidFrom, a)] },
  { id: 'custom', label: 'Custom journal', hint: 'Any balanced entry, for accountants.' },
];
export const templateLines = (id: TemplateId, amount: number, opts: { paidFrom: '1000' | '1100'; fee?: number; expense?: string }) =>
  tidy(TEMPLATES.find((t) => t.id === id)?.build?.(amount, opts) ?? []);
