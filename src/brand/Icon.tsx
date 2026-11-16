// Icons: Solar Icons Set by 480 Design (Linear style, 24 grid, 1.5 px round stroke) — CC BY 4.0.
// https://www.figma.com/community/file/1166831539721848736/solar-icons-set
// Generated into ./solar.ts by scripts/gen-icons.cjs. Only the Google mark is drawn by hand (brand logo).
import React from 'react';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { SOLAR } from './solar';

export type IconName = keyof typeof SOLAR | 'google';

const GOOGLE = 'M20 12a8 8 0 1 1-2.3-5.6M20 12h-8';

export function Icon({ name, size = 24, color, label }: { name: IconName; size?: number; color: string; label?: string }) {
  if (name === 'google')
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={label ? true : undefined} accessibilityLabel={label}>
        <Path d={GOOGLE} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  return (
    <SvgXml
      xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${SOLAR[name]}</svg>`}
      width={size}
      height={size}
      color={color}
      accessible={label ? true : undefined}
      accessibilityLabel={label}
    />
  );
}
