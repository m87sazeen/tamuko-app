// Country packs: currency, default VAT/GST, default language, dial code.
// All money is stored as integer minor units (blueprint 7.4). Never floats as source of truth.
//
// TAX RATES ARE DEFAULTS, NOT TAX ADVICE. They are the commonly-applied standard rate as known
// in late 2026 and are applied automatically when a country is chosen; the owner can edit them.
// Reduced/zero rates, registration thresholds and category rules vary — confirm with a local
// accountant. COUNTRY_PACK_VERSION lets a future cloud service push updated packs.

export const COUNTRY_PACK_VERSION = '2026.11';

export type Country = {
  code: string;
  name: string;
  currency: string;
  decimals: number;
  locale: string;
  dial: string;
  lang: string; // default UI language
  tax: { name: string; rateBp: number; inclusive: boolean }; // basis points: 500 = 5%
};

const C = (code: string, name: string, currency: string, decimals: number, locale: string, dial: string, lang: string, taxName: string, ratePct: number, inclusive: boolean): Country => ({
  code, name, currency, decimals, locale, dial, lang, tax: { name: taxName, rateBp: Math.round(ratePct * 100), inclusive },
});

export const COUNTRIES: Country[] = [
  // Middle East
  C('AE', 'United Arab Emirates', 'AED', 2, 'en-AE', '+971', 'en', 'VAT', 5, true),
  C('SA', 'Saudi Arabia', 'SAR', 2, 'ar-SA', '+966', 'ar', 'VAT', 15, true),
  C('QA', 'Qatar', 'QAR', 2, 'ar-QA', '+974', 'ar', 'Tax', 0, true),
  C('KW', 'Kuwait', 'KWD', 3, 'ar-KW', '+965', 'ar', 'Tax', 0, true),
  C('BH', 'Bahrain', 'BHD', 3, 'ar-BH', '+973', 'ar', 'VAT', 10, true),
  C('OM', 'Oman', 'OMR', 3, 'ar-OM', '+968', 'ar', 'VAT', 5, true),
  C('JO', 'Jordan', 'JOD', 3, 'ar-JO', '+962', 'ar', 'GST', 16, true),
  C('EG', 'Egypt', 'EGP', 2, 'ar-EG', '+20', 'ar', 'VAT', 14, true),
  C('TR', 'Türkiye', 'TRY', 2, 'tr-TR', '+90', 'tr', 'KDV', 20, true),
  // Central & South Asia
  C('KZ', 'Kazakhstan', 'KZT', 2, 'kk-KZ', '+7', 'ru', 'VAT', 16, true),
  C('UZ', 'Uzbekistan', 'UZS', 2, 'uz-UZ', '+998', 'ru', 'VAT', 12, true),
  C('PK', 'Pakistan', 'PKR', 2, 'ur-PK', '+92', 'ur', 'GST', 18, false),
  C('IN', 'India', 'INR', 2, 'en-IN', '+91', 'hi', 'GST', 5, false),
  C('BD', 'Bangladesh', 'BDT', 2, 'bn-BD', '+880', 'bn', 'VAT', 15, false),
  C('LK', 'Sri Lanka', 'LKR', 2, 'si-LK', '+94', 'si', 'VAT', 18, false),
  C('NP', 'Nepal', 'NPR', 2, 'ne-NP', '+977', 'ne', 'VAT', 13, false),
  C('MV', 'Maldives', 'MVR', 2, 'en-MV', '+960', 'en', 'GST', 8, false),
  // Southeast Asia
  C('TH', 'Thailand', 'THB', 2, 'th-TH', '+66', 'th', 'VAT', 7, true),
  C('VN', 'Vietnam', 'VND', 0, 'vi-VN', '+84', 'vi', 'VAT', 10, true),
  C('ID', 'Indonesia', 'IDR', 0, 'id-ID', '+62', 'id', 'PPN', 11, false),
  C('MY', 'Malaysia', 'MYR', 2, 'ms-MY', '+60', 'ms', 'SST', 8, false),
  C('SG', 'Singapore', 'SGD', 2, 'en-SG', '+65', 'en', 'GST', 9, true),
  C('PH', 'Philippines', 'PHP', 2, 'en-PH', '+63', 'fil', 'VAT', 12, true),
  C('KH', 'Cambodia', 'KHR', 0, 'km-KH', '+855', 'km', 'VAT', 10, true),
  C('LA', 'Laos', 'LAK', 0, 'lo-LA', '+856', 'lo', 'VAT', 10, true),
  C('MM', 'Myanmar', 'MMK', 0, 'my-MM', '+95', 'my', 'Commercial tax', 5, true),
  // East Asia
  C('CN', 'China', 'CNY', 2, 'zh-CN', '+86', 'zh', 'VAT', 6, true),
  C('HK', 'Hong Kong', 'HKD', 2, 'zh-HK', '+852', 'zh-Hant', 'Tax', 0, true),
  C('TW', 'Taiwan', 'TWD', 0, 'zh-TW', '+886', 'zh-Hant', 'VAT', 5, true),
  C('JP', 'Japan', 'JPY', 0, 'ja-JP', '+81', 'ja', 'Consumption tax', 10, true),
  C('KR', 'South Korea', 'KRW', 0, 'ko-KR', '+82', 'ko', 'VAT', 10, true),
  C('MN', 'Mongolia', 'MNT', 2, 'mn-MN', '+976', 'en', 'VAT', 10, true),
  C('US', 'United States', 'USD', 2, 'en-US', '+1', 'en', 'Sales tax', 0, false),
];

