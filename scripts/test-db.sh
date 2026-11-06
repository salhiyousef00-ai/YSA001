#!/usr/bin/env bash
# Exécute migrations + seed + tests pgTAP sur un Postgres local nu (sans Docker/Supabase CLI).
# Usage : PGHOST=localhost PGUSER=postgres ./scripts/test-db.sh
# Avec Supabase CLI, préférez : supabase db reset && supabase test db
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-wasla_test}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null; }
run scripts/db-stubs.sql
for f in supabase/migrations/*.sql; do echo "→ $f"; run "$f"; done
echo "→ supabase/seed.sql"; run supabase/seed.sql
pg_prove -d "$DB" supabase/tests/database/*.test.sql
