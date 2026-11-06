-- =====================================================================
-- Logique métier : machine d'états, séquestre simulé, administration.
-- Toutes les écritures sensibles passent par ces fonctions.
-- Miroir TypeScript : packages/shared/src/stateMachine.ts
-- =====================================================================

-- ---------- Machine d'états ----------
create or replace function private.assert_mission_transition(p_from public.mission_status, p_to public.mission_status)
returns void language plpgsql immutable as $$
begin
  if not (
    (p_from = 'draft'       and p_to in ('open','cancelled')) or
    (p_from = 'open'        and p_to in ('quoted','cancelled')) or
    (p_from = 'quoted'      and p_to in ('in_progress','cancelled')) or
    (p_from = 'in_progress' and p_to in ('completed','disputed','cancelled')) or
    (p_from = 'disputed'    and p_to in ('in_progress','completed','cancelled'))
  ) then
    raise exception 'invalid_mission_transition: % -> %', p_from, p_to using errcode = 'P0001';
  end if;
end $$;

create or replace function private.assert_milestone_transition(p_from public.milestone_status, p_to public.milestone_status)
returns void language plpgsql immutable as $$
begin
  if not (
    (p_from = 'pending'   and p_to = 'funded') or
    (p_from = 'funded'    and p_to in ('submitted','refunded')) or
    (p_from = 'submitted' and p_to in ('approved','disputed','submitted')) or
    (p_from = 'approved'  and p_to = 'released') or
    (p_from = 'disputed'  and p_to in ('released','refunded','funded'))
  ) then
    raise exception 'invalid_milestone_transition: % -> %', p_from, p_to using errcode = 'P0001';
  end if;
end $$;

-- ---------- Utilitaires internes ----------
create or replace function private.require_active() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.is_active_user() then raise exception 'account_inactive' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function private.commission_rate() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.platform_settings where key = 'commission_rate'), 0.15)
$$;

