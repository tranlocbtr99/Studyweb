# Progress
Updated: 2026-10-24
## Completed
- Two D1 schemas, auth/RBAC/CSRF, admin subject/topic/question/exam authoring.
- Exam creation API CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097321091
- Added admin-only empty draft exam version creation with SQL-side version numbering and audit; new API CI pending.
## Pending
- Verify CI; attach validated question snapshots and private keys, calculate content hash, implement guarded publication.
- HTTP-to-D1 rollback integration tests, user provisioning, attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- Draft versions currently contain no questions; content_hash is empty until snapshot assembly is implemented. Publishing is not enabled.
- Version allocation unique constraint may return 503 on simultaneous collisions; retry strategy not implemented.
- No production deployment; 500 concurrent users unverified.
## Next task
- Verify CI, then implement safe snapshot assembly and publishing prerequisites.