export const countryOf = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

/** Parse user text like "12.5" into minor units without float math. Returns null if invalid. */
export function parseMoney(input: string, decimals: number): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d{1,12}(\.\d*)?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) return null;
  return parseInt(whole, 10) * 10 ** decimals + (decimals && frac ? parseInt(frac.padEnd(decimals, '0'), 10) : 0);
}

/** "5" or "7.5" → basis points. */
export function parsePercent(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,2}(\.\d{0,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return parseInt(w, 10) * 100 + (f ? parseInt(f.padEnd(2, '0'), 10) : 0);
}

export const pctLabel = (bp: number) => `${(bp / 100).toFixed(bp % 100 ? 2 : 0).replace(/\.?0+$/, '')}%`;

export function formatMoney(minor: number, c: Pick<Country, 'currency' | 'decimals' | 'locale'>): string {
  const value = minor / 10 ** c.decimals; // display only
  try {
    return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }).format(value);
  } catch {
    return `${c.currency} ${value.toFixed(c.decimals)}`;
  }
}

export const toInputString = (minor: number, decimals: number) => (decimals ? (minor / 10 ** decimals).toFixed(decimals) : String(minor));

/** Integer tax maths, half-up rounding on the whole bill. */
export function computeTax(netMinor: number, rateBp: number, inclusive: boolean) {
  if (!rateBp) return { taxMinor: 0, totalMinor: netMinor };
  if (inclusive) {
    // tax portion already inside the price: tax = gross * r / (1 + r)
    const tax = Math.floor((netMinor * rateBp + Math.floor((10000 + rateBp) / 2)) / (10000 + rateBp));
    return { taxMinor: tax, totalMinor: netMinor };
  }
  const tax = Math.floor((netMinor * rateBp + 5000) / 10000);
  return { taxMinor: tax, totalMinor: netMinor + tax };
}

const USD = { currency: 'USD', decimals: 2, locale: 'en-US' };

/** Tourist view: local minor units → USD string, using local-per-USD rate (e.g. 3.6725 for AED). */
export function usdEquivalent(minor: number, c: Country, localPerUsd: number): string | null {
  if (!localPerUsd || localPerUsd <= 0) return null;
  const usdCents = Math.round((minor / 10 ** c.decimals / localPerUsd) * 100);
  return formatMoney(usdCents, USD);
}

/** Free, keyless public FX feed (open.er-api.com). Only the currency code is sent. */
export async function fetchUsdRate(currency: string): Promise<number> {
  const r = await fetch('https://open.er-api.com/v6/latest/USD');
  const j = await r.json();
  const rate = j?.rates?.[currency];
  if (j?.result !== 'success' || typeof rate !== 'number') throw new Error('Rate not available. Enter it manually.');
  return rate;
}
