-- =====================================================================
-- Données de démo. Mot de passe de tous les comptes : Wasla2026!
--   admin@wasla.test
--   clients   : yasmine@wasla.test (FR), karim@wasla.test (BE), salma@wasla.test (CA)
--   prestataires : omar@ (vérifié), nadia@ (vérifiée), youssef@ (vérifié),
--                  hamza@ (en attente), leila@ (rejetée)  — tous @wasla.test
-- =====================================================================
insert into public.cities (slug, name_fr, name_ar, name_en) values
  ('casablanca','Casablanca','الدار البيضاء','Casablanca'),
  ('rabat','Rabat','الرباط','Rabat'),
  ('marrakech','Marrakech','مراكش','Marrakesh'),
  ('fes','Fès','فاس','Fez'),
  ('tanger','Tanger','طنجة','Tangier'),
  ('agadir','Agadir','أكادير','Agadir'),
  ('oujda','Oujda','وجدة','Oujda'),
  ('meknes','Meknès','مكناس','Meknes'),
  ('tetouan','Tétouan','تطوان','Tetouan'),
  ('nador','Nador','الناظور','Nador')
on conflict (slug) do nothing;

insert into public.services (id, slug, name_fr, name_ar, name_en, description_fr, description_ar, description_en, icon, sort_order) values
  ('5e000000-0000-0000-0000-000000000001', 'suivi-chantier', 'Suivi de chantier', 'متابعة الأشغال', 'Construction monitoring',
   'Visites régulières de votre chantier et rapport hebdomadaire avec photos géolocalisées.',
   'زيارات منتظمة لورشتك وتقرير أسبوعي مع صور محددة الموقع.',
   'Regular site visits and a weekly report with geotagged photos.', 'hard-hat', 1),
  ('5e000000-0000-0000-0000-000000000002', 'demarches-administratives', 'Démarches administratives', 'الإجراءات الإدارية', 'Administrative procedures',
   'Dépôt et retrait de documents, suivi de dossiers auprès des administrations.',
   'إيداع وسحب الوثائق وتتبع الملفات لدى الإدارات.',
   'Filing and collecting documents, following up on files with public offices.', 'file-text', 2),
  ('5e000000-0000-0000-0000-000000000003', 'gestion-biens', 'Gestion de biens', 'تدبير الممتلكات', 'Property management',
   'État des lieux, entretien et préparation de votre logement avant votre arrivée.',
   'معاينة الحالة والصيانة وتجهيز مسكنك قبل وصولك.',
   'Inspections, maintenance and getting your home ready before you arrive.', 'home', 3)
on conflict (id) do nothing;

-- ---------- Comptes ----------
with u(id, email, phone) as (values
  ('00000000-0000-0000-0000-00000000000a'::uuid, 'admin@wasla.test', null),
  ('c0000000-0000-0000-0000-000000000001', 'yasmine@wasla.test', null),
  ('c0000000-0000-0000-0000-000000000002', 'karim@wasla.test', null),
  ('c0000000-0000-0000-0000-000000000003', 'salma@wasla.test', null),
  ('b0000000-0000-0000-0000-000000000001', 'omar@wasla.test', '+212600000001'),
  ('b0000000-0000-0000-0000-000000000002', 'nadia@wasla.test', '+212600000002'),
  ('b0000000-0000-0000-0000-000000000003', 'youssef@wasla.test', '+212600000003'),
  ('b0000000-0000-0000-0000-000000000004', 'hamza@wasla.test', '+212600000004'),
  ('b0000000-0000-0000-0000-000000000005', 'leila@wasla.test', '+212600000005'))