create or replace function private.notify(p_user uuid, p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is not null then
    insert into public.notifications (user_id, type, payload) values (p_user, p_type, p_payload);
  end if;
end $$;

create or replace function private.audit(p_action text, p_type text, p_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_type, p_id, p_details);
$$;

-- Référence de paiement simulée (adapter PaymentProvider côté SQL)
create or replace function private.payment_ref(p_kind text) returns text
language sql volatile as $$ select 'sim_' || p_kind || '_' || replace(gen_random_uuid()::text, '-', '') $$;

create or replace function private.set_mission_status(p_mission uuid, p_to public.mission_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_from public.mission_status; v_req uuid;
begin
  select status, request_id into v_from, v_req from public.missions where id = p_mission for update;
  if v_from = p_to then return; end if;
  perform private.assert_mission_transition(v_from, p_to);
  update public.missions set status = p_to,
    completed_at = case when p_to = 'completed' then now() else completed_at end,
    cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end
  where id = p_mission;
  if v_req is not null then
    update public.requests set status = p_to where id = v_req;
  end if;
end $$;

create or replace function private.set_milestone_status(p_milestone uuid, p_to public.milestone_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_from public.milestone_status;
begin
  select status into v_from from public.milestones where id = p_milestone;
  perform private.assert_milestone_transition(v_from, p_to);
  update public.milestones set status = p_to,
    funded_at    = case when p_to = 'funded'    then now() else funded_at end,
    submitted_at = case when p_to = 'submitted' then now() else submitted_at end,
    approved_at  = case when p_to = 'approved'  then now() else approved_at end,
    released_at  = case when p_to = 'released'  then now() else released_at end,
    refunded_at  = case when p_to = 'refunded'  then now() else refunded_at end
  where id = p_milestone;
end $$;

-- Libération : versement net au prestataire + commission plateforme (somme = montant de l'étape)
create or replace function private.release_milestone(p_milestone uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ms record; v_commission int;
begin
  select m.*, mi.commission_rate, mi.provider_id into ms
  from public.milestones m join public.missions mi on mi.id = m.mission_id where m.id = p_milestone;
  perform private.set_milestone_status(p_milestone, 'released');
  v_commission := round(ms.amount_cents * ms.commission_rate)::int;
  insert into public.transactions (mission_id, milestone_id, type, amount_cents, provider_ref, actor_id) values
    (ms.mission_id, p_milestone, 'release', ms.amount_cents - v_commission, private.payment_ref('rel'), p_actor),
    (ms.mission_id, p_milestone, 'commission', v_commission, private.payment_ref('com'), p_actor);
  perform private.notify(ms.provider_id, 'milestone_approved',
    jsonb_build_object('mission_id', ms.mission_id, 'milestone_id', p_milestone, 'amount_cents', ms.amount_cents - v_commission));
end $$;

create or replace function private.refund_milestone(p_milestone uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ms record;
begin
  select * into ms from public.milestones where id = p_milestone;
  perform private.set_milestone_status(p_milestone, 'refunded');
  insert into public.transactions (mission_id, milestone_id, type, amount_cents, provider_ref, actor_id)
  values (ms.mission_id, p_milestone, 'refund', ms.amount_cents, private.payment_ref('ref'), p_actor);
end $$;

-- Termine la mission si toutes les étapes sont terminales et au moins une libérée
create or replace function private.maybe_complete_mission(p_mission uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_open int; v_released int; v_status public.mission_status; v_provider uuid; v_disputes int;
begin
  select count(*) filter (where status not in ('released','refunded')),
         count(*) filter (where status = 'released')
    into v_open, v_released from public.milestones where mission_id = p_mission;
  select status, provider_id into v_status, v_provider from public.missions where id = p_mission;
  select count(*) into v_disputes from public.disputes where mission_id = p_mission and status = 'open';
  if v_open = 0 and v_released > 0 then
    perform private.set_mission_status(p_mission, 'completed');
    update public.provider_profiles set missions_completed = missions_completed + 1 where user_id = v_provider;
    return true;
  elsif v_status = 'disputed' and v_disputes = 0 then
    perform private.set_mission_status(p_mission, 'in_progress');
  end if;
  return false;
end $$;

-- =====================================================================
-- RPC publiques (exposées : schéma public)
-- =====================================================================

-- Choix du rôle à l'onboarding (une seule fois, jamais admin)
create or replace function public.set_my_role(p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); v_cur public.user_role;
begin
  if p_role not in ('client', 'provider') then raise exception 'role_not_allowed' using errcode = '42501'; end if;
  select role into v_cur from public.profiles where id = v_uid;
  if v_cur is not null and v_cur <> p_role then raise exception 'role_already_set' using errcode = '42501'; end if;
  update public.profiles set role = p_role where id = v_uid;
  if p_role = 'client' then
    insert into public.client_profiles (user_id) values (v_uid) on conflict do nothing;
  else
    insert into public.provider_profiles (user_id) values (v_uid) on conflict do nothing;
  end if;
end $$;

create or replace function public.complete_onboarding()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); v_role public.user_role;
begin
  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then raise exception 'role_required'; end if;
  if v_role = 'provider' and (
       not exists (select 1 from public.provider_services where provider_id = v_uid)
    or not exists (select 1 from public.provider_cities where provider_id = v_uid)) then
    raise exception 'provider_profile_incomplete';
  end if;
  update public.profiles set onboarded = true where id = v_uid;
end $$;

-- Le prestataire signale que son dossier est complet (relance la vérification après un rejet)
create or replace function public.submit_verification()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); v_missing int;
begin
  select count(*) into v_missing from unnest(array['cin_front','cin_back','selfie','anthropometric','legal_status']::public.doc_type[]) t
  where not exists (select 1 from public.verification_documents d where d.provider_id = v_uid and d.doc_type = t and d.status <> 'rejected');
  if v_missing > 0 then raise exception 'missing_documents'; end if;
  update public.provider_profiles set verification_status = 'pending', rejection_reason = null
  where user_id = v_uid and verification_status in ('pending','rejected');
end $$;

create or replace function public.publish_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); r record;
begin
  select * into r from public.requests where id = p_request for update;
  if r.client_id is distinct from v_uid then raise exception 'not_owner' using errcode = '42501'; end if;
  perform private.assert_mission_transition(r.status, 'open');
  update public.requests set status = 'open' where id = p_request;
end $$;

create or replace function public.cancel_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); r record;
begin
  select * into r from public.requests where id = p_request for update;
  if r.client_id is distinct from v_uid then raise exception 'not_owner' using errcode = '42501'; end if;
  perform private.assert_mission_transition(r.status, 'cancelled');
  update public.requests set status = 'cancelled' where id = p_request;
  update public.quotes set status = 'rejected' where request_id = p_request and status = 'pending';
end $$;

-- Devis : p_milestones = [{ "title": "...", "amount_cents": 100000, "due_date": "2026-12-01" }]
create or replace function public.submit_quote(p_request uuid, p_message text, p_milestones jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); r record; v_total bigint := 0; v_id uuid; m jsonb; v_n int;
begin
  if not private.is_verified_provider(v_uid) then raise exception 'provider_not_verified' using errcode = '42501'; end if;
  if not private.provider_can_see_request(p_request) then raise exception 'request_not_available' using errcode = '42501'; end if;
  select * into r from public.requests where id = p_request for update;
  if jsonb_typeof(p_milestones) <> 'array' then raise exception 'invalid_milestones'; end if;
  v_n := jsonb_array_length(p_milestones);
  if v_n < 1 or v_n > 20 then raise exception 'invalid_milestones'; end if;
  for m in select * from jsonb_array_elements(p_milestones) loop
    if coalesce(char_length(m ->> 'title'), 0) = 0 or jsonb_typeof(m -> 'amount_cents') <> 'number'
       or (m ->> 'amount_cents')::numeric <= 0 or (m ->> 'amount_cents')::numeric <> trunc((m ->> 'amount_cents')::numeric) then
      raise exception 'invalid_milestones';
    end if;
    v_total := v_total + (m ->> 'amount_cents')::bigint;
  end loop;
  insert into public.quotes (request_id, provider_id, total_cents, message, proposed_milestones)
  values (p_request, v_uid, v_total, coalesce(p_message, ''), p_milestones)
  on conflict (request_id, provider_id) do update
    set total_cents = excluded.total_cents, message = excluded.message,
        proposed_milestones = excluded.proposed_milestones, status = 'pending', created_at = now()
    where public.quotes.status in ('pending','withdrawn')
  returning id into v_id;
  if v_id is null then raise exception 'quote_locked'; end if;
  if r.status = 'open' then
    perform private.assert_mission_transition(r.status, 'quoted');
    update public.requests set status = 'quoted' where id = p_request;
  end if;
  perform private.notify(r.client_id, 'new_quote', jsonb_build_object('request_id', p_request, 'quote_id', v_id));
  return v_id;
end $$;

create or replace function public.withdraw_quote(p_quote uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active();
begin
  update public.quotes set status = 'withdrawn' where id = p_quote and provider_id = v_uid and status = 'pending';
  if not found then raise exception 'quote_not_withdrawable'; end if;
end $$;

-- Acceptation : crée la mission + ses étapes, commission figée au taux courant
create or replace function public.accept_quote(p_quote uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); q record; r record; v_mission uuid; m jsonb; v_pos int := 0;
begin
  select * into q from public.quotes where id = p_quote for update;
  if q.id is null then raise exception 'quote_not_found'; end if;
  select * into r from public.requests where id = q.request_id for update;
  if r.client_id is distinct from v_uid then raise exception 'not_owner' using errcode = '42501'; end if;
  if q.status <> 'pending' then raise exception 'quote_not_pending'; end if;
  if not private.is_verified_provider(q.provider_id) then raise exception 'provider_not_verified'; end if;
  perform private.assert_mission_transition(r.status, 'in_progress');

  insert into public.missions (request_id, quote_id, client_id, provider_id, service_id, title, commission_rate, total_cents)
  values (r.id, q.id, r.client_id, q.provider_id, r.service_id, r.title, private.commission_rate(), q.total_cents)
  returning id into v_mission;

  for m in select * from jsonb_array_elements(q.proposed_milestones) loop
    v_pos := v_pos + 1;
    insert into public.milestones (mission_id, position, title, amount_cents, due_date)
    values (v_mission, v_pos, m ->> 'title', (m ->> 'amount_cents')::int, nullif(m ->> 'due_date', '')::date);
  end loop;

  update public.quotes set status = case when id = p_quote then 'accepted'::public.quote_status else 'rejected' end
  where request_id = r.id and status = 'pending';
  update public.requests set status = 'in_progress' where id = r.id;
  perform private.notify(q.provider_id, 'quote_accepted', jsonb_build_object('mission_id', v_mission));
  return v_mission;
end $$;

-- Dépôt en séquestre (simulé) par le client
create or replace function public.fund_milestone(p_milestone uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); ms record; v_tx uuid;
begin
  if (select value #>> '{}' from public.platform_settings where key = 'payment_mode') <> 'simulated' then
    raise exception 'use_payment_function';  -- en production : Edge Function `escrow` + PaymentProvider
  end if;
  select m.*, mi.client_id, mi.provider_id, mi.status as mission_status into ms
  from public.milestones m join public.missions mi on mi.id = m.mission_id where m.id = p_milestone for update of m;
  if ms.client_id is distinct from v_uid then raise exception 'not_owner' using errcode = '42501'; end if;
  if ms.mission_status not in ('in_progress', 'disputed') then raise exception 'mission_not_active'; end if;
  perform private.set_milestone_status(p_milestone, 'funded');
  insert into public.transactions (mission_id, milestone_id, type, amount_cents, provider_ref, actor_id)
  values (ms.mission_id, p_milestone, 'deposit', ms.amount_cents, private.payment_ref('dep'), v_uid)
  returning id into v_tx;
  perform private.notify(ms.provider_id, 'milestone_funded', jsonb_build_object('mission_id', ms.mission_id, 'milestone_id', p_milestone));
  return v_tx;
end $$;

-- Rapport d'étape : p_media = [{ "storage_path", "kind", "captured_at", "latitude", "longitude", "accuracy_m" }]
create or replace function public.submit_report(p_milestone uuid, p_body text, p_media jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); ms record; v_report uuid; m jsonb; v_cap timestamptz;
begin
  select m.*, mi.client_id, mi.provider_id, mi.status as mission_status into ms
  from public.milestones m join public.missions mi on mi.id = m.mission_id where m.id = p_milestone for update of m;
  if ms.provider_id is distinct from v_uid then raise exception 'not_provider' using errcode = '42501'; end if;
  if ms.mission_status not in ('in_progress', 'disputed') then raise exception 'mission_not_active'; end if;
  if jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) = 0 then raise exception 'media_required'; end if;
  perform private.set_milestone_status(p_milestone, 'submitted');

  insert into public.reports (milestone_id, author_id, body) values (p_milestone, v_uid, p_body) returning id into v_report;
  for m in select * from jsonb_array_elements(p_media) loop
    if split_part(m ->> 'storage_path', '/', 1) <> ms.mission_id::text
       or split_part(m ->> 'storage_path', '/', 2) <> p_milestone::text then
      raise exception 'invalid_media_path';
    end if;
    v_cap := (m ->> 'captured_at')::timestamptz;
    -- preuve fraîche : capturée dans les 48 h et pas dans le futur
    if v_cap > now() + interval '5 minutes' or v_cap < now() - interval '48 hours' then
      raise exception 'stale_media';
    end if;
    insert into public.report_media (report_id, storage_path, kind, captured_at, latitude, longitude, accuracy_m)
    values (v_report, m ->> 'storage_path', (m ->> 'kind')::public.media_kind, v_cap,
            (m ->> 'latitude')::float8, (m ->> 'longitude')::float8, nullif(m ->> 'accuracy_m', '')::real);
  end loop;
  perform private.notify(ms.client_id, 'new_report', jsonb_build_object('mission_id', ms.mission_id, 'milestone_id', p_milestone, 'report_id', v_report));
  return v_report;
end $$;

-- Validation par le client : approuvée puis libérée
create or replace function public.approve_milestone(p_milestone uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); ms record;
begin
  select m.*, mi.client_id into ms
  from public.milestones m join public.missions mi on mi.id = m.mission_id where m.id = p_milestone for update of m;
  if ms.client_id is distinct from v_uid then raise exception 'not_owner' using errcode = '42501'; end if;
  perform private.set_milestone_status(p_milestone, 'approved');
  perform private.release_milestone(p_milestone, v_uid);
  perform private.maybe_complete_mission(ms.mission_id);
end $$;

create or replace function public.dispute_milestone(p_milestone uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); ms record; v_id uuid;
begin
  select m.*, mi.client_id, mi.provider_id, mi.status as mission_status into ms
  from public.milestones m join public.missions mi on mi.id = m.mission_id where m.id = p_milestone for update of m;
  if ms.client_id is distinct from v_uid then raise exception 'not_owner' using errcode = '42501'; end if;
  perform private.set_milestone_status(p_milestone, 'disputed');
  insert into public.disputes (milestone_id, mission_id, opened_by, reason)
  values (p_milestone, ms.mission_id, v_uid, p_reason) returning id into v_id;
  if ms.mission_status = 'in_progress' then perform private.set_mission_status(ms.mission_id, 'disputed'); end if;
  perform private.notify(ms.provider_id, 'dispute_update', jsonb_build_object('mission_id', ms.mission_id, 'dispute_id', v_id, 'status', 'open'));
  return v_id;
end $$;

-- Annulation : rembourse les étapes financées non soumises. Bloquée si une étape est en cours d'examen.
create or replace function public.cancel_mission(p_mission uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := private.require_active(); mi record; ms record;
begin
  select * into mi from public.missions where id = p_mission for update;
  if mi.client_id is distinct from v_uid and not private.is_admin() then raise exception 'not_owner' using errcode = '42501'; end if;
  if exists (select 1 from public.milestones where mission_id = p_mission and status in ('submitted','approved','disputed')) then
    raise exception 'milestone_under_review';
  end if;
  for ms in select id from public.milestones where mission_id = p_mission and status = 'funded' loop
    perform private.refund_milestone(ms.id, v_uid);
  end loop;
  perform private.set_mission_status(p_mission, 'cancelled');
  perform private.notify(case when v_uid = mi.client_id then mi.provider_id else mi.client_id end,
    'mission_cancelled', jsonb_build_object('mission_id', p_mission));
end $$;

-- =====================================================================
-- Administration
-- =====================================================================
create or replace function public.admin_review_document(p_doc uuid, p_status public.doc_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := private.require_admin();
begin
  update public.verification_documents set status = p_status, note = p_note, reviewed_by = v_admin, reviewed_at = now()
  where id = p_doc;
  perform private.audit('review_document', 'verification_document', p_doc::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_set_verification(p_provider uuid, p_status public.verification_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := private.require_admin();
begin
  if p_status = 'rejected' and coalesce(char_length(trim(p_reason)), 0) = 0 then raise exception 'reason_required'; end if;
  if p_status = 'verified' and exists (
    select 1 from unnest(array['cin_front','cin_back','selfie','anthropometric','legal_status']::public.doc_type[]) t
    where not exists (select 1 from public.verification_documents d
                      where d.provider_id = p_provider and d.doc_type = t and d.status = 'approved')) then
    raise exception 'required_documents_not_approved';
  end if;
  update public.provider_profiles set verification_status = p_status,
    rejection_reason = case when p_status in ('rejected','suspended') then p_reason end,
    verified_at = case when p_status = 'verified' then now() else verified_at end
  where user_id = p_provider;
  if not found then raise exception 'provider_not_found'; end if;
  perform private.notify(p_provider, 'verification_update', jsonb_build_object('status', p_status, 'reason', p_reason));
  perform private.audit('set_verification', 'provider', p_provider::text, jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := private.require_admin();
begin
  if p_user = v_admin then raise exception 'cannot_suspend_self'; end if;
  update public.profiles set is_suspended = p_suspended where id = p_user;
  perform private.audit(case when p_suspended then 'suspend' else 'unsuspend' end, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_resolve_dispute(p_dispute uuid, p_resolution text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := private.require_admin(); d record;
begin
  select * into d from public.disputes where id = p_dispute for update;
  if d.status <> 'open' then raise exception 'dispute_not_open'; end if;
  case p_resolution
    when 'release' then perform private.release_milestone(d.milestone_id, v_admin);
    when 'refund' then perform private.refund_milestone(d.milestone_id, v_admin);
    when 'resubmit' then perform private.set_milestone_status(d.milestone_id, 'funded');
    else raise exception 'invalid_resolution';
  end case;
  update public.disputes set status = ('resolved_' || p_resolution)::public.dispute_status,
    resolution_note = p_note, resolved_by = v_admin, resolved_at = now() where id = p_dispute;
  perform private.maybe_complete_mission(d.mission_id);
  perform private.notify(m.uid, 'dispute_update', jsonb_build_object('mission_id', d.mission_id, 'dispute_id', p_dispute, 'status', p_resolution))
    from (select unnest(array[client_id, provider_id]) uid from public.missions where id = d.mission_id) m;
  perform private.audit('resolve_dispute', 'dispute', p_dispute::text, jsonb_build_object('resolution', p_resolution));
end $$;

create or replace function public.admin_set_commission_rate(p_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := private.require_admin();
begin
  if p_rate < 0 or p_rate >= 1 then raise exception 'invalid_rate'; end if;
  update public.platform_settings set value = to_jsonb(p_rate), updated_at = now() where key = 'commission_rate';
  perform private.audit('set_commission_rate', 'setting', 'commission_rate', jsonb_build_object('rate', p_rate));
end $$;

-- ---------- Note moyenne prestataire ----------
create or replace function private.on_review_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.provider_profiles pp set
    rating_count = s.c, rating_avg = s.a
  from (select count(*) c, round(avg(rating)::numeric, 2) a from public.reviews where provider_id = new.provider_id) s
  where pp.user_id = new.provider_id;
  return new;
end $$;
create trigger reviews_after_insert after insert on public.reviews
  for each row execute function private.on_review_inserted();

-- ---------- Notification de nouveau message ----------
create or replace function private.on_message_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
declare mi record;
begin
  select client_id, provider_id into mi from public.missions where id = new.mission_id;
  perform private.notify(case when new.sender_id = mi.client_id then mi.provider_id else mi.client_id end,
    'new_message', jsonb_build_object('mission_id', new.mission_id, 'message_id', new.id,
      'preview', left(coalesce(new.body, '📷'), 80)));
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.on_message_inserted();

-- ---------- Droits d'exécution ----------
-- Supabase accorde EXECUTE par défaut : on restreint explicitement.
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.set_my_role(public.user_role), public.complete_onboarding(), public.submit_verification(),
  public.publish_request(uuid), public.cancel_request(uuid),
  public.submit_quote(uuid, text, jsonb), public.withdraw_quote(uuid), public.accept_quote(uuid),
  public.fund_milestone(uuid), public.submit_report(uuid, text, jsonb), public.approve_milestone(uuid),
  public.dispute_milestone(uuid, text), public.cancel_mission(uuid),
  public.admin_review_document(uuid, public.doc_status, text),
  public.admin_set_verification(uuid, public.verification_status, text),
  public.admin_set_suspended(uuid, boolean, text),
  public.admin_resolve_dispute(uuid, text, text),
  public.admin_set_commission_rate(numeric)
to authenticated;
-- Les helpers RLS doivent rester exécutables par `authenticated` (évalués dans les politiques)
grant execute on function private.my_role(), private.is_admin(), private.is_active_user(),
  private.is_verified_provider(uuid), private.is_mission_participant(uuid),
  private.provider_can_see_request(uuid), private.is_request_owner(uuid), private.has_quoted(uuid)
to anon, authenticated;
