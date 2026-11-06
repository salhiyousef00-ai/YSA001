import type { Locale } from '@wasla/shared';

/** Principaux pays de résidence des MRE. */
export const COUNTRIES: { code: string; fr: string; ar: string; en: string }[] = [
  { code: 'FR', fr: 'France', ar: 'فرنسا', en: 'France' },
  { code: 'ES', fr: 'Espagne', ar: 'إسبانيا', en: 'Spain' },
  { code: 'IT', fr: 'Italie', ar: 'إيطاليا', en: 'Italy' },
  { code: 'BE', fr: 'Belgique', ar: 'بلجيكا', en: 'Belgium' },
  { code: 'NL', fr: 'Pays-Bas', ar: 'هولندا', en: 'Netherlands' },
  { code: 'DE', fr: 'Allemagne', ar: 'ألمانيا', en: 'Germany' },
  { code: 'GB', fr: 'Royaume-Uni', ar: 'المملكة المتحدة', en: 'United Kingdom' },
  { code: 'CH', fr: 'Suisse', ar: 'سويسرا', en: 'Switzerland' },
  { code: 'CA', fr: 'Canada', ar: 'كندا', en: 'Canada' },
  { code: 'US', fr: 'États-Unis', ar: 'الولايات المتحدة', en: 'United States' },
  { code: 'AE', fr: 'Émirats arabes unis', ar: 'الإمارات', en: 'United Arab Emirates' },
  { code: 'SA', fr: 'Arabie saoudite', ar: 'السعودية', en: 'Saudi Arabia' },
  { code: 'QA', fr: 'Qatar', ar: 'قطر', en: 'Qatar' },
];

export const countryName = (code: string | null | undefined, l: Locale) =>
  COUNTRIES.find((c) => c.code === code)?.[l] ?? code ?? '—';
