import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, IconButton, Note, Pill, Row, Screen, Segmented, Sheet, Txt, PageHeader } from '../components/ui';
import { Icon } from '../brand/Icon';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { countryOf, formatMoney, parseMoney, toInputString } from '../money';
import { clampText , newId } from '../security';
import { CatalogItem, ModifierGroup, RecipeLine, useApp } from '../store';
import { ALL_FEATURES, Unit } from '../catalogue';
import { Scanner } from '../components/Scanner';
import { nativePrinting } from '../print/transports';

/** "Small, Large +2, Extra shot +1.5" → options with prices in minor units. */
function parseOptions(text: string, decimals: number) {
  return text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const mt = x.match(/^(.*?)\s*\+\s*([\d.]+)$/);
      const price = mt ? parseMoney(mt[2], decimals) : 0;
      return { name: (mt ? mt[1] : x).slice(0, 30), priceMinor: price ?? 0 };
    })
    .slice(0, 12);
}

export default function Items({ onBack }: { onBack?: () => void }) {
  const { t } = useT();
  const th = useTheme();
  const b = useApp((s) => s.business)!;
  const items = useApp((s) => s.items);
  const addItem = useApp((s) => s.addItem);
  const updateItem = useApp((s) => s.updateItem);
  const c = countryOf(b.country);
  const [edit, setEdit] = useState<CatalogItem | 'new' | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cat, setCat] = useState('');
  const [unit, setUnit] = useState<Unit>('each');
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const features = b.features ?? ALL_FEATURES;
  const [track, setTrack] = useState<'yes' | 'no'>('no');
  const [stock, setStock] = useState('');
  const [lowAt, setLowAt] = useState('');
  const [add, setAdd] = useState('');
  const [groups, setGroups] = useState<{ id: string; name: string; multi: boolean; text: string }[]>([]);
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);
  const ingredients = useApp((s) => s.ingredients);
  const restock = useApp((s) => s.restock);
  const int = (v: string) => (/^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : null);

  const openEdit = (it: CatalogItem | 'new') => {
    setEdit(it);
    setName(it === 'new' ? '' : it.name);
    setPrice(it === 'new' ? '' : toInputString(it.priceMinor, c.decimals));
    setCat(it === 'new' ? '' : it.category);
    setUnit(it === 'new' ? 'each' : it.unit ?? 'each');
    setBarcode(it === 'new' ? '' : it.barcode ?? '');
    const tracked = it !== 'new' && it.stock != null;
    setTrack(tracked ? 'yes' : 'no');
    setStock(tracked ? String(it.stock) : '');
    setLowAt(tracked ? String(it.lowAt ?? 0) : '3');
    setAdd('');
    const fmt = (n: number) => (n ? ` +${toInputString(n, c.decimals)}` : '');
    setGroups(it === 'new' ? [] : (it.modifiers ?? []).map((g) => ({ id: g.id, name: g.name, multi: g.multi, text: g.options.map((o) => o.name + fmt(o.priceMinor)).join(', ') })));
    setRecipe(it === 'new' ? [] : (it.recipe ?? []).map((r) => ({ ...r })));
  };
  const recipeCost = recipe.reduce((a, r) => a + r.qty * (ingredients.find((g) => g.id === r.ingredientId)?.costMinor ?? 0), 0);
  const stockOk = track === 'no' || (int(stock) != null && int(lowAt) != null);
  const p = parseMoney(price, c.decimals);
  const save = () => {
    if (!name.trim() || p == null || !stockOk) return;
    const stockPatch = track === 'yes' ? { stock: int(stock)!, lowAt: int(lowAt)! } : { stock: null };
    const modifiers: ModifierGroup[] = groups
      .filter((g) => g.name.trim() && parseOptions(g.text, c.decimals).length)
      .map((g) => ({ id: g.id, name: clampText(g.name.trim(), 30), multi: g.multi, options: parseOptions(g.text, c.decimals) }));
    const extra = { ...stockPatch, modifiers, recipe: recipe.filter((r) => r.qty > 0), unit, barcode: barcode.trim().slice(0, 64) || undefined };
    if (edit === 'new') {
      addItem(clampText(name, 60), p, clampText(cat, 30));
      const created = useApp.getState().items.at(-1);
      if (created) updateItem(created.id, extra);
    } else if (edit) updateItem(edit.id, { name: clampText(name, 60), priceMinor: p, category: clampText(cat, 30), ...extra });
    setEdit(null);
  };

  return (
    <Screen>
      <PageHeader kicker="Manage" title="Items & stock" onBack={onBack} action={<Button size="sm" kind="secondary" icon="plus" label="Add" onPress={() => openEdit('new')} />} />
      <Txt size={13} dim>Prices include {b.tax.enabled && b.tax.inclusive ? b.tax.name : 'no tax'}{b.tax.enabled && !b.tax.inclusive ? ` — ${b.tax.name} is added at checkout` : ''}. Changing a price never changes past receipts.</Txt>
      {items.map((it) => (
        <Card key={it.id} onPress={() => openEdit(it)} a11y={`Edit ${it.name}`} style={{ opacity: it.active ? 1 : 0.55 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Row gap={6}>{it.favorite ? <Icon name="star" size={16} color={th.text} label="Favourite" /> : null}<Txt weight="600">{it.name}</Txt></Row>
              <Row gap={6}>
                {!!it.category && <Pill tone="info" text={it.category} />}
                {!!it.modifiers?.length && <Pill tone="pending" text={`${it.modifiers.length} option ${it.modifiers.length === 1 ? 'group' : 'groups'}`} />}
                {!!it.recipe?.length && <Pill tone="success" text="Recipe" />}
                {!it.active && <Pill tone="warning" text="Hidden" />}
                {it.stock != null && <Pill tone={it.stock <= (it.lowAt ?? 0) ? 'warning' : 'success'} text={it.stock <= 0 ? 'Out of stock' : `${it.stock} left`} />}
              </Row>
            </View>
            <Txt size={17} weight="700" mono>{formatMoney(it.priceMinor, c)}{it.unit && it.unit !== 'each' ? ` /${it.unit}` : ''}</Txt>
          </Row>
        </Card>
      ))}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New item' : 'Edit item'}>
        <Field label="Name" value={name} onChange={setName} maxLength={60} autoFocus />
        <Field label={`Price (${c.currency})${unit !== 'each' ? ` per ${unit}` : ''}`} value={price} onChange={setPrice} keyboard="decimal-pad" mono error={price && p == null ? 'Invalid price' : undefined} />
        {features.weight && (
          <>
            <Txt size={14} weight="600">Sold by</Txt>
            <Segmented value={unit} onChange={setUnit} options={(['each', 'kg', 'g', 'm', 'L'] as Unit[]).map((u) => ({ value: u, label: u === 'each' ? 'Piece' : u }))} />
          </>
        )}
        <Field label="Category (optional)" value={cat} onChange={setCat} maxLength={30} />
        {features.barcode && (
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label="Barcode (optional)" value={barcode} onChange={setBarcode} mono keyboard="number-pad" maxLength={64} /></View>
            {nativePrinting && <IconButton icon="scan" a11y="Scan the barcode" onPress={() => setScanning(true)} />}
          </Row>
        )}
        <Scanner visible={scanning} title="Scan product barcode" onClose={() => setScanning(false)} onCode={(code) => { setBarcode(code); setScanning(false); }} />
        {features.stock && <Txt size={14} weight="600">Track stock</Txt>}
        {features.stock && <Segmented value={track} onChange={setTrack} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes · count down as I sell' }]} />}
        {features.stock && track === 'yes' && (
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="In stock now" value={stock} onChange={setStock} keyboard="number-pad" mono error={stock && int(stock) == null ? 'Whole number' : undefined} /></View>
            <View style={{ flex: 1 }}><Field label="Warn me at" value={lowAt} onChange={setLowAt} keyboard="number-pad" mono error={lowAt && int(lowAt) == null ? 'Whole number' : undefined} /></View>
          </Row>
        )}
        {features.stock && track === 'yes' && edit && edit !== 'new' && edit.stock != null && (
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field label="Delivery arrived · add" value={add} onChange={setAdd} keyboard="number-pad" mono /></View>
            <Button icon="plus" label="Restock" disabled={!int(add)} onPress={() => { restock(edit.id, int(add)!); setEdit(null); }} />
          </Row>
        )}
        {features.modifiers && <Txt size={14} weight="600">Options · size, sugar, add-ons</Txt>}
        {features.modifiers && groups.map((g, gi) => (
          <Card key={g.id} style={{ gap: 8, padding: 12, borderRadius: 16 }}>
            <Row style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Field label="Group" value={g.name} onChange={(v) => setGroups(groups.map((x, i) => (i === gi ? { ...x, name: v } : x)))} placeholder="e.g. Size" /></View>
              <IconButton icon="trash" a11y="Remove this option group" onPress={() => setGroups(groups.filter((_, i) => i !== gi))} />
            </Row>
            <Segmented value={g.multi ? 'many' : 'one'} onChange={(v) => setGroups(groups.map((x, i) => (i === gi ? { ...x, multi: v === 'many' } : x)))} options={[{ value: 'one', label: 'Pick one' }, { value: 'many', label: 'Pick any' }]} />
            <Field label="Choices" value={g.text} onChange={(v) => setGroups(groups.map((x, i) => (i === gi ? { ...x, text: v } : x)))} placeholder="Small, Large +2, Extra shot +1.5" hint="Separate with commas. Add +price for extras." />
          </Card>
        ))}
        {features.modifiers && <Button kind="ghost" icon="plus" label="Add option group" onPress={() => setGroups([...groups, { id: newId(), name: '', multi: false, text: '' }])} disabled={groups.length >= 6} />}

        {features.recipes && <Txt size={14} weight="600">Recipe · ingredients used per item</Txt>}
        {!features.recipes ? null : ingredients.length === 0 ? (
          <Txt size={13} dim>Add ingredients in Manage → Ingredients to track cost and stock per item.</Txt>
        ) : (
          <>
            {recipe.map((r, ri) => {
              const g = ingredients.find((x) => x.id === r.ingredientId);
              return (
                <Row key={r.ingredientId} style={{ alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}><Field label={`${g?.name ?? '?'} (${g?.unit ?? ''})`} value={String(r.qty || '')} onChange={(v) => setRecipe(recipe.map((x, i) => (i === ri ? { ...x, qty: Number(v.replace(/[^\d.]/g, '')) || 0 } : x)))} keyboard="decimal-pad" mono /></View>
                  <IconButton icon="close" a11y={`Remove ${g?.name}`} onPress={() => setRecipe(recipe.filter((_, i) => i !== ri))} />
                </Row>
              );
            })}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ingredients.filter((g) => !recipe.some((r) => r.ingredientId === g.id)).map((g) => (
                <Button key={g.id} size="sm" kind="outline" icon="plus" label={g.name} onPress={() => setRecipe([...recipe, { ingredientId: g.id, qty: 0 }])} />
              ))}
            </View>
            {recipe.length > 0 && p != null && (
              <Note tone={p > 0 && (p - recipeCost) / p < 0.3 ? 'warning' : 'info'} text={`Cost about ${formatMoney(recipeCost, c)} · margin about ${p > 0 ? Math.round(((p - recipeCost) / p) * 100) : 0}% before tax.`} />
            )}
          </>
        )}
        <Button size="lg" label={t('save')} disabled={!name.trim() || p == null || !stockOk} onPress={save} />
        {edit && edit !== 'new' && (
          <Row>
            <Button kind="outline" icon="star" label={edit.favorite ? 'Remove favourite' : 'Make favourite'} onPress={() => { updateItem(edit.id, { favorite: !edit.favorite }); setEdit(null); }} style={{ flex: 1 }} />
            <Button kind="outline" label={edit.active ? 'Hide' : 'Show'} onPress={() => { updateItem(edit.id, { active: !edit.active }); setEdit(null); }} style={{ flex: 1 }} />
          </Row>
        )}
      </Sheet>
    </Screen>
  );
}
