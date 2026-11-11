-- =====================================================================
-- Realtime, déclenchement des push, suppression de compte (loi 09-08).
-- =====================================================================

-- ---------- Realtime ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications, public.milestones, public.missions;
  end if;
end $$;

-- ---------- Push : chaque notification déclenche l'Edge Function send-push ----------
-- Utilise pg_net + Vault si disponibles (secrets `project_url` et `service_role_key`).
create or replace function private.on_notification_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then return new; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'project_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'$q$ into v_key;
  if v_url is null or v_key is null then return new; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url || '/functions/v1/send-push',
          jsonb_build_object('notification_id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key);
  return new;
exception when others then
  raise warning 'push dispatch failed: %', sqlerrm;  -- ne jamais bloquer la transaction métier
  return new;
end $$;
create trigger notifications_after_insert after insert on public.notifications
  for each row execute function private.on_notification_inserted();
revoke execute on function private.on_notification_inserted() from public, anon, authenticated;

-- ---------- Suppression de compte ----------
-- Étape 1 (SQL, appelée par l'Edge Function delete-account avec la clé service) :
--   efface/anonymise les données personnelles. Les transactions et missions sont conservées
--   sous forme anonymisée (obligation comptable), le lien à la personne est rompu.
-- Étape 2 (Edge Function) : purge Storage puis auth.admin.deleteUser().
create or replace function private.anonymize_user(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_paths jsonb;
begin
  if exists (select 1 from public.missions m join public.milestones ms on ms.mission_id = m.id
             where p_uid in (m.client_id, m.provider_id)
               and m.status in ('in_progress', 'disputed') and ms.status in ('funded','submitted','approved','disputed')) then
    raise exception 'active_escrow';
  end if;

  -- chemins Storage à purger par l'appelant
  select jsonb_build_object(
    'verification', coalesce((select jsonb_agg(storage_path) from public.verification_documents where provider_id = p_uid), '[]'),
    'request-photos', coalesce((select jsonb_agg(rp.storage_path) from public.request_photos rp
                                join public.requests r on r.id = rp.request_id where r.client_id = p_uid), '[]'),
    'chat', coalesce((select jsonb_agg(image_path) from public.messages where sender_id = p_uid and image_path is not null), '[]'),
    'avatars', jsonb_build_array(p_uid::text || '/avatar.jpg')
  ) into v_paths;

  delete from public.verification_documents where provider_id = p_uid;
  delete from public.messages where sender_id = p_uid;
  delete from public.push_tokens where user_id = p_uid;
  delete from public.notifications where user_id = p_uid;
  delete from public.request_photos rp using public.requests r where r.id = rp.request_id and r.client_id = p_uid;
  delete from public.requests r where r.client_id = p_uid and not exists (select 1 from public.missions m where m.request_id = r.id);
  update public.requests set description = '', title = '[supprimé]' where client_id = p_uid;
  update public.reviews set comment = null where client_id = p_uid;
  update public.profiles set full_name = null, phone = null, avatar_url = null, deleted_at = now() where id = p_uid;
  return v_paths;
end $$;
revoke execute on function private.anonymize_user(uuid) from public, anon, authenticated;
grant execute on function private.anonymize_user(uuid) to service_role;

-- Wrapper exposé à l'API mais réservé à la clé service (Edge Function delete-account)
create or replace function public.service_anonymize_user(p_uid uuid)
returns jsonb language sql security definer set search_path = public as $$ select private.anonymize_user(p_uid) $$;
revoke execute on function public.service_anonymize_user(uuid) from public, anon, authenticated;
grant execute on function public.service_anonymize_user(uuid) to service_role;
