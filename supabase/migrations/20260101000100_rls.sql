-- =====================================================================
-- Fonctions d'aide RLS + politiques. RLS activée sur TOUTES les tables.
-- Principe : lectures par RLS, écritures sensibles uniquement via RPC
-- (security definer) ; privilèges de colonnes pour les mises à jour simples.
-- =====================================================================

-- ---------- Helpers (security definer pour éviter la récursion RLS) ----------
create or replace function private.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and not is_suspended and deleted_at is null)
$$;

create or replace function private.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and not is_suspended and deleted_at is null)
$$;

create or replace function private.is_verified_provider(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.provider_profiles pp join public.profiles p on p.id = pp.user_id
    where pp.user_id = p_uid and pp.verification_status = 'verified'
      and p.role = 'provider' and not p.is_suspended and p.deleted_at is null)
$$;

create or replace function private.is_mission_participant(p_mission uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.missions m
                 where m.id = p_mission and auth.uid() in (m.client_id, m.provider_id))
$$;

-- Un prestataire vérifié peut voir une demande ouverte de sa zone et de ses services
create or replace function private.provider_can_see_request(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_verified_provider() and exists (
    select 1 from public.requests r
    join public.provider_cities pc on pc.city_id = r.city_id and pc.provider_id = auth.uid()
    join public.provider_services ps on ps.service_id = r.service_id and ps.provider_id = auth.uid()
    where r.id = p_request and r.status in ('open', 'quoted'))
$$;

create or replace function private.is_request_owner(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.requests where id = p_request and client_id = auth.uid())
$$;

create or replace function private.has_quoted(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quotes where request_id = p_request and provider_id = auth.uid())
$$;

-- (droits EXECUTE accordés dans la migration rpc)

-- ---------- Privilèges de base : on retire tout puis on accorde le minimum ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.cities, public.services, public.platform_settings to anon, authenticated;
grant select on all tables in schema public to authenticated;  -- toujours filtré par RLS

-- écritures directes autorisées (toujours filtrées par RLS)
grant update (full_name, phone, locale, avatar_url) on public.profiles to authenticated;
grant insert, update (residence_country, origin_city_id) on public.client_profiles to authenticated;
grant update (bio, experience_years) on public.provider_profiles to authenticated;
grant insert, update, delete on public.provider_services, public.provider_cities to authenticated;
grant insert, delete on public.verification_documents to authenticated;
grant insert on public.requests to authenticated;
grant update (title, description, budget_cents, start_date, end_date) on public.requests to authenticated;
grant insert, delete on public.request_photos to authenticated;
grant insert on public.messages to authenticated;
grant insert on public.reviews to authenticated;
grant insert, delete on public.push_tokens to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert, update, delete on public.services, public.cities to authenticated;  -- admin seulement (RLS)

-- ---------- Activer RLS partout ----------
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------- Référentiels ----------
create policy cities_read on public.cities for select using (true);
create policy cities_admin on public.cities for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy services_read on public.services for select using (is_active or private.is_admin());
create policy services_admin_ins on public.services for insert to authenticated with check (private.is_admin());
create policy services_admin_upd on public.services for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy services_admin_del on public.services for delete to authenticated using (private.is_admin());

create policy settings_read on public.platform_settings for select using (true);

-- ---------- Profils ----------
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_admin());
-- l'autre participant d'une mission voit le nom/avatar (le téléphone reste visible : besoin opérationnel)
create policy profiles_counterpart_read on public.profiles for select to authenticated
  using (exists (select 1 from public.missions m
                 where auth.uid() in (m.client_id, m.provider_id) and profiles.id in (m.client_id, m.provider_id)));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() and private.is_active_user()) with check (id = auth.uid());

create policy client_profiles_self on public.client_profiles for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
create policy client_profiles_ins on public.client_profiles for insert to authenticated
  with check (user_id = auth.uid() and private.my_role() = 'client');
create policy client_profiles_upd on public.client_profiles for update to authenticated
  using (user_id = auth.uid() and private.is_active_user()) with check (user_id = auth.uid());

create policy provider_profiles_read on public.provider_profiles for select to authenticated
  using (user_id = auth.uid() or private.is_admin()
         or exists (select 1 from public.missions m where m.provider_id = provider_profiles.user_id and m.client_id = auth.uid()));
create policy provider_profiles_upd on public.provider_profiles for update to authenticated
  using (user_id = auth.uid() and private.is_active_user()) with check (user_id = auth.uid());

create policy provider_services_read on public.provider_services for select to authenticated using (true);
create policy provider_services_write on public.provider_services for all to authenticated
  using (provider_id = auth.uid() and private.is_active_user())
  with check (provider_id = auth.uid() and private.is_active_user());
create policy provider_cities_read on public.provider_cities for select to authenticated using (true);
create policy provider_cities_write on public.provider_cities for all to authenticated
  using (provider_id = auth.uid() and private.is_active_user())
  with check (provider_id = auth.uid() and private.is_active_user());

-- ---------- Vérification : propriétaire + admins uniquement ----------
create policy vdocs_read on public.verification_documents for select to authenticated
  using (provider_id = auth.uid() or private.is_admin());
