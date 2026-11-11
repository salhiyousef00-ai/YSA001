import type {
  DocType, Locale, MilestoneStatus, MissionStatus, QuoteStatus, TxType, UserRole, VerificationStatus,
} from './enums';

/**
 * Types des lignes utilisées par les apps. Pour un typage exhaustif généré depuis la base :
 * `pnpm db:types` (écrit src/database.types.ts depuis Supabase local).
 */
export interface Profile {
  id: string; role: UserRole | null; full_name: string | null; phone: string | null;
  locale: Locale; avatar_url: string | null; onboarded: boolean; is_suspended: boolean;
  deleted_at: string | null; created_at: string;
}
export interface ClientProfile { user_id: string; residence_country: string | null; origin_city_id: number | null }
export interface ProviderProfile {
  user_id: string; bio: string; experience_years: number; verification_status: VerificationStatus;
  rejection_reason: string | null; verified_at: string | null; missions_completed: number;
  rating_avg: number | null; rating_count: number;
}
export interface City { id: number; slug: string; name_fr: string; name_ar: string; name_en: string }
export interface Service {
  id: string; slug: string; name_fr: string; name_ar: string; name_en: string;
  description_fr: string; description_ar: string; description_en: string;
  icon: string; is_active: boolean; sort_order: number;
}
export interface ProviderService { provider_id: string; service_id: string; indicative_price_cents: number | null; price_unit: string }
export interface VerificationDocument {
  id: string; provider_id: string; doc_type: DocType; storage_path: string;
  status: 'pending' | 'approved' | 'rejected'; note: string | null; created_at: string; reviewed_at: string | null;
}
export interface PublicProviderProfile {
  user_id: string; full_name: string | null; avatar_url: string | null; bio: string; experience_years: number;
  missions_completed: number; rating_avg: number | null; rating_count: number;
  badge_identity: boolean; badge_diploma: boolean; badge_insured: boolean;
  city_ids: number[]; services: { service_id: string; indicative_price_cents: number | null; price_unit: string }[];
}
export interface ServiceRequest {
  id: string; client_id: string; service_id: string; city_id: number; title: string; description: string;
  budget_cents: number | null; start_date: string | null; end_date: string | null; status: MissionStatus; created_at: string;
}
export interface ProposedMilestone { title: string; amount_cents: number; due_date?: string | null }
export interface Quote {
  id: string; request_id: string; provider_id: string; total_cents: number; message: string;
  proposed_milestones: ProposedMilestone[]; status: QuoteStatus; created_at: string;
}
export interface Mission {
  id: string; request_id: string | null; quote_id: string | null; client_id: string; provider_id: string;
  service_id: string; title: string; status: MissionStatus; commission_rate: number; total_cents: number;
  created_at: string; completed_at: string | null;
}
export interface Milestone {
  id: string; mission_id: string; position: number; title: string; amount_cents: number; due_date: string | null;
  status: MilestoneStatus; funded_at: string | null; submitted_at: string | null; released_at: string | null;
}
export interface Report { id: string; milestone_id: string; author_id: string; body: string; created_at: string }
export interface ReportMedia {
  id: string; report_id: string; storage_path: string; kind: 'photo' | 'video'; captured_at: string;
  latitude: number; longitude: number; accuracy_m: number | null;
}
export interface Transaction {
  id: string; mission_id: string; milestone_id: string; type: TxType; amount_cents: number;
  provider_ref: string; created_at: string;
}
export interface Dispute {
  id: string; milestone_id: string; mission_id: string; opened_by: string; reason: string;
  status: 'open' | 'resolved_release' | 'resolved_refund' | 'resolved_resubmit';
  resolution_note: string | null; created_at: string; resolved_at: string | null;
}
export interface Message { id: string; mission_id: string; sender_id: string; body: string | null; image_path: string | null; created_at: string }
export interface Review { id: string; mission_id: string; client_id: string; provider_id: string; rating: number; comment: string | null; created_at: string }
export interface AppNotification { id: string; user_id: string; type: string; payload: Record<string, unknown>; read_at: string | null; created_at: string }

/** Champ localisé : name_fr / name_ar / name_en */
export function localized<T extends Record<string, unknown>>(row: T, field: string, locale: Locale): string {
  const v = row[`${field}_${locale}`] ?? row[`${field}_fr`];
  return typeof v === 'string' ? v : '';
}
