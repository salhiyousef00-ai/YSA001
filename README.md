# Wasla — MVP

Wasla met en relation des **Marocains résidant à l'étranger (MRE)** avec des **prestataires vérifiés au Maroc** pour trois services : suivi de chantier, démarches administratives et gestion de biens.

La confiance repose sur trois piliers :

1. **Prestataires vérifiés** : CIN, selfie, fiche anthropométrique et statut légal, validés par un admin.
2. **Preuves** : photos et vidéos prises uniquement avec la caméra de l'app, horodatées et géolocalisées.
3. **Paiement par étapes sous séquestre** : chaque étape est libérée seulement après validation du client. Le paiement est simulé dans le MVP.

## Structure

```
apps/
  mobile/     Expo (SDK 58) + Expo Router, TypeScript : app client et prestataire
  admin/      Next.js 16 (App Router) : console d'administration
packages/
  shared/     Types, enums, machine d'états, calculs de séquestre, PaymentProvider, KycProvider
supabase/
  migrations/ Schéma, RLS, RPC métier, Storage, Realtime, confidentialité
  functions/  Edge Functions : send-push, delete-account
  tests/      Tests pgTAP (RLS, séquestre, avis, admin, suppression de compte)
  seed.sql    Données de démo
scripts/      test-db.sh : tests pgTAP sur un Postgres nu (CI, sans Docker)
```

### Principes de sécurité

- **RLS activée sur toutes les tables.** Les lectures sont filtrées par des politiques.
- **Écritures sensibles via des RPC `security definer`.** Cela concerne les statuts, l'argent, la vérification et l'administration. Chaque RPC revérifie l'appelant et la transition d'état. Une table ne peut pas être modifiée directement : les privilèges de colonnes l'empêchent, par exemple pour `role`, `is_suspended`, `verification_status` et `transactions`.
- **Clé anon uniquement.** C'est la seule clé de l'app mobile et de la console admin, qui agit avec la session de l'admin. La clé `service_role` n'existe que dans les Edge Functions.
- **Buckets Storage privés.** Le premier segment du chemin conditionne l'accès, et les fichiers sont servis par URL signée de courte durée. Le bucket `verification/{uid}/` est réservé au propriétaire et aux admins.
- **Machine d'états dupliquée volontairement.** Elle existe en SQL (source de vérité) et dans `packages/shared` (UI). Les deux versions sont couvertes par des tests.
- **Loi 09-08 (CNDP).**
  - Minimisation des données : la vue `public_provider_profiles` ne montre ni le téléphone ni les documents.
  - Suppression de compte : anonymisation, purge des fichiers et suppression du compte Auth.
  - Conservation anonymisée de l'historique financier.

## Prérequis

- Node 22+ et pnpm 10 (`corepack enable`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) et Docker
- Expo Go ou un *development build* (voir plus bas), avec un appareil réel pour la caméra, le GPS et les push

## Installation

```bash
pnpm install
supabase start          # démarre Postgres, Auth, Storage, Realtime, Studio et Inbucket
supabase db reset       # applique les migrations puis seed.sql
```

`supabase start` affiche l'`API URL` et la `anon key`. Copiez les fichiers d'exemple :

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.example apps/admin/.env.local
```

### Variables d'environnement

| Fichier | Variable | Description |
|---|---|---|
| `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL` | URL de l'API. Sur un téléphone, utilisez l'IP LAN de votre machine, par exemple `http://192.168.1.10:54321` |
| | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé **anon** |
| | `EAS_PROJECT_ID` | Optionnel. Identifiant EAS, requis pour les push sur appareil réel |
| `apps/admin/.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` |
| | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé **anon** |
| `supabase/functions/.env` | `PAYMENT_PROVIDER` | `simulated` (par défaut) |

> Ne mettez **jamais** la clé `service_role` dans `apps/mobile` ni dans `apps/admin`.

### Notifications push (base → Edge Function)

Le trigger `private.on_notification_inserted` appelle `send-push` via `pg_net`. Il lit deux secrets dans Vault. Une seule fois par environnement :

```sql
select vault.create_secret('http://host.docker.internal:54321', 'project_url');  -- en prod : https://<ref>.supabase.co
select vault.create_secret('<service_role_key>', 'service_role_key');
```

Sans ces secrets, les notifications sont quand même enregistrées en base, mais aucun push n'est envoyé.

## Lancement en local

```bash
supabase functions serve --env-file supabase/functions/.env   # Edge Functions
pnpm dev:admin                                                 # http://localhost:3000
pnpm dev:mobile                                                # Expo : scanner le QR code
```

### Comptes de démo

