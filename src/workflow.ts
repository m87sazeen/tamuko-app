// Business workflows: how an order moves from "taken" to "done" for each way the business serves.
// A flow is an ordered list of steps. Exactly one step is the payment step, and where it sits decides
// whether customers pay first (street stall) or at the end (dine-in, laundry pick-up).
// Every business starts from a preset that fits its type; owners can rename, add, remove and reorder
// steps, or move the payment step, at any time. Open tickets keep the flow they were created with.

export type ServiceMode = 'takeaway' | 'dinein';
export type StepKind = 'order' | 'work' | 'pay' | 'done';
export type Step = { name: string; kind: StepKind };

export type Template = 'stall' | 'cafe' | 'restaurant' | 'retail' | 'service';

export type Service = {
  modes: ServiceMode[]; // enabled ways of serving
  defaultMode: ServiceMode;
  tables: string[]; // dine-in needs at least one table; with none, everything is take away
  flows: Record<ServiceMode, Step[]>;
  presetIds: Record<ServiceMode, string>; // which preset each flow came from ('custom' once edited)
};

const o = (name: string): Step => ({ name, kind: 'order' });
const w = (name: string): Step => ({ name, kind: 'work' });
const p = (name = 'Paid'): Step => ({ name, kind: 'pay' });
const d = (name: string): Step => ({ name, kind: 'done' });

export type Preset = { id: string; mode: ServiceMode; label: string; hint: string; steps: Step[] };

export const PRESETS: Preset[] = [
  // Take away / counter
  { id: 'pay-first', mode: 'takeaway', label: 'Pay first', hint: 'Street stalls and food trucks: take the money, then make it.', steps: [o('Order'), p(), w('Preparing'), w('Ready'), d('Collected')] },
  { id: 'pay-on-pickup', mode: 'takeaway', label: 'Pay on pickup', hint: 'Regulars and phone orders: make it, take the money when they collect.', steps: [o('Order'), w('Preparing'), w('Ready'), p(), d('Collected')] },
  { id: 'hand-over', mode: 'takeaway', label: 'Pay and hand over', hint: 'Ready-made items: no preparing step.', steps: [o('Order'), p(), d('Collected')] },
  // Dine in
  { id: 'pay-at-end', mode: 'dinein', label: 'Pay at the end', hint: 'Restaurants: serve the table, bring the bill when they finish.', steps: [o('Order'), w('Preparing'), w('Served'), p(), d('Closed')] },
  { id: 'dine-pay-first', mode: 'dinein', label: 'Pay at the counter', hint: 'Cafés: order and pay at the counter, food is brought to the table.', steps: [o('Order'), p(), w('Preparing'), d('Served')] },
  // Services (laundry, repair) use the take-away mode with job wording
  { id: 'job-pay-on-pickup', mode: 'takeaway', label: 'Pay on pickup', hint: 'Laundry and repairs: take the job, charge when it is collected.', steps: [o('Received'), w('In progress'), w('Ready'), p(), d('Collected')] },
  { id: 'job-pay-first', mode: 'takeaway', label: 'Pay at drop-off', hint: 'Fixed-price jobs: charge first, then do the work.', steps: [o('Received'), p(), w('In progress'), w('Ready'), d('Collected')] },
];

export const presetById = (id: string) => PRESETS.find((x) => x.id === id);

export const PRESETS_FOR: Record<Template, Record<ServiceMode, string[]>> = {
  stall: { takeaway: ['pay-first', 'pay-on-pickup', 'hand-over'], dinein: ['dine-pay-first', 'pay-at-end'] },
  cafe: { takeaway: ['pay-first', 'pay-on-pickup', 'hand-over'], dinein: ['dine-pay-first', 'pay-at-end'] },
  restaurant: { takeaway: ['pay-first', 'pay-on-pickup'], dinein: ['pay-at-end', 'dine-pay-first'] },
  retail: { takeaway: ['hand-over', 'pay-first'], dinein: [] },
  service: { takeaway: ['job-pay-on-pickup', 'job-pay-first'], dinein: [] },
};

export const TEMPLATES: Record<Template, { label: string; hint: string; rail: boolean; modes: ServiceMode[]; defaultMode: ServiceMode; tables: number; samples: [string, string][] }> = {
  stall: { label: 'Street stall / food truck', hint: 'Take away only. Pay first, then make it.', rail: true, modes: ['takeaway'], defaultMode: 'takeaway', tables: 0, samples: [['Karak chai', '1'], ['Egg paratha', '5']] },
  cafe: { label: 'Café / counter', hint: 'Take away and a few tables.', rail: true, modes: ['takeaway', 'dinein'], defaultMode: 'takeaway', tables: 6, samples: [['Flat white', '14'], ['Croissant', '9']] },
  restaurant: { label: 'Restaurant', hint: 'Tables first, take away too. Bill at the end.', rail: true, modes: ['dinein', 'takeaway'], defaultMode: 'dinein', tables: 12, samples: [['Chicken biryani', '28'], ['Fresh lime', '8']] },
  retail: { label: 'Shop / minimart', hint: 'Quick checkout. No kitchen rail.', rail: false, modes: ['takeaway'], defaultMode: 'takeaway', tables: 0, samples: [['Water 500ml', '2'], ['Bread', '5']] },
  service: { label: 'Laundry / repair / services', hint: 'Job tickets. Charge on pickup.', rail: true, modes: ['takeaway'], defaultMode: 'takeaway', tables: 0, samples: [['Wash & fold (kg)', '8'], ['Screen repair', '150']] },
};

