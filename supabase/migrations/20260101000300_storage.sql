-- =====================================================================
-- Storage : buckets privés + politiques.
-- Convention de chemins (1er segment = clé de contrôle d'accès) :
--   verification/{provider_uid}/{doc_type}-{uuid}.jpg   propriétaire + admin
--   request-photos/{request_id}/{uuid}.jpg              client + prestataires éligibles
--   reports/{mission_id}/{milestone_id}/{uuid}.jpg|mp4  participants + admin
--   chat/{mission_id}/{uuid}.jpg                        participants + admin
--   avatars/{uid}/avatar.jpg                            public en lecture
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('verification', 'verification', false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('request-photos', 'request-photos', false, 10485760, array['image/jpeg','image/png']),
  ('reports', 'reports', false, 104857600, array['image/jpeg','video/mp4','video/quicktime']),
  ('chat', 'chat', false, 10485760, array['image/jpeg','image/png']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png'])
on conflict (id) do nothing;

create or replace function private.safe_uuid(p text) returns uuid
language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;
grant execute on function private.safe_uuid(text) to authenticated;

-- verification : STRICT — propriétaire et admins uniquement
create policy "verification read" on storage.objects for select to authenticated
  using (bucket_id = 'verification' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));
create policy "verification insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text
              and private.my_role() = 'provider' and private.is_active_user());
create policy "verification delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text);

-- request-photos
create policy "request photos read" on storage.objects for select to authenticated
  using (bucket_id = 'request-photos' and (
    private.is_request_owner(private.safe_uuid((storage.foldername(name))[1]))
    or private.provider_can_see_request(private.safe_uuid((storage.foldername(name))[1]))
    or private.has_quoted(private.safe_uuid((storage.foldername(name))[1]))
    or private.is_admin()));
create policy "request photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-photos' and private.is_request_owner(private.safe_uuid((storage.foldername(name))[1])));
create policy "request photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'request-photos' and private.is_request_owner(private.safe_uuid((storage.foldername(name))[1])));

-- reports : lecture participants ; écriture prestataire de la mission
create policy "reports read" on storage.objects for select to authenticated
  using (bucket_id = 'reports' and (private.is_mission_participant(private.safe_uuid((storage.foldername(name))[1])) or private.is_admin()));
create policy "reports insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and private.is_active_user() and exists (
    select 1 from public.missions m where m.id = private.safe_uuid((storage.foldername(name))[1]) and m.provider_id = auth.uid()));

-- chat
create policy "chat read" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and (private.is_mission_participant(private.safe_uuid((storage.foldername(name))[1])) or private.is_admin()));
create policy "chat insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and private.is_active_user() and private.is_mission_participant(private.safe_uuid((storage.foldername(name))[1])));

-- avatars (bucket public : lecture via URL publique)
create policy "avatars write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
