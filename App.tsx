import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORE_FONTS, useScriptFont } from './src/brand/fonts';
import { Icon, IconName } from './src/brand/Icon';
import { StackedLockup, Symbol } from './src/brand/Logo';
import { BusinessBadge } from './src/components/BusinessBadge';
import { Button, FadeIn, Glass, Logo, Pill, Row, Txt } from './src/components/ui';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useT } from './src/i18n';
import AuthScreen from './src/screens/Auth';
import Manage from './src/screens/Manage';
import { Tab, useNav } from './src/nav';
import LockScreen from './src/screens/Lock';
import Onboarding from './src/screens/Onboarding';
import Rail from './src/screens/Rail';
import Reports from './src/screens/Reports';
import Sell from './src/screens/Sell';
import Settings from './src/screens/Settings';
import { isOpen, useApp } from './src/store';
import { useTheme } from './src/theme';

const ICONS: Record<Tab, IconName> = { sell: 'bag', rail: 'rail', reports: 'chart', manage: 'grid', settings: 'settings' };
// Brand §08: product names are navigation labels under the wordmark, never separate logos.
const PRODUCT: Partial<Record<Tab, string>> = { sell: 'POS', rail: 'Flow', reports: 'Finance' };

// Keep the native splash until fonts and saved data are ready, then hide it ourselves
// (the development build does not always auto-hide it).
SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const th = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const b = useApp((s) => s.business)!;
  const openTickets = useApp((s) => s.tickets.filter(isOpen).length);
  const tabSel = useNav((s) => s.tab);
  const go = useNav((s) => s.go);
  const tabs: Tab[] = ['sell', ...(b.railEnabled ? (['rail'] as Tab[]) : []), 'reports', 'manage', 'settings'];
  const tab: Tab = tabs.includes(tabSel) ? tabSel : 'sell';
  const setTab = (k: Tab) => go(k, k === 'manage' && tab === 'manage' ? 'home' : undefined);

  const Screen = { sell: Sell, rail: Rail, reports: Reports, manage: Manage, settings: Settings }[tab];

  const label = (k: Tab) => (k === 'manage' ? 'Manage' : t(k));
  const navItem = (k: Tab) => {
    const on = tab === k;
    const color = on ? th.text : th.textDim;
    return (
      <Pressable
        key={k}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label(k)}${k === 'rail' && openTickets ? `, ${openTickets} open` : ''}`}
        onPress={() => setTab(k)}
        style={{
          flex: wide ? undefined : 1,
          minHeight: 56,
          flexDirection: wide ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: wide ? 'flex-start' : 'center',
          gap: wide ? 12 : 2,
          paddingHorizontal: wide ? 14 : 0,
          borderRadius: 999, // website nav links are pills
          backgroundColor: on && wide ? th.raised : 'transparent',
          borderWidth: on && wide ? 1 : 0,
          borderColor: th.border,
        }}
      >
        <View>
          <Icon name={ICONS[k]} size={24} color={color} />
          {k === 'rail' && openTickets > 0 && !wide && (
            <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: th.select, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Txt size={11} weight="700" mono color={th.onSelect}>{openTickets}</Txt>
            </View>
          )}
        </View>
        <Txt size={wide ? 16 : 11} weight={on ? '600' : '400'} color={color}>{label(k)}</Txt>
        {k === 'rail' && openTickets > 0 && wide && (
          <View style={{ marginLeft: 'auto', minWidth: 24, height: 24, borderRadius: 12, backgroundColor: th.select, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <Txt size={12} weight="700" mono color={th.onSelect}>{openTickets}</Txt>
          </View>
        )}
        {on && !wide && <View style={{ position: 'absolute', bottom: 4, width: 18, height: 3, borderRadius: 99, backgroundColor: th.primary }} />}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: th.bg }}>
      {wide && (
        <View style={{ width: 232, padding: 16, paddingTop: 20, gap: 6, borderRightWidth: 1, borderColor: th.border, backgroundColor: th.surface }}>
          <View style={{ paddingHorizontal: 6, paddingBottom: 18, gap: 6 }}>
            {b.brandSet ? (
              <Row gap={10}>
                <BusinessBadge name={b.name} logo={b.logo} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt size={16} weight="800" heading numberOfLines={2}>{b.name}</Txt>
                  {PRODUCT[tab] ? <Txt size={12} dim>{PRODUCT[tab]}</Txt> : null}
                </View>
              </Row>
            ) : (
              <>
                <Logo size={30} product={PRODUCT[tab]} />
                <Txt size={13} dim numberOfLines={1}>{b.name}</Txt>
              </>
            )}
          </View>
          {tabs.map(navItem)}
          <View style={{ flex: 1 }} />
          {b.brandSet ? (
            <Row gap={8}>
              <Symbol size={18} variant={th.dark ? 'charcoal' : 'cream'} label="tamuko" />
              <Txt size={12} dim>powered by tamuko</Txt>
            </Row>
          ) : (
            <Pill tone="info" text="On this device only" />
          )}
        </View>
      )}
      <View style={{ flex: 1 }}>
        {!wide && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: th.border }}>
            {b.brandSet ? (
              <>
                <Row gap={10} style={{ flex: 1 }}>
                  <BusinessBadge name={b.name} logo={b.logo} size={32} />
                  <Txt size={17} weight="800" heading numberOfLines={1} style={{ flex: 1 }}>{b.name}</Txt>
                </Row>
                <Symbol size={24} variant={th.dark ? 'charcoal' : 'cream'} label="tamuko" />
              </>
            ) : (
              <>
                <Logo size={22} product={PRODUCT[tab]} />
                <Txt size={13} dim numberOfLines={1} style={{ maxWidth: '45%' }}>{b.name}</Txt>
              </>
            )}
          </View>
        )}
        <FadeIn key={tab} style={{ flex: 1 }} distance={6}>
          <Screen />
        </FadeIn>
      </View>
      {!wide && (
        <Glass style={{ borderTopWidth: 1, borderColor: th.border }}>
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', paddingTop: 4, paddingBottom: Math.max(4, insets.bottom) }}>
            {tabs.map(navItem)}
          </View>
        </Glass>
      )}
    </View>
  );
}

function Splash() {
  const th = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: th.bg }}>
      <StackedLockup height={72} variant={th.dark ? 'charcoal' : 'cream'} />
    </View>
  );
}

function Root() {
  const th = useTheme();
  const { rtl, lang } = useT();
  const [coreFonts] = useFonts(CORE_FONTS);
  const scriptReady = useScriptFont(lang.code);
  const hydrated = useApp((s) => s.hydrated);
  const userId = useApp((s) => s.currentUserId);
  const pin = useApp((s) => s.pin);
  const business = useApp((s) => s.business);
  const autoLockMin = useApp((s) => s.settings.autoLockMin);
  const [locked, setLocked] = useState(true);
  const prevUser = useRef<string | null | undefined>(undefined);
  const bgAt = useRef<number | null>(null);

  // A fresh sign-in (null → user) unlocks; launching with an existing session starts locked if a PIN is set.
  useEffect(() => {
    if (!hydrated) return;
    if (prevUser.current === null && userId) setLocked(false);
    prevUser.current = userId;
  }, [hydrated, userId]);

  // Auto-lock after time in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') bgAt.current = Date.now();
      else if (st === 'active' && bgAt.current && Date.now() - bgAt.current > autoLockMin * 60_000) setLocked(true);
    });
    return () => sub.remove();
  }, [autoLockMin]);

  const ready = hydrated && coreFonts;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Right-to-left for Arabic, Persian, Urdu.
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang.code;
    }
  }, [rtl, lang.code]);

  let body: React.ReactNode;
  if (!hydrated || !coreFonts) body = <View style={{ flex: 1, backgroundColor: th.bg }} />;
  else if (!scriptReady) body = <Splash />;
  else if (!userId) body = <AuthScreen />;
  else if (pin && locked) body = <LockScreen onUnlock={() => setLocked(false)} />;
  else if (!business) body = <Onboarding />;
  else
    body = (
      <ErrorBoundary
        fallback={(retry, backup) => (
          <View style={{ gap: 16, alignItems: 'center' }}>
            <StackedLockup height={56} variant={th.dark ? 'charcoal' : 'cream'} />
            <Txt size={22} weight="800" heading center>Something went wrong on this screen.</Txt>
            <Txt dim center>Your sales and settings are safe on this device. Try again — if it keeps happening, export a backup and email hello@tamuko.app.</Txt>
            <Button label="Try again" icon="refresh" onPress={retry} />
            <Button kind="outline" label="Export backup" icon="download" onPress={() => { backup().catch(() => {}); }} />
          </View>
        )}
      >
        <Shell key={lang.code} />
      </ErrorBoundary>
    );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: th.bg, direction: rtl ? 'rtl' : 'ltr' }}>
      <StatusBar style={th.dark ? 'light' : 'dark'} />
      {body}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
