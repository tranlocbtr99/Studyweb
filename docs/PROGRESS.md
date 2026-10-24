# Progress
Updated: 2026-10-24
## Completed
- Two-D1 schemas and passing database CI.
- Hono read-only API and passing API CI.
- Session authorization and RBAC CI steps passed in run 40096155379.
- Added password PBKDF2-SHA256 hash/verify helpers, same-origin write protection, secure HttpOnly SameSite=Strict login cookies, hashed token persistence, logout revocation, targeted tests. New CI pending.
## Pending
- Confirm latest auth/login CI; add login rate limiting, lockout monitoring and abuse controls before public release.
- Provision users securely (no public registration), admin CRUD, trusted grading snapshot, attempts/autosave/submit, UI, Cloudflare D1 validation, backups, load tests and deployment.
## Security
- No plaintext passwords/session tokens stored; cookie-authenticated write requests require matching Origin.
- Login uses PBKDF2 with random salt; production abuse/rate controls not yet implemented.
- Exam mutation routes remain disabled.
## Risks
- No cross-D1 transaction; grading integrity and 500-user target unverified.
## Next task
- Verify auth/login CI and add login rate limiting plus abuse safeguards.
## Relevant files
- apps/api/src/auth.ts; apps/api/src/password.ts; apps/api/src/index.ts; apps/api/tests/login.test.ts.
