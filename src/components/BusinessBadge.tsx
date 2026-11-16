// The merchant's own mark: their logo, or their initial on a tile until they add one.
import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '../theme';
import { Txt } from './ui';

export function BusinessBadge({ name, logo, size = 32 }: { name: string; logo: string | null; size?: number }) {
  const th = useTheme();
  if (logo) return <Image source={{ uri: logo }} style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#fff' }} accessibilityIgnoresInvertColors accessibilityLabel={`${name} logo`} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: th.select, alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={size * 0.48} weight="800" heading color={th.onSelect}>{(name.trim()[0] ?? 'T').toUpperCase()}</Txt>
    </View>
  );
}
