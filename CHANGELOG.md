# Changelog
## 2026-10-24 — Session authentication and roles
- Added SHA-256 hashed session-token lookup with expiry/revocation and active-user checks.
- Added protected /me and admin role check; no login issuance or mutation endpoints yet.
- Added authentication unit tests; CI verification pending.
## 2026-10-24 — API CI repair
- Repaired unavailable dependency; API CI passed.
## 2026-10-24 — Read-only API
- Added Hono Worker API and tests.
## 2026-10-24 — Database
- Added two D1 migrations, Drizzle mappings and passing CI.
## 2026-10-24 — Architecture
- Adopted two D1 databases and initial documentation.