create policy vdocs_insert on public.verification_documents for insert to authenticated
  with check (provider_id = auth.uid() and private.my_role() = 'provider' and private.is_active_user()
              and status = 'pending' and reviewed_by is null);
create policy vdocs_delete on public.verification_documents for delete to authenticated
  using (provider_id = auth.uid() and status = 'pending');

-- ---------- Demandes ----------
create policy requests_read on public.requests for select to authenticated
  using (client_id = auth.uid() or private.is_admin()
         or private.provider_can_see_request(id) or private.has_quoted(id));
create policy requests_insert on public.requests for insert to authenticated
  with check (client_id = auth.uid() and private.my_role() = 'client' and private.is_active_user()
              and status in ('draft', 'open'));
create policy requests_update on public.requests for update to authenticated
  using (client_id = auth.uid() and status in ('draft', 'open') and private.is_active_user())
  with check (client_id = auth.uid());

create policy request_photos_read on public.request_photos for select to authenticated
  using (private.is_request_owner(request_id) or private.is_admin()
         or private.provider_can_see_request(request_id) or private.has_quoted(request_id));
create policy request_photos_write on public.request_photos for insert to authenticated
  with check (private.is_request_owner(request_id));
create policy request_photos_del on public.request_photos for delete to authenticated
  using (private.is_request_owner(request_id));

-- ---------- Devis (écriture via RPC submit_quote / accept_quote) ----------
create policy quotes_read on public.quotes for select to authenticated
  using (provider_id = auth.uid() or private.is_request_owner(request_id) or private.is_admin());

-- ---------- Missions & co (lecture seule, écritures via RPC) ----------
create policy missions_read on public.missions for select to authenticated
  using (auth.uid() in (client_id, provider_id) or private.is_admin());
create policy milestones_read on public.milestones for select to authenticated
  using (private.is_mission_participant(mission_id) or private.is_admin());
create policy reports_read on public.reports for select to authenticated
  using (private.is_admin() or exists (select 1 from public.milestones ms
         where ms.id = reports.milestone_id and private.is_mission_participant(ms.mission_id)));
create policy report_media_read on public.report_media for select to authenticated
  using (private.is_admin() or exists (select 1 from public.reports r join public.milestones ms on ms.id = r.milestone_id
         where r.id = report_media.report_id and private.is_mission_participant(ms.mission_id)));
create policy transactions_read on public.transactions for select to authenticated
  using (private.is_mission_participant(mission_id) or private.is_admin());
create policy disputes_read on public.disputes for select to authenticated
  using (private.is_mission_participant(mission_id) or private.is_admin());

-- ---------- Messagerie ----------
create policy messages_read on public.messages for select to authenticated
  using (private.is_mission_participant(mission_id) or private.is_admin());
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and private.is_mission_participant(mission_id) and private.is_active_user());

-- ---------- Avis : uniquement après mission terminée, par le client ----------
create policy reviews_read on public.reviews for select using (true);
grant select on public.reviews to anon;
create policy reviews_insert on public.reviews for insert to authenticated
  with check (client_id = auth.uid() and private.is_active_user() and exists (
    select 1 from public.missions m where m.id = reviews.mission_id and m.client_id = auth.uid()
      and m.provider_id = reviews.provider_id and m.status = 'completed'));

-- ---------- Push & notifications ----------
create policy push_tokens_self on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_self_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_self_upd on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Audit admin ----------
create policy audit_admin_read on public.admin_audit_log for select to authenticated using (private.is_admin());

-- ---------- Profil public prestataire (colonnes minimales, vérifiés uniquement) ----------
create or replace view public.public_provider_profiles with (security_barrier = true) as
select
  p.id as user_id, p.full_name, p.avatar_url,
  pp.bio, pp.experience_years, pp.missions_completed, pp.rating_avg, pp.rating_count,
  (select count(distinct d.doc_type) = 3 from public.verification_documents d
     where d.provider_id = p.id and d.status = 'approved' and d.doc_type in ('cin_front','cin_back','selfie')) as badge_identity,
  exists (select 1 from public.verification_documents d
     where d.provider_id = p.id and d.status = 'approved' and d.doc_type = 'diploma') as badge_diploma,
  exists (select 1 from public.verification_documents d
     where d.provider_id = p.id and d.status = 'approved' and d.doc_type = 'insurance') as badge_insured,
  coalesce((select array_agg(pc.city_id) from public.provider_cities pc where pc.provider_id = p.id), '{}') as city_ids,
  coalesce((select jsonb_agg(jsonb_build_object('service_id', ps.service_id,
              'indicative_price_cents', ps.indicative_price_cents, 'price_unit', ps.price_unit))
            from public.provider_services ps where ps.provider_id = p.id), '[]'::jsonb) as services
from public.profiles p
join public.provider_profiles pp on pp.user_id = p.id
where p.role = 'provider' and pp.verification_status = 'verified'
  and not p.is_suspended and p.deleted_at is null;

revoke all on public.public_provider_profiles from anon, authenticated;
grant select on public.public_provider_profiles to anon, authenticated;
