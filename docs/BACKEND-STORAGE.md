# Backend account storage

The current database adapter in `backend/src/db/client.ts` uses a JSON store.
It does not select PostgreSQL when `DATABASE_URL` is configured. The Compose
PostgreSQL service is separate from this active account store.

Docker sets `JSON_DB_PATH=/data/db/db.json`. The `appdata` named volume persists
that directory across API container recreation, and its initial directory is
owned by the runtime `bun` user. Uploaded documents use the separate `storage`
volume at `/data/storage`.

`GET /ready` checks that the account-store directory permits creating and
removing a probe file. Docker uses this readiness endpoint for its health check.
Failed JSON writes roll back their in-memory mutation and allow subsequent
writes to retry. Registration and guest-upgrade regression tests also check
login after a new process loads the persisted store.

The deployed server retains its existing port mapping. Its configuration and
source backups from this fix are under `.codex-backup-auth-*` in the backend
project directory.
