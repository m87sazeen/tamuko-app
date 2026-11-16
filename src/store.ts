// Local-first domain store (Phase 1: phone-only deployment mode).
// Rules from blueprint 7.4: integer minor units, immutable sale snapshots,
// retry-safe (idempotent) sale IDs, separate sale / payment / ticket state, audit trail.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { computeTax } from './money';
import { newId } from './security';
import { ServiceMode, Service, Step, Template, clone, defaultService, doneIndex, legacySteps, migrateTemplate, payIndex, paysFirst } from './workflow';
import { ALL_FEATURES, Features, Unit } from './catalogue';

export type { Template } from './workflow';
export { TEMPLATES } from './workflow';

export type Business = {
  name: string;
  country: string;
  template: Template;
  typeId?: string; // catalogue business type (street, cafe, laundry, …)
  brandSet?: boolean; // owner set their own name or logo → their brand leads, tamuko shrinks to its mark
  features?: Features; // tools switched on for this business
  service: Service; // ways of serving, tables and the workflow for each
  railEnabled: boolean;
  qrPayload: string; // merchant-owned static QR text (e.g. UPI / PromptPay string)
  qrImage: string | null; // or: photo/screenshot of the bank-issued QR (data URI, resized)
  qrLabel: string;
  logo: string | null; // data URI, resized ≤256px
  receiptFooter: string;
  tax: { enabled: boolean; name: string; rateBp: number; inclusive: boolean; registrationNo: string };
  usd: { show: boolean; localPerUsd: number; updatedAt: number | null; source: 'manual' | 'open.er-api.com' };
  integrations: Record<string, { enabled: boolean; handle: string }>;
  payLink?: string; // merchant's own payment link (bank / wallet / gateway page)
  rewards?: RewardRule;
  createdAt: number;
};

/** "After N purchases of X, give 1 free, valid for D days" (website: tamuko Rewards). itemId null = any item. */
export type RewardRule = { enabled: boolean; itemId: string | null; every: number; validDays: number };

/** Choice group on an item, e.g. Size (one) or Add-ons (many). Price is added to the item price. */
export type ModifierGroup = { id: string; name: string; multi: boolean; options: { name: string; priceMinor: number }[] };

/** Recipe line: how much of an ingredient one item uses. */
export type RecipeLine = { ingredientId: string; qty: number };

export type Ingredient = { id: string; name: string; unit: string; costMinor: number; stock: number; lowAt: number };

export type Customer = { id: string; name: string; phone: string; stamps: number; rewardsEarned: number; visits: number; spentMinor: number; createdAt: number; lastVisitAt: number; note: string };

export type Printer = {
  id: string;
  name: string;
  kind: 'ble' | 'net' | 'system';
  address: string; // Bluetooth device id or IP / hostname
  port: number;
  width: 58 | 80;
  receipts: boolean;
  kitchen: boolean;
  autoReceipt: boolean;
  autoKitchen: boolean;
  drawer: boolean; // kick the cash drawer on cash sales
};

// stock: null = not tracked. lowAt: warn when stock falls to this level.
export type CatalogItem = { id: string; name: string; priceMinor: number; category: string; active: boolean; favorite: boolean; stock?: number | null; lowAt?: number; modifiers?: ModifierGroup[]; recipe?: RecipeLine[]; unit?: Unit; barcode?: string };

/** Job details on an order (laundry tag, plate number, IMEI, measurements …). */
export type JobInfo = { customerId?: string | null; note?: string; dueAt?: number | null };

export type Booking = {
  id: string;
  customerId: string | null;
  name: string; // customer name as typed
  phone: string;
  service: string; // item / class name
  itemId: string | null;
  at: number; // start time
  minutes: number;
  staff: string;
  note: string;
  status: 'booked' | 'arrived' | 'done' | 'noshow' | 'cancelled';
  ticketId?: string | null;
  createdAt: number;
};

export type SaleLine = { itemId: string; name: string; unitMinor: number; qty: number; mods?: string[] }; // immutable snapshot (unit includes modifiers)

export type PaymentMethod = 'cash' | 'qr' | 'link' | 'split';
export type PayPart = { method: 'cash' | 'qr' | 'link'; amountMinor: number };
// "operator_verified" is NOT provider confirmation (KAV-PAY-002).
export type PaymentStatus = 'cash_received' | 'operator_verified';

