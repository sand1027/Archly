# Demo databases for Archly Schema import

Local-only sample DBs (blog schema: users → posts → comments, tags).

## PostgreSQL (`archly_demo`)

Seeded into your Docker `archly-db` container.

**URL (API running in Docker Compose):**
```
postgresql://postgres:password@db:5432/archly_demo
```

**URL (API running on your Mac, not in Docker):**
```
postgresql://postgres:password@localhost:5432/archly_demo
```

**URL (API in Docker but you prefer host networking):**
```
postgresql://postgres:password@host.docker.internal:5432/archly_demo
```

Re-seed anytime:
```bash
docker exec -i archly-db psql -U postgres -c "CREATE DATABASE archly_demo;" 2>/dev/null || true
docker exec -i archly-db psql -U postgres -d archly_demo -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
docker exec -i archly-db psql -U postgres -d archly_demo < archly-backend/testdata/demo-postgres.sql
```

## SQLite (`demo.db`)

File: `archly-backend/testdata/demo.db` (mounted into the API as `/app/testdata/demo.db`).

**URL (API in Docker Compose):**
```
sqlite:////app/testdata/demo.db
```
or just:
```
/app/testdata/demo.db
```

**URL (API on your Mac):**
```
sqlite:////Users/sandeepv/Desktop/Archly/archly-backend/testdata/demo.db
```

Rebuild the file:
```bash
cd archly-backend/testdata
rm -f demo.db
sqlite3 demo.db < demo-sqlite.sql
# or: python3 -c "import sqlite3; from pathlib import Path; c=sqlite3.connect('demo.db'); c.executescript(Path('demo-sqlite.sql').read_text()); c.close()"
```

## Why not a public cloud URL?

There is no stable, open, credential-free Postgres on the internet for this. Free Neon/Supabase/Railway need your account. These local demos are reliable for testing import, FKs, and export.
