// Small language switcher for the top of sign-in and onboarding (the full one lives in Settings).
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../brand/Icon';
import { LANGS, useT } from '../i18n';
import { useApp } from '../store';
import { useTheme } from '../theme';
import { Button, Sheet, Txt } from './ui';

export function LanguageButton({ onPicked }: { onPicked?: (code: string) => void }) {
  const th = useTheme();
  const { lang } = useT();
  const setSettings = useApp((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  const regions = [...new Set(LANGS.map((l) => l.region))];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Language: ${lang.name}. Change`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: th.border, backgroundColor: pressed ? th.inset : th.surface })}
      >
        <Icon name="globe" size={18} color={th.text} />
        <Txt size={14} weight="600">{lang.native}</Txt>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Language">
        {regions.map((r) => (
          <View key={r} style={{ gap: 8 }}>
            <Txt size={13} weight="700" dim>{r}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LANGS.filter((l) => l.region === r).map((l) => (
                <Button
                  key={l.code}
                  size="sm"
                  kind={l.code === lang.code ? 'secondary' : 'outline'}
                  label={l.native === l.name ? l.native : `${l.native} · ${l.name}`}
                  onPress={() => { setSettings({ language: l.code }); onPicked?.(l.code); setOpen(false); }}
                />
              ))}
            </View>
          </View>
        ))}
      </Sheet>
    </>
  );
}