insert into auth.users (instance_id, id, aud, role, email, phone, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, phone,
       extensions.crypt('Wasla2026!', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''
from u on conflict (id) do nothing;

-- GoTrue (Supabase hébergé) refuse la connexion si ces colonnes texte sont NULL
-- (« Database error querying schema »). On les met à '' si elles existent.
do $$
declare c text;
begin
  foreach c in array array['email_change_token_current','phone_change','phone_change_token','reauthentication_token','email_change','email_change_token_new','confirmation_token','recovery_token'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = c) then
      execute format('update auth.users set %I = %L where %I is null and email like %L', c, '', c, '%@wasla.test');
    end if;
  end loop;
end $$;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now()
from auth.users where email like '%@wasla.test' on conflict do nothing;

update public.profiles p set role = v.role::public.user_role, full_name = v.name, locale = v.locale::public.app_locale, onboarded = true
from (values
  ('00000000-0000-0000-0000-00000000000a'::uuid, 'admin', 'Équipe Wasla', 'fr'),
  ('c0000000-0000-0000-0000-000000000001', 'client', 'Yasmine Benali', 'fr'),
  ('c0000000-0000-0000-0000-000000000002', 'client', 'Karim El Idrissi', 'fr'),
  ('c0000000-0000-0000-0000-000000000003', 'client', 'Salma Ouazzani', 'en'),
  ('b0000000-0000-0000-0000-000000000001', 'provider', 'Omar Tazi', 'fr'),
  ('b0000000-0000-0000-0000-000000000002', 'provider', 'Nadia Berrada', 'ar'),
  ('b0000000-0000-0000-0000-000000000003', 'provider', 'Youssef Amrani', 'fr'),
  ('b0000000-0000-0000-0000-000000000004', 'provider', 'Hamza Chraibi', 'ar'),
  ('b0000000-0000-0000-0000-000000000005', 'provider', 'Leila Fassi', 'fr')
) v(id, role, name, locale) where p.id = v.id;

insert into public.client_profiles (user_id, residence_country, origin_city_id) values
  ('c0000000-0000-0000-0000-000000000001', 'FR', (select id from public.cities where slug = 'casablanca')),
  ('c0000000-0000-0000-0000-000000000002', 'BE', (select id from public.cities where slug = 'rabat')),
  ('c0000000-0000-0000-0000-000000000003', 'CA', (select id from public.cities where slug = 'tanger'))
on conflict do nothing;

insert into public.provider_profiles (user_id, bio, experience_years, verification_status, rejection_reason, verified_at) values
  ('b0000000-0000-0000-0000-000000000001', 'Ingénieur BTP, 12 ans de suivi de chantiers résidentiels à Casablanca et Mohammedia.', 12, 'verified', null, now()),
  ('b0000000-0000-0000-0000-000000000002', 'Ancienne assistante juridique, spécialisée dans les démarches administratives et notariales.', 8, 'verified', null, now()),
  ('b0000000-0000-0000-0000-000000000003', 'Gestionnaire immobilier à Tanger : états des lieux, entretien, accueil des artisans.', 6, 'verified', null, now()),
  ('b0000000-0000-0000-0000-000000000004', 'Technicien bâtiment à Fès.', 3, 'pending', null, null),
  ('b0000000-0000-0000-0000-000000000005', 'Conciergerie à Agadir.', 2, 'rejected', 'CIN illisible, merci de renvoyer une photo nette.', null)
on conflict do nothing;

insert into public.provider_services (provider_id, service_id, indicative_price_cents, price_unit) values
  ('b0000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 80000, 'visit'),
  ('b0000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000003', 50000, 'visit'),
  ('b0000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000002', 60000, 'mission'),
  ('b0000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000003', 150000, 'month'),
  ('b0000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000002', 50000, 'mission'),
  ('b0000000-0000-0000-0000-000000000004', '5e000000-0000-0000-0000-000000000001', 60000, 'visit'),
  ('b0000000-0000-0000-0000-000000000005', '5e000000-0000-0000-0000-000000000003', 40000, 'visit')
on conflict do nothing;

insert into public.provider_cities (provider_id, city_id)
select v.p::uuid, c.id from (values
  ('b0000000-0000-0000-0000-000000000001', 'casablanca'), ('b0000000-0000-0000-0000-000000000001', 'rabat'),
  ('b0000000-0000-0000-0000-000000000002', 'rabat'), ('b0000000-0000-0000-0000-000000000002', 'casablanca'),
  ('b0000000-0000-0000-0000-000000000003', 'tanger'), ('b0000000-0000-0000-0000-000000000003', 'tetouan'),
  ('b0000000-0000-0000-0000-000000000004', 'fes'), ('b0000000-0000-0000-0000-000000000005', 'agadir')
) v(p, slug) join public.cities c on c.slug = v.slug on conflict do nothing;

-- Documents (fichiers fictifs : chemins seulement)
insert into public.verification_documents (provider_id, doc_type, storage_path, status, reviewed_by, reviewed_at)
select p.id, d.t::public.doc_type, p.id || '/' || d.t || '.jpg',
       case when p.id::text like '%4' then 'pending' when p.id::text like '%5' and d.t = 'cin_front' then 'rejected' else 'approved' end::public.doc_status,
       case when p.id::text like '%4' then null else '00000000-0000-0000-0000-00000000000a'::uuid end,
       case when p.id::text like '%4' then null else now() end
from public.profiles p cross join unnest(array['cin_front','cin_back','selfie','anthropometric','legal_status']) d(t)
where p.role = 'provider'
on conflict do nothing;
insert into public.verification_documents (provider_id, doc_type, storage_path, status, reviewed_by, reviewed_at) values
  ('b0000000-0000-0000-0000-000000000001', 'diploma', 'b0000000-0000-0000-0000-000000000001/diploma.jpg', 'approved', '00000000-0000-0000-0000-00000000000a', now()),
  ('b0000000-0000-0000-0000-000000000001', 'insurance', 'b0000000-0000-0000-0000-000000000001/insurance.pdf', 'approved', '00000000-0000-0000-0000-00000000000a', now()),
  ('b0000000-0000-0000-0000-000000000003', 'insurance', 'b0000000-0000-0000-0000-000000000003/insurance.pdf', 'approved', '00000000-0000-0000-0000-00000000000a', now());

-- ---------- Demandes, devis, missions ----------
insert into public.requests (id, client_id, service_id, city_id, title, description, budget_cents, start_date, status) values
  ('a1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001',
   (select id from public.cities where slug='casablanca'), 'Villa R+1 à Dar Bouazza', 'Suivi du gros œuvre, visite chaque semaine.', 900000, current_date - 30, 'in_progress'),
  ('a1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000002',
   (select id from public.cities where slug='rabat'), 'Certificat de propriété et légalisation', 'Retrait à la conservation foncière.', 80000, current_date - 20, 'completed'),
  ('a1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000003',
   (select id from public.cities where slug='tanger'), 'Préparation appartement Malabata', 'Ménage complet et vérification plomberie avant l’été.', 200000, current_date - 10, 'disputed'),
  ('a1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000001',
   (select id from public.cities where slug='casablanca'), 'Rénovation cuisine à Maârif', 'Besoin de 4 visites pendant les travaux.', 300000, current_date + 7, 'quoted'),
  ('a1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000003',
   (select id from public.cities where slug='tanger'), 'État des lieux après départ locataire', 'Photos de chaque pièce et relevé des compteurs.', 60000, current_date + 3, 'open');

insert into public.quotes (id, request_id, provider_id, total_cents, message, proposed_milestones, status) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 240000,
   'Trois visites avec rapport détaillé.', '[{"title":"Visite fondations","amount_cents":80000},{"title":"Visite élévation","amount_cents":80000},{"title":"Visite toiture","amount_cents":80000}]', 'accepted'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 60000,
   'Retrait et envoi scanné.', '[{"title":"Retrait du certificat","amount_cents":60000}]', 'accepted'),
  ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 150000,
   'Ménage + plombier partenaire.', '[{"title":"Ménage complet","amount_cents":70000},{"title":"Vérification plomberie","amount_cents":80000}]', 'accepted'),
  ('a2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 280000,
   'Quatre visites hebdomadaires.', '[{"title":"Visite 1","amount_cents":70000},{"title":"Visite 2","amount_cents":70000},{"title":"Visite 3","amount_cents":70000},{"title":"Visite 4","amount_cents":70000}]', 'pending'),
  ('a2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 260000,
   'Je coordonne avec votre architecte.', '[{"title":"Visites 1-2","amount_cents":130000},{"title":"Visites 3-4","amount_cents":130000}]', 'pending');

insert into public.missions (id, request_id, quote_id, client_id, provider_id, service_id, title, status, commission_rate, total_cents, completed_at) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'Villa R+1 à Dar Bouazza', 'in_progress', 0.15, 240000, null),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000002', 'Certificat de propriété et légalisation', 'completed', 0.15, 60000, now() - interval '5 days'),
  ('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000003', 'Préparation appartement Malabata', 'disputed', 0.15, 150000, null);

