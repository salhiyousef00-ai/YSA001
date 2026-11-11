export const USER_ROLES = ['client', 'provider', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const MISSION_STATUSES = [
  'draft', 'open', 'quoted', 'in_progress', 'completed', 'disputed', 'cancelled',
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MILESTONE_STATUSES = [
  'pending', 'funded', 'submitted', 'approved', 'disputed', 'released', 'refunded',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const QUOTE_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const DOC_TYPES = [
  'cin_front', 'cin_back', 'selfie', 'anthropometric', 'legal_status', 'diploma', 'insurance',
] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const REQUIRED_DOC_TYPES: readonly DocType[] = [
  'cin_front', 'cin_back', 'selfie', 'anthropometric', 'legal_status',
];

export const TX_TYPES = ['deposit', 'release', 'commission', 'refund'] as const;
export type TxType = (typeof TX_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'new_quote', 'new_report', 'milestone_approved', 'new_message',
  'quote_accepted', 'verification_update', 'dispute_update',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const LOCALES = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
