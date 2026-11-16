// ESC/POS command builder for 58 mm (32 columns) and 80 mm (48 columns) thermal receipt printers.
// Works with almost every cheap Bluetooth / Wi-Fi / LAN receipt printer (Epson-compatible command set).
// Text is sent in code page PC437/Latin. Scripts the printer cannot draw (Arabic, Thai, CJK …) are
// replaced, so the app offers the system print dialog for full-language receipts.
import { Country, formatMoney, pctLabel, usdEquivalent } from '../money';
import { paidLine } from '../receipt';
import type { Business, Sale, Ticket } from '../store';

const ESC = 0x1b;
const GS = 0x1d;

export type PaperWidth = 58 | 80;
export const columns = (w: PaperWidth) => (w === 80 ? 48 : 32);

/** True if every character can be printed by a basic ESC/POS printer. */
export const isPrintable = (s: string) => /^[\x20-\x7E\n]*$/.test(toAscii(s));

/** Fold accents (é → e) and drop anything the printer cannot draw. */
export function toAscii(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[×]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[·•]/g, '-')
    .replace(/…/g, '...');
}

export class EscPos {
  private bytes: number[] = [];
  constructor(public width: PaperWidth = 58) {
    this.raw(ESC, 0x40); // initialise
    this.raw(ESC, 0x74, 0x00); // code page PC437
  }
  get cols() {
    return columns(this.width);
  }
  raw(...b: number[]) {
    this.bytes.push(...b);
    return this;
  }
  text(s: string) {
    for (const ch of toAscii(s)) {
      const code = ch.charCodeAt(0);
      this.bytes.push(code >= 0x20 && code <= 0x7e ? code : ch === '\n' ? 0x0a : 0x3f);
    }
    return this;
  }
  line(s = '') {
    return this.text(s).raw(0x0a);
  }
  align(a: 'left' | 'center' | 'right') {
    return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
  }
  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  /** Character size 1–4× width and height. */
  size(w: number, h = w) {
    return this.raw(GS, 0x21, ((Math.min(4, w) - 1) << 4) | (Math.min(4, h) - 1));
  }
  rule(ch = '-') {
    return this.line(ch.repeat(this.cols));
  }
  /** Left and right text on one line, padded to the paper width. */
  pair(l: string, r: string, cols = this.cols) {
    const L = toAscii(l);
    const R = toAscii(r);
    const space = cols - L.length - R.length;
    if (space >= 1) return this.line(L + ' '.repeat(space) + R);
    return this.line(L.slice(0, cols)).align('right').line(R).align('left');
  }
  /** QR code (GS ( k), model 2. */
  qr(data: string, moduleSize = 6) {
    const d = Array.from(toAscii(data)).map((c) => c.charCodeAt(0) & 0x7f);
    const len = d.length + 3;
    this.raw(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00); // model 2
    this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, Math.max(1, Math.min(16, moduleSize))); // size
    this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31); // error correction M
    this.raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...d); // store
    return this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30); // print
  }
  feed(n = 3) {
    return this.raw(ESC, 0x64, n);
  }
  /** Partial cut (ignored by printers without a cutter). */
  cut() {
    return this.feed(3).raw(GS, 0x56, 0x42, 0x00);
  }
  /** Open the cash drawer connected to the printer. */
  drawer() {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
  }
  build() {
    return Uint8Array.from(this.bytes);
  }
}

/** Customer receipt. */
export function receiptBytes(sale: Sale, b: Business, c: Country, width: PaperWidth, opts: { copy?: boolean; drawer?: boolean } = {}) {
  const m = (n: number) => formatMoney(n, c);
  const p = new EscPos(width);
  if (opts.drawer && sale.payment.method === 'cash') p.drawer();
  p.align('center').bold(true).size(2).line(b.name).size(1).bold(false);
  if (b.tax.registrationNo) p.line(`${b.tax.name} No: ${b.tax.registrationNo}`);
  if (opts.copy) p.bold(true).line('COPY').bold(false);
  p.line(new Date(sale.createdAt).toLocaleString('en-GB'));
  p.line(`Receipt ${sale.receiptNo}`);
  if (sale.token) {
    p.feed(1).line('TOKEN').bold(true).size(3).line(sale.token).size(1).bold(false);
  }
  if (sale.table) p.line(`Table ${sale.table}`);
  p.align('left').rule();
  for (const l of sale.lines) {
    p.line(l.name);
    if (l.mods?.length) p.line('  + ' + l.mods.join(', '));
    p.pair(`  ${l.qty} x ${m(l.unitMinor)}`, m(l.unitMinor * l.qty));
  }
  p.rule();
  p.pair('Subtotal', m(sale.subtotalMinor));
  if (sale.discountMinor) p.pair(sale.reward ? `Reward: free ${sale.reward.name}` : 'Discount', '-' + m(sale.discountMinor));
  if (sale.tax) p.pair(`${sale.tax.name} ${pctLabel(sale.tax.rateBp)}${sale.tax.inclusive ? ' (incl.)' : ''}`, m(sale.taxMinor));
  p.bold(true).size(1, 2).pair(`TOTAL ${c.currency}`, m(sale.totalMinor)).size(1).bold(false);
  const usd = sale.usdRate ? usdEquivalent(sale.totalMinor, c, sale.usdRate) : null;
  if (usd) p.pair('  approx. USD', usd);
  p.line(paidLine(sale, c));
  if (sale.payment.method === 'cash' && sale.payment.tenderedMinor != null) {
    p.pair('Tendered', m(sale.payment.tenderedMinor));
    p.pair('Change', m(sale.payment.changeMinor ?? 0));
  }
  if (sale.voided) p.bold(true).line('VOID ' + sale.voided.reason).bold(false);
  p.rule();
  p.align('center');
  if (b.receiptFooter) p.line(b.receiptFooter);
  p.line('powered by tamuko.app');
  return p.cut().build();
}

/** Kitchen / job ticket: big token, mode and table, items in large type. No prices. */
export function ticketBytes(t: Ticket, b: Business, width: PaperWidth, reprint = false) {
  const p = new EscPos(width);
  p.align('center').bold(true).size(4).line(t.token).size(1);
  p.size(2, 1).line(`${t.mode === 'dinein' ? 'DINE IN' : b.template === 'service' ? 'JOB' : 'TAKE AWAY'}${t.table ? ' - ' + t.table : ''}`).size(1).bold(false);
  p.line(new Date(t.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + (reprint ? '  REPRINT' : ''));
  p.line(t.saleId ? 'PAID' : 'NOT PAID YET');
  p.align('left').rule('=');
  p.size(1, 2).bold(true);
  p.bold(true);
  for (const l of t.lines) {
    p.line(`${l.qty} x ${l.name}`);
    if (l.mods?.length) p.size(1).bold(false).line('   + ' + l.mods.join(', ')).size(1, 2).bold(true);
  }
  if (!t.lines.length) p.line(t.summary);
  p.bold(false).size(1).rule('=');
  return p.cut().build();
}

/** One-page test print to check alignment and paper width. */
export function testBytes(name: string, width: PaperWidth) {
  const p = new EscPos(width);
  p.align('center').bold(true).size(2).line('tamuko').size(1).line('Printer test').bold(false);
  p.line(name).line(`${width} mm - ${columns(width)} characters`).align('left').rule();
  p.pair('Left', 'Right').line('0123456789'.repeat(5).slice(0, columns(width)));
  p.align('center').qr('https://tamuko.app', 5).feed(1).line('If this looks right, you are ready.');
  return p.cut().build();
}
