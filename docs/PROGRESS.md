# Progress
Updated: 2026-10-24
## Completed
- Two D1 schemas, local Wrangler migration checks, auth, RBAC, CSRF and login throttle.
- Admin subject authoring with D1 batch audit, migration 0003, and passing API CI: https://github.com/tranlocbtr99/Studyweb/actions/runs/40096784473
- Added local D1 admin subject/audit/duplicate slug smoke test; new CI pending.
## Pending
- Confirm D1 CI and add full Worker request-to-D1 integration tests, including batch rollback and failure handling.
- Topic/question/exam authoring, user provisioning, grading snapshots, attempts/autosave/submit, frontend, load tests and deployment.
## Risks
- SQL smoke test verifies schema/data constraints, not API request execution or batch rollback.
- No production deployment; 500 concurrent users unverified.
## Next task
- Verify CI, then add topic/question authoring with version safety.
