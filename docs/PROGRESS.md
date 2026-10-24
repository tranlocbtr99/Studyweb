# Progress
Updated: 2026-10-24
## Completed
- D1 core/results schema, secure auth, subject authoring and admin audit.
- Added admin topic creation with subject validation, RBAC, CSRF, audit and unit tests; CI pending.
## Pending
- Confirm D1 smoke CI and new API CI; real D1 batch rollback tests.
- Question/option authoring, exam publishing, user provisioning, attempts, autosave, grading, frontend, load tests and deployment.
## Risks
- D1 smoke test is not HTTP integration; production deployment not approved.
- 500 concurrent users unverified.
## Next task
- Verify CI; implement question draft schema and authoring safely.
