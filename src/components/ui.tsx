// UI kit following tamuko. brand guidelines v1.0.
// Type (matched to the tamuko.app website): Bricolage Grotesque 800 headings with tight tracking ·
// Instrument Serif italic accents · Inter 400/500/600 body and labels · JetBrains Mono for data and kickers.
// Icons: 24-grid line icons (never emoji). Materials: paper (tickets, receipts), glass (tab bars, sheets),
// brushed metal (rail only). Radius scale 4 / 12 / 18 / 24.
import { BlurView } from 'expo-blur';
import React, { ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { F, isLatin, scriptFont } from '../brand/fonts';
import { deviceLang } from '../i18n';
import { useApp } from '../store';
import { Icon, IconName } from '../brand/Icon';
import { Lockup, LogoVariant } from '../brand/Logo';
import { R, space, Theme, useTheme } from '../theme';

type Weight = '400' | '500' | '600' | '700' | '800';

/** Picks the brand font for a role; switches to the matching Noto font for non-Latin scripts. */
export function fontFor(weight: Weight, mono?: boolean, heading?: boolean, lang = 'en'): string {
  if (mono) return weight === '800' ? F.monoHeavy : weight === '400' || weight === '500' ? F.monoLight : F.mono;
  const script = scriptFont(lang, weight >= '600' ? 'bold' : 'regular');
  if (script) return script;
  if (heading) return weight === '800' ? F.heading : F.headingSoft;
  if (weight === '800') return F.heading;
  if (weight === '700') return F.bold;
  if (weight === '600') return F.label;
  if (weight === '500') return F.medium;
  return F.body;
}

type TxtProps = { children: ReactNode; size?: number; weight?: Weight; dim?: boolean; color?: string; style?: StyleProp<TextStyle>; center?: boolean; numberOfLines?: number; mono?: boolean; heading?: boolean };

export function useLang() {
  return useApp((s) => s.settings.language) || deviceLang();
}

export function Txt({ children, size = 16, weight = '400', dim, color, style, center, numberOfLines, mono, heading }: TxtProps) {
  const t = useTheme();
  const lang = useLang();
  const lh = heading || weight === '800' ? 1.2 : mono ? 1.3 : 1.55;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: fontFor(weight, mono, heading, lang), fontSize: size, color: color ?? (dim ? t.textDim : t.text), lineHeight: Math.round(size * lh) },
        mono && { fontVariant: ['tabular-nums'] },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Tight display tracking from the website (h1 -0.045em, h2 -0.035em); Latin scripts only. */
function track(lang: string, size: number, em: number) {
  return isLatin(lang) ? { letterSpacing: -size * em } : null;
}

/** Title · Bricolage Grotesque 800, like the website's h1/h2. */
export const H1 = ({ children, style, size = 28 }: { children: ReactNode; style?: StyleProp<TextStyle>; size?: number }) => {
  const lang = useLang();
  return <Txt size={size} weight="800" heading style={[track(lang, size, 0.035), style]}>{children}</Txt>;
};
export const H2 = ({ children, style, size = 20 }: { children: ReactNode; style?: StyleProp<TextStyle>; size?: number }) => {
  const lang = useLang();
  return <Txt size={size} weight="800" heading style={[track(lang, size, 0.02), style]}>{children}</Txt>;
};

/** Section kicker — the website's mono, uppercase, wide-tracked label above headings. */
export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  const lang = useLang();
  const latin = isLatin(lang);
  return (
    <Txt size={12} weight="700" mono={latin} color={color ?? t.accentText} style={latin ? { textTransform: 'uppercase', letterSpacing: 12 * 0.14 } : null}>
      {children}
    </Txt>
  );
}

/** One header for every page: optional back button, kicker, title and a right-side action. */
export function PageHeader({ kicker, title, onBack, action, sub }: { kicker?: string; title: string; onBack?: () => void; action?: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Row gap={12} style={{ flex: 1 }}>
          {onBack ? <IconButton icon="back" a11y="Back" onPress={onBack} /> : null}
          <View style={{ flex: 1 }}>
            {kicker ? <Kicker>{kicker}</Kicker> : null}
            <H1 size={26} style={{ marginTop: kicker ? 2 : 0 }}>{title}</H1>
          </View>
        </Row>
        {action ? <View style={{ marginLeft: 12 }}>{action}</View> : null}
      </Row>
      {sub ? <Txt dim>{sub}</Txt> : null}
    </View>
  );
}

/** Section title inside a page (consistent size and spacing). */
export const Section = ({ title, action }: { title: string; action?: ReactNode }) => (
  <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
    <H2 size={18}>{title}</H2>
    {action ?? null}
  </Row>
);

