import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localized, type City, type Locale, type Service } from '@wasla/shared';
import { supabase } from '@/lib/supabase';

interface RefData {
  services: Service[];
  cities: City[];
  serviceName: (id: string) => string;
  cityName: (id: number | null | undefined) => string;
  reload: () => Promise<void>;
}
const Ctx = createContext<RefData | null>(null);

/** Catalogue (services, villes) chargé depuis la base : rien n'est codé en dur. */
export function RefDataProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const locale = i18n.language as Locale;

  const reload = async () => {
    const [s, c] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('cities').select('*').order('name_fr'),
    ]);
    setServices((s.data as Service[]) ?? []);
    setCities((c.data as City[]) ?? []);
  };
  useEffect(() => { void reload(); }, []);

  const value = useMemo<RefData>(() => ({
    services, cities, reload,
    serviceName: (id) => { const s = services.find((x) => x.id === id); return s ? localized(s as never, 'name', locale) : '—'; },
    cityName: (id) => { const c = cities.find((x) => x.id === id); return c ? localized(c as never, 'name', locale) : '—'; },
  }), [services, cities, locale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRefData(): RefData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRefData must be used within RefDataProvider');
  return v;
}

export function useLocalized() {
  const { i18n } = useTranslation();
  const locale = i18n.language as Locale;
  return <T extends object>(row: T, field: string) => localized(row as Record<string, unknown>, field, locale);
}