Mot de passe commun : **`Wasla2026!`**

| Rôle | E-mail | Détail |
|---|---|---|
| Admin | `admin@wasla.test` | Console web |
| Client | `yasmine@wasla.test` | France. Mission de chantier en cours, avec un rapport à valider |
| Client | `karim@wasla.test` | Belgique. Mission terminée et notée, demande avec 2 devis |
| Client | `salma@wasla.test` | Canada. Mission en litige, demande ouverte |
| Prestataire | `omar@wasla.test` | Vérifié (Casablanca, Rabat), diplôme et assurance |
| Prestataire | `nadia@wasla.test` | Vérifiée (Rabat, Casablanca) |
| Prestataire | `youssef@wasla.test` | Vérifié (Tanger, Tétouan), assuré |
| Prestataire | `hamza@wasla.test` | Vérification en attente (Fès) |
| Prestataire | `leila@wasla.test` | Vérification rejetée (Agadir) |

Dans l'app mobile, choisissez « Se connecter avec un mot de passe ». Les OTP e-mail locaux arrivent dans Inbucket (http://127.0.0.1:54324). Pour l'OTP SMS, les numéros de test `+212600000001` et `+212600000099` acceptent le code `123456` (voir `supabase/config.toml`). En production, configurez un fournisseur SMS (Twilio, etc.).

Les fichiers du seed (pièces d'identité, photos de rapports) sont des chemins fictifs : ils s'affichent « indisponibles ». Créez de vraies données depuis l'app pour voir les images.

## Tests

```bash
pnpm test               # Vitest (packages/shared) + Jest (apps/mobile)
pnpm typecheck          # TypeScript sur tout le monorepo
supabase test db        # tests pgTAP sur la base locale Supabase
./scripts/test-db.sh    # mêmes tests pgTAP sur un Postgres 16 nu avec pgTAP (utilisé en CI)
```

Ce qui est couvert :

- **RLS**
  - Isolation entre clients
  - Documents de vérification privés, y compris dans Storage
  - Visibilité des demandes par zone, service et statut de vérification
  - Pas d'auto-promotion admin
  - Pas d'écriture directe dans les devis, les transactions ou les fonctions internes
  - Comptes suspendus bloqués
- **Machine d'états et séquestre**
  - Ordre imposé : dépôt, puis rapport, puis validation, puis libération
  - Commission figée à l'acceptation et arrondie au centime
  - Solde de séquestre nul après libération
  - Litige suivi d'un remboursement
  - Mission terminée automatiquement
- **Avis**
  - Uniquement après une mission terminée
  - Un seul avis par mission
- **Admin** : vérification impossible sans documents approuvés, motif de rejet obligatoire
- **Suppression de compte**
  - Bloquée si des fonds sont en séquestre
  - Purge des données personnelles

## Build Expo

L'app utilise des modules natifs (caméra, localisation, notifications) : utilisez un *development build* plutôt qu'Expo Go pour tout tester.

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init                                   # renseigne EAS_PROJECT_ID
npx eas-cli build --profile development --platform android   # ou ios
npx eas-cli build --profile production --platform all
```

Définissez `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans les variables d'environnement EAS (`eas env:create`) pour les builds distants.

Pour un build local : `npx expo prebuild`, puis `npx expo run:android` ou `npx expo run:ios`.

## Points d'extension

- **Paiement réel (CMI, Stripe…).** Implémentez `PaymentProvider` (`packages/shared/src/payment.ts`) dans une Edge Function. Passez `platform_settings.payment_mode` à une autre valeur que `simulated`. `fund_milestone` refuse alors l'appel direct depuis l'app, et le dépôt doit être confirmé par la fonction (webhook du prestataire de paiement) avec la clé service. Les états et l'historique (`transactions`) restent identiques.
- **KYC (Sumsub, Onfido).** Implémentez `KycProvider` (`packages/shared/src/kyc.ts`). Les colonnes `provider_profiles.kyc_provider` et `kyc_external_id` sont prévues. Un webhook pourra appeler `admin_set_verification`.
- **Nouveaux services.** Ajoutez-les depuis la console admin (`/services`). Le catalogue est lu en base par l'app.

## Langues

Les trois langues sont le français (par défaut), l'arabe (RTL) et l'anglais. Les traductions se trouvent dans `apps/mobile/src/i18n/{fr,ar,en}.ts`. Le typage TypeScript garantit que les trois fichiers ont les mêmes clés. Passer en arabe active `I18nManager.forceRTL` : l'app recharge en dev, et un redémarrage est demandé en production. Les styles utilisent des propriétés logiques (`start`, `end`) pour s'inverser correctement.