/** Serif italic highlight ("Made simple.") — Instrument Serif in Latin scripts, the script font elsewhere. */
export function Accent({ children, size, color }: { children: ReactNode; size: number; color?: string }) {
  const t = useTheme();
  const lang = useLang();
  if (!isLatin(lang)) return <Txt size={size} weight="800" heading color={color ?? t.accentText}>{children}</Txt>;
  return (
    <Text style={{ fontFamily: F.serif, fontSize: size * 1.08, letterSpacing: -size * 0.02, color: color ?? t.accentText }}>{children}</Text>
  );
}

type BtnKind = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';

export function Button({ label, onPress, kind = 'primary', disabled, loading, icon, style, size = 'md', a11y }: {
  label: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
  a11y?: string;
}) {
  const t = useTheme();
  const c = btnColors(t, kind);
  // Website .btn: pill, 600 weight, 15×24 padding, peach glow on the primary action.
  const h = size === 'lg' ? 56 : size === 'sm' ? 42 : 48;
  const fs = size === 'lg' ? 17 : size === 'sm' ? 15 : 16;
  const glow = kind === 'primary' && !disabled ? { boxShadow: '0 6px 20px -8px rgba(255,130,84,.8)', shadowColor: '#FF8254', shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, shadowOpacity: 0.45, elevation: 4 } : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: h,
          paddingHorizontal: size === 'sm' ? 18 : 24,
          borderRadius: R.pill,
          backgroundColor: c.bg,
          borderWidth: 1.5,
          borderColor: kind === 'outline' ? t.borderStrong : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.99 : 1 }],
        },
        glow as any,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} color={c.fg} /> : null}
          <Txt size={fs} weight="600" color={c.fg}>{label}</Txt>
        </>
      )}
    </Pressable>
  );
}

function btnColors(t: Theme, k: BtnKind) {
  switch (k) {
    case 'primary':
      return { bg: t.primary, fg: t.onPrimary }; // peach + charcoal ink, never white on peach
    case 'secondary':
      return { bg: t.select, fg: t.onSelect };
    case 'danger':
      return { bg: t.error, fg: t.dark ? '#202326' : '#FFFFFF' };
    case 'success':
      return { bg: t.success, fg: t.dark ? '#202326' : '#FFFFFF' };
    default:
      return { bg: 'transparent', fg: t.text };
  }
}

export function IconButton({ icon, onPress, a11y, size = 44 }: { icon: IconName; onPress: () => void; a11y: string; size?: number }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={({ pressed }) => ({ width: size, height: size, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: pressed ? t.borderStrong : t.border, backgroundColor: t.surface })}>
      <Icon name={icon} size={20} color={t.text} />
    </Pressable>
  );
}

export function Card({ children, style, onPress, a11y, selected }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; a11y?: string; selected?: boolean }) {
  const t = useTheme();
  // Website .card: raised paper, 1px border, 24 radius, soft shadow.
  const base: ViewStyle = { backgroundColor: t.raised, borderRadius: R.rounded, borderWidth: selected ? 2 : 1, borderColor: selected ? t.select : t.border, padding: space(2.5), ...(t.shadow as ViewStyle) };
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: !!selected }} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.88 }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[base, style]}>{children}</View>;
}

export function Field({ label, value, onChange, placeholder, keyboard, secure, maxLength, hint, autoFocus, error, onSubmit, autoComplete, mono }: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboard?: KeyboardTypeOptions;
  secure?: boolean;
  maxLength?: number;
  hint?: string;
  autoFocus?: boolean;
  error?: string;
  onSubmit?: () => void;
  autoComplete?: any;
  mono?: boolean;
}) {
  const t = useTheme();
  const lang = useLang();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt size={14} weight="600">{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.textDim}
        keyboardType={keyboard}
        secureTextEntry={secure}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        autoComplete={autoComplete}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-invalid={error ? true : undefined}
        style={{
          minHeight: 50,
          borderRadius: R.field,
          backgroundColor: focused ? t.raised : t.inset,
          borderWidth: 1.5,
          borderColor: error ? t.error : focused ? t.borderStrong : t.border,
          paddingHorizontal: space(2),
          fontSize: 17,
          fontFamily: fontFor(mono ? '700' : '400', mono, false, lang),
          color: t.text,
        }}
      />
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="alert" size={16} color={t.error} />
          <Txt size={13} color={t.error} style={{ flex: 1 }}>{error}</Txt>
        </View>
      ) : hint ? (
        <Txt size={13} dim>{hint}</Txt>
      ) : null}
    </View>
  );
}

