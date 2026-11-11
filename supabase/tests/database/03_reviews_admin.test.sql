begin;
\ir _fixtures.psql
select plan(14);

-- Mission terminée et mission en cours, créées directement
insert into public.missions (id, client_id, provider_id, service_id, title, status, commission_rate, total_cents) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', :C1, :PV, :SVC, 'Terminée', 'completed', 0.15, 1000),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', :C1, :PV, :SVC, 'En cours', 'in_progress', 0.15, 1000);

-- ---------- Avis ----------
:as_c1
select throws_ok(format($$ insert into public.reviews (mission_id, client_id, provider_id, rating) values ('aaaaaaaa-0000-0000-0000-0000000000a2', %L, %L, 5) $$, :C1, :PV),
  '42501', null, 'pas d’avis sur une mission en cours');
select lives_ok(format($$ insert into public.reviews (mission_id, client_id, provider_id, rating, comment) values ('aaaaaaaa-0000-0000-0000-0000000000a1', %L, %L, 4, 'Bien') $$, :C1, :PV),
  'avis après mission terminée');
select throws_ok(format($$ insert into public.reviews (mission_id, client_id, provider_id, rating) values ('aaaaaaaa-0000-0000-0000-0000000000a1', %L, %L, 5) $$, :C1, :PV),
  '23505', null, 'un seul avis par mission');
:as_c2
select throws_ok(format($$ insert into public.reviews (mission_id, client_id, provider_id, rating) values ('aaaaaaaa-0000-0000-0000-0000000000a1', %L, %L, 1) $$, :C2, :PV),
  '42501', null, 'un tiers ne peut pas noter');
:as_root
select is((select rating_avg from public.provider_profiles where user_id = :PV), 4.00, 'note moyenne recalculée');

-- ---------- Messagerie ----------
:as_c1
select lives_ok($$ insert into public.messages (mission_id, sender_id, body) values ('aaaaaaaa-0000-0000-0000-0000000000a2', auth.uid(), 'Bonjour') $$, 'participant envoie un message');
:as_c2
select throws_ok($$ insert into public.messages (mission_id, sender_id, body) values ('aaaaaaaa-0000-0000-0000-0000000000a2', auth.uid(), 'Intrus') $$, '42501', null, 'non-participant ne peut pas écrire');
select is((select count(*)::int from public.messages), 0, 'non-participant ne lit pas les messages');
:as_root
select is((select count(*)::int from public.notifications where user_id = :PV and type = 'new_message'), 1, 'notification de message');

-- ---------- Admin ----------
:as_admin
select throws_ok(format($$ select public.admin_set_verification(%L, 'verified') $$, :PU), 'P0001', 'required_documents_not_approved', 'vérification impossible sans documents approuvés');
select throws_ok(format($$ select public.admin_set_verification(%L, 'rejected') $$, :PU), 'P0001', 'reason_required', 'rejet sans motif refusé');
select lives_ok(format($$ select public.admin_set_suspended(%L, true, 'Fraude') $$, :C2), 'admin suspend un compte');
:as_c2
select throws_ok($$ insert into public.requests (client_id, service_id, city_id, title) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-00000000005e', 1, 'Test suspendu') $$,
  '42501', null, 'compte suspendu : écriture bloquée');
:as_c1
select throws_ok($$ select public.admin_set_commission_rate(0.5) $$, '42501', 'admin_only', 'seul l’admin modifie la commission');
:as_root

select * from finish();
rollback;
