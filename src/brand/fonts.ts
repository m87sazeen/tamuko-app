// Typography matched to the tamuko.app website (styles.css --f-* tokens):
//   --f-head  Bricolage Grotesque 800 / 700, tight tracking (-0.035em)
//   --f-serif Instrument Serif italic for highlight words ("Made simple.") — Latin scripts only
//   --f-body  Inter 400 / 500 / 600 · --f-mono JetBrains Mono 500 / 700 (tickets, IDs, kickers)
//   --f-brand Fredoka 700 wordmark (stand-in for Molen Friend, per brand guidelines v1.0)
//   Every non-Latin script gets its Noto font (Vazirmatn for Persian, as on the site), loaded on demand.
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';
/* eslint-disable @typescript-eslint/no-require-imports -- lazy font requires keep unused scripts out of start-up */
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

export const F = {
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  label: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heading: 'BricolageGrotesque_800ExtraBold',
  headingSoft: 'BricolageGrotesque_700Bold',
  serif: 'InstrumentSerif_400Regular_Italic',
  monoLight: 'JetBrainsMono_500Medium',
  mono: 'JetBrainsMono_700Bold',
  monoHeavy: 'JetBrainsMono_800ExtraBold',
  wordmark: 'Fredoka_700Bold',
} as const;

export const CORE_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  InstrumentSerif_400Regular_Italic,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
  Fredoka_700Bold,
};

type ScriptFont = { regular: string; bold: string; load: () => Record<string, any> };

// Lazy requires keep unused scripts out of start-up time.
const SCRIPTS: Record<string, ScriptFont> = {
  arabic: {
    regular: 'NotoSansArabic_400Regular',
    bold: 'NotoSansArabic_700Bold',
    load: () => ({
      NotoSansArabic_400Regular: require('@expo-google-fonts/noto-sans-arabic/400Regular').NotoSansArabic_400Regular,
      NotoSansArabic_700Bold: require('@expo-google-fonts/noto-sans-arabic/700Bold').NotoSansArabic_700Bold,
    }),
  },
  persian: {
    regular: 'Vazirmatn_400Regular',
    bold: 'Vazirmatn_700Bold',
    load: () => ({
      Vazirmatn_400Regular: require('@expo-google-fonts/vazirmatn/400Regular').Vazirmatn_400Regular,
      Vazirmatn_700Bold: require('@expo-google-fonts/vazirmatn/700Bold').Vazirmatn_700Bold,
    }),
  },
  urdu: {
    regular: 'NotoNastaliqUrdu_400Regular',
    bold: 'NotoNastaliqUrdu_700Bold',
    load: () => ({
      NotoNastaliqUrdu_400Regular: require('@expo-google-fonts/noto-nastaliq-urdu/400Regular').NotoNastaliqUrdu_400Regular,
      NotoNastaliqUrdu_700Bold: require('@expo-google-fonts/noto-nastaliq-urdu/700Bold').NotoNastaliqUrdu_700Bold,
    }),
  },
  devanagari: {
    regular: 'NotoSansDevanagari_400Regular',
    bold: 'NotoSansDevanagari_700Bold',
    load: () => ({
      NotoSansDevanagari_400Regular: require('@expo-google-fonts/noto-sans-devanagari/400Regular').NotoSansDevanagari_400Regular,
      NotoSansDevanagari_700Bold: require('@expo-google-fonts/noto-sans-devanagari/700Bold').NotoSansDevanagari_700Bold,
    }),
  },
  bengali: {
    regular: 'NotoSansBengali_400Regular',
    bold: 'NotoSansBengali_700Bold',
    load: () => ({
      NotoSansBengali_400Regular: require('@expo-google-fonts/noto-sans-bengali/400Regular').NotoSansBengali_400Regular,
      NotoSansBengali_700Bold: require('@expo-google-fonts/noto-sans-bengali/700Bold').NotoSansBengali_700Bold,
    }),
  },
  tamil: {
    regular: 'NotoSansTamil_400Regular',
    bold: 'NotoSansTamil_700Bold',
    load: () => ({
      NotoSansTamil_400Regular: require('@expo-google-fonts/noto-sans-tamil/400Regular').NotoSansTamil_400Regular,
      NotoSansTamil_700Bold: require('@expo-google-fonts/noto-sans-tamil/700Bold').NotoSansTamil_700Bold,
    }),
  },
  sinhala: {
    regular: 'NotoSansSinhala_400Regular',
    bold: 'NotoSansSinhala_700Bold',
    load: () => ({
      NotoSansSinhala_400Regular: require('@expo-google-fonts/noto-sans-sinhala/400Regular').NotoSansSinhala_400Regular,
      NotoSansSinhala_700Bold: require('@expo-google-fonts/noto-sans-sinhala/700Bold').NotoSansSinhala_700Bold,
    }),
  },
  thai: {
    regular: 'NotoSansThai_400Regular',
    bold: 'NotoSansThai_700Bold',
    load: () => ({
      NotoSansThai_400Regular: require('@expo-google-fonts/noto-sans-thai/400Regular').NotoSansThai_400Regular,
      NotoSansThai_700Bold: require('@expo-google-fonts/noto-sans-thai/700Bold').NotoSansThai_700Bold,
    }),
  },
  lao: {
    regular: 'NotoSansLao_400Regular',
    bold: 'NotoSansLao_700Bold',
    load: () => ({
      NotoSansLao_400Regular: require('@expo-google-fonts/noto-sans-lao/400Regular').NotoSansLao_400Regular,
      NotoSansLao_700Bold: require('@expo-google-fonts/noto-sans-lao/700Bold').NotoSansLao_700Bold,
    }),
  },
  khmer: {
    regular: 'NotoSansKhmer_400Regular',
    bold: 'NotoSansKhmer_700Bold',
    load: () => ({
      NotoSansKhmer_400Regular: require('@expo-google-fonts/noto-sans-khmer/400Regular').NotoSansKhmer_400Regular,
      NotoSansKhmer_700Bold: require('@expo-google-fonts/noto-sans-khmer/700Bold').NotoSansKhmer_700Bold,
    }),
  },
  myanmar: {
    regular: 'NotoSansMyanmar_400Regular',
    bold: 'NotoSansMyanmar_700Bold',
    load: () => ({
      NotoSansMyanmar_400Regular: require('@expo-google-fonts/noto-sans-myanmar/400Regular').NotoSansMyanmar_400Regular,
      NotoSansMyanmar_700Bold: require('@expo-google-fonts/noto-sans-myanmar/700Bold').NotoSansMyanmar_700Bold,
    }),
  },
};

