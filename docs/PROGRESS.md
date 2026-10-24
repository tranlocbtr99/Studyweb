# Progress
Updated: 2026-10-24
## Completed
- Two-D1 schemas, initial API, secure login/logout, session RBAC and CSRF checks.
- Login throttle migration and implementation: per-account and per-IP fixed windows.
- Investigated API CI failure on commit 4f5ca54: test double missing ReadDb.all() and generic first<T>() contract.
- Corrected test double to satisfy ReadDb structural type; CI rerun pending.
## Pending
- Confirm API CI; validate both D1 migrations using Wrangler local.
- Secure user provisioning, admin CRUD, trusted grading snapshot, autosave, atomic submit/grade, UI, load tests, backups and deployment.
## Risks
- Login throttling writes consume D1 quotas and can affect shared IPs.
- No production deployment; 500 simultaneous users not validated.
## Next task
- Confirm CI, then test Wrangler D1 migration compatibility before admin authoring.
## Relevant files
- apps/api/tests/login-limit.test.ts; apps/api/src/login-limit.ts; packages/db/migrations/core/0002_login_rate_limits.sql.