/** color-mix(in srgb, c x%, transparent) for #RRGGBB colours. */
export function tint(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The website's peach check circle (feature lists, finished steps). */
export function Tick({ on = true, size = 20 }: { on?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.primary : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: t.border }}>
      {on ? <Icon name="tick" size={size * 0.72} color={t.onPrimary} /> : null}
    </View>
  );
}

/** Website .eyebrow: a small pill with a live dot. */
export function Eyebrow({ text, live }: { text: string; live?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? t.success : t.textDim }} />
      <Txt size={13} weight="500">{text}</Txt>
    </View>
  );
}

const TONE_ICON: Record<Tone, IconName> = { success: 'check', warning: 'alert', error: 'close', info: 'info', pending: 'pending' };
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'pending';

/** Status pill — icon + text + colour, never colour alone. Status colours never follow a theme. */
export function Pill({ tone, text }: { tone: Tone; text: string }) {
  const t = useTheme();
  const c = t[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tint(c, t.dark ? 0.2 : 0.14), borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Icon name={TONE_ICON[tone]} size={13} color={c} />
      <Txt size={12} weight="700" color={c}>{text}</Txt>
    </View>
  );
}

export function Note({ tone, text, style }: { tone: Tone; text: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.soft, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }, style]}>
      <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(t[tone], t.dark ? 0.2 : 0.15) }}>
        <Icon name={TONE_ICON[tone]} size={20} color={t[tone]} />
      </View>
      <Txt size={14} style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.inset, borderRadius: R.pill, borderWidth: 1, borderColor: t.border, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 40, paddingHorizontal: 6, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.select : 'transparent' }}
          >
            <Txt size={14} weight={on ? '600' : '400'} color={on ? t.onSelect : t.textDim} numberOfLines={1}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const inner = <View style={[{ padding: space(2), gap: space(2), width: '100%', maxWidth: 1100, alignSelf: 'center' }, style]}>{children}</View>;
  return scroll ? (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: space(12) }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
      {inner}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, backgroundColor: t.bg }}>{inner}</View>
  );
}

/** Glass material — tab bars, sheets and floating panels only (§07). */
export function Glass({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <BlurView intensity={Platform.OS === 'android' ? 0 : 40} tint={t.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'android' ? t.surface : t.glass }]} />
      {children}
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Glass style={{ width: '100%', maxWidth: 560, maxHeight: '92%', borderTopLeftRadius: R.rounded, borderTopRightRadius: R.rounded, borderWidth: 1, borderColor: t.dark ? 'rgba(255,255,255,0.12)' : t.border, paddingBottom: space(3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space(2), borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }}>
            <H2>{title}</H2>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={24} color={t.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2) }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
            {children}
          </ScrollView>
        </Glass>
      </View>
    </Modal>
  );
}

export function Row({ children, style, gap = 12 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Big figures use JetBrains Mono, as on the website's stats and daily close. */
export function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: Tone; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 150, gap: 4, padding: 20, borderRadius: R.rounded, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}>
      <Row gap={6}>
        {icon ? <Icon name={icon} size={18} color={t.textDim} /> : null}
        <Txt size={14} dim weight="600">{label}</Txt>
      </Row>
      <Txt size={26} weight="700" mono color={tone ? t[tone] : undefined} style={{ letterSpacing: -26 * 0.03 }}>{value}</Txt>
      {sub ? <Txt size={13} dim>{sub}</Txt> : null}
    </View>
  );
}

/** Horizontal lockup in the right colour version for the current mode. */
export function Logo({ size = 28, product }: { size?: number; product?: string }) {
  const t = useTheme();
  const variant: LogoVariant = t.dark ? 'charcoal' : 'cream';
  return <Lockup height={size * 1.15} variant={variant} product={product} />;
}

