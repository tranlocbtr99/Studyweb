# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, auth/RBAC/CSRF, admin subjects/topics and audit.
- D1 local migration CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097063879
- Added draft question authoring with four labeled options, private answer metadata, migration 0004, tests; new CI pending.
## Pending
- Verify new API/D1 CI; real D1 batch rollback tests; secure exam snapshot/publishing.
- User provisioning, attempts/autosave/grading, frontend, load tests, production deployment.
## Risks
- Question creation tests are mocked; local D1 migration checks do not prove full HTTP-to-D1 transaction behavior.
- 500 concurrent users unverified; no production deployment.
## Next task
- Verify CI and build question authoring integration tests with real local D1.
