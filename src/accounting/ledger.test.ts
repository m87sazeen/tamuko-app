// Run: npm run test:accounting   (node:test, native TypeScript stripping — no extra packages)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Entry, type SaleIn, ACCOUNTS, balanceSheet, buildJournal, cashFlow, generalLedger, isLocked,
  postDayClose, postExpense, postSale, profitAndLoss, receiptsOf, templateLines, trialBalance, validate,
} from './ledger.ts';
import { tellStory } from './story.ts';

const T0 = new Date(2026, 10, 10, 12).getTime();
const sale = (over: Partial<SaleIn> = {}): SaleIn => ({
  id: 's1', receiptNo: 'R1', createdAt: T0, subtotalMinor: 1050, discountMinor: 0, taxMinor: 50, totalMinor: 1050,
  payment: { method: 'cash' }, ...over,
});
const manual = (id: string, lines: Entry['lines'], date = T0, status: Entry['status'] = 'posted'): Entry => ({ id, date, memo: id, lines, source: { kind: 'manual', id }, status });

test('chart of accounts has unique codes', () => {
  assert.equal(new Set(ACCOUNTS.map((a) => a.code)).size, ACCOUNTS.length);
});

test('validation rejects unbalanced, negative, mixed and unknown lines', () => {
  assert.deepEqual(validate({ lines: [{ account: '1000', debit: 100, credit: 0 }, { account: '3000', debit: 0, credit: 100 }] }), []);
  assert.ok(validate({ lines: [{ account: '1000', debit: 100, credit: 0 }, { account: '3000', debit: 0, credit: 90 }] }).some((p) => p.includes('equal')));
  assert.ok(validate({ lines: [{ account: '1000', debit: -5, credit: 0 }, { account: '3000', debit: 0, credit: -5 }] }).length > 0);
  assert.ok(validate({ lines: [{ account: '1000', debit: 5, credit: 5 }, { account: '3000', debit: 0, credit: 0 }] }).length > 0);
  assert.ok(validate({ lines: [{ account: '9999', debit: 5, credit: 0 }, { account: '3000', debit: 0, credit: 5 }] }).some((p) => p.includes('Unknown')));
  assert.ok(validate({ lines: [{ account: '1000', debit: 1.5, credit: 0 }, { account: '3000', debit: 0, credit: 1.5 }] }).some((p) => p.includes('whole')));
});

test('cash sale with inclusive tax posts balanced, tax to liability', () => {
  const e = postSale(sale());
  assert.deepEqual(validate(e), []);
  const tb = trialBalance([e]);
  assert.ok(tb.balanced);
  const pl = profitAndLoss([e]);
  assert.equal(pl.netSales, 1000);
  const bs = balanceSheet([e]);
  assert.equal(bs.liabilities.find((l) => l.account.code === '2100')?.amount, 50);
  assert.ok(bs.balanced);
});

test('QR sale goes to clearing, not bank or cash', () => {
  const e = postSale(sale({ payment: { method: 'qr' } }));
  assert.equal(e.lines.find((l) => l.account === '1010')?.debit, 1050);
  assert.equal(e.lines.find((l) => l.account === '1100'), undefined);
  assert.equal(cashFlow([e]).net, 0, 'unsettled QR money is not cash');
});

test('split payment and discount stay balanced', () => {
  const s = sale({ subtotalMinor: 1200, discountMinor: 150, taxMinor: 50, totalMinor: 1050, payment: { method: 'split', parts: [{ method: 'cash', amountMinor: 500 }, { method: 'qr', amountMinor: 550 }] } });
  const e = postSale(s);
  assert.deepEqual(validate(e), []);
  assert.deepEqual(receiptsOf(s), { cash: 500, clearing: 550 });
  const pl = profitAndLoss([e]);
  assert.equal(pl.sales, 1150);
  assert.equal(pl.discounts, 150);
  assert.equal(pl.netSales, 1000);
});

test('void reverses the sale to zero and keeps both entries', () => {
  const j = buildJournal({ sales: [sale({ voided: { at: T0 + 1000, reason: 'wrong item' } })], expenses: [], days: [], manual: [] });
  assert.equal(j.length, 2);
  assert.equal(j[0].reversedBy, j[1].id);
  assert.equal(j[1].reversalOf, j[0].id);
  assert.equal(trialBalance(j).rows.length, 0);
});

test('expense maps category to account and reduces cash', () => {
  const e = postExpense({ id: 'x', amountMinor: 300, category: 'Rent', note: '', createdAt: T0 });
  assert.equal(e.lines[0].account, '6100');
  assert.equal(postExpense({ id: 'y', amountMinor: 10, category: 'Unknown', note: '', createdAt: T0 }).lines[0].account, '6900');
  assert.equal(cashFlow([e]).operating, -300);
});