// Language → script. Latin, Cyrillic and Vietnamese use Inter. Chinese, Japanese and Korean use the
// platform's CJK font (Noto Sans CJK on Android); bundling CJK would add ~20 MB per script.
const LANG_SCRIPT: Record<string, keyof typeof SCRIPTS> = {
  ar: 'arabic', fa: 'persian', ur: 'urdu', hi: 'devanagari', ne: 'devanagari', bn: 'bengali', ta: 'tamil',
  si: 'sinhala', th: 'thai', lo: 'lao', km: 'khmer', my: 'myanmar',
};

const loadedScripts = new Set<string>();

/** Loads the Noto font for the active language; returns true once ready (or if Latin script). */
export function useScriptFont(lang: string): boolean {
  const key = LANG_SCRIPT[lang];
  const [loaded, setLoaded] = useState<string[]>([]);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    Font.loadAsync(SCRIPTS[key].load())
      .catch(() => {}) // fall back to the platform font for this script
      .finally(() => {
        loadedScripts.add(key);
        if (alive) setLoaded((l) => (l.includes(key) ? l : [...l, key]));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return !key || loaded.includes(key);
}

/** True when the language is written in Latin script (serif accents and tight tracking apply). */
export function isLatin(lang: string): boolean {
  return !LANG_SCRIPT[lang] && !['zh', 'zh-Hant', 'ja', 'ko', 'ru'].includes(lang);
}

/** Interface font for a language's script, or null to use the brand Latin fonts. */
export function scriptFont(lang: string, weight: 'regular' | 'bold'): string | null {
  const key = LANG_SCRIPT[lang];
  return key && loadedScripts.has(key) ? SCRIPTS[key][weight] : null;
}
