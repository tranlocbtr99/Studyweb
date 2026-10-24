# Progress
Updated: 2026-10-24
## Completed
- Architecture and two-D1 schema; database CI passed.
- Read-only API, session validation/RBAC, PBKDF2 login/logout and CSRF protection; API CI passed for login commit 5374f24.
- Added forward-only exam_core rate-limit migration, atomic D1 fixed-window counters (account and Cloudflare IP), fail-closed protection and targeted tests; new CI pending.
## Pending
- Confirm new CI; verify migration 0002 in real local Wrangler D1.
- Provision users securely; admin question/exam authoring; trusted grading snapshot; attempt/autosave/atomic submit; UI; load tests; backups; deployment.
## Security / risks
- Throttle is 8 attempts per account and 30 per IP per 15 minutes, including successful attempts. A shared IP may affect legitimate users; production tuning needed.
- Do not accept untrusted forwarded IP headers; only Cloudflare-provided connecting IP. No fallback to unlimited traffic.
- D1 writes per login may consume free quota; tune after measuring.
- No exam mutation routes; no production deployment; 500-user capacity unverified.
## Next task
- Verify CI and migration compatibility, then implement admin authoring with RBAC, validation and audit logging.
## Relevant files
- apps/api/src/login-limit.ts; apps/api/tests/login-limit.test.ts; packages/db/migrations/core/0002_login_rate_limits.sql.
