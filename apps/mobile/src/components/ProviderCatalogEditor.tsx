import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Body, Card, Chip, Field, H2, Row } from './ui';
import { useLocalized, useRefData } from '@/providers/RefDataProvider';
import { space } from '@/theme';

export type PriceUnit = 'mission' | 'visit' | 'hour' | 'month';
export interface CatalogState {
  services: Record<string, { price: string; unit: PriceUnit }>;
  cities: number[];
}
const UNITS: PriceUnit[] = ['mission', 'visit', 'hour', 'month'];

/** Sélection des services (avec tarif indicatif) et des villes couvertes. */
export function ProviderCatalogEditor({ value, onChange, section }: {
  value: CatalogState; onChange: (v: CatalogState) => void; section: 'services' | 'cities' | 'both';
}) {
  const { t } = useTranslation();
  const { services, cities } = useRefData();
  const loc = useLocalized();

  const toggleService = (id: string) => {
    const next = { ...value.services };
    if (next[id]) delete next[id]; else next[id] = { price: '', unit: 'mission' };
    onChange({ ...value, services: next });
  };
  const toggleCity = (id: number) =>
    onChange({ ...value, cities: value.cities.includes(id) ? value.cities.filter((c) => c !== id) : [...value.cities, id] });

  return (
    <View style={{ gap: space.lg }}>
      {section !== 'cities' ? (
        <>
          <H2>{t('onboarding.servicesOffered')}</H2>
          {services.map((s) => {
            const sel = value.services[s.id];
            return (
              <Card key={s.id}>
                <Chip label={loc(s, 'name')} selected={!!sel} onPress={() => toggleService(s.id)} />
                <Body muted small>{loc(s, 'description')}</Body>
                {sel ? (
                  <>
                    <Field label={t('onboarding.indicativePrice')} value={sel.price} keyboardType="decimal-pad"
                      onChangeText={(v) => onChange({ ...value, services: { ...value.services, [s.id]: { ...sel, price: v.replace(/[^\d.,]/g, '') } } })} />
                    <Row>{UNITS.map((u) => (
                      <Chip key={u} label={t(`onboarding.priceUnit.${u}`)} selected={sel.unit === u}
                        onPress={() => onChange({ ...value, services: { ...value.services, [s.id]: { ...sel, unit: u } } })} />
                    ))}</Row>
                  </>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}
      {section !== 'services' ? (
        <>
          <H2>{t('onboarding.citiesCovered')}</H2>
          <Row>{cities.map((c) => <Chip key={c.id} label={loc(c, 'name')} selected={value.cities.includes(c.id)} onPress={() => toggleCity(c.id)} />)}</Row>
        </>
      ) : null}
    </View>
  );
}