export const MODE_LABEL: Record<ServiceMode, string> = { takeaway: 'Take away', dinein: 'Dine in' };

/** Label for the take-away mode for service businesses ("Walk-in job"). */
export const modeLabel = (mode: ServiceMode, tpl: Template) => (mode === 'takeaway' && tpl === 'service' ? 'Job' : MODE_LABEL[mode]);

export const tableNames = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`);

export function defaultService(tpl: Template, tables = TEMPLATES[tpl].tables): Service {
  const T = TEMPLATES[tpl];
  const tb = tableNames(tables);
  const modes = T.modes.filter((m) => m !== 'dinein' || tb.length > 0);
  const safeModes: ServiceMode[] = modes.length ? modes : ['takeaway'];
  const pick = (m: ServiceMode) => PRESETS_FOR[tpl][m][0] ?? (m === 'dinein' ? 'pay-at-end' : 'pay-first');
  return {
    modes: safeModes,
    defaultMode: safeModes.includes(T.defaultMode) ? T.defaultMode : safeModes[0],
    tables: tb,
    flows: { takeaway: clone(presetById(pick('takeaway'))!.steps), dinein: clone(presetById(pick('dinein'))!.steps) },
    presetIds: { takeaway: pick('takeaway'), dinein: pick('dinein') },
  };
}

export const clone = (s: Step[]) => s.map((x) => ({ ...x }));

/** Modes the till can actually offer right now: dine-in needs tables, otherwise everything is take away. */
export function activeModes(sv: Service): ServiceMode[] {
  const m = sv.modes.filter((x) => x !== 'dinein' || sv.tables.length > 0);
  return m.length ? m : ['takeaway'];
}

export const payIndex = (steps: Step[]) => steps.findIndex((s) => s.kind === 'pay');
export const doneIndex = (steps: Step[]) => steps.length - 1;
/** Pay first = the payment step comes straight after the order, so checkout happens at the till. */
export const paysFirst = (steps: Step[]) => payIndex(steps) === 1;

/** Checks a custom flow. Returns a plain-language problem, or null when it is valid. */
export function validateFlow(steps: Step[]): string | null {
  if (steps.length < 3) return 'A workflow needs at least an order, a payment and a final step.';
  if (steps[0].kind !== 'order') return 'The first step must be the order.';
  if (steps[steps.length - 1].kind !== 'done') return 'The last step must be the finishing step.';
  if (steps.filter((s) => s.kind === 'pay').length !== 1) return 'There must be exactly one payment step.';
  if (steps.some((s) => !s.name.trim())) return 'Every step needs a name.';
  const names = steps.map((s) => s.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return 'Two steps have the same name.';
  return null;
}

/** Plain sentence for a flow, e.g. "Order → Paid → Preparing → Ready → Collected". */
export const describe = (steps: Step[]) => steps.map((s) => s.name).join(' → ');

/** Rail lanes: every step a ticket can wait in (not the final one), across the active flows,
 *  ordered by how far along its workflow each step sits (order first, finishing steps last). */
export function laneNames(flows: Step[][]): string[] {
  const rank = new Map<string, number>();
  for (const steps of flows) {
    const pi = payIndex(steps);
    const start = pi === 1 ? 1 : 0; // pay-first tickets arrive already paid
    steps.slice(start, -1).forEach((s, i) => {
      const r = (i + start) / Math.max(1, steps.length - 1);
      rank.set(s.name, Math.min(rank.get(s.name) ?? 1, r));
    });
  }
  return [...rank.entries()].sort((x, y) => x[1] - y[1]).map(([n]) => n);
}

/** Map a legacy (v1) template to the new types. */
export const migrateTemplate = (t: string): Template => (t === 'food' ? 'cafe' : (t as Template) in TEMPLATES ? (t as Template) : 'cafe');

/** Flow for tickets created before workflows existed (Received → Preparing → Ready → Collected, paid up front). */
export const legacySteps = (stages: string[]): Step[] => [o(stages[0] ?? 'Received'), w(stages[1] ?? 'Preparing'), w(stages[2] ?? 'Ready'), d(stages[3] ?? 'Collected')];
