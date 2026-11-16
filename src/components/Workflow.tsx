// Workflow building blocks shared by onboarding and Manage → Workflow.
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Icon } from '../brand/Icon';
import { useT } from '../i18n';
import { R, useTheme } from '../theme';
import { PRESETS_FOR, Preset, ServiceMode, Step, Template, clone, presetById, validateFlow } from '../workflow';
import { Button, Card, IconButton, Note, Row, Tick, Txt, fontFor, tint, useLang } from './ui';

/** "Order → Paid → Preparing → Ready → Collected" as chips; the payment step is marked with the cash icon. */
export function FlowPreview({ steps, compact }: { steps: Step[]; compact?: boolean }) {
  const th = useTheme();
  const { stage } = useT();
  return (
    <View accessible accessibilityLabel={steps.map((s) => stage(s.name)).join(', then ')} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => (
        <Row key={i} gap={6}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: compact ? 9 : 12,
              paddingVertical: compact ? 4 : 6,
              borderRadius: 999,
              // website .chip: tinted for payment, inset for work steps
              backgroundColor: s.kind === 'pay' ? tint(th.success, th.dark ? 0.2 : 0.15) : s.kind === 'done' ? tint(th.select, th.dark ? 0.3 : 0.14) : th.inset,
            }}
          >
            {s.kind === 'pay' ? <Icon name="cash" size={14} color={th.success} /> : s.kind === 'done' ? <Icon name="check" size={14} color={th.select} /> : null}
            <Txt size={compact ? 12 : 13} weight="600" color={s.kind === 'pay' ? th.success : th.text}>{stage(s.name)}</Txt>
          </View>
          {i < steps.length - 1 ? <Icon name="forward" size={14} color={th.textDim} /> : null}
        </Row>
      ))}
    </View>
  );
}

/** Choose one of the default workflows for a serving mode. */
export function PresetPicker({ tpl, mode, value, onPick }: { tpl: Template; mode: ServiceMode; value: string; onPick: (p: Preset) => void }) {
  const ids = PRESETS_FOR[tpl][mode];
  return (
    <View style={{ gap: 10 }}>
      {ids.map((id) => {
        const p = presetById(id)!;
        const on = value === id;
        return (
          <Card key={id} selected={on} onPress={() => onPick(p)} a11y={`${p.label}. ${p.hint}`} style={{ gap: 8 }}>
            <Row gap={8}>
              <Tick on={on} />
              <Txt weight="600">{p.label}</Txt>
            </Row>
            <Txt size={14} dim>{p.hint}</Txt>
            <FlowPreview steps={p.steps} compact />
          </Card>
        );
      })}
    </View>
  );
}

/** Custom workflow: rename, add, remove and reorder steps; move the payment step. */
export function FlowEditor({ steps: initial, onSave, onCancel }: { steps: Step[]; onSave: (s: Step[]) => void; onCancel: () => void }) {
  const th = useTheme();
  const lang = useLang();
  const [steps, setSteps] = useState<Step[]>(() => clone(initial));
  const problem = validateFlow(steps);

  const rename = (i: number, name: string) => setSteps(steps.map((s, j) => (j === i ? { ...s, name: name.slice(0, 24) } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j <= 0 || j >= steps.length - 1) return; // order stays first, finish stays last
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };
  const remove = (i: number) => setSteps(steps.filter((_, j) => j !== i));
  const addStep = () => setSteps([...steps.slice(0, -1), { name: 'New step', kind: 'work' }, steps[steps.length - 1]]);

  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} dim>Orders move through these steps from top to bottom. Use the arrows to move a step, including the payment step.</Txt>
      {steps.map((s, i) => {
        const fixed = s.kind === 'order' || s.kind === 'done';
        return (
          <Row key={i} gap={8} style={{ backgroundColor: th.surface, borderRadius: R.balanced, borderWidth: 1, borderColor: s.kind === 'pay' ? th.success : th.border, padding: 8 }}>
            <View style={{ width: 28, alignItems: 'center' }}>
              {s.kind === 'pay' ? <Icon name="cash" size={20} color={th.success} /> : <Txt size={14} weight="700" mono dim>{i + 1}</Txt>}
            </View>
            <TextInput
              accessibilityLabel={`Step ${i + 1} name`}
              value={s.name}
              onChangeText={(v) => rename(i, v)}
              maxLength={24}
              style={{ flex: 1, minHeight: 44, fontSize: 16, color: th.text, fontFamily: fontFor('600', false, false, lang), paddingHorizontal: 8, borderRadius: R.balanced - 4, backgroundColor: th.inset }}
            />
            {!fixed && (
              <>
                <IconButton icon="up" size={40} a11y={`Move ${s.name} earlier`} onPress={() => move(i, -1)} />
                <IconButton icon="down" size={40} a11y={`Move ${s.name} later`} onPress={() => move(i, 1)} />
                {s.kind === 'work' ? <IconButton icon="trash" size={40} a11y={`Remove ${s.name}`} onPress={() => remove(i)} /> : <View style={{ width: 40 }} />}
              </>
            )}
          </Row>
        );
      })}
      <Button kind="ghost" icon="plus" label="Add a step" onPress={addStep} disabled={steps.length >= 8} />
      <FlowPreview steps={steps} />
      {problem ? <Note tone="warning" text={problem} /> : <Note tone="info" text="Orders already on the rail keep the workflow they started with. New orders use this one." />}
      <Row>
        <Button kind="outline" label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Save workflow" disabled={!!problem} onPress={() => onSave(steps.map((s) => ({ ...s, name: s.name.trim() })))} style={{ flex: 2 }} />
      </Row>
    </View>
  );
}

/** − / + counter for small numbers (tables, stock). */
export function Stepper({ value, onChange, min = 0, max = 200, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <Row gap={8} style={{ justifyContent: 'space-between' }}>
      <Txt weight="600" style={{ flex: 1 }}>{label}</Txt>
      <IconButton icon="minus" a11y={`Fewer: ${label}`} onPress={() => onChange(Math.max(min, value - 1))} />
      <Txt size={20} weight="700" mono style={{ minWidth: 36, textAlign: 'center' }}>{value}</Txt>
      <IconButton icon="plus" a11y={`More: ${label}`} onPress={() => onChange(Math.min(max, value + 1))} />
    </Row>
  );
}
