// tamuko. palette — TNDL 1.0 (Ivory · Navy · Copper · Mocha · Sand). Replaces brand guidelines v1.0 colours.
// Copper marks the one thing to do next. Navy carries structure and text. Ivory/Sand stay calm in the background.
// Mocha is the accent for small text on ivory (copper text on ivory is only 3.98:1).
// Status colours never change with a merchant's theme. All text pairs below are checked to WCAG 4.5:1.
import { useColorScheme } from 'react-native';
import { useApp } from './store';

export const BRAND = {
  ivory: '#F2E8D5',
  navy: '#1B2A4A',
  copper: '#B5562F',
  mocha: '#8C5A3C',
  sand: '#C9B896',
  paper: '#FAF4E8',
  copperLight: '#E08A60', // copper for dark mode (5.4:1 on navy)
  navyDeep: '#141F38',
  ink: '#141F38', // text on light copper
  onCopper: '#FFF8EE', // text on copper (4.59:1)
} as const;

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  raised: string;
  inset: string;
  primary: string; // peach — the one next action
  onPrimary: string;
  select: string; // structure / selected state: steel (light) · dashboard blue (dark)
  onSelect: string;
  accentText: string; // kickers and serif accents: peach on dark (site style), steel on light (peach text on cream is ~2:1)
  text: string;
  textDim: string;
  border: string;
  borderStrong: string;
  focus: string;
  overlay: string;
  glass: string;
  paper: string;
  paperInk: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  pending: string;
  statusBg: string; // pills sit on paper/surface so every status colour stays ≥ 4.5:1
  shadow: object; // website --shadow (cards, sheets)
};

const webShadow = (css: string, color: string, y: number, r: number, o: number) => ({ boxShadow: css, shadowColor: color, shadowOffset: { width: 0, height: y }, shadowRadius: r, shadowOpacity: o, elevation: 3 });

export const light: Theme = {
  dark: false,
  bg: BRAND.ivory,
  surface: BRAND.paper,
  raised: '#FFFAF1',
  inset: '#E6DAC2',
  primary: BRAND.copper,
  onPrimary: BRAND.onCopper, // 4.59:1
  select: BRAND.navy,
  onSelect: BRAND.ivory, // 11.7:1
  accentText: BRAND.mocha, // 4.74:1 on ivory
  text: BRAND.navy, // 11.7:1 on ivory
  textDim: '#4F5B70', // 5.64:1 on ivory
  border: BRAND.sand,
  borderStrong: BRAND.navy,
  focus: BRAND.navy,
  overlay: '#141F3899',
  glass: 'rgba(250,244,232,0.74)',
  paper: BRAND.paper,
  paperInk: BRAND.ink,
  success: '#236B52',
  warning: '#915B13',
  error: '#A63838',
  info: '#2C668F',
  pending: '#705EA5',
  statusBg: BRAND.paper,
  shadow: webShadow('0 1px 2px rgba(27,42,74,.06), 0 12px 32px -12px rgba(27,42,74,.22)', '#1B2A4A', 10, 16, 0.14),
};

export const dark: Theme = {
  dark: true,
  bg: BRAND.navyDeep,
  surface: BRAND.navy,
  raised: '#22345A',
  inset: '#0F182C',
  primary: BRAND.copperLight,
  onPrimary: BRAND.ink, // 6.22:1
  select: '#2C3E66',
  onSelect: BRAND.ivory, // 8.69:1
  accentText: BRAND.copperLight, // 5.40:1 on navy
  text: BRAND.ivory,
  textDim: BRAND.sand, // 7.30:1 on navy
  border: '#2E3F63',
  borderStrong: BRAND.sand,
  focus: '#F0B08C',
  overlay: '#000000B3',
  glass: 'rgba(27,42,74,0.6)',
  paper: BRAND.paper,
  paperInk: BRAND.ink,
  success: '#73D4A2',
  warning: '#F0C36C',
  error: '#FF8D87',
  info: '#86B9E3',
  pending: '#BAA7EE',
  statusBg: BRAND.navy,
  shadow: webShadow('0 1px 2px rgba(0,0,0,.3), 0 16px 40px -16px rgba(0,0,0,.6)', '#000000', 12, 20, 0.45),
};

/** §07 corner radius scale. */
export const R = { sharp: 4, balanced: 12, field: 14, soft: 18, rounded: 24, pill: 999 } as const;
export const radius = R.balanced;
export const space = (n: number) => n * 8;

export function useTheme(): Theme {
  const sys = useColorScheme();
  const mode = useApp((s) => s.settings.themeMode);
  const isDark = mode === 'dark' || (mode === 'system' && sys === 'dark');
  return isDark ? dark : light;
}
