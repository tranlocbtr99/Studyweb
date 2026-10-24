# Progress
Updated: 2026-10-24
## Completed
- Architecture and two-D1 schemas; database CI passed.
- Read-only Hono API; API CI passed after dependency repair: https://github.com/tranlocbtr99/Studyweb/actions/runs/40096031161
- Session validation middleware, hashed cookie token lookup, expiry/revocation and active-user checks, role guards, /me and protected admin status, focused tests (new CI pending).
## Pending
- Verify auth CI.
- Secure login/password verification, token issuance, logout and CSRF defenses.
- Admin authoring, trusted grading snapshot, attempts/autosave/submit, frontend, Cloudflare D1 integration, load tests, backups and deployment.
## Risks
- No cross-D1 transactions; do not enable write routes without reviewed atomic protocol.
- No production deployment; 500-user target unverified.
## Next task
- Verify CI and implement secure login/logout + CSRF with tests.
## Relevant files
- apps/api/src/auth.ts; apps/api/src/index.ts; apps/api/tests/auth.test.ts.
