begin;
\ir _fixtures.psql
select plan(39);

-- Demande publiée par C1 à Testville
:as_c1
insert into public.requests (id, client_id, service_id, city_id, title, budget_cents) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', :C1, :SVC, (select id from public.cities where slug = 'testville'), 'Chantier test', 300000);
:as_root

-- ---------- Devis ----------
:as_pv
select throws_ok($$ select public.submit_quote('aaaaaaaa-0000-0000-0000-0000000000d1', 'x', '[]') $$, 'P0001', 'invalid_milestones', 'devis sans étape refusé');
select throws_ok($$ select public.submit_quote('aaaaaaaa-0000-0000-0000-0000000000d1', 'x', '[{"title":"a","amount_cents":-5}]') $$, 'P0001', 'invalid_milestones', 'montant négatif refusé');
select throws_ok($$ select public.submit_quote('aaaaaaaa-0000-0000-0000-0000000000d1', 'x', '[{"title":"a","amount_cents":10.5}]') $$, 'P0001', 'invalid_milestones', 'montant non entier refusé');
select lives_ok($$ select public.submit_quote('aaaaaaaa-0000-0000-0000-0000000000d1', 'Mon devis',
  '[{"title":"Visite 1","amount_cents":100000},{"title":"Visite 2","amount_cents":100000},{"title":"Visite 3","amount_cents":33333}]') $$, 'devis valide');