export type Sale = {
  id: string; // idempotency key generated when checkout opens
  receiptNo: string;
  token: string | null;
  createdAt: number;
  lines: SaleLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  tax: { name: string; rateBp: number; inclusive: boolean } | null; // snapshot
  totalMinor: number;
  currency: string;
  usdRate: number | null; // local-per-USD snapshot shown on the bill
  payment: { method: PaymentMethod; status: PaymentStatus; tenderedMinor?: number; changeMinor?: number; parts?: PayPart[] };
  customerId?: string | null;
  reward?: { name: string; valueMinor: number } | null; // free item redeemed from stamps
  businessName: string;
  userId: string | null;
  mode?: ServiceMode;
  table?: string | null;
  ticketIds?: string[];
  voided?: { at: number; reason: string; by: string | null };
};

// A ticket keeps a copy of the workflow it was created with, so editing the workflow never moves open orders.
export type Ticket = {
  id: string;
  saleId: string | null; // null until paid (pay-later workflows)
  token: string;
  stage: number; // index into steps
  stageAt: number[];
  summary: string;
  createdAt: number;
  steps: Step[];
  mode: ServiceMode;
  table: string | null;
  lines: SaleLine[]; // what was ordered (used to build the bill when paying later)
  job?: JobInfo;
  cancelled?: { at: number; reason: string; by: string | null };
};

/** One trading day: opening cash float and the cash count at close. */
export type DayRecord = {
  id: string;
  openedAt: number;
  openedBy: string | null;
  floatMinor: number;
  closedAt?: number;
  closedBy?: string | null;
  expectedMinor?: number;
  countedMinor?: number;
  note?: string;
};

export type Expense = { id: string; amountMinor: number; category: string; note: string; createdAt: number; userId: string | null };

export type AuditEvent = { id: string; at: number; userId: string | null; action: string; detail: string };

export type LocalUser = {
  id: string;
  provider: 'google' | 'phone' | 'local' | 'line';
  lineId?: string;
  email?: string;
  phone?: string; // E.164
  name: string;
  role: 'owner' | 'cashier';
  createdAt: number;
  lastLoginAt: number;
};

export type ReportLevel = 'simple' | 'standard' | 'advanced';

type State = {
  hydrated: boolean;
  business: Business | null;
  items: CatalogItem[];
  sales: Sale[];
  tickets: Ticket[];
  expenses: Expense[];
  days: DayRecord[];
  ingredients: Ingredient[];
  customers: Customer[];
  printers: Printer[];
  bookings: Booking[];
  audit: AuditEvent[];
  users: LocalUser[];
  currentUserId: string | null;
  pin: { hash: string; salt: string } | null;
  counters: { receiptSeq: number; tokenDay: string; tokenSeq: number };
  settings: { language: string; themeMode: 'system' | 'light' | 'dark'; reportLevel: ReportLevel; reduceMotion: boolean; lastBackupAt: number | null; autoLockMin: number };
};

type Actions = {
  log: (action: string, detail?: string) => void;
  setBusiness: (b: Business) => void;
  updateBusiness: (patch: Partial<Business>) => void;
  addItem: (name: string, priceMinor: number, category?: string) => void;
  updateItem: (id: string, patch: Partial<CatalogItem>) => void;
  completeSale: (draft: { id: string; lines: SaleLine[]; discountMinor: number; method: PaymentMethod; tenderedMinor?: number; parts?: PayPart[]; mode?: ServiceMode; table?: string | null; ticketIds?: string[]; customerId?: string | null; redeem?: boolean; job?: JobInfo }) => Sale;
  saveBooking: (b: Omit<Booking, 'id' | 'createdAt' | 'status'> & { id?: string; status?: Booking['status'] }) => Booking;
  setBookingStatus: (id: string, status: Booking['status'], ticketId?: string | null) => void;
  setFeatures: (patch: Partial<Features>) => void;
  saveIngredient: (i: Omit<Ingredient, 'id'> & { id?: string }) => void;
  removeIngredient: (id: string) => void;
  restockIngredient: (id: string, qty: number) => void;
  saveCustomer: (c: { id?: string; name: string; phone: string; note?: string }) => Customer;
  savePrinter: (p: Omit<Printer, 'id'> & { id?: string }) => void;
  removePrinter: (id: string) => void;
  placeOrder: (o: { lines: SaleLine[]; mode: ServiceMode; table: string | null; job?: JobInfo }) => Ticket;
  cancelOrder: (ticketId: string, reason: string) => void;
  setService: (patch: Partial<Service>) => void;
  openDay: (floatMinor: number) => void;
  closeDay: (countedMinor: number, expectedMinor: number, note: string) => void;
  restock: (itemId: string, qty: number) => void;
  voidSale: (id: string, reason: string) => void;
  advanceTicket: (id: string) => void;
  recallTicket: (id: string) => void;
  addExpense: (amountMinor: number, category: string, note: string) => void;
  removeExpense: (id: string) => void;
  upsertUser: (u: Omit<LocalUser, 'id' | 'createdAt' | 'lastLoginAt' | 'role'>) => LocalUser;
  signOut: () => void;
  setPin: (pin: { hash: string; salt: string } | null) => void;
  setSettings: (patch: Partial<State['settings']>) => void;
  importData: (data: Partial<State>) => void;
  resetAll: () => void;
};

const todayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const initial: State = {
  hydrated: false,
  business: null,
  items: [],
  sales: [],
  tickets: [],
  expenses: [],
  days: [],
  ingredients: [],
  customers: [],
  printers: [],
  bookings: [],
  audit: [],
  users: [],
  currentUserId: null,
  pin: null,
  counters: { receiptSeq: 0, tokenDay: '', tokenSeq: 0 },
  settings: { language: '', themeMode: 'system', reportLevel: 'simple', reduceMotion: false, lastBackupAt: null, autoLockMin: 5 },
};

export const PERSIST_KEYS = ['business', 'items', 'sales', 'tickets', 'expenses', 'days', 'ingredients', 'customers', 'printers', 'bookings', 'audit', 'users', 'counters', 'settings'] as const;

/** How much of a sale was paid by each method (split payments count per part). */
export function paidBy(s: Sale): Record<'cash' | 'qr' | 'link', number> {
  const out = { cash: 0, qr: 0, link: 0 };
  if (s.payment.parts?.length) s.payment.parts.forEach((p) => (out[p.method] += p.amountMinor));
  else if (s.payment.method !== 'split') out[s.payment.method] += s.totalMinor;
  return out;
}

/** Stamps a set of lines earns under the reward rule. */
export function stampsFor(lines: SaleLine[], rule?: RewardRule): number {
  if (!rule?.enabled || rule.every < 1) return 0;
  return lines.filter((l) => !rule.itemId || l.itemId === rule.itemId).reduce((a, l) => a + l.qty, 0);
}

/** Next daily token: letter + 3 digits (A-001 … A-999, then B-001 …), reset each day. */
function nextToken(c: State['counters']) {
  const day = todayKey();
  const tokenSeq = c.tokenDay === day ? c.tokenSeq + 1 : 1;
  const token = `${String.fromCharCode(65 + (Math.floor((tokenSeq - 1) / 999) % 26))}-${String(((tokenSeq - 1) % 999) + 1).padStart(3, '0')}`;
  return { token, counters: { ...c, tokenDay: day, tokenSeq } };
}

const summaryOf = (lines: SaleLine[]) => lines.map((l) => `${l.qty}× ${l.name}`).join(', ');

/** Open = not finished and not cancelled. */
export const isOpen = (t: Ticket) => !t.cancelled && t.stage < doneIndex(t.steps);
export const isUnpaid = (t: Ticket) => !t.cancelled && !t.saleId;

/** Move a ticket forward one step, auto-finishing when payment is the last thing before "done". */
function stepAfterPay(t: Ticket, now: number): Ticket {
  const pi = payIndex(t.steps);
  let tk = t;
  if (tk.stage < pi) tk = { ...tk, stage: pi, stageAt: [...tk.stageAt, now] };
  if (tk.stage === pi && pi === doneIndex(tk.steps) - 1) tk = { ...tk, stage: pi + 1, stageAt: [...tk.stageAt, now] };
  return tk;
}

