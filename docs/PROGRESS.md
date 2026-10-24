# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, auth/RBAC/CSRF and admin question/exam/version authoring.
- Exam item snapshot API CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097622973
- Added positive-path unit tests for snapshot persistence and private answer secrecy; new CI pending.
## Pending
- Verify new API CI; real D1 HTTP integration and rollback checks, safe content hashing and guarded publication.
- Attempts/autosave/grading, frontend, load tests, deployment.
## Risks
- Snapshot positive-path tests use mocks, not real D1; publishing remains disabled.
- 500 concurrent users unverified; no production deployment.
## Next task
- Verify API CI then add D1-backed snapshot integration tests.