insert into public.milestones (id, mission_id, position, title, amount_cents, status, funded_at, submitted_at, approved_at, released_at) values
  ('a4000000-0000-0000-0000-000000000011', 'a3000000-0000-0000-0000-000000000001', 1, 'Visite fondations', 80000, 'released', now() - interval '25 days', now() - interval '20 days', now() - interval '19 days', now() - interval '19 days'),
  ('a4000000-0000-0000-0000-000000000012', 'a3000000-0000-0000-0000-000000000001', 2, 'Visite élévation', 80000, 'submitted', now() - interval '10 days', now() - interval '1 day', null, null),
  ('a4000000-0000-0000-0000-000000000013', 'a3000000-0000-0000-0000-000000000001', 3, 'Visite toiture', 80000, 'pending', null, null, null, null),
  ('a4000000-0000-0000-0000-000000000021', 'a3000000-0000-0000-0000-000000000002', 1, 'Retrait du certificat', 60000, 'released', now() - interval '15 days', now() - interval '6 days', now() - interval '5 days', now() - interval '5 days'),
  ('a4000000-0000-0000-0000-000000000031', 'a3000000-0000-0000-0000-000000000003', 1, 'Ménage complet', 70000, 'disputed', now() - interval '8 days', now() - interval '3 days', null, null),
  ('a4000000-0000-0000-0000-000000000032', 'a3000000-0000-0000-0000-000000000003', 2, 'Vérification plomberie', 80000, 'pending', null, null, null, null);

