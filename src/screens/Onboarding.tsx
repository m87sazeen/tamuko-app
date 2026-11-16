// Onboarding journey — country → what you run → name & tools → how you serve → starter items → ready.
// Every step has a sensible default so an owner can tap through it in under a minute, and everything
// can be changed later in Manage and Settings.
import { getLocales } from 'expo-localization';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../brand/Icon';
import { FlowPreview, PresetPicker, Stepper } from '../components/Workflow';
import { Button, Card, Field, H1, H2, Kicker, Logo, Note, Row, Screen, Tick, Txt } from '../components/ui';
import { BUSINESS_TYPES, BizType, CATEGORIES, CategoryId, FEATURE_INFO, Features, LOCAL_NAMES, featuresFor, localPrice, stepsFor, typeById } from '../catalogue';
import { langOf } from '../i18n';
import { COUNTRIES, countryOf, parseMoney, pctLabel, toInputString } from '../money';
import { clampText, newId } from '../security';
import { ModifierGroup, useApp } from '../store';
import { useTheme } from '../theme';
import { MODE_LABEL, PRESETS_FOR, ServiceMode, TEMPLATES, clone, defaultService, presetById, tableNames } from '../workflow';

type Draft = { name: string; price: string; unit?: string; options?: { name: string; multi?: boolean; choices: string } };
const STEPS = ['Country', 'Business', 'Name', 'Workflow', 'Menu', 'Ready'] as const;

const REGION_OF: Record<string, string> = {
  AE: 'Gulf & Middle East', SA: 'Gulf & Middle East', QA: 'Gulf & Middle East', KW: 'Gulf & Middle East', BH: 'Gulf & Middle East', OM: 'Gulf & Middle East', JO: 'Gulf & Middle East', EG: 'Gulf & Middle East', TR: 'Gulf & Middle East',
  KZ: 'Central Asia', UZ: 'Central Asia', PK: 'South Asia', IN: 'South Asia', BD: 'South Asia', LK: 'South Asia', NP: 'South Asia', MV: 'South Asia',
  TH: 'Southeast Asia', VN: 'Southeast Asia', ID: 'Southeast Asia', MY: 'Southeast Asia', SG: 'Southeast Asia', PH: 'Southeast Asia', KH: 'Southeast Asia', LA: 'Southeast Asia', MM: 'Southeast Asia',
  CN: 'East Asia', HK: 'East Asia', TW: 'East Asia', JP: 'East Asia', KR: 'East Asia', MN: 'East Asia', US: 'Elsewhere',
};

/** Parse "Cheese +2, Jalapeños +1" into options with minor-unit prices, in the local currency. */
function optionsFrom(o: Draft['options'], decimals: number): ModifierGroup[] {
  if (!o) return [];
  const options = o.choices
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^(.*?)\s*\+\s*([\d.]+)$/);
      return { name: (m ? m[1] : x).slice(0, 30), priceMinor: m ? parseMoney(m[2], decimals) ?? 0 : 0 };
    });
  return options.length ? [{ id: newId(), name: o.name, multi: !!o.multi, options }] : [];
}

