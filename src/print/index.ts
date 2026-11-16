// Printing service: decides which printer gets what, and falls back to the system print dialog.
import { countryOf } from '../money';
import { printReceipt as printSystemReceipt } from '../receipt';
import { Printer, Sale, Ticket, useApp } from '../store';
import { receiptBytes, testBytes, ticketBytes } from './escpos';
import { sendBytes } from './transports';

export type PrintResult = { ok: true; printed: string[] } | { ok: false; error: string; printed: string[] };

async function toPrinter(p: Printer, bytes: () => Uint8Array, system: () => Promise<void>) {
  if (p.kind === 'system') return system();
  return sendBytes(p.kind, p.address, p.port, bytes());
}

async function run(targets: Printer[], bytes: (p: Printer) => Uint8Array, system: () => Promise<void>): Promise<PrintResult> {
  const printed: string[] = [];
  for (const p of targets) {
    try {
      await toPrinter(p, () => bytes(p), system);
      printed.push(p.name);
    } catch (e: any) {
      return { ok: false, error: `${p.name}: ${e?.message ?? 'printing failed'}`, printed };
    }
  }
  return { ok: true, printed };
}

/** Print a customer receipt. `auto` = only printers set to print automatically. With no printer set up, opens the print dialog. */
export async function printSale(sale: Sale, opts: { auto?: boolean; copy?: boolean } = {}): Promise<PrintResult> {
  const { business: b, printers } = useApp.getState();
  if (!b) return { ok: false, error: 'No business set up.', printed: [] };
  const c = countryOf(b.country);
  const targets = printers.filter((p) => p.receipts && (!opts.auto || p.autoReceipt));
  const system = () => printSystemReceipt(sale, b, c, opts.copy);
  if (!targets.length) {
    if (opts.auto) return { ok: true, printed: [] };
    await system();
    return { ok: true, printed: ['Print dialog'] };
  }
  return run(targets, (p) => receiptBytes(sale, b, c, p.width, { copy: opts.copy, drawer: p.drawer && !opts.copy }), system);
}

/** Print a kitchen / job ticket on every printer marked for the kitchen. */
export async function printTicket(t: Ticket, opts: { auto?: boolean; reprint?: boolean } = {}): Promise<PrintResult> {
  const { business: b, printers } = useApp.getState();
  if (!b) return { ok: false, error: 'No business set up.', printed: [] };
  const targets = printers.filter((p) => p.kitchen && p.kind !== 'system' && (!opts.auto || p.autoKitchen));
  if (!targets.length) return opts.auto ? { ok: true, printed: [] } : { ok: false, error: 'No kitchen printer set up. Add one in Manage → Printers.', printed: [] };
  return run(targets, (p) => ticketBytes(t, b, p.width, opts.reprint), async () => {});
}

export async function testPrint(p: Printer): Promise<PrintResult> {
  return run([p], () => testBytes(p.name, p.width), async () => {
    const { business: b } = useApp.getState();
    const Print = await import('expo-print');
    await Print.printAsync({ html: `<html><body style="font-family:monospace;text-align:center"><h2>tamuko</h2><p>Printer test</p><p>${(b?.name ?? '').replace(/[<>&]/g, '')}</p></body></html>` });
  });
}

export const hasAutoKitchen = () => useApp.getState().printers.some((p) => p.kitchen && p.autoKitchen);
