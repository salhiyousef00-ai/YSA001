-- =====================================================================
-- Wasla — schéma initial
-- Montants : entiers en centimes de MAD (suffixe _cents).
-- Schéma `private` : fonctions internes, NON exposé par l'API (PostgREST).
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------- Enums ----------
create type public.user_role as enum ('client', 'provider', 'admin');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.mission_status as enum ('draft','open','quoted','in_progress','completed','disputed','cancelled');
create type public.milestone_status as enum ('pending','funded','submitted','approved','disputed','released','refunded');
create type public.quote_status as enum ('pending','accepted','rejected','withdrawn');
create type public.doc_type as enum ('cin_front','cin_back','selfie','anthropometric','legal_status','diploma','insurance');
create type public.doc_status as enum ('pending','approved','rejected');
create type public.tx_type as enum ('deposit','release','commission','refund');
create type public.media_kind as enum ('photo','video');
create type public.dispute_status as enum ('open','resolved_release','resolved_refund','resolved_resubmit');
create type public.app_locale as enum ('fr','ar','en');

-- ---------- Utilitaires ----------
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- Référentiels ----------
create table public.cities (
  id smallserial primary key,
  slug text not null unique,
  name_fr text not null,
  name_ar text not null,
  name_en text not null
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_fr text not null,
  name_ar text not null,
  name_en text not null,
  description_fr text not null default '',
  description_ar text not null default '',
  description_en text not null default '',
  icon text not null default 'briefcase',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value) values
  ('commission_rate', '0.15'::jsonb),
  ('payment_mode', '"simulated"'::jsonb);

-- ---------- Utilisateurs ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role,                       -- null tant que l'onboarding n'a pas choisi
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  locale public.app_locale not null default 'fr',
  avatar_url text,
  onboarded boolean not null default false,
  is_suspended boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create table public.client_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  residence_country char(2) check (residence_country ~ '^[A-Z]{2}$'),
  origin_city_id smallint references public.cities (id),
  updated_at timestamptz not null default now()
);

create table public.provider_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 2000),
  experience_years smallint not null default 0 check (experience_years between 0 and 70),
  verification_status public.verification_status not null default 'pending',
  rejection_reason text,
  verified_at timestamptz,
  kyc_provider text not null default 'manual',
  kyc_external_id text,
  missions_completed int not null default 0,
  rating_avg numeric(3,2),
  rating_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.provider_services (
  provider_id uuid references public.provider_profiles (user_id) on delete cascade,
  service_id uuid references public.services (id) on delete cascade,
  indicative_price_cents int check (indicative_price_cents is null or indicative_price_cents >= 0),
  price_unit text not null default 'mission' check (price_unit in ('mission','visit','hour','month')),
  primary key (provider_id, service_id)
);

create table public.provider_cities (
  provider_id uuid references public.provider_profiles (user_id) on delete cascade,
  city_id smallint references public.cities (id) on delete cascade,
  primary key (provider_id, city_id)
);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (user_id) on delete cascade,
  doc_type public.doc_type not null,
  storage_path text not null,
  status public.doc_status not null default 'pending',
  note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- le chemin doit être dans le dossier du propriétaire
  constraint doc_path_owner check (split_part(storage_path, '/', 1) = provider_id::text)
);
create index on public.verification_documents (provider_id);
create index on public.verification_documents (status) where status = 'pending';

-- ---------- Demandes & devis ----------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles (id) on delete set null,
  service_id uuid not null references public.services (id),
  city_id smallint not null references public.cities (id),
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '' check (char_length(description) <= 5000),
  budget_cents int check (budget_cents is null or budget_cents >= 0),
  start_date date,
  end_date date,
  status public.mission_status not null default 'open'
    check (status in ('draft','open','quoted','in_progress','completed','cancelled','disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_dates check (end_date is null or start_date is null or end_date >= start_date)
);
create index on public.requests (status, city_id, service_id);
create index on public.requests (client_id);
create trigger requests_touch before update on public.requests
  for each row execute function private.touch_updated_at();

create table public.request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint request_photo_path check (split_part(storage_path, '/', 1) = request_id::text)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  provider_id uuid references public.profiles (id) on delete set null,
  total_cents int not null check (total_cents > 0),
  message text not null default '' check (char_length(message) <= 3000),
  -- [{ "title": text, "amount_cents": int, "due_date": date|null }]
  proposed_milestones jsonb not null check (jsonb_typeof(proposed_milestones) = 'array'),
  status public.quote_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

-- ---------- Missions ----------
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique references public.requests (id) on delete set null,
  quote_id uuid unique references public.quotes (id) on delete set null,
  client_id uuid references public.profiles (id) on delete set null,
  provider_id uuid references public.profiles (id) on delete set null,
  service_id uuid not null references public.services (id),
  title text not null,
  status public.mission_status not null default 'in_progress'
    check (status in ('in_progress','completed','disputed','cancelled')),
  commission_rate numeric(5,4) not null check (commission_rate >= 0 and commission_rate < 1),
  total_cents int not null check (total_cents > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index on public.missions (client_id);
create index on public.missions (provider_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  position smallint not null check (position >= 1),
  title text not null check (char_length(title) between 1 and 140),
  amount_cents int not null check (amount_cents > 0),
  due_date date,
  status public.milestone_status not null default 'pending',
  funded_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  unique (mission_id, position)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index on public.reports (milestone_id);

create table public.report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  storage_path text not null,
  kind public.media_kind not null,
  captured_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m real,
  created_at timestamptz not null default now()
);

-- Historique immuable des mouvements (séquestre simulé)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete restrict,
  milestone_id uuid not null references public.milestones (id) on delete restrict,
  type public.tx_type not null,
  amount_cents int not null check (amount_cents >= 0),
  payment_provider text not null default 'simulated',
  provider_ref text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.transactions (mission_id);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  opened_by uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 3000),
  status public.dispute_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index one_open_dispute_per_milestone on public.disputes (milestone_id) where status = 'open';

-- ---------- Messagerie, avis, notifications ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text check (char_length(body) <= 4000),
  image_path text,
  created_at timestamptz not null default now(),
  constraint message_not_empty check (coalesce(char_length(body), 0) > 0 or image_path is not null),
  constraint message_image_path check (image_path is null or split_part(image_path, '/', 1) = mission_id::text)
);
create index on public.messages (mission_id, created_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions (id) on delete cascade,
  client_id uuid references public.profiles (id) on delete set null,
  provider_id uuid references public.profiles (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios','android','web')),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.admin_audit_log (
  id bigserial primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Création automatique du profil ----------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_locale public.app_locale;
begin
  begin
    v_locale := coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'fr')::public.app_locale;
  exception when invalid_text_representation then v_locale := 'fr';
  end;
  insert into public.profiles (id, phone, locale) values (new.id, new.phone, v_locale)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
