# Progress
Updated: 2026-10-24
## Completed
- Two D1 databases, secure authentication, RBAC, admin subject/topic/question creation.
- API, Database and D1 CI all passed for draft question authoring: https://github.com/tranlocbtr99/Studyweb/actions
- Added local D1 question draft, four options, correct key and duplicate-label constraint checks; new CI pending.
## Pending
- Confirm new D1 smoke CI; real HTTP-to-D1 integration tests and batch rollback behavior.
- Exam draft/version publishing, secure exam snapshots, user provisioning, attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- D1 smoke tests validate SQL constraints but not HTTP-to-D1 batch atomicity.
- 500 simultaneous users unverified; no production deployment.
## Next task
- Verify CI and build exam authoring/publishing with immutable versions.
