# TNDL 1.0 — assessment & gap analysis

Inspected: `src/store.ts`, `src/screens/Reports.tsx`, `src/money.ts`, `App.tsx`, `src/components/ui.tsx`.

## What already exists (kept, not rebuilt)

| Area | Status |
|---|---|
| Money | Integer minor units, per-country currency/decimals, tax inclusive/exclusive (`computeTax`) |
| Sales | Immutable line snapshots, idempotent sale IDs, split payments, voids with reason + audit |
| Payment honesty | QR/link payments are `operator_verified`, never treated as provider-confirmed |
| Expenses | Category, note, user, timestamp |
| Day close | Opening float, expected vs counted cash |
| Reports | Simple / Standard / Advanced levels, recipe-based cost estimate, CSV export, audit log |
| Roles | Owner / cashier |
| Typography | Inter, Bricolage Grotesque, Instrument Serif, JetBrains Mono, Fredoka — unchanged |

## Gaps vs the spec and what this increment does

| Spec item | Before | This increment |
|---|---|---|
| Double-entry ledger | None — reports summed sales/expenses directly | `src/accounting/ledger.ts`: chart of accounts, balanced journal entries, validation |
| Posting rules | — | Deterministic rules for cash sale, QR/link sale (to *clearing*, not bank), discounts, tax, voids (reversal), expenses, cash over/short at day close |
| Manual journals | — | Draft / posted / reversed, templates: owner investment, drawings, loan in/out, equipment, depreciation, bank deposit, settlement of clearing, supplier bill + payment, tax payment |
| Period locks | — | `lockedThrough` date: posting, reversing and expense removal blocked in locked periods |
| Statements | — | Trial balance, P&L, balance sheet (with check), cash flow (operating/investing/financing), general ledger |
| EBITDA | — | Shown separately from net profit and from cash, labelled "not money in the bank" |
| Owner investment ≠ revenue | — | Posts to Owner capital (equity), never revenue |
| Story Engine | Plain text in Simple report | `src/accounting/story.ts`: STATE / TREND / INSIGHT / ACTION / CONFIDENCE, each insight tagged `fact` / `estimate` / `pending` with evidence |
| Finance Overview | — | Reports → Finance: hero insight + cash, waiting to settle, tax owed, profit, EBITDA |
| Professional workspace | — | Finance → Accounting (owners only): journal, ledger, statements, new entry, period lock |
| Tests | None | `npm run test:accounting` (node:test) |

## Not in this increment (honest list)

- Accounts receivable / payable **sub-ledgers with aging per customer/supplier** — AP/AR accounts exist and post, aging screens do not.
- Bank statement import and line-by-line reconciliation — only the "settle clearing to bank" entry.
- Fixed-asset register with automatic depreciation schedules — depreciation is a manual entry.
- Multi-rate tax and tax returns.
- Floating pill bottom navigation and the Ivory/Navy/Copper/Mocha/Sand palette — **conflicts with brand guidelines v1.0** (peach/steel/charcoal/cream); waiting on the owner's decision, not changed.
- Follow-up ladders and automations — no automation is claimed as done.
- Inventory as an asset (perpetual) — stock purchases post to cost of sales (periodic method); recipe COGS stays a labelled estimate in Reports.
