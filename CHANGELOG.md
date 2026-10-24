# Changelog
## 2026-10-24 — Wrangler D1 local checks
- Added CI workflow to apply both database baselines and login throttle migration in local Cloudflare D1.
- Added schema smoke queries and foreign-key checks.
- CI verification pending; no remote migrations or production deployment.
## 2026-10-24 — Login rate limit fix
- Corrected TypeScript test double; API CI passed.
## 2026-10-24 — Login throttling
- Added D1 login rate-limit migration and tests.
## 2026-10-24 — Authentication and API
- Added session RBAC, password login/logout, CSRF origin checks and read-only API.
## 2026-10-24 — Database foundation
- Added two D1 migrations and tests.