/** Paper material with the torn bottom edge (orders, tokens, receipts). */
export function Paper({ children, style, clip }: { children: ReactNode; style?: StyleProp<ViewStyle>; clip?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'stretch' }}>
      {clip ? <MetalClip /> : null}
      <View style={[{ backgroundColor: t.paper, padding: 14, paddingBottom: 10, gap: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, boxShadow: '0 6px 14px -8px rgba(0,0,0,.45)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowRadius: 8, shadowOpacity: 0.18 } as any, style]}>{children}</View>
      <TornEdge color={t.paper} />
    </View>
  );
}

function TornEdge({ color }: { color: string }) {
  // 10 teeth, 6 px deep — matches the guideline clip-path.
  const d = 'M0 0H100V0L95 6L90 0L85 6L80 0L75 6L70 0L65 6L60 0L55 6L50 0L45 6L40 0L35 6L30 0L25 6L20 0L15 6L10 0L5 6L0 0Z';
  return (
    <Svg width="100%" height={6} viewBox="0 0 100 6" preserveAspectRatio="none">
      <Path d={d} fill={color} />
    </Svg>
  );
}

function MetalClip() {
  return (
    <View style={{ alignItems: 'center', marginBottom: -2, zIndex: 1 }}>
      <Svg width={34} height={9}>
        <Defs>
          <LinearGradient id="clip" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B4B7BC" />
            <Stop offset="1" stopColor="#6A6D72" />
          </LinearGradient>
        </Defs>
        <Rect width={34} height={9} rx={2} fill="url(#clip)" />
      </Svg>
    </View>
  );
}

/** Brushed-metal rail bar — used only for the Flow rail (§07); gradient from the website's .rail-bar. */
export function MetalRail() {
  return (
    <View style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 2, boxShadow: '0 3px 6px rgba(0,0,0,.18)' } as any}>
      <Svg width="100%" height={10} preserveAspectRatio="none" viewBox="0 0 100 10">
        <Defs>
          <LinearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#D9DBDC" />
            <Stop offset="0.55" stopColor="#9FA5A8" />
            <Stop offset="1" stopColor="#7F868A" />
          </LinearGradient>
        </Defs>
        <Rect width={100} height={10} fill="url(#rail)" />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Motion: soft entrances so screens and steps glide in. Honours the "reduce motion" settings.
// ---------------------------------------------------------------------------------------------

export function useReducedMotion() {
  const pref = useApp((s) => s.settings.reduceMotion);
  const [os, setOs] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOs).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOs);
    return () => sub.remove();
  }, []);
  return pref || os;
}

/** Fades and lifts its children in once, when mounted (key it to replay). */
export function FadeIn({ children, delay = 0, style, distance = 10 }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; distance?: number }) {
  const reduce = useReducedMotion();
  const [v] = React.useState(() => new Animated.Value(reduce ? 1 : 0));
  React.useEffect(() => {
    if (reduce) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

const GLOW = 'rgba(255,130,84,';
/** Selectable tile: hover glow on web, peach glow and a soft pop when selected. */
export function Tile({ icon, label, hint, selected, onPress, style }: { icon: IconName; label: string; hint?: string; selected: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [scale] = React.useState(() => new Animated.Value(1));
  const press = () => {
    if (!reduce) {
      scale.setValue(0.96);
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    onPress();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={hint ? `${label}. ${hint}` : label} onPress={press}>
        {(state: any) => {
          const hovered = !!state.hovered;
          const glow = selected
            ? { boxShadow: `0 0 0 4px ${GLOW}.22), 0 12px 28px -10px ${GLOW}.55)`, shadowColor: '#FF8254', shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, shadowOpacity: 0.45, elevation: 6 }
            : hovered
              ? { boxShadow: `0 0 0 3px ${GLOW}.14), 0 10px 24px -12px ${GLOW}.4)` }
              : (t.shadow as object);
          return (
            <View
              style={[
                {
                  minHeight: 118,
                  padding: 16,
                  gap: 10,
                  borderRadius: R.rounded,
                  backgroundColor: selected ? t.raised : t.surface,
                  borderWidth: 2,
                  borderColor: selected ? t.primary : hovered ? tint(t.primary, 0.5) : t.border,
                  justifyContent: 'space-between',
                },
                glow as any,
              ]}
            >
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? t.primary : t.inset }}>
                  <Icon name={icon} size={24} color={selected ? t.onPrimary : t.text} />
                </View>
                {selected ? <Tick on size={22} /> : null}
              </Row>
              <View style={{ gap: 2 }}>
                <Txt weight="700" numberOfLines={2}>{label}</Txt>
                {hint ? <Txt size={12} dim numberOfLines={2}>{hint}</Txt> : null}
              </View>
            </View>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

/** Bottom bar with Back and Next — sits above the content, always reachable with one thumb. */
export function StepBar({ onBack, onNext, nextLabel = 'Next', nextDisabled }: { onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  const t = useTheme();
  return (
    <Glass style={{ borderTopWidth: 1, borderColor: t.border }}>
      <Row style={{ padding: 16, paddingBottom: 24, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        {onBack ? <Button kind="outline" icon="back" label="Back" onPress={onBack} style={{ flex: 1 }} /> : null}
        <Button size="lg" label={nextLabel} disabled={nextDisabled} onPress={onNext} style={{ flex: 2 }} />
      </Row>
    </Glass>
  );
}
