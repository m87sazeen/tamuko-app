// tamuko. brand guidelines v1.0 §01–03 — logo system, reproduced from the supplied artwork.
// Rail monogram: lowercase t, 5.5-unit rounded stroke on a 64-unit grid; the crossbar is the rail;
// one peach ticket with a torn edge hangs from it. Wordmark: "tamuk" + a small o resting on a peach bar.
// Never stretch, recolour off-palette, rotate, add effects, or retype the wordmark in another font.
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { F } from './fonts';

export type LogoVariant = 'charcoal' | 'cream' | 'peach' | 'steel' | 'black' | 'white';

// Colour versions (§03): tile / strokes / ticket / wordmark ink / bar.
const V: Record<LogoVariant, { tile: string; stroke: string; ticket: string; ink: string; bar: string }> = {
  charcoal: { tile: '#29292C', stroke: '#F0EFE9', ticket: '#FF8254', ink: '#F0EFE9', bar: '#FF8254' },
  cream: { tile: '#202326', stroke: '#F7F0E3', ticket: '#FF8254', ink: '#202326', bar: '#FF8254' },
  peach: { tile: '#202326', stroke: '#F7F0E3', ticket: '#FF8254', ink: '#202326', bar: '#F7F0E3' },
  steel: { tile: '#3F5A62', stroke: '#F7F0E3', ticket: '#FF8254', ink: '#F7F0E3', bar: '#FF8254' },
  black: { tile: '#FFFFFF', stroke: '#111111', ticket: '#111111', ink: '#111111', bar: '#111111' },
  white: { tile: '#111111', stroke: '#FFFFFF', ticket: '#FFFFFF', ink: '#FFFFFF', bar: '#FFFFFF' },
};

export const SYMBOL_PATHS = {
  tile: { x: 4, y: 4, w: 56, h: 56, rx: 16 },
  stroke: 'M13 25H51M26 15V41Q26 48 33 48H36',
  hanger: { x: 44.5, y: 25, w: 3, h: 5 },
  ticket: 'M40 29.5H52V41L50.00 44L48.00 41L46.00 44L44.00 41L42.00 44L40.00 41Z',
};

/** Rail monogram. Minimum 16 px on screen. */
export function Symbol({ size = 40, variant = 'charcoal', label }: { size?: number; variant?: LogoVariant; label?: string }) {
  const c = V[variant];
  return (
    <Svg width={Math.max(16, size)} height={Math.max(16, size)} viewBox="0 0 64 64" accessibilityLabel={label} accessible={label ? true : undefined}>
      <Rect x={4} y={4} width={56} height={56} rx={16} fill={c.tile} />
      <Path d={SYMBOL_PATHS.stroke} stroke={c.stroke} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x={44.5} y={25} width={3} height={5} fill={c.stroke} />
      <Path d={SYMBOL_PATHS.ticket} fill={c.ticket} />
    </Svg>
  );
}

/** Wordmark: proportions taken from the 190 px master (o = 0.858×, bar = 0.4× wide, 0.11× tall). */
export function Wordmark({ size = 28, variant = 'charcoal' }: { size?: number; variant?: LogoVariant }) {
  const c = V[variant];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', direction: 'ltr' }} accessible accessibilityRole="header" accessibilityLabel="tamuko">
      <Text allowFontScaling={false} style={{ fontFamily: F.wordmark, fontSize: size, lineHeight: size * 1.1, letterSpacing: -size * 0.0126, color: c.ink, includeFontPadding: false }}>
        tamuk
      </Text>
      <View style={{ alignItems: 'center', marginLeft: size * 0.03, paddingBottom: size * 0.1 }}>
        <Text allowFontScaling={false} style={{ fontFamily: F.wordmark, fontSize: size * 0.858, lineHeight: size * 0.62, color: c.ink, includeFontPadding: false, paddingTop: size * 0.05 }}>
          o
        </Text>
        <View style={{ width: size * 0.4, height: Math.max(2, size * 0.11), borderRadius: 99, backgroundColor: c.bar, marginTop: size * 0.068 }} />
      </View>
    </View>
  );
}

/** Horizontal lockup (default). Gap = 0.23 × symbol height, wordmark ≈ 0.95 × symbol height. */
export function Lockup({ height = 36, variant = 'charcoal', product }: { height?: number; variant?: LogoVariant; product?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.23, direction: 'ltr' }}>
      <Symbol size={height} variant={variant} />
      <View style={{ gap: 2 }}>
        <Wordmark size={product ? height * 0.6 : height * 0.95} variant={variant} />
        {/* Product name in the heading face, peach (§08). Peach on light backgrounds is ~2:1, so on cream/paper
            the label uses the wordmark ink to keep the 4.5:1 rule the guidelines also require. */}
        {product ? <Text style={{ fontFamily: F.heading, fontSize: height * 0.6, lineHeight: height * 0.66, color: variant === 'cream' || variant === 'black' ? V[variant].ink : '#FF8254' }}>{product}</Text> : null}
      </View>
    </View>
  );
}

/** Stacked lockup for square spaces. */
export function StackedLockup({ height = 72, variant = 'charcoal' }: { height?: number; variant?: LogoVariant }) {
  return (
    <View style={{ alignItems: 'center', gap: height * 0.18 }}>
      <Symbol size={height} variant={variant} />
      <Wordmark size={height * 0.62} variant={variant} />
    </View>
  );
}

/** One-colour SVG markup for print (receipts, stamps) — §03 "never fake them with tints". */
export function symbolSvgMarkup(px: number, variant: LogoVariant = 'black') {
  const c = V[variant];
  return `<svg width="${px}" height="${px}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="56" height="56" rx="16" fill="${c.tile}"/><path d="${SYMBOL_PATHS.stroke}" stroke="${c.stroke}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="44.5" y="25" width="3" height="5" fill="${c.stroke}"/><path d="${SYMBOL_PATHS.ticket}" fill="${c.ticket}"/></svg>`;
}
