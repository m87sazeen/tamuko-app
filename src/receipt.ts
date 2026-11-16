// Receipts: 58 mm plain-text layout + printable/shareable HTML → PDF (KAV-RCP-001/002/005).
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Country, formatMoney, pctLabel, usdEquivalent } from './money';
import { symbolSvgMarkup } from './brand/Logo';
import { escapeHtml } from './security';
import type { Business, Sale } from './store';

const W = 32; // characters per line on a 58 mm printer

const line = (l: string, r: string) => {
  const space = Math.max(1, W - l.length - r.length);
  return (l + ' '.repeat(space) + r).slice(0, Math.max(W, l.length + r.length + 1));
};

const METHOD: Record<string, string> = { cash: 'Cash', qr: 'QR transfer', link: 'Payment link' };

/** "Paid by cash", "Paid by QR transfer (checked by staff)", or "Split: Cash 10.00 + QR 5.00". */
export const paymentLabel = (s: Sale, c?: Country) => {
  if (s.payment.method === 'split' && s.payment.parts)
    return 'Split: ' + s.payment.parts.map((p) => `${METHOD[p.method]} ${c ? formatMoney(p.amountMinor, c) : ''}`.trim()).join(' + ');
  return s.payment.method === 'cash' ? 'Cash' : `${METHOD[s.payment.method]} (checked by staff)`;
};

export const paidLine = (s: Sale, c?: Country) => (s.payment.method === 'cash' ? 'PAID CASH' : 'PAID ' + paymentLabel(s, c).toUpperCase());

export function receiptText(sale: Sale, b: Business, c: Country, copy = false): string {
  const m = (n: number) => formatMoney(n, c);
  const out: string[] = [];
  out.push(b.name.slice(0, W));
  if (b.tax.registrationNo) out.push(`${b.tax.name} No: ${b.tax.registrationNo}`.slice(0, W));
  if (copy) out.push('COPY');
  out.push(new Date(sale.createdAt).toLocaleString(c.locale));
  out.push(`Receipt ${sale.receiptNo}`);
  if (sale.token) out.push(`TOKEN ${sale.token}`);
  out.push('-'.repeat(W));
  for (const l of sale.lines) {
    out.push(l.name.slice(0, W));
    if (l.mods?.length) out.push(('  + ' + l.mods.join(', ')).slice(0, W * 2));
    out.push(line(`  ${l.qty} x ${m(l.unitMinor)}`, m(l.unitMinor * l.qty)));
  }
  out.push('-'.repeat(W));
  out.push(line('Subtotal', m(sale.subtotalMinor)));
  if (sale.discountMinor) out.push(line(sale.reward ? `Reward: free ${sale.reward.name}` : 'Discount', '-' + m(sale.discountMinor)));
  if (sale.tax) out.push(line(`${sale.tax.name} ${pctLabel(sale.tax.rateBp)}${sale.tax.inclusive ? ' (incl.)' : ''}`, m(sale.taxMinor)));
  out.push(line(`TOTAL ${c.currency}`, m(sale.totalMinor)));
  const usd = sale.usdRate ? usdEquivalent(sale.totalMinor, c, sale.usdRate) : null;
  if (usd) out.push(line('  approx. USD', usd));
  out.push(paidLine(sale, c));
  if (sale.payment.method === 'cash' && sale.payment.tenderedMinor != null) {
    out.push(line('Tendered', m(sale.payment.tenderedMinor)));
    out.push(line('Change', m(sale.payment.changeMinor ?? 0)));
  }
  if (sale.voided) out.push('VOID ' + sale.voided.reason);
  out.push('-'.repeat(W));
  if (b.receiptFooter) out.push(b.receiptFooter.slice(0, W * 2));
  out.push('powered by tamuko.app');
  return out.join('\n');
}

