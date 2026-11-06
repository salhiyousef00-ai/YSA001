import { currentLocale } from '@/i18n';

const intlLocale = () => (currentLocale() === 'ar' ? 'ar-MA' : currentLocale() === 'en' ? 'en-GB' : 'fr-FR');
export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' });
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
