// Onboarding — two quick steps with tiles: 1) what you run, 2) where you trade. Then you're in.
// Tap a tile to select it (it glows), Next to continue, Back to change. Name, prices, workflow and
// tools all get sensible defaults and can be changed later.
import { getLocales } from 'expo-localization';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import { Icon } from '../brand/Icon';
import { Dropdown } from '../components/Dropdown';
import { pickImage } from '../images';
import { useTheme } from '../theme';
import { LanguageButton } from '../components/LanguageButton';
import { FadeIn, Field, H1, Logo, Row, Screen, Segmented, StepBar, Tile, Txt } from '../components/ui';
import { BUSINESS_TYPES, BizType, CATEGORIES, CategoryId, LOCAL_NAMES, TYPE_ICON, featuresFor, localPrice, stepsFor, typeById } from '../catalogue';
import { COUNTRIES, countryOf, pctLabel } from '../money';
import { newId } from '../security';
import { ModifierGroup, useApp } from '../store';
import { TEMPLATES, clone, defaultService, presetById } from '../workflow';

/** "Cheese +2, Jalapeños +1" → option group with local prices. */
function optionsFrom(o: BizType['samples'][number]['options'], currency: string, decimals: number): ModifierGroup[] {
  if (!o) return [];
  const options = o.choices
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^(.*?)\s*\+\s*([\d.]+)$/);
      return { name: (m ? m[1] : x).slice(0, 30), priceMinor: m ? Math.round(localPrice(Number(m[2]), currency) * 10 ** decimals) : 0 };
    });
  return options.length ? [{ id: newId(), name: o.name, multi: !!o.multi, options }] : [];
}

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const tileW = `${100 / cols - 3}%` as const;
  const setBusiness = useApp((s) => s.setBusiness);
  const addItem = useApp((s) => s.addItem);
  const updateItem = useApp((s) => s.updateItem);
  const setSettings = useApp((s) => s.setSettings);
  const [step, setStep] = useState<0 | 1>(0);
  const [cc, setCc] = useState(() => {
    const r = getLocales()[0]?.regionCode ?? 'AE';
    return COUNTRIES.some((c) => c.code === r) ? r : 'AE';
  });
  const detected = useState(cc)[0];
  const [cat, setCat] = useState<CategoryId>('food');
  const [pick, setPick] = useState<{ id: string; local?: string } | null>(null);
  const [langPicked, setLangPicked] = useState(false);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const th = useTheme();
  const country = countryOf(cc);
  const locals = (LOCAL_NAMES[cc] ?? []).slice(0, 4);
  const countries = useMemo(() => [...COUNTRIES.filter((c) => c.code === detected), ...COUNTRIES.filter((c) => c.code !== detected)], [detected]);

  /** Create the business with good defaults and go straight in. */
  const start = () => {
    if (!pick) return;
    const t = typeById(pick.id)!;
    const tpl = TEMPLATES[t.template];
    const custom = stepsFor(t);
    const base = defaultService(t.template);
    const takeaway = custom ?? clone(presetById(base.presetIds.takeaway)!.steps);
    const features = featuresFor(t);
    setBusiness({
      name: name.trim() || pick.local || t.label,
      logo: logo,
      brandSet: !!(name.trim() || logo),
      country: cc,
      template: t.template,
      typeId: t.id,
      features: { ...features, tables: features.tables && base.tables.length > 0 },
      service: { ...base, modes: custom ? ['takeaway'] : base.modes, defaultMode: custom ? 'takeaway' : tpl.defaultMode === 'dinein' && base.tables.length ? 'dinein' : 'takeaway', flows: { ...base.flows, takeaway }, presetIds: { ...base.presetIds, takeaway: custom ? 'custom' : base.presetIds.takeaway } },
      railEnabled: t.rail,
      qrPayload: '',
      qrImage: null,
      qrLabel: '',
      receiptFooter: 'Thank you!',
      tax: { enabled: country.tax.rateBp > 0, name: country.tax.name, rateBp: country.tax.rateBp, inclusive: country.tax.inclusive, registrationNo: '' },
      usd: { show: false, localPerUsd: 0, updatedAt: null, source: 'manual' },
      integrations: {},
      rewards: features.rewards ? { enabled: true, itemId: null, every: 10, validDays: 30 } : undefined,
      createdAt: 0,
    });
    if (!langPicked) setSettings({ language: country.lang });
    t.samples.forEach((s) => {
      addItem(s.name, Math.round(localPrice(s.price, country.currency) * 10 ** country.decimals));
      const created = useApp.getState().items.at(-1);
      const mods = optionsFrom(s.options, country.currency, country.decimals);
      if (created && (mods.length || (s.unit && s.unit !== 'each'))) updateItem(created.id, { ...(mods.length ? { modifiers: mods } : {}), ...(s.unit && s.unit !== 'each' ? { unit: s.unit } : {}) });
    });
  };

  const grid = (children: React.ReactNode) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;

  return (
    <View style={{ flex: 1 }}>
      <Screen style={{ maxWidth: 900, paddingTop: 24, gap: 18 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Logo />
          <LanguageButton onPicked={() => setLangPicked(true)} />
        </Row>
        <Row gap={6}>
          {[0, 1].map((i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: i <= step ? th.primary : th.border }} />)}
        </Row>

        {step === 0 ? (
          <FadeIn key="type" style={{ gap: 16 }}>
            <H1>What do you run?</H1>
            {locals.length > 0 && (
              <View style={{ gap: 10 }}>
                <Txt size={14} weight="600" dim>Popular in {country.name}</Txt>
                {grid(locals.map(([label, id]) => (
                  <Tile key={label} style={{ width: tileW }} icon={TYPE_ICON[id] ?? 'shop'} label={label} selected={pick?.local === label} onPress={() => setPick({ id, local: label })} />
                )))}
              </View>
            )}
            <Segmented value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c.id, label: c.id === 'active' ? 'Fitness' : c.id === 'food' ? 'Food' : c.label }))} />
            {grid(BUSINESS_TYPES.filter((t) => t.category === cat).map((t, i) => (
              <FadeIn key={`${cat}-${t.id}`} delay={i * 25} style={{ width: tileW }}>
                <Tile icon={TYPE_ICON[t.id] ?? 'shop'} label={t.label} hint={t.hint} selected={pick?.id === t.id && !pick.local} onPress={() => setPick({ id: t.id })} />
              </FadeIn>
            )))}
          </FadeIn>
        ) : (
          <FadeIn key="details" style={{ gap: 18, maxWidth: 560 }}>
            <H1>Your business</H1>
            <Txt dim>Both optional — add them now or later in Settings.</Txt>
            <Row gap={14} style={{ alignItems: 'center' }}>
              <Pressable accessibilityRole="button" accessibilityLabel={logo ? 'Change logo' : 'Add your logo'} onPress={async () => { const d = await pickImage(256).catch(() => null); if (d) setLogo(d); }}>
                {({ pressed }: any) => (
                  <View style={{ width: 88, height: 88, borderRadius: 24, borderWidth: 2, borderStyle: logo ? 'solid' : 'dashed', borderColor: pressed ? th.primary : th.border, backgroundColor: th.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {logo ? <Image source={{ uri: logo }} style={{ width: 88, height: 88 }} /> : <Icon name="image" size={28} color={th.textDim} />}
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt weight="700">{logo ? 'Your logo' : 'Add your logo'}</Txt>
                <Txt size={13} dim>Shown in the app and on receipts.</Txt>
              </View>
            </Row>
            <Field label="Business name" value={name} onChange={setName} maxLength={60} placeholder={pick ? pick.local ?? typeById(pick.id)?.label : 'e.g. Al Noor Cafeteria'} onSubmit={start} />
            <Dropdown
              label="Country"
              icon="globe"
              value={cc}
              onChange={setCc}
              options={countries.map((c) => ({ value: c.code, label: c.name, hint: `${c.currency}${c.tax.rateBp ? ` · ${c.tax.name} ${pctLabel(c.tax.rateBp)}` : ''}` }))}
            />
          </FadeIn>
        )}
        <View style={{ height: 90 }} />
      </Screen>
      {step === 0 ? (
        <StepBar onNext={() => setStep(1)} nextDisabled={!pick} nextLabel={pick ? `Next · ${pick.local ?? typeById(pick.id)?.label}` : 'Choose your business'} />
      ) : (
        <StepBar onBack={() => setStep(0)} onNext={start} nextLabel="Start" />
      )}
    </View>
  );
}
