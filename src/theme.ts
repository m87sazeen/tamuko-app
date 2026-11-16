// tamuko. brand guidelines v1.0 §05 Colour.
// "Peach is precious: it marks the one thing to do next. Backgrounds stay calm (charcoal or cream),
//  steel and blue carry structure. Status colours never change with a merchant's theme."
// Proportion 60% charcoal/cream · 30% steel/blue/ivory · 10% peach. Never white text on peach.
// All text pairs below are checked to WCAG 4.5:1.
import { useColorScheme } from 'react-native';
import { useApp } from './store';

export const BRAND = {
  peach: '#FF8254',
  steel: '#3F5A62',
  blue: '#526889',
  charcoal: '#1F1F21',
  cream: '#EADFC7',
  paper: '#F7F0E3',
  ivory: '#F0EFE9',
  stone: '#B8B8B0',
  ink: '#202326', // text on peach (6.45:1)
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
  bg: BRAND.cream,
  surface: BRAND.paper, // "Paper · tickets, receipts, light cards"
  raised: '#FFF8EE',
  inset: '#DED2BC',
  primary: BRAND.peach,
  onPrimary: BRAND.ink,
  select: BRAND.steel,
  onSelect: BRAND.paper, // 6.50:1
  accentText: BRAND.steel,
  text: '#30474F', // website "Warm" --text, 6.9:1 on cream
  textDim: '#575F5C', // 4.97:1 on cream
  border: '#CFC3AD',
  borderStrong: BRAND.steel,
  focus: BRAND.steel,
  overlay: '#20232699',
  glass: 'rgba(247,240,227,0.72)',
  paper: BRAND.paper,
  paperInk: BRAND.ink,
  success: '#236B52',
  warning: '#915B13',
  error: '#A63838',
  info: '#2C668F',
  pending: '#705EA5',
  statusBg: BRAND.paper,
  shadow: webShadow('0 1px 2px rgba(48,71,79,.06), 0 12px 32px -12px rgba(48,71,79,.22)', '#30474F', 10, 16, 0.14),
};

export const dark: Theme = {
  dark: true,
  bg: BRAND.charcoal,
  surface: '#29292C',
  raised: '#323238',
  inset: '#171719',
  primary: BRAND.peach,
  onPrimary: BRAND.ink,
  select: BRAND.blue, // "Dashboard Blue · dark-mode accent, selected panels"
  onSelect: BRAND.ivory, // 4.93:1
  accentText: BRAND.peach,
  text: BRAND.ivory,
  textDim: BRAND.stone, // 7.27:1 on surface
  border: '#3A3A40',
  borderStrong: '#7C91AD',
  focus: '#FFC09C',
  overlay: '#000000B3',
  glass: 'rgba(41,41,44,0.55)', // §07 glass
  paper: BRAND.paper,
  paperInk: BRAND.ink,
  success: '#73D4A2',
  warning: '#F0C36C',
  error: '#FF8D87',
  info: '#86B9E3',
  pending: '#BAA7EE',
  statusBg: '#29292C',
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