insert into public.transactions (mission_id, milestone_id, type, amount_cents, provider_ref, actor_id, created_at) values
  ('a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000011', 'deposit', 80000, 'sim_dep_seed1', 'c0000000-0000-0000-0000-000000000001', now() - interval '25 days'),
  ('a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000011', 'release', 68000, 'sim_rel_seed1', 'c0000000-0000-0000-0000-000000000001', now() - interval '19 days'),
  ('a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000011', 'commission', 12000, 'sim_com_seed1', 'c0000000-0000-0000-0000-000000000001', now() - interval '19 days'),
  ('a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000012', 'deposit', 80000, 'sim_dep_seed2', 'c0000000-0000-0000-0000-000000000001', now() - interval '10 days'),
  ('a3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000021', 'deposit', 60000, 'sim_dep_seed3', 'c0000000-0000-0000-0000-000000000002', now() - interval '15 days'),
  ('a3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000021', 'release', 51000, 'sim_rel_seed3', 'c0000000-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('a3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000021', 'commission', 9000, 'sim_com_seed3', 'c0000000-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('a3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000031', 'deposit', 70000, 'sim_dep_seed4', 'c0000000-0000-0000-0000-000000000003', now() - interval '8 days');

insert into public.reports (id, milestone_id, author_id, body, created_at) values
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'Fondations coulées conformément aux plans. Ferraillage vérifié.', now() - interval '20 days'),
  ('a5000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'Élévation du RDC terminée, poteaux d’étage en cours. Retard de 3 jours dû à la livraison de briques.', now() - interval '1 day'),
  ('a5000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-000000000003', 'Ménage effectué dans toutes les pièces.', now() - interval '3 days');
insert into public.report_media (report_id, storage_path, kind, captured_at, latitude, longitude, accuracy_m) values
  ('a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000011/1.jpg', 'photo', now() - interval '20 days', 33.5168, -7.8274, 6),
  ('a5000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000012/1.jpg', 'photo', now() - interval '1 day', 33.5169, -7.8271, 5),
  ('a5000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000003/a4000000-0000-0000-0000-000000000031/1.jpg', 'photo', now() - interval '3 days', 35.7806, -5.7812, 8);

insert into public.disputes (milestone_id, mission_id, opened_by, reason) values
  ('a4000000-0000-0000-0000-000000000031', 'a3000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003',
   'Les photos ne montrent pas la cuisine ni la salle de bain.');

insert into public.messages (mission_id, sender_id, body, created_at) values
  ('a3000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Bonjour Omar, merci pour le rapport !', now() - interval '19 days'),
  ('a3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Avec plaisir. Prochaine visite jeudi.', now() - interval '19 days');

insert into public.reviews (mission_id, client_id, provider_id, rating, comment) values
  ('a3000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 5, 'Rapide, sérieuse et très bien communiqué.');
update public.provider_profiles set missions_completed = 1 where user_id = 'b0000000-0000-0000-0000-000000000002';
delete from public.notifications;  -- pas de notifications générées par le seed
