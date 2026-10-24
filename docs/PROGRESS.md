# Studyweb progress
Updated: 2026-10-24

## Verified completed
- Remote Cloudflare D1 migrations and initial administrator provisioning succeeded.
- Public Worker URL was deployed: https://studyweb-api.tranlocbtr99.workers.dev (initial deployment run 40105793377).
- React student/admin login selection and student self-registration form/API are committed.
- API and frontend checks, including registration boundary tests, passed (runs 40107209759, 40107080404).
- Remote read-only authentication schema diagnostic succeeded (run 40107481906): users, roles, user_roles, sessions and login_rate_limits tables exist; users=1, roles=1 (admin), sessions=0, login_rate_limits=2.
- Auth error paths now log only non-sensitive error categories; code not yet deployed.

## Known blocker
- On the previously deployed site, login returned HTTP 503. Schema absence has been ruled out, but actual Worker-side cause is not established.
- New registration/login UI and sanitized diagnostic logs have not yet been deployed or verified on Cloudflare.
- Registration is not yet proven with a real D1 insert and student login.

## Not yet verified
- Live end-to-end student/admin login and self-registration.
- Load testing at 100–500 concurrent students.
- Complete admin authoring/results UI, production recovery/rollback/backup.

## Next task
- Use a single controlled beta deployment after checks pass; inspect Worker logs and test authenticated login, registration and role isolation.
- If 503 persists, diagnose Worker execution/crypto and D1 binding using sanitized logs; do not guess at root cause.
- Preserve existing data; do not rerun bootstrap or reset migrations.
