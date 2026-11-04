#!/usr/bin/env bash
# Push the schema to the hosted Turso database and seed the demo data.
# Usage: DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... scripts/deploy-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?set DATABASE_URL to the Turso libsql:// URL}"
: "${DATABASE_AUTH_TOKEN:?set DATABASE_AUTH_TOKEN (turso db tokens create <db>)}"
npx tsx scripts/migrate.ts
npx tsx scripts/seed.ts
