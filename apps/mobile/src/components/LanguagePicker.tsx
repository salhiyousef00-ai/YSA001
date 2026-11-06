import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@wasla/shared';
import { setLocale } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { Chip, Row } from './ui';

const LABELS: Record<Locale, string> = { fr: 'Français', ar: 'العربية', en: 'English' };

export function LanguagePicker({ persistForUser }: { persistForUser?: string }) {
  const { t, i18n } = useTranslation();
  const choose = async (l: Locale) => {
    const restart = await setLocale(l);
    if (persistForUser) await supabase.from('profiles').update({ locale: l }).eq('id', persistForUser);
    if (restart && !__DEV__) Alert.alert(t('profile.restartForRtl'));
  };
  return (
    <Row>
      {LOCALES.map((l) => <Chip key={l} label={LABELS[l]} selected={i18n.language === l} onPress={() => void choose(l)} />)}
    </Row>
  );
}
