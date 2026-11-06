begin;
\ir _fixtures.psql
select plan(32);

-- ---------- RLS activée partout ----------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'RLS activée sur toutes les tables publiques');

-- ---------- Anonyme ----------
:as_anon
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon ne lit aucun profil');
select ok((select count(*) from public.services) > 0, 'anon lit le catalogue de services');
select throws_ok($$ insert into public.services (slug, name_fr, name_ar, name_en) values ('x','x','x','x') $$, '42501', null, 'anon ne peut pas écrire de service');
:as_root

-- ---------- Profils ----------
:as_c1
select is((select count(*)::int from public.profiles), 1, 'un client ne voit que son profil');
select lives_ok($$ update public.profiles set full_name = 'Nouveau nom' where id = auth.uid() $$, 'le client modifie son nom');
select throws_ok($$ update public.profiles set role = 'admin' where id = auth.uid() $$, '42501', null, 'impossible de s’auto-promouvoir admin (privilège de colonne)');
select throws_ok($$ update public.profiles set is_suspended = false where id = auth.uid() $$, '42501', null, 'impossible de modifier is_suspended');
select throws_ok($$ select public.set_my_role('admin') $$, '42501', null, 'set_my_role refuse admin');
:as_pv
select throws_ok($$ update public.provider_profiles set verification_status = 'verified' where user_id = auth.uid() $$, '42501', null, 'un prestataire ne peut pas se vérifier lui-même');
:as_root

-- ---------- Documents de vérification ----------
:as_pu
select lives_ok(format($$ insert into public.verification_documents (provider_id, doc_type, storage_path) values (%L, 'cin_front', %L) $$,
  :PU, :PU || '/cin_front.jpg'), 'le prestataire dépose son document');
select throws_ok(format($$ insert into public.verification_documents (provider_id, doc_type, storage_path, status) values (%L, 'selfie', %L, 'approved') $$,
  :PU, :PU || '/s.jpg'), '42501', null, 'impossible de déposer un document déjà approuvé');
select throws_ok(format($$ insert into public.verification_documents (provider_id, doc_type, storage_path) values (%L, 'selfie', %L) $$,
  :PV, :PV || '/s.jpg'), '42501', null, 'impossible de déposer pour un autre prestataire');
:as_root
:as_pv
select is((select count(*)::int from public.verification_documents where provider_id = :PU), 0, 'un autre prestataire ne voit pas les documents');
:as_c1
select is((select count(*)::int from public.verification_documents), 0, 'un client ne voit aucun document');
:as_admin
select is((select count(*)::int from public.verification_documents where provider_id = :PU), 1, 'l’admin voit les documents');
:as_root

-- ---------- Storage : bucket verification ----------
insert into storage.objects (bucket_id, name) values ('verification', :PU || '/cin_front.jpg');
:as_pu
select is((select count(*)::int from storage.objects where bucket_id = 'verification'), 1, 'propriétaire lit son fichier');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('verification', %L) $$, :PV || '/x.jpg'),
  '42501', null, 'upload interdit dans le dossier d’un autre');
:as_c1
select is((select count(*)::int from storage.objects where bucket_id = 'verification'), 0, 'client : aucun accès aux pièces');
:as_pv
select is((select count(*)::int from storage.objects where bucket_id = 'verification'), 0, 'autre prestataire : aucun accès');
:as_admin
select is((select count(*)::int from storage.objects where bucket_id = 'verification'), 1, 'admin : accès aux pièces');
:as_root

-- ---------- Demandes : visibilité par zone/service/vérification ----------
:as_c1
insert into public.requests (id, client_id, service_id, city_id, title) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', :C1, :SVC, (select id from public.cities where slug = 'testville'), 'Demande test');
select throws_ok(format($$ insert into public.requests (client_id, service_id, city_id, title) values (%L, %L, 1, 'usurpation') $$, :C2, :SVC),
  '42501', null, 'un client ne crée pas de demande au nom d’un autre');
select throws_ok($$ update public.requests set status = 'completed' where id = 'aaaaaaaa-0000-0000-0000-0000000000d1' $$,
  '42501', null, 'le statut ne se modifie pas directement');
:as_c2
select is((select count(*)::int from public.requests where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 0, 'un autre client ne voit pas la demande');
:as_pv
select is((select count(*)::int from public.requests where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 1, 'prestataire vérifié de la zone voit la demande');
:as_pv2
select is((select count(*)::int from public.requests where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 0, 'prestataire hors zone ne voit pas la demande');
:as_pu
select is((select count(*)::int from public.requests where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 0, 'prestataire non vérifié ne voit pas la demande');
select throws_ok($$ select public.submit_quote('aaaaaaaa-0000-0000-0000-0000000000d1', 'x', '[{"title":"a","amount_cents":100}]') $$,
  '42501', null, 'prestataire non vérifié ne peut pas faire de devis');
:as_root

-- ---------- Écritures directes interdites ----------
:as_c1
select throws_ok($$ insert into public.quotes (request_id, provider_id, total_cents, proposed_milestones) values ('aaaaaaaa-0000-0000-0000-0000000000d1', auth.uid(), 1, '[]') $$,
  '42501', null, 'pas d’insertion directe de devis');
select throws_ok($$ insert into public.transactions (mission_id, milestone_id, type, amount_cents, provider_ref) values (gen_random_uuid(), gen_random_uuid(), 'release', 1, 'x') $$,
  '42501', null, 'pas d’écriture directe dans les transactions');
select throws_ok($$ select private.release_milestone(gen_random_uuid(), auth.uid()) $$,
  '42501', null, 'fonctions internes non exécutables');
:as_root

-- ---------- Profil public ----------
:as_anon
select is((select count(*)::int from public.public_provider_profiles where user_id in (:PV, :PU)), 1, 'profil public : uniquement les prestataires vérifiés');
:as_root

select * from finish();
rollback;
