import { useTranslation } from 'react-i18next';
import type { MilestoneStatus, MissionStatus, QuoteStatus, VerificationStatus } from '@wasla/shared';
import type { Tone } from '@/theme';
import { Pill } from './ui';

const missionTone: Record<MissionStatus, Tone> = {
  draft: 'neutral', open: 'info', quoted: 'info', in_progress: 'primary', completed: 'success', disputed: 'danger', cancelled: 'neutral',
};
const milestoneTone: Record<MilestoneStatus, Tone> = {
  pending: 'neutral', funded: 'info', submitted: 'warning', approved: 'success', disputed: 'danger', released: 'success', refunded: 'neutral',
};
const quoteTone: Record<QuoteStatus, Tone> = { pending: 'info', accepted: 'success', rejected: 'neutral', withdrawn: 'neutral' };
const verifTone: Record<VerificationStatus, Tone> = { pending: 'warning', verified: 'success', rejected: 'danger', suspended: 'danger' };

export function MissionStatusPill({ status }: { status: MissionStatus }) {
  const { t } = useTranslation();
  return <Pill tone={missionTone[status]} label={t(`status.mission.${status}`)} />;
}
export function MilestoneStatusPill({ status }: { status: MilestoneStatus }) {
  const { t } = useTranslation();
  return <Pill tone={milestoneTone[status]} label={t(`status.milestone.${status}`)} />;
}
export function QuoteStatusPill({ status }: { status: QuoteStatus }) {
  const { t } = useTranslation();
  return <Pill tone={quoteTone[status]} label={t(`status.quote.${status}`)} />;
}
export function VerificationPill({ status }: { status: VerificationStatus }) {
  const { t } = useTranslation();
  return <Pill tone={verifTone[status]} icon={status === 'verified' ? 'shield-checkmark' : 'time-outline'} label={t(`status.verification.${status}`)} />;
}
