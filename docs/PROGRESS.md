# Progress
Updated: 2026-10-24
## Completed
- D1 core/results, secure auth, admin exam authoring and draft snapshots.
- SHA-256 digest helper CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097947641
- Added admin publish endpoint with draft checks, SHA-256 content validation, conditional D1 update, change-count check and audit. CI pending.
## Pending
- Verify API CI; add real D1 integration and concurrent modification tests before production use.
- Student attempts, autosave, grading, frontend, load tests and deployment.
## Risks
- Publication checks item count but not an atomic database-side content digest; concurrent same-count item replacement could race between read and update. Do not deploy publishing until transaction guard is strengthened.
- No HTTP-to-D1 rollback proof, no 500-user load test, no production deployment.
## Next task
- Verify API CI and close publish read/write race with D1-backed integration tests.