export const useApp = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      log: (action, detail = '') =>
        set((s) => ({ audit: [{ id: newId(), at: Date.now(), userId: s.currentUserId, action, detail }, ...s.audit].slice(0, 2000) })),

      setBusiness: (b) => {
        set({ business: { ...b, createdAt: b.createdAt || Date.now() } });
        get().log('business.setup', b.name);
      },
      updateBusiness: (patch) => {
        const b = get().business;
        if (!b) return;
        set({ business: { ...b, ...patch } });
        get().log('business.update', Object.keys(patch).join(','));
      },

      addItem: (name, priceMinor, category = '') => {
        set((s) => ({ items: [...s.items, { id: newId(), name: name.trim(), priceMinor, category, active: true, favorite: false }] }));
        get().log('catalog.add', name);
      },
      updateItem: (id, patch) => {
        // Editing an item never rewrites history: sales keep their own line snapshots.
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
        get().log('catalog.update', `${id}:${Object.keys(patch).join(',')}`);
      },

      completeSale: (draft) => {
        const s = get();
        const existing = s.sales.find((x) => x.id === draft.id);
        if (existing) return existing; // idempotent: retry/double-tap never duplicates the sale (KAV-POS-003)
        const b = s.business!;
        const subtotal = draft.lines.reduce((a, l) => a + l.unitMinor * l.qty, 0);
        const discount = Math.min(Math.max(0, draft.discountMinor), subtotal);
        const taxCfg = b.tax.enabled && b.tax.rateBp > 0 ? { name: b.tax.name, rateBp: b.tax.rateBp, inclusive: b.tax.inclusive } : null;
        const { taxMinor, totalMinor: total } = computeTax(subtotal - discount, taxCfg?.rateBp ?? 0, taxCfg?.inclusive ?? true);
        const day = todayKey();
        const receiptSeq = s.counters.receiptSeq + 1;
        const mode = draft.mode ?? b.service.defaultMode;
        const now = Date.now();
        let counters = { ...s.counters, receiptSeq };
        let tickets = s.tickets;
        let token: string | null = null;
        const ticketIds = draft.ticketIds?.filter((id) => s.tickets.some((t) => t.id === id && isUnpaid(t))) ?? [];
        const saleId = draft.id;

        if (ticketIds.length) {
          // Paying for orders already on the rail (pay later): mark them paid and move them past the payment step.
          token = s.tickets.find((t) => t.id === ticketIds[0])!.token;
          tickets = s.tickets.map((t) => (ticketIds.includes(t.id) ? stepAfterPay({ ...t, saleId }, now) : t));
        } else if (b.railEnabled) {
          // Pay first: the ticket starts on the rail already paid.
          const steps = clone(b.service.flows[mode]);
          const nt = nextToken(counters);
          token = nt.token;
          counters = { ...nt.counters, receiptSeq };
          const pi = Math.max(0, payIndex(steps));
          let tk: Ticket = { id: newId(), saleId, token, stage: pi, stageAt: Array.from({ length: pi + 1 }, () => now), summary: summaryOf(draft.lines), createdAt: now, steps, mode, table: draft.table ?? null, lines: draft.lines.map((l) => ({ ...l })), job: draft.job ?? (draft.customerId ? { customerId: draft.customerId } : undefined) };
          if (!paysFirst(steps)) tk = stepAfterPay(tk, now); // e.g. a pay-later flow paid immediately at the till
          tickets = [...s.tickets, tk];
        }

        const sale: Sale = {
          id: saleId,
          receiptNo: `R${day.replace(/-/g, '')}-${String(receiptSeq).padStart(5, '0')}`,
          token,
          createdAt: now,
          lines: draft.lines.map((l) => ({ ...l })),
          subtotalMinor: subtotal,
          discountMinor: discount,
          taxMinor,
          tax: taxCfg,
          totalMinor: total,
          currency: b.country,
          usdRate: b.usd.show && b.usd.localPerUsd > 0 ? b.usd.localPerUsd : null,
          payment:
            draft.method === 'cash'
              ? { method: 'cash', status: 'cash_received', tenderedMinor: draft.tenderedMinor ?? total, changeMinor: Math.max(0, (draft.tenderedMinor ?? total) - total) }
              : draft.method === 'split'
                ? { method: 'split', status: draft.parts?.every((x) => x.method === 'cash') ? 'cash_received' : 'operator_verified', parts: draft.parts?.map((x) => ({ ...x })) }
                : { method: draft.method, status: 'operator_verified' },
          customerId: draft.customerId ?? null,
          reward: null,
          businessName: b.name,
          userId: s.currentUserId,
          mode,
          table: draft.table ?? null,
          ticketIds: ticketIds.length ? ticketIds : undefined,
        };
        // Rewards: a redeemed free item is shown as its own discount; stamps are earned on paid items.
        const rule = b.rewards;
        let customers = s.customers;
        const cust = draft.customerId ? s.customers.find((x) => x.id === draft.customerId) : null;
        if (cust) {
          let stamps = cust.stamps;
          let earned = cust.rewardsEarned;
          if (draft.redeem && rule?.enabled && stamps >= rule.every) {
            stamps -= rule.every;
            earned += 1;
            const freeItem = s.items.find((i) => i.id === rule.itemId) ?? null;
            sale.reward = { name: freeItem ? freeItem.name : 'Reward', valueMinor: discount };
          }
          stamps += stampsFor(draft.lines, rule);
          customers = s.customers.map((x) => (x.id === cust.id ? { ...x, stamps, rewardsEarned: earned, visits: x.visits + 1, spentMinor: x.spentMinor + total, lastVisitAt: now } : x));
        }
        // Stock: deduct tracked items and recipe ingredients once, when the sale is paid.
        const used = new Map<string, number>();
        draft.lines.forEach((l) => used.set(l.itemId, (used.get(l.itemId) ?? 0) + l.qty));
        const items = s.items.map((i) => (i.stock != null && used.has(i.id) ? { ...i, stock: i.stock - used.get(i.id)! } : i));
        const ingUse = new Map<string, number>();
        s.items.forEach((i) => i.recipe?.forEach((r) => used.has(i.id) && ingUse.set(r.ingredientId, (ingUse.get(r.ingredientId) ?? 0) + r.qty * used.get(i.id)!)));
        const ingredients = s.ingredients.map((g) => (ingUse.has(g.id) ? { ...g, stock: Math.round((g.stock - ingUse.get(g.id)!) * 1000) / 1000 } : g));
        set({ sales: [sale, ...s.sales], tickets, counters, items, ingredients, customers });
        get().log('sale.complete', `${sale.receiptNo} ${sale.payment.method}${sale.table ? ' ' + sale.table : ''}`);
        return sale;
      },

      saveIngredient: (g) => {
        set((s) => ({ ingredients: g.id ? s.ingredients.map((x) => (x.id === g.id ? { ...x, ...g, id: x.id } : x)) : [...s.ingredients, { ...g, id: newId() }] }));
        get().log('stock.ingredient', g.name);
      },
      removeIngredient: (id) => {
        set((s) => ({ ingredients: s.ingredients.filter((x) => x.id !== id), items: s.items.map((i) => (i.recipe ? { ...i, recipe: i.recipe.filter((r) => r.ingredientId !== id) } : i)) }));
        get().log('stock.ingredient_remove', id);
      },
      restockIngredient: (id, qty) => {
        set((s) => ({ ingredients: s.ingredients.map((x) => (x.id === id ? { ...x, stock: Math.round((x.stock + qty) * 1000) / 1000 } : x)) }));
        get().log('stock.ingredient_restock', `${id} +${qty}`);
      },
      saveCustomer: (c) => {
        const s = get();
        const now = Date.now();
        const existing = c.id ? s.customers.find((x) => x.id === c.id) : s.customers.find((x) => c.phone && x.phone === c.phone);
        const cust: Customer = existing
          ? { ...existing, name: c.name, phone: c.phone, note: c.note ?? existing.note }
          : { id: newId(), name: c.name, phone: c.phone, note: c.note ?? '', stamps: 0, rewardsEarned: 0, visits: 0, spentMinor: 0, createdAt: now, lastVisitAt: now };
        set({ customers: existing ? s.customers.map((x) => (x.id === cust.id ? cust : x)) : [...s.customers, cust] });
        get().log(existing ? 'customer.update' : 'customer.add', cust.id);
        return cust;
      },
      savePrinter: (pr) => {
        set((s) => ({ printers: pr.id ? s.printers.map((x) => (x.id === pr.id ? { ...x, ...pr, id: x.id } : x)) : [...s.printers, { ...pr, id: newId() }] }));
        get().log('printer.save', pr.name);
      },
      removePrinter: (id) => {
        set((s) => ({ printers: s.printers.filter((x) => x.id !== id) }));
        get().log('printer.remove', id);
      },

      saveBooking: (bk) => {
        const s = get();
        const full: Booking = bk.id
          ? { ...s.bookings.find((x) => x.id === bk.id)!, ...bk, id: bk.id }
          : { ...bk, id: newId(), status: bk.status ?? 'booked', createdAt: Date.now() } as Booking;
        set({ bookings: bk.id ? s.bookings.map((x) => (x.id === bk.id ? full : x)) : [...s.bookings, full].slice(-3000) });
        get().log(bk.id ? 'booking.update' : 'booking.add', full.id);
        return full;
      },
      setBookingStatus: (id, status, ticketId) => {
        set((s) => ({ bookings: s.bookings.map((x) => (x.id === id ? { ...x, status, ticketId: ticketId ?? x.ticketId } : x)) }));
        get().log('booking.' + status, id);
      },
      setFeatures: (patch) => {
        const b = get().business;
        if (!b) return;
        set({ business: { ...b, features: { ...(b.features ?? ALL_FEATURES), ...patch } } });
        get().log('features.update', Object.keys(patch).join(','));
      },

      placeOrder: ({ lines, mode, table, job }) => {
        const s = get();
        const b = s.business!;
        const steps = clone(b.service.flows[mode]);
        const nt = nextToken(s.counters);
        const now = Date.now();
        const tk: Ticket = { id: newId(), saleId: null, token: nt.token, stage: 0, stageAt: [now], summary: summaryOf(lines), createdAt: now, steps, mode, table, lines: lines.map((l) => ({ ...l })), job };
        set({ tickets: [...s.tickets, tk], counters: nt.counters });
        get().log('order.place', `${tk.token} ${mode}${table ? ' ' + table : ''}`);
        return tk;
      },
      cancelOrder: (ticketId, reason) => {
        set((s) => ({ tickets: s.tickets.map((t) => (t.id === ticketId && isUnpaid(t) ? { ...t, cancelled: { at: Date.now(), reason, by: s.currentUserId } } : t)) }));
        get().log('order.cancel', `${ticketId}: ${reason}`);
      },
      setService: (patch) => {
        const b = get().business;
        if (!b) return;
        set({ business: { ...b, service: { ...b.service, ...patch } } });
        get().log('workflow.update', Object.keys(patch).join(','));
      },
      openDay: (floatMinor) => {
        const s = get();
        if (s.days.some((d) => !d.closedAt)) return;
        set({ days: [{ id: newId(), openedAt: Date.now(), openedBy: s.currentUserId, floatMinor }, ...s.days].slice(0, 400) });
        get().log('day.open', String(floatMinor));
      },
      closeDay: (countedMinor, expectedMinor, note) => {
        set((s) => ({ days: s.days.map((d) => (!d.closedAt ? { ...d, closedAt: Date.now(), closedBy: s.currentUserId, countedMinor, expectedMinor, note } : d)) }));
        get().log('day.close', `counted ${countedMinor} expected ${expectedMinor}`);
      },
      restock: (itemId, qty) => {
        set((s) => ({ items: s.items.map((i) => (i.id === itemId ? { ...i, stock: (i.stock ?? 0) + qty } : i)) }));
        get().log('stock.restock', `${itemId} +${qty}`);
      },

      voidSale: (id, reason) => {
        set((s) => ({
          sales: s.sales.map((x) => (x.id === id && !x.voided ? { ...x, voided: { at: Date.now(), reason, by: s.currentUserId } } : x)),
          tickets: s.tickets.filter((t) => t.saleId !== id),
        }));
        get().log('sale.void', `${id}: ${reason}`);
      },

      advanceTicket: (id) => {
        // The payment step can only be passed by taking payment (completeSale with this ticket).
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === id && isOpen(t) && !(t.steps[t.stage + 1]?.kind === 'pay' && !t.saleId) ? { ...t, stage: t.stage + 1, stageAt: [...t.stageAt, Date.now()] } : t,
          ),
        }));
        get().log('ticket.advance', id);
      },
      recallTicket: (id) => {
        set((s) => ({
          // Never step back over the payment step: a paid ticket stays paid.
          tickets: s.tickets.map((t) => (t.id === id && t.stage > 0 && t.steps[t.stage].kind !== 'pay' ? { ...t, stage: t.stage - 1, stageAt: t.stageAt.slice(0, -1) } : t)),
        }));
        get().log('ticket.recall', id);
      },

      addExpense: (amountMinor, category, note) => {
        set((s) => ({ expenses: [{ id: newId(), amountMinor, category, note, createdAt: Date.now(), userId: s.currentUserId }, ...s.expenses] }));
        get().log('expense.add', `${category} ${amountMinor}`);
      },
      removeExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
        get().log('expense.remove', id);
      },

      upsertUser: (u) => {
        const s = get();
        const match = s.users.find((x) => (u.email && x.email === u.email) || (u.phone && x.phone === u.phone) || (u.provider === 'local' && x.provider === 'local') || (!!u.lineId && x.lineId === u.lineId));
        // Security: once a device has an owner, unknown identities cannot sign in and read its data.
        // (Inviting staff needs the cloud tier, where the owner approves new members.)
        if (!match && s.users.length > 0) {
          get().log('auth.rejected_unknown', u.provider);
          throw new Error('This device belongs to another account. Sign in with the owner’s mobile number or Gmail.');
        }
        const now = Date.now();
        const user: LocalUser = match
          ? { ...match, ...u, name: u.name || match.name, lastLoginAt: now }
          : { ...u, id: newId(), role: s.users.length === 0 ? 'owner' : 'cashier', createdAt: now, lastLoginAt: now };
        set({ users: match ? s.users.map((x) => (x.id === user.id ? user : x)) : [...s.users, user], currentUserId: user.id });
        get().log(match ? 'auth.signin' : 'auth.signup', `${u.provider}`);
        return user;
      },
      signOut: () => {
        get().log('auth.signout');
        set({ currentUserId: null });
      },
      setPin: (pin) => {
        set({ pin });
        get().log(pin ? 'security.pin_set' : 'security.pin_removed');
      },
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      importData: (data) => {
        const pick: Partial<State> = {};
        for (const k of PERSIST_KEYS) if (k in data) (pick as any)[k] = (data as any)[k];
        set(migrateState(pick as any));
        get().log('backup.restore');
      },
      resetAll: () => set({ ...initial, hydrated: true }),
    }),
    {
      name: 'tamuko-v1',
      version: 4,
      migrate: (persisted: any) => migrateState(persisted ?? {}),
      storage: createJSONStorage(() => AsyncStorage),
      // currentUserId/pin persisted so the device can lock rather than forcing re-signup.
      partialize: (s) => {
        const out: any = { currentUserId: s.currentUserId, pin: s.pin };
        for (const k of PERSIST_KEYS) out[k] = (s as any)[k];
        return out;
      },
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

/** v1 → v2: business types, workflows per serving mode, tickets that carry their own flow. */
export function migrateState(st: any): any {
  const out = { ...st };
  if (out.business && !out.business.service) {
    const template = migrateTemplate(out.business.template);
    const service = defaultService(template, template === 'restaurant' ? 12 : 0);
    // Existing businesses kept paying first with their old stage names.
    const legacy = legacySteps(out.business.stages ?? []);
    service.flows.takeaway = [legacy[0], { name: 'Paid', kind: 'pay' }, ...legacy.slice(1)];
    service.presetIds.takeaway = 'custom';
    const { stages: _drop, ...rest } = out.business;
    out.business = { ...rest, template, service };
  }
  if (Array.isArray(out.tickets))
    out.tickets = out.tickets.map((t: any) => (t.steps ? t : { ...t, steps: legacySteps(st.business?.stages ?? []), mode: 'takeaway', table: null, lines: [] }));
  for (const k of ['days', 'ingredients', 'customers', 'printers', 'bookings']) if (!Array.isArray(out[k])) out[k] = [];
  if (out.business && !out.business.typeId) {
    const map: Record<string, string> = { stall: 'street', cafe: 'cafe', restaurant: 'restaurant', retail: 'grocery', service: 'laundry' };
    out.business = { ...out.business, typeId: map[out.business.template] ?? 'cafe', features: { ...ALL_FEATURES } };
  }
  return out;
}

export { todayKey };
