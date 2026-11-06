import { useTranslation } from 'react-i18next';
import type { PublicProviderProfile } from '@wasla/shared';
import { Pill, Row } from './ui';

export function ProviderBadges({ p }: { p: Pick<PublicProviderProfile, 'badge_identity' | 'badge_diploma' | 'badge_insured' | 'missions_completed'> }) {
  const { t } = useTranslation();
  return (
    <Row>
      {p.badge_identity ? <Pill tone="success" icon="shield-checkmark" label={t('badges.identity')} /> : null}
      {p.badge_diploma ? <Pill tone="info" icon="school" label={t('badges.diploma')} /> : null}
      {p.badge_insured ? <Pill tone="primary" icon="umbrella" label={t('badges.insured')} /> : null}
      <Pill tone="neutral" icon="trophy-outline" label={t('badges.missions', { count: p.missions_completed })} />
    </Row>
  );
}
