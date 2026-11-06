import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, I18nManager } from 'react-native';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@wasla/shared';
import fr from './fr';
import en from './en';
import ar from './ar';

const STORAGE_KEY = 'wasla.locale';

export const isRtlLocale = (l: Locale) => l === 'ar';

function deviceLocale(): Locale {
  const code = Localization.getLocales()[0]?.languageCode;
  return (LOCALES as readonly string[]).includes(code ?? '') ? (code as Locale) : DEFAULT_LOCALE;
}

export async function initI18n(): Promise<void> {
  let stored: string | null = null;
  try { stored = await AsyncStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  const lng = (LOCALES as readonly string[]).includes(stored ?? '') ? (stored as Locale) : DEFAULT_LOCALE;
  await i18n.use(initReactI18next).init({
    resources: { fr: { translation: fr }, en: { translation: en }, ar: { translation: ar } },
    lng, fallbackLng: DEFAULT_LOCALE, interpolation: { escapeValue: false }, returnNull: false,
  });
  applyDirection(lng);
}

function applyDirection(l: Locale): boolean {
  const rtl = isRtlLocale(l);
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true; // un redémarrage est nécessaire pour retourner la mise en page
  }
  return false;
}

/** Change la langue ; retourne true si l'app doit redémarrer (bascule LTR ⇄ RTL). */
export async function setLocale(l: Locale): Promise<boolean> {
  await i18n.changeLanguage(l);
  try { await AsyncStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  const needsRestart = applyDirection(l);
  if (needsRestart && __DEV__) DevSettings.reload();
  return needsRestart;
}

export const currentLocale = (): Locale => (i18n.language as Locale) ?? DEFAULT_LOCALE;
export { deviceLocale };
export default i18n;
