// Manage → Ingredients (tamuko Stock). Ingredients with unit cost and stock; recipes on items deduct
// them as you sell, give the true cost of every cup or plate, and warn before you run out.
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, Note, Pill, Row, Screen, Sheet, Txt, PageHeader } from '../components/ui';
import { countryOf, parseMoney } from '../money';
import { clampText } from '../security';
import { Ingredient, useApp } from '../store';

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs'];
const num = (v: string) => (/^\d+(\.\d{1,3})?$/.test(v.trim()) ? Number(v.trim()) : null);

export default function Ingredients({ onBack }: { onBack: () => void }) {
  const b = useApp((s) => s.business)!;
  const ingredients = useApp((s) => s.ingredients);
  const items = useApp((s) => s.items);
  const save = useApp((s) => s.saveIngredient);
  const remove = useApp((s) => s.removeIngredient);
  const restock = useApp((s) => s.restockIngredient);
  const c = countryOf(b.country);
  const perUnit = (minor: number) => (minor / 10 ** c.decimals).toFixed(c.decimals + 4).replace(/\.?0+$/, '');
  const [edit, setEdit] = useState<Ingredient | 'new' | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('g');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [lowAt, setLowAt] = useState('');
  const [add, setAdd] = useState('');

  const open = (g: Ingredient | 'new') => {
    setEdit(g);
    setName(g === 'new' ? '' : g.name);
    setUnit(g === 'new' ? 'g' : g.unit);
    // Cost is per unit in minor units; show it as money per unit (may be a small fraction for grams).
    setCost(g === 'new' ? '' : perUnit(g.costMinor));
    setStock(g === 'new' ? '' : String(g.stock));
    setLowAt(g === 'new' ? '' : String(g.lowAt));
    setAdd('');
  };
  // Costs per gram can be fractions of the smallest coin, so they are kept with 4 extra decimals.
  const scaled = cost ? parseMoney(cost, c.decimals + 4) : 0;
  const costMinor = scaled == null ? null : scaled / 10000;
  const ok = !!name.trim() && costMinor != null && num(stock || '0') != null && num(lowAt || '0') != null;
  const usedIn = (id: string) => items.filter((i) => i.recipe?.some((r) => r.ingredientId === id)).map((i) => i.name);
  const low = ingredients.filter((g) => g.stock <= g.lowAt);

  const submit = () => {
    if (!ok || !edit) return;
    save({
      ...(edit !== 'new' ? { id: edit.id } : {}),
      name: clampText(name.trim(), 40),
      unit,
      costMinor: costMinor ?? 0,
      stock: num(stock || '0')!,
      lowAt: num(lowAt || '0')!,
    } as any);
    setEdit(null);
  };

  return (
    <Screen style={{ maxWidth: 720 }}>
      <PageHeader kicker="Stock" title="Ingredients" onBack={onBack} action={<Button size="sm" kind="secondary" icon="plus" label="Add" onPress={() => open('new')} />} sub="Add what you buy (milk, tea, flour). Then give each menu item a recipe in Items & stock. Every sale deducts the ingredients and shows the real cost." />
      {low.length > 0 && <Note tone="warning" text={`Running low: ${low.map((g) => g.name).join(', ')}. Restock soon.`} />}
      {ingredients.length === 0 && <Note tone="info" text="No ingredients yet." />}
      {ingredients.map((g) => (
        <Card key={g.id} onPress={() => open(g)} a11y={`Edit ${g.name}`} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt weight="700" style={{ flex: 1 }}>{g.name}</Txt>
            <Pill tone={g.stock <= g.lowAt ? 'warning' : 'success'} text={`${g.stock} ${g.unit} left`} />
          </Row>
          <Txt size={13} dim mono>{c.currency} {perUnit(g.costMinor)} per {g.unit === 'pcs' ? 'piece' : g.unit}{usedIn(g.id).length ? ` · used in ${usedIn(g.id).join(', ')}` : ''}</Txt>
        </Card>
      ))}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New ingredient' : 'Edit ingredient'}>
        <Field label="Name" value={name} onChange={setName} maxLength={40} placeholder="e.g. Evaporated milk" />
        <Txt size={14} weight="600">Unit</Txt>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {UNITS.map((u) => <Button key={u} size="sm" kind={unit === u ? 'secondary' : 'outline'} label={u} onPress={() => setUnit(u)} />)}
        </Row>
        <Field label={`Cost per ${unit} (${c.currency})`} value={cost} onChange={setCost} keyboard="decimal-pad" mono placeholder="e.g. 0.012" hint="Price you pay divided by the amount, e.g. 12.00 for 1000 g = 0.012 per g." />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label={`In stock (${unit})`} value={stock} onChange={setStock} keyboard="decimal-pad" mono /></View>
          <View style={{ flex: 1 }}><Field label="Warn me at" value={lowAt} onChange={setLowAt} keyboard="decimal-pad" mono /></View>
        </Row>
        <Button size="lg" label="Save" disabled={!ok} onPress={submit} />
        {edit && edit !== 'new' && (
          <>
            <Row style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Field label={`Delivery arrived · add ${unit}`} value={add} onChange={setAdd} keyboard="decimal-pad" mono /></View>
              <Button icon="plus" label="Restock" disabled={!num(add)} onPress={() => { restock(edit.id, num(add)!); setEdit(null); }} />
            </Row>
            <Button kind="ghost" icon="trash" label="Remove ingredient" onPress={() => { remove(edit.id); setEdit(null); }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
