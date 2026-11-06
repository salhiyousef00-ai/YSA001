begin;
\ir _fixtures.psql
select plan(8);

insert into public.missions (id, client_id, provider_id, service_id, title, status, commission_rate, total_cents) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', :C1, :PV, :SVC, 'Active', 'in_progress', 0.15, 1000);
insert into public.milestones (id, mission_id, position, title, amount_cents, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 1, 'Étape', 1000, 'funded');

-- Exécutable uniquement par la clé service
:as_c1
select throws_ok(format($$ select public.service_anonymize_user(%L) $$, :C1), '42501', null, 'un utilisateur ne peut pas appeler l’anonymisation');
:as_root

select throws_ok(format($$ select private.anonymize_user(%L) $$, :C1), 'P0001', 'active_escrow', 'suppression bloquée si fonds en séquestre');

update public.milestones set status = 'refunded' where id = 'aaaaaaaa-0000-0000-0000-0000000000b1';
update public.missions set status = 'cancelled' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
insert into public.verification_documents (provider_id, doc_type, storage_path) values (:PV, 'cin_front', :PV || '/cin.jpg');
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[test]', :PV, 'ios');
update public.profiles set full_name = 'Nom Réel', phone = '+212600000000' where id = :PV;

select ok((select private.anonymize_user(:PV)) -> 'verification' ? (:PV || '/cin.jpg'), 'retourne les fichiers à purger');
select is((select count(*)::int from public.verification_documents where provider_id = :PV), 0, 'documents d’identité supprimés');
select is((select count(*)::int from public.push_tokens where user_id = :PV), 0, 'jetons push supprimés');
select is((select full_name from public.profiles where id = :PV), null, 'nom effacé');
select is((select phone from public.profiles where id = :PV), null, 'téléphone effacé');
select is((select count(*)::int from public.missions where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'), 1, 'historique de mission conservé (anonymisé)');

select * from finish();
rollback;