test('day close posts over / short only when different', () => {
  assert.equal(postDayClose({ id: 'd', closedAt: T0, expectedMinor: 100, countedMinor: 100 }), null);
  const short = postDayClose({ id: 'd', closedAt: T0, expectedMinor: 100, countedMinor: 80 })!;
  assert.equal(short.lines.find((l) => l.account === '6950')?.debit, 20);
  const over = postDayClose({ id: 'd', closedAt: T0, expectedMinor: 100, countedMinor: 130 })!;
  assert.equal(over.lines.find((l) => l.account === '1000')?.debit, 30);
});

test('owner investment is equity and financing — never revenue', () => {
  const e = manual('m1', templateLines('owner_in', 5000, { paidFrom: '1100' }));
  assert.equal(profitAndLoss([e]).netSales, 0);
  assert.equal(profitAndLoss([e]).netProfit, 0);
  const cf = cashFlow([e]);
  assert.equal(cf.financing, 5000);
  assert.equal(cf.operating, 0);
  assert.ok(balanceSheet([e]).balanced);
});

test('loan is a liability, equipment is investing, depreciation is below EBITDA', () => {
  const j = [
    manual('a', templateLines('loan_in', 10000, { paidFrom: '1100' })),
    manual('b', templateLines('equipment', 6000, { paidFrom: '1100' })),
    manual('c', templateLines('depreciation', 500, { paidFrom: '1100' })),
    postSale(sale()),
  ];
  const pl = profitAndLoss(j);
  assert.equal(pl.ebitda, 1000);
  assert.equal(pl.depreciation, 500);
  assert.equal(pl.netProfit, 500);
  const cf = cashFlow(j);
  assert.equal(cf.financing, 10000);
  assert.equal(cf.investing, -6000);
  assert.equal(cf.operating, 1050);
  const bs = balanceSheet(j);
  assert.ok(bs.balanced, JSON.stringify(bs));
  assert.equal(bs.totalLiabilities, 10050);
});

test('settling clearing with a fee moves money to bank and books the fee', () => {
  const j = [postSale(sale({ payment: { method: 'link' } })), manual('s', templateLines('settle_clearing', 1050, { paidFrom: '1100', fee: 30 }), T0 + 5)];
  assert.ok(trialBalance(j).balanced);
  assert.equal(generalLedger(j, '1010').closing, 0);
  assert.equal(generalLedger(j, '1100').closing, 1020);
  assert.equal(profitAndLoss(j).opex, 30);
});

test('drafts are excluded from the journal', () => {
  const j = buildJournal({ sales: [], expenses: [], days: [], manual: [manual('d', templateLines('owner_in', 100, { paidFrom: '1000' }), T0, 'draft')] });
  assert.equal(j.length, 0);
});

test('period lock covers dates on or before the lock', () => {
  assert.ok(isLocked(T0, T0));
  assert.ok(!isLocked(T0 + 1, T0));
  assert.ok(!isLocked(T0, null));
});

test('general ledger running balance and periods', () => {
  const j = [postSale(sale({ id: 'a', createdAt: T0 })), postSale(sale({ id: 'b', createdAt: T0 + 86_400_000 }))];
  const gl = generalLedger(j, '1000', T0 + 1000);
  assert.equal(gl.opening, 1050);
  assert.equal(gl.closing, 2100);
  assert.equal(gl.rows.length, 1);
});

test('story labels pending money and never calls it received', () => {
  const j = [postSale(sale({ payment: { method: 'qr' } }))];
  const story = tellStory({ entries: j, now: T0, fmt: (n) => String(n) });
  const pending = story.find((i) => i.id === 'pending.clearing');
  assert.equal(pending?.kind, 'pending');
  assert.equal(story.at(-1)?.role, 'confidence');
  assert.equal(story[0].role, 'state');
  assert.ok(story.every((i) => ['fact', 'estimate', 'pending'].includes(i.kind)));
});

test('story is deterministic', () => {
  const j = buildJournal({ sales: [sale(), sale({ id: 's2', payment: { method: 'qr' } })], expenses: [{ id: 'e', amountMinor: 900, category: 'Rent', note: '', createdAt: T0 }], days: [], manual: [] });
  const a = tellStory({ entries: j, now: T0, fmt: String });
  const b = tellStory({ entries: j, now: T0, fmt: String });
  assert.deepEqual(a, b);
});
