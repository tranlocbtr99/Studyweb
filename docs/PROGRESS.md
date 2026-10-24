# Progress
Updated: 2026-10-24
## Completed
- Two-D1 schema and passing database CI.
- API, sessions/RBAC, PBKDF2 login/logout, same-origin checks and account/IP login throttle.
- API CI passed after fixing test types: https://github.com/tranlocbtr99/Studyweb/actions/runs/40096425853
- Added local Wrangler D1 migration CI for core 0001/0002 and results 0001 plus smoke SQL; new CI run pending.
## Pending
- Verify actual Wrangler D1 CI run and repair compatibility issues.
- Secure user provisioning, admin authoring, immutable grading snapshot, attempts/autosave/atomic submission, UI, load tests, backups and deployment.
## Risks
- Local D1 smoke SQL is not full behavioral integration or remote production validation.
- Login throttling may affect shared IPs; D1 quota usage unmeasured.
- No production deployment; 500 simultaneous users not validated.
## Next task
- Confirm D1 local CI and address failures; then implement admin question/exam authoring with RBAC and audit logs.
## Relevant files
- .github/workflows/d1-local-checks.yml; packages/db/tests/d1-*.sql; packages/db/migrations/.