:as_root
select is((select status::text from public.requests where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 'quoted', 'la demande passe en quoted');
select is((select total_cents from public.quotes where provider_id = :PV), 233333, 'total = somme des étapes');
select is((select count(*)::int from public.notifications where user_id = :C1 and type = 'new_quote'), 1, 'notification nouveau devis');

-- ---------- Acceptation ----------
create temp table t_q on commit drop as select id from public.quotes where provider_id = :PV;
grant select on t_q to authenticated;
:as_c2
select throws_ok(format($$ select public.accept_quote(%L) $$, (select id from t_q)), '42501', 'not_owner', 'un autre client ne peut pas accepter');
:as_root
update public.platform_settings set value = '0.2' where key = 'commission_rate';
:as_c1
select lives_ok(format($$ select public.accept_quote(%L) $$, (select id from public.quotes where provider_id = :PV)), 'le client accepte le devis');
:as_root
update public.platform_settings set value = '0.15' where key = 'commission_rate';
create temp table t_m on commit drop as select id from public.missions where provider_id = :PV;
grant select on t_m to authenticated;
select is((select status::text from public.missions where id = (select id from t_m)), 'in_progress', 'mission créée en in_progress');
select is((select commission_rate from public.missions where id = (select id from t_m)), 0.2000, 'commission figée au taux du moment de l’acceptation');
select is((select count(*)::int from public.milestones where mission_id = (select id from t_m)), 3, '3 étapes créées');
select is((select status::text from public.requests where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 'in_progress', 'la demande suit la mission');
:as_c1
select throws_ok(format($$ select public.accept_quote(%L) $$, (select id from public.quotes where provider_id = :PV)), 'P0001', 'quote_not_pending', 'double acceptation impossible');
:as_root

create temp table t_ms on commit drop as
  select id, position from public.milestones where mission_id = (select id from t_m);
grant select on t_ms to authenticated;

-- ---------- Séquestre : ordre imposé ----------
:as_pv
select throws_ok(format($$ select public.submit_report(%L, 'r', '[]') $$, (select id from t_ms where position = 1)), 'P0001', null, 'rapport impossible sans média');
select throws_ok(format($$ select public.submit_report(%L, 'r', %L) $$, (select id from t_ms where position = 1),
  jsonb_build_array(jsonb_build_object('storage_path', (select id from t_m) || '/' || (select id from t_ms where position = 1) || '/a.jpg',
  'kind','photo','captured_at', now(),'latitude',33.5,'longitude',-7.6))), 'P0001', 'invalid_milestone_transition: pending -> submitted',
  'rapport impossible sur étape non financée');
select throws_ok(format($$ select public.fund_milestone(%L) $$, (select id from t_ms where position = 1)), '42501', 'not_owner', 'le prestataire ne peut pas financer');
:as_c1
select throws_ok(format($$ select public.approve_milestone(%L) $$, (select id from t_ms where position = 1)), 'P0001', 'invalid_milestone_transition: pending -> approved', 'validation impossible avant rapport');
select lives_ok(format($$ select public.fund_milestone(%L) $$, (select id from t_ms where position = 1)), 'le client dépose l’étape 1');
select throws_ok(format($$ select public.fund_milestone(%L) $$, (select id from t_ms where position = 1)), 'P0001', 'invalid_milestone_transition: funded -> funded', 'double dépôt impossible');
select throws_ok(format($$ select public.approve_milestone(%L) $$, (select id from t_ms where position = 1)), 'P0001', 'invalid_milestone_transition: funded -> approved', 'libération impossible avant rapport');
:as_pv
select throws_ok(format($$ select public.submit_report(%L, 'r', %L) $$, (select id from t_ms where position = 1),
  jsonb_build_array(jsonb_build_object('storage_path', (select id from t_m) || '/autre/a.jpg',
  'kind','photo','captured_at', now(),'latitude',33.5,'longitude',-7.6))), 'P0001', 'invalid_media_path', 'chemin média hors mission refusé');
select throws_ok(format($$ select public.submit_report(%L, 'r', %L) $$, (select id from t_ms where position = 1),
  jsonb_build_array(jsonb_build_object('storage_path', (select id from t_m) || '/' || (select id from t_ms where position = 1) || '/a.jpg',
  'kind','photo','captured_at', now() - interval '3 days','latitude',33.5,'longitude',-7.6))), 'P0001', 'stale_media', 'média trop ancien refusé');
select lives_ok(format($$ select public.submit_report(%L, 'Rapport visite 1', %L) $$, (select id from t_ms where position = 1),
  jsonb_build_array(jsonb_build_object('storage_path', (select id from t_m) || '/' || (select id from t_ms where position = 1) || '/a.jpg',
  'kind','photo','captured_at', now(),'latitude',33.5,'longitude',-7.6, 'accuracy_m', 5))), 'rapport valide avec GPS + horodatage');
:as_c1
select lives_ok(format($$ select public.approve_milestone(%L) $$, (select id from t_ms where position = 1)), 'le client valide l’étape 1');
:as_root
select is((select status::text from public.milestones where id = (select id from t_ms where position = 1)), 'released', 'étape libérée');
select is((select amount_cents from public.transactions where milestone_id = (select id from t_ms where position = 1) and type = 'release'), 80000, 'versement net = 100000 - 20 %');
select is((select amount_cents from public.transactions where milestone_id = (select id from t_ms where position = 1) and type = 'commission'), 20000, 'commission 20 %');
select is((select (sum(amount_cents) filter (where type = 'deposit') - sum(amount_cents) filter (where type in ('release','commission')))::int
  from public.transactions where milestone_id = (select id from t_ms where position = 1)), 0, 'séquestre soldé : dépôt = versement + commission');

-- ---------- Litige ----------
:as_c1
select public.fund_milestone((select id from t_ms where position = 2));
:as_pv
select public.submit_report((select id from t_ms where position = 2), 'Rapport 2', jsonb_build_array(jsonb_build_object(
  'storage_path', (select id from t_m) || '/' || (select id from t_ms where position = 2) || '/b.jpg',
  'kind','video','captured_at', now(),'latitude',33.5,'longitude',-7.6)));
:as_c1
select lives_ok(format($$ select public.dispute_milestone(%L, 'Photos incomplètes') $$, (select id from t_ms where position = 2)), 'le client conteste l’étape 2');
:as_root
select is((select status::text from public.missions where id = (select id from t_m)), 'disputed', 'mission en litige');
:as_c1
select throws_ok(format($$ select public.admin_resolve_dispute(%L, 'release') $$, (select id from public.disputes where mission_id = (select id from t_m))),
  '42501', 'admin_only', 'seul l’admin résout un litige');
select throws_ok(format($$ select public.cancel_mission(%L) $$, (select id from t_m)), 'P0001', 'milestone_under_review', 'annulation bloquée pendant un litige');
:as_admin
select lives_ok(format($$ select public.admin_resolve_dispute(%L, 'refund', 'Preuves insuffisantes') $$, (select id from public.disputes where mission_id = (select id from t_m))), 'admin rembourse');
:as_root
select is((select status::text from public.missions where id = (select id from t_m)), 'in_progress', 'mission revient en cours');
select is((select amount_cents from public.transactions where milestone_id = (select id from t_ms where position = 2) and type = 'refund'), 100000, 'remboursement intégral');

-- ---------- Fin de mission + avis ----------
:as_c1
select public.fund_milestone((select id from t_ms where position = 3));
:as_pv
select public.submit_report((select id from t_ms where position = 3), 'Rapport 3', jsonb_build_array(jsonb_build_object(
  'storage_path', (select id from t_m) || '/' || (select id from t_ms where position = 3) || '/c.jpg',
  'kind','photo','captured_at', now(),'latitude',33.5,'longitude',-7.6)));
:as_c1
select public.approve_milestone((select id from t_ms where position = 3));
:as_root
select is((select status::text from public.missions where id = (select id from t_m)), 'completed', 'mission terminée quand toutes les étapes sont soldées');
select is((select amount_cents from public.transactions where milestone_id = (select id from t_ms where position = 3) and type = 'commission'), 6667, 'arrondi de commission au centime (33333 × 0,2)');
select is((select missions_completed from public.provider_profiles where user_id = :PV), 1, 'compteur de missions réussies');

select * from finish();
rollback;