export function receiptHtml(sale: Sale, b: Business, c: Country, copy = false): string {
  // Brand §10: 58 mm thermal receipt · one-colour logo · JetBrains Mono · #111 on white · dashed rules.
  const m = (n: number) => escapeHtml(formatMoney(n, c));
  const row = (l: string, r: string, bold = false) => `<div class="row${bold ? " b" : ""}"><span>${l}</span><span>${r}</span></div>`;
  const rows = sale.lines.map((l) => row(`${l.qty} x ${escapeHtml(l.name)}${l.mods?.length ? `<br><span class="s">+ ${escapeHtml(l.mods.join(", "))}</span>` : ""}`, m(l.unitMinor * l.qty))).join("");
  const paid = escapeHtml(paidLine(sale, c));
  const logo = b.logo && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(b.logo) ? `<img src="${b.logo}" style="max-width:20mm;max-height:20mm;filter:grayscale(1)">` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
<style>
@page{size:58mm auto;margin:3mm}
body{font-family:"JetBrains Mono",ui-monospace,monospace;width:52mm;margin:0 auto;color:#111;background:#fff;font-size:11px;line-height:1.6;font-variant-numeric:tabular-nums}
.c{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.rule{border-top:1px dashed #999;margin:6px 0}.row{display:flex;justify-content:space-between;gap:8px}.b{font-weight:800}
.tok{font-size:26px;font-weight:800;border:2px dashed #111;padding:2px 8px}.s{font-size:9px}
</style></head><body>
<div class="c">${symbolSvgMarkup(26, "black")}${logo}<b>${escapeHtml(b.name.toUpperCase())}</b>
${b.tax.registrationNo ? `<span class="s">${escapeHtml(b.tax.name)} NO ${escapeHtml(b.tax.registrationNo)}</span>` : ""}
${copy ? "<b>COPY</b>" : ""}<span class="s">${escapeHtml(new Date(sale.createdAt).toLocaleString(c.locale))} · ${escapeHtml(sale.receiptNo)}</span>
${sale.token ? `<span class="tok">${escapeHtml(sale.token)}</span>` : ""}</div>
<div class="rule"></div>${rows}<div class="rule"></div>
${row("Subtotal", m(sale.subtotalMinor))}
${sale.discountMinor ? row(sale.reward ? `Reward: free ${escapeHtml(sale.reward.name)}` : "Discount", "-" + m(sale.discountMinor)) : ""}
${sale.tax ? row(`${escapeHtml(sale.tax.name)} ${pctLabel(sale.tax.rateBp)}${sale.tax.inclusive ? " incl." : ""}`, m(sale.taxMinor)) : ""}
${row(`TOTAL ${escapeHtml(c.currency)}`, m(sale.totalMinor), true)}
${sale.usdRate ? row("approx. USD", escapeHtml(usdEquivalent(sale.totalMinor, c, sale.usdRate) ?? "")) + `<div class="s">USD for reference only. Pay in ${escapeHtml(c.currency)}.</div>` : ""}
${sale.payment.method === "cash" && sale.payment.tenderedMinor != null ? row("Cash", m(sale.payment.tenderedMinor)) + row("Change", m(sale.payment.changeMinor ?? 0)) : ""}
<div class="rule"></div>
<div class="c">${sale.voided ? `<b>VOID · ${escapeHtml(sale.voided.reason)}</b>` : `<span>${sale.token ? "TOKEN " + escapeHtml(sale.token) + " · " : ""}${paid}</span>`}
${b.receiptFooter ? `<span>${escapeHtml(b.receiptFooter)}</span>` : ""}<span class="s">powered by tamuko.app</span></div>
</body></html>`;
}

/** Print via OS print dialog (AirPrint / Android print service / browser). Falls back to share. */
export async function printReceipt(sale: Sale, b: Business, c: Country, copy = false) {
  await Print.printAsync({ html: receiptHtml(sale, b, c, copy) });
}

export async function shareReceipt(sale: Sale, b: Business, c: Country) {
  const html = receiptHtml(sale, b, c);
  if (Platform.OS === 'web') return Print.printAsync({ html }); // browser: "Save as PDF"
  const { uri } = await Print.printToFileAsync({ html, width: 220 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Receipt ${sale.receiptNo}` });
}
