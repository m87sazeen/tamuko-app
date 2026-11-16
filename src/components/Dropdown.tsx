// Dropdown: looks like a field, opens a searchable list. For long lists such as countries.
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, IconName } from '../brand/Icon';
import { R, useTheme } from '../theme';
import { Field, Sheet, Tick, Txt } from './ui';

export type Option<T extends string> = { value: T; label: string; hint?: string; group?: string };

export function Dropdown<T extends string>({ label, value, options, onChange, icon, searchable = true }: { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void; icon?: IconName; searchable?: boolean }) {
  const th = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? options.filter((o) => o.label.toLowerCase().includes(term) || (o.hint ?? '').toLowerCase().includes(term)) : options;
  }, [q, options]);
  const groups = [...new Set(shown.map((o) => o.group ?? ''))];
  return (
    <View style={{ gap: 6 }}>
      <Txt size={14} weight="600">{label}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'choose'}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ minHeight: 54, borderRadius: R.field, borderWidth: 1.5, borderColor: pressed ? th.borderStrong : th.border, backgroundColor: pressed ? th.raised : th.inset, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 })}
      >
        {icon ? <Icon name={icon} size={20} color={th.textDim} /> : null}
        <View style={{ flex: 1 }}>
          <Txt weight="600" numberOfLines={1}>{current?.label ?? 'Choose'}</Txt>
          {current?.hint ? <Txt size={12} dim numberOfLines={1}>{current.hint}</Txt> : null}
        </View>
        <Icon name="down" size={20} color={th.text} />
      </Pressable>
      <Sheet visible={open} onClose={() => { setOpen(false); setQ(''); }} title={label}>
        {searchable && <Field label="Search" value={q} onChange={setQ} />}
        {groups.map((g) => (
          <View key={g} style={{ gap: 6 }}>
            {g ? <Txt size={12} weight="700" dim>{g}</Txt> : null}
            {shown.filter((o) => (o.group ?? '') === g).map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: o.value === value }}
                onPress={() => { onChange(o.value); setOpen(false); setQ(''); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: R.field, backgroundColor: o.value === value ? th.raised : pressed ? th.inset : 'transparent', borderWidth: o.value === value ? 2 : 0, borderColor: th.primary })}
              >
                <View style={{ flex: 1 }}>
                  <Txt weight={o.value === value ? '700' : '500'}>{o.label}</Txt>
                  {o.hint ? <Txt size={12} dim>{o.hint}</Txt> : null}
                </View>
                {o.value === value ? <Tick on size={22} /> : null}
              </Pressable>
            ))}
          </View>
        ))}
      </Sheet>
    </View>
  );
}