export default function Onboarding() {
  const th = useTheme();
  const setBusiness = useApp((s) => s.setBusiness);
  const addItem = useApp((s) => s.addItem);
  const updateItem = useApp((s) => s.updateItem);
  const setSettings = useApp((s) => s.setSettings);
  const [step, setStep] = useState(0);
  const [cc, setCc] = useState(() => {
    const r = getLocales()[0]?.regionCode ?? 'AE';
    return COUNTRIES.some((c) => c.code === r) ? r : 'AE';
  });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CategoryId>('food');
  const [typeId, setTypeId] = useState<string>('street');
  const [localName, setLocalName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [features, setFeatures] = useState<Features>(() => featuresFor(typeById('street')!));
  const [dineIn, setDineIn] = useState(false);
  const [takeaway, setTakeaway] = useState(true);
  const [tables, setTables] = useState(0);
  const [presets, setPresets] = useState<Record<ServiceMode, string>>({ takeaway: 'pay-first', dinein: 'pay-at-end' });
  const [items, setItems] = useState<Draft[]>([]);
  const [err, setErr] = useState('');

  const country = countryOf(cc);
  const T: BizType = typeById(typeId)!;
  const tpl = TEMPLATES[T.template];
  const customSteps = stepsFor(T);
  const canDineIn = !customSteps && PRESETS_FOR[T.template].dinein.length > 0;
  const effDine = dineIn && tables > 0;
  const effTake = takeaway || !effDine;
  const showWorkflow = T.rail; // shops and gyms sell and hand over: no workflow step
  const visibleSteps = STEPS.filter((s) => s !== 'Workflow' || showWorkflow);
  const at = visibleSteps.indexOf(STEPS[step]);

  const go = (s: (typeof STEPS)[number]) => setStep(STEPS.indexOf(s));
  const next = () => go(visibleSteps[Math.min(visibleSteps.length - 1, at + 1)]);
  const back = () => go(visibleSteps[Math.max(0, at - 1)]);

  const chooseType = (id: string, local: string | null = null) => {
    const t = typeById(id)!;
    setTypeId(id);
    setLocalName(local);
    setCat(t.category);
    setFeatures(featuresFor(t));
    const d = defaultService(t.template);
    setDineIn(!stepsFor(t) && d.modes.includes('dinein'));
    setTakeaway(d.modes.includes('takeaway') || !!stepsFor(t));
    setTables(stepsFor(t) ? 0 : d.tables.length);
    setPresets(d.presetIds);
    setItems(
      t.samples.map((s) => ({
        name: s.name,
        price: toInputString(Math.round(localPrice(s.price, country.currency) * 10 ** country.decimals), country.decimals),
        unit: s.unit && s.unit !== 'each' ? s.unit : undefined,
        options: s.options,
      })),
    );
  };

  const typesShown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? BUSINESS_TYPES.filter((t) => t.label.toLowerCase().includes(term) || t.hint.toLowerCase().includes(term)) : BUSINESS_TYPES.filter((t) => t.category === cat);
  }, [q, cat]);
  const countriesShown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(term) || c.currency.toLowerCase().includes(term) || c.code.toLowerCase() === term) : COUNTRIES;
  }, [q]);

  const finish = () => {
    const valid = items.filter((d) => d.name.trim() && parseMoney(d.price, country.decimals) != null);
    if (!valid.length) return setErr('Add at least one item with a name and price.');
    const base = defaultService(T.template, tables);
    const modes: ServiceMode[] = customSteps ? ['takeaway'] : [...(effTake ? (['takeaway'] as ServiceMode[]) : []), ...(effDine ? (['dinein'] as ServiceMode[]) : [])];
    const takeawayFlow = customSteps ?? clone(presetById(presets.takeaway)?.steps ?? base.flows.takeaway);
    setBusiness({
      name: clampText(name.trim(), 60),
      country: cc,
      template: T.template,
      typeId: T.id,
      features: { ...features, tables: features.tables && effDine },
      service: {
        ...base,
        modes,
        defaultMode: effDine && tpl.defaultMode === 'dinein' ? 'dinein' : modes[0],
        tables: tableNames(effDine ? tables : 0),
        flows: { takeaway: takeawayFlow, dinein: clone(presetById(presets.dinein)?.steps ?? base.flows.dinein) },
        presetIds: { takeaway: customSteps ? 'custom' : presets.takeaway, dinein: presets.dinein },
      },
      railEnabled: T.rail,
      qrPayload: '',
      qrImage: null,
      qrLabel: '',
      logo: null,
      receiptFooter: 'Thank you!',
      tax: { enabled: country.tax.rateBp > 0, name: country.tax.name, rateBp: country.tax.rateBp, inclusive: country.tax.inclusive, registrationNo: '' },
      usd: { show: false, localPerUsd: 0, updatedAt: null, source: 'manual' },
      integrations: {},
      rewards: features.rewards ? { enabled: true, itemId: null, every: 10, validDays: 30 } : undefined,
      createdAt: 0,
    });
    setSettings({ language: country.lang });
    valid.forEach((d) => {
      addItem(clampText(d.name, 60), parseMoney(d.price, country.decimals)!);
      const created = useApp.getState().items.at(-1);
      const mods = optionsFrom(d.options, country.decimals);
      if (created && (mods.length || d.unit)) updateItem(created.id, { ...(mods.length ? { modifiers: mods } : {}), ...(d.unit ? { unit: d.unit as any } : {}) });
    });
  };

  const onFeatures = (Object.keys(FEATURE_INFO) as (keyof Features)[]).filter((k) => features[k]);

  return (
    <Screen key={step} style={{ maxWidth: 620, paddingTop: 28 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Logo />
        <Txt dim mono size={13}>{at + 1} / {visibleSteps.length}</Txt>
      </Row>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: th.inset }}>
        <View style={{ width: `${((at + 1) / visibleSteps.length) * 100}%`, height: 6, borderRadius: 99, backgroundColor: th.primary }} />
      </View>

      {STEPS[step] === 'Country' && (
        <Card style={{ gap: 14 }}>
          <Kicker>Where you trade</Kicker>
          <H1>Your country</H1>
          <Txt dim>Sets your currency, sales tax and language. You can change it later.</Txt>
          <Field label="Search country or currency" value={q} onChange={setQ} placeholder="e.g. India or THB" />
          {[...new Set(countriesShown.map((c) => REGION_OF[c.code] ?? 'Elsewhere'))].map((region) => (
            <View key={region} style={{ gap: 8 }}>
              <Kicker color={th.textDim}>{region}</Kicker>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {countriesShown.filter((c) => (REGION_OF[c.code] ?? 'Elsewhere') === region).map((c) => (
                  <Button key={c.code} size="sm" kind={c.code === cc ? 'secondary' : 'outline'} label={`${c.name} · ${c.currency}`} a11y={c.name} onPress={() => setCc(c.code)} />
                ))}
              </View>
            </View>
          ))}
          <Note tone="info" text={`${country.name}: ${country.currency} · ${country.tax.rateBp ? `${country.tax.name} ${pctLabel(country.tax.rateBp)} ${country.tax.inclusive ? 'included in prices' : 'added at checkout'}` : 'no sales tax by default'} · ${langOf(country.lang).native}`} />
          <Button size="lg" label="Next" onPress={() => { setQ(''); chooseType(typeId, localName); next(); }} />
        </Card>
      )}

      {STEPS[step] === 'Business' && (
        <Card style={{ gap: 12 }}>
          <Kicker>Business type</Kicker>
          <H1>What do you run?</H1>
          <Field label="Search" value={q} onChange={setQ} placeholder="e.g. laundry, pharmacy, gym" />
          {!q && LOCAL_NAMES[cc] && (
            <View style={{ gap: 8 }}>
              <Txt size={14} weight="600">Popular in {country.name}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {LOCAL_NAMES[cc].map(([label, id]) => (
                  <Button key={label} size="sm" kind={localName === label ? 'secondary' : 'outline'} label={label} onPress={() => chooseType(id, label)} />
                ))}
              </View>
            </View>
          )}
          {!q && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Button key={c.id} size="sm" icon={c.icon} kind={cat === c.id ? 'secondary' : 'outline'} label={c.label} onPress={() => setCat(c.id)} />
              ))}
            </View>
          )}
          {typesShown.map((t) => (
            <Card key={t.id} onPress={() => chooseType(t.id)} a11y={t.label} selected={typeId === t.id} style={{ padding: 14, borderRadius: 18, gap: 4 }}>
              <Row gap={10}>
                <Tick on={typeId === t.id} />
                <Txt weight="600" style={{ flex: 1 }}>{t.label}</Txt>
                {t.permit ? <Txt size={12} dim>permit</Txt> : null}
              </Row>
              <Txt size={14} dim style={{ marginLeft: 30 }}>{t.hint}</Txt>
            </Card>
          ))}
          {T.permit && <Note tone="info" text="This kind of business usually needs a local trade permit or licence. tamuko does not check permits." />}
          <Row>
            <Button kind="outline" label="Back" onPress={() => { setQ(''); back(); }} style={{ flex: 1 }} />
            <Button label="Next" onPress={() => { setQ(''); next(); }} style={{ flex: 2 }} />
          </Row>
        </Card>
      )}

      {STEPS[step] === 'Name' && (
        <Card style={{ gap: 14 }}>
          <Kicker>{localName ?? T.label}</Kicker>
          <H1>Name your business</H1>
          <Field label="Business name" value={name} onChange={setName} placeholder="e.g. Al Noor Cafeteria" maxLength={60} autoFocus onSubmit={() => name.trim() && next()} />
          <H2 size={18}>Tools switched on for you</H2>
          <Txt size={14} dim>Picked for a {(localName ?? T.label).toLowerCase()}. Tap to change — you can switch tools on or off any time in Manage.</Txt>
          {(Object.keys(FEATURE_INFO) as (keyof Features)[]).map((k) => (
            <Pressable key={k} accessibilityRole="checkbox" accessibilityState={{ checked: features[k] }} onPress={() => setFeatures({ ...features, [k]: !features[k] })}>
              <Row gap={10} style={{ paddingVertical: 6 }}>
                <Tick on={features[k]} />
                <View style={{ flex: 1 }}>
                  <Txt weight="600">{FEATURE_INFO[k].label}</Txt>
                  <Txt size={13} dim>{FEATURE_INFO[k].hint}</Txt>
                </View>
              </Row>
            </Pressable>
          ))}
          <Row>
            <Button kind="outline" label="Back" onPress={back} style={{ flex: 1 }} />
            <Button label="Next" disabled={!name.trim()} onPress={next} style={{ flex: 2 }} />
          </Row>
        </Card>
      )}

      {STEPS[step] === 'Workflow' && (
        <Card style={{ gap: 14 }}>
          <Kicker>Workflow</Kicker>
          <H1>{customSteps ? 'How a job moves' : 'How do you serve?'}</H1>
          {customSteps ? (
            <>
              <Txt dim>Every {T.category === 'services' ? 'job' : 'order'} gets a token and moves through these steps on the rail. Payment is taken at “Paid”.</Txt>
              <FlowPreview steps={customSteps} />
              <Note tone="info" text="Rename steps, add your own or move the payment step later in Manage → Workflow." />
            </>
          ) : (
            <>
              {canDineIn && (
                <>
                  <Row gap={8}>
                    <Button kind={takeaway ? 'secondary' : 'outline'} icon="bag" label={MODE_LABEL.takeaway} onPress={() => setTakeaway(!takeaway || !dineIn)} style={{ flex: 1 }} />
                    <Button kind={dineIn ? 'secondary' : 'outline'} icon="table" label={MODE_LABEL.dinein} onPress={() => { const v = !dineIn; setDineIn(v); if (v && tables === 0) setTables(6); if (!v) setTakeaway(true); setFeatures({ ...features, tables: v }); }} style={{ flex: 1 }} />
                  </Row>
                  {dineIn && <Stepper label="Tables" value={tables} onChange={setTables} max={100} />}
                  {dineIn && tables === 0 && <Note tone="info" text="No tables, so orders will be take away." />}
                </>
              )}
              {effTake && (
                <View style={{ gap: 8 }}>
                  <Txt size={17} weight="800" heading>{MODE_LABEL.takeaway}</Txt>
                  <PresetPicker tpl={T.template} mode="takeaway" value={presets.takeaway} onPick={(p) => setPresets({ ...presets, takeaway: p.id })} />
                </View>
              )}
              {effDine && (
                <View style={{ gap: 8 }}>
                  <Txt size={17} weight="800" heading>{MODE_LABEL.dinein} · {tables} tables</Txt>
                  <PresetPicker tpl={T.template} mode="dinein" value={presets.dinein} onPick={(p) => setPresets({ ...presets, dinein: p.id })} />
                </View>
              )}
            </>
          )}
          <Row>
            <Button kind="outline" label="Back" onPress={back} style={{ flex: 1 }} />
            <Button label="Next" onPress={next} style={{ flex: 2 }} />
          </Row>
        </Card>
      )}

      {STEPS[step] === 'Menu' && (
        <Card style={{ gap: 12 }}>
          <Kicker>{T.category === 'food' ? 'Menu' : T.category === 'retail' ? 'Products' : 'Price list'}</Kicker>
          <H1>Your first items</H1>
          <Txt dim>We filled in a few to start. Change names and prices to yours — add more later in Manage → Items.</Txt>
          {items.map((d, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 2 }}>
                <Field label={`Item ${i + 1}${d.options ? ` · ${d.options.name.toLowerCase()} options` : ''}`} value={d.name} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, name: v } : x)))} maxLength={60} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={`${country.currency}${d.unit ? ` / ${d.unit}` : ''}`} value={d.price} keyboard="decimal-pad" mono onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, price: v } : x)))} error={d.price && parseMoney(d.price, country.decimals) == null ? 'Invalid' : undefined} />
              </View>
            </Row>
          ))}
          <Button kind="ghost" icon="plus" label="Add another" onPress={() => setItems([...items, { name: '', price: '' }])} />
          {!!err && <Note tone="error" text={err} />}
          <Row>
            <Button kind="outline" label="Back" onPress={back} style={{ flex: 1 }} />
            <Button label="Next" onPress={() => { setErr(''); next(); }} style={{ flex: 2 }} />
          </Row>
        </Card>
      )}

      {STEPS[step] === 'Ready' && (
        <Card style={{ gap: 14 }}>
          <Kicker>All set</Kicker>
          <H1>{name.trim() || 'Your business'} is ready</H1>
          <View style={{ gap: 8 }}>
            <Row gap={10}><Icon name="globe" size={20} color={th.text} /><Txt style={{ flex: 1 }}>{country.name} · {country.currency} · {country.tax.rateBp ? `${country.tax.name} ${pctLabel(country.tax.rateBp)}` : 'no sales tax'}</Txt></Row>
            <Row gap={10}><Icon name="bag" size={20} color={th.text} /><Txt style={{ flex: 1 }}>{localName ?? T.label} · {items.filter((d) => d.name.trim()).length} items</Txt></Row>
            {T.rail && <Row gap={10} style={{ alignItems: 'flex-start' }}><Icon name="rail" size={20} color={th.text} /><View style={{ flex: 1 }}><FlowPreview compact steps={customSteps ?? presetById(presets.takeaway)?.steps ?? []} /></View></Row>}
          </View>
          {onFeatures.length > 0 && <Txt size={14} dim>Switched on: {onFeatures.map((k) => FEATURE_INFO[k].label).join(', ')}.</Txt>}
          <Note tone="info" text="Next, in Manage: add your payment QR, connect a printer, and set a PIN so only you can open the app." />
          {!!err && <Note tone="error" text={err} />}
          <Row>
            <Button kind="outline" label="Back" onPress={back} style={{ flex: 1 }} />
            <Button size="lg" label="Start selling" onPress={finish} style={{ flex: 2 }} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
