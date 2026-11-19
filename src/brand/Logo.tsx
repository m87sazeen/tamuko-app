// tamuko. brand guidelines v1.0 §01–03 — logo system, reproduced from the supplied artwork.
// Rail monogram: lowercase t, 5.5-unit rounded stroke on a 64-unit grid; the crossbar is the rail;
// one peach ticket with a torn edge hangs from it. Wordmark: "tamuk" + a small o resting on a peach bar.
// Never stretch, recolour off-palette, rotate, add effects, or retype the wordmark in another font.
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { F } from './fonts';
import { WORDMARK } from './wordmark';

export type LogoVariant = 'charcoal' | 'cream' | 'peach' | 'steel' | 'black' | 'white';

// Colour versions (§03): tile / strokes / ticket / wordmark ink / bar.
const V: Record<LogoVariant, { tile: string; stroke: string; ticket: string; ink: string; bar: string }> = {
  charcoal: { tile: '#2C3E66', stroke: '#F2E8D5', ticket: '#E08A60', ink: '#F2E8D5', bar: '#E08A60' },
  cream: { tile: '#1B2A4A', stroke: '#F2E8D5', ticket: '#B5562F', ink: '#1B2A4A', bar: '#B5562F' },
  peach: { tile: '#1B2A4A', stroke: '#F2E8D5', ticket: '#B5562F', ink: '#1B2A4A', bar: '#F2E8D5' },
  steel: { tile: '#1B2A4A', stroke: '#F2E8D5', ticket: '#E08A60', ink: '#F2E8D5', bar: '#E08A60' },
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

/** Wordmark — vector outlines of the original artwork (see scripts/gen-wordmark.cjs). `size` = cap size in px. */
export function Wordmark({ size = 28, variant = 'charcoal' }: { size?: number; variant?: LogoVariant }) {
  const c = V[variant];
  const k = size / 96;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="tamuko" style={{ direction: 'ltr' }}>
      <Svg width={WORDMARK.width * k} height={WORDMARK.height * k} viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}>
        <Path d={WORDMARK.tamuk} fill={c.ink} />
        <Path d={WORDMARK.o} fill={c.ink} />
        <Rect x={WORDMARK.bar.x} y={WORDMARK.bar.y} width={WORDMARK.bar.w} height={WORDMARK.bar.h} rx={WORDMARK.bar.r} fill={c.bar} />
      </Svg>
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
        {product ? <Text style={{ fontFamily: F.heading, fontSize: height * 0.6, lineHeight: height * 0.66, color: variant === 'cream' || variant === 'black' ? V[variant].ink : V[variant].bar }}>{product}</Text> : null}
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
